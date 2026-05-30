// =====================================================================
//  /questionnaires — Vendor questionnaire index. Tenant-scoped; all-tenants
//  view queries across all tenants in pg mode.
// =====================================================================

import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getQuestionnaires, getVendors } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

const VALID_TEMPLATES = ['SIG', 'CAIQ', 'Custom'] as const;

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;
  const [questionnaires, vendors] = await Promise.all([
    getQuestionnaires(effective),
    getVendors(effective)
  ]);
  return { questionnaires, vendors, isAll: tenantId === ALL_TENANTS_ID, effectiveTenantId: effective };
};

export const actions: Actions = {
  sendQuestionnaire: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { qError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { qError: 'Requires Postgres mode' });

    const data = await request.formData();
    const vendorId = String(data.get('vendorId') ?? '').trim();
    const template = String(data.get('template') ?? 'SIG').trim();

    if (!vendorId) return fail(400, { qError: 'Vendor is required.' });
    if (!VALID_TEMPLATES.includes(template as typeof VALID_TEMPLATES[number])) {
      return fail(400, { qError: 'Template must be SIG, CAIQ, or Custom.' });
    }

    const pool = getPool();

    const { rows: vendor } = await pool.query<{ id: string; name: string; tenant_id: string }>(
      `SELECT id, name, tenant_id FROM vendor.vendors WHERE id = $1::uuid LIMIT 1`,
      [vendorId]
    );
    if (!vendor.length) return fail(404, { qError: 'Vendor not found.' });
    if (vendor[0].tenant_id !== locals.user.tenantId) return fail(403, { qError: 'Vendor not in your tenant.' });

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO vendor.questionnaires (tenant_id, vendor_id, template, status)
       VALUES ($1, $2::uuid, $3, 'sent')
       RETURNING id::text`,
      [locals.user.tenantId, vendorId, template]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'vendor.questionnaire.sent',
      target: `vendor:${vendorId}`,
      result: 'success',
      metadata: { template, questionnaireId: rows[0].id, vendorName: vendor[0].name }
    });

    return { qSent: true, questionnaireId: rows[0].id, vendorName: vendor[0].name };
  }
};
