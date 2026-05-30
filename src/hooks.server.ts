// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { validateSession, SESSION_COOKIE } from '$lib/server/auth';
import { isPgMode } from '$lib/server/pg';
import { DEMO_USER_COOKIE, DEFAULT_DEMO_LOGIN, findDemoLogin } from '$lib/data/demo-logins';

const TENANT_COOKIE = 'grc_tenant';
const ALL_TENANTS_ID = '__all__';

const PUBLIC_PATHS = ['/login', '/logout', '/forgot', '/reset', '/api/health'];

function addSecurityHeaders(response: Response): Response {
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // CSP: allow same-origin scripts/styles; fonts from Google; images from any HTTPS.
  // upgrade-insecure-requests is omitted here so dev HTTP still works.
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",      // SvelteKit injects inline scripts
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  );
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  return response;
}

function withRequestId(response: Response, requestId: string): Response {
  response.headers.set('X-Request-ID', requestId);
  return response;
}

export const handle: Handle = async ({ event, resolve }) => {
  const requestId = crypto.randomUUID();
  event.locals.requestId = requestId;
  const tenantCookie = event.cookies.get(TENANT_COOKIE);
  const tenantId = tenantCookie && tenantCookie.length > 0 ? tenantCookie : ALL_TENANTS_ID;
  event.locals.tenantId = tenantId;

  const path = event.url.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  // ── Demo-cookie identity (mock mode only) ─────────────────────────────
  // In pg mode all authentication goes through the real session cookie —
  // the demo cookie is cleared immediately so it cannot be used to bypass
  // the session check. In mock mode (no Postgres) any recognised email in
  // the demo cookie is accepted since there is no DB to validate against.
  const demoEmail = event.cookies.get(DEMO_USER_COOKIE) ?? '';
  if (demoEmail) {
    if (isPgMode()) {
      // Always clear the demo cookie in pg mode — real sessions only.
      event.cookies.delete(DEMO_USER_COOKIE, { path: '/' });
    } else if (!isPublic) {
      const demo = findDemoLogin(demoEmail);
      if (demo) {
        event.locals.user = {
          id: 'u_demo_' + demo.email.replace(/[^a-z0-9]/gi, '_'),
          email: demo.email,
          name: demo.name,
          role: demo.role,
          tenantId
        };
        return withRequestId(addSecurityHeaders(await resolve(event)), requestId);
      }
      event.locals.user = {
        id: 'u_' + demoEmail.replace(/[^a-z0-9]/gi, '_'),
        email: demoEmail,
        name: demoEmail.split('@')[0] || DEFAULT_DEMO_LOGIN.name,
        role: DEFAULT_DEMO_LOGIN.role,
        tenantId
      };
      return withRequestId(addSecurityHeaders(await resolve(event)), requestId);
    }
  }

  // ── Mock mode (no Postgres, no demo cookie) ────────────────────────────
  if (!isPgMode()) {
    if (isPublic) return withRequestId(addSecurityHeaders(await resolve(event)), requestId);
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

  return withRequestId(addSecurityHeaders(await resolve(event)), requestId);
};
