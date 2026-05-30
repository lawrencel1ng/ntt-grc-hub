// =====================================================================
//  /vendors — Vendor inventory (TPRM). Tenant-scoped; all-tenants view
//  queries across all tenants in pg mode.
// =====================================================================

import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getVendors, getQuestionnaires, getVendorContractsByTenant } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;
  const [vendors, questionnaires, contracts] = await Promise.all([
    getVendors(effective),
    getQuestionnaires(effective),
    getVendorContractsByTenant(effective)
  ]);
  return { vendors, questionnaires, contracts, isAll: tenantId === ALL_TENANTS_ID, effectiveTenantId: effective };
};

export const actions: Actions = {
  createVendor: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { error: 'Not authenticated.' });
    if (!isPgMode()) return fail(400, { error: 'Requires Postgres mode.' });

    const data = await request.formData();
    const name = String(data.get('name') ?? '').trim();
    const category = String(data.get('category') ?? '').trim() || null;
    const tier = String(data.get('tier') ?? 'tier4').trim();
    const criticality = String(data.get('criticality') ?? 'low').trim();
    const hqCountry = String(data.get('hqCountry') ?? '').trim() || null;
    const primaryContactEmail = String(data.get('primaryContactEmail') ?? '').trim() || null;

    if (!name) return fail(400, { error: 'Vendor name is required.' });

    const VALID_TIERS = ['tier1', 'tier2', 'tier3', 'tier4'];
    const VALID_CRITS = ['critical', 'high', 'medium', 'low'];

    // Map tier4 → '4' etc. to match the DB enum values
    const tierValue = tier.startsWith('tier') ? tier.replace('tier', '') : tier;
    if (!['1', '2', '3', '4'].includes(tierValue)) return fail(400, { error: 'Invalid tier.' });
    if (!VALID_CRITS.includes(criticality)) return fail(400, { error: 'Invalid criticality.' });

    void VALID_TIERS; // used above implicitly via tierValue mapping

    const pool = getPool();
    await pool.query(
      `INSERT INTO vendor.vendors (tenant_id, name, category, tier, criticality, hq_country, primary_contact_email)
       VALUES ($1, $2, $3, $4::vendor.tier, $5::vendor.criticality, $6, $7)`,
      [locals.user.tenantId, name, category, tierValue, criticality, hqCountry, primaryContactEmail]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'vendor.created',
      target: `vendor:${name}`,
      result: 'success'
    });

    return { created: true };
  }
};
