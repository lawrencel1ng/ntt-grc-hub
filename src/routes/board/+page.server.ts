// =====================================================================
//  /board — Board Pack. A magazine-style read assembled by the
//  Board Narrator agent. Loads top risks, framework posture, vendor
//  concentrations, resilience snapshot and agent ROI in parallel.
//  MSSP rollup falls back to Maybank as the headline tenant.
// =====================================================================

import type { PageServerLoad } from './$types';
import {
  getCurrentTenant,
  getTopRisks,
  getFrameworkScores,
  getConcentrations,
  getVendors,
  getBCMPlans,
  getBCMDependencies,
  getBCMTests,
  getAgents,
  getAgentFleetSummary,
  getCostLedger30d,
  getBoardNarrative,
  getKpiSnapshot,
  getFairScenarios
} from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const isAll = tenantId === ALL_TENANTS_ID;
  const effective = isAll ? 't_maybank' : tenantId;

  const [
    tenant,
    topRisks,
    frameworks,
    concentrations,
    vendors,
    plans,
    agents,
    fleet,
    cost30d,
    narrative,
    kpis,
    scenarios
  ] = await Promise.all([
    getCurrentTenant(effective),
    getTopRisks(5, effective),
    getFrameworkScores(effective),
    getConcentrations(effective),
    getVendors(effective),
    getBCMPlans(effective),
    getAgents(),
    getAgentFleetSummary(),
    getCostLedger30d(effective),
    getBoardNarrative(effective),
    getKpiSnapshot(effective),
    getFairScenarios(effective)
  ]);

  // Pre-load top 5 IBS dependencies + tests so the Resilience panel renders
  // a tidy summary table without a follow-up request.
  const topPlans = plans.slice(0, 5);
  const planRows = await Promise.all(topPlans.map(async (p) => {
    const [deps, tests] = await Promise.all([getBCMDependencies(p.id), getBCMTests(p.id)]);
    return { plan: p, deps, tests };
  }));

  return {
    tenant,
    isAll,
    effectiveTenantId: effective,
    topRisks,
    frameworks,
    concentrations,
    vendors,
    planRows,
    plans,
    agents,
    fleet,
    cost30d,
    narrative,
    kpis,
    scenarios
  };
};
