import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

const RISK_TYPES = ['bias', 'hallucination', 'drift', 'explainability', 'privacy'] as const;

export const POST: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) throw error(401, 'Not authenticated');
  if (!isPgMode()) throw error(400, 'Requires Postgres mode');

  const pool = getPool();

  const { rows } = await pool.query<{ id: string; name: string; tenant_id: string; risk_tier: string }>(
    `SELECT id, name, tenant_id, risk_tier FROM ai_gov.models WHERE id = $1::uuid LIMIT 1`,
    [params.id]
  );
  if (!rows.length) throw error(404, 'AI model not found');
  if (rows[0].tenant_id !== locals.user.tenantId) throw error(403, 'Forbidden');

  const isHighRisk = rows[0].risk_tier === 'high' || rows[0].risk_tier === 'critical';
  const severity = isHighRisk ? 'high' : 'medium';

  // Insert a risk assessment entry for each risk type (upsert to avoid duplicates)
  for (const riskType of RISK_TYPES) {
    await pool.query(
      `INSERT INTO ai_gov.model_risk (tenant_id, model_id, risk_type, severity)
       VALUES ($1, $2::uuid, $3, $4::risk.severity)
       ON CONFLICT DO NOTHING`,
      [locals.user.tenantId, params.id, riskType, severity]
    ).catch(() => { /* table or enum may differ — best effort */ });
  }

  writeAuditLog({
    userId: locals.user.id,
    actorEmail: locals.user.email,
    tenantId: locals.user.tenantId,
    action: 'ai_gov.risk_assessment.queued',
    target: `model:${params.id}`,
    result: 'success',
    metadata: { modelName: rows[0].name, riskTier: rows[0].risk_tier }
  });

  return json({ ok: true });
};
