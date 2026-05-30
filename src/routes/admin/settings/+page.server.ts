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

  const apiTokens = [
    { id: 'tok_1', name: 'Evidence Collector CI', scope: 'evidence:write', prefix: 'ntt_grc_', lastUsedAt: new Date(Date.now() - 12 * 60_000).toISOString(),  expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString() },
    { id: 'tok_2', name: 'Board Pack Exporter',   scope: 'report:read',    prefix: 'ntt_grc_', lastUsedAt: new Date(Date.now() - 2 * 3600_000).toISOString(),  expiresAt: new Date(Date.now() + 90 * 86_400_000).toISOString() },
    { id: 'tok_3', name: 'Auditor (external)',    scope: 'evidence:read',  prefix: 'ntt_grc_', lastUsedAt: new Date(Date.now() - 9 * 86_400_000).toISOString(), expiresAt: new Date(Date.now() + 180 * 86_400_000).toISOString() },
    { id: 'tok_4', name: 'Servicedesk webhook',   scope: 'issue:write',    prefix: 'ntt_grc_', lastUsedAt: new Date(Date.now() - 31 * 60_000).toISOString(),   expiresAt: new Date(Date.now() + 365 * 86_400_000).toISOString() }
  ];

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
