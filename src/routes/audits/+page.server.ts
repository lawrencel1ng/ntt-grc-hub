// =====================================================================
//  /audits — Audit Management. We need findings counts per engagement so
//  the kanban cards can show the severity split; loaded in parallel.
// =====================================================================

import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getAudits, getAuditFindingsByTenant } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';
import type { AuditFinding } from '$lib/data/types';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;
  const [audits, findingsByAudit] = await Promise.all([
    getAudits(effective),
    getAuditFindingsByTenant(effective)
  ]);
  return { audits, findingsByAudit, isAll: tenantId === ALL_TENANTS_ID };
};

export const actions: Actions = {
  createEngagement: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { engagementError: 'Not authenticated.' });
    if (!isPgMode()) return fail(400, { engagementError: 'Requires Postgres mode.' });

    const data = await request.formData();
    const name = String(data.get('name') ?? '').trim();
    const type = String(data.get('type') ?? 'internal').trim();
    const leadAuditor = String(data.get('leadAuditor') ?? '').trim();
    const openedAt = String(data.get('openedAt') ?? '').trim() || new Date().toISOString().slice(0, 10);
    const scope = String(data.get('scope') ?? '').trim() || null;

    if (!name || !leadAuditor) return fail(400, { engagementError: 'Name and lead auditor are required.' });
    if (name.length > 256) return fail(400, { engagementError: 'Name must be 256 characters or fewer.' });
    if (leadAuditor.length > 256) return fail(400, { engagementError: 'Lead auditor must be 256 characters or fewer.' });
    if (scope && scope.length > 2048) return fail(400, { engagementError: 'Scope must be 2 048 characters or fewer.' });
    const VALID_TYPES = ['internal', 'external', 'regulatory', 'customer'];
    if (!VALID_TYPES.includes(type)) return fail(400, { engagementError: 'Invalid engagement type.' });

    const pool = getPool();
    await pool.query(
      `INSERT INTO audit.engagements (tenant_id, name, type, lead_auditor, opened_at, scope)
       VALUES ($1, $2, $3::audit.engagement_type, $4, $5::timestamptz, $6)`,
      [locals.user.tenantId, name, type, leadAuditor, openedAt, scope]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'audit.engagement.created',
      target: `engagement:${name}`,
      result: 'success'
    });

    return { engagementCreated: true };
  }
};
