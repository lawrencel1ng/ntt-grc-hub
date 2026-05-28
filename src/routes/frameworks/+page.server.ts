// =====================================================================
//  /frameworks — Frameworks Library index. The catalog is platform-global
//  (35+ frameworks) so we don't scope by tenant; scores, however, are
//  rolled up across hero tenants when the user picks "All tenants".
// =====================================================================

import type { PageServerLoad } from './$types';
import { getFrameworks, getFrameworkScores } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const scopedTenantId = tenantId === ALL_TENANTS_ID ? undefined : tenantId;
  const [frameworks, scores] = await Promise.all([
    getFrameworks(),
    getFrameworkScores(scopedTenantId)
  ]);
  return { frameworks, scores, isAll: tenantId === ALL_TENANTS_ID };
};
