// =====================================================================
//  /stream — Full-page agent activity stream. The bulk of the page is
//  driven by SSE; the loader just seeds the initial buffer with the most
//  recent ~50 runs so the terminal isn't empty on first paint.
// =====================================================================

import type { PageServerLoad } from './$types';
import { getAgents, getRecentAgentRuns } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;

  const [agents, runs] = await Promise.all([
    getAgents(),
    getRecentAgentRuns(50, effective)
  ]);
  return { agents, runs };
};
