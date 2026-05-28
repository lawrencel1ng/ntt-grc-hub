// =====================================================================
//  /agents/[id] — Agent detail page. Loads the agent, its tools, a generous
//  window of runs and decisions, and the 30d cost ledger so we can compute
//  P95 latency / FTE hours / HITL approval rate locally without bouncing
//  the dispatcher per-KPI.
// =====================================================================

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
  getAgent,
  getAgentTools,
  getAgentRunsForAgent,
  getAgentDecisions,
  getCostLedger30d
} from '$lib/server/data';

export const load: PageServerLoad = async ({ params }) => {
  const agent = await getAgent(params.id);
  if (!agent) throw error(404, 'Agent not found');

  const [tools, runs, decisions, ledger] = await Promise.all([
    getAgentTools(agent.id),
    getAgentRunsForAgent(agent.id, 200),
    getAgentDecisions({ agentId: agent.id, limit: 200 }),
    getCostLedger30d()
  ]);

  // Aggregate this agent's slice of the 30d cost ledger.
  const ourSlice = ledger.filter((e) => e.agentId === agent.id);
  const runs30d = ourSlice.reduce((s, e) => s + e.runs, 0);
  const costCents30d = ourSlice.reduce((s, e) => s + e.costCents, 0);
  const fteHours30d = +ourSlice.reduce((s, e) => s + e.fteSavedHours, 0).toFixed(1);

  return { agent, tools, runs, decisions, runs30d, costCents30d, fteHours30d };
};
