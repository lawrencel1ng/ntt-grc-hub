// =====================================================================
//  /issues — Issues & Incidents list. Tenant-scoped; MSSP rollup falls
//  back to Maybank's register so the demo stays populated.
// =====================================================================

import type { PageServerLoad } from './$types';
import { getIssues } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? 't_maybank' : tenantId;
  const issues = await getIssues(effective);
  return { issues, isAll: tenantId === ALL_TENANTS_ID, effectiveTenantId: effective };
};
