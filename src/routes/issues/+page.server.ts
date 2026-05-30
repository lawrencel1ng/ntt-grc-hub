// =====================================================================
//  /issues — Issues & Incidents list. Tenant-scoped; MSSP rollup queries
//  all tenants in pg mode.
// =====================================================================

import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getIssues, getIncidents } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

const VALID_INC_SEVS = ['sev1', 'sev2', 'sev3', 'sev4'] as const;
const VALID_INC_STATUSES = ['open', 'contained', 'resolved', 'postmortem-done'] as const;

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;
  const [issues, incidents] = await Promise.all([
    getIssues(effective),
    getIncidents(effective)
  ]);
  return { issues, incidents, isAll: tenantId === ALL_TENANTS_ID, effectiveTenantId: effective };
};

export const actions: Actions = {
  createIssue: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { issueError: 'Not authenticated.' });
    if (!isPgMode()) return fail(400, { issueError: 'Requires Postgres mode.' });

    const data = await request.formData();
    const title = String(data.get('title') ?? '').trim();
    const source = String(data.get('source') ?? 'audit').trim();
    const severity = String(data.get('severity') ?? 'medium').trim();
    const dueAt = String(data.get('dueAt') ?? '').trim() || null;

    if (!title) return fail(400, { issueError: 'Title is required.' });
    if (title.length > 256) return fail(400, { issueError: 'Title must be 256 characters or fewer.' });

    const VALID_SOURCES = ['audit', 'risk-treatment', 'incident', 'control-test', 'regulatory'];
    const VALID_SEVS = ['critical', 'high', 'medium', 'low', 'info'];
    if (!VALID_SOURCES.includes(source)) return fail(400, { issueError: 'Invalid source.' });
    if (!VALID_SEVS.includes(severity)) return fail(400, { issueError: 'Invalid severity.' });

    const pool = getPool();
    await pool.query(
      `INSERT INTO issue.issues (tenant_id, title, source, severity, status, due_at)
       VALUES ($1, $2, $3::issue.source, $4::risk.severity, 'open', $5::timestamptz)`,
      [locals.user.tenantId, title, source, severity, dueAt]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'issue.created',
      target: `issue:${title}`,
      result: 'success'
    });

    return { issueCreated: true };
  },

  createIncident: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { incidentError: 'Not authenticated.' });
    if (!isPgMode()) return fail(400, { incidentError: 'Requires Postgres mode.' });

    const data = await request.formData();
    const title = String(data.get('title') ?? '').trim();
    const severity = String(data.get('severity') ?? 'sev3').trim();

    if (!title) return fail(400, { incidentError: 'Title is required.' });
    if (title.length > 256) return fail(400, { incidentError: 'Title must be 256 characters or fewer.' });
    if (!VALID_INC_SEVS.includes(severity as typeof VALID_INC_SEVS[number])) {
      return fail(400, { incidentError: 'Severity must be sev1, sev2, sev3, or sev4.' });
    }

    const pool = getPool();

    // Auto-generate code INC-NNN scoped to tenant
    const { rows: codeRows } = await pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM incident.incidents WHERE tenant_id = $1`,
      [locals.user.tenantId]
    );
    const code = `INC-${String((codeRows[0]?.n ?? 0) + 1).padStart(3, '0')}`;

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO incident.incidents (tenant_id, code, title, severity, status, opened_at)
       VALUES ($1, $2, $3, $4::incident.severity, 'open', now())
       RETURNING id::text`,
      [locals.user.tenantId, code, title, severity]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'incident.created',
      target: `incident:${rows[0].id}`,
      result: 'success',
      metadata: { code, severity }
    });

    return { incidentCreated: true, code };
  },

  updateIncidentStatus: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { incStatusError: 'Not authenticated.' });
    if (!isPgMode()) return fail(400, { incStatusError: 'Requires Postgres mode.' });

    const data = await request.formData();
    const incidentId = String(data.get('incidentId') ?? '').trim();
    const newStatus = String(data.get('status') ?? '').trim();

    if (!incidentId) return fail(400, { incStatusError: 'Incident ID required.' });
    if (!VALID_INC_STATUSES.includes(newStatus as typeof VALID_INC_STATUSES[number])) {
      return fail(400, { incStatusError: 'Invalid status.' });
    }

    const pool = getPool();

    // Build status-dependent timestamp columns (values use now(), no extra params needed)
    const extraCols: string[] = [];
    if (newStatus === 'contained') extraCols.push('contained_at = now()');
    if (newStatus === 'resolved' || newStatus === 'postmortem-done') extraCols.push('resolved_at = now()');
    const extraSql = extraCols.length ? ', ' + extraCols.join(', ') : '';

    const { rowCount } = await pool.query(
      `UPDATE incident.incidents SET status = $1::incident.status${extraSql}
       WHERE id = $2::uuid AND tenant_id = $3`,
      [newStatus, incidentId, locals.user.tenantId]
    );
    if (!rowCount) return fail(404, { incStatusError: 'Incident not found or access denied.' });

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'incident.status.updated',
      target: `incident:${incidentId}`,
      result: 'success',
      metadata: { newStatus }
    });

    return { incStatusUpdated: true, incidentId, newStatus };
  }
};
