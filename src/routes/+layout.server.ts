import type { LayoutServerLoad } from './$types';
import { getTenantSummaries, getLiveAgentCount, getCurrentTenant, getNavBadgeCounts } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';

export const load: LayoutServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const isAll = tenantId === ALL_TENANTS_ID;
  const [tenants, liveAgents, currentTenant, navBadges] = await Promise.all([
    getTenantSummaries(),
    getLiveAgentCount(),
    isAll ? Promise.resolve(null) : getCurrentTenant(tenantId),
    getNavBadgeCounts()
  ]);
  return {
    user: locals.user ?? null,
    tenants,
    liveAgents,
    currentTenantId: tenantId,
    currentTenant,
    navBadges
  };
};
