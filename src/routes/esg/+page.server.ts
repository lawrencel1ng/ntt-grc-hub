// =====================================================================
//  /esg — Sustainability disclosures (CSRD · ISSB · GHG · TCFD).
// =====================================================================

import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import {
  getESGMetrics, getESGDisclosures, getESGTargets
} from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;

  const [metrics, disclosures, targets] = await Promise.all([
    getESGMetrics(effective),
    getESGDisclosures(effective),
    getESGTargets(effective)
  ]);

  return {
    metrics, disclosures, targets,
    isAll: tenantId === ALL_TENANTS_ID,
    effectiveTenantId: effective
  };
};

const VALID_DISCLOSURE_STATUSES = ['draft', 'in-review', 'published', 'retired'] as const;

export const actions: Actions = {
  updateDisclosureStatus: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { disclosureError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { disclosureError: 'Requires Postgres mode' });

    const data = await request.formData();
    const disclosureId = String(data.get('disclosureId') ?? '').trim();
    const newStatus = String(data.get('status') ?? '').trim();

    if (!disclosureId) return fail(400, { disclosureError: 'Disclosure ID required' });
    if (!VALID_DISCLOSURE_STATUSES.includes(newStatus as typeof VALID_DISCLOSURE_STATUSES[number])) {
      return fail(400, { disclosureError: 'Invalid status' });
    }

    const pool = getPool();
    const { rowCount } = await pool.query(
      `UPDATE esg.disclosures
       SET status = $1,
           published_at = CASE WHEN $1 = 'published' AND published_at IS NULL THEN now() ELSE published_at END
       WHERE id = $2::uuid AND tenant_id = $3`,
      [newStatus, disclosureId, locals.user.tenantId]
    );
    if (!rowCount) return fail(404, { disclosureError: 'Disclosure not found or access denied' });

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'esg.disclosure.status.updated',
      target: `disclosure:${disclosureId}`,
      result: 'success',
      metadata: { newStatus }
    });

    return { disclosureUpdated: true, disclosureId, newStatus };
  }
};
