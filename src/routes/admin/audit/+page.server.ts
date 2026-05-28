// =====================================================================
//  /admin/audit — Tamper-evident platform audit log viewer.
// =====================================================================

import type { PageServerLoad } from './$types';
import { getAuditLog, getTenantSummaries } from '$lib/server/data';

export const load: PageServerLoad = async () => {
  const [entries, tenants] = await Promise.all([
    getAuditLog(undefined, 200),
    getTenantSummaries()
  ]);
  return { entries, tenants };
};
