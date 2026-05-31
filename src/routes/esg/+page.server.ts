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
const VALID_ESG_SCOPES = ['scope1', 'scope2', 'scope3'] as const;
const VALID_ESG_FRAMEWORKS = ['CSRD', 'ISSB', 'GHG', 'TCFD'] as const;

export const actions: Actions = {
  logMetric: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { metricError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { metricError: 'Requires Postgres mode' });

    const fd = await request.formData();
    const period = String(fd.get('period') ?? '').trim();
    const scope = String(fd.get('scope') ?? '').trim();
    const category = String(fd.get('category') ?? '').trim();
    const metric = String(fd.get('metric') ?? '').trim();
    const value = Number(fd.get('value') ?? '');
    const unit = String(fd.get('unit') ?? '').trim();
    const framework = String(fd.get('framework') ?? '').trim();

    if (!period || period.length > 32) return fail(400, { metricError: 'Period is required (max 32 chars).' });
    if (!VALID_ESG_SCOPES.includes(scope as typeof VALID_ESG_SCOPES[number])) return fail(400, { metricError: 'Invalid scope.' });
    if (!category || category.length > 128) return fail(400, { metricError: 'Category is required (max 128 chars).' });
    if (!metric || metric.length > 256) return fail(400, { metricError: 'Metric name is required (max 256 chars).' });
    if (!Number.isFinite(value)) return fail(400, { metricError: 'Value must be a number.' });
    if (!unit || unit.length > 32) return fail(400, { metricError: 'Unit is required (max 32 chars).' });
    if (!VALID_ESG_FRAMEWORKS.includes(framework as typeof VALID_ESG_FRAMEWORKS[number])) return fail(400, { metricError: 'Invalid framework.' });

    const pool = getPool();
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO esg.metrics (tenant_id, period, scope, category, metric, value, unit, framework)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id::text`,
      [locals.user.tenantId, period, scope, category, metric, value, unit, framework]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'esg.metric.logged',
      target: `esg_metric:${rows[0].id}`,
      result: 'success',
      metadata: { period, scope, metric, value, unit, framework }
    });

    return { metricLogged: true };
  },

  addTarget: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { targetError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { targetError: 'Requires Postgres mode' });

    const fd = await request.formData();
    const framework = String(fd.get('framework') ?? '').trim();
    const metric = String(fd.get('metric') ?? '').trim();
    const baselineValue = Number(fd.get('baselineValue') ?? '');
    const baselinePeriod = String(fd.get('baselinePeriod') ?? '').trim();
    const targetValue = Number(fd.get('targetValue') ?? '');
    const targetPeriod = String(fd.get('targetPeriod') ?? '').trim();

    if (!VALID_ESG_FRAMEWORKS.includes(framework as typeof VALID_ESG_FRAMEWORKS[number])) return fail(400, { targetError: 'Invalid framework.' });
    if (!metric || metric.length > 256) return fail(400, { targetError: 'Metric is required (max 256 chars).' });
    if (!Number.isFinite(baselineValue)) return fail(400, { targetError: 'Baseline value must be a number.' });
    if (!baselinePeriod || baselinePeriod.length > 32) return fail(400, { targetError: 'Baseline period is required.' });
    if (!Number.isFinite(targetValue)) return fail(400, { targetError: 'Target value must be a number.' });
    if (!targetPeriod || targetPeriod.length > 32) return fail(400, { targetError: 'Target period is required.' });

    const pool = getPool();
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO esg.targets (tenant_id, framework, metric, baseline_value, baseline_period, target_value, target_period, owner_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id::text`,
      [locals.user.tenantId, framework, metric, baselineValue, baselinePeriod, targetValue, targetPeriod, locals.user.id]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'esg.target.added',
      target: `esg_target:${rows[0].id}`,
      result: 'success',
      metadata: { framework, metric, targetValue, targetPeriod }
    });

    return { targetAdded: true };
  },

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
