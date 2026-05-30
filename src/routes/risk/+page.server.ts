// =====================================================================
//  /risk — Enterprise Risk Register. Tenant-scoped; all-tenants view
//  queries across all tenants in pg mode.
// =====================================================================

import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getRisks, getIssues } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;
  const [risks, issues] = await Promise.all([
    getRisks(effective),
    getIssues(effective)
  ]);
  return { risks, issues, isAll: tenantId === ALL_TENANTS_ID, effectiveTenantId: effective };
};

export const actions: Actions = {
  createRisk: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { error: 'Not authenticated.' });
    if (!isPgMode()) return fail(400, { error: 'Requires Postgres mode.' });

    const data = await request.formData();
    const title = (data.get('title') as string | null)?.trim() ?? '';
    const category = (data.get('category') as string | null)?.trim() ?? '';
    const description = (data.get('description') as string | null)?.trim() || undefined;
    const inherentSeverity = (data.get('inherentSeverity') as string | null)?.trim() ?? '';
    const inherentLikelihood = (data.get('inherentLikelihood') as string | null)?.trim() ?? '';
    const residualSeverity = (data.get('residualSeverity') as string | null)?.trim() ?? '';
    const residualLikelihood = (data.get('residualLikelihood') as string | null)?.trim() ?? '';
    const treatmentStrategy = (data.get('treatmentStrategy') as string | null)?.trim() || 'mitigate';

    // Validate required fields
    if (!title) return fail(400, { error: 'Title is required.' });
    if (title.length > 256) return fail(400, { error: 'Title must be 256 characters or fewer.' });
    if (description && description.length > 2048) return fail(400, { error: 'Description must be 2 048 characters or fewer.' });
    if (!category) return fail(400, { error: 'Category is required.' });
    if (!inherentSeverity) return fail(400, { error: 'Inherent severity is required.' });
    if (!inherentLikelihood) return fail(400, { error: 'Inherent likelihood is required.' });
    if (!residualSeverity) return fail(400, { error: 'Residual severity is required.' });
    if (!residualLikelihood) return fail(400, { error: 'Residual likelihood is required.' });

    const tenantId = locals.user.tenantId;
    const pool = getPool();

    // Generate risk code: R-XXXX (1-based, zero-padded)
    const { rows: countRows } = await pool.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM risk.risks WHERE tenant_id = $1',
      [tenantId]
    );
    const seq = parseInt(countRows[0].count, 10) + 1;
    const code = `R-${String(seq).padStart(4, '0')}`;

    await pool.query(
      `INSERT INTO risk.risks
         (tenant_id, code, title, description, category,
          inherent_severity, inherent_likelihood,
          residual_severity, residual_likelihood,
          status, treatment_strategy)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'identified', $10)`,
      [
        tenantId,
        code,
        title,
        description ?? null,
        category,
        inherentSeverity,
        inherentLikelihood,
        residualSeverity,
        residualLikelihood,
        treatmentStrategy
      ]
    );

    writeAuditLog({
      tenantId,
      userId: locals.user.id,
      actorEmail: locals.user.email,
      action: 'risk.created',
      target: code,
      result: 'success',
      metadata: { title, category }
    });

    return { created: true };
  }
};
