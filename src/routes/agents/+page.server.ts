// =====================================================================
//  /agents — Agent Fleet listing (hero / moat page). Loads the 10 universal
//  agents, the 30d fleet summary, plus the 30d decisions feed so we can
//  derive HITL approval / auto-approved / avg confidence KPIs without an
//  extra round trip.
// =====================================================================

import type { PageServerLoad } from './$types';
import {
  getAgents,
  getAgentFleetSummary,
  getRecentDecisions,
  getRecentAgentRuns
} from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;

  const [agents, fleetSummary, decisions, runs] = await Promise.all([
    getAgents(),
    getAgentFleetSummary(),
    getRecentDecisions(200, effective),
    getRecentAgentRuns(200, effective)
  ]);

  return { agents, fleetSummary, decisions, runs };
};
