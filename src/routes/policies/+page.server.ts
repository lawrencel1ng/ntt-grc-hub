// =====================================================================
//  /policies — Policy Management. Tenant-scoped; we resolve the latest
//  version per policy so the cards can show drafted-by-agent badges.
// =====================================================================

import type { PageServerLoad } from './$types';
import { getPolicies, getPolicyVersions } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';
import type { PolicyVersion } from '$lib/data/types';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? 't_maybank' : tenantId;
  const policies = await getPolicies(effective);
  const versionPairs = await Promise.all(policies.map((p) => getPolicyVersions(p.id).then((v) => ({ id: p.id, v }))));
  const currentByPolicy: Record<string, PolicyVersion | undefined> = {};
  for (const { id, v } of versionPairs) {
    const current = v.find((x) => x.status === 'approved') ?? v[v.length - 1];
    currentByPolicy[id] = current;
  }
  return { policies, currentByPolicy, isAll: tenantId === ALL_TENANTS_ID };
};
