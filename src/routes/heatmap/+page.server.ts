// =====================================================================
//  /heatmap — Risk Heatmap & FAIR Quantification. Loads heatmap cells +
//  appetite + the catalogue of scenarios so the page can switch the LEC
//  curve via ?scenario=…. Defaults to the Maybank hero scenario so the
//  $4.2M ALE is visible on first paint regardless of tenant.
// =====================================================================

import type { PageServerLoad } from './$types';
import {
  getRisks, getHeatmapCells, getAppetiteStatements, getFairScenarios, getFairRun
} from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';

export const load: PageServerLoad = async ({ locals, url }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;

  const [risks, cells, appetite, scenarios] = await Promise.all([
    getRisks(effective),
    getHeatmapCells(tenantId === ALL_TENANTS_ID ? undefined : effective),
    getAppetiteStatements(effective),
    getFairScenarios(effective)
  ]);

  // Pick scenario: from ?scenario=…, else first scenario.
  const wantedId = url.searchParams.get('scenario');
  const selectedScenario =
    (wantedId && scenarios.find((s) => s.id === wantedId)) ||
    scenarios[0] ||
    null;

  // Resolve a FAIR run for the selected scenario via its risk id.
  let fair = null;
  if (selectedScenario?.riskId) {
    fair = await getFairRun(selectedScenario.riskId);
  }

  return {
    risks,
    cells,
    appetite,
    scenarios,
    selectedScenario,
    fair,
    isAll: tenantId === ALL_TENANTS_ID,
    effectiveTenantId: effective
  };
};
