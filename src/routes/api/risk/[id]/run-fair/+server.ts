import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

export const POST: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) throw error(401, 'Not authenticated');
  if (!isPgMode()) throw error(400, 'Requires Postgres mode');

  const pool = getPool();

  // Verify the risk exists and belongs to this tenant
  const { rows } = await pool.query<{ id: string; code: string; tenant_id: string }>(
    `SELECT id, code, tenant_id FROM risk.risks WHERE id = $1::uuid LIMIT 1`,
    [params.id]
  );
  if (!rows.length) throw error(404, 'Risk not found');
  if (rows[0].tenant_id !== locals.user.tenantId) throw error(403, 'Forbidden');

  // Queue the Risk Quantifier agent if available
  const { rows: agents } = await pool.query<{ id: string; enabled: boolean }>(
    `SELECT id, enabled FROM agent.agents
     WHERE (name ILIKE '%risk quantifier%' OR name ILIKE '%fair%' OR name ILIKE '%quantif%')
       AND tenant_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [locals.user.tenantId]
  );

  let runId: string | null = null;
  if (agents.length > 0 && agents[0].enabled) {
    const { rows: run } = await pool.query<{ id: string }>(
      `INSERT INTO agent.runs (tenant_id, agent_id, trigger, status, input_summary)
       VALUES ($1, $2, 'manual', 'queued', 'FAIR analysis triggered for risk ${rows[0].code}')
       RETURNING id::text`,
      [locals.user.tenantId, agents[0].id]
    );
    runId = run[0].id;
  }

  writeAuditLog({
    userId: locals.user.id,
    actorEmail: locals.user.email,
    tenantId: locals.user.tenantId,
    action: 'fair.analysis.queued',
    target: `risk:${params.id}`,
    result: 'success',
    metadata: { riskCode: rows[0].code, runId }
  });

  return json({ ok: true, runId });
};
