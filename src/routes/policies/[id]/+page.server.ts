// =====================================================================
//  /policies/[id] — Policy detail. Loads version history; the route uses
//  versions[].draftedByAgentId to drive agent attribution.
// =====================================================================

import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getPolicy, getPolicyVersions, getPolicyFrameworkMappings, getPolicyAcks, getPolicyExceptions } from '$lib/server/data';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

export const load: PageServerLoad = async ({ params, locals }) => {
  const policy = await getPolicy(params.id);
  if (!policy) throw error(404, 'Policy not found');
  if (locals.user && policy.tenantId !== locals.user.tenantId && locals.user.tenantId !== '__all__') {
    throw error(403, 'Access denied');
  }
  const [versions, policyFrameworks] = await Promise.all([
    getPolicyVersions(policy.id),
    getPolicyFrameworkMappings(policy.id)
  ]);
  const currentVersion = versions.find((v) => v.status === 'approved') ?? versions[versions.length - 1];
  const [acks, exceptions] = await Promise.all([
    currentVersion ? getPolicyAcks(currentVersion.id, 20) : Promise.resolve([]),
    getPolicyExceptions(policy.id)
  ]);
  return { policy, versions, policyFrameworks, acks, exceptions };
};

export const actions: Actions = {
  updatePolicy: async ({ request, params, locals }) => {
    if (!locals.user) return fail(401, { editError: 'Not authenticated.' });
    if (!isPgMode()) return fail(400, { editError: 'Requires Postgres mode.' });

    const data = await request.formData();
    const versionId = String(data.get('versionId') ?? '').trim();
    const contentMd = String(data.get('contentMd') ?? '').trim();
    const status = String(data.get('status') ?? 'draft').trim();
    const ownerEmail = String(data.get('ownerEmail') ?? '').trim().toLowerCase() || null;

    if (!versionId) return fail(400, { editError: 'Version ID required.' });
    if (contentMd.length > 200_000) return fail(400, { editError: 'Policy content must be 200 000 characters or fewer.' });
    const VALID_STATUSES = ['draft', 'in-review', 'approved', 'retired'];
    if (!VALID_STATUSES.includes(status)) return fail(400, { editError: 'Invalid status.' });
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

    if (ownerUserId) {
      await pool.query(
        `UPDATE policy.documents SET owner_user_id = $1::uuid WHERE id = $2::uuid AND tenant_id = $3`,
        [ownerUserId, params.id, locals.user.tenantId]
      );
    }

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'policy.updated',
      target: `policy:${params.id}`,
      result: 'success',
      metadata: { ownerEmail }
    });

    return { editSuccess: true, ownerEmail: ownerEmail ?? undefined };
  },

  acknowledgePolicy: async ({ params, locals }) => {
    if (!locals.user) return fail(401, { ackError: 'Not authenticated.' });
    if (!isPgMode()) return fail(400, { ackError: 'Requires Postgres mode.' });

    const pool = getPool();
    // Get the current approved version for this policy (tenant-scoped)
    const { rows: vRows } = await pool.query<{ id: string }>(
      `SELECT v.id FROM policy.versions v
       JOIN policy.documents d ON d.id = v.document_id
       WHERE d.id = $1 AND d.tenant_id = $2
       ORDER BY (v.status = 'approved') DESC, v.created_at DESC
       LIMIT 1`,
      [params.id, locals.user.tenantId]
    );
    if (!vRows.length) return fail(404, { ackError: 'Policy version not found.' });
    const versionId = vRows[0].id;

    // ON CONFLICT DO NOTHING — idempotent; user can only acknowledge once
    await pool.query(
      `INSERT INTO policy.acknowledgements (tenant_id, version_id, user_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (version_id, user_id) DO NOTHING`,
      [locals.user.tenantId, versionId, locals.user.id]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'policy.acknowledged',
      target: `policy:${params.id}`,
      result: 'success',
      metadata: { versionId }
    });

    return { ackSuccess: true };
  },

  requestException: async ({ params, request, locals }) => {
    if (!locals.user) return fail(401, { exceptionError: 'Not authenticated.' });
    if (!isPgMode()) return fail(400, { exceptionError: 'Requires Postgres mode.' });

    const data = await request.formData();
    const justification = String(data.get('justification') ?? '').trim();
    const expiresAt = String(data.get('expiresAt') ?? '').trim() || null;

    if (!justification) return fail(400, { exceptionError: 'Justification is required.' });
    if (justification.length > 2048) return fail(400, { exceptionError: 'Justification must be 2048 characters or fewer.' });

    const pool = getPool();
    const check = await pool.query<{ id: string }>(
      `SELECT id FROM policy.documents WHERE id = $1::uuid AND tenant_id = $2 LIMIT 1`,
      [params.id, locals.user.tenantId]
    );
    if (!check.rows.length) return fail(404, { exceptionError: 'Policy not found.' });

    await pool.query(
      `INSERT INTO policy.exceptions (tenant_id, document_id, requester_user_id, justification, expires_at)
       VALUES ($1, $2::uuid, $3::uuid, $4, $5)`,
      [locals.user.tenantId, params.id, locals.user.id, justification, expiresAt]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'policy.exception.requested',
      target: `policy:${params.id}`,
      result: 'success'
    });

    return { exceptionRequested: true };
  }
};
