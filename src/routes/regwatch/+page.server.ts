// =====================================================================
//  /regwatch — Regulatory Horizon. Platform-global feed; we pull the
//  reg sources to compute "sources monitored" and pull recent changes
//  for the timeline.
// =====================================================================

import type { PageServerLoad } from './$types';
import { getRegChanges, getRegSources, getImpactAssessments } from '$lib/server/data';

export const load: PageServerLoad = async () => {
  const [changes, sources] = await Promise.all([
    getRegChanges(60),
    getRegSources()
  ]);
  // Pull impact assessments for the hero change (MAS Notice 655).
  const heroImpacts = await getImpactAssessments('reg_hero_mas655');
  return { changes, sources, heroImpacts };
};
