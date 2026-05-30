// =====================================================================
//  Risk Cockpit — home page loader. Fans out to ~15 dispatcher functions
//  in parallel and scopes every query to the active tenant. When the
//  tenant id resolves to the MSSP-rollup sentinel (`__all__`) we pass
//  `undefined` to dispatcher functions that support a multi-tenant view.
// =====================================================================

import type { PageServerLoad } from './$types';
import {
  getTenantSummaries,
  getCurrentTenant,
  getAgents,
  getAgentFleetSummary,
  getRecentAgentRuns,
  getRecentDecisions,
  getHeatmapCells,
  getTopRisks,
  getFrameworkScores,
  getKpiSnapshot,
  getCostLedger30d,
  getBoardNarrative,
  getRegChanges,
  getRecentTestRuns,
  getEvidenceStats
} from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const isAll = tenantId === ALL_TENANTS_ID;
  const scoped = isAll ? undefined : tenantId;
  const narrativeTenant = scoped;

  const [
    tenants,
    currentTenant,
    kpis,
    heatmap,
    topRisks,
    frameworks,
    runs,
    decisions,
    agents,
    fleetSummary,
    cost30d,
    narrative,
    recentReg,
    recentTests,
    evidenceStats
  ] = await Promise.all([
    getTenantSummaries(),
    isAll ? Promise.resolve(null) : getCurrentTenant(tenantId),
    getKpiSnapshot(scoped),
    getHeatmapCells(scoped),
    getTopRisks(8, scoped),
    getFrameworkScores(scoped),
    getRecentAgentRuns(12, scoped),
    getRecentDecisions(8, scoped),
    getAgents(),
    getAgentFleetSummary(),
    getCostLedger30d(scoped),
    getBoardNarrative(narrativeTenant),
    getRegChanges(4),
    getRecentTestRuns(scoped, 5),
    getEvidenceStats(narrativeTenant)
  ]);

  return {
    tenants,
    currentTenant,
    isAll,
    tenantId,
    kpis,
    heatmap,
    topRisks,
    frameworks,
    runs,
    decisions,
    agents,
    fleetSummary,
    cost30d,
    narrative,
    recentReg,
    recentTests,
    evidenceStats
  };
};
