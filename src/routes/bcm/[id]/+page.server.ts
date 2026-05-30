// =====================================================================
//  /bcm/[id] — BCM plan detail. 404 if not found.
// =====================================================================

import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
  getBCMPlan, getBCMDependencies, getBCMTests, getBCMEscalationContacts, getRisks
} from '$lib/server/data';

export const load: PageServerLoad = async ({ params }) => {
  const plan = await getBCMPlan(params.id);
  if (!plan) throw error(404, `BCM plan ${params.id} not found`);

  const [deps, tests, escalationContacts, risks] = await Promise.all([
    getBCMDependencies(plan.id),
    getBCMTests(plan.id),
    getBCMEscalationContacts(plan.id),
    getRisks(plan.tenantId)
  ]);

  const linkedRisks = risks.filter((r) =>
    r.businessService && r.businessService.toLowerCase().includes(plan.businessService.toLowerCase()));

  return { plan, deps, tests, escalationContacts, linkedRisks };
};
