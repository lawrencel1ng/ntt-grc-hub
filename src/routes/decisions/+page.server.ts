// =====================================================================
//  /decisions — Global agent-decisions feed. We pull a generous 500-row
//  window so the front-end can offer paging + outcome filtering without
//  more server round trips.
// =====================================================================

import type { PageServerLoad } from './$types';
import { getAgents, getAgentDecisions } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const scoped = tenantId === ALL_TENANTS_ID ? undefined : tenantId;

  const [agents, decisions] = await Promise.all([
    getAgents(),
    getAgentDecisions({ tenantId: scoped, limit: 500 })
  ]);

  return { agents, decisions };
};
