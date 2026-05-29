// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { validateSession, SESSION_COOKIE } from '$lib/server/auth';
import { isPgMode } from '$lib/server/pg';
import { DEMO_USER_COOKIE, DEFAULT_DEMO_LOGIN, findDemoLogin } from '$lib/data/demo-logins';

const TENANT_COOKIE = 'grc_tenant';
const ALL_TENANTS_ID = '__all__';

const PUBLIC_PATHS = ['/login', '/logout', '/forgot', '/reset'];

export const handle: Handle = async ({ event, resolve }) => {
  const tenantCookie = event.cookies.get(TENANT_COOKIE);
  const tenantId = tenantCookie && tenantCookie.length > 0 ? tenantCookie : ALL_TENANTS_ID;
  event.locals.tenantId = tenantId;

  const path = event.url.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  // ── Demo-cookie identity (wins regardless of DATA_MODE) ────────────────
  // The login form sets DEMO_USER_COOKIE for any known demo account
  // (or any email in mock mode). When that cookie is present we hydrate
  // locals.user from the shared DEMO_LOGINS list — so the same demo
  // logins work whether or not Postgres is wired up. Auth pages still
  // render unauthenticated so /login isn't an infinite redirect.
  const demoEmail = event.cookies.get(DEMO_USER_COOKIE) ?? '';
  if (demoEmail && !isPublic) {
    const demo = findDemoLogin(demoEmail) ?? {
      ...DEFAULT_DEMO_LOGIN,
      email: demoEmail,
      name: demoEmail.split('@')[0] || DEFAULT_DEMO_LOGIN.name
    };
    event.locals.user = {
      id: 'u_' + demo.email.replace(/[^a-z0-9]/gi, '_'),
      email: demo.email,
      name: demo.name,
      role: demo.role,
      tenantId
    };
    return resolve(event);
  }

  // ── Mock mode (no Postgres, no demo cookie) ────────────────────────────
  if (!isPgMode()) {
    if (isPublic) return resolve(event);
    throw redirect(303, `/login?next=${encodeURIComponent(path)}`);
  }

  // ── Postgres mode: validate real session cookie ────────────────────────
  const token = event.cookies.get(SESSION_COOKIE) ?? '';
  const user = await validateSession(token);

  if (user) {
    event.locals.user = { ...user, tenantId };
  } else {
    event.locals.user = undefined;
    if (!isPublic) {
      throw redirect(303, `/login?next=${encodeURIComponent(path)}`);
    }
  }

  return resolve(event);
};
