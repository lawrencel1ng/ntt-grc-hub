// =====================================================================
//  /ai-gov — AI Governance (EU AI Act · ISO 42001 · NIST AI RMF · MAS FEAT).
//  Heroes NTT Tsuzumi for MINDEF sovereign LLM story.
// =====================================================================

import type { PageServerLoad } from './$types';
import { getAIModels, getPromptsAudit } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';

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
