import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

export const POST: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) throw error(401, 'Not authenticated');
  if (!isPgMode()) throw error(400, 'Requires Postgres mode');

  const pool = getPool();

  const { rows } = await pool.query<{ id: string; name: string }>(
    `SELECT id, name FROM compliance.frameworks WHERE id = $1 LIMIT 1`,
    [params.id]
  );
  if (!rows.length) throw error(404, 'Framework not found');

  writeAuditLog({
    userId: locals.user.id,
    actorEmail: locals.user.email,
    tenantId: locals.user.tenantId,
    action: 'framework.audit_pack.requested',
    target: `framework:${params.id}`,
    result: 'success',
    metadata: { frameworkName: rows[0].name }
  });

  return json({ ok: true });
};
