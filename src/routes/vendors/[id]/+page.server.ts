// =====================================================================
//  /vendors/[id] — Single vendor detail with tabs for contracts,
//  questionnaires, 4th parties, risk findings, and evidence.
// =====================================================================

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
  getVendor, getVendorContracts, getQuestionnaires, getFourthParties, getVendorIssues, getEvidence
} from '$lib/server/data';

export const load: PageServerLoad = async ({ params }) => {
  const vendor = await getVendor(params.id);
  if (!vendor) throw error(404, 'Vendor not found');

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
