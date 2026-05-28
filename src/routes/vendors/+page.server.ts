// =====================================================================
//  /vendors — Vendor inventory (TPRM). Tenant-scoped; when "All tenants"
//  is selected we fall back to Maybank so the demo stays populated.
// =====================================================================

import type { PageServerLoad } from './$types';
import { getVendors, getQuestionnaires } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? 't_maybank' : tenantId;
  const [vendors, questionnaires] = await Promise.all([
    getVendors(effective),
    getQuestionnaires(effective)
  ]);
  return { vendors, questionnaires, isAll: tenantId === ALL_TENANTS_ID, effectiveTenantId: effective };
};
