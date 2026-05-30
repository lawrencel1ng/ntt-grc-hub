// =====================================================================
//  /bcm — Business Continuity Management (ISO 22301 · MAS Notice 657 · DORA).
// =====================================================================

import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import {
  getBCMPlans, getBCMDependencies, getBCMTests
} from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;

  const plans = await getBCMPlans(effective);
  const enriched = await Promise.all(plans.map(async (p) => {
    const [deps, tests] = await Promise.all([
      getBCMDependencies(p.id),
      getBCMTests(p.id)
    ]);
    return { plan: p, deps, tests };
  }));

  return {
    rows: enriched,
    isAll: tenantId === ALL_TENANTS_ID,
    effectiveTenantId: effective
  };
};

export const actions: Actions = {
  createBCMPlan: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { createError: 'Not authenticated.' });
    if (!isPgMode()) return fail(400, { createError: 'Requires Postgres mode.' });

    const fd = await request.formData();
    const name = String(fd.get('name') ?? '').trim();
    const businessService = String(fd.get('businessService') ?? '').trim();
    const rtoRaw = parseInt(String(fd.get('rtoMinutes') ?? '240'), 10);
    const rpoRaw = parseInt(String(fd.get('rpoMinutes') ?? '60'), 10);
    const description = String(fd.get('description') ?? '').trim() || null;

    if (!name) return fail(400, { createError: 'Name is required.' });
    if (name.length > 256) return fail(400, { createError: 'Name must be 256 characters or fewer.' });
    if (!businessService) return fail(400, { createError: 'Business service is required.' });
    if (businessService.length > 256) return fail(400, { createError: 'Business service must be 256 characters or fewer.' });
    if (isNaN(rtoRaw) || rtoRaw < 0) return fail(400, { createError: 'RTO must be a non-negative number.' });
    if (isNaN(rpoRaw) || rpoRaw < 0) return fail(400, { createError: 'RPO must be a non-negative number.' });
    if (description && description.length > 2048) return fail(400, { createError: 'Description must be 2048 characters or fewer.' });

    const tenantId = locals.user.tenantId;
    const pool = getPool();

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO bcm.plans (tenant_id, name, business_service, rto_minutes, rpo_minutes, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id::text`,
      [tenantId, name, businessService, rtoRaw, rpoRaw, description]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId,
      action: 'bcm.plan.created',
      target: `bcm:${rows[0].id}`,
      result: 'success',
      metadata: { name, businessService }
    });

    return { created: true, planId: rows[0].id };
  }
};
