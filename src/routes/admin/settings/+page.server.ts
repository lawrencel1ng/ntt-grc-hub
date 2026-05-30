// src/routes/admin/settings/+page.server.ts
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getTenantSummaries } from '$lib/server/data';
import { hashPassword, verifyCredentials } from '$lib/server/auth';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';
import { isPgMode, getPool } from '$lib/server/pg';

export const load: PageServerLoad = async ({ locals }) => {
  const tenants = await getTenantSummaries();
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;
  const tenant = tenants.find((t) => t.id === effective);

  let apiTokens: { id: string; name: string; scope: string; prefix: string; lastUsedAt: string; expiresAt: string }[] = [];
  if (isPgMode() && locals.user) {
    try {
      const pool = getPool();
      // Join to users so we can filter by tenant — admin sees all tokens in their tenant
      const where = locals.user.role === 'admin'
        ? `WHERE u.tenant_id = $1`
        : `WHERE t.user_id = $1`;
      const param = locals.user.role === 'admin' ? locals.user.tenantId : locals.user.id;
      const rows = await pool.query<{ id: string; name: string; scope: string; prefix: string; last_used_at: string | null; expires_at: string | null }>(
        `SELECT t.id::text, t.name, t.scope, t.prefix,
                t.last_used_at::text AS last_used_at,
                t.expires_at::text AS expires_at
         FROM platform.api_tokens t
         JOIN platform.users u ON u.id = t.user_id
         ${where}
         ORDER BY t.created_at DESC`,
        [param]
      );
      apiTokens = rows.rows.map((r) => ({
        id: r.id,
        name: r.name,
        scope: r.scope,
        prefix: r.prefix,
        lastUsedAt: r.last_used_at ?? new Date().toISOString(),
        expiresAt: r.expires_at ?? new Date(Date.now() + 365 * 86_400_000).toISOString()
      }));
    } catch {
      apiTokens = [];
    }
  }

  return { tenants, tenant, apiTokens, user: locals.user };
};

export const actions: Actions = {
  updateProfile: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { profileError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { profileError: 'Profile editing requires Postgres mode.' });

    const data = await request.formData();
    const name = String(data.get('name') ?? '').trim();
    const language = String(data.get('language') ?? '').trim();
    const timezone = String(data.get('timezone') ?? '').trim();

    if (!name) return fail(400, { profileError: 'Name is required.' });

    const pool = getPool();
    await pool.query(
      `UPDATE platform.users SET name = $1, language = $2, timezone = $3 WHERE id = $4`,
      [name, language, timezone, locals.user.id]
    );

    return { profileSuccess: true };
  },

  changePassword: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { pwError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { pwError: 'Password change requires Postgres mode.' });

    const data = await request.formData();
    const current = String(data.get('currentPassword') ?? '');
    const next = String(data.get('newPassword') ?? '');
    const confirm = String(data.get('confirmPassword') ?? '');

    if (!current || !next || !confirm) return fail(400, { pwError: 'All fields are required.' });
    if (next !== confirm) return fail(400, { pwError: 'New passwords do not match.' });
    if (next.length < 8) return fail(400, { pwError: 'New password must be at least 8 characters.' });

    const verified = await verifyCredentials(locals.user.email, current);
    if (!verified) return fail(401, { pwError: 'Current password is incorrect.' });

    const hash = await hashPassword(next);
    const pool = getPool();
    await pool.query(`UPDATE platform.users SET password_hash = $1 WHERE id = $2`, [hash, locals.user.id]);

    await pool.query(
      `INSERT INTO platform.audit_log (tenant_id, user_id, actor_email, action, target, result, metadata)
       VALUES ($1, $2, $3, 'password_change', 'user:self', 'success', '{"self": true}')`,
      [locals.user.tenantId, locals.user.id, locals.user.email]
    ).catch(() => { /* audit log is best-effort */ });

    return { pwSuccess: true };
  }
};
