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

export const load: PageServerLoad = async ({ params }) => {
  const audit = await getAudit(params.id);
  if (!audit) throw error(404, 'Engagement not found');

  const [findings, workpapers, evidence] = await Promise.all([
    getAuditFindings(audit.id),
    getAuditWorkpapers(audit.id),
    getEvidence(audit.tenantId, 36)
  ]);

  return { audit, findings, workpapers, evidence };
};

const VALID_FINDING_STATUSES = ['open', 'closed', 'accepted-risk'] as const;

export const actions: Actions = {
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
