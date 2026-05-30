// =====================================================================
//  /regwatch/[id] — Reg change detail. Loads impact assessments across
//  tenants and the upstream RegSource so we can show "raw source link".
// =====================================================================

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getRegChange, getImpactAssessments, getRegSources, getTenantSummaries, getRegFrameworkRequirements } from '$lib/server/data';

export const load: PageServerLoad = async ({ params }) => {
  const change = await getRegChange(params.id);
  if (!change) throw error(404, 'Regulatory change not found');
  const [impacts, sources, tenants, requirementSuggestions] = await Promise.all([
    getImpactAssessments(change.id),
    getRegSources(),
    getTenantSummaries(),
    getRegFrameworkRequirements(change.id)
  ]);
  const source = sources.find((s) => s.id === change.sourceId);
  const tenantNames: Record<string, string> = Object.fromEntries(tenants.map((t) => [t.id, t.name]));
  return { change, impacts, source, tenantNames, requirementSuggestions };
};
