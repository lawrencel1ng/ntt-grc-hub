import type { LayoutServerLoad } from './$types';
import { getTenantSummaries, getLiveAgentCount, getCurrentTenant } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';

export const load: LayoutServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const isAll = tenantId === ALL_TENANTS_ID;
  return {
    user: locals.user ?? null,
    tenants: await getTenantSummaries(),
    liveAgents: await getLiveAgentCount(),
    currentTenantId: tenantId,
    currentTenant: isAll ? null : await getCurrentTenant(tenantId)
  };
};
