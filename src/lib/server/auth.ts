// src/lib/server/auth.ts
import bcrypt from 'bcryptjs';
import { getPool } from './pg';
import { RBAC_MATRIX, type Capability } from '$lib/data/users';
import type { Role } from '$lib/data/types';

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
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  await pool.query(
    `INSERT INTO platform.sessions (user_id, token_hash, issued_at, expires_at, ip_address, user_agent)
     VALUES ($1, $2, now(), $3, $4::inet, $5)`,
    [userId, hash, expiresAt, ip || null, ua || null]
  );
  return token;
}

/** Validate session cookie token; returns user or null */
export async function validateSession(token: string): Promise<SessionUser | null> {
  if (!token) return null;
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string; token_hash: string; expires_at: Date; revoked_at: Date | null;
    user_id: string; email: string; name: string; role: Role; tenant_id: string; status: string;
  }>(
    `SELECT s.id, s.token_hash, s.expires_at, s.revoked_at,
            u.id AS user_id, u.email, u.name, u.role, u.tenant_id, u.status
     FROM platform.sessions s
     JOIN platform.users u ON u.id = s.user_id
     WHERE s.expires_at > now() AND s.revoked_at IS NULL
     ORDER BY s.issued_at DESC LIMIT 50`
  );
  for (const row of rows) {
    const match = await bcrypt.compare(token, row.token_hash);
    if (match) {
      if (row.status !== 'active') return null;
      return { id: row.user_id, email: row.email, name: row.name, role: row.role, tenantId: row.tenant_id };
    }
  }
  return null;
}

/** Revoke a session by token (best-effort) */
export async function destroySession(token: string): Promise<void> {
  if (!token) return;
  const pool = getPool();
  const { rows } = await pool.query<{ id: string; token_hash: string }>(
    `SELECT id, token_hash FROM platform.sessions
     WHERE expires_at > now() AND revoked_at IS NULL ORDER BY issued_at DESC LIMIT 50`
  );
  for (const row of rows) {
    const match = await bcrypt.compare(token, row.token_hash);
    if (match) {
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
