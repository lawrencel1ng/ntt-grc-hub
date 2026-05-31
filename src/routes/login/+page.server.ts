// src/routes/login/+page.server.ts
import type { Actions, PageServerLoad } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { verifyCredentials, createSession, SESSION_COOKIE, SESSION_TTL_DAYS, writeAuditLog } from '$lib/server/auth';
import { isPgMode, getPool } from '$lib/server/pg';
import { DEMO_USER_COOKIE, findDemoLogin } from '$lib/data/demo-logins';
import { getNavBadgeCounts } from '$lib/server/data';

const TENANT_COOKIE = 'grc_tenant';
const DEMO_COOKIE_MAX_AGE = 8 * 60 * 60; // 8h

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

// DB-backed rate limiter — survives restarts and works across multiple instances.
// Falls back gracefully if the table doesn't exist yet.
async function checkLoginRateLimit(ip: string): Promise<{ blocked: boolean; retryAfterSecs: number }> {
  if (!isPgMode()) return { blocked: false, retryAfterSecs: 0 };
  try {
    const pool = getPool();
    const { rows } = await pool.query<{ cnt: number; oldest: string }>(
      `SELECT COUNT(*)::int AS cnt, MIN(attempted_at)::text AS oldest
       FROM platform.login_attempts
       WHERE ip_address = $1::inet
         AND attempted_at > now() - interval '${WINDOW_MINUTES} minutes'`,
      [ip]
    );
    const cnt = rows[0]?.cnt ?? 0;
    if (cnt >= MAX_ATTEMPTS) {
      const oldestMs = rows[0]?.oldest ? new Date(rows[0].oldest).getTime() : Date.now();
      const retryAfterSecs = Math.max(0, Math.ceil((oldestMs + WINDOW_MINUTES * 60_000 - Date.now()) / 1000));
      return { blocked: true, retryAfterSecs };
    }
    return { blocked: false, retryAfterSecs: 0 };
  } catch {
    return { blocked: false, retryAfterSecs: 0 };
  }
}

async function recordLoginFailure(ip: string, email: string): Promise<void> {
  if (!isPgMode()) return;
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO platform.login_attempts (ip_address, email) VALUES ($1::inet, $2)`,
      [ip, email]
    );
    // Best-effort cleanup of old rows (fire and forget)
    pool.query(`SELECT platform.purge_old_login_attempts()`).catch(() => {});
    pool.query(`SELECT platform.purge_old_rate_limit_hits()`).catch(() => {});
  } catch { /* ignore */ }
}

async function clearLoginFailures(ip: string): Promise<void> {
  if (!isPgMode()) return;
  try {
    const pool = getPool();
    await pool.query(`DELETE FROM platform.login_attempts WHERE ip_address = $1::inet`, [ip]);
  } catch { /* ignore */ }
}

function sanitiseNext(next: string | null | undefined): string {
  const n = next ?? '/';
  return n.startsWith('/') && !n.startsWith('//') ? n : '/';
}

export const load: PageServerLoad = async ({ locals, url }) => {
  // Already logged in — skip login page
  if (locals.user) throw redirect(303, sanitiseNext(url.searchParams.get('next')));
  const { frameworks: frameworkCount, agents: agentCount } = await getNavBadgeCounts();
  return { next: sanitiseNext(url.searchParams.get('next')), frameworkCount, agentCount, pgMode: isPgMode() };
};

export const actions: Actions = {
  default: async ({ request, cookies, getClientAddress }) => {
    const data = await request.formData();
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');
    const next = sanitiseNext(String(data.get('next') ?? '/'));

    if (!email || !password) {
      return fail(400, { error: 'Email and password are required.', email });
    }

    const ip = getClientAddress();
    const ua = request.headers.get('user-agent') ?? '';
    const { blocked, retryAfterSecs } = await checkLoginRateLimit(ip);
    if (blocked) {
      if (isPgMode()) writeAuditLog({ actorEmail: email, action: 'login.rate_limited', ip, ua, result: 'denied' });
      return fail(429, {
        error: `Too many failed attempts. Try again in ${Math.ceil(retryAfterSecs / 60)} minute(s).`,
        email
      });
    }

    // ── Demo accounts (mock mode only) ───────────────────────────────────
    // In pg mode demo credentials go through the real DB session path below.
    if (!isPgMode()) {
      const demo = findDemoLogin(email);
      if (demo && password === demo.password) {
        await clearLoginFailures(ip);
        cookies.set(DEMO_USER_COOKIE, email.toLowerCase(), {
          path: '/', httpOnly: true, sameSite: 'lax',
          maxAge: DEMO_COOKIE_MAX_AGE,
          secure: process.env.NODE_ENV === 'production'
        });
        cookies.set(TENANT_COOKIE, demo.tenantId, {
          path: '/', httpOnly: false, sameSite: 'lax',
          maxAge: DEMO_COOKIE_MAX_AGE,
          secure: process.env.NODE_ENV === 'production'
        });
        throw redirect(303, next);
      }
    }

    // ── Postgres mode (real bcrypt) ─────────────────────────────────────
    const user = await verifyCredentials(email, password);
    if (!user) {
      await recordLoginFailure(ip, email);
      if (isPgMode()) writeAuditLog({ actorEmail: email, action: 'login.failed', ip, ua, result: 'failure' });
      return fail(401, { error: 'Invalid email or password.', email });
    }
    await clearLoginFailures(ip);
    writeAuditLog({ userId: user.id, actorEmail: user.email, tenantId: user.tenantId, action: 'login.success', ip, ua, result: 'success' });

    const token = await createSession(user.id, ip, ua);

    cookies.set(SESSION_COOKIE, token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: SESSION_TTL_DAYS * 86_400,
      secure: process.env.NODE_ENV === 'production'
    });

    throw redirect(303, next);
  }
};
