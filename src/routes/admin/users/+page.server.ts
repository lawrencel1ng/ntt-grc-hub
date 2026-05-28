// =====================================================================
//  /admin/users — Users + RBAC matrix.
// =====================================================================

import type { PageServerLoad } from './$types';
import { getTenantSummaries } from '$lib/server/data';
import { getUsersAll, RBAC_MATRIX, CAPABILITIES } from '$lib/data/users';

export const load: PageServerLoad = async () => {
  const [tenants] = await Promise.all([getTenantSummaries()]);
  const users = getUsersAll();
  return {
    tenants,
    users,
    rbac: RBAC_MATRIX,
    capabilities: CAPABILITIES as readonly string[]
  };
};
