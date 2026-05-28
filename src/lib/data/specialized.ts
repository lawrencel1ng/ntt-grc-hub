import type {
  PrivacyActivity, DPIA, SubjectRequest, Breach,
  ESGMetric, ESGDisclosure, ESGTarget,
  AIModel, ModelRisk, PromptAuditEntry,
  RiskSeverity, AIModelKind, AIRiskTier, ISO42001Status,
  SubjectRequestKind, SubjectRequestStatus
} from './types';
import { hashStringToInt, mulberry32 } from './rng';

// =====================================================================
// Privacy
// =====================================================================

const PRIVACY_ACTIVITY_NAMES = [
  'Customer onboarding KYC',         'Marketing email campaigns',
  'Loan underwriting model',         'Customer support chats',
  'Mobile app analytics',            'Cookie consent management',
  'Card payment processing',         'Fraud detection',
  'Employee HR records',             'Recruitment pipeline',
  'Vendor due-diligence',            'Third-party API calls'
];

const LAWFUL_BASES = ['contract','consent','legal-obligation','legitimate-interests'];
const RETENTIONS = ['7 years','5 years','1 year','retention by law'];

export function privacyActivitiesForTenant(tenantId: string): PrivacyActivity[] {
  if (!['t_maybank','t_grab','t_mindef'].includes(tenantId)) return [];
  const prefix = tenantId.substring(2, 6).toUpperCase();
  const out: PrivacyActivity[] = [];
  for (let g = 1; g <= 12; g++) {
    // Skip cross-border for MINDEF (sovereign).
    if (tenantId === 't_mindef' && g % 4 === 0) continue;
    out.push({
      id: `pa_${tenantId}_${g}`,
      tenantId,
      code: `${prefix}-ROPA-${String(g).padStart(3, '0')}`,
      name: PRIVACY_ACTIVITY_NAMES[(g - 1) % PRIVACY_ACTIVITY_NAMES.length],
      controller: tenantId,
      processor: g % 3 === 0 ? 'AWS' : undefined,
      purpose: 'Provide regulated financial service to customer',
      lawfulBasis: LAWFUL_BASES[g % LAWFUL_BASES.length],
      dataCategories: ['name','email','phone','address','financial'],
      retentionPeriod: RETENTIONS[g % RETENTIONS.length],
      crossBorder: g % 4 === 0,
      jurisdictions: g % 4 === 0 ? ['SG','US','EU'] : ['SG']
    });
  }
  return out;
}

const DPIA_STATUSES = ['draft','approved','approved','in-review'] as const;
const DPIA_SEVS: RiskSeverity[] = ['high','medium','medium','low','high'];

export function dpiasForTenant(tenantId: string): DPIA[] {
  const activities = privacyActivitiesForTenant(tenantId);
  return activities
    .filter((a) => hashStringToInt(a.id) % 3 === 0)
    .slice(0, 8)
    .map((a, g) => ({
      id: `dpia_${a.id}`,
      tenantId,
      activityId: a.id,
      activityName: a.name,
      status: DPIA_STATUSES[g % DPIA_STATUSES.length],
      residualRiskSeverity: DPIA_SEVS[g % DPIA_SEVS.length],
      conductedAt: new Date(Date.now() - (g + 1) * 14 * 86_400_000).toISOString()
    }));
}

const SR_KINDS: SubjectRequestKind[] = ['access','erasure','portability','objection','rectification'];
const SR_STATUSES: SubjectRequestStatus[] = ['received','in-progress','resolved','resolved','resolved'];

export function subjectRequestsForTenant(tenantId: string): SubjectRequest[] {
  if (!['t_maybank','t_grab','t_mindef'].includes(tenantId)) return [];
  const out: SubjectRequest[] = [];
  for (let g = 1; g <= 14; g++) {
    out.push({
      id: `sr_${tenantId}_${g}`,
      tenantId,
      kind: SR_KINDS[g % SR_KINDS.length],
      requesterEmail: `subject${g}@example.com`,
      receivedAt: new Date(Date.now() - g * 4 * 86_400_000).toISOString(),
      dueAt: new Date(Date.now() + (30 - g * 2) * 86_400_000).toISOString(),
      status: SR_STATUSES[g % SR_STATUSES.length],
      resolvedAt: g % 5 > 1 ? new Date(Date.now() - g * 2 * 86_400_000).toISOString() : undefined
    });
  }
  return out;
}

const BREACH_CAUSES = ['Misconfigured access control','Phishing-led credential theft','Vendor breach upstream'];
const BREACH_SEVS: RiskSeverity[] = ['high','medium','high'];

export function breachesForTenant(tenantId: string): Breach[] {
  if (!['t_maybank','t_grab'].includes(tenantId)) return [];
  const prefix = tenantId.substring(2, 6).toUpperCase();
  const out: Breach[] = [];
  for (let g = 1; g <= 2; g++) {
    const occurred = Date.now() - g * 60 * 86_400_000;
    out.push({
      id: `br_${tenantId}_${g}`,
      tenantId,
      code: `${prefix}-BR-${String(g).padStart(3, '0')}`,
      severity: BREACH_SEVS[g % BREACH_SEVS.length],
      occurredAt: new Date(occurred).toISOString(),
      detectedAt: new Date(occurred + 2 * 86_400_000).toISOString(),
      reportedAt: new Date(occurred + 5 * 86_400_000).toISOString(),
      affectedSubjects: 500 + g * 1200,
      regulatorNotified: true,
      rootCause: BREACH_CAUSES[g % BREACH_CAUSES.length]
    });
  }
  return out;
}

// =====================================================================
// ESG
// =====================================================================

const PERIODS = ['2025-Q1','2025-Q2','2025-Q3','2025-Q4','2026-Q1'];
const SCOPES = ['scope1','scope2','scope3'] as const;
const ESG_CATS = ['energy','travel','cloud-compute','data-centre','procurement'];
const ESG_METRICS = ['kWh consumed','tCO2e emitted','litres-of-fuel','GB egress','SaaS spend'];
const ESG_UNITS = ['kWh','tCO2e','L','GB','SGD'];
const ESG_FRAMEWORKS = ['GHG','CSRD','ISSB','TCFD'] as const;

export function esgMetricsForTenant(tenantId: string): ESGMetric[] {
  if (!['t_maybank','t_grab','t_mindef'].includes(tenantId)) return [];
  const out: ESGMetric[] = [];
  let id = hashStringToInt(`esg:${tenantId}`);
  for (const period of PERIODS) {
    for (let g = 1; g <= 12; g++) {
      out.push({
        id: id++,
        tenantId,
        period,
        scope: SCOPES[g % SCOPES.length],
        category: ESG_CATS[g % ESG_CATS.length],
        metric: ESG_METRICS[g % ESG_METRICS.length],
        value: +(100 + g * 17.4).toFixed(4),
        unit: ESG_UNITS[g % ESG_UNITS.length],
        framework: ESG_FRAMEWORKS[g % ESG_FRAMEWORKS.length]
      });
    }
  }
  return out;
}

export function esgDisclosuresForTenant(tenantId: string): ESGDisclosure[] {
  if (!['t_maybank','t_grab','t_mindef'].includes(tenantId)) return [];
  const fws = ['CSRD','ISSB','GHG','TCFD'];
  return fws
    .filter((fw) => !(tenantId === 't_mindef' && ['CSRD','ISSB'].includes(fw)))
    .map((fw, i) => ({
      id: `dis_${tenantId}_${fw}`,
      tenantId,
      framework: fw,
      period: '2025',
      status: 'published' as const,
      publishedAt: new Date(Date.now() - (60 - i * 5) * 86_400_000).toISOString()
    }));
}

const ESG_TARGETS = [
  { framework: 'GHG',  metric: 'Scope 1 tCO2e',   baseline: 1200, target: 600 },
  { framework: 'GHG',  metric: 'Scope 2 tCO2e',   baseline: 4800, target: 1800 },
  { framework: 'CSRD', metric: 'Total energy GJ', baseline: 82000, target: 52000 }
];

export function esgTargetsForTenant(tenantId: string): ESGTarget[] {
  if (!['t_maybank','t_grab','t_mindef'].includes(tenantId)) return [];
  return ESG_TARGETS
    .filter((t) => !(tenantId === 't_mindef' && t.framework === 'CSRD'))
    .map((t, i) => ({
      id: `tgt_${tenantId}_${i}`,
      tenantId,
      framework: t.framework,
      metric: t.metric,
      baselineValue: t.baseline,
      baselinePeriod: '2024',
      targetValue: t.target,
      targetPeriod: '2030'
    }));
}

// =====================================================================
// AI Governance
// =====================================================================

const MODEL_SPECS: Array<{ name: string; kind: AIModelKind; tier: AIRiskTier; cls: string; iso: ISO42001Status }> = [
  { name: 'Credit Scoring Model',       kind: 'classifier',  tier: 'high',    cls: 'High-Risk', iso: 'in-progress' },
  { name: 'Customer Support LLM',       kind: 'llm',         tier: 'limited', cls: 'Limited',   iso: 'compliant' },
  { name: 'Fraud Detection Classifier', kind: 'classifier',  tier: 'high',    cls: 'High-Risk', iso: 'compliant' },
  { name: 'Loan Pricing Regression',    kind: 'regression',  tier: 'high',    cls: 'High-Risk', iso: 'in-progress' },
  { name: 'Marketing Recommender',      kind: 'recommender', tier: 'limited', cls: 'Limited',   iso: 'compliant' },
  { name: 'KYC Document Vision',        kind: 'vision',      tier: 'high',    cls: 'High-Risk', iso: 'in-progress' }
];

export function aiModelsForTenant(tenantId: string): AIModel[] {
  if (!['t_maybank','t_grab','t_mindef'].includes(tenantId)) return [];
  const juris = tenantId === 't_grab' ? 'APAC' : 'SG';
  return MODEL_SPECS.map((m, i) => ({
    id: `mdl_${tenantId}_${i}`,
    tenantId,
    name: m.name,
    kind: m.kind,
    riskTier: m.tier,
    jurisdiction: juris,
    euAiActClass: m.cls,
    iso42001Status: m.iso
  }));
}

const MODEL_RISK_TYPES = ['bias','hallucination','drift','explainability','privacy'] as const;
const MODEL_RISK_SEVS: RiskSeverity[] = ['high','medium','medium','high','low'];

export function modelRisksForModel(modelId: string): ModelRisk[] {
  const parts = modelId.split('_');
  const tenantId = `${parts[1]}_${parts[2]}`;
  return [1, 2].map((g) => ({
    id: `mr_${modelId}_${g}`,
    tenantId,
    modelId,
    riskType: MODEL_RISK_TYPES[g % MODEL_RISK_TYPES.length],
    severity: MODEL_RISK_SEVS[g % MODEL_RISK_SEVS.length],
    mitigation: 'Quarterly review; SHAP analysis; HITL on edge cases.'
  }));
}

const PROMPT_TOPICS = ['balance','interest rate','dispute','transfer fees','statement'];

export function promptsAuditForTenant(tenantId: string, limit?: number): PromptAuditEntry[] {
  const models = aiModelsForTenant(tenantId);
  if (!models.length) return [];
  const perModel = { t_maybank: 53, t_grab: 38, t_mindef: 8 }[tenantId] ?? 4;
  const rng = mulberry32(hashStringToInt(`prompts:${tenantId}`));
  const out: PromptAuditEntry[] = [];
  let id = 100_000;
  for (const m of models) {
    for (let g = 1; g <= perModel; g++) {
      const tokensIn = 120 + (g % 200);
      const tokensOut = 60 + (g % 180);
      out.push({
        id: id++,
        tenantId,
        modelId: m.id,
        promptRedacted: `[REDACTED] customer asked about ${PROMPT_TOPICS[g % PROMPT_TOPICS.length]}`,
        responseRedacted: '[REDACTED] response with explanation and CTA',
        tokensIn,
        tokensOut,
        costCents: Math.round(tokensIn * 0.05 + tokensOut * 0.15),
        capturedAt: new Date(Date.now() - (g % 60) * 86_400_000 - (g % 24) * 3600_000).toISOString()
      });
      void rng;
    }
  }
  return limit ? out.slice(0, limit) : out;
}
