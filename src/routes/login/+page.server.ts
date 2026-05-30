// src/routes/login/+page.server.ts
import type { Actions, PageServerLoad } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { verifyCredentials, createSession, SESSION_COOKIE, SESSION_TTL_DAYS, writeAuditLog } from '$lib/server/auth';
import { isPgMode } from '$lib/server/pg';
import { DEMO_USER_COOKIE, findDemoLogin } from '$lib/data/demo-logins';
import { getNavBadgeCounts } from '$lib/server/data';

const TENANT_COOKIE = 'grc_tenant';
const DEMO_COOKIE_MAX_AGE = 8 * 60 * 60; // 8h

// ── In-memory rate limiter ─────────────────────────────────────────────────
// Keyed by IP. 5 failures within a 15-minute window triggers a 15-minute
// lockout. The Map is module-level so it persists across requests in the
// same server process. In a multi-instance deployment, use Redis instead.
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
interface RateEntry { count: number; windowStart: number; lockedUntil: number }
const loginAttempts = new Map<string, RateEntry>();

function checkRateLimit(ip: string): { blocked: boolean; retryAfterSecs: number } {
  const now = Date.now();
  const entry = loginAttempts.get(ip) ?? { count: 0, windowStart: now, lockedUntil: 0 };
  if (entry.lockedUntil > now) {
    return { blocked: true, retryAfterSecs: Math.ceil((entry.lockedUntil - now) / 1000) };
  }
  if (now - entry.windowStart > WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }
  return { blocked: false, retryAfterSecs: 0 };
}

function recordFailure(ip: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(ip) ?? { count: 0, windowStart: now, lockedUntil: 0 };
  if (now - entry.windowStart > WINDOW_MS) { entry.count = 0; entry.windowStart = now; }
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) entry.lockedUntil = now + WINDOW_MS;
  loginAttempts.set(ip, entry);
}

function clearFailures(ip: string): void {
  loginAttempts.delete(ip);
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
    const { blocked, retryAfterSecs } = checkRateLimit(ip);
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
        clearFailures(ip);
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
      recordFailure(ip);
      if (isPgMode()) writeAuditLog({ actorEmail: email, action: 'login.failed', ip, ua, result: 'failure' });
      return fail(401, { error: 'Invalid email or password.', email });
    }
    clearFailures(ip);
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
