import type { Vendor, VendorTier, VendorCriticality, VendorStatus, Questionnaire, QuestionnaireStatus, FourthParty, Concentration, QuestionnaireResponse } from './types';
import { TENANT_PROFILES } from './tenants';
import { hashStringToInt, mulberry32 } from './rng';

const VENDOR_NAMES = [
  'AWS','Microsoft','Google Cloud','Oracle','IBM','Salesforce','Snowflake','Databricks',
  'ServiceNow','Atlassian','Splunk','Datadog','New Relic','PagerDuty','Twilio','Stripe',
  'Adyen','Workday','SAP','Tableau','Power BI','Looker','Mongo Atlas','Confluent',
  'CrowdStrike','SentinelOne','Palo Alto','Cisco','Okta','Auth0','OneLogin','PingIdentity',
  'BitSight','SecurityScorecard','Vanta','Drata','Onetrust','TrustArc','Bitwarden','1Password',
  'GitHub','GitLab','Jira Service Mgmt','Notion','Slack','Zoom','Microsoft Teams',
  'Lacework','Wiz','Orca Security','Sysdig','Rapid7','Tenable','Qualys','HashiCorp',
  'Cloudflare','Akamai','Fastly','Imperva','F5','Zscaler','Netskope','Mimecast',
  'Proofpoint','KnowBe4','Anaplan','Coupa','Workiva','MetricStream','Archer',
  'IBM OpenPages','Solv FSL','NTT Data','Accenture','Deloitte Cyber','PwC',
  'KPMG','EY','Bain','BCG','McKinsey','Capgemini','Wipro','TCS','Infosys','HCL','Cognizant',
  'Maersk Logistics','DHL'
];

const CATEGORIES = ['cloud','saas','consulting','managed-service','hardware','communications','security','data-platform'];
const TIERS: VendorTier[] = ['1','2','2','3','3','4','1'];
const CRITS: VendorCriticality[] = ['critical','high','high','medium','medium','low','critical'];
const HQ_COUNTRIES = ['SG','SG','MY','ID','TH','IN','US','EU','HK'];
const STATUSES: VendorStatus[] = ['active','active','active','active','onboarding','offboarded'];

export function vendorsForTenant(tenantId: string): Vendor[] {
  const profile = TENANT_PROFILES[tenantId];
  if (!profile) return [];
  const n = profile.vendorCount;
  const rng = mulberry32(hashStringToInt(`vendors:${tenantId}`));
  const out: Vendor[] = [];
  for (let g = 1; g <= n; g++) {
    out.push({
      id: `vnd_${tenantId}_${g}`,
      tenantId,
      name: `${VENDOR_NAMES[(g - 1) % VENDOR_NAMES.length]} — ${tenantId}`,
      category: CATEGORIES[g % CATEGORIES.length],
      tier: TIERS[g % TIERS.length],
      criticality: CRITS[g % CRITS.length],
      hqCountry: HQ_COUNTRIES[g % HQ_COUNTRIES.length],
      primaryContactEmail: `contact${g}@vendor.example.com`,
      status: STATUSES[g % STATUSES.length],
      contractValueSgd: Math.round(50_000 + rng() * 2_950_000),
      lastQuestionnaireScore: Math.round(60 + rng() * 40)
    });
  }
  return out;
}

const Q_TEMPLATES: ('SIG' | 'CAIQ' | 'Custom')[] = ['SIG','CAIQ','Custom'];
const Q_STATUSES: QuestionnaireStatus[] = ['sent','in-progress','complete','complete','complete'];

export function questionnairesForVendor(tenantId: string, vendorId?: string): Questionnaire[] {
  const vendors = vendorsForTenant(tenantId);
  const filtered = vendorId ? vendors.filter((v) => v.id === vendorId) : vendors;
  return filtered.map((v, i) => {
    const seed = hashStringToInt(v.id);
    const tmpl = Q_TEMPLATES[seed % 3];
    const status = Q_STATUSES[seed % 5];
    const completed = (seed % 5) < 3;
    return {
      id: `q_${v.id}`,
      tenantId,
      vendorId: v.id,
      vendorName: v.name,
      template: tmpl,
      status,
      sentAt: new Date(Date.now() - (30 + (seed % 120)) * 86_400_000).toISOString(),
      completedAt: completed ? new Date(Date.now() - (seed % 30) * 86_400_000).toISOString() : undefined,
      // Mark some as auto-completed by Vendor Risk Analyst for demo.
      completedByAgentId: completed && i % 3 !== 0 ? 'ag_vendor' : undefined,
      score: completed ? 60 + (seed % 40) : undefined
    };
  });
}

export function questionnaireResponsesFor(questionnaireId: string): QuestionnaireResponse[] {
  const seed = hashStringToInt(questionnaireId);
  const responses = ['Yes','Yes','No','Partial','Not Applicable','Yes — see SOC 2 §4.2','Compensating control'];
  const out: QuestionnaireResponse[] = [];
  for (let g = 1; g <= 10; g++) {
    out.push({
      id: seed + g,
      questionnaireId,
      questionCode: `Q${String(g).padStart(3, '0')}`,
      response: responses[g % responses.length],
      confidence: 70 + (g * 3) % 30
    });
  }
  return out;
}

const FOURTH_PARTY_NAMES = ['AWS','Stripe','Cloudflare','Twilio','SendGrid','Auth0','Datadog','Splunk','Snowflake','MongoDB Atlas'];
const FP_REGIONS = ['SG','US','EU','MY','IN'];
const FP_CRITS: VendorCriticality[] = ['critical','high','medium','low'];

export function fourthPartiesForTenant(tenantId: string): FourthParty[] {
  const vendors = vendorsForTenant(tenantId);
  const fpPerVendor: Record<string, number> = { t_maybank: 2, t_grab: 3, t_mindef: 1 };
  const per = fpPerVendor[tenantId] ?? 0;
  const out: FourthParty[] = [];
  for (const v of vendors) {
    for (let g = 1; g <= per; g++) {
      out.push({
        id: `fp_${v.id}_${g}`,
        tenantId,
        vendorId: v.id,
        vendorName: v.name,
        name: `${FOURTH_PARTY_NAMES[g % FOURTH_PARTY_NAMES.length]} (4P of ${v.name.split(' ')[0]})`,
        type: (['cloud','saas','processor','cloud'] as const)[g % 4],
        region: FP_REGIONS[g % FP_REGIONS.length],
        criticality: FP_CRITS[g % FP_CRITS.length]
      });
    }
  }
  return out;
}

const CONCENTRATION_ROWS = [
  { dim: 'cloud' as const,     key: 'AWS',             vc: 18, exp: 8_400_000 },
  { dim: 'cloud' as const,     key: 'Azure',           vc: 9,  exp: 3_200_000 },
  { dim: 'region' as const,    key: 'ap-southeast-1',  vc: 22, exp: 11_500_000 },
  { dim: 'region' as const,    key: 'ap-northeast-1',  vc: 7,  exp: 2_800_000 },
  { dim: 'processor' as const, key: 'Stripe',          vc: 4,  exp: 1_200_000 },
  { dim: 'processor' as const, key: 'Twilio',          vc: 3,  exp: 650_000 }
];

export function concentrationsForTenant(tenantId: string): Concentration[] {
  if (!['t_maybank','t_grab','t_mindef'].includes(tenantId)) return [];
  return CONCENTRATION_ROWS.map((r, i) => ({
    id: `conc_${tenantId}_${i}`,
    tenantId,
    dimension: r.dim,
    key: r.key,
    vendorCount: r.vc,
    exposureSgd: r.exp
  }));
}
