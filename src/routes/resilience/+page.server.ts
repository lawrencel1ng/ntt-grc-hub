// =====================================================================
//  /resilience — Operational Resilience (DORA · APRA CPS 230 · MAS 658).
//  Uses BCM plans as a proxy for "Important Business Services" with
//  dependency + test data wired in. Tenant-scoped.
// =====================================================================

import type { PageServerLoad } from './$types';
import {
  getBCMPlans, getBCMDependencies, getBCMTests, getIssues
} from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;

  const plans = await getBCMPlans(effective);

  // Pre-load dependencies + tests for each plan so the expand-row can
  // render without waiting for a follow-up request.
  const enriched = await Promise.all(plans.map(async (p) => {
    const [deps, tests] = await Promise.all([
      getBCMDependencies(p.id),
      getBCMTests(p.id)
    ]);
    return { plan: p, deps, tests };
  }));

  const issues = await getIssues(effective);

  return {
    rows: enriched,
    issues,
    isAll: tenantId === ALL_TENANTS_ID,
    effectiveTenantId: effective
  };
};
