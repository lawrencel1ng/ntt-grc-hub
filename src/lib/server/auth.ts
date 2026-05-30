// src/lib/server/auth.ts
import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { getPool } from './pg';
import { RBAC_MATRIX, type Capability } from '$lib/data/users';
import type { Role } from '$lib/data/types';

function tokenPrefix(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 32);
}

export const SESSION_COOKIE = 'grc_session';
export const SESSION_TTL_DAYS = 7;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  tenantId: string;
}

/** Verify email+password; returns user row or null */
export async function verifyCredentials(
  email: string,
  password: string
): Promise<SessionUser | null> {
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string; email: string; name: string;
    role: Role; tenant_id: string; password_hash: string | null; status: string;
  }>(
    `SELECT id, email, name, role, tenant_id, password_hash, status
     FROM platform.users WHERE email = $1`,
    [email.trim().toLowerCase()]
  );
  const user = rows[0];
  if (!user || user.status !== 'active' || !user.password_hash) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenant_id };
}

/** Create a session row; returns the opaque token to store in cookie */
export async function createSession(userId: string, ip: string, ua: string): Promise<string> {
  const pool = getPool();
  const token = crypto.randomUUID() + '-' + crypto.randomUUID();
  const hash = await bcrypt.hash(token, 10);
  const prefix = tokenPrefix(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  await Promise.all([
    pool.query(
      `INSERT INTO platform.sessions (user_id, token_hash, token_prefix, issued_at, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, now(), $4, $5::inet, $6)`,
      [userId, hash, prefix, expiresAt, ip || null, ua || null]
    ),
    pool.query(
      `UPDATE platform.users SET last_login_at = now() WHERE id = $1`,
      [userId]
    )
  ]);
  return token;
}

/** Validate session cookie token; returns user or null.
 *  Uses token_prefix for an indexed O(1) lookup, then bcrypt-verifies
 *  the single matching row. Falls back to the legacy full-scan for
 *  sessions created before migration 001. */
export async function validateSession(token: string): Promise<SessionUser | null> {
  if (!token) return null;
  const pool = getPool();
  const prefix = tokenPrefix(token);

  // Fast path: indexed lookup by prefix (new sessions)
  const { rows } = await pool.query<{
    id: string; token_hash: string; user_id: string;
    email: string; name: string; role: Role; tenant_id: string; status: string;
  }>(
    `SELECT s.id, s.token_hash,
            u.id AS user_id, u.email, u.name, u.role, u.tenant_id, u.status
     FROM platform.sessions s
     JOIN platform.users u ON u.id = s.user_id
     WHERE s.token_prefix = $1
       AND s.expires_at > now()
       AND s.revoked_at IS NULL
     LIMIT 1`,
    [prefix]
  );

  if (rows.length > 0) {
    const row = rows[0];
    const match = await bcrypt.compare(token, row.token_hash);
    if (!match || row.status !== 'active') return null;
    return { id: row.user_id, email: row.email, name: row.name, role: row.role, tenantId: row.tenant_id };
  }

  // Legacy fallback: sessions without a prefix (pre-migration 001)
  const { rows: legacy } = await pool.query<{
    id: string; token_hash: string;
    user_id: string; email: string; name: string; role: Role; tenant_id: string; status: string;
  }>(
    `SELECT s.id, s.token_hash,
            u.id AS user_id, u.email, u.name, u.role, u.tenant_id, u.status
     FROM platform.sessions s
     JOIN platform.users u ON u.id = s.user_id
     WHERE s.token_prefix IS NULL
       AND s.expires_at > now()
       AND s.revoked_at IS NULL
     ORDER BY s.issued_at DESC LIMIT 50`
  );
  for (const row of legacy) {
    const match = await bcrypt.compare(token, row.token_hash);
    if (match) {
      if (row.status !== 'active') return null;
      // Backfill the prefix so future lookups are fast
      pool.query(`UPDATE platform.sessions SET token_prefix = $1 WHERE id = $2`, [prefix, row.id]).catch(() => {});
      return { id: row.user_id, email: row.email, name: row.name, role: row.role, tenantId: row.tenant_id };
    }
  }
  return null;
}

/** Revoke a session by token (best-effort) */
export async function destroySession(token: string): Promise<void> {
  if (!token) return;
  const pool = getPool();
  const prefix = tokenPrefix(token);
  // Fast path using prefix index
  const { rows } = await pool.query<{ id: string; token_hash: string }>(
    `SELECT id, token_hash FROM platform.sessions
     WHERE token_prefix = $1 AND expires_at > now() AND revoked_at IS NULL LIMIT 1`,
    [prefix]
  );
  if (rows.length > 0 && await bcrypt.compare(token, rows[0].token_hash)) {
    await pool.query(`UPDATE platform.sessions SET revoked_at = now() WHERE id = $1`, [rows[0].id]);
    return;
  }
  // Legacy fallback for sessions without a prefix
  const { rows: legacy } = await pool.query<{ id: string; token_hash: string }>(
    `SELECT id, token_hash FROM platform.sessions
     WHERE token_prefix IS NULL AND expires_at > now() AND revoked_at IS NULL
     ORDER BY issued_at DESC LIMIT 50`
  );
  for (const row of legacy) {
    if (await bcrypt.compare(token, row.token_hash)) {
      await pool.query(`UPDATE platform.sessions SET revoked_at = now() WHERE id = $1`, [row.id]);
      break;
    }
  }
}

/** Check RBAC capability for a role */
export function can(role: Role, capability: Capability): boolean {
  return RBAC_MATRIX[role]?.[capability] ?? false;
}

/** Hash a plain-text password */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

// ── Password reset ──────────────────────────────────────────────────────────

const RESET_TTL_MINUTES = 30;

/**
 * Create a password-reset token for the given email (if the user exists).
 * Returns { token, resetUrl } for the caller to log/email; returns null if
 * no user matches (caller should still return a generic success to the UI
 * to prevent email enumeration).
 */
export async function createPasswordResetToken(
  email: string,
  baseUrl: string
): Promise<{ token: string; resetUrl: string; userEmail: string } | null> {
  const pool = getPool();
  const { rows } = await pool.query<{ id: string; email: string; status: string }>(
    `SELECT id, email, status FROM platform.users WHERE email = $1`,
    [email.trim().toLowerCase()]
  );
  const user = rows[0];
  // 'invited' users are allowed so the invite-link flow can work.
  if (!user || (user.status !== 'active' && user.status !== 'invited')) return null;

  // Expire any previous unused tokens for this user
  await pool.query(
    `UPDATE platform.password_reset_tokens SET used_at = now()
     WHERE user_id = $1 AND used_at IS NULL AND expires_at > now()`,
    [user.id]
  );

  const token = crypto.randomUUID() + '-' + crypto.randomUUID();
  const hash = await bcrypt.hash(token, 10);
  const prefix = tokenPrefix(token);
  const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60_000);

  await pool.query(
    `INSERT INTO platform.password_reset_tokens (user_id, token_hash, token_prefix, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [user.id, hash, prefix, expiresAt]
  );

  const resetUrl = `${baseUrl}/reset?token=${encodeURIComponent(token)}`;
  return { token, resetUrl, userEmail: user.email };
}

/**
 * Validate a reset token. Returns { userId, email } if valid, null otherwise.
 */
export async function validatePasswordResetToken(
  token: string
): Promise<{ userId: string; email: string } | null> {
  if (!token) return null;
  const pool = getPool();
  const prefix = tokenPrefix(token);
  const { rows } = await pool.query<{
    id: string; token_hash: string; user_id: string; email: string; status: string;
  }>(
    `SELECT t.id, t.token_hash, t.user_id, u.email, u.status
     FROM platform.password_reset_tokens t
     JOIN platform.users u ON u.id = t.user_id
     WHERE t.token_prefix = $1 AND t.expires_at > now() AND t.used_at IS NULL
     LIMIT 1`,
    [prefix]
  );
  if (!rows.length) return null;
  const row = rows[0];
  const match = await bcrypt.compare(token, row.token_hash);
  // 'invited' users are allowed — they use the reset link to set their initial password.
  if (!match || (row.status !== 'active' && row.status !== 'invited')) return null;
  return { userId: row.user_id, email: row.email };
}

/**
 * Consume a reset token: update the user's password and mark the token used.
 * Returns true on success.
 */
export async function consumePasswordResetToken(
  token: string,
  newPassword: string
): Promise<boolean> {
  const valid = await validatePasswordResetToken(token);
  if (!valid) return false;
  const pool = getPool();
  const prefix = tokenPrefix(token);
  const newHash = await hashPassword(newPassword);
  // Also activate 'invited' users so they can log in after setting their password.
  await pool.query(
    `UPDATE platform.users SET password_hash = $1, status = CASE WHEN status = 'invited' THEN 'active' ELSE status END WHERE id = $2`,
    [newHash, valid.userId]
  );
  await pool.query(
    `UPDATE platform.password_reset_tokens SET used_at = now()
     WHERE token_prefix = $1 AND used_at IS NULL`,
    [prefix]
  );
  // Revoke all active sessions so stolen/leaked credentials can't be replayed.
  await pool.query(
    `UPDATE platform.sessions SET revoked_at = now()
     WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()`,
    [valid.userId]
  );
  return true;
}

/**
 * Revoke all active sessions for a user except an optional excluded session
 * (pass the raw cookie token to keep the current session alive). Call after
 * a self-service password change so other devices/browsers are forced to
 * re-authenticate.
 */
export async function revokeOtherSessions(userId: string, exceptToken?: string): Promise<void> {
  const pool = getPool();
  if (exceptToken) {
    const exceptPrefix = tokenPrefix(exceptToken);
    await pool.query(
      `UPDATE platform.sessions SET revoked_at = now()
       WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
         AND token_prefix != $2`,
      [userId, exceptPrefix]
    );
  } else {
    await pool.query(
      `UPDATE platform.sessions SET revoked_at = now()
       WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()`,
      [userId]
    );
  }
}

// ── Audit log ───────────────────────────────────────────────────────────────

export interface AuditEvent {
  tenantId?: string;
  userId?: string;
  actorEmail?: string;
  action: string;
  target?: string;
  ip?: string;
  ua?: string;
  result: 'success' | 'failure' | 'denied';
  metadata?: Record<string, unknown>;
}

/**
 * Write a hash-chained entry to platform.audit_log (best-effort, non-blocking).
 * The hash chain links each row to the previous row's hash so the log is
 * tamper-evident. Failures are swallowed so a logging error never breaks a
 * request flow.
 */
export function writeAuditLog(event: AuditEvent): void {
  const pool = getPool();
  pool.query<{ row_hash: string }>(
    `SELECT row_hash FROM platform.audit_log ORDER BY id DESC LIMIT 1`
  ).then(({ rows }) => {
    const prevHash = rows[0]?.row_hash ?? null;
    const payload = JSON.stringify({ ...event, prevHash });
    const rowHash = createHash('sha256').update(payload).digest('hex');
    return pool.query(
      `INSERT INTO platform.audit_log
         (tenant_id, user_id, actor_email, action, target, ip_address, user_agent,
          result, metadata, prev_hash, row_hash)
       VALUES ($1, $2, $3, $4, $5, $6::inet, $7, $8, $9, $10, $11)`,
      [
        event.tenantId ?? null,
        event.userId ?? null,
        event.actorEmail ?? null,
        event.action,
        event.target ?? null,
        event.ip ?? null,
        event.ua ?? null,
        event.result,
        event.metadata ? JSON.stringify(event.metadata) : null,
        prevHash,
        rowHash
      ]
    );
  }).catch((e: Error) => {
    console.warn('[audit] write failed:', e.message);
  });
}
