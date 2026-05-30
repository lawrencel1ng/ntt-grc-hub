// src/routes/admin/settings/+page.server.ts
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getTenantSummaries } from '$lib/server/data';
import { hashPassword, verifyCredentials, writeAuditLog } from '$lib/server/auth';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';
import { isPgMode, getPool } from '$lib/server/pg';
import { randomBytes } from 'crypto';

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

  let mfaEnabled = false;
  if (isPgMode() && locals.user) {
    try {
      const pool = getPool();
      const r = await pool.query(`SELECT mfa_enabled FROM platform.users WHERE id = $1`, [locals.user.id]);
      mfaEnabled = r.rows[0]?.mfa_enabled ?? false;
    } catch { /* ignore */ }
  }

  let accentColor = '#6d28d9';
  if (isPgMode() && effective) {
    try {
      const pool = getPool();
      const r = await pool.query(`SELECT accent_color FROM platform.tenants WHERE id = $1`, [effective]);
      accentColor = r.rows[0]?.accent_color ?? '#6d28d9';
    } catch { /* column may not exist yet */ }
  }

  return { tenants, tenant, apiTokens, user: locals.user, mfaEnabled, accentColor };
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
    if (next.length < 8 || next.length > 128) return fail(400, { pwError: 'New password must be 8–128 characters.' });

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
  },

  revokeToken: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { tokenError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { tokenError: 'Token management requires Postgres mode.' });

    const data = await request.formData();
    const tokenId = String(data.get('tokenId') ?? '').trim();
    if (!tokenId) return fail(400, { tokenError: 'Token ID required.' });

    const pool = getPool();
    // Verify ownership before deleting — must belong to same tenant
    const check = await pool.query(
      `SELECT t.id FROM platform.api_tokens t
       JOIN platform.users u ON u.id = t.user_id
       WHERE t.id = $1 AND u.tenant_id = $2`,
      [tokenId, locals.user.tenantId]
    );
    if (!check.rows.length) return fail(404, { tokenError: 'Token not found.' });

    await pool.query(`DELETE FROM platform.api_tokens WHERE id = $1`, [tokenId]);
    writeAuditLog({ userId: locals.user.id, actorEmail: locals.user.email, tenantId: locals.user.tenantId, action: 'api_token.revoked', target: `token:${tokenId}`, result: 'success' });
    return { tokenRevoked: true };
  },

  createToken: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { tokenError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { tokenError: 'Token creation requires Postgres mode.' });

    const data = await request.formData();
    const name = String(data.get('tokenName') ?? '').trim();
    const scope = String(data.get('tokenScope') ?? 'evidence:read').trim();
    if (!name) return fail(400, { newTokenError: 'Token name is required.' });

    const rawToken = 'ntt_grc_' + randomBytes(24).toString('hex');
    const { createHash } = await import('crypto');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const prefix = rawToken.slice(0, 16);
    const expiresAt = new Date(Date.now() + 365 * 86_400_000);

    const pool = getPool();
    await pool.query(
      `INSERT INTO platform.api_tokens (user_id, name, scope, prefix, token_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [locals.user.id, name, scope, prefix, tokenHash, expiresAt]
    );
    writeAuditLog({ userId: locals.user.id, actorEmail: locals.user.email, tenantId: locals.user.tenantId, action: 'api_token.created', target: `token:${prefix}`, result: 'success' });
    // Return the raw token once for display — it cannot be recovered afterwards
    return { newToken: rawToken, newTokenName: name };
  },

  toggleMfa: async ({ locals }) => {
    if (!locals.user) return fail(401, { mfaError: 'Not authenticated.' });
    if (!isPgMode()) return fail(400, { mfaError: 'Requires Postgres mode.' });

    const pool = getPool();
    const result = await pool.query(
      `UPDATE platform.users SET mfa_enabled = NOT mfa_enabled
       WHERE id = $1 RETURNING mfa_enabled`,
      [locals.user.id]
    );
    const enabled = result.rows[0]?.mfa_enabled ?? false;

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: enabled ? 'mfa.enabled' : 'mfa.disabled',
      target: `user:${locals.user.id}`,
      result: 'success'
    });

    return { mfaToggled: true, mfaEnabled: enabled };
  },

  updateBranding: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { brandingError: 'Not authenticated.' });
    if (locals.user.role !== 'admin') return fail(403, { brandingError: 'Admin role required.' });
    if (!isPgMode()) return fail(400, { brandingError: 'Requires Postgres mode.' });

    const data = await request.formData();
    const accentColor = String(data.get('accentColor') ?? '').trim();
    if (!accentColor || !/^#[0-9a-fA-F]{6}$/.test(accentColor)) {
      return fail(400, { brandingError: 'Invalid hex color (e.g. #6d28d9).' });
    }

    const pool = getPool();
    try {
      await pool.query(
        `UPDATE platform.tenants SET accent_color = $1 WHERE id = $2`,
        [accentColor, locals.user.tenantId]
      );
    } catch {
      // Column may not exist yet (migration not run)
      return fail(500, { brandingError: 'Branding column not found. Run migration 006.' });
    }

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'tenant.branding.updated',
      target: `tenant:${locals.user.tenantId}`,
      result: 'success'
    });

    return { brandingUpdated: true, accentColor };
  }
};
