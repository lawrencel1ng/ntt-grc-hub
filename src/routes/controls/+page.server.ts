// =====================================================================
//  /controls — Controls Library index. Tenant-scoped; when "All tenants"
//  is active we display the Maybank hero catalog so the page is full.
// =====================================================================

import type { PageServerLoad } from './$types';
import { getControls, getRecentTestRuns, getFrameworks } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;
  const [controls, runs, frameworks] = await Promise.all([
    getControls(effective),
    getRecentTestRuns(effective, 200),
    getFrameworks()
  ]);
  return { controls, runs, frameworks, isAll: tenantId === ALL_TENANTS_ID };
};
