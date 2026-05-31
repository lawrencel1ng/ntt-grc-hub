// =====================================================================
//  /frameworks/[id] — Framework detail. Loads requirements, controls,
//  and evidence scoped to the active tenant. All-tenants mode loads
//  cross-tenant aggregated compliance data.
// =====================================================================

import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import {
  getFramework, getRequirementsForFramework, getFrameworkScores,
  getEvidence, getComplianceGaps, getComplianceAttestations,
  getRequirementCoverage, getControlsByFramework
} from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

export const load: PageServerLoad = async ({ params, locals }) => {
  const framework = await getFramework(params.id);
  if (!framework) throw error(404, 'Framework not found');

  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;

  const [requirements, scores, evidence, gaps, attestations, coverage, mappedControls] = await Promise.all([
    getRequirementsForFramework(framework.id),
    getFrameworkScores(effective),
    getEvidence(effective, 30),
    getComplianceGaps(framework.id, effective),
    getComplianceAttestations(framework.id, effective),
    getRequirementCoverage(framework.id, effective),
    getControlsByFramework(framework.id, effective)
  ]);

  const score = scores.find((s) => s.frameworkId === framework.id);

  return { framework, requirements, score, evidence, gaps, attestations, coverage, mappedControls, isAll: tenantId === ALL_TENANTS_ID };
};

export const actions: Actions = {
  signAttestation: async ({ params, request, locals }) => {
    if (!locals.user) return fail(401, { attestError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { attestError: 'Requires Postgres mode' });

    const fd = await request.formData();
    const attestationText = String(fd.get('attestationText') ?? '').trim();
    const validUntil = String(fd.get('validUntil') ?? '').trim() || null;

    if (!attestationText || attestationText.length > 4096) {
      return fail(400, { attestError: 'Attestation text is required (max 4096 chars).' });
    }

    const pool = getPool();
    const check = await pool.query<{ id: string }>(
      `SELECT id FROM compliance.frameworks WHERE id = $1 LIMIT 1`,
      [params.id]
    );
    if (!check.rows.length) return fail(404, { attestError: 'Framework not found.' });

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO compliance.attestations
         (tenant_id, framework_id, signed_by_user_id, signed_at, valid_until, attestation_text)
       VALUES ($1, $2, $3, now(), $4, $5)
       RETURNING id::text`,
      [locals.user.tenantId, params.id, locals.user.id, validUntil, attestationText]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'compliance.attestation.signed',
      target: `framework:${params.id}`,
      result: 'success',
      metadata: { attestationId: rows[0].id, frameworkId: params.id }
    });

    return { attested: true };
  },

  updateGap: async ({ params, request, locals }) => {
    if (!locals.user) return fail(401, { gapError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { gapError: 'Requires Postgres mode' });

    const fd = await request.formData();
    const gapId = String(fd.get('gapId') ?? '').trim();
    const remediationPlan = String(fd.get('remediationPlan') ?? '').trim() || null;
    const targetDate = String(fd.get('targetDate') ?? '').trim() || null;

    if (!gapId) return fail(400, { gapError: 'Gap ID required.' });
    if (remediationPlan && remediationPlan.length > 4096) {
      return fail(400, { gapError: 'Remediation plan must be 4096 characters or fewer.' });
    }

    const pool = getPool();
    // Verify the gap belongs to an assessment for this tenant
    const { rowCount } = await pool.query(
      `UPDATE compliance.gaps g
       SET remediation_plan = $1,
           target_date = $2::date,
           owner_user_id = $3::uuid
       FROM compliance.assessments a
       WHERE g.id = $4::uuid
         AND g.assessment_id = a.id
         AND a.tenant_id = $5`,
      [remediationPlan, targetDate, locals.user.id, gapId, locals.user.tenantId]
    );
    if (!rowCount) return fail(404, { gapError: 'Compliance gap not found or access denied.' });

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'compliance.gap.updated',
      target: `framework:${params.id}:gap:${gapId}`,
      result: 'success',
      metadata: { gapId, targetDate }
    });

    return { gapUpdated: true, gapId };
  }
};
