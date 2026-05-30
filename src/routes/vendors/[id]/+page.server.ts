// =====================================================================
//  /vendors/[id] — Single vendor detail with tabs for contracts,
//  questionnaires, 4th parties, risk findings, and evidence.
// =====================================================================

import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import {
  getVendor, getVendorContracts, getQuestionnaires, getFourthParties, getVendorIssues, getEvidence
} from '$lib/server/data';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

export const load: PageServerLoad = async ({ params, locals }) => {
  const vendor = await getVendor(params.id);
  if (!vendor) throw error(404, 'Vendor not found');
  if (locals.user && vendor.tenantId !== locals.user.tenantId && locals.user.tenantId !== '__all__') {
    throw error(403, 'Access denied');
  }

  const [contracts, questionnaires, fourthParties, vendorIssues, allEvidence] = await Promise.all([
    getVendorContracts(vendor.id),
    getQuestionnaires(vendor.tenantId, vendor.id),
    getFourthParties(vendor.tenantId, vendor.id),
    getVendorIssues(vendor.id),
    getEvidence(vendor.tenantId, 200)
  ]);

  const riskFindings = vendorIssues.slice(0, 4);

  // Vendor-specific evidence: SOC 2, attestations, scan results.
  const vendorEvidence = allEvidence
    .filter((e) => e.kind === 'attestation' || e.kind === 'document' || e.kind === 'scan-result')
    .slice(0, 6);

  return { vendor, contracts, questionnaires, fourthParties, riskFindings, vendorEvidence };
};

const VALID_VENDOR_STATUSES = ['active', 'onboarding', 'offboarded'] as const;
const VALID_TIERS = ['1', '2', '3', '4'] as const;
const VALID_CRITICALITIES = ['critical', 'high', 'medium', 'low'] as const;

export const actions: Actions = {
  updateVendor: async ({ params, request, locals }) => {
    if (!locals.user) return fail(401, { editError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { editError: 'Requires Postgres mode' });

    const fd = await request.formData();
    const name = String(fd.get('name') ?? '').trim();
    const category = String(fd.get('category') ?? '').trim();
    const tier = String(fd.get('tier') ?? '').trim();
    const criticality = String(fd.get('criticality') ?? '').trim();
    const hqCountry = String(fd.get('hqCountry') ?? '').trim();
    const primaryContactEmail = String(fd.get('primaryContactEmail') ?? '').trim();

    if (!name) return fail(400, { editError: 'Name is required.' });
    if (name.length > 256) return fail(400, { editError: 'Name must be 256 characters or fewer.' });
    if (category.length > 128) return fail(400, { editError: 'Category must be 128 characters or fewer.' });
    if (!VALID_TIERS.includes(tier as typeof VALID_TIERS[number])) return fail(400, { editError: 'Invalid tier.' });
    if (!VALID_CRITICALITIES.includes(criticality as typeof VALID_CRITICALITIES[number])) return fail(400, { editError: 'Invalid criticality.' });
    if (hqCountry.length > 128) return fail(400, { editError: 'Country must be 128 characters or fewer.' });
    if (primaryContactEmail && primaryContactEmail.length > 254) return fail(400, { editError: 'Email must be 254 characters or fewer.' });

    const pool = getPool();
    const { rowCount } = await pool.query(
      `UPDATE vendor.vendors
       SET name = $1, category = $2, tier = $3::vendor.tier,
           criticality = $4::vendor.criticality, hq_country = $5,
           primary_contact_email = COALESCE(NULLIF($6, ''), primary_contact_email)
       WHERE id = $7::uuid AND tenant_id = $8`,
      [name, category, tier, criticality, hqCountry, primaryContactEmail || null, params.id, locals.user.tenantId]
    );
    if (!rowCount) return fail(404, { editError: 'Vendor not found or access denied.' });

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'vendor.updated',
      target: `vendor:${params.id}`,
      result: 'success',
      metadata: { name, tier, criticality }
    });

    return { editSuccess: true };
  },

  updateStatus: async ({ params, request, locals }) => {
    if (!locals.user) return fail(401, { statusError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { statusError: 'Requires Postgres mode' });

    const data = await request.formData();
    const newStatus = String(data.get('status') ?? '').trim();
    if (!VALID_VENDOR_STATUSES.includes(newStatus as typeof VALID_VENDOR_STATUSES[number])) {
      return fail(400, { statusError: 'Invalid status' });
    }

    const pool = getPool();
    const { rowCount } = await pool.query(
      `UPDATE vendor.vendors SET status = $1::vendor.status
       WHERE id = $2::uuid AND tenant_id = $3`,
      [newStatus, params.id, locals.user.tenantId]
    );
    if (!rowCount) return fail(404, { statusError: 'Vendor not found or access denied' });

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'vendor.status.updated',
      target: `vendor:${params.id}`,
      result: 'success',
      metadata: { newStatus }
    });

    return { statusUpdated: true, newStatus };
  }
};
