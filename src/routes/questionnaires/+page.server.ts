// =====================================================================
//  /questionnaires — Vendor questionnaire index. Tenant-scoped; all-tenants
//  view queries across all tenants in pg mode.
// =====================================================================

import type { PageServerLoad } from './$types';
import { getQuestionnaires, getVendors } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;
  const [questionnaires, vendors] = await Promise.all([
    getQuestionnaires(effective),
    getVendors(effective)
  ]);
  return { questionnaires, vendors, isAll: tenantId === ALL_TENANTS_ID, effectiveTenantId: effective };
};
