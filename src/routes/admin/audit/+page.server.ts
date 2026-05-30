// =====================================================================
//  /admin/audit — Tamper-evident platform audit log viewer.
// =====================================================================

import type { PageServerLoad } from './$types';
import { getAuditLog, getTenantSummaries } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;
  const [entries, tenants] = await Promise.all([
    getAuditLog(effective, 200),
    getTenantSummaries()
  ]);
  return { entries, tenants };
};
