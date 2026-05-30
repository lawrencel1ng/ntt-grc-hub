import type { Actions, PageServerLoad } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { validatePasswordResetToken, consumePasswordResetToken, writeAuditLog } from '$lib/server/auth';
import { isPgMode } from '$lib/server/pg';

export const load: PageServerLoad = async ({ url }) => {
  const token = url.searchParams.get('token') ?? '';
  if (!token) throw redirect(303, '/forgot');

  if (isPgMode()) {
    const valid = await validatePasswordResetToken(token);
    if (!valid) {
      return { token, invalid: true, email: '' };
    }
    return { token, invalid: false, email: valid.email };
  }

  // Mock mode: reset flow not available without a database
  return { token, invalid: true, email: '' };
};

export const actions: Actions = {
  default: async ({ request, url, getClientAddress }) => {
    const data = await request.formData();
    const token = String(data.get('token') ?? '');
    const password = String(data.get('password') ?? '');
    const confirm = String(data.get('confirm') ?? '');

    if (!token) return fail(400, { error: 'Missing reset token.' });
    if (!password || password.length < 10) {
      return fail(400, { error: 'Password must be at least 10 characters.', token });
    }
    if (password !== confirm) {
      return fail(400, { error: 'Passwords do not match.', token });
    }

    const ip = getClientAddress();
    const ua = request.headers.get('user-agent') ?? '';

    const ok = await consumePasswordResetToken(token, password);
    if (!ok) {
      writeAuditLog({ action: 'password_reset.token_invalid', ip, ua, result: 'failure' });
      return fail(400, { error: 'Reset link is invalid or has expired. Please request a new one.', token });
    }

    writeAuditLog({ action: 'password_reset.completed', ip, ua, result: 'success' });
    throw redirect(303, '/login?reset=1');
  }
};
