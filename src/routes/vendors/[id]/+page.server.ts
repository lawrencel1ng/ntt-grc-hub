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

  const [contracts, allQuestionnaires, allFourthParties, vendorIssues, allEvidence] = await Promise.all([
    getVendorContracts(vendor.id),
    getQuestionnaires(vendor.tenantId),
    getFourthParties(vendor.tenantId),
    getVendorIssues(vendor.id),
    getEvidence(vendor.tenantId, 200)
  ]);

  const questionnaires = allQuestionnaires.filter((q) => q.vendorId === vendor.id);
  const fourthParties = allFourthParties.filter((fp) => fp.vendorId === vendor.id);
  const riskFindings = vendorIssues.slice(0, 4);

  // Vendor-specific evidence: SOC 2, attestations, scan results.
  const vendorEvidence = allEvidence
    .filter((e) => e.kind === 'attestation' || e.kind === 'document' || e.kind === 'scan-result')
    .slice(0, 6);

  return { vendor, contracts, questionnaires, fourthParties, riskFindings, vendorEvidence };
};

const VALID_VENDOR_STATUSES = ['active', 'onboarding', 'offboarded'] as const;

export const actions: Actions = {
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
