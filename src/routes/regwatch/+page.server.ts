// =====================================================================
//  /regwatch — Regulatory Horizon. Platform-global feed; we pull the
//  reg sources to compute "sources monitored" and pull recent changes
//  for the timeline.
// =====================================================================

import type { PageServerLoad } from './$types';
import { getRegChanges, getRegSources, getImpactAssessments } from '$lib/server/data';

export const load: PageServerLoad = async () => {
  const [changes, sources, allImpacts] = await Promise.all([
    getRegChanges(60),
    getRegSources(),
    getImpactAssessments()
  ]);
  // Pick the most recently assessed impact as the hero callout
  const heroImpact = allImpacts[0] ?? null;
  const gapsOpened30d = allImpacts
    .filter((ia) => ia.assessedAt && (Date.now() - new Date(ia.assessedAt).getTime()) / 86_400_000 <= 30)
    .reduce((s, ia) => s + ia.gapsOpened, 0);
  return { changes, sources, heroImpact, activeImpacts: allImpacts.length, gapsOpened30d };
};
