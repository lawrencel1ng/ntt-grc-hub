// =====================================================================
//  /audits/[id] — Engagement detail. Loads findings + evidence for the
//  Evidence Pack tab (which dramatises Audit Companion's 8-second
//  assembly time per the hero scenario).
// =====================================================================

import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getAudit, getAuditFindings, getAuditWorkpapers, getEvidence } from '$lib/server/data';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

export const load: PageServerLoad = async ({ params, locals }) => {
  const audit = await getAudit(params.id);
  if (!audit) throw error(404, 'Engagement not found');
  if (locals.user && audit.tenantId !== locals.user.tenantId && locals.user.tenantId !== '__all__') {
    throw error(403, 'Access denied');
  }

  const [findings, workpapers, evidence] = await Promise.all([
    getAuditFindings(audit.id),
    getAuditWorkpapers(audit.id),
    getEvidence(audit.tenantId, 36)
  ]);

  return { audit, findings, workpapers, evidence };
};

const VALID_FINDING_STATUSES = ['open', 'closed', 'accepted-risk'] as const;
const VALID_SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const;

export const actions: Actions = {
  createFinding: async ({ params, request, locals }) => {
    if (!locals.user) return fail(401, { findingError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { findingError: 'Requires Postgres mode' });

    const data = await request.formData();
    const title = String(data.get('title') ?? '').trim();
    const description = String(data.get('description') ?? '').trim() || null;
    const severity = String(data.get('severity') ?? '').trim();
    const dueAt = String(data.get('dueAt') ?? '').trim() || null;
    const controlId = String(data.get('controlId') ?? '').trim() || null;

    if (!title) return fail(400, { findingError: 'Title is required.' });
    if (title.length > 256) return fail(400, { findingError: 'Title must be 256 characters or fewer.' });
    if (description && description.length > 2048) return fail(400, { findingError: 'Description must be 2048 characters or fewer.' });
    if (!VALID_SEVERITIES.includes(severity as typeof VALID_SEVERITIES[number])) {
      return fail(400, { findingError: 'Invalid severity.' });
    }

    const pool = getPool();
    const check = await pool.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM audit.engagements WHERE id = $1::uuid LIMIT 1`,
      [params.id]
    );
    if (!check.rows.length) return fail(404, { findingError: 'Engagement not found' });
    if (check.rows[0].tenant_id !== locals.user.tenantId) return fail(403, { findingError: 'Access denied' });

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO audit.findings (tenant_id, engagement_id, severity, title, description, control_id, due_at, owner_user_id)
       VALUES ($1, $2::uuid, $3::risk.severity, $4, $5, $6, $7, $8)
       RETURNING id::text`,
      [locals.user.tenantId, params.id, severity, title, description, controlId, dueAt, locals.user.id]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'audit.finding.created',
      target: `engagement:${params.id}`,
      result: 'success',
      metadata: { findingId: rows[0].id, severity, title }
    });

    return { findingCreated: true, findingId: rows[0].id };
  },

  updateFindingStatus: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { findingError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { findingError: 'Requires Postgres mode' });

    const data = await request.formData();
    const findingId = String(data.get('findingId') ?? '').trim();
    const newStatus = String(data.get('status') ?? '').trim();

    if (!findingId) return fail(400, { findingError: 'Finding ID required' });
    if (!VALID_FINDING_STATUSES.includes(newStatus as typeof VALID_FINDING_STATUSES[number])) {
      return fail(400, { findingError: 'Invalid status' });
    }

    const pool = getPool();
    // Verify the finding belongs to a tenant the user can access
    const check = await pool.query<{ tenant_id: string }>(
      `SELECT e.tenant_id FROM audit.findings f
       JOIN audit.engagements e ON e.id = f.engagement_id
       WHERE f.id = $1::uuid LIMIT 1`,
      [findingId]
    );
    if (!check.rows.length) return fail(404, { findingError: 'Finding not found' });
    if (check.rows[0].tenant_id !== locals.user.tenantId) {
      return fail(403, { findingError: 'Access denied' });
    }

    await pool.query(
      `UPDATE audit.findings SET status = $1::audit.finding_status WHERE id = $2::uuid`,
      [newStatus, findingId]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'audit.finding.status.updated',
      target: `finding:${findingId}`,
      result: 'success',
      metadata: { newStatus }
    });

    return { findingUpdated: true, findingId, newStatus };
  }
};
