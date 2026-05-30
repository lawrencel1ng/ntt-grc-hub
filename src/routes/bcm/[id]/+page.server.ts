// =====================================================================
//  /bcm/[id] — BCM plan detail. 404 if not found.
// =====================================================================

import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
  getBCMPlan, getBCMDependencies, getBCMTests, getBCMEscalationContacts, getRisks
} from '$lib/server/data';

export const load: PageServerLoad = async ({ params, locals }) => {
  const plan = await getBCMPlan(params.id);
  if (!plan) throw error(404, `BCM plan ${params.id} not found`);
  if (locals.user && plan.tenantId !== locals.user.tenantId && locals.user.tenantId !== '__all__') {
    throw error(403, 'Access denied');
  }

  const [deps, tests, escalationContacts, linkedRisks] = await Promise.all([
    getBCMDependencies(plan.id),
    getBCMTests(plan.id),
    getBCMEscalationContacts(plan.id),
    getRisks(plan.tenantId, plan.businessService)
  ]);

  return { plan, deps, tests, escalationContacts, linkedRisks };
};
