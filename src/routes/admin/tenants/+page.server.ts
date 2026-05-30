// =====================================================================
//  /admin/tenants — Platform-admin view of all tenants. Pulls users +
//  connectors per tenant in parallel so the expand-row renders instantly.
// =====================================================================

import type { PageServerLoad } from './$types';
import {
  getTenantSummaries,
  getConnectors,
  getUsers
} from '$lib/server/data';

export const load: PageServerLoad = async () => {
  const [tenants, usersAll] = await Promise.all([getTenantSummaries(), getUsers()]);

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
