import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';
import { checkRateLimit } from '$lib/server/rateLimit';

const VALID_TEMPLATES = ['SIG', 'CAIQ', 'Custom'] as const;
type Template = (typeof VALID_TEMPLATES)[number];

export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) throw error(401, 'Not authenticated');
  if (!isPgMode()) throw error(400, 'Requires Postgres mode');
  if (!checkRateLimit('vendor.questionnaire', locals.user.id, 10, 5 * 60_000)) {
    throw error(429, 'Too many questionnaire requests — try again in a few minutes.');
  }

  const body = await request.json().catch(() => ({})) as { template?: string };
  const template: Template = (VALID_TEMPLATES as readonly string[]).includes(body.template ?? '')
    ? (body.template as Template)
    : 'SIG';

  const pool = getPool();

  // Verify the vendor exists and belongs to this tenant
  const { rows } = await pool.query<{ id: string; name: string; tenant_id: string }>(
    `SELECT id, name, tenant_id FROM vendor.vendors WHERE id = $1::uuid LIMIT 1`,
    [params.id]
  );
  if (!rows.length) throw error(404, 'Vendor not found');
  if (rows[0].tenant_id !== locals.user.tenantId) throw error(403, 'Forbidden');

  const { rows: q } = await pool.query<{ id: string }>(
    `INSERT INTO vendor.questionnaires (tenant_id, vendor_id, template, status)
     VALUES ($1, $2::uuid, $3, 'sent')
     RETURNING id::text`,
    [locals.user.tenantId, params.id, template]
  );

  writeAuditLog({
    userId: locals.user.id,
    actorEmail: locals.user.email,
    tenantId: locals.user.tenantId,
    action: 'vendor.questionnaire.sent',
    target: `vendor:${params.id}`,
    result: 'success',
    metadata: { template, questionnaireId: q[0].id }
  });

  return json({ ok: true, questionnaireId: q[0].id });
};
