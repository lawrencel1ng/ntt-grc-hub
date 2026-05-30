// =====================================================================
//  /controls/[id] — Control detail. Loads the control + 30 most recent
//  test runs, real framework mappings from control.mappings, tests,
//  exceptions, and linked evidence items.
// =====================================================================

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
  getControl, getControlTestRuns, getControlMappings, getControlTests,
  getControlExceptions, getFrameworks, getEvidence
} from '$lib/server/data';

export const load: PageServerLoad = async ({ params, locals }) => {
  const control = await getControl(params.id);
  if (!control) throw error(404, 'Control not found');
  if (locals.user && control.tenantId !== locals.user.tenantId && locals.user.tenantId !== '__all__') {
    throw error(403, 'Access denied');
  }

  const [runs, mappings, tests, exceptions, frameworks, evidence] = await Promise.all([
    getControlTestRuns(control.id, 30),
    getControlMappings(control.id),
    getControlTests(control.id),
    getControlExceptions(control.id),
    getFrameworks(),
    getEvidence(control.tenantId, 12)
  ]);

  return { control, runs, mappings, tests, exceptions, frameworks, evidence };
};
