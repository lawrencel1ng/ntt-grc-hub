// =====================================================================
//  /regwatch/[id] — Reg change detail. Loads impact assessments across
//  tenants and the upstream RegSource so we can show "raw source link".
// =====================================================================

import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getRegChange, getImpactAssessments, getRegSources, getTenantSummaries, getRegFrameworkRequirements } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

const VALID_IMPACTS = ['none', 'low', 'medium', 'high'] as const;

export const load: PageServerLoad = async ({ params, locals }) => {
  const change = await getRegChange(params.id);
  if (!change) throw error(404, 'Regulatory change not found');

  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;

  const [impacts, sources, tenants, requirementSuggestions] = await Promise.all([
    getImpactAssessments(change.id, effective),
    getRegSources(),
    getTenantSummaries(),
    getRegFrameworkRequirements(change.id)
  ]);
  const source = sources.find((s) => s.id === change.sourceId);
  const tenantNames: Record<string, string> = Object.fromEntries(tenants.map((t) => [t.id, t.name]));
  return { change, impacts, source, tenantNames, requirementSuggestions };
};

export const actions: Actions = {
  assessImpact: async ({ params, request, locals }) => {
    if (!locals.user) return fail(401, { assessError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { assessError: 'Requires Postgres mode' });

    const data = await request.formData();
    const impact = String(data.get('impact') ?? '').trim();
    const frameworkId = String(data.get('frameworkId') ?? '').trim() || null;
    const gapsOpened = Math.max(0, Math.floor(Number(data.get('gapsOpened') ?? 0)));
    const notes = String(data.get('notes') ?? '').trim() || null;

    if (!VALID_IMPACTS.includes(impact as typeof VALID_IMPACTS[number])) {
      return fail(400, { assessError: 'Impact must be none, low, medium, or high.' });
    }
    if (isNaN(gapsOpened)) return fail(400, { assessError: 'gapsOpened must be a number.' });
    if (notes && notes.length > 2048) return fail(400, { assessError: 'Notes must be 2048 characters or fewer.' });

    const pool = getPool();

    const changeCheck = await pool.query(
      `SELECT id FROM regwatch.changes WHERE id = $1::uuid LIMIT 1`,
      [params.id]
    );
    if (!changeCheck.rows.length) return fail(404, { assessError: 'Regulatory change not found.' });

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO regwatch.impact_assessments
         (tenant_id, change_id, framework_id, impact, gaps_opened, notes)
       VALUES ($1, $2::uuid, $3, $4::regwatch.impact, $5, $6)
       RETURNING id::text`,
      [locals.user.tenantId, params.id, frameworkId, impact, gapsOpened, notes]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'regwatch.impact.assessed',
      target: `change:${params.id}`,
      result: 'success',
      metadata: { impact, gapsOpened, frameworkId }
    });

    return { assessed: true, assessmentId: rows[0]?.id ?? null };
  }
};
