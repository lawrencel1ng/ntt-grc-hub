// =====================================================================
//  /frameworks/[id] — Framework detail. Loads requirements, controls,
//  and evidence scoped to the active tenant. All-tenants mode loads
//  cross-tenant aggregated compliance data.
// =====================================================================

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
  getFramework, getRequirementsForFramework, getFrameworkScores,
  getEvidence, getComplianceGaps, getComplianceAttestations,
  getRequirementCoverage, getControlsByFramework
} from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';

export const load: PageServerLoad = async ({ params, locals }) => {
  const framework = await getFramework(params.id);
  if (!framework) throw error(404, 'Framework not found');

  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;

  const [requirements, scores, evidence, gaps, attestations, coverage, mappedControls] = await Promise.all([
    getRequirementsForFramework(framework.id),
    getFrameworkScores(effective),
    getEvidence(effective, 30),
    getComplianceGaps(framework.id, effective),
    getComplianceAttestations(framework.id, effective),
    getRequirementCoverage(framework.id, effective),
    getControlsByFramework(framework.id, effective)
  ]);

  const score = scores.find((s) => s.frameworkId === framework.id);

  return { framework, requirements, score, evidence, gaps, attestations, coverage, mappedControls, isAll: tenantId === ALL_TENANTS_ID };
};
