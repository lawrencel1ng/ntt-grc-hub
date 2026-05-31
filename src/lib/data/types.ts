// =====================================================================
//  NTT GRC Hub — TypeScript types mirroring the Postgres schema.
//  Column names are camelCase; enums are string literal unions.
//  See db/init.sql for the source-of-truth shapes.
// =====================================================================

// -------------------- Enums --------------------

export type Role = 'admin' | 'risk-owner' | 'control-owner' | 'auditor' | 'agent-operator' | 'viewer';
export type UserStatus = 'active' | 'disabled' | 'invited' | 'locked';

export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type RiskLikelihood = 'rare' | 'unlikely' | 'possible' | 'likely' | 'almost-certain';
export type RiskTreatmentStrategy = 'accept' | 'mitigate' | 'transfer' | 'avoid';
export type RiskStatus = 'identified' | 'assessed' | 'treated' | 'monitoring' | 'closed';

export type ControlMaturity = 'initial' | 'developing' | 'defined' | 'managed' | 'optimised';
export type ControlTestResult = 'pass' | 'fail' | 'partial' | 'na';
export type ControlType = 'technical' | 'process' | 'admin';
export type ControlTestKind = 'manual' | 'automated';

export type AssessmentStatus = 'not-started' | 'in-progress' | 'complete' | 'expired';

export type EvidenceKind = 'screenshot' | 'log' | 'config' | 'attestation' | 'document' | 'scan-result' | 'api-response';
export type EvidenceCollectorKind = 'aws' | 'azure' | 'gcp' | 'okta' | 'jira' | 'm365' | 'github' | 'servicenow' | 'slack' | 'manual';

// The ten GRC evidence domains every tenant's vault is expected to cover.
export type EvidenceDomain =
  | 'policy-governance'
  | 'risk-management'
  | 'iam'
  | 'security-operations'
  | 'infra-config'
  | 'asset-management'
  | 'compliance-audit'
  | 'bcm'
  | 'third-party-vendor'
  | 'security-awareness';

export const EVIDENCE_DOMAINS: EvidenceDomain[] = [
  'policy-governance',
  'risk-management',
  'iam',
  'security-operations',
  'infra-config',
  'asset-management',
  'compliance-audit',
  'bcm',
  'third-party-vendor',
  'security-awareness'
];

export const EVIDENCE_DOMAIN_LABELS: Record<EvidenceDomain, string> = {
  'policy-governance': 'Policy & Governance',
  'risk-management': 'Risk Management',
  'iam': 'Identity & Access',
  'security-operations': 'Security Operations',
  'infra-config': 'Infrastructure & Config',
  'asset-management': 'Asset Management',
  'compliance-audit': 'Compliance & Audit',
  'bcm': 'Business Continuity',
  'third-party-vendor': 'Third Party & Vendor',
  'security-awareness': 'Security Awareness'
};

export type EngagementType = 'internal' | 'external' | 'regulatory' | 'customer';
export type FindingStatus = 'open' | 'closed' | 'accepted-risk';

export type PolicyVersionStatus = 'draft' | 'in-review' | 'approved' | 'retired';

export type VendorTier = '1' | '2' | '3' | '4';
export type VendorCriticality = 'critical' | 'high' | 'medium' | 'low';
export type VendorStatus = 'active' | 'onboarding' | 'offboarded';
export type QuestionnaireStatus = 'sent' | 'in-progress' | 'complete';

export type SubjectRequestKind = 'access' | 'erasure' | 'portability' | 'objection' | 'rectification';
export type SubjectRequestStatus = 'received' | 'in-progress' | 'resolved' | 'rejected';

export type AIRiskTier = 'minimal' | 'limited' | 'high' | 'unacceptable';
export type ISO42001Status = 'compliant' | 'in-progress' | 'non-compliant';
export type AIModelKind = 'classifier' | 'llm' | 'regression' | 'vision' | 'recommender';
export type ModelRiskType = 'bias' | 'hallucination' | 'drift' | 'explainability' | 'privacy';

export type IncidentSeverity = 'sev1' | 'sev2' | 'sev3' | 'sev4';
export type IncidentStatus = 'open' | 'contained' | 'resolved' | 'postmortem-done';

export type IssueStatus = 'open' | 'in-progress' | 'resolved' | 'accepted-risk';
export type IssueSource = 'audit' | 'risk-treatment' | 'incident' | 'control-test' | 'regulatory';
export type ActionStatus = 'not-started' | 'in-progress' | 'done';

export type BCMTestResult = 'pass' | 'partial' | 'fail';
export type BCMTestKind = 'tabletop' | 'walkthrough' | 'simulation' | 'full-failover';
export type BCMDependencyKind = 'people' | 'tech' | 'site' | 'vendor';

export type RegImpact = 'none' | 'low' | 'medium' | 'high';

export type AgentType = 'deterministic' | 'ai-powered' | 'intelligent';
export type AgentStatus = 'idle' | 'running' | 'paused' | 'error';
export type AgentRunStatus = 'queued' | 'running' | 'success' | 'failed' | 'halted' | 'awaiting-approval';
export type AgentDecisionOutcome = 'auto-approved' | 'awaiting-hitl' | 'hitl-approved' | 'hitl-rejected';
export type AgentRunTrigger = 'cron' | 'manual' | 'event';

export type WorkflowExecutionStatus = 'running' | 'success' | 'failed' | 'halted';
export type WorkflowStepKind = 'agent' | 'api' | 'manual' | 'decision';

export type IntegrationStatus = 'connected' | 'degraded' | 'disconnected';
export type IntegrationKind = 'aws' | 'azure' | 'gcp' | 'okta' | 'jira' | 'm365' | 'github' | 'servicenow' | 'slack' | 'splunk' | 'datadog' | 'pagerduty' | 'teams';

// -------------------- Platform --------------------

export interface Tenant {
  id: string;
  name: string;
  industry: string;
  region: string;
  classified: boolean;
  slaTier: 'standard' | 'gold' | 'platinum' | 'sovereign';
  primaryFramework: string;
  headquarteredIn: string;
  mrrSgd: number;
  aiProvider?: string;
  dataResidency?: string;
  createdAt: string;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  mfaEnabled: boolean;
  lastLoginAt?: string;
}

export interface AuditLogEntry {
  id: number;
  ts: string;
  tenantId?: string;
  actorEmail: string;
  action: string;
  target: string;
  result: 'success' | 'failure' | 'denied';
  ipAddress?: string;
  userAgent?: string;
  prevHash?: string;
  rowHash: string;
}

// -------------------- Risk --------------------

export interface Risk {
  id: string;
  tenantId: string;
  registerId?: string;
  code: string;
  title: string;
  description?: string;
  category: string;
  ownerUserId?: string;
  ownerEmail?: string;
  inherentSeverity: RiskSeverity;
  inherentLikelihood: RiskLikelihood;
  residualSeverity: RiskSeverity;
  residualLikelihood: RiskLikelihood;
  status: RiskStatus;
  treatmentStrategy: RiskTreatmentStrategy;
  lastAssessedAt?: string;
  nextReviewAt?: string;
  businessService?: string;
  tags?: Record<string, unknown>;
}

export interface FAIRRun {
  id: string;
  tenantId: string;
  scenarioId: string;
  trials: number;
  lecPercentiles: { p10: number; p25: number; p50: number; p75: number; p90: number; p95: number; p99: number };
  aleSgd: number;
  aro: number;
  runAt: string;
}

export interface FAIRScenario {
  id: string;
  tenantId: string;
  riskId?: string;
  name: string;
  description?: string;
  frequencyDist: { kind: string; min?: number; mode?: number; max?: number; mean?: number; stdev?: number };
  magnitudeDist: { kind: string; min?: number; mode?: number; max?: number; mean?: number; stdev?: number };
}

export interface AppetiteStatement {
  id: string;
  tenantId: string;
  category: string;
  statement: string;
  thresholdSgd: number;
  severityCap: RiskSeverity;
}

export interface HeatmapCell {
  sev: RiskSeverity;
  lik: RiskLikelihood;
  n: number;
}

// -------------------- Control --------------------

export interface Control {
  id: string;
  tenantId: string;
  code: string;
  title: string;
  description?: string;
  type: ControlType;
  family: string[];
  ownerUserId?: string;
  ownerEmail?: string;
  frequency: string;
  automated: boolean;
  maturity: ControlMaturity;
  lastTestResult?: ControlTestResult;
  lastTestedAt?: string;
}

export interface ControlMapping {
  id: number;
  controlId: string;
  frameworkId: string;
  requirementId?: string;
  coveragePct: number;
  notes?: string;
}

export interface ControlTest {
  id: string;
  tenantId: string;
  controlId: string;
  name: string;
  kind: ControlTestKind;
  scheduleCron?: string;
  procedureMd?: string;
}

export interface ControlException {
  id: string;
  tenantId: string;
  controlId: string;
  justification: string;
  granted: boolean;
  expiresAt?: string;
  createdAt: string;
}

export interface ControlTestRun {
  id: number;
  tenantId: string;
  controlId: string;
  controlCode?: string;
  controlTitle?: string;
  testId?: string;
  ranAt: string;
  result: ControlTestResult;
  evidenceItemId?: number;
  agentRunId?: number;
  notes?: string;
  durationMs?: number;
}

// -------------------- Compliance --------------------

export interface Framework {
  id: string;
  name: string;
  version: string;
  regulator: string;
  region: string;
  jurisdiction: string;
  totalRequirements: number;
  tags: string[];
}

export interface Requirement {
  id: string;
  frameworkId: string;
  code: string;
  title: string;
  description?: string;
  parentRequirementId?: string;
  weight: number;
}

export interface Assessment {
  id: string;
  tenantId: string;
  frameworkId: string;
  status: AssessmentStatus;
  score?: number;
  startedAt?: string;
  completedAt?: string;
  nextDueAt?: string;
}

export interface FrameworkScore {
  tenantId: string;
  frameworkId: string;
  name: string;
  version: string;
  region: string;
  status: AssessmentStatus;
  score: number;
  nextDueAt?: string;
}

// -------------------- Evidence --------------------

export interface EvidenceCollector {
  id: string;
  tenantId: string;
  name: string;
  kind: EvidenceCollectorKind;
  scheduleCron?: string;
  lastRunAt?: string;
  enabled: boolean;
}

export interface EvidenceItem {
  id: number;
  tenantId: string;
  collectorId?: string;
  controlId?: string;
  kind: EvidenceKind;
  domain?: EvidenceDomain;
  title: string;
  sourceUrl?: string;
  blobUrl?: string;
  capturedAt: string;
  agentRunId?: number;
  metadata?: Record<string, unknown>;
  rowHash?: string;
  prevHash?: string;
}

// -------------------- Audit --------------------

export interface AuditEngagement {
  id: string;
  tenantId: string;
  name: string;
  type: EngagementType;
  leadAuditor: string;
  openedAt: string;
  closedAt?: string;
  scope?: string;
  frameworkId?: string;
}

export interface AuditFinding {
  id: string;
  tenantId: string;
  engagementId: string;
  severity: RiskSeverity;
  title: string;
  description?: string;
  controlId?: string;
  dueAt?: string;
  status: FindingStatus;
}

// -------------------- Policy --------------------

export interface Policy {
  id: string;
  tenantId: string;
  code: string;
  title: string;
  jurisdiction: string;
  currentVersionId?: string;
  status?: PolicyVersionStatus;
  ownerEmail?: string;
}

export interface PolicyVersion {
  id: string;
  tenantId: string;
  documentId: string;
  versionNo: string;
  contentMd: string;
  status: PolicyVersionStatus;
  effectiveAt?: string;
  draftedByAgentId?: string;
}

// -------------------- Vendor --------------------

export interface Vendor {
  id: string;
  tenantId: string;
  name: string;
  category: string;
  tier: VendorTier;
  criticality: VendorCriticality;
  hqCountry: string;
  primaryContactEmail: string;
  status: VendorStatus;
  contractValueSgd?: number;
  lastQuestionnaireScore?: number;
  employeeCount?: number;
}

export interface VendorContract {
  id: string;
  tenantId: string;
  vendorId: string;
  contractNo: string;
  valueSgd: number;
  startsAt: string;
  endsAt?: string;
  renewalWindowDays: number;
}

export interface Questionnaire {
  id: string;
  tenantId: string;
  vendorId: string;
  vendorName?: string;
  template: 'SIG' | 'CAIQ' | 'Custom';
  status: QuestionnaireStatus;
  sentAt: string;
  completedAt?: string;
  completedByAgentId?: string;
  score?: number;
}

export interface QuestionnaireResponse {
  id: number;
  questionnaireId: string;
  questionCode: string;
  response: string;
  confidence: number;
  sourceEvidenceItemId?: number;
}

export interface FourthParty {
  id: string;
  tenantId: string;
  vendorId: string;
  vendorName?: string;
  name: string;
  type: 'cloud' | 'saas' | 'processor';
  region: string;
  criticality: VendorCriticality;
}

export interface Concentration {
  id: string;
  tenantId: string;
  dimension: 'cloud' | 'region' | 'processor';
  key: string;
  vendorCount: number;
  exposureSgd: number;
}

// -------------------- Privacy --------------------

export interface PrivacyActivity {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  controller: string;
  processor?: string;
  purpose: string;
  lawfulBasis: string;
  dataCategories: string[];
  retentionPeriod: string;
  crossBorder: boolean;
  jurisdictions: string[];
}

export interface DPIA {
  id: string;
  tenantId: string;
  activityId: string;
  activityName?: string;
  status: 'draft' | 'in-review' | 'approved' | 'retired';
  residualRiskSeverity: RiskSeverity;
  conductedAt?: string;
  conductedByEmail?: string;
}

export interface SubjectRequest {
  id: string;
  tenantId: string;
  kind: SubjectRequestKind;
  requesterEmail: string;
  receivedAt: string;
  dueAt: string;
  status: SubjectRequestStatus;
  resolvedAt?: string;
}

export interface Breach {
  id: string;
  tenantId: string;
  code: string;
  severity: RiskSeverity;
  occurredAt: string;
  detectedAt: string;
  reportedAt?: string;
  affectedSubjects: number;
  regulatorNotified: boolean;
  rootCause: string;
}

// -------------------- ESG --------------------

export interface ESGMetric {
  id: number;
  tenantId: string;
  period: string;
  scope: 'scope1' | 'scope2' | 'scope3';
  category: string;
  metric: string;
  value: number;
  unit: string;
  framework: 'CSRD' | 'ISSB' | 'GHG' | 'TCFD';
}

export interface ESGDisclosure {
  id: string;
  tenantId: string;
  framework: string;
  period: string;
  status: 'draft' | 'in-review' | 'published' | 'retired';
  publishedAt?: string;
}

export interface ESGTarget {
  id: string;
  tenantId: string;
  framework: string;
  metric: string;
  baselineValue: number;
  baselinePeriod: string;
  targetValue: number;
  targetPeriod: string;
  ownerEmail?: string;
}

// -------------------- AI Governance --------------------

export interface AIModel {
  id: string;
  tenantId: string;
  name: string;
  kind: AIModelKind;
  riskTier: AIRiskTier;
  jurisdiction: string;
  euAiActClass: string;
  iso42001Status: ISO42001Status;
  ownerUserId?: string;
  ownerEmail?: string;
  trainingDataSummary?: string;
}

export interface ModelRisk {
  id: string;
  tenantId: string;
  modelId: string;
  riskType: ModelRiskType;
  severity: RiskSeverity;
  mitigation: string;
}

export interface PromptAuditEntry {
  id: number;
  tenantId: string;
  modelId: string;
  agentRunId?: number;
  promptRedacted: string;
  responseRedacted: string;
  tokensIn: number;
  tokensOut: number;
  costCents: number;
  capturedAt: string;
}

// -------------------- Incidents --------------------

export interface Incident {
  id: string;
  tenantId: string;
  code: string;
  severity: IncidentSeverity;
  title: string;
  status: IncidentStatus;
  openedAt: string;
  containedAt?: string;
  resolvedAt?: string;
}

export interface TimelineEvent {
  id: number;
  tenantId: string;
  incidentId: string;
  ts: string;
  actor: string;
  event: string;
  source: 'agent' | 'human' | 'system';
}

export interface Postmortem {
  id: string;
  tenantId: string;
  incidentId: string;
  rootCauseMd: string;
  correctiveActionsMd: string;
  draftedByAgentId?: string;
  signedOffAt?: string;
}

// -------------------- Issues --------------------

export interface Issue {
  id: string;
  tenantId: string;
  source: IssueSource;
  sourceId: string;
  title: string;
  description?: string;
  severity: RiskSeverity;
  status: IssueStatus;
  ownerUserId?: string;
  ownerEmail?: string;
  dueAt?: string;
  createdAt?: string;
}

export interface IssueAction {
  id: string;
  tenantId: string;
  issueId: string;
  description: string;
  dueAt?: string;
  status: ActionStatus;
}

// -------------------- BCM --------------------

export interface BCMPlan {
  id: string;
  tenantId: string;
  name: string;
  businessService: string;
  rtoMinutes: number;
  rpoMinutes: number;
  lastTestedAt?: string;
  nextTestAt?: string;
  description?: string;
  recoveryStrategy?: string;
  ownerUserId?: string;
  ownerEmail?: string;
}

export interface BCMEscalationContact {
  id: string;
  tenantId: string;
  planId: string;
  role: string;
  name: string;
  email?: string;
  phone?: string;
  sortOrder: number;
}

export interface RiskHistoryEntry {
  ts: string;
  event: string;
  actor: string;
}

export interface BCMDependency {
  id: string;
  tenantId: string;
  planId: string;
  dependencyKind: BCMDependencyKind;
  name: string;
  criticality: VendorCriticality;
  downtimeToleranceHours: number;
}

export interface BCMTest {
  id: string;
  tenantId: string;
  planId: string;
  kind: BCMTestKind;
  conductedAt: string;
  result: BCMTestResult;
  lessonsMd: string;
}

// -------------------- Regwatch --------------------

export interface RegSource {
  id: string;
  regulatorCode: string;
  name: string;
  sourceUrl: string;
  jurisdiction: string;
  lastScannedAt?: string;
  enabled: boolean;
}

export interface RegChange {
  id: string;
  sourceId: string;
  sourceName?: string;
  regulatorCode?: string;
  title: string;
  summary?: string;
  publishedAt: string;
  effectiveAt?: string;
  severity: RiskSeverity;
  detectedByAgentId?: string;
}

export interface ImpactAssessment {
  id: string;
  tenantId: string;
  tenantName?: string;
  changeId: string;
  frameworkId?: string;
  frameworkName?: string;
  impact: RegImpact;
  gapsOpened: number;
  assessedByAgentId?: string;
  assessedAt: string;
  notes?: string;
}

// -------------------- Agent --------------------

export interface Agent {
  id: string;
  name: string;
  slug: string;
  description: string;
  type: AgentType;
  status: AgentStatus;
  ownerTeam: string;
  costPerRunCents: number;
  costMonthlyEstimateCents: number;
  fteEquivalent: number;
}

export interface AgentTool {
  agentId: string;
  toolName: string;
  toolKind: 'api' | 'db' | 'llm' | 'search' | 'script';
  description: string;
}

export interface AgentRun {
  id: number;
  tenantId?: string;
  agentId: string;
  agentName?: string;
  trigger: AgentRunTrigger;
  startedAt: string;
  endedAt?: string;
  status: AgentRunStatus;
  inputSummary: string;
  outputSummary: string;
  toolsCalled: string[];
  costCents: number;
  latencyMs: number;
}

export interface AgentDecision {
  id: number;
  tenantId?: string;
  agentId: string;
  agentName?: string;
  runId: number;
  decisionType: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  confidence: number;
  outcome: AgentDecisionOutcome;
  approverUserId?: string;
  decidedAt: string;
}

export interface CostLedgerEntry {
  id?: number;
  tenantId: string;
  agentId: string;
  ts: string;
  runs: number;
  costCents: number;
  fteSavedHours: number;
}

export interface AgentFleetSummary {
  id: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  runs30d: number;
  costCents30d: number;
  fteHours30d: number;
}

// -------------------- Workflow --------------------

export interface WorkflowStepDef {
  kind: 'agent' | 'api' | 'manual' | 'decision';
  ref?: string;
  label: string;
  requiresApproval?: boolean;
}

export interface Workflow {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  steps: WorkflowStepDef[];
  version: number;
  enabled: boolean;
  lastExecutionStatus?: WorkflowExecutionStatus;
  successRate30d?: number;
}

export interface WorkflowExecution {
  id: number;
  tenantId: string;
  workflowId: string;
  workflowName?: string;
  trigger: string;
  startedAt: string;
  endedAt?: string;
  status: WorkflowExecutionStatus;
}

// -------------------- Integration --------------------

export interface Connector {
  id: string;
  tenantId: string;
  kind: string;
  name: string;
  status: IntegrationStatus;
  lastSyncAt?: string;
  recordsIngested24h?: number;
}

// -------------------- Human Risk (KnowBe4) --------------------
//  Security-awareness / human-risk-management telemetry sourced from
//  KnowBe4 (Virtual Risk Officer). Per-user risk scoring rolls up to an
//  org Human Risk Score and is quantified into a FAIR ALE that feeds the
//  enterprise risk register and quantitative risk reporting.

export type HumanRiskLevel = 'low' | 'moderate' | 'high' | 'critical';
// Outcome of the most recent simulated phishing test for a user.
export type PhishResult = 'reported' | 'no-action' | 'opened' | 'clicked' | 'data-entered';

export interface HumanRiskUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  department: string;
  jobTitle: string;
  riskScore: number;          // 0–100, higher = riskier (KnowBe4 convention)
  riskLevel: HumanRiskLevel;
  riskScore30dDelta: number;  // change vs 30 days ago (negative = improving)
  phishingSent: number;
  phishingClicked: number;
  phishingReported: number;
  phishingDataEntered: number;
  lastPhishResult: PhishResult;
  lastPhishAt?: string;
  trainingAssigned: number;
  trainingCompleted: number;
  trainingCompletionPct: number;
  lastTrainingAt?: string;
  mfaEnabled: boolean;
  privilegedAccess: boolean;  // risk booster
  riskHistory: number[];      // last 12 monthly risk scores (oldest → newest)
}

export interface HumanRiskDepartment {
  tenantId: string;
  department: string;
  headcount: number;
  avgRiskScore: number;
  riskLevel: HumanRiskLevel;
  phishPronePct: number;
  trainingCompletionPct: number;
  highRiskUsers: number;
}

export interface PhishingCampaign {
  id: string;
  tenantId: string;
  name: string;
  template: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  sentAt: string;
  recipients: number;
  delivered: number;
  opened: number;
  clicked: number;
  dataEntered: number;
  reported: number;
  phishPronePct: number;
  status: 'scheduled' | 'in-progress' | 'closed';
}

export interface TrainingCampaign {
  id: string;
  tenantId: string;
  name: string;
  contentType: 'video' | 'interactive' | 'assessment' | 'policy-ack';
  frameworkRef?: string;      // mapped control/requirement, e.g. 'ISO 27001 A.6.3'
  enrolled: number;
  completed: number;
  completionPct: number;
  passRate: number;
  dueAt: string;
  status: 'active' | 'completed' | 'overdue';
}

// Quantified human-risk loss exposure — the bridge from KnowBe4 telemetry
// into FAIR / the enterprise risk register.
export interface HumanRiskQuant {
  aro: number;                // annualised rate of a successful phishing-led compromise
  perIncidentMeanSgd: number; // mean single-loss magnitude (lognormal mean)
  perIncidentStdevSgd: number;
  aleSgd: number;             // ARO × per-incident mean
  aleSgd12mAgo: number;       // ALE a year ago, before training uplift
  aleReducedSgd: number;      // avoided annualised loss from the training programme
  riskId: string;             // ERM register entry this quant feeds
  scenarioId: string;         // FAIR scenario id on the heatmap
}

export interface HumanRiskSummary {
  tenantId: string;
  headcount: number;
  orgRiskScore: number;       // 0–100
  riskLevel: HumanRiskLevel;
  orgRiskScore12mAgo: number;
  phishPronePct: number;
  phishPronePct12mAgo: number;
  industryPhishPronePct: number;   // industry benchmark for the same period
  trainingCompletionPct: number;
  usersAtHighRisk: number;
  usersAtCriticalRisk: number;
  campaignsRun12m: number;
  reportingRatePct: number;        // % of phishing tests reported (good behaviour)
  riskScoreHistory: { period: string; score: number; ppp: number }[];
  quant: HumanRiskQuant;
}

// -------------------- KPI snapshots --------------------

export interface KpiSnapshot {
  openCriticalRisks: number;
  avgComplianceScore: number;
  openFindings: number;
  vendorRiskIndex: number;
  agentFteSaved30d: number;
  evidenceItems30d: number;
}

export interface RiskTreatment {
  id: string;
  tenantId: string;
  riskId: string;
  strategy: RiskTreatmentStrategy;
  description: string;
  ownerUserId?: string;
  ownerEmail?: string;
  dueAt?: string;
  completedAt?: string;
  costSgd?: number;
  createdAt: string;
}

export interface AuditWorkpaper {
  id: string;
  tenantId: string;
  engagementId: string;
  title: string;
  contentMd: string;
  createdBy?: string;
  createdAt: string;
}

export interface PolicyAck {
  id: number;
  tenantId: string;
  versionId: string;
  userId: string;
  acknowledgedAt: string;
}

export interface PolicyException {
  id: string;
  tenantId: string;
  documentId: string;
  requesterUserId?: string;
  justification: string;
  granted: boolean;
  grantedByUserId?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface ComplianceGap {
  id: string;
  tenantId: string;
  assessmentId: string;
  requirementId: string;
  requirementCode: string;
  requirementTitle: string;
  severity: RiskSeverity;
  remediationPlan?: string;
  targetDate?: string;
  ownerUserId?: string;
  ownerEmail?: string;
  createdAt: string;
}

export interface ComplianceAttestation {
  id: string;
  tenantId: string;
  frameworkId: string;
  signedByUserId?: string;
  signedAt: string;
  validUntil?: string;
  attestationText: string;
  createdAt: string;
}

export interface RequirementCoverage {
  requirementId: string;
  coveragePct: number;
  controlCount: number;
}
