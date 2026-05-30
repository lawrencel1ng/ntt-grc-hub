import type { Actions, PageServerLoad } from './$types';
import { isPgMode } from '$lib/server/pg';
import { createPasswordResetToken, writeAuditLog } from '$lib/server/auth';
import { sendMail, passwordResetHtml, passwordResetText } from '$lib/server/email';

// 3 reset requests per 15-minute window per IP
const MAX_ATTEMPTS = 3;
const WINDOW_MS = 15 * 60 * 1000;
interface RateEntry { count: number; windowStart: number }
const resetAttempts = new Map<string, RateEntry>();

function checkResetRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = resetAttempts.get(ip) ?? { count: 0, windowStart: now };
  if (now - entry.windowStart > WINDOW_MS) { entry.count = 0; entry.windowStart = now; }
  if (entry.count >= MAX_ATTEMPTS) return false;
  entry.count += 1;
  resetAttempts.set(ip, entry);
  return true;
}

export const load: PageServerLoad = async ({ url }) => {
  return { email: url.searchParams.get('email') ?? '' };
};

export const actions: Actions = {
  default: async ({ request, url, getClientAddress }) => {
    const data = await request.formData();
    const email = String(data.get('email') ?? '').trim().toLowerCase();
    const ip = getClientAddress();

    if (!checkResetRateLimit(ip)) {
      // Return success to avoid leaking rate-limit state, but don't do anything.
      return { success: true, email };
    }

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
        if (!sent) {
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
