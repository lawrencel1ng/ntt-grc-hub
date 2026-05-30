// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { validateSession, SESSION_COOKIE } from '$lib/server/auth';
import { isPgMode } from '$lib/server/pg';
import { DEMO_USER_COOKIE, DEFAULT_DEMO_LOGIN, findDemoLogin } from '$lib/data/demo-logins';

const TENANT_COOKIE = 'grc_tenant';
const ALL_TENANTS_ID = '__all__';

const PUBLIC_PATHS = ['/login', '/logout', '/forgot', '/reset'];

function addSecurityHeaders(response: Response): Response {
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  return response;
}

export const handle: Handle = async ({ event, resolve }) => {
  const tenantCookie = event.cookies.get(TENANT_COOKIE);
  const tenantId = tenantCookie && tenantCookie.length > 0 ? tenantCookie : ALL_TENANTS_ID;
  event.locals.tenantId = tenantId;

  const path = event.url.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  // ── Demo-cookie identity ───────────────────────────────────────────────
  // In pg mode only known demo accounts (explicit email+password pairs) are
  // accepted via this cookie path; unrecognised cookies fall through to real
  // session validation below. In mock mode any email stored in the cookie is
  // accepted (there is no Postgres to validate against).
  const demoEmail = event.cookies.get(DEMO_USER_COOKIE) ?? '';
  if (demoEmail && !isPublic) {
    const demo = findDemoLogin(demoEmail);
    if (demo) {
      event.locals.user = {
        id: 'u_demo_' + demo.email.replace(/[^a-z0-9]/gi, '_'),
        email: demo.email,
        name: demo.name,
        role: demo.role,
        tenantId
      };
      return addSecurityHeaders(await resolve(event));
    }
    if (!isPgMode()) {
      event.locals.user = {
        id: 'u_' + demoEmail.replace(/[^a-z0-9]/gi, '_'),
        email: demoEmail,
        name: demoEmail.split('@')[0] || DEFAULT_DEMO_LOGIN.name,
        role: DEFAULT_DEMO_LOGIN.role,
        tenantId
      };
      return addSecurityHeaders(await resolve(event));
    }
    // pg mode with an unrecognised demo cookie — clear it and validate the
    // real session cookie below.
    event.cookies.delete(DEMO_USER_COOKIE, { path: '/' });
  }

  // ── Mock mode (no Postgres, no demo cookie) ────────────────────────────
  if (!isPgMode()) {
    if (isPublic) return addSecurityHeaders(await resolve(event));
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

  return addSecurityHeaders(await resolve(event));
};
