// =====================================================================
//  /sox — SOX & Financial Controls. Tenant-scoped.
// =====================================================================

import type { PageServerLoad } from './$types';
import {
  getSOXItgcs, getSOXKcas, getSOXWalkthroughs, getSOXDeficiencies
} from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;

  const [itgcs, kcas, walkthroughs, deficiencies] = await Promise.all([
    getSOXItgcs(effective),
    getSOXKcas(effective),
    getSOXWalkthroughs(effective),
    getSOXDeficiencies(effective)
  ]);

  return {
    itgcs, kcas, walkthroughs, deficiencies,
    isAll: tenantId === ALL_TENANTS_ID,
    effectiveTenantId: effective
  };
};
