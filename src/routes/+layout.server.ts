import type { LayoutServerLoad } from './$types';
import { getTenantSummaries, getLiveAgentCount } from '$lib/server/data';

export const load: LayoutServerLoad = async () => {
  return {
    tenants: await getTenantSummaries(),
    liveAgents: await getLiveAgentCount()
  };
};
