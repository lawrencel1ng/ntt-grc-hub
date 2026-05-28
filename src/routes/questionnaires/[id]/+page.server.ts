// =====================================================================
//  /questionnaires/[id] — Single questionnaire with response detail.
//  Agent-completed instances carry confidence + evidence attribution
//  surfaced as a hero banner on the detail page.
// =====================================================================

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getQuestionnaire, getQuestionnaireResponses, getVendor, getEvidence } from '$lib/server/data';

export const load: PageServerLoad = async ({ params }) => {
  const questionnaire = await getQuestionnaire(params.id);
  if (!questionnaire) throw error(404, 'Questionnaire not found');

  const [responses, vendor, evidence] = await Promise.all([
    getQuestionnaireResponses(questionnaire.id),
    getVendor(questionnaire.vendorId),
    getEvidence(questionnaire.tenantId, 50)
  ]);

  // Pre-compute the avg confidence and source-evidence count so the
  // banner copy stays consistent with the table rows below.
  const avgConfidence = responses.length > 0
    ? Math.round(responses.reduce((s, r) => s + r.confidence, 0) / responses.length)
    : 0;

  return { questionnaire, responses, vendor, evidence, avgConfidence };
};
