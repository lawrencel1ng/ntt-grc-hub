// =====================================================================
//  Human Risk Management (KnowBe4) — security-awareness telemetry.
//
//  KnowBe4's Virtual Risk Officer scores every employee 0–100 (higher =
//  riskier) from simulated-phishing outcomes, training completion and
//  role-based "boosters". We synthesise that population deterministically
//  per tenant, roll it up to an org Human Risk Score, and — crucially —
//  convert the org Phish-prone Percentage (PPP) into a FAIR-style
//  Annualised Loss Expectancy so human risk feeds the enterprise risk
//  register and quantitative risk reporting.
//
//  All generators are seeded with mulberry32 so two reloads are identical.
// =====================================================================

import type {
  HumanRiskUser, HumanRiskLevel, PhishResult,
  HumanRiskDepartment, PhishingCampaign, TrainingCampaign,
  HumanRiskSummary, HumanRiskQuant
} from './types';
import { hashStringToInt, mulberry32, pick } from './rng';
import { getUsersForTenant } from './users';

// --- Population sizing (KnowBe4 covers the whole workforce, not just GRC) ---
const HEADCOUNT: Record<string, number> = {
  t_maybank: 9200,
  t_grab: 11_000,
  t_mindef: 6400,
  t_singhealth: 3800,
  t_govtech: 2600,
  t_astar: 1400,
  t_mediacorp: 1100,
  t_singtel: 5200
};

// Industry phishing-prone benchmark (KnowBe4 2024 baseline by sector, %).
const INDUSTRY_PPP: Record<string, number> = {
  Banking: 32.4,
  Fintech: 29.8,
  Defence: 27.1,
  Healthcare: 34.7,
  'Public Sector': 33.2,
  Research: 30.5,
  Media: 31.6,
  Telecommunications: 33.0
};

const DEPARTMENTS = [
  'Retail Banking', 'Corporate Banking', 'Treasury', 'Technology',
  'Operations', 'Risk & Compliance', 'Finance', 'Human Resources',
  'Customer Service', 'Legal', 'Internal Audit', 'Marketing'
] as const;

const JOB_TITLES = [
  'Analyst', 'Senior Analyst', 'Manager', 'Senior Manager', 'Director',
  'Associate', 'Specialist', 'Lead', 'VP', 'Officer', 'Executive', 'Head'
] as const;

const FIRST_NAMES = [
  'Mei Lin', 'Aaron', 'Priya', 'Hiroshi', 'Siti', 'Wei Jie', 'Aisha',
  'Daniel', 'Farah', 'Ravi', 'Yuki', 'Jia Hao', 'Nadia', 'Marcus',
  'Devi', 'Kenji', 'Chloe', 'Arjun', 'Sofia', 'Rashid', 'Anita',
  'Benedict', 'Mia', 'Joshua', 'Amelia', 'Ethan', 'Aiko', 'Sarah',
  'Vikram', 'Hana', 'Liam', 'Olivia', 'Bhumi', 'Caleb', 'Ying'
];
const LAST_NAMES = [
  'Khoo', 'Tan', 'Lim', 'Wong', 'Ng', 'Lee', 'Goh', 'Chua', 'Singh',
  'Kumar', 'Rahman', 'Patel', 'Sato', 'Tanaka', 'Nakamura', 'Anand',
  'Sharma', 'Iyer', 'Bose', 'Chen', 'Zhang', 'Liu', 'Wang', 'Hassan',
  'Aziz', 'Fernando', 'Soh', 'Teo'
];

const EMAIL_DOMAIN: Record<string, string> = {
  t_maybank: 'maybank.com.sg',
  t_mindef: 'mindef.gov.sg',
  t_grab: 'grab.com',
  t_singhealth: 'singhealth.com.sg',
  t_govtech: 'govtech.gov.sg',
  t_astar: 'astar.edu.sg',
  t_mediacorp: 'mediacorp.sg',
  t_singtel: 'singtel.com'
};

const PHISH_TEMPLATES = [
  'O365 Password Expiry Notice', 'DHL Package Awaiting Delivery',
  'HR — Updated Leave Policy (Acknowledge)', 'Docusign: Contract Ready to Sign',
  'IT Helpdesk: VPN Re-authentication', 'Payroll — Bank Detail Verification',
  'CEO Urgent: Wire Approval Needed', 'Zoom Recording Available',
  'LinkedIn: You appeared in 9 searches', 'Microsoft Teams Missed Message',
  'AWS Billing Alert — Action Required', 'Singpass Login Notification'
];

const TRAINING_TITLES: { name: string; type: TrainingCampaign['contentType']; ref: string }[] = [
  { name: `${new Date().getFullYear()} Security Awareness Refresher`, type: 'video', ref: 'ISO 27001 A.6.3' },
  { name: 'Phishing & Social Engineering', type: 'interactive', ref: 'NIST CSF PR.AT-1' },
  { name: 'Data Protection & PDPA Essentials', type: 'assessment', ref: 'PDPA s.11' },
  { name: 'Acceptable Use Policy Acknowledgement', type: 'policy-ack', ref: 'MAS TRM 4.1' },
  { name: 'Insider Threat Awareness', type: 'video', ref: 'ISO 27001 A.6.1' },
  { name: 'Secure Remote Working', type: 'interactive', ref: 'MAS TRM 11.2' },
  { name: 'AI Acceptable Use & Prompt Hygiene', type: 'assessment', ref: 'ISO 42001 8.3' }
];

// ------------------------ helpers ------------------------

function headcount(tenantId: string): number {
  return HEADCOUNT[tenantId] ?? 600;
}

function industryFor(tenantId: string): string {
  const m: Record<string, string> = {
    t_maybank: 'Banking', t_grab: 'Fintech', t_mindef: 'Defence',
    t_singhealth: 'Healthcare', t_govtech: 'Public Sector',
    t_astar: 'Research', t_mediacorp: 'Media', t_singtel: 'Telecommunications'
  };
  return m[tenantId] ?? 'Banking';
}

export function riskLevelFor(score: number): HumanRiskLevel {
  if (score >= 65) return 'critical';
  if (score >= 45) return 'high';
  if (score >= 25) return 'moderate';
  return 'low';
}

const HERO = 't_maybank';

// Org-level posture per tenant. Maybank is the curated hero: a mature
// programme that has driven PPP from ~34% to ~6% and cut quantified ALE.
function orgPosture(tenantId: string): {
  orgRiskScore: number; orgRiskScore12mAgo: number;
  ppp: number; ppp12mAgo: number; trainingCompletionPct: number;
} {
  if (tenantId === HERO) {
    return { orgRiskScore: 28, orgRiskScore12mAgo: 54, ppp: 6.2, ppp12mAgo: 33.8, trainingCompletionPct: 96.4 };
  }
  const rng = mulberry32(hashStringToInt(`hr:org:${tenantId}`));
  const ppp12mAgo = +(26 + rng() * 12).toFixed(1);          // 26–38% baseline
  const improvement = 0.45 + rng() * 0.35;                   // 45–80% reduction
  const ppp = +(ppp12mAgo * (1 - improvement)).toFixed(1);
  const orgRiskScore12mAgo = Math.round(42 + rng() * 22);    // 42–64
  const orgRiskScore = Math.max(14, Math.round(orgRiskScore12mAgo * (1 - improvement * 0.85)));
  const trainingCompletionPct = +(78 + rng() * 20).toFixed(1);
  return { orgRiskScore, orgRiskScore12mAgo, ppp, ppp12mAgo, trainingCompletionPct };
}

// -------- Quantitative model: PPP → ARO → ALE (FAIR bridge) --------
//
//  A phish-prone user has a small annual probability of being the entry
//  point for a real credential-compromise event. We scale that by
//  headcount and PPP to get an Annualised Rate of Occurrence, then apply
//  a per-incident loss magnitude benchmarked to credential-compromise /
//  BEC losses in regulated APAC sectors.

const ANNUAL_SUCCESS_FACTOR = 0.0042;  // P(real compromise | phish-prone user) per year

export function humanRiskQuant(tenantId: string): HumanRiskQuant {
  const p = orgPosture(tenantId);
  const hc = headcount(tenantId);
  const rng = mulberry32(hashStringToInt(`hr:quant:${tenantId}`));
  const perIncidentMeanSgd = Math.round(240_000 + rng() * 180_000); // 240k–420k
  const perIncidentStdevSgd = Math.round(perIncidentMeanSgd * 0.55);

  const aroNow = hc * (p.ppp / 100) * ANNUAL_SUCCESS_FACTOR;
  const aroThen = hc * (p.ppp12mAgo / 100) * ANNUAL_SUCCESS_FACTOR;
  const aleSgd = Math.round(aroNow * perIncidentMeanSgd);
  const aleSgd12mAgo = Math.round(aroThen * perIncidentMeanSgd);

  return {
    aro: +aroNow.toFixed(2),
    perIncidentMeanSgd,
    perIncidentStdevSgd,
    aleSgd,
    aleSgd12mAgo,
    aleReducedSgd: Math.max(0, aleSgd12mAgo - aleSgd),
    riskId: `risk_${tenantId}_humanrisk`,
    scenarioId: `scn_${tenantId}_humanrisk`
  };
}

// ------------------------ user population ------------------------
//
//  Generating tens of thousands of rows is wasteful for a demo, so we
//  synthesise a representative sample (the riskiest cohort the SOC would
//  actually triage) while org/department counts reflect full headcount.

const SAMPLE_SIZE = 64;

function monthLabels(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(d.toLocaleString('en-SG', { month: 'short' }));
  }
  return out;
}

export function humanRiskUsers(tenantId: string): HumanRiskUser[] {
  if (!HEADCOUNT[tenantId]) return [];
  const rng = mulberry32(hashStringToInt(`hr:users:${tenantId}`));
  const p = orgPosture(tenantId);
  const dom = EMAIL_DOMAIN[tenantId] ?? 'ntt.com';
  // Seed the sample with the tenant's known GRC console users so the two
  // views feel connected, then pad with synthetic employees.
  const seeded = getUsersForTenant(tenantId);
  const out: HumanRiskUser[] = [];

  for (let i = 0; i < SAMPLE_SIZE; i++) {
    const seededUser = seeded[i];
    const first = pick(FIRST_NAMES, rng);
    const last = pick(LAST_NAMES, rng);
    const name = seededUser?.name ?? `${first} ${last}`;
    const email = seededUser?.email
      ?? `${first.toLowerCase().replace(/\s+/g, '.')}.${last.toLowerCase()}@${dom}`;
    const department = DEPARTMENTS[Math.floor(rng() * DEPARTMENTS.length)];
    const jobTitle = JOB_TITLES[Math.floor(rng() * JOB_TITLES.length)];
    const privilegedAccess = rng() > 0.78;
    const mfaEnabled = seededUser?.mfaEnabled ?? rng() > 0.12;

    // Bias the sample toward higher risk (this is the triage cohort). The
    // org mean anchors the distribution; boosters push individuals up.
    const base = p.orgRiskScore + (rng() - 0.3) * 46;
    let score = Math.round(Math.max(2, Math.min(99, base)));
    if (privilegedAccess) score = Math.min(99, score + 8);
    if (!mfaEnabled) score = Math.min(99, score + 10);

    const phishingSent = 6 + Math.floor(rng() * 12);
    const failProb = score / 130;
    let phishingClicked = 0, phishingReported = 0, phishingDataEntered = 0;
    for (let t = 0; t < phishingSent; t++) {
      const r = rng();
      if (r < failProb * 0.45) phishingDataEntered++;
      else if (r < failProb) phishingClicked++;
      else if (r > 0.92 - score / 400) phishingReported++;
    }
    const lastR = rng();
    const lastPhishResult: PhishResult =
      lastR < failProb * 0.4 ? 'data-entered'
      : lastR < failProb ? 'clicked'
      : lastR < failProb + 0.18 ? 'opened'
      : lastR > 0.82 ? 'reported' : 'no-action';

    const trainingAssigned = 4 + Math.floor(rng() * 4);
    const completionBias = Math.max(0.25, 1 - score / 140);
    const trainingCompleted = Math.min(trainingAssigned, Math.round(trainingAssigned * completionBias));
    const trainingCompletionPct = Math.round((trainingCompleted / trainingAssigned) * 100);

    // 12-month risk trend converging downward to the current score.
    const history: number[] = [];
    const start = Math.min(99, score + 14 + Math.floor(rng() * 12));
    for (let m = 0; m < 12; m++) {
      const tt = m / 11;
      const v = Math.round(start + (score - start) * tt + (rng() - 0.5) * 5);
      history.push(Math.max(2, Math.min(99, v)));
    }
    history[11] = score;
    const riskScore30dDelta = score - history[10];

    out.push({
      id: `hru_${tenantId}_${i + 1}`,
      tenantId,
      name,
      email,
      department,
      jobTitle: `${jobTitle}, ${department}`,
      riskScore: score,
      riskLevel: riskLevelFor(score),
      riskScore30dDelta,
      phishingSent,
      phishingClicked,
      phishingReported,
      phishingDataEntered,
      lastPhishResult,
      lastPhishAt: new Date(Date.now() - Math.floor(rng() * 40) * 86_400_000).toISOString(),
      trainingAssigned,
      trainingCompleted,
      trainingCompletionPct,
      lastTrainingAt: new Date(Date.now() - Math.floor(rng() * 80) * 86_400_000).toISOString(),
      mfaEnabled,
      privilegedAccess,
      riskHistory: history
    });
  }
  // Riskiest first — this view is a triage queue.
  return out.sort((a, b) => b.riskScore - a.riskScore);
}

export function humanRiskUser(id: string): HumanRiskUser | undefined {
  // id: hru_<tenant>_<n>
  const m = /^hru_(t_[a-z]+)_\d+$/.exec(id);
  if (!m) return undefined;
  return humanRiskUsers(m[1]).find((u) => u.id === id);
}

// ------------------------ departments ------------------------

export function humanRiskDepartments(tenantId: string): HumanRiskDepartment[] {
  if (!HEADCOUNT[tenantId]) return [];
  const rng = mulberry32(hashStringToInt(`hr:dept:${tenantId}`));
  const p = orgPosture(tenantId);
  const hc = headcount(tenantId);
  // Distribute headcount across departments with a long-tail weighting.
  const weights = DEPARTMENTS.map(() => 0.5 + rng());
  const wSum = weights.reduce((s, w) => s + w, 0);
  return DEPARTMENTS.map((department, i) => {
    const deptHc = Math.max(20, Math.round((weights[i] / wSum) * hc));
    // Some functions (Customer Service, Marketing) run hotter than mean.
    const hot = ['Customer Service', 'Marketing', 'Operations'].includes(department) ? 12 : 0;
    const cool = ['Risk & Compliance', 'Internal Audit', 'Technology'].includes(department) ? -8 : 0;
    const avgRiskScore = Math.max(8, Math.min(95, Math.round(p.orgRiskScore + hot + cool + (rng() - 0.5) * 14)));
    const phishPronePct = +Math.max(1.5, p.ppp + hot / 2 + cool / 2 + (rng() - 0.5) * 6).toFixed(1);
    const trainingCompletionPct = +Math.max(55, Math.min(100, p.trainingCompletionPct + (rng() - 0.5) * 16)).toFixed(1);
    const highRiskUsers = Math.round(deptHc * (phishPronePct / 100) * (avgRiskScore / 70));
    return {
      tenantId, department, headcount: deptHc,
      avgRiskScore, riskLevel: riskLevelFor(avgRiskScore),
      phishPronePct, trainingCompletionPct, highRiskUsers
    };
  }).sort((a, b) => b.avgRiskScore - a.avgRiskScore);
}

// ------------------------ phishing campaigns ------------------------

export function phishingCampaigns(tenantId: string): PhishingCampaign[] {
  if (!HEADCOUNT[tenantId]) return [];
  const rng = mulberry32(hashStringToInt(`hr:phish:${tenantId}`));
  const p = orgPosture(tenantId);
  const hc = headcount(tenantId);
  const n = 8;
  const out: PhishingCampaign[] = [];
  for (let i = 0; i < n; i++) {
    // Older campaigns reflect the higher historical PPP.
    const ageMonths = (n - 1 - i) * 1.4;
    const tt = 1 - ageMonths / (n * 1.4);
    const ppp = +Math.max(2, p.ppp12mAgo + (p.ppp - p.ppp12mAgo) * tt + (rng() - 0.5) * 4).toFixed(1);
    const recipients = Math.round(hc * (0.4 + rng() * 0.6));
    const delivered = Math.round(recipients * (0.95 + rng() * 0.04));
    const clicked = Math.round(delivered * (ppp / 100));
    const dataEntered = Math.round(clicked * (0.25 + rng() * 0.2));
    const opened = Math.round(delivered * (ppp / 100 + 0.18 + rng() * 0.1));
    const reported = Math.round(delivered * (0.22 + tt * 0.25 + rng() * 0.06));
    const status: PhishingCampaign['status'] = i === n - 1 ? 'in-progress' : 'closed';
    out.push({
      id: `pc_${tenantId}_${i + 1}`,
      tenantId,
      name: `${PHISH_TEMPLATES[i % PHISH_TEMPLATES.length]}`,
      template: PHISH_TEMPLATES[i % PHISH_TEMPLATES.length],
      difficulty: ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5,
      sentAt: new Date(Date.now() - Math.round(ageMonths * 30) * 86_400_000).toISOString(),
      recipients, delivered, opened, clicked, dataEntered, reported,
      phishPronePct: ppp,
      status
    });
  }
  return out.reverse(); // most recent first
}

// ------------------------ training campaigns ------------------------

export function trainingCampaigns(tenantId: string): TrainingCampaign[] {
  if (!HEADCOUNT[tenantId]) return [];
  const rng = mulberry32(hashStringToInt(`hr:train:${tenantId}`));
  const hc = headcount(tenantId);
  return TRAINING_TITLES.map((t, i) => {
    const enrolled = Math.round(hc * (0.7 + rng() * 0.3));
    const completionPct = +Math.max(48, Math.min(100, 70 + rng() * 30)).toFixed(1);
    const completed = Math.round(enrolled * (completionPct / 100));
    const passRate = +Math.max(70, Math.min(100, 82 + rng() * 16)).toFixed(1);
    const overdue = completionPct < 75 && rng() > 0.5;
    const status: TrainingCampaign['status'] =
      completionPct >= 99 ? 'completed' : overdue ? 'overdue' : 'active';
    return {
      id: `tc_${tenantId}_${i + 1}`,
      tenantId,
      name: t.name,
      contentType: t.type,
      frameworkRef: t.ref,
      enrolled, completed, completionPct, passRate,
      dueAt: new Date(Date.now() + (15 + i * 18) * 86_400_000).toISOString(),
      status
    };
  });
}

// ------------------------ org summary ------------------------

export function humanRiskSummary(tenantId: string): HumanRiskSummary | null {
  if (!HEADCOUNT[tenantId]) return null;
  const p = orgPosture(tenantId);
  const hc = headcount(tenantId);
  const quant = humanRiskQuant(tenantId);
  const rng = mulberry32(hashStringToInt(`hr:sum:${tenantId}`));
  const industryPhishPronePct = INDUSTRY_PPP[industryFor(tenantId)] ?? 31;

  const labels = monthLabels();
  const riskScoreHistory = labels.map((period, m) => {
    const tt = m / 11;
    const score = Math.round(p.orgRiskScore12mAgo + (p.orgRiskScore - p.orgRiskScore12mAgo) * tt + (rng() - 0.5) * 3);
    const ppp = +(p.ppp12mAgo + (p.ppp - p.ppp12mAgo) * tt + (rng() - 0.5) * 1.5).toFixed(1);
    return { period, score: Math.max(8, score), ppp: Math.max(1.5, ppp) };
  });
  riskScoreHistory[11] = { period: labels[11], score: p.orgRiskScore, ppp: p.ppp };

  // Full-population high/critical estimate from PPP and the org score band.
  const usersAtHighRisk = Math.round(hc * (p.ppp / 100) * 1.6);
  const usersAtCriticalRisk = Math.round(hc * (p.ppp / 100) * 0.45);

  return {
    tenantId,
    headcount: hc,
    orgRiskScore: p.orgRiskScore,
    riskLevel: riskLevelFor(p.orgRiskScore),
    orgRiskScore12mAgo: p.orgRiskScore12mAgo,
    phishPronePct: p.ppp,
    phishPronePct12mAgo: p.ppp12mAgo,
    industryPhishPronePct,
    trainingCompletionPct: p.trainingCompletionPct,
    usersAtHighRisk,
    usersAtCriticalRisk,
    campaignsRun12m: 8,
    reportingRatePct: +(38 + rng() * 22).toFixed(1),
    riskScoreHistory,
    quant
  };
}

// Tenants with a KnowBe4 connection (drives nav/connector realism).
export function hasHumanRisk(tenantId: string): boolean {
  return !!HEADCOUNT[tenantId];
}
