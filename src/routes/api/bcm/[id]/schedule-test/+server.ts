import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

export const POST: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) throw error(401, 'Not authenticated');
  if (!isPgMode()) throw error(400, 'Requires Postgres mode');

  const pool = getPool();

  const { rows } = await pool.query<{ id: string; name: string; tenant_id: string }>(
    `SELECT id, name, tenant_id FROM bcm.plans WHERE id = $1::uuid LIMIT 1`,
    [params.id]
  );
  if (!rows.length) throw error(404, 'BCM plan not found');
  if (rows[0].tenant_id !== locals.user.tenantId) throw error(403, 'Forbidden');

  const { rows: test } = await pool.query<{ id: string }>(
    `INSERT INTO bcm.tests (tenant_id, plan_id, kind, conducted_at, result, lessons_md)
     VALUES ($1, $2::uuid, 'tabletop', now() + interval '7 days', 'partial', 'Tabletop scheduled — result pending completion')
     RETURNING id::text`,
    [locals.user.tenantId, params.id]
  );

  writeAuditLog({
    userId: locals.user.id,
    actorEmail: locals.user.email,
    tenantId: locals.user.tenantId,
    action: 'bcm.test.scheduled',
    target: `plan:${params.id}`,
    result: 'success',
    metadata: { testId: test[0].id, planName: rows[0].name }
  });

  return json({ ok: true, testId: test[0].id });
};
