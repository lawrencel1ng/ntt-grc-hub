// =====================================================================
//  /risk/[id] — Single risk detail with FAIR drill-down, treatment plans,
//  scenario list, history, and linked controls.
// =====================================================================

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
  getRisk, getFairScenariosForRisk, getFairRun, getIssues, getControls
} from '$lib/server/data';

export const load: PageServerLoad = async ({ params }) => {
  const risk = await getRisk(params.id);
  if (!risk) throw error(404, 'Risk not found');

  const [scenarios, fair, issues, controls] = await Promise.all([
    getFairScenariosForRisk(risk.id),
    getFairRun(risk.id),
    getIssues(risk.tenantId),
    getControls(risk.tenantId)
  ]);

  // Heuristic linkage: pick the controls whose family touches the risk
  // category (e.g. "cyber" → "access-control" / "encryption"). The pg
  // version would join risk_control_links; mock returns top 6 by code.
  const linkedControls = controls.slice(0, 6);

  const openIssues = issues.filter((i) =>
    i.status === 'open' || i.status === 'in-progress'
  );

  return { risk, scenarios, fair, openIssues, linkedControls };
};
