// =====================================================================
//  /frameworks/[id] — Framework detail. Loads requirements, then for
//  the tab pages we also pull controls + evidence under the active
//  tenant so the Mappings / Evidence tabs are populated. When no tenant
//  is selected we fall back to the Maybank hero data so the page still
//  feels alive instead of empty.
// =====================================================================

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
  getFramework, getRequirementsForFramework, getFrameworkScores,
  getControls, getEvidence
} from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';

export const load: PageServerLoad = async ({ params, locals }) => {
  const framework = await getFramework(params.id);
  if (!framework) throw error(404, 'Framework not found');

  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? 't_maybank' : tenantId;

  const [requirements, scores, controls, evidence] = await Promise.all([
    getRequirementsForFramework(framework.id),
    getFrameworkScores(tenantId === ALL_TENANTS_ID ? undefined : tenantId),
    getControls(effective),
    getEvidence(effective, 30)
  ]);

  const score = scores.find((s) => s.frameworkId === framework.id);

  return { framework, requirements, score, controls, evidence, isAll: tenantId === ALL_TENANTS_ID };
};
