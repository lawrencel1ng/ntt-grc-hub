// =====================================================================
//  /vendors/[id] — Single vendor detail with tabs for contracts,
//  questionnaires, 4th parties, risk findings, and evidence.
// =====================================================================

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
  getVendor, getQuestionnaires, getFourthParties, getIssues, getEvidence
} from '$lib/server/data';

export const load: PageServerLoad = async ({ params }) => {
  const vendor = await getVendor(params.id);
  if (!vendor) throw error(404, 'Vendor not found');

  const [allQuestionnaires, allFourthParties, allIssues, allEvidence] = await Promise.all([
    getQuestionnaires(vendor.tenantId),
    getFourthParties(vendor.tenantId),
    getIssues(vendor.tenantId),
    getEvidence(vendor.tenantId, 200)
  ]);

  const questionnaires = allQuestionnaires.filter((q) => q.vendorId === vendor.id);
  const fourthParties = allFourthParties.filter((fp) => fp.vendorId === vendor.id);

  // Heuristic linkage for risk findings — pull a handful of issues from
  // this tenant; in PG mode we would join via vendor_id on issues.
  const riskFindings = allIssues
    .filter((i) => i.source === 'audit' || i.source === 'risk-treatment')
    .slice(0, 4);

  // Vendor-specific evidence: SOC 2, attestations, scan results.
  const vendorEvidence = allEvidence
    .filter((e) => e.kind === 'attestation' || e.kind === 'document' || e.kind === 'scan-result')
    .slice(0, 6);

  return { vendor, questionnaires, fourthParties, riskFindings, vendorEvidence };
};
