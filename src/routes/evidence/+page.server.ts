// =====================================================================
//  /evidence — Evidence Vault. Tenant-scoped; we fall back to the
//  Maybank hero tenant in MSSP rollup mode so the page shows real
//  content and the chain-integrity banner stays meaningful.
// =====================================================================

import type { PageServerLoad } from './$types';
import { getEvidence, getEvidenceStats } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;
  const [items, stats] = await Promise.all([
    getEvidence(effective, 500),
    getEvidenceStats(effective)
  ]);
  return { items, stats, isAll: tenantId === ALL_TENANTS_ID };
};
