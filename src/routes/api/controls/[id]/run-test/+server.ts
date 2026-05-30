import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';
import { checkRateLimit } from '$lib/server/rateLimit';

export const POST: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) throw error(401, 'Not authenticated');
  if (!isPgMode()) throw error(400, 'Requires Postgres mode');
  if (!checkRateLimit('control.test', locals.user.id, 10, 5 * 60_000)) {
    throw error(429, 'Too many test runs — try again in a few minutes.');
  }

  const pool = getPool();

  // Verify the control exists and belongs to this tenant
  const { rows } = await pool.query<{ id: string; tenant_id: string; code: string }>(
    `SELECT id, tenant_id, code FROM control.library WHERE id = $1 LIMIT 1`,
    [params.id]
  );
  if (!rows.length) throw error(404, 'Control not found');
  if (rows[0].tenant_id !== locals.user.tenantId) throw error(403, 'Forbidden');

  const { rows: run } = await pool.query<{ id: string }>(
    `INSERT INTO control.test_runs (tenant_id, control_id, result, notes)
     VALUES ($1, $2, 'partial', 'Manual test run initiated via GRC Hub — awaiting evaluation')
     RETURNING id::text`,
    [locals.user.tenantId, params.id]
  );

  writeAuditLog({
    userId: locals.user.id,
    actorEmail: locals.user.email,
    tenantId: locals.user.tenantId,
    action: 'control.test_run.created',
    target: `control:${params.id}`,
    result: 'success',
    metadata: { testRunId: run[0].id, controlCode: rows[0].code }
  });

  return json({ ok: true, testRunId: run[0].id });
};
