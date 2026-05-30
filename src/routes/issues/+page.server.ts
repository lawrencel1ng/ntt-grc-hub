// =====================================================================
//  /issues — Issues & Incidents list. Tenant-scoped; MSSP rollup queries
//  all tenants in pg mode.
// =====================================================================

import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getIssues } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;
  const issues = await getIssues(effective);
  return { issues, isAll: tenantId === ALL_TENANTS_ID, effectiveTenantId: effective };
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
  }
};
