// =====================================================================
//  /ai-gov/[id] — AI Model detail. 404 if not found.
// =====================================================================

import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
  getAIModel, getModelRisks, getPromptsAudit
} from '$lib/server/data';

export const load: PageServerLoad = async ({ params, locals }) => {
  const model = await getAIModel(params.id);
  if (!model) throw error(404, `AI model ${params.id} not found`);
  if (locals.user && model.tenantId !== locals.user.tenantId && locals.user.tenantId !== '__all__') {
    throw error(403, 'Access denied');
  }

  const [risks, prompts] = await Promise.all([
    getModelRisks(model.id),
    getPromptsAudit(model.tenantId, 1000)
  ]);

  const promptsForModel = prompts.filter((p) => p.modelId === model.id).slice(0, 100);

  return { model, risks, prompts: promptsForModel };
};
