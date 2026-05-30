// src/routes/logout/+page.server.ts
import type { Actions } from './$types';
import { redirect } from '@sveltejs/kit';
import { destroySession, SESSION_COOKIE, writeAuditLog } from '$lib/server/auth';
import { isPgMode } from '$lib/server/pg';
import { DEMO_USER_COOKIE } from '$lib/data/demo-logins';

const TENANT_COOKIE = 'grc_tenant';

export const actions: Actions = {
  default: async ({ cookies, locals, request, getClientAddress }) => {
    if (isPgMode()) {
      const token = cookies.get(SESSION_COOKIE) ?? '';
      const ip = getClientAddress();
      const ua = request.headers.get('user-agent') ?? '';
      writeAuditLog({
        userId: locals.user?.id,
        actorEmail: locals.user?.email,
        tenantId: locals.user?.tenantId,
        action: 'logout',
        ip,
        ua,
        result: 'success'
      });
      await destroySession(token);
    }
    cookies.delete(SESSION_COOKIE, { path: '/' });
    cookies.delete(DEMO_USER_COOKIE, { path: '/' });
    cookies.delete(TENANT_COOKIE, { path: '/' });
    throw redirect(303, '/login');
  }
};
