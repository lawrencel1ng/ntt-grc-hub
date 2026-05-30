// =====================================================================
//  /regwatch/[id] — Reg change detail. Loads impact assessments across
//  tenants and the upstream RegSource so we can show "raw source link".
// =====================================================================

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getRegChange, getImpactAssessments, getRegSources, getTenantSummaries, getRegFrameworkRequirements } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';

export const load: PageServerLoad = async ({ params, locals }) => {
  const change = await getRegChange(params.id);
  if (!change) throw error(404, 'Regulatory change not found');

  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;

  const [impacts, sources, tenants, requirementSuggestions] = await Promise.all([
    getImpactAssessments(change.id, effective),
    getRegSources(),
    getTenantSummaries(),
    getRegFrameworkRequirements(change.id)
  ]);
  const source = sources.find((s) => s.id === change.sourceId);
  const tenantNames: Record<string, string> = Object.fromEntries(tenants.map((t) => [t.id, t.name]));
  return { change, impacts, source, tenantNames, requirementSuggestions };
};
