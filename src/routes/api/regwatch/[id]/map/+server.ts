import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

const VALID_ACTIONS = ['mapped', 'superseded', 'new'] as const;

export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) throw error(401, 'Not authenticated');
  if (!isPgMode()) throw error(400, 'Requires Postgres mode');

  const body = await request.json().catch(() => ({})) as {
    requirementId?: string;
    frameworkId?: string;
    action?: string;
  };
  const { requirementId, frameworkId, action = 'mapped' } = body;
  if (!frameworkId) throw error(400, 'frameworkId required');
  if (!VALID_ACTIONS.includes(action as typeof VALID_ACTIONS[number])) throw error(400, 'Invalid action');

  const pool = getPool();

  // Verify the change exists
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM regwatch.changes WHERE id = $1::uuid LIMIT 1`,
    [params.id]
  );
  if (!rows.length) throw error(404, 'Regulatory change not found');

  await pool.query(
    `INSERT INTO regwatch.mappings (change_id, framework_id, requirement_id, action)
     VALUES ($1::uuid, $2, $3, $4)
     ON CONFLICT DO NOTHING`,
    [params.id, frameworkId, requirementId ?? null, action]
  );

  writeAuditLog({
    userId: locals.user.id,
    actorEmail: locals.user.email,
    tenantId: locals.user.tenantId,
    action: 'regwatch.mapping.created',
    target: `change:${params.id}`,
    result: 'success',
    metadata: { frameworkId, requirementId, action }
  });

  return json({ ok: true });
};
