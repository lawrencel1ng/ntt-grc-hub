// =====================================================================
//  /resilience — Operational Resilience (DORA · APRA CPS 230 · MAS 658).
//  Uses BCM plans as a proxy for "Important Business Services" with
//  dependency + test data wired in. Tenant-scoped.
// =====================================================================

import type { PageServerLoad } from './$types';
import {
  getBCMPlans, getBCMDepsAndTestsByTenant, getIssues
} from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;

  const [plans, { deps: depsMap, tests: testsMap }, issues] = await Promise.all([
    getBCMPlans(effective),
    getBCMDepsAndTestsByTenant(effective),
    getIssues(effective)
  ]);

  const enriched = plans.map((p) => ({
    plan: p,
    deps: depsMap[p.id] ?? [],
    tests: testsMap[p.id] ?? []
  }));

  return {
    rows: enriched,
    issues,
    isAll: tenantId === ALL_TENANTS_ID,
    effectiveTenantId: effective
  };
};
