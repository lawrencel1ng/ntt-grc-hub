// =====================================================================
//  /controls/[id] — Control detail. Loads the control + 30 most recent
//  test runs, real framework mappings from control.mappings, tests,
//  exceptions, and linked evidence items.
// =====================================================================

import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import {
  getControl, getControlTestRuns, getControlMappings, getControlTests,
  getControlExceptions, getFrameworks, getEvidence
} from '$lib/server/data';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

export const load: PageServerLoad = async ({ params, locals }) => {
  const control = await getControl(params.id);
  if (!control) throw error(404, 'Control not found');
  if (locals.user && control.tenantId !== locals.user.tenantId && locals.user.tenantId !== '__all__') {
    throw error(403, 'Access denied');
  }

  const [runs, mappings, tests, exceptions, frameworks, evidence] = await Promise.all([
    getControlTestRuns(control.id, 30),
    getControlMappings(control.id),
    getControlTests(control.id),
    getControlExceptions(control.id),
    getFrameworks(),
    getEvidence(control.tenantId, 12)
  ]);

  return { control, runs, mappings, tests, exceptions, frameworks, evidence };
};

const VALID_CONTROL_TYPES = ['technical', 'process', 'admin'] as const;
const VALID_MATURITIES = ['initial', 'developing', 'defined', 'managed', 'optimised'] as const;

export const actions: Actions = {
  updateControl: async ({ params, request, locals }) => {
    if (!locals.user) return fail(401, { editError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { editError: 'Requires Postgres mode' });

    const fd = await request.formData();
    const title = String(fd.get('title') ?? '').trim();
    const description = String(fd.get('description') ?? '').trim() || null;
    const type = String(fd.get('type') ?? '').trim();
    const frequency = String(fd.get('frequency') ?? '').trim();
    const maturity = String(fd.get('maturity') ?? '').trim();
    const automated = fd.get('automated') === 'true';
    const ownerEmail = String(fd.get('ownerEmail') ?? '').trim().toLowerCase() || null;

    if (!title) return fail(400, { editError: 'Title is required.' });
    if (title.length > 256) return fail(400, { editError: 'Title must be 256 characters or fewer.' });
    if (description && description.length > 2048) return fail(400, { editError: 'Description must be 2048 characters or fewer.' });
    if (!VALID_CONTROL_TYPES.includes(type as typeof VALID_CONTROL_TYPES[number])) return fail(400, { editError: 'Invalid control type.' });
    if (!VALID_MATURITIES.includes(maturity as typeof VALID_MATURITIES[number])) return fail(400, { editError: 'Invalid maturity level.' });
    if (frequency.length > 64) return fail(400, { editError: 'Frequency must be 64 characters or fewer.' });
    if (ownerEmail && ownerEmail.length > 256) return fail(400, { editError: 'Owner email must be 256 characters or fewer.' });

    const pool = getPool();

    // Resolve owner email → user id within the same tenant
    let ownerUserId: string | null = null;
    if (ownerEmail) {
      const userRow = await pool.query<{ id: string }>(
        `SELECT id FROM platform.users WHERE email = $1 AND tenant_id = $2 AND status = 'active' LIMIT 1`,
        [ownerEmail, locals.user.tenantId]
      );
      if (!userRow.rows.length) return fail(400, { editError: `No active user found with email "${ownerEmail}" in your tenant.` });
      ownerUserId = userRow.rows[0].id;
    }

    const { rowCount } = await pool.query(
      `UPDATE control.library
       SET title = $1, description = $2, type = $3::control.type,
           frequency = $4, maturity = $5::control.maturity, automated = $6,
           owner_user_id = COALESCE($7::uuid, owner_user_id)
       WHERE id = $8 AND tenant_id = $9`,
      [title, description, type, frequency, maturity, automated, ownerUserId, params.id, locals.user.tenantId]
    );
    if (!rowCount) return fail(404, { editError: 'Control not found or access denied.' });

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'control.updated',
      target: `control:${params.id}`,
      result: 'success',
      metadata: { title, type, maturity, ownerEmail }
    });

    return { editSuccess: true, ownerEmail: ownerEmail ?? undefined };
  },

  requestException: async ({ params, request, locals }) => {
    if (!locals.user) return fail(401, { excError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { excError: 'Requires Postgres mode' });

    const fd = await request.formData();
    const justification = String(fd.get('justification') ?? '').trim();
    const expiresAt = String(fd.get('expiresAt') ?? '').trim() || null;

    if (!justification) return fail(400, { excError: 'Justification is required.' });
    if (justification.length > 2048) return fail(400, { excError: 'Justification must be 2048 characters or fewer.' });

    const pool = getPool();
    const check = await pool.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM control.library WHERE id = $1 LIMIT 1`,
      [params.id]
    );
    if (!check.rows.length) return fail(404, { excError: 'Control not found.' });
    if (check.rows[0].tenant_id !== locals.user.tenantId) return fail(403, { excError: 'Access denied.' });

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO control.exceptions
         (tenant_id, control_id, requester_user_id, justification, granted, expires_at)
       VALUES ($1, $2, $3::uuid, $4, false, $5)
       RETURNING id::text`,
      [locals.user.tenantId, params.id, locals.user.id, justification, expiresAt]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'control.exception.requested',
      target: `control:${params.id}`,
      result: 'success',
      metadata: { exceptionId: rows[0].id }
    });

    return { excRequested: true };
  }
};
