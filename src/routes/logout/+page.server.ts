// src/routes/logout/+page.server.ts
import type { Actions } from './$types';
import { redirect } from '@sveltejs/kit';
import { destroySession, SESSION_COOKIE } from '$lib/server/auth';
import { isPgMode } from '$lib/server/pg';

export const actions: Actions = {
  default: async ({ cookies }) => {
    if (isPgMode()) {
      const token = cookies.get(SESSION_COOKIE) ?? '';
      await destroySession(token);
    }
    cookies.delete(SESSION_COOKIE, { path: '/' });
    throw redirect(303, '/login');
  }
};
