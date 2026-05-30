// =====================================================================
//  /controls — Controls Library index. Tenant-scoped.
// =====================================================================

import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getControls, getRecentTestRuns, getFrameworks, getControlMappingsByTenant } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;
  const [controls, runs, frameworks, mappings] = await Promise.all([
    getControls(effective),
    getRecentTestRuns(effective, 200),
    getFrameworks(),
    getControlMappingsByTenant(effective)
  ]);
  return { controls, runs, frameworks, mappings, isAll: tenantId === ALL_TENANTS_ID };
};

const VALID_TYPES = ['technical', 'process', 'admin'] as const;
const VALID_MATURITIES = ['initial', 'developing', 'defined', 'managed', 'optimised'] as const;

export const actions: Actions = {
  createControl: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { createError: 'Not authenticated.' });
    if (!isPgMode()) return fail(400, { createError: 'Requires Postgres mode.' });

    const fd = await request.formData();
    const title = String(fd.get('title') ?? '').trim();
    const description = String(fd.get('description') ?? '').trim() || null;
    const type = String(fd.get('type') ?? 'technical').trim();
    const frequency = String(fd.get('frequency') ?? 'annual').trim();
    const maturity = String(fd.get('maturity') ?? 'initial').trim();
    const automated = fd.get('automated') === 'true';

    if (!title) return fail(400, { createError: 'Title is required.' });
    if (title.length > 256) return fail(400, { createError: 'Title must be 256 characters or fewer.' });
    if (description && description.length > 2048) return fail(400, { createError: 'Description must be 2048 characters or fewer.' });
    if (!VALID_TYPES.includes(type as typeof VALID_TYPES[number])) return fail(400, { createError: 'Invalid control type.' });
    if (!VALID_MATURITIES.includes(maturity as typeof VALID_MATURITIES[number])) return fail(400, { createError: 'Invalid maturity.' });
    if (frequency.length > 64) return fail(400, { createError: 'Frequency must be 64 characters or fewer.' });

    const tenantId = locals.user.tenantId;
    const pool = getPool();

    const { rows: countRows } = await pool.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM control.library WHERE tenant_id = $1', [tenantId]
    );
    const seq = parseInt(countRows[0].count, 10) + 1;
    const code = `CTL-${String(seq).padStart(4, '0')}`;
    const id = `ctl_${tenantId}_${String(seq).padStart(5, '0')}`;

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO control.library
         (id, tenant_id, code, title, description, type, frequency, maturity, automated)
       VALUES ($1, $2, $3, $4, $5, $6::control.type, $7, $8::control.maturity, $9)
       RETURNING id`,
      [id, tenantId, code, title, description, type, frequency, maturity, automated]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId,
      action: 'control.created',
      target: `control:${rows[0].id}`,
      result: 'success',
      metadata: { code, title }
    });

    return { created: true, controlId: rows[0].id, code };
  }
};
