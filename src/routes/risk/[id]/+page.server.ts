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

const VALID_STATUSES = ['identified', 'assessed', 'treated', 'monitoring', 'closed'] as const;

export const actions: Actions = {
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
