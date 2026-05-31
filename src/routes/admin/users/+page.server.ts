// =====================================================================
//  /admin/users — Users + RBAC matrix.
// =====================================================================

import type { PageServerLoad, Actions } from './$types';
import { fail, error } from '@sveltejs/kit';
import { randomBytes } from 'crypto';
import { getTenantSummaries, getUsers } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';
import { RBAC_MATRIX, CAPABILITIES } from '$lib/data/users';
import { createPasswordResetToken, writeAuditLog, hashPassword } from '$lib/server/auth';
import { sendMail, passwordResetHtml } from '$lib/server/email';
import { isPgMode, getPool } from '$lib/server/pg';
import type { Role } from '$lib/data/types';

const VALID_ROLES: Role[] = ['admin', 'risk-owner', 'control-owner', 'auditor', 'agent-operator', 'viewer'];

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw error(401, 'Not authenticated');
  if (locals.user.role !== 'admin') throw error(403, 'Admin role required');

  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;
  const [tenants, users] = await Promise.all([getTenantSummaries(), getUsers(effective)]);
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
    if (email.length > 254) return fail(400, { inviteError: 'Email must be 254 characters or fewer.' });
    if (name.length > 128) return fail(400, { inviteError: 'Name must be 128 characters or fewer.' });
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
      if (!sent && process.env.NODE_ENV !== 'production') console.info(`[invite] Invite URL for ${email}: ${result.resetUrl}`);
    }

    writeAuditLog({ userId: locals.user.id, actorEmail: locals.user.email, tenantId, action: 'user.invited', target: `user:${email}`, result: 'success' });
    return { inviteSuccess: true, invitedEmail: email };
  },

  deactivateUser: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { deactivateError: 'Not authenticated.' });
    if (locals.user.role !== 'admin') return fail(403, { deactivateError: 'Admin role required.' });
    if (!isPgMode()) return fail(400, { deactivateError: 'User management requires Postgres mode.' });

    const data = await request.formData();
    const targetUserId = String(data.get('userId') ?? '').trim();
    if (!targetUserId) return fail(400, { deactivateError: 'User ID required.' });

    // Prevent self-deactivation
    if (targetUserId === locals.user.id) return fail(400, { deactivateError: 'You cannot deactivate your own account.' });

    const pool = getPool();

    // Verify target user is in the same tenant (unless platform admin viewing all)
    const { rows } = await pool.query<{ id: string; email: string; tenant_id: string; status: string }>(
      `SELECT id, email, tenant_id, status::text FROM platform.users WHERE id = $1::uuid LIMIT 1`,
      [targetUserId]
    );
    if (!rows.length) return fail(404, { deactivateError: 'User not found.' });
    if (rows[0].tenant_id !== locals.user.tenantId && locals.user.tenantId !== '__all__') {
      return fail(403, { deactivateError: 'Access denied.' });
    }
    if (rows[0].status === 'disabled') return fail(409, { deactivateError: 'User is already disabled.' });

    await pool.query(
      `UPDATE platform.users SET status = 'disabled' WHERE id = $1`,
      [targetUserId]
    );

    // Revoke all active sessions for the deactivated user
    await pool.query(
      `DELETE FROM platform.sessions WHERE user_id = $1`,
      [targetUserId]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'user.deactivated',
      target: `user:${rows[0].email}`,
      result: 'success',
      metadata: { targetUserId, targetEmail: rows[0].email }
    });

    return { deactivateSuccess: true, deactivatedEmail: rows[0].email };
  },

  reactivateUser: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { reactivateError: 'Not authenticated.' });
    if (locals.user.role !== 'admin') return fail(403, { reactivateError: 'Admin role required.' });
    if (!isPgMode()) return fail(400, { reactivateError: 'User management requires Postgres mode.' });

    const data = await request.formData();
    const targetUserId = String(data.get('userId') ?? '').trim();
    if (!targetUserId) return fail(400, { reactivateError: 'User ID required.' });

    const pool = getPool();

    const { rows } = await pool.query<{ id: string; email: string; tenant_id: string; status: string }>(
      `SELECT id, email, tenant_id, status::text FROM platform.users WHERE id = $1::uuid LIMIT 1`,
      [targetUserId]
    );
    if (!rows.length) return fail(404, { reactivateError: 'User not found.' });
    if (rows[0].tenant_id !== locals.user.tenantId && locals.user.tenantId !== '__all__') {
      return fail(403, { reactivateError: 'Access denied.' });
    }

    await pool.query(
      `UPDATE platform.users SET status = 'active' WHERE id = $1`,
      [targetUserId]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'user.reactivated',
      target: `user:${rows[0].email}`,
      result: 'success',
      metadata: { targetUserId, targetEmail: rows[0].email }
    });

    return { reactivateSuccess: true, reactivatedEmail: rows[0].email };
  },

  changeRole: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { roleError: 'Not authenticated.' });
    if (locals.user.role !== 'admin') return fail(403, { roleError: 'Admin role required.' });
    if (!isPgMode()) return fail(400, { roleError: 'User management requires Postgres mode.' });

    const data = await request.formData();
    const targetUserId = String(data.get('userId') ?? '').trim();
    const newRole = String(data.get('role') ?? '').trim() as Role;

    if (!targetUserId) return fail(400, { roleError: 'User ID required.' });
    if (!VALID_ROLES.includes(newRole)) return fail(400, { roleError: 'Invalid role.' });
    if (targetUserId === locals.user.id) return fail(400, { roleError: 'Cannot change your own role.' });

    const pool = getPool();
    const { rows } = await pool.query<{ id: string; email: string; tenant_id: string; role: string }>(
      `SELECT id, email, tenant_id, role::text FROM platform.users WHERE id = $1::uuid LIMIT 1`,
      [targetUserId]
    );
    if (!rows.length) return fail(404, { roleError: 'User not found.' });
    if (rows[0].tenant_id !== locals.user.tenantId && locals.user.tenantId !== '__all__') {
      return fail(403, { roleError: 'Access denied.' });
    }
    if (rows[0].role === newRole) return fail(409, { roleError: `User is already ${newRole}.` });

    await pool.query(
      `UPDATE platform.users SET role = $1 WHERE id = $2`,
      [newRole, targetUserId]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'user.role.changed',
      target: `user:${rows[0].email}`,
      result: 'success',
      metadata: { targetUserId, targetEmail: rows[0].email, oldRole: rows[0].role, newRole }
    });

    return { roleChanged: true, targetEmail: rows[0].email, newRole };
  }
};
