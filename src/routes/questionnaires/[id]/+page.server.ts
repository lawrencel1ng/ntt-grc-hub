// =====================================================================
//  /questionnaires/[id] — Single questionnaire with response detail.
//  Agent-completed instances carry confidence + evidence attribution
//  surfaced as a hero banner on the detail page.
// =====================================================================

import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getQuestionnaire, getQuestionnaireResponses, getVendor, getEvidence } from '$lib/server/data';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

export const load: PageServerLoad = async ({ params, locals }) => {
  const questionnaire = await getQuestionnaire(params.id);
  if (!questionnaire) throw error(404, 'Questionnaire not found');
  if (locals.user && questionnaire.tenantId !== locals.user.tenantId && locals.user.tenantId !== '__all__') {
    throw error(403, 'Access denied');
  }

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

const VALID_Q_STATUSES = ['sent', 'in-progress', 'complete'] as const;

export const actions: Actions = {
  updateStatus: async ({ params, request, locals }) => {
    if (!locals.user) return fail(401, { statusError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { statusError: 'Requires Postgres mode' });

    const data = await request.formData();
    const newStatus = String(data.get('status') ?? '').trim();
    if (!VALID_Q_STATUSES.includes(newStatus as typeof VALID_Q_STATUSES[number])) {
      return fail(400, { statusError: 'Invalid status' });
    }

    const pool = getPool();
    const { rowCount } = await pool.query(
      `UPDATE vendor.questionnaires SET status = $1::vendor.questionnaire_status
       WHERE id = $2::uuid AND tenant_id = $3`,
      [newStatus, params.id, locals.user.tenantId]
    );
    if (!rowCount) return fail(404, { statusError: 'Questionnaire not found or access denied' });

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'questionnaire.status.updated',
      target: `questionnaire:${params.id}`,
      result: 'success',
      metadata: { newStatus }
    });

    return { statusUpdated: true, newStatus };
  }
};
