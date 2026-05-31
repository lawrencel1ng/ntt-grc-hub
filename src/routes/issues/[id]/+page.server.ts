// =====================================================================
//  /issues/[id] — Single issue detail with actions table, mini-timeline,
//  and related-item links (audit / risk / control).
// =====================================================================

import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getIssue, getIssueActions } from '$lib/server/data';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

export const load: PageServerLoad = async ({ params, locals }) => {
  const issue = await getIssue(params.id);
  if (!issue) throw error(404, 'Issue not found');
  if (locals.user && issue.tenantId !== locals.user.tenantId && locals.user.tenantId !== '__all__') {
    throw error(403, 'Access denied');
  }
  const actions = await getIssueActions(issue.id);
  return { issue, actions };
};

const VALID_STATUSES = ['open', 'in-progress', 'resolved', 'accepted-risk'] as const;
const VALID_ACTION_STATUSES = ['not-started', 'in-progress', 'done'] as const;
const VALID_SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const;

export const actions: Actions = {
  updateIssue: async ({ params, request, locals }) => {
    if (!locals.user) return fail(401, { editError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { editError: 'Requires Postgres mode' });

    const fd = await request.formData();
    const title = String(fd.get('title') ?? '').trim();
    const description = String(fd.get('description') ?? '').trim() || null;
    const severity = String(fd.get('severity') ?? '').trim();
    const dueAt = String(fd.get('dueAt') ?? '').trim() || null;
    const ownerEmail = String(fd.get('ownerEmail') ?? '').trim().toLowerCase() || null;

    if (!title) return fail(400, { editError: 'Title is required.' });
    if (title.length > 256) return fail(400, { editError: 'Title must be 256 characters or fewer.' });
    if (description && description.length > 2048) return fail(400, { editError: 'Description must be 2048 characters or fewer.' });
    if (!VALID_SEVERITIES.includes(severity as typeof VALID_SEVERITIES[number])) return fail(400, { editError: 'Invalid severity.' });
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
      `UPDATE issue.issues
       SET title = $1, description = $2, severity = $3::risk.severity, due_at = $4,
           owner_user_id = COALESCE($5::uuid, owner_user_id)
       WHERE id = $6::uuid AND tenant_id = $7`,
      [title, description, severity, dueAt, ownerUserId, params.id, locals.user.tenantId]
    );
    if (!rowCount) return fail(404, { editError: 'Issue not found or access denied.' });

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'issue.updated',
      target: `issue:${params.id}`,
      result: 'success',
      metadata: { title, severity, ownerEmail }
    });

    return { editSuccess: true, ownerEmail: ownerEmail ?? undefined };
  },

  addAction: async ({ params, request, locals }) => {
    if (!locals.user) return fail(401, { actionError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { actionError: 'Requires Postgres mode' });

    const data = await request.formData();
    const description = String(data.get('description') ?? '').trim();
    const dueAt = String(data.get('dueAt') ?? '').trim() || null;

    if (!description) return fail(400, { actionError: 'Description is required.' });
    if (description.length > 2048) return fail(400, { actionError: 'Description must be 2048 characters or fewer.' });

    const pool = getPool();
    const check = await pool.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM issue.issues WHERE id = $1::uuid LIMIT 1`, [params.id]
    );
    if (!check.rows.length) return fail(404, { actionError: 'Issue not found' });
    if (check.rows[0].tenant_id !== locals.user.tenantId) return fail(403, { actionError: 'Access denied' });

    await pool.query(
      `INSERT INTO issue.actions (tenant_id, issue_id, description, owner_user_id, due_at)
       VALUES ($1, $2::uuid, $3, $4, $5)`,
      [locals.user.tenantId, params.id, description, locals.user.id, dueAt]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'issue.action.added',
      target: `issue:${params.id}`,
      result: 'success'
    });

    return { actionAdded: true };
  },

  updateActionStatus: async ({ params, request, locals }) => {
    if (!locals.user) return fail(401, { actionError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { actionError: 'Requires Postgres mode' });

    const data = await request.formData();
    const actionId = String(data.get('actionId') ?? '').trim();
    const status = String(data.get('status') ?? '').trim();

    if (!actionId) return fail(400, { actionError: 'Action ID required' });
    if (!VALID_ACTION_STATUSES.includes(status as typeof VALID_ACTION_STATUSES[number])) {
      return fail(400, { actionError: 'Invalid status' });
    }

    const pool = getPool();
    const { rowCount } = await pool.query(
      `UPDATE issue.actions SET status = $1
       WHERE id = $2::uuid AND tenant_id = $3`,
      [status, actionId, locals.user.tenantId]
    );
    if (!rowCount) return fail(404, { actionError: 'Action not found or access denied' });

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'issue.action.status.updated',
      target: `issue:${params.id}`,
      result: 'success',
      metadata: { actionId, status }
    });

    return { actionUpdated: true, actionId, status };
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
      `UPDATE issue.issues SET status = $1::issue.status
       WHERE id = $2::uuid AND tenant_id = $3`,
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
