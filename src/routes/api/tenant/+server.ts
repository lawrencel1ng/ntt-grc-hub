import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';

const TENANT_COOKIE = 'grc_tenant';

/**
 * Sets the active-tenant cookie. The TenantSwitcher posts here when the
 * user picks a new tenant; the hook reads the cookie on the next
 * request to scope every loader.
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
  let tenantId = '';
  try {
    const body = await request.json();
    tenantId = typeof body?.tenantId === 'string' ? body.tenantId : '';
  } catch {
    // Body wasn't JSON — try raw text.
    try { tenantId = (await request.text()).trim(); } catch { /* noop */ }
  }
  cookies.set(TENANT_COOKIE, tenantId, {
    path: '/',
    httpOnly: false,    // demo: client can read for SSR hydration parity
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30
  });
  return json({ ok: true, tenantId });
};
