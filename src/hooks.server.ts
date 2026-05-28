// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { validateSession, SESSION_COOKIE } from '$lib/server/auth';
import { isPgMode } from '$lib/server/pg';

const TENANT_COOKIE = 'grc_tenant';
const ALL_TENANTS_ID = '__all__';

const PUBLIC_PATHS = ['/login', '/logout'];

export const handle: Handle = async ({ event, resolve }) => {
  const tenantCookie = event.cookies.get(TENANT_COOKIE);
  const tenantId = tenantCookie && tenantCookie.length > 0 ? tenantCookie : ALL_TENANTS_ID;
  event.locals.tenantId = tenantId;

  // In mock mode keep demo autologin so the app works without Postgres
  if (!isPgMode()) {
    event.locals.user = {
      id: 'u_demo',
      email: 'demo@ntt.com',
      name: 'Lawrence Khoo',
      role: 'admin',
      tenantId
    };
    return resolve(event);
  }

  // Postgres mode: validate session cookie
  const token = event.cookies.get(SESSION_COOKIE) ?? '';
  const user = await validateSession(token);

  if (user) {
    event.locals.user = { ...user, tenantId };
  } else {
    event.locals.user = undefined;
    const path = event.url.pathname;
    if (!PUBLIC_PATHS.some((p) => path.startsWith(p))) {
      throw redirect(303, `/login?next=${encodeURIComponent(path)}`);
    }
  }

  return resolve(event);
};
