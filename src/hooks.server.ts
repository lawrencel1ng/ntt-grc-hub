import type { Handle } from '@sveltejs/kit';

const TENANT_COOKIE = 'grc_tenant';
const ALL_TENANTS_ID = '__all__';

/**
 * Demo-grade auth: every request is automatically signed in as the
 * showcase user. Production would replace this with a real OIDC/session
 * handler; the rest of the app only consumes `event.locals.user`.
 *
 * The active tenant is read from a cookie set by /api/tenant. Empty or
 * missing cookie means "all tenants" (MSSP rollup view).
 */
export const handle: Handle = async ({ event, resolve }) => {
  const tenantCookie = event.cookies.get(TENANT_COOKIE);
  const tenantId = tenantCookie && tenantCookie.length > 0 ? tenantCookie : ALL_TENANTS_ID;

  event.locals.user = {
    id: 'u_demo',
    email: 'demo@ntt.com',
    name: 'Lawrence Khoo',
    role: 'admin',
    tenantId
  };
  event.locals.tenantId = tenantId;

  return resolve(event);
};
