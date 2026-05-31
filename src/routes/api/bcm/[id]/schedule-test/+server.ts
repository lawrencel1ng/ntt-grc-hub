import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';
import { checkRateLimit } from '$lib/server/rateLimit';

const VALID_TEST_KINDS = ['tabletop', 'walkthrough', 'simulation', 'full-failover'] as const;

export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) throw error(401, 'Not authenticated');
  if (!isPgMode()) throw error(400, 'Requires Postgres mode');
  if (!(await checkRateLimit('bcm.schedule-test', locals.user.id, 10, 5 * 60_000))) {
    throw error(429, 'Too many test schedules — try again in a few minutes.');
  }

  const body = await request.json().catch(() => ({})) as { kind?: string; scheduledAt?: string };
  const kind = VALID_TEST_KINDS.includes(body.kind as typeof VALID_TEST_KINDS[number])
    ? body.kind as typeof VALID_TEST_KINDS[number]
    : 'tabletop';

  // Validate scheduledAt: must be a future ISO date string if provided
  let conductedAt = 'now() + interval \'7 days\'';
  let conductedAtParam: string | null = null;
  if (body.scheduledAt) {
    const d = new Date(body.scheduledAt);
    if (!isNaN(d.getTime()) && d > new Date()) {
      conductedAtParam = d.toISOString();
    }
  }

  const pool = getPool();

  const { rows } = await pool.query<{ id: string; name: string; tenant_id: string }>(
    `SELECT id, name, tenant_id FROM bcm.plans WHERE id = $1::uuid LIMIT 1`,
    [params.id]
  );
  if (!rows.length) throw error(404, 'BCM plan not found');
  if (rows[0].tenant_id !== locals.user.tenantId) throw error(403, 'Forbidden');

  const { rows: test } = await pool.query<{ id: string }>(
    conductedAtParam
      ? `INSERT INTO bcm.tests (tenant_id, plan_id, kind, conducted_at, result, lessons_md)
         VALUES ($1, $2::uuid, $3, $4::timestamptz, 'partial', $5)
         RETURNING id::text`
      : `INSERT INTO bcm.tests (tenant_id, plan_id, kind, conducted_at, result, lessons_md)
         VALUES ($1, $2::uuid, $3, now() + interval '7 days', 'partial', $4)
         RETURNING id::text`,
    conductedAtParam
      ? [locals.user.tenantId, params.id, kind, conductedAtParam, `${kind} test scheduled — result pending completion`]
      : [locals.user.tenantId, params.id, kind, `${kind} test scheduled — result pending completion`]
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
