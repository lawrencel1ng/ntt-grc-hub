// =====================================================================
//  /issues/[id] — Single issue detail with actions table, mini-timeline,
//  and related-item links (audit / risk / control).
// =====================================================================

import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getIssue, getIssueActions } from '$lib/server/data';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

export const load: PageServerLoad = async ({ params }) => {
  const issue = await getIssue(params.id);
  if (!issue) throw error(404, 'Issue not found');
  const actions = await getIssueActions(issue.id);
  return { issue, actions };
};

const VALID_STATUSES = ['open', 'in-progress', 'resolved', 'accepted-risk'] as const;

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
      `UPDATE issue.issues SET status = $1::issue.status
       WHERE id = $2 AND tenant_id = $3`,
      [newStatus, params.id, locals.user.tenantId]
    );
    if (!rowCount) return fail(404, { statusError: 'Issue not found or access denied' });

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'issue.status.updated',
      target: `issue:${params.id}`,
      result: 'success',
      metadata: { newStatus }
    });

    return { statusUpdated: true, newStatus };
  }
};
