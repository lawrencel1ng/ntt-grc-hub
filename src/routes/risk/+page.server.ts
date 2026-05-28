// =====================================================================
//  /risk — Enterprise Risk Register. Tenant-scoped; when "All tenants"
//  is selected we fall back to the Maybank register so the demo stays
//  populated (and the hero cross-border risk is reachable).
// =====================================================================

import type { PageServerLoad } from './$types';
import { getRisks, getIssues } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? 't_maybank' : tenantId;
  const [risks, issues] = await Promise.all([
    getRisks(effective),
    getIssues(effective)
  ]);
  return { risks, issues, isAll: tenantId === ALL_TENANTS_ID, effectiveTenantId: effective };
};
