// =====================================================================
//  /evidence — Evidence Vault. Tenant-scoped.
// =====================================================================

import type { PageServerLoad } from './$types';
import { getEvidence, getEvidenceStats, getEvidenceControlCounts } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;
  const [items, stats, controlCounts] = await Promise.all([
    getEvidence(effective, 500),
    getEvidenceStats(effective),
    getEvidenceControlCounts(effective)
  ]);
  return { items, stats, controlCounts, isAll: tenantId === ALL_TENANTS_ID };
};
