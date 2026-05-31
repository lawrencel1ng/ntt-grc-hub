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
    const ownerEmail = String(fd.get('ownerEmail') ?? '').trim().toLowerCase() || null;

    if (!title) return fail(400, { editError: 'Title is required.' });
    if (title.length > 256) return fail(400, { editError: 'Title must be 256 characters or fewer.' });
    if (description && description.length > 2048) return fail(400, { editError: 'Description must be 2048 characters or fewer.' });
    if (category.length > 128) return fail(400, { editError: 'Category must be 128 characters or fewer.' });
    if (!VALID_SEVERITIES.includes(inherentSeverity as typeof VALID_SEVERITIES[number])) return fail(400, { editError: 'Invalid inherent severity.' });
    if (!VALID_LIKELIHOODS.includes(inherentLikelihood as typeof VALID_LIKELIHOODS[number])) return fail(400, { editError: 'Invalid inherent likelihood.' });
    if (!VALID_SEVERITIES.includes(residualSeverity as typeof VALID_SEVERITIES[number])) return fail(400, { editError: 'Invalid residual severity.' });
    if (!VALID_LIKELIHOODS.includes(residualLikelihood as typeof VALID_LIKELIHOODS[number])) return fail(400, { editError: 'Invalid residual likelihood.' });
    if (!VALID_TREATMENTS.includes(treatmentStrategy as typeof VALID_TREATMENTS[number])) return fail(400, { editError: 'Invalid treatment strategy.' });
    if (ownerEmail && ownerEmail.length > 256) return fail(400, { editError: 'Owner email must be 256 characters or fewer.' });

    const pool = getPool();

    let ownerUserId: string | null = null;
    if (ownerEmail) {
      const userRow = await pool.query<{ id: string }>(
        `SELECT id FROM platform.users WHERE email = $1 AND tenant_id = $2 AND status = 'active' LIMIT 1`,
        [ownerEmail, locals.user.tenantId]
      );
      if (!userRow.rows.length) return fail(400, { editError: `No active user found with email "${ownerEmail}" in your tenant.` });
      ownerUserId = userRow.rows[0].id;
    }

    const { rowCount } = await pool.query(
      `UPDATE risk.risks
       SET title = $1, description = $2, category = $3,
           inherent_severity = $4::risk.severity, inherent_likelihood = $5::risk.likelihood,
           residual_severity = $6::risk.severity, residual_likelihood = $7::risk.likelihood,
           treatment_strategy = $8::risk.treatment_strategy,
           owner_user_id = COALESCE($9::uuid, owner_user_id)
       WHERE id = $10::uuid AND tenant_id = $11`,
      [title, description, category, inherentSeverity, inherentLikelihood,
       residualSeverity, residualLikelihood, treatmentStrategy, ownerUserId, params.id, locals.user.tenantId]
    );
    if (!rowCount) return fail(404, { editError: 'Risk not found or access denied.' });

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'risk.updated',
      target: `risk:${params.id}`,
      result: 'success',
      metadata: { title, inherentSeverity, residualSeverity, treatmentStrategy, ownerEmail }
    });

    return { editSuccess: true, ownerEmail: ownerEmail ?? undefined };
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
    const extraCol = newStatus === 'assessed' ? ', last_assessed_at = now()' : '';
    const { rowCount } = await pool.query(
      `UPDATE risk.risks SET status = $1${extraCol}
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
  },

  createTreatment: async ({ params, request, locals }) => {
    if (!locals.user) return fail(401, { treatmentError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { treatmentError: 'Requires Postgres mode' });

    const fd = await request.formData();
    const strategy = String(fd.get('strategy') ?? '').trim();
    const description = String(fd.get('description') ?? '').trim();
    const dueAt = String(fd.get('dueAt') ?? '').trim() || null;
    const costSgdRaw = String(fd.get('costSgd') ?? '').trim();
    const costSgd = costSgdRaw ? Number(costSgdRaw) : null;

    if (!VALID_TREATMENTS.includes(strategy as typeof VALID_TREATMENTS[number])) {
      return fail(400, { treatmentError: 'Invalid strategy.' });
    }
    if (!description) return fail(400, { treatmentError: 'Description is required.' });
    if (description.length > 1024) return fail(400, { treatmentError: 'Description must be 1024 characters or fewer.' });
    if (costSgd !== null && (isNaN(costSgd) || costSgd < 0)) {
      return fail(400, { treatmentError: 'Cost must be a non-negative number.' });
    }

    const pool = getPool();
    const check = await pool.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM risk.risks WHERE id = $1::uuid LIMIT 1`,
      [params.id]
    );
    if (!check.rows.length) return fail(404, { treatmentError: 'Risk not found' });
    if (check.rows[0].tenant_id !== locals.user.tenantId) return fail(403, { treatmentError: 'Access denied' });

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO risk.treatments (tenant_id, risk_id, strategy, description, owner_user_id, due_at, cost_sgd)
       VALUES ($1, $2::uuid, $3::risk.treatment_strategy, $4, $5::uuid, $6, $7)
       RETURNING id::text`,
      [locals.user.tenantId, params.id, strategy, description, locals.user.id, dueAt, costSgd]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'risk.treatment.created',
      target: `risk:${params.id}`,
      result: 'success',
      metadata: { treatmentId: rows[0].id, strategy }
    });

    return { treatmentCreated: true };
  }
};
