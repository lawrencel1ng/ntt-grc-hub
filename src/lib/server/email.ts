import { env } from '$env/dynamic/private';
import nodemailer from 'nodemailer';

interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

function createTransport() {
  const host = env.SMTP_HOST;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port: Number(env.SMTP_PORT ?? 587),
    secure: env.SMTP_SECURE === 'true',
    auth: env.SMTP_USER
      ? { user: env.SMTP_USER, pass: env.SMTP_PASS ?? '' }
      : undefined
  });
}

/**
 * Send an email. Returns true on success; false if SMTP is not configured
 * or the send fails (caller should fall back to logging the URL).
 */
export async function sendMail(opts: MailOptions): Promise<boolean> {
  const transport = createTransport();
  if (!transport) return false;
  try {
    await transport.sendMail({
      from: env.EMAIL_FROM ?? `"NTT GRC Hub" <noreply@${env.SMTP_HOST}>`,
      ...opts
    });
    return true;
  } catch (e) {
    console.warn('[email] send failed:', (e as Error).message);
    return false;
  }
}

export function passwordResetHtml(resetUrl: string, expiryMinutes = 30): string {
  return `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1e293b">
  <h2 style="margin-bottom:8px">Reset your NTT GRC Hub password</h2>
  <p>You requested a password reset. Click the button below to set a new password.
     This link expires in <strong>${expiryMinutes} minutes</strong> and can only be used once.</p>
  <p style="margin:24px 0">
    <a href="${resetUrl}"
       style="background:#6d28d9;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
      Reset password
    </a>
  </p>
  <p style="font-size:13px;color:#64748b">Or copy this link into your browser:</p>
  <p style="font-size:12px;word-break:break-all;color:#6d28d9">${resetUrl}</p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
  <p style="font-size:11px;color:#94a3b8">
    If you did not request this, you can safely ignore this email.
    All password-reset events are written to your tenant's tamper-evident audit log.
  </p>
</body>
</html>`;
}

export function passwordResetText(resetUrl: string, expiryMinutes = 30): string {
  return `Reset your NTT GRC Hub password\n\nClick the link below to set a new password (expires in ${expiryMinutes} minutes):\n\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`;
}
