// =====================================================================
//  /esg — Sustainability disclosures (CSRD · ISSB · GHG · TCFD).
// =====================================================================

import type { PageServerLoad } from './$types';
import {
  getESGMetrics, getESGDisclosures, getESGTargets
} from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;

  const [metrics, disclosures, targets] = await Promise.all([
    getESGMetrics(effective),
    getESGDisclosures(effective),
    getESGTargets(effective)
  ]);

  return {
    metrics, disclosures, targets,
    isAll: tenantId === ALL_TENANTS_ID,
    effectiveTenantId: effective
  };
};
