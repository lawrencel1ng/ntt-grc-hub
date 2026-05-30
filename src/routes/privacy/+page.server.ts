// =====================================================================
//  /privacy — GDPR · PDPA · PIPL · CCPA · HIPAA.
//  Tenant-scoped.
// =====================================================================

import type { PageServerLoad } from './$types';
import {
  getPrivacyActivities, getDPIAs, getSubjectRequests, getBreaches
} from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;

  const [activities, dpias, requests, breaches] = await Promise.all([
    getPrivacyActivities(effective),
    getDPIAs(effective),
    getSubjectRequests(effective),
    getBreaches(effective)
  ]);

  return {
    activities, dpias, requests, breaches,
    isAll: tenantId === ALL_TENANTS_ID,
    effectiveTenantId: effective
  };
};
