// =====================================================================
//  /policies — Policy Management. Tenant-scoped; we resolve the latest
//  version per policy so the cards can show drafted-by-agent badges.
// =====================================================================

import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getPolicies, getPolicyVersions, getPolicyAckCount } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';
import type { PolicyVersion } from '$lib/data/types';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;
  const [policies, totalAcks] = await Promise.all([
    getPolicies(effective),
    getPolicyAckCount(effective)
  ]);
  const versionPairs = await Promise.all(policies.map((p) => getPolicyVersions(p.id).then((v) => ({ id: p.id, v }))));
  const currentByPolicy: Record<string, PolicyVersion | undefined> = {};
  for (const { id, v } of versionPairs) {
    const current = v.find((x) => x.status === 'approved') ?? v[v.length - 1];
    currentByPolicy[id] = current;
  }
  return { policies, currentByPolicy, totalAcks, isAll: tenantId === ALL_TENANTS_ID };
};

export const actions: Actions = {
  createPolicy: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { policyError: 'Not authenticated.' });
    if (!isPgMode()) return fail(400, { policyError: 'Requires Postgres mode.' });

    const data = await request.formData();
    const title = String(data.get('title') ?? '').trim();
    const code = String(data.get('code') ?? '').trim().toUpperCase();
    const jurisdiction = String(data.get('jurisdiction') ?? 'Global').trim();

    if (!title || !code) return fail(400, { policyError: 'Title and code are required.' });
    if (title.length > 256) return fail(400, { policyError: 'Title must be 256 characters or fewer.' });
    if (code.length > 32 || !/^[A-Z0-9_-]+$/.test(code)) return fail(400, { policyError: 'Code must be 1–32 uppercase alphanumeric characters (A–Z, 0–9, - _).' });
    if (jurisdiction.length > 128) return fail(400, { policyError: 'Jurisdiction must be 128 characters or fewer.' });

    const pool = getPool();
    const existing = await pool.query(
      `SELECT id FROM policy.documents WHERE tenant_id = $1 AND code = $2`,
      [locals.user.tenantId, code]
    );
    if (existing.rows.length) return fail(409, { policyError: `Policy code ${code} already exists.` });

    const docRes = await pool.query(
      `INSERT INTO policy.documents (tenant_id, code, title, jurisdiction)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [locals.user.tenantId, code, title, jurisdiction]
    );
    const docId = docRes.rows[0].id;

    const verRes = await pool.query(
      `INSERT INTO policy.versions (tenant_id, document_id, version_no, content_md, status, drafted_by_user_id)
       VALUES ($1, $2, 'v1.0', $3, 'draft', $4) RETURNING id`,
      [locals.user.tenantId, docId, `# ${title}\n\nDraft policy content. Edit to fill in policy details.`, locals.user.id]
    );
    await pool.query(
      `UPDATE policy.documents SET current_version_id = $1 WHERE id = $2`,
      [verRes.rows[0].id, docId]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'policy.created',
      target: `policy:${code}`,
      result: 'success'
    });

    return { policyCreated: true, policyCode: code };
  }
};
