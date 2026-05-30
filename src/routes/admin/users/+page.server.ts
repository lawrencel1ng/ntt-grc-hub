// =====================================================================
//  /admin/users — Users + RBAC matrix.
// =====================================================================

import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { randomBytes } from 'crypto';
import { getTenantSummaries, getUsers } from '$lib/server/data';
import { RBAC_MATRIX, CAPABILITIES } from '$lib/data/users';
import { createPasswordResetToken, writeAuditLog, hashPassword } from '$lib/server/auth';
import { sendMail, passwordResetHtml } from '$lib/server/email';
import { isPgMode, getPool } from '$lib/server/pg';
import type { Role } from '$lib/data/types';

const VALID_ROLES: Role[] = ['admin', 'risk-owner', 'control-owner', 'auditor', 'agent-operator', 'viewer'];

export const load: PageServerLoad = async () => {
  const [tenants, users] = await Promise.all([getTenantSummaries(), getUsers()]);
  return {
    tenants,
    users,
    rbac: RBAC_MATRIX,
    capabilities: CAPABILITIES as readonly string[]
  };
};

export const actions: Actions = {
  inviteUser: async ({ request, url, locals }) => {
    if (!locals.user) return fail(401, { inviteError: 'Not authenticated' });
    if (locals.user.role !== 'admin') return fail(403, { inviteError: 'Admin role required.' });
    if (!isPgMode()) return fail(400, { inviteError: 'User management requires Postgres mode.' });

    const data = await request.formData();
    const email = String(data.get('email') ?? '').trim().toLowerCase();
    const name = String(data.get('name') ?? '').trim();
    const role = String(data.get('role') ?? 'viewer') as Role;
    const tenantId = locals.user.tenantId;

    if (!email || !name) return fail(400, { inviteError: 'Email and name are required.' });
    if (!VALID_ROLES.includes(role)) return fail(400, { inviteError: 'Invalid role.' });

    const pool = getPool();

    // Check duplicate email
    const existing = await pool.query(`SELECT id FROM platform.users WHERE email = $1`, [email]);
    if (existing.rows.length) return fail(409, { inviteError: 'A user with that email already exists.' });

    // Create user with a random placeholder password (they must use the reset link)
    const placeholderHash = await hashPassword(randomBytes(32).toString('hex'));
    await pool.query(
      `INSERT INTO platform.users (tenant_id, email, name, role, status, password_hash)
       VALUES ($1, $2, $3, $4, 'invited', $5)`,
      [tenantId, email, name, role, placeholderHash]
    );

    // Generate password-reset token so they can set their own password
    const result = await createPasswordResetToken(email, url.origin);
    if (result) {
      const sent = await sendMail({
        to: result.userEmail,
        subject: `You've been invited to NTT GRC Hub`,
        text: `Hi ${name},\n\nYou've been invited to NTT GRC Hub. Set your password via the link below (expires in 30 minutes):\n\n${result.resetUrl}\n\nIf you did not expect this invitation, you can ignore this email.`,
        html: passwordResetHtml(result.resetUrl, 30).replace('Reset your NTT GRC Hub password', `You've been invited to NTT GRC Hub`).replace('You requested a password reset.', `${name}, you've been invited by ${locals.user.email}.`)
      });
      if (!sent) console.info(`[invite] Invite URL for ${email}: ${result.resetUrl}`);
    }

    writeAuditLog({ userId: locals.user.id, actorEmail: locals.user.email, tenantId, action: 'user.invited', target: `user:${email}`, result: 'success' });
    return { inviteSuccess: true, invitedEmail: email };
  }
};
