import type { PageServerLoad } from './$types';
import {
  getCurrentTenant,
  getTopRisks,
  getFrameworkScores,
  getConcentrations,
  getVendors,
  getBCMPlans,
  getBCMDepsAndTestsByTenant,
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
  const effective = isAll ? undefined : tenantId;

  const [
    tenant,
    topRisks,
    frameworks,
    concentrations,
    vendors,
    plans,
    { deps: depsMap, tests: testsMap },
    agents,
    fleet,
    cost30d,
    narrative,
    kpis,
    scenarios
  ] = await Promise.all([
    effective ? getCurrentTenant(effective) : Promise.resolve(null),
    getTopRisks(5, effective),
    getFrameworkScores(effective),
    getConcentrations(effective),
    getVendors(effective),
    getBCMPlans(effective),
    getBCMDepsAndTestsByTenant(effective),
    getAgents(),
    getAgentFleetSummary(),
    getCostLedger30d(effective),
    getBoardNarrative(effective),
    getKpiSnapshot(effective),
    getFairScenarios(effective)
  ]);

  const topPlans = plans.slice(0, 5);
  const planRows = topPlans.map((p) => ({
    plan: p,
    deps: depsMap[p.id] ?? [],
    tests: testsMap[p.id] ?? []
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
    scenarios,
    generatedAt: new Date().toISOString()
  };
};
