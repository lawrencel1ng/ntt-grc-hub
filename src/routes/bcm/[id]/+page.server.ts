// =====================================================================
//  /bcm/[id] — BCM plan detail. 404 if not found.
// =====================================================================

import type { PageServerLoad, Actions } from './$types';
import { error, fail } from '@sveltejs/kit';
import {
  getBCMPlan, getBCMDependencies, getBCMTests, getBCMEscalationContacts, getRisks
} from '$lib/server/data';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

export const load: PageServerLoad = async ({ params, locals }) => {
  const plan = await getBCMPlan(params.id);
  if (!plan) throw error(404, `BCM plan ${params.id} not found`);
  if (locals.user && plan.tenantId !== locals.user.tenantId && locals.user.tenantId !== '__all__') {
    throw error(403, 'Access denied');
  }

  const [deps, tests, escalationContacts, linkedRisks] = await Promise.all([
    getBCMDependencies(plan.id),
    getBCMTests(plan.id),
    getBCMEscalationContacts(plan.id),
    getRisks(plan.tenantId, plan.businessService)
  ]);

  return { plan, deps, tests, escalationContacts, linkedRisks };
};

export const actions: Actions = {
  updateBCMPlan: async ({ params, request, locals }) => {
    if (!locals.user) return fail(401, { editError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { editError: 'Requires Postgres mode' });

    const fd = await request.formData();
    const name = String(fd.get('name') ?? '').trim();
    const businessService = String(fd.get('businessService') ?? '').trim();
    const rtoRaw = parseInt(String(fd.get('rtoMinutes') ?? ''), 10);
    const rpoRaw = parseInt(String(fd.get('rpoMinutes') ?? ''), 10);
    const description = String(fd.get('description') ?? '').trim() || null;
    const recoveryStrategy = String(fd.get('recoveryStrategy') ?? '').trim() || null;

    if (!name) return fail(400, { editError: 'Name is required.' });
    if (name.length > 256) return fail(400, { editError: 'Name must be 256 characters or fewer.' });
    if (businessService.length > 256) return fail(400, { editError: 'Business service must be 256 characters or fewer.' });
    if (isNaN(rtoRaw) || rtoRaw < 0) return fail(400, { editError: 'RTO must be a non-negative number.' });
    if (isNaN(rpoRaw) || rpoRaw < 0) return fail(400, { editError: 'RPO must be a non-negative number.' });
    if (description && description.length > 2048) return fail(400, { editError: 'Description must be 2048 characters or fewer.' });
    if (recoveryStrategy && recoveryStrategy.length > 4096) return fail(400, { editError: 'Recovery strategy must be 4096 characters or fewer.' });

    const pool = getPool();
    const { rowCount } = await pool.query(
      `UPDATE bcm.plans
       SET name = $1, business_service = $2, rto_minutes = $3, rpo_minutes = $4,
           description = $5, recovery_strategy = $6
       WHERE id = $7::uuid AND tenant_id = $8`,
      [name, businessService, rtoRaw, rpoRaw, description, recoveryStrategy, params.id, locals.user.tenantId]
    );
    if (!rowCount) return fail(404, { editError: 'BCM plan not found or access denied.' });

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'bcm.plan.updated',
      target: `bcm:${params.id}`,
      result: 'success',
      metadata: { name, rtoMinutes: rtoRaw, rpoMinutes: rpoRaw }
    });

    return { editSuccess: true };
  }
};
