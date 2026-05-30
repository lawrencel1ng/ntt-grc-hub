// =====================================================================
//  /human-risk — Human Risk Management (KnowBe4 Virtual Risk Officer).
//  Per-user risk scoring → org Human Risk Score → quantified FAIR ALE
//  feeding the enterprise risk register. Tenant-scoped; MSSP rollup
//  falls back to Maybank so the page is always populated.
// =====================================================================

import type { PageServerLoad } from './$types';
import {
  getHumanRiskSummary, getHumanRiskUsers, getHumanRiskDepartments,
  getPhishingCampaigns, getTrainingCampaigns
} from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;

  const [summary, users, departments, phishing, training] = await Promise.all([
    getHumanRiskSummary(effective),
    getHumanRiskUsers(effective),
    getHumanRiskDepartments(effective),
    getPhishingCampaigns(effective),
    getTrainingCampaigns(effective)
  ]);

  return {
    summary, users, departments, phishing, training,
    isAll: tenantId === ALL_TENANTS_ID,
    effectiveTenantId: effective
  };
};
