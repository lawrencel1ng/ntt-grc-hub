import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';

const TENANT_COOKIE = 'grc_tenant';
const ALL_TENANTS_ID = '__all__';

/**
 * Sets the active-tenant cookie. The TenantSwitcher posts here when the
 * user picks a new tenant; the hook reads the cookie on the next
 * request to scope every loader.
 *
 * Authorization: admin users may switch to any tenant. All other roles
 * may only view their own tenant (or __all__ which is scoped by the hook
 * to their tenantId anyway).
 */
export const POST: RequestHandler = async ({ request, cookies, locals }) => {
  if (!locals.user) throw error(401, 'Not authenticated');

  let tenantId = '';
  try {
    const body = await request.json();
    tenantId = typeof body?.tenantId === 'string' ? body.tenantId : '';
  } catch {
    try { tenantId = (await request.text()).trim(); } catch { /* noop */ }
  }

  const user = locals.user;
  if (user.role !== 'admin') {
    // Non-admin users may only view their own tenant — never the cross-tenant sentinel.
    if (tenantId !== user.tenantId) {
      throw error(403, 'You may only view your own tenant.');
    }
  }

  cookies.set(TENANT_COOKIE, tenantId, {
    path: '/',
    httpOnly: false,   // intentionally readable by client for SSR hydration
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30
  });
  return json({ ok: true, tenantId });
};
