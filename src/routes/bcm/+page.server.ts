// =====================================================================
//  /bcm — Business Continuity Management (ISO 22301 · MAS Notice 657 · DORA).
// =====================================================================

import type { PageServerLoad } from './$types';
import {
  getBCMPlans, getBCMDependencies, getBCMTests
} from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;

  const plans = await getBCMPlans(effective);
  const enriched = await Promise.all(plans.map(async (p) => {
    const [deps, tests] = await Promise.all([
      getBCMDependencies(p.id),
      getBCMTests(p.id)
    ]);
    return { plan: p, deps, tests };
  }));

  return {
    rows: enriched,
    isAll: tenantId === ALL_TENANTS_ID,
    effectiveTenantId: effective
  };
};
