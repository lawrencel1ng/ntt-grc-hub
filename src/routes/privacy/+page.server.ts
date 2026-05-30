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
  }
};
