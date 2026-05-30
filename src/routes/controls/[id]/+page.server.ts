// =====================================================================
//  /controls/[id] — Control detail. Loads the control + 20 most recent
//  test runs. Mapped frameworks are inferred (mock) from the id seed.
// =====================================================================

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
  getControl, getControlTestRuns, getControlMappings, getControlTests,
  getControlExceptions, getFrameworks, getEvidence
} from '$lib/server/data';

export const load: PageServerLoad = async ({ params }) => {
  const control = await getControl(params.id);
  if (!control) throw error(404, 'Control not found');

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
