// src/routes/login/+page.server.ts
import type { Actions, PageServerLoad } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { verifyCredentials, createSession, SESSION_COOKIE, SESSION_TTL_DAYS } from '$lib/server/auth';
import { isPgMode } from '$lib/server/pg';
import { DEMO_USER_COOKIE, findDemoLogin } from '$lib/data/demo-logins';

const TENANT_COOKIE = 'grc_tenant';
const DEMO_COOKIE_MAX_AGE = 8 * 60 * 60; // 8h

function sanitiseNext(next: string | null | undefined): string {
  const n = next ?? '/';
  return n.startsWith('/') && !n.startsWith('//') ? n : '/';
}

export const load: PageServerLoad = async ({ locals, url }) => {
  // Already logged in — skip login page
  if (locals.user) throw redirect(303, sanitiseNext(url.searchParams.get('next')));
  return { next: sanitiseNext(url.searchParams.get('next')) };
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

    // ── Demo accounts: always work (regardless of DATA_MODE) ────────────
    // Demo emails with password "demo" sign in via a cookie-based shortcut
    // so the demo path doesn't require seeded bcrypt hashes. The picked
    // identity is persisted in DEMO_USER_COOKIE; hooks.server.ts hydrates
    // event.locals.user from it so the avatar, name, role and tenant in
    // the TopBar match what you signed in as.
    const demo = findDemoLogin(email);
    if (demo && password === demo.password) {
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

    // ── Postgres mode (real bcrypt) ─────────────────────────────────────
    const user = await verifyCredentials(email, password);
    if (!user) {
      return fail(401, { error: 'Invalid email or password.', email });
    }

    const ua = request.headers.get('user-agent') ?? '';
    const ip = getClientAddress();
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
