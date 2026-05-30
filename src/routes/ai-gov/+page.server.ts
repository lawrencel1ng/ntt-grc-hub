// =====================================================================
//  /ai-gov — AI Governance (EU AI Act · ISO 42001 · NIST AI RMF · MAS FEAT).
//  Heroes NTT Tsuzumi for MINDEF sovereign LLM story.
// =====================================================================

import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getAIModels, getPromptsAudit } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;

  const [models, prompts] = await Promise.all([
    getAIModels(effective),
    getPromptsAudit(effective, 1000)
  ]);

  return {
    models, prompts,
    isAll: tenantId === ALL_TENANTS_ID,
    effectiveTenantId: effective
  };
};

const VALID_RISK_TIERS = ['minimal', 'limited', 'high', 'unacceptable'] as const;
const VALID_MODEL_KINDS = ['classifier', 'llm', 'regression', 'vision', 'recommender'] as const;
const VALID_ISO_STATUSES = ['not-started', 'in-progress', 'certified'] as const;

export const actions: Actions = {
  registerModel: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { createError: 'Not authenticated.' });
    if (!isPgMode()) return fail(400, { createError: 'Requires Postgres mode.' });

    const fd = await request.formData();
    const name = String(fd.get('name') ?? '').trim();
    const kind = String(fd.get('kind') ?? 'llm').trim();
    const riskTier = String(fd.get('riskTier') ?? 'limited').trim();
    const jurisdiction = String(fd.get('jurisdiction') ?? '').trim();
    const iso42001Status = String(fd.get('iso42001Status') ?? 'not-started').trim();

    if (!name) return fail(400, { createError: 'Name is required.' });
    if (name.length > 256) return fail(400, { createError: 'Name must be 256 characters or fewer.' });
    if (!VALID_MODEL_KINDS.includes(kind as typeof VALID_MODEL_KINDS[number])) return fail(400, { createError: 'Invalid model kind.' });
    if (!VALID_RISK_TIERS.includes(riskTier as typeof VALID_RISK_TIERS[number])) return fail(400, { createError: 'Invalid risk tier.' });
    if (!VALID_ISO_STATUSES.includes(iso42001Status as typeof VALID_ISO_STATUSES[number])) return fail(400, { createError: 'Invalid ISO 42001 status.' });
    if (jurisdiction.length > 128) return fail(400, { createError: 'Jurisdiction must be 128 characters or fewer.' });

    const tenantId = locals.user.tenantId;
    const pool = getPool();

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO ai_gov.models
         (tenant_id, name, kind, risk_tier, jurisdiction, eu_ai_act_class, iso42001_status)
       VALUES ($1, $2, $3::ai_gov.model_kind, $4::ai_gov.risk_tier, $5, 'limited-risk', $6::ai_gov.iso42001_status)
       RETURNING id::text`,
      [tenantId, name, kind, riskTier, jurisdiction || 'Singapore', iso42001Status]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId,
      action: 'ai_gov.model.registered',
      target: `ai_model:${rows[0].id}`,
      result: 'success',
      metadata: { name, kind, riskTier }
    });

    return { created: true, modelId: rows[0].id };
  }
};
