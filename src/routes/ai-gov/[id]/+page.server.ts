// =====================================================================
//  /ai-gov/[id] — AI Model detail. 404 if not found.
// =====================================================================

import type { PageServerLoad, Actions } from './$types';
import { error, fail } from '@sveltejs/kit';
import {
  getAIModel, getModelRisks, getPromptsAudit
} from '$lib/server/data';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

export const load: PageServerLoad = async ({ params, locals }) => {
  const model = await getAIModel(params.id);
  if (!model) throw error(404, `AI model ${params.id} not found`);
  if (locals.user && model.tenantId !== locals.user.tenantId && locals.user.tenantId !== '__all__') {
    throw error(403, 'Access denied');
  }

  const [risks, prompts] = await Promise.all([
    getModelRisks(model.id),
    getPromptsAudit(model.tenantId, 100, model.id)
  ]);

  return { model, risks, prompts };
};

const VALID_RISK_TIERS = ['minimal', 'limited', 'high', 'unacceptable'] as const;
const VALID_MODEL_KINDS = ['classifier', 'llm', 'regression', 'vision', 'recommender'] as const;

export const actions: Actions = {
  updateAIModel: async ({ params, request, locals }) => {
    if (!locals.user) return fail(401, { editError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { editError: 'Requires Postgres mode' });

    const fd = await request.formData();
    const name = String(fd.get('name') ?? '').trim();
    const kind = String(fd.get('kind') ?? '').trim();
    const riskTier = String(fd.get('riskTier') ?? '').trim();
    const jurisdiction = String(fd.get('jurisdiction') ?? '').trim();
    const trainingDataSummary = String(fd.get('trainingDataSummary') ?? '').trim() || null;

    if (!name) return fail(400, { editError: 'Name is required.' });
    if (name.length > 256) return fail(400, { editError: 'Name must be 256 characters or fewer.' });
    if (!VALID_MODEL_KINDS.includes(kind as typeof VALID_MODEL_KINDS[number])) return fail(400, { editError: 'Invalid model kind.' });
    if (!VALID_RISK_TIERS.includes(riskTier as typeof VALID_RISK_TIERS[number])) return fail(400, { editError: 'Invalid risk tier.' });
    if (jurisdiction.length > 128) return fail(400, { editError: 'Jurisdiction must be 128 characters or fewer.' });
    if (trainingDataSummary && trainingDataSummary.length > 4096) return fail(400, { editError: 'Training data summary must be 4096 characters or fewer.' });

    const pool = getPool();
    const { rowCount } = await pool.query(
      `UPDATE ai_gov.models
       SET name = $1, kind = $2::ai_gov.model_kind, risk_tier = $3::ai_gov.risk_tier,
           jurisdiction = $4, training_data_summary = $5
       WHERE id = $6::uuid AND tenant_id = $7`,
      [name, kind, riskTier, jurisdiction, trainingDataSummary, params.id, locals.user.tenantId]
    );
    if (!rowCount) return fail(404, { editError: 'AI model not found or access denied.' });

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'ai_gov.model.updated',
      target: `ai_model:${params.id}`,
      result: 'success',
      metadata: { name, kind, riskTier }
    });

    return { editSuccess: true };
  }
};
