// =====================================================================
//  /connectors — Connector inventory page. We always render against a
//  hero tenant so the page shows the full 40+ catalog; the dispatcher
//  returns only the connectors enabled for the active tenant when scoped.
// =====================================================================

import type { PageServerLoad } from './$types';
import { getConnectors } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;
  const connectors = await getConnectors(effective);
  return { connectors, isAll: tenantId === ALL_TENANTS_ID };
};
