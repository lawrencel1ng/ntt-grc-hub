// =====================================================================
//  /heatmap — Risk Heatmap & FAIR Quantification. Loads heatmap cells +
//  appetite + the catalogue of scenarios so the page can switch the LEC
//  curve via ?scenario=…. Picks the first available scenario if none
//  is specified; FAIR run is null when no DB run exists yet.
// =====================================================================

import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import {
  getRisks, getHeatmapCells, getAppetiteStatements, getFairScenarios, getFairRun
} from '$lib/server/data';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';

export const load: PageServerLoad = async ({ locals, url }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;

  const [risks, cells, appetite, scenarios] = await Promise.all([
    getRisks(effective),
    getHeatmapCells(tenantId === ALL_TENANTS_ID ? undefined : effective),
    getAppetiteStatements(effective),
    getFairScenarios(effective)
  ]);

  // Pick scenario: from ?scenario=…, else first scenario.
  const wantedId = url.searchParams.get('scenario');
  const selectedScenario =
    (wantedId && scenarios.find((s) => s.id === wantedId)) ||
    scenarios[0] ||
    null;

  // Resolve a FAIR run for the selected scenario via its risk id.
  let fair = null;
  if (selectedScenario?.riskId) {
    fair = await getFairRun(selectedScenario.riskId);
  }

  return {
    risks,
    cells,
    appetite,
    scenarios,
    selectedScenario,
    fair,
    isAll: tenantId === ALL_TENANTS_ID,
    effectiveTenantId: effective
  };
};

const VALID_SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;

export const actions: Actions = {
  setAppetite: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { appetiteError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { appetiteError: 'Requires Postgres mode' });

    const fd = await request.formData();
    const category = String(fd.get('category') ?? '').trim();
    const statement = String(fd.get('statement') ?? '').trim();
    const thresholdSgd = Number(fd.get('thresholdSgd') ?? 0);
    const severityCap = String(fd.get('severityCap') ?? '').trim();

    if (!category || category.length > 128) return fail(400, { appetiteError: 'Category is required (max 128 chars).' });
    if (!statement || statement.length > 2048) return fail(400, { appetiteError: 'Statement is required (max 2048 chars).' });
    if (!Number.isFinite(thresholdSgd) || thresholdSgd < 0) return fail(400, { appetiteError: 'Threshold must be a non-negative number.' });
    if (!VALID_SEVERITIES.includes(severityCap as typeof VALID_SEVERITIES[number])) return fail(400, { appetiteError: 'Invalid severity cap.' });

    const pool = getPool();
    await pool.query(
      `INSERT INTO risk.appetite_statements (tenant_id, category, statement, threshold_sgd, severity_cap, approved_by_user_id, approved_at)
       VALUES ($1, $2, $3, $4, $5::risk.severity, $6, now())
       ON CONFLICT (tenant_id, category) DO UPDATE
         SET statement = EXCLUDED.statement,
             threshold_sgd = EXCLUDED.threshold_sgd,
             severity_cap = EXCLUDED.severity_cap,
             approved_by_user_id = EXCLUDED.approved_by_user_id,
             approved_at = now()`,
      [locals.user.tenantId, category, statement, thresholdSgd, severityCap, locals.user.id]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'risk.appetite.set',
      target: `appetite:${category}`,
      result: 'success',
      metadata: { category, severityCap, thresholdSgd }
    });

    return { appetiteSet: true, category };
  }
};
