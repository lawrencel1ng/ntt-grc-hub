import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';
import { checkRateLimit } from '$lib/server/rateLimit';

export const POST: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) throw error(401, 'Not authenticated');
  if (!isPgMode()) throw error(400, 'Requires Postgres mode');
  if (!(await checkRateLimit('workflow.run', locals.user.id, 20, 5 * 60_000))) {
    throw error(429, 'Too many workflow runs — try again in a few minutes.');
  }

  const pool = getPool();

  // Verify the workflow exists and belongs to this tenant
  const { rows } = await pool.query<{ id: string; name: string; tenant_id: string; enabled: boolean }>(
    `SELECT id, name, tenant_id, enabled FROM workflow.definitions WHERE id = $1::uuid LIMIT 1`,
    [params.id]
  );
  if (!rows.length) throw error(404, 'Workflow not found');
  const wf = rows[0];
  if (wf.tenant_id !== locals.user.tenantId) throw error(403, 'Forbidden');
  if (!wf.enabled) throw error(400, 'Workflow is disabled');

  const { rows: exec } = await pool.query<{ id: string }>(
    `INSERT INTO workflow.executions (tenant_id, workflow_id, trigger, status)
     VALUES ($1, $2::uuid, 'manual', 'running')
     RETURNING id::text`,
    [locals.user.tenantId, params.id]
  );

  writeAuditLog({
    userId: locals.user.id,
    actorEmail: locals.user.email,
    tenantId: locals.user.tenantId,
    action: 'workflow.execution.started',
    target: `workflow:${params.id}`,
    result: 'success',
    metadata: { executionId: exec[0].id, trigger: 'manual' }
  });

  return json({ ok: true, executionId: exec[0].id });
};
