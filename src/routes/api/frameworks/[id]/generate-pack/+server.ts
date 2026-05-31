import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';
import { getComplianceGaps, getFrameworkScores } from '$lib/server/data';
import { callLlm, getTenantProvider } from '$lib/server/llm';
import { checkRateLimit } from '$lib/server/rateLimit';
import { agentBus } from '$lib/server/sse';

export const POST: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) throw error(401, 'Not authenticated');
  if (!isPgMode()) throw error(400, 'Requires Postgres mode');
  if (!checkRateLimit('framework.generate-pack', locals.user.id, 5, 5 * 60_000)) {
    throw error(429, 'Too many pack generations — try again in a few minutes.');
  }

  const pool = getPool();

  const { rows } = await pool.query<{ id: string; name: string; version: string; total_requirements: number }>(
    `SELECT id, name, version, total_requirements FROM compliance.frameworks WHERE id = $1 LIMIT 1`,
    [params.id]
  );
  if (!rows.length) throw error(404, 'Framework not found');
  const framework = rows[0];

  const [gaps, scores, provider] = await Promise.all([
    getComplianceGaps(params.id, locals.user.tenantId),
    getFrameworkScores(locals.user.tenantId),
    getTenantProvider(locals.user.tenantId)
  ]);

  const score = scores.find((s) => s.frameworkId === params.id);
  const criticalGaps = gaps.filter((g) => g.severity === 'critical' || g.severity === 'high');

  const gapList = criticalGaps.slice(0, 10)
    .map((g) => `- [${g.severity?.toUpperCase()}] ${g.requirementCode}: ${g.requirementTitle}`)
    .join('\n') || 'No critical or high gaps identified.';

  const userPrompt = [
    `Framework: ${framework.name} ${framework.version ?? ''}`.trim(),
    `Total requirements: ${framework.total_requirements}`,
    `Compliance score: ${score?.score ?? 'N/A'}/100`,
    `Status: ${score?.status ?? 'in-progress'}`,
    `Open gaps (critical/high): ${criticalGaps.length}`,
    '',
    'Top gaps:',
    gapList
  ].join('\n');

  const systemPrompt = 'You are a GRC analyst preparing a compliance readiness pack for an executive audience. Write 3–4 concise paragraphs in a formal, data-driven tone. Use markdown bold for the title. Reference exact numbers provided. Do not invent any data not listed.';

  const llmText = await callLlm(systemPrompt, userPrompt, provider, { maxTokens: 800 });

  const summary = llmText ?? [
    `**${framework.name} Compliance Readiness Pack**`,
    '',
    `Current compliance score: ${score?.score ?? 'N/A'}/100 (${score?.status ?? 'in-progress'}).`,
    `Total requirements assessed: ${framework.total_requirements}.`,
    `Open gaps: ${gaps.length} total, ${criticalGaps.length} critical or high severity.`,
    criticalGaps.length > 0
      ? `\nPriority remediation items: ${criticalGaps.slice(0, 3).map((g) => `${g.requirementCode} (${g.severity})`).join(', ')}.`
      : ''
  ].filter(Boolean).join('\n');

  // Store as an agent run so it appears in the activity stream
  const t0 = Date.now();
  const { rows: agentRows } = await pool.query<{ id: string; name: string; cost_per_run_cents: number; fte_equivalent: number }>(
    `SELECT id, name, cost_per_run_cents, fte_equivalent FROM agent.agents
     WHERE (name ILIKE '%compliance%' OR name ILIKE '%audit%' OR name ILIKE '%framework%')
       AND tenant_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [locals.user.tenantId]
  );

  let runId: string | null = null;
  if (agentRows.length > 0) {
    const ag = agentRows[0];
    const latencyMs = Date.now() - t0;
    const { rows: run } = await pool.query<{ id: string }>(
      `INSERT INTO agent.runs (tenant_id, agent_id, trigger, status, input_summary, output_summary, latency_ms, cost_cents, ended_at)
       VALUES ($1, $2, 'manual', 'success', $3, $4, $5, $6, now())
       RETURNING id::text`,
      [
        locals.user.tenantId,
        ag.id,
        `Generate compliance pack: ${framework.name}`,
        summary.slice(0, 500),
        latencyMs,
        ag.cost_per_run_cents
      ]
    );
    runId = run[0].id;
    pool.query(
      `INSERT INTO agent.cost_ledger (tenant_id, agent_id, ts, runs, cost_cents, fte_saved_hours)
       VALUES ($1, $2, now(), 1, $3, $4)`,
      [locals.user.tenantId, ag.id, ag.cost_per_run_cents, +(ag.fte_equivalent * 0.5).toFixed(2)]
    ).catch(() => {});
    agentBus.dispatch({
      ts: new Date().toISOString(),
      agentId: ag.id,
      agentName: ag.name,
      status: 'success',
      inputSummary: `Generate compliance pack: ${framework.name}`,
      outputSummary: summary.slice(0, 200),
      latencyMs,
      costCents: ag.cost_per_run_cents,
    });
  }

  writeAuditLog({
    userId: locals.user.id,
    actorEmail: locals.user.email,
    tenantId: locals.user.tenantId,
    action: 'framework.audit_pack.generated',
    target: `framework:${params.id}`,
    result: 'success',
    metadata: { frameworkName: framework.name, score: score?.score, gapCount: gaps.length, runId, provider }
  });

  return json({ ok: true, summary, runId });
};
