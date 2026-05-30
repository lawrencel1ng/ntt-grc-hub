// =====================================================================
//  /policies/[id] — Policy detail. Loads version history; the route uses
//  versions[].draftedByAgentId to drive agent attribution.
// =====================================================================

import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getPolicy, getPolicyVersions, getFrameworks } from '$lib/server/data';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

export const load: PageServerLoad = async ({ params }) => {
  const policy = await getPolicy(params.id);
  if (!policy) throw error(404, 'Policy not found');
  const [versions, frameworks] = await Promise.all([
    getPolicyVersions(policy.id),
    getFrameworks()
  ]);
  return { policy, versions, frameworks };
};

export const actions: Actions = {
  updatePolicy: async ({ request, params, locals }) => {
    if (!locals.user) return fail(401, { editError: 'Not authenticated.' });
    if (!isPgMode()) return fail(400, { editError: 'Requires Postgres mode.' });

    const data = await request.formData();
    const versionId = String(data.get('versionId') ?? '').trim();
    const contentMd = String(data.get('contentMd') ?? '').trim();
    const status = String(data.get('status') ?? 'draft').trim();

    if (!versionId) return fail(400, { editError: 'Version ID required.' });
    const VALID_STATUSES = ['draft', 'in-review', 'approved', 'retired'];
    if (!VALID_STATUSES.includes(status)) return fail(400, { editError: 'Invalid status.' });

    const pool = getPool();
    // Verify the version belongs to this tenant's policy
    const check = await pool.query(
      `SELECT v.id FROM policy.versions v
       JOIN policy.documents d ON d.id = v.document_id
       WHERE v.id = $1 AND d.id = $2 AND d.tenant_id = $3`,
      [versionId, params.id, locals.user.tenantId]
    );
    if (!check.rows.length) return fail(404, { editError: 'Policy version not found.' });

    await pool.query(
      `UPDATE policy.versions SET content_md = $1, status = $2::policy.version_status,
       drafted_by_user_id = $3
       WHERE id = $4`,
      [contentMd, status, locals.user.id, versionId]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'policy.updated',
      target: `policy:${params.id}`,
      result: 'success'
    });

    return { editSuccess: true };
  }
};
