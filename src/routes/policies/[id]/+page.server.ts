// =====================================================================
//  /policies/[id] — Policy detail. Loads version history; the route uses
//  versions[].draftedByAgentId to drive agent attribution.
// =====================================================================

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getPolicy, getPolicyVersions, getFrameworks } from '$lib/server/data';

export const load: PageServerLoad = async ({ params }) => {
  const policy = await getPolicy(params.id);
  if (!policy) throw error(404, 'Policy not found');
  const [versions, frameworks] = await Promise.all([
    getPolicyVersions(policy.id),
    getFrameworks()
  ]);
  return { policy, versions, frameworks };
};
