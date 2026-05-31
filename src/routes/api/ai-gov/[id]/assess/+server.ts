import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';
import { checkRateLimit } from '$lib/server/rateLimit';
import { callLlm, getTenantProvider } from '$lib/server/llm';
import { agentBus } from '$lib/server/sse';

const RISK_TYPES = ['bias', 'hallucination', 'drift', 'explainability', 'privacy'] as const;

const RISK_MITIGATIONS: Record<string, string> = {
  bias: 'Implement fairness metrics, diverse training data audits, and regular demographic parity checks.',
  hallucination: 'Add retrieval-augmented generation (RAG) grounding, confidence scoring, and human review for high-stakes outputs.',
  drift: 'Monitor input distribution shifts with statistical tests; schedule quarterly retraining reviews.',
  explainability: 'Deploy SHAP/LIME explainability tooling; document model decisions for regulatory review.',
  privacy: 'Apply differential privacy, data minimisation, and access controls on training data.'
};

export const POST: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) throw error(401, 'Not authenticated');
  if (!isPgMode()) throw error(400, 'Requires Postgres mode');
  if (!(await checkRateLimit('ai-gov.assess', locals.user.id, 10, 5 * 60_000))) throw error(429, 'Too many assessments — try again in a few minutes.');

  const pool = getPool();

  const { rows } = await pool.query<{
    id: string; name: string; tenant_id: string; risk_tier: string;
    kind: string; jurisdiction: string; eu_ai_act_class: string | null;
    iso_42001_status: string; training_data_summary: string | null;
  }>(
    `SELECT id, name, tenant_id, risk_tier, kind, jurisdiction,
            eu_ai_act_class, iso_42001_status::text, training_data_summary
     FROM ai_gov.models WHERE id = $1::uuid LIMIT 1`,
    [params.id]
  );
  if (!rows.length) throw error(404, 'AI model not found');
  if (rows[0].tenant_id !== locals.user.tenantId) throw error(403, 'Forbidden');

  const model = rows[0];
  const isHighRisk = model.risk_tier === 'high' || model.risk_tier === 'critical';
  const severity = isHighRisk ? 'high' : 'medium';

  // Determine per-risk-type severity based on tier and kind
  const riskSeverities: Record<string, string> = {
    bias:            isHighRisk ? 'high' : 'medium',
    hallucination:   isHighRisk ? 'critical' : 'high',
    drift:           isHighRisk ? 'high' : 'medium',
    explainability:  isHighRisk ? 'high' : 'medium',
    privacy:         model.kind === 'generative' ? 'high' : severity
  };

  // Upsert risk entries with per-type mitigations
  for (const riskType of RISK_TYPES) {
    const rsev = riskSeverities[riskType] ?? severity;
    const mitigation = RISK_MITIGATIONS[riskType];
    await pool.query(
      `INSERT INTO ai_gov.model_risk (tenant_id, model_id, risk_type, severity, mitigation)
       VALUES ($1, $2::uuid, $3, $4::risk.severity, $5)
       ON CONFLICT (model_id, risk_type) DO UPDATE
         SET severity = EXCLUDED.severity, mitigation = EXCLUDED.mitigation`,
      [locals.user.tenantId, params.id, riskType, rsev, mitigation]
    ).catch(() => {});
  }

  // Use LLM to generate a concise assessment narrative
  const [provider] = await Promise.all([getTenantProvider(locals.user.tenantId)]);
  const systemPrompt = 'You are an AI governance analyst preparing an ISO 42001 / EU AI Act risk assessment. Write in formal, data-driven language. Be specific and actionable. Use markdown bold for headings. Maximum 300 words.';
  const userPrompt = [
    `Model: ${model.name}`,
    `Kind: ${model.kind}`,
    `Risk tier: ${model.risk_tier}`,
    `Jurisdiction: ${model.jurisdiction ?? 'Not specified'}`,
    `EU AI Act classification: ${model.eu_ai_act_class ?? 'Not classified'}`,
    `ISO 42001 status: ${model.iso_42001_status}`,
    model.training_data_summary ? `Training data: ${model.training_data_summary}` : '',
    '',
    'Write a 3-paragraph risk assessment covering: (1) overall risk profile and key concerns, (2) the highest-priority risks (bias, hallucination, privacy), and (3) recommended immediate actions for compliance.'
  ].filter(Boolean).join('\n');

  const t0 = Date.now();
  const narrative = await callLlm(systemPrompt, userPrompt, provider, { maxTokens: 400 });
  const latencyMs = Date.now() - t0;

  // Store the narrative in iso_42001_status as a note if LLM produced content
  // (full assessment storage would require a dedicated table — use prompts_audit)
  if (narrative) {
    pool.query(
      `INSERT INTO ai_gov.prompts_audit
         (tenant_id, model_id, prompt_redacted, response_redacted, tokens_in, tokens_out, cost_cents)
       VALUES ($1, $2::uuid, $3, $4, $5, $6, 0)`,
      [
        locals.user.tenantId, params.id,
        userPrompt.slice(0, 500),
        narrative.slice(0, 2000),
        Math.ceil(userPrompt.length / 4),
        Math.ceil((narrative?.length ?? 0) / 4)
      ]
    ).catch(() => {});
  }

  // Attribute to an AI Governance agent if one exists
  const { rows: agents } = await pool.query<{ id: string; name: string; cost_per_run_cents: number; fte_equivalent: number }>(
    `SELECT id, name, cost_per_run_cents, fte_equivalent FROM agent.agents
     WHERE (name ILIKE '%ai gov%' OR name ILIKE '%governance%' OR name ILIKE '%compliance%')
       AND enabled = true
     ORDER BY created_at DESC LIMIT 1`
  );
  if (agents.length > 0) {
    const ag = agents[0];
    pool.query(
      `INSERT INTO agent.runs
         (tenant_id, agent_id, trigger, status, input_summary, output_summary, latency_ms, cost_cents, ended_at)
       VALUES ($1, $2, 'manual', 'success', $3, $4, $5, $6, now())`,
      [
        locals.user.tenantId, ag.id,
        `AI risk assessment: ${model.name}`,
        narrative ? narrative.slice(0, 500) : `Risk assessment completed for ${model.name} (${model.risk_tier} tier)`,
        latencyMs, ag.cost_per_run_cents
      ]
    ).catch(() => {});
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
      inputSummary: `AI risk assessment: ${model.name}`,
      outputSummary: narrative ? narrative.slice(0, 200) : `Assessment completed — ${RISK_TYPES.length} risk dimensions evaluated`,
      latencyMs,
      costCents: ag.cost_per_run_cents
    });
  }

  writeAuditLog({
    userId: locals.user.id,
    actorEmail: locals.user.email,
    tenantId: locals.user.tenantId,
    action: 'ai_gov.risk_assessment.completed',
    target: `model:${params.id}`,
    result: 'success',
    metadata: { modelName: model.name, riskTier: model.risk_tier, llmUsed: !!narrative }
  });

  return json({ ok: true, narrative: narrative ?? null });
};
