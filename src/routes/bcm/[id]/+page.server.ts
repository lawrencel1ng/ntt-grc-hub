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

const VALID_DEP_KINDS = ['people', 'tech', 'site', 'vendor'] as const;
const VALID_CRITICALITIES = ['critical', 'high', 'medium', 'low'] as const;
const VALID_TEST_RESULTS = ['pass', 'partial', 'fail'] as const;
const VALID_CONTACT_ROLES = ['incident-commander', 'technical-lead', 'communications', 'executive', 'vendor', 'regulator'] as const;

export const actions: Actions = {
  addDependency: async ({ params, request, locals }) => {
    if (!locals.user) return fail(401, { depError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { depError: 'Requires Postgres mode' });

    const fd = await request.formData();
    const dependencyKind = String(fd.get('dependencyKind') ?? '').trim();
    const name = String(fd.get('name') ?? '').trim();
    const criticality = String(fd.get('criticality') ?? '').trim();
    const downtimeToleranceHours = parseInt(String(fd.get('downtimeToleranceHours') ?? ''), 10);

    if (!VALID_DEP_KINDS.includes(dependencyKind as typeof VALID_DEP_KINDS[number])) return fail(400, { depError: 'Invalid dependency kind.' });
    if (!name || name.length > 256) return fail(400, { depError: 'Name is required (max 256 chars).' });
    if (!VALID_CRITICALITIES.includes(criticality as typeof VALID_CRITICALITIES[number])) return fail(400, { depError: 'Invalid criticality.' });
    if (isNaN(downtimeToleranceHours) || downtimeToleranceHours < 0 || downtimeToleranceHours > 8760) {
      return fail(400, { depError: 'Downtime tolerance must be 0–8760 hours.' });
    }

    const pool = getPool();
    const check = await pool.query<{ id: string }>(
      `SELECT id FROM bcm.plans WHERE id = $1::uuid AND tenant_id = $2 LIMIT 1`,
      [params.id, locals.user.tenantId]
    );
    if (!check.rows.length) return fail(404, { depError: 'BCM plan not found or access denied.' });

    await pool.query(
      `INSERT INTO bcm.bias (tenant_id, plan_id, dependency_kind, name, criticality, downtime_tolerance_hours)
       VALUES ($1, $2::uuid, $3, $4, $5::vendor.criticality, $6)`,
      [locals.user.tenantId, params.id, dependencyKind, name, criticality, downtimeToleranceHours]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'bcm.dependency.added',
      target: `bcm:${params.id}`,
      result: 'success',
      metadata: { dependencyKind, name, criticality, downtimeToleranceHours }
    });

    return { depAdded: true };
  },

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

    const ownerEmail = String(fd.get('ownerEmail') ?? '').trim().toLowerCase() || null;
    if (ownerEmail && ownerEmail.length > 256) return fail(400, { editError: 'Owner email must be 256 characters or fewer.' });

    const pool = getPool();

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
      `UPDATE bcm.plans
       SET name = $1, business_service = $2, rto_minutes = $3, rpo_minutes = $4,
           description = $5, recovery_strategy = $6,
           owner_user_id = COALESCE($7::uuid, owner_user_id)
       WHERE id = $8::uuid AND tenant_id = $9`,
      [name, businessService, rtoRaw, rpoRaw, description, recoveryStrategy, ownerUserId, params.id, locals.user.tenantId]
    );
    if (!rowCount) return fail(404, { editError: 'BCM plan not found or access denied.' });

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'bcm.plan.updated',
      target: `bcm:${params.id}`,
      result: 'success',
      metadata: { name, rtoMinutes: rtoRaw, rpoMinutes: rpoRaw, ownerEmail }
    });

    return { editSuccess: true, ownerEmail: ownerEmail ?? undefined };
  },

  recordTestResult: async ({ params, request, locals }) => {
    if (!locals.user) return fail(401, { testError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { testError: 'Requires Postgres mode' });

    const fd = await request.formData();
    const testId = String(fd.get('testId') ?? '').trim();
    const result = String(fd.get('result') ?? '').trim();
    const lessonsMd = String(fd.get('lessonsMd') ?? '').trim() || null;

    if (!testId) return fail(400, { testError: 'Test ID is required.' });
    if (!VALID_TEST_RESULTS.includes(result as typeof VALID_TEST_RESULTS[number])) {
      return fail(400, { testError: 'Result must be pass, partial, or fail.' });
    }
    if (lessonsMd && lessonsMd.length > 4096) {
      return fail(400, { testError: 'Lessons must be 4096 characters or fewer.' });
    }

    const pool = getPool();

    const { rowCount } = await pool.query(
      `UPDATE bcm.tests
       SET result = $1::bcm.test_result, lessons_md = COALESCE($2, lessons_md)
       WHERE id = $3::uuid
         AND plan_id = $4::uuid
         AND tenant_id = $5`,
      [result, lessonsMd, testId, params.id, locals.user.tenantId]
    );
    if (!rowCount) return fail(404, { testError: 'Test not found or access denied.' });

    await pool.query(
      `UPDATE bcm.plans SET last_tested_at = now()
       WHERE id = $1::uuid AND tenant_id = $2`,
      [params.id, locals.user.tenantId]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'bcm.test.result.recorded',
      target: `bcm:${params.id}`,
      result: 'success',
      metadata: { testId, result }
    });

    return { testRecorded: true, testId, result };
  },

  addEscalationContact: async ({ params, request, locals }) => {
    if (!locals.user) return fail(401, { contactError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { contactError: 'Requires Postgres mode' });

    const fd = await request.formData();
    const name = String(fd.get('name') ?? '').trim();
    const role = String(fd.get('role') ?? '').trim();
    const email = String(fd.get('email') ?? '').trim() || null;
    const phone = String(fd.get('phone') ?? '').trim() || null;

    if (!name || name.length > 128) return fail(400, { contactError: 'Name is required (max 128 chars).' });
    if (!VALID_CONTACT_ROLES.includes(role as typeof VALID_CONTACT_ROLES[number])) {
      return fail(400, { contactError: 'Invalid contact role.' });
    }
    if (email && (email.length > 254 || !email.includes('@'))) {
      return fail(400, { contactError: 'Invalid email address.' });
    }
    if (phone && phone.length > 32) return fail(400, { contactError: 'Phone must be 32 characters or fewer.' });

    const pool = getPool();
    const check = await pool.query<{ id: string }>(
      `SELECT id FROM bcm.plans WHERE id = $1::uuid AND tenant_id = $2 LIMIT 1`,
      [params.id, locals.user.tenantId]
    );
    if (!check.rows.length) return fail(404, { contactError: 'BCM plan not found or access denied.' });

    const { rows: max } = await pool.query<{ m: number }>(
      `SELECT COALESCE(MAX(sort_order), 0) AS m FROM bcm.escalation_contacts WHERE plan_id = $1::uuid`,
      [params.id]
    );

    await pool.query(
      `INSERT INTO bcm.escalation_contacts (tenant_id, plan_id, role, name, email, phone, sort_order)
       VALUES ($1, $2::uuid, $3, $4, $5, $6, $7)`,
      [locals.user.tenantId, params.id, role, name, email, phone, (max[0]?.m ?? 0) + 1]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'bcm.escalation_contact.added',
      target: `bcm:${params.id}`,
      result: 'success',
      metadata: { name, role }
    });

    return { contactAdded: true };
  }
};
