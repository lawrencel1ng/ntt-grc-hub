// =====================================================================
//  /admin/tenants — Platform-admin view of all tenants. Pulls users +
//  connectors per tenant in parallel so the expand-row renders instantly.
// =====================================================================

import type { PageServerLoad } from './$types';
import {
  getTenantSummaries,
  getConnectors
} from '$lib/server/data';
import { getUsersAll } from '$lib/data/users';

export const load: PageServerLoad = async () => {
  const tenants = await getTenantSummaries();
  const usersAll = getUsersAll();

  const enriched = await Promise.all(tenants.map(async (t) => {
    const connectors = await getConnectors(t.id);
    const userCount = usersAll.filter((u) => u.tenantId === t.id).length;
    return {
      tenant: t,
      connectorCount: connectors.length,
      connectedCount: connectors.filter((c) => c.status === 'connected').length,
      userCount
    };
  }));

  return { rows: enriched };
};
