// =====================================================================
//  /sox — SOX & Financial Controls. Tenant-scoped.
// =====================================================================

import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import {
  getSOXItgcs, getSOXKcas, getSOXWalkthroughs, getSOXDeficiencies
} from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

const VALID_ITGC_STATUSES = ['effective', 'deficiency', 'material_weakness'] as const;
const VALID_DEFICIENCY_SEVERITIES = ['material', 'significant'] as const;

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;

  const [itgcs, kcas, walkthroughs, deficiencies] = await Promise.all([
    getSOXItgcs(effective),
    getSOXKcas(effective),
    getSOXWalkthroughs(effective),
    getSOXDeficiencies(effective)
  ]);

  return {
    itgcs, kcas, walkthroughs, deficiencies,
    isAll: tenantId === ALL_TENANTS_ID,
    effectiveTenantId: effective
  };
};

export const actions: Actions = {
  updateItgcStatus: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { itgcError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { itgcError: 'Requires Postgres mode' });

    const data = await request.formData();
    const itgcId = String(data.get('itgcId') ?? '').trim();
    const newStatus = String(data.get('status') ?? '').trim();

    if (!itgcId) return fail(400, { itgcError: 'ITGC ID required.' });
    if (!VALID_ITGC_STATUSES.includes(newStatus as typeof VALID_ITGC_STATUSES[number])) {
      return fail(400, { itgcError: 'Invalid ITGC status.' });
    }

    const pool = getPool();
    const { rowCount } = await pool.query(
      `UPDATE sox.itgcs SET status = $1, tested_at = now()
       WHERE id = $2::uuid AND tenant_id = $3`,
      [newStatus, itgcId, locals.user.tenantId]
    );
    if (!rowCount) return fail(404, { itgcError: 'ITGC not found or access denied.' });

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'sox.itgc.status.updated',
      target: `itgc:${itgcId}`,
      result: 'success',
      metadata: { newStatus }
    });

    return { itgcUpdated: true, itgcId, newStatus };
  },

  createDeficiency: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { deficiencyError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { deficiencyError: 'Requires Postgres mode' });

    const data = await request.formData();
    const description = String(data.get('description') ?? '').trim();
    const severity = String(data.get('severity') ?? 'significant').trim();
    const rootCause = String(data.get('rootCause') ?? '').trim() || null;
    const remediationPlan = String(data.get('remediationPlan') ?? '').trim() || null;
    const itgcId = String(data.get('itgcId') ?? '').trim();

    if (!description) return fail(400, { deficiencyError: 'Description is required.' });
    if (!itgcId) return fail(400, { deficiencyError: 'ITGC is required.' });
    if (description.length > 2048) return fail(400, { deficiencyError: 'Description must be 2048 characters or fewer.' });
    if (!VALID_DEFICIENCY_SEVERITIES.includes(severity as typeof VALID_DEFICIENCY_SEVERITIES[number])) {
      return fail(400, { deficiencyError: 'Invalid severity.' });
    }
    if (rootCause && rootCause.length > 2048) return fail(400, { deficiencyError: 'Root cause must be 2048 characters or fewer.' });
    if (remediationPlan && remediationPlan.length > 2048) return fail(400, { deficiencyError: 'Remediation plan must be 2048 characters or fewer.' });

    const pool = getPool();

    const check = await pool.query(
      `SELECT id FROM sox.itgcs WHERE id = $1::uuid AND tenant_id = $2 LIMIT 1`,
      [itgcId, locals.user.tenantId]
    );
    if (!check.rows.length) return fail(400, { deficiencyError: 'ITGC not found or access denied.' });

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO sox.deficiencies
         (tenant_id, itgc_id, severity, description, root_cause, remediation_plan)
       VALUES ($1, $2::uuid, $3::sox.deficiency_sev, $4, $5, $6)
       RETURNING id::text`,
      [locals.user.tenantId, itgcId, severity, description, rootCause, remediationPlan]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'sox.deficiency.created',
      target: `deficiency:${rows[0].id}`,
      result: 'success',
      metadata: { severity, itgcId }
    });

    return { deficiencyCreated: true, deficiencyId: rows[0].id };
  }
};
