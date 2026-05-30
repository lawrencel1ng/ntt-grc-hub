import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';
import { getComplianceGaps, getFrameworkScores } from '$lib/server/data';
import { env } from '$env/dynamic/private';

export const POST: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) throw error(401, 'Not authenticated');
  if (!isPgMode()) throw error(400, 'Requires Postgres mode');

  const pool = getPool();

  const { rows } = await pool.query<{ id: string; name: string; version: string; total_requirements: number }>(
    `SELECT id, name, version, total_requirements FROM compliance.frameworks WHERE id = $1 LIMIT 1`,
    [params.id]
  );
  if (!rows.length) throw error(404, 'Framework not found');
  const framework = rows[0];

  const [gaps, scores] = await Promise.all([
    getComplianceGaps(params.id, locals.user.tenantId),
    getFrameworkScores(locals.user.tenantId)
  ]);

  const score = scores.find((s) => s.frameworkId === params.id);
  const criticalGaps = gaps.filter((g) => g.severity === 'critical' || g.severity === 'high');

  let summary = '';

  const apiKey = env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey });

      const gapList = criticalGaps.slice(0, 10)
        .map((g) => `- [${g.severity?.toUpperCase()}] ${g.requirementCode}: ${g.requirementTitle}`)
        .join('\n') || 'No critical or high gaps identified.';

      const prompt = [
        `Framework: ${framework.name} ${framework.version ?? ''}`.trim(),
        `Total requirements: ${framework.total_requirements}`,
        `Compliance score: ${score?.score ?? 'N/A'}/100`,
        `Status: ${score?.status ?? 'in-progress'}`,
        `Open gaps (critical/high): ${criticalGaps.length}`,
        '',
        'Top gaps:',
        gapList
      ].join('\n');

      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `You are a GRC analyst preparing a compliance readiness pack for an executive audience. Write 3–4 concise paragraphs summarising the organisation's compliance posture for the framework below. Use markdown bold for the title. Be formal and data-driven. Reference the exact numbers provided. Do not invent any data not listed.\n\n${prompt}`
        }]
      });
      const text = message.content[0].type === 'text' ? message.content[0].text : '';
      if (text.trim()) summary = text.trim();
    } catch (e) {
      console.warn('[generate-pack] LLM call failed:', (e as Error).message);
    }
  }

  if (!summary) {
    summary = [
      `**${framework.name} Compliance Readiness Pack**`,
      '',
      `Current compliance score: ${score?.score ?? 'N/A'}/100 (${score?.status ?? 'in-progress'}).`,
      `Total requirements assessed: ${framework.total_requirements}.`,
      `Open gaps: ${gaps.length} total, ${criticalGaps.length} critical or high severity.`,
      criticalGaps.length > 0
        ? `\nPriority remediation items: ${criticalGaps.slice(0, 3).map((g) => `${g.requirementCode} (${g.severity})`).join(', ')}.`
        : ''
    ].filter(Boolean).join('\n');
  }

  // Store as an agent run so it appears in the agent activity stream
  const { rows: agentRows } = await pool.query<{ id: string }>(
    `SELECT id FROM agent.agents
     WHERE (name ILIKE '%compliance%' OR name ILIKE '%audit%' OR name ILIKE '%framework%')
       AND tenant_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [locals.user.tenantId]
  );

  let runId: string | null = null;
  if (agentRows.length > 0) {
    const { rows: run } = await pool.query<{ id: string }>(
      `INSERT INTO agent.runs (tenant_id, agent_id, trigger, status, input_summary, output_summary, latency_ms)
       VALUES ($1, $2, 'manual', 'complete', $3, $4, 0)
       RETURNING id::text`,
      [
        locals.user.tenantId,
        agentRows[0].id,
        `Generate compliance pack: ${framework.name}`,
        summary.slice(0, 500)
      ]
    );
    runId = run[0].id;
  }

  writeAuditLog({
    userId: locals.user.id,
    actorEmail: locals.user.email,
    tenantId: locals.user.tenantId,
    action: 'framework.audit_pack.generated',
    target: `framework:${params.id}`,
    result: 'success',
    metadata: { frameworkName: framework.name, score: score?.score, gapCount: gaps.length, runId }
  });

  return json({ ok: true, summary, runId });
};
