import type { Actions, PageServerLoad } from './$types';
import { isPgMode, getPool } from '$lib/server/pg';
import { createPasswordResetToken, writeAuditLog } from '$lib/server/auth';
import { sendMail, passwordResetHtml, passwordResetText } from '$lib/server/email';

// 3 reset requests per 15-minute window per IP — DB-backed for multi-instance safety.
const MAX_RESET_ATTEMPTS = 3;
const RESET_WINDOW_MINUTES = 15;

async function checkResetRateLimit(ip: string): Promise<boolean> {
  if (!isPgMode()) return true;
  try {
    const pool = getPool();
    const { rows } = await pool.query<{ cnt: number }>(
      `SELECT COUNT(*)::int AS cnt FROM platform.login_attempts
       WHERE ip_address = $1::inet
         AND email LIKE 'reset:%'
         AND attempted_at > now() - interval '${RESET_WINDOW_MINUTES} minutes'`,
      [ip]
    );
    return (rows[0]?.cnt ?? 0) < MAX_RESET_ATTEMPTS;
  } catch {
    return true;
  }
}

async function recordResetAttempt(ip: string, email: string): Promise<void> {
  if (!isPgMode()) return;
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO platform.login_attempts (ip_address, email) VALUES ($1::inet, $2)`,
      [ip, `reset:${email}`]
    );
  } catch { /* ignore */ }
}

export const load: PageServerLoad = async ({ url }) => {
  return { email: url.searchParams.get('email') ?? '' };
};

export const actions: Actions = {
  default: async ({ request, url, getClientAddress }) => {
    const data = await request.formData();
    const email = String(data.get('email') ?? '').trim().toLowerCase();
    const ip = getClientAddress();

    if (!(await checkResetRateLimit(ip))) {
      // Return success to avoid leaking rate-limit state, but don't do anything.
      return { success: true, email };
    }

    await recordResetAttempt(ip, email);

    if (isPgMode() && email) {
      const baseUrl = url.origin;
      const result = await createPasswordResetToken(email, baseUrl);
      const ua = request.headers.get('user-agent') ?? '';
      if (result) {
        const sent = await sendMail({
          to: result.userEmail,
          subject: 'Reset your NTT GRC Hub password',
          text: passwordResetText(result.resetUrl),
          html: passwordResetHtml(result.resetUrl)
        });
        if (!sent && process.env.NODE_ENV !== 'production') {
          console.info(`[password-reset] Reset URL for ${result.userEmail}: ${result.resetUrl}`);
        }
        writeAuditLog({ actorEmail: email, action: 'password_reset.requested', target: email, ip, ua, result: 'success' });
      } else {
        // User not found — log silently to prevent email enumeration
        writeAuditLog({ actorEmail: email, action: 'password_reset.not_found', target: email, ip, ua, result: 'failure' });
      }
    }

    // Always return success to prevent email enumeration.
    return { success: true, email };
  }
};
