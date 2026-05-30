// =====================================================================
//  /risk/[id] — Single risk detail with FAIR drill-down, treatment plans,
//  scenario list, history, and linked controls.
// =====================================================================

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
  getRisk, getFairScenariosForRisk, getFairRun, getIssues, getRecentlyTestedControls,
  getRiskTreatments, getRiskHistory
} from '$lib/server/data';

export const load: PageServerLoad = async ({ params }) => {
  const risk = await getRisk(params.id);
  if (!risk) throw error(404, 'Risk not found');

  const [scenarios, fair, issues, linkedControls, treatments, history] = await Promise.all([
    getFairScenariosForRisk(risk.id),
    getFairRun(risk.id),
    getIssues(risk.tenantId),
    getRecentlyTestedControls(risk.tenantId, 6),
    getRiskTreatments(risk.id),
    getRiskHistory(risk.id)
  ]);

  const openIssues = issues.filter((i) =>
    i.status === 'open' || i.status === 'in-progress'
  );

  return { risk, scenarios, fair, openIssues, linkedControls, treatments, history };
};
