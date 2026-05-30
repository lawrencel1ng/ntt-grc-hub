// =====================================================================
//  /privacy — GDPR · PDPA · PIPL · CCPA · HIPAA.
//  Tenant-scoped.
// =====================================================================

import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import {
  getPrivacyActivities, getDPIAs, getSubjectRequests, getBreaches
} from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;

  const [activities, dpias, requests, breaches] = await Promise.all([
    getPrivacyActivities(effective),
    getDPIAs(effective),
    getSubjectRequests(effective),
    getBreaches(effective)
  ]);

  return {
    activities, dpias, requests, breaches,
    isAll: tenantId === ALL_TENANTS_ID,
    effectiveTenantId: effective
  };
};

const VALID_DPIA_STATUSES = ['draft', 'in-review', 'approved', 'retired'] as const;
const VALID_SR_STATUSES = ['received', 'in-progress', 'resolved', 'rejected'] as const;
const VALID_SR_KINDS = ['access', 'erasure', 'portability', 'objection', 'rectification'] as const;
const VALID_SEVS = ['critical', 'high', 'medium', 'low'] as const;

export const actions: Actions = {
  updateDpiaStatus: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { dpiaError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { dpiaError: 'Requires Postgres mode' });

    const data = await request.formData();
    const dpiaId = String(data.get('dpiaId') ?? '').trim();
    const newStatus = String(data.get('status') ?? '').trim();

    if (!dpiaId) return fail(400, { dpiaError: 'DPIA ID required' });
    if (!VALID_DPIA_STATUSES.includes(newStatus as typeof VALID_DPIA_STATUSES[number])) {
      return fail(400, { dpiaError: 'Invalid status' });
    }

    const pool = getPool();
    const { rowCount } = await pool.query(
      `UPDATE privacy.dpias SET status = $1
       WHERE id = $2::uuid AND tenant_id = $3`,
      [newStatus, dpiaId, locals.user.tenantId]
    );
    if (!rowCount) return fail(404, { dpiaError: 'DPIA not found or access denied' });

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'privacy.dpia.status.updated',
      target: `dpia:${dpiaId}`,
      result: 'success',
      metadata: { newStatus }
    });

    return { dpiaUpdated: true, dpiaId, newStatus };
  },

  updateSubjectRequestStatus: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { srError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { srError: 'Requires Postgres mode' });

    const data = await request.formData();
    const requestId = String(data.get('requestId') ?? '').trim();
    const newStatus = String(data.get('status') ?? '').trim();

    if (!requestId) return fail(400, { srError: 'Request ID required' });
    if (!VALID_SR_STATUSES.includes(newStatus as typeof VALID_SR_STATUSES[number])) {
      return fail(400, { srError: 'Invalid status' });
    }

    const pool = getPool();
    const { rowCount } = await pool.query(
      `UPDATE privacy.subject_requests
       SET status = $1::privacy.request_status,
           resolved_at = CASE WHEN $1 = 'resolved' THEN now() ELSE resolved_at END
       WHERE id = $2::uuid AND tenant_id = $3`,
      [newStatus, requestId, locals.user.tenantId]
    );
    if (!rowCount) return fail(404, { srError: 'Subject request not found or access denied' });

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'privacy.subject_request.status.updated',
      target: `subject_request:${requestId}`,
      result: 'success',
      metadata: { newStatus }
    });

    return { srUpdated: true, requestId, newStatus };
  },

  logSubjectRequest: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { srCreateError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { srCreateError: 'Requires Postgres mode' });

    const data = await request.formData();
    const kind = String(data.get('kind') ?? '').trim();
    const requesterEmail = String(data.get('requesterEmail') ?? '').trim();
    const dueAt = String(data.get('dueAt') ?? '').trim() || null;

    if (!VALID_SR_KINDS.includes(kind as typeof VALID_SR_KINDS[number])) {
      return fail(400, { srCreateError: 'Invalid request kind.' });
    }
    if (!requesterEmail || requesterEmail.length > 254) {
      return fail(400, { srCreateError: 'Valid requester email is required (max 254 chars).' });
    }

    // Default due date: 30 days from now if not provided (GDPR Article 12(3))
    const due = dueAt ? new Date(dueAt) : new Date(Date.now() + 30 * 86_400_000);

    const pool = getPool();
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO privacy.subject_requests (tenant_id, kind, requester_email, received_at, due_at, status)
       VALUES ($1, $2::privacy.request_kind, $3, now(), $4, 'received')
       RETURNING id::text`,
      [locals.user.tenantId, kind, requesterEmail, due.toISOString()]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'privacy.subject_request.logged',
      target: `subject_request:${rows[0].id}`,
      result: 'success',
      metadata: { kind, requesterEmail }
    });

    return { srCreated: true };
  },

  reportBreach: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { breachError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { breachError: 'Requires Postgres mode' });

    const data = await request.formData();
    const severity = String(data.get('severity') ?? '').trim();
    const occurredAt = String(data.get('occurredAt') ?? '').trim();
    const affectedSubjects = Math.max(0, Number(data.get('affectedSubjects') ?? 0));
    const rootCause = String(data.get('rootCause') ?? '').trim();

    if (!VALID_SEVS.includes(severity as typeof VALID_SEVS[number])) {
      return fail(400, { breachError: 'Invalid severity.' });
    }
    if (!occurredAt) return fail(400, { breachError: 'Occurred-at date is required.' });
    if (!rootCause) return fail(400, { breachError: 'Root cause is required.' });
    if (rootCause.length > 2048) return fail(400, { breachError: 'Root cause must be 2048 characters or fewer.' });
    if (!Number.isFinite(affectedSubjects)) return fail(400, { breachError: 'Invalid affected subjects count.' });

    const pool = getPool();

    // Auto-generate code BR-NNN scoped to tenant
    const { rows: cntRows } = await pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM privacy.breaches WHERE tenant_id = $1`,
      [locals.user.tenantId]
    );
    const code = `BR-${String((cntRows[0]?.n ?? 0) + 1).padStart(3, '0')}`;

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO privacy.breaches
         (tenant_id, code, severity, occurred_at, detected_at, affected_subjects, regulator_notified, root_cause)
       VALUES ($1, $2, $3::risk.severity, $4::timestamptz, now(), $5, false, $6)
       RETURNING id::text`,
      [locals.user.tenantId, code, severity, occurredAt, affectedSubjects, rootCause]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'privacy.breach.reported',
      target: `breach:${rows[0].id}`,
      result: 'success',
      metadata: { code, severity, affectedSubjects }
    });

    return { breachCreated: true, code };
  }
};
