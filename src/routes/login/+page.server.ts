// src/routes/login/+page.server.ts
import type { Actions, PageServerLoad } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { verifyCredentials, createSession, SESSION_COOKIE, SESSION_TTL_DAYS } from '$lib/server/auth';
import { isPgMode } from '$lib/server/pg';

export const load: PageServerLoad = async ({ locals, url }) => {
  // Already logged in — skip login page
  if (locals.user) throw redirect(303, url.searchParams.get('next') ?? '/');
  return { next: url.searchParams.get('next') ?? '/' };
};

export const actions: Actions = {
  default: async ({ request, cookies, getClientAddress }) => {
    // Demo mode: accept any credentials
    if (!isPgMode()) throw redirect(303, '/');

    const data = await request.formData();
    const email = String(data.get('email') ?? '');
    const password = String(data.get('password') ?? '');

    if (!email || !password) {
      return fail(400, { error: 'Email and password are required.' });
    }

    const user = await verifyCredentials(email, password);
    if (!user) {
      return fail(401, { error: 'Invalid email or password.' });
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

    throw redirect(303, String(data.get('next') ?? '/'));
  }
};
