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
  await pool.query(
    `INSERT INTO platform.sessions (user_id, token_hash, token_prefix, issued_at, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, now(), $4, $5::inet, $6)`,
    [userId, hash, prefix, expiresAt, ip || null, ua || null]
  );
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
