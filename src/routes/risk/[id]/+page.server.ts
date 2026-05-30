// =====================================================================
//  /risk/[id] — Single risk detail with FAIR drill-down, treatment plans,
//  scenario list, history, and linked controls.
// =====================================================================

import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import {
  getRisk, getFairScenariosForRisk, getFairRun, getIssues, getRecentlyTestedControls,
  getRiskTreatments, getRiskHistory
} from '$lib/server/data';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

export const load: PageServerLoad = async ({ params, locals }) => {
  const risk = await getRisk(params.id);
  if (!risk) throw error(404, 'Risk not found');
  if (locals.user && risk.tenantId !== locals.user.tenantId && locals.user.tenantId !== '__all__') {
    throw error(403, 'Access denied');
  }

  const [scenarios, fair, openIssues, linkedControls, treatments, history] = await Promise.all([
    getFairScenariosForRisk(risk.id),
    getFairRun(risk.id),
    getIssues(risk.tenantId, true),
    getRecentlyTestedControls(risk.tenantId, 6),
    getRiskTreatments(risk.id),
    getRiskHistory(risk.id)
  ]);

  return { risk, scenarios, fair, openIssues, linkedControls, treatments, history };
};

const VALID_STATUSES = ['identified', 'assessed', 'treated', 'monitoring', 'closed'] as const;
const VALID_SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const;
const VALID_LIKELIHOODS = ['rare', 'unlikely', 'possible', 'likely', 'almost-certain'] as const;
const VALID_TREATMENTS = ['accept', 'mitigate', 'transfer', 'avoid'] as const;

export const actions: Actions = {
  updateRisk: async ({ params, request, locals }) => {
    if (!locals.user) return fail(401, { editError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { editError: 'Requires Postgres mode' });

    const fd = await request.formData();
    const title = String(fd.get('title') ?? '').trim();
    const description = String(fd.get('description') ?? '').trim() || null;
    const category = String(fd.get('category') ?? '').trim();
    const inherentSeverity = String(fd.get('inherentSeverity') ?? '').trim();
    const inherentLikelihood = String(fd.get('inherentLikelihood') ?? '').trim();
    const residualSeverity = String(fd.get('residualSeverity') ?? '').trim();
    const residualLikelihood = String(fd.get('residualLikelihood') ?? '').trim();
    const treatmentStrategy = String(fd.get('treatmentStrategy') ?? '').trim();

    if (!title) return fail(400, { editError: 'Title is required.' });
    if (title.length > 256) return fail(400, { editError: 'Title must be 256 characters or fewer.' });
    if (description && description.length > 2048) return fail(400, { editError: 'Description must be 2048 characters or fewer.' });
    if (category.length > 128) return fail(400, { editError: 'Category must be 128 characters or fewer.' });
    if (!VALID_SEVERITIES.includes(inherentSeverity as typeof VALID_SEVERITIES[number])) return fail(400, { editError: 'Invalid inherent severity.' });
    if (!VALID_LIKELIHOODS.includes(inherentLikelihood as typeof VALID_LIKELIHOODS[number])) return fail(400, { editError: 'Invalid inherent likelihood.' });
    if (!VALID_SEVERITIES.includes(residualSeverity as typeof VALID_SEVERITIES[number])) return fail(400, { editError: 'Invalid residual severity.' });
    if (!VALID_LIKELIHOODS.includes(residualLikelihood as typeof VALID_LIKELIHOODS[number])) return fail(400, { editError: 'Invalid residual likelihood.' });
    if (!VALID_TREATMENTS.includes(treatmentStrategy as typeof VALID_TREATMENTS[number])) return fail(400, { editError: 'Invalid treatment strategy.' });

    const pool = getPool();
    const { rowCount } = await pool.query(
      `UPDATE risk.risks
       SET title = $1, description = $2, category = $3,
           inherent_severity = $4::risk.severity, inherent_likelihood = $5::risk.likelihood,
           residual_severity = $6::risk.severity, residual_likelihood = $7::risk.likelihood,
           treatment_strategy = $8::risk.treatment_strategy
       WHERE id = $9::uuid AND tenant_id = $10`,
      [title, description, category, inherentSeverity, inherentLikelihood,
       residualSeverity, residualLikelihood, treatmentStrategy, params.id, locals.user.tenantId]
    );
    if (!rowCount) return fail(404, { editError: 'Risk not found or access denied.' });

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'risk.updated',
      target: `risk:${params.id}`,
      result: 'success',
      metadata: { title, inherentSeverity, residualSeverity, treatmentStrategy }
    });

    return { editSuccess: true };
  },

  updateStatus: async ({ params, request, locals }) => {
    if (!locals.user) return fail(401, { statusError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { statusError: 'Requires Postgres mode' });

    const data = await request.formData();
    const newStatus = String(data.get('status') ?? '').trim();
    if (!VALID_STATUSES.includes(newStatus as typeof VALID_STATUSES[number])) {
      return fail(400, { statusError: 'Invalid status' });
    }

    const pool = getPool();
    const { rowCount } = await pool.query(
      `UPDATE risk.risks SET status = $1
       WHERE id = $2::uuid AND tenant_id = $3`,
      [newStatus, params.id, locals.user.tenantId]
    );
    if (!rowCount) return fail(404, { statusError: 'Risk not found or access denied' });

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'risk.status.updated',
      target: `risk:${params.id}`,
      result: 'success',
      metadata: { newStatus }
    });

    return { statusUpdated: true, newStatus };
  }
};
