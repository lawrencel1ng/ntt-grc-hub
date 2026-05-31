// =====================================================================
//  Server-side data dispatcher. Every public function checks DATA_MODE
//  and either issues a Postgres query (when `pg`) or returns the
//  in-memory mock fixtures (default). Routes import only from here so
//  swapping the backing store is a one-line change.
// =====================================================================

import { env } from '$env/dynamic/private';
import { isPgMode, getPool } from './pg';
import { callLlm, getTenantProvider } from './llm';
import * as mock from '$lib/data/mock';
import type {
  Tenant, Agent, AgentRun, AgentDecision, AgentFleetSummary, CostLedgerEntry, AgentTool,
  Risk, FAIRRun, AppetiteStatement, HeatmapCell,
  Framework, Requirement, FrameworkScore,
  Control, ControlMapping, ControlTest, ControlException, ControlTestRun,
  EvidenceItem,
  AuditEngagement, AuditFinding,
  Policy, PolicyVersion,
  Vendor, VendorContract, Questionnaire, FourthParty, Concentration, QuestionnaireResponse,
  PrivacyActivity, DPIA, SubjectRequest, Breach,
  ESGMetric, ESGDisclosure, ESGTarget,
  AIModel, ModelRisk, PromptAuditEntry,
  Incident, TimelineEvent, Postmortem,
  Issue, IssueAction,
  BCMPlan, BCMDependency, BCMTest, BCMEscalationContact,
  RiskHistoryEntry,
  RegChange, ImpactAssessment, RegSource,
  Workflow, WorkflowExecution,
  Connector,
  AuditLogEntry,
  KpiSnapshot,
  HumanRiskSummary, HumanRiskUser, HumanRiskDepartment, PhishingCampaign, TrainingCampaign,
  ComplianceGap, ComplianceAttestation, RequirementCoverage,
  RiskTreatment, AuditWorkpaper, PolicyAck, PolicyException
} from '$lib/data/types';

const HERO_TENANTS = ['t_maybank', 't_mindef', 't_grab'] as const;

async function safeQuery<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  try {
    const { rows } = await getPool().query(sql, params);
    return rows as T[];
  } catch (e) {
    console.warn('[data] pg query failed, returning empty:', (e as Error).message);
    return [];
  }
}


// =====================================================================
// Tenants
// =====================================================================

export async function getTenantSummaries(): Promise<Tenant[]> {
  if (!isPgMode()) return mock.TENANTS;
  const rows = await safeQuery<Tenant>(
    `SELECT id, name, industry, region, classified,
            sla_tier AS "slaTier", primary_framework AS "primaryFramework",
            headquartered_in AS "headquarteredIn", mrr_sgd AS "mrrSgd",
            COALESCE(ai_provider, 'anthropic') AS "aiProvider",
            COALESCE(data_residency, 'SG') AS "dataResidency",
            created_at AS "createdAt"
     FROM platform.tenants ORDER BY name LIMIT 500`
  );
  return rows;
}

export async function getCurrentTenant(tenantId: string): Promise<Tenant | undefined> {
  const all = await getTenantSummaries();
  return all.find((t) => t.id === tenantId);
}

export async function getUsers(tenantId?: string): Promise<import('$lib/data/types').User[]> {
  if (!isPgMode()) {
    const { getUsersAll, getUsersForTenant } = await import('$lib/data/users');
    return tenantId ? getUsersForTenant(tenantId) : getUsersAll();
  }
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<import('$lib/data/types').User>(
    `SELECT id::text AS id, tenant_id AS "tenantId", email, name,
            role::text AS role, status::text AS status,
            mfa_enabled AS "mfaEnabled",
            last_login_at AS "lastLoginAt"
     FROM platform.users ${where} ORDER BY name LIMIT 2000`, params
  );
  return rows;
}

// =====================================================================
// Agents
// =====================================================================

export async function getLiveAgentCount(_tenantId?: string): Promise<number> {
  if (!isPgMode()) return mock.liveAgentCount();
  // agent.agents is platform-global; count running agents across the fleet
  const rows = await safeQuery<{ n: string }>(`SELECT COUNT(*)::text AS n FROM agent.agents WHERE status = 'running'`);
  return rows.length ? Number(rows[0].n) : 0;
}

export async function getNavBadgeCounts(tenantId?: string): Promise<{ agents: number; frameworks: number; connectors: number }> {
  if (!isPgMode()) {
    const { AGENTS } = await import('$lib/data/agents');
    const { FRAMEWORKS } = await import('$lib/data/frameworks');
    return { agents: AGENTS.length, frameworks: FRAMEWORKS.length, connectors: 40 };
  }
  // agent.agents and compliance.frameworks are platform-global catalogs — no tenant filter
  const tenantParams = tenantId ? [tenantId] : [];
  const tenantWhere = tenantId ? 'WHERE tenant_id = $1' : '';
  const [agRows, fwRows, cnRows] = await Promise.all([
    safeQuery<{ n: string }>(`SELECT COUNT(*)::text AS n FROM agent.agents`),
    safeQuery<{ n: string }>(`SELECT COUNT(*)::text AS n FROM compliance.frameworks`),
    safeQuery<{ n: string }>(`SELECT COUNT(*)::text AS n FROM integration.connectors ${tenantWhere}`, tenantParams)
  ]);
  return {
    agents: agRows.length ? Number(agRows[0].n) : 0,
    frameworks: fwRows.length ? Number(fwRows[0].n) : 0,
    connectors: cnRows.length ? Number(cnRows[0].n) : 0
  };
}

export async function getAgents(): Promise<Agent[]> {
  if (!isPgMode()) return mock.AGENTS;
  const rows = await safeQuery<Agent>(
    `SELECT id, name, slug, description, type::text AS type, status, owner_team AS "ownerTeam",
            cost_per_run_cents AS "costPerRunCents", cost_monthly_estimate_cents AS "costMonthlyEstimateCents",
            fte_equivalent AS "fteEquivalent"
     FROM agent.agents ORDER BY name LIMIT 500`
  );
  return rows;
}

export async function getAgent(id: string): Promise<Agent | undefined> {
  if (!isPgMode()) return (await getAgents()).find((a) => a.id === id);
  const rows = await safeQuery<Agent>(
    `SELECT id, name, slug, description, type::text AS type, status, owner_team AS "ownerTeam",
            cost_per_run_cents AS "costPerRunCents", cost_monthly_estimate_cents AS "costMonthlyEstimateCents",
            fte_equivalent AS "fteEquivalent"
     FROM agent.agents WHERE id = $1 LIMIT 1`, [id]
  );
  return rows[0];
}

export async function getAgentTools(agentId: string): Promise<AgentTool[]> {
  if (!isPgMode()) return mock.AGENT_TOOLS.filter((t) => t.agentId === agentId);
  const rows = await safeQuery<AgentTool>(
    `SELECT agent_id AS "agentId", tool_name AS "toolName", tool_kind AS "toolKind", description
     FROM agent.tools WHERE agent_id = $1`, [agentId]
  );
  return rows;
}

export async function getRecentAgentRuns(limit = 20, tenantId?: string): Promise<AgentRun[]> {
  if (!isPgMode()) return mock.recentAgentRuns(limit, tenantId);
  const where = tenantId ? 'WHERE r.tenant_id = $2' : '';
  const params: unknown[] = [limit];
  if (tenantId) params.push(tenantId);
  const rows = await safeQuery<AgentRun>(
    `SELECT r.id, r.tenant_id AS "tenantId", r.agent_id AS "agentId", a.name AS "agentName",
            r.trigger::text AS trigger, r.started_at AS "startedAt", r.ended_at AS "endedAt",
            r.status::text AS status, r.input_summary AS "inputSummary", r.output_summary AS "outputSummary",
            r.tools_called AS "toolsCalled", r.cost_cents AS "costCents", r.latency_ms AS "latencyMs"
     FROM agent.runs r JOIN agent.agents a ON a.id = r.agent_id
     ${where} ORDER BY r.started_at DESC LIMIT $1`, params
  );
  return rows;
}

export async function getAgentRunsForAgent(agentId: string, limit = 20, tenantId?: string): Promise<AgentRun[]> {
  if (!isPgMode()) return mock.recentAgentRuns(limit).filter((r) => r.agentId === agentId);
  const tenantClause = tenantId ? ' AND r.tenant_id = $3' : '';
  const params: unknown[] = [agentId, limit];
  if (tenantId) params.push(tenantId);
  const rows = await safeQuery<AgentRun>(
    `SELECT r.id, r.tenant_id AS "tenantId", r.agent_id AS "agentId", a.name AS "agentName",
            r.trigger::text AS trigger, r.started_at AS "startedAt", r.ended_at AS "endedAt",
            r.status::text AS status, r.input_summary AS "inputSummary", r.output_summary AS "outputSummary",
            r.tools_called AS "toolsCalled", r.cost_cents AS "costCents", r.latency_ms AS "latencyMs"
     FROM agent.runs r JOIN agent.agents a ON a.id = r.agent_id
     WHERE r.agent_id = $1${tenantClause} ORDER BY r.started_at DESC LIMIT $2`, params
  );
  return rows;
}

export async function getRecentDecisions(limit = 20, tenantId?: string): Promise<AgentDecision[]> {
  if (!isPgMode()) return mock.recentDecisions(limit, tenantId);
  const where = tenantId ? 'WHERE d.tenant_id = $2' : '';
  const params: unknown[] = [limit];
  if (tenantId) params.push(tenantId);
  const rows = await safeQuery<AgentDecision>(
    `SELECT d.id, d.tenant_id AS "tenantId", d.agent_id AS "agentId", a.name AS "agentName",
            d.run_id AS "runId", d.decision_type AS "decisionType", d.input, d.output,
            d.confidence, d.outcome::text AS outcome, d.approver_user_id AS "approverUserId",
            d.decided_at AS "decidedAt"
     FROM agent.decisions d JOIN agent.agents a ON a.id = d.agent_id
     ${where} ORDER BY d.decided_at DESC LIMIT $1`, params
  );
  return rows;
}

export async function getAgentDecisions(filter: { agentId?: string; tenantId?: string; outcome?: string; limit?: number }): Promise<AgentDecision[]> {
  const limit = filter.limit ?? 50;
  if (!isPgMode()) {
    let out = mock.recentDecisions(limit, filter.tenantId);
    if (filter.agentId) out = out.filter((d) => d.agentId === filter.agentId);
    if (filter.outcome) out = out.filter((d) => d.outcome === filter.outcome);
    return out;
  }
  const clauses: string[] = [];
  const params: unknown[] = [limit];
  if (filter.tenantId) { params.push(filter.tenantId); clauses.push(`d.tenant_id = $${params.length}`); }
  if (filter.agentId)  { params.push(filter.agentId);  clauses.push(`d.agent_id = $${params.length}`); }
  if (filter.outcome)  { params.push(filter.outcome);  clauses.push(`d.outcome = $${params.length}::agent.decision_outcome`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await safeQuery<AgentDecision>(
    `SELECT d.id, d.tenant_id AS "tenantId", d.agent_id AS "agentId", a.name AS "agentName",
            d.run_id AS "runId", d.decision_type AS "decisionType", d.input, d.output,
            d.confidence, d.outcome::text AS outcome, d.approver_user_id AS "approverUserId",
            d.decided_at AS "decidedAt"
     FROM agent.decisions d JOIN agent.agents a ON a.id = d.agent_id
     ${where} ORDER BY d.decided_at DESC LIMIT $1`, params
  );
  return rows;
}

export async function getCostLedger30d(tenantId?: string): Promise<CostLedgerEntry[]> {
  if (!isPgMode()) return mock.agentCostLedger30d(tenantId);
  const timeClause = `ts >= now() - interval '30 days'`;
  const where = tenantId ? `WHERE tenant_id = $1 AND ${timeClause}` : `WHERE ${timeClause}`;
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<CostLedgerEntry>(
    `SELECT tenant_id AS "tenantId", agent_id AS "agentId", ts, runs, cost_cents AS "costCents",
            fte_saved_hours AS "fteSavedHours"
     FROM agent.cost_ledger ${where} ORDER BY ts DESC LIMIT 2000`,
    params
  );
  return rows;
}

export async function getAgentFleetSummary(): Promise<AgentFleetSummary[]> {
  if (!isPgMode()) return mock.agentFleetSummary();
  const rows = await safeQuery<AgentFleetSummary>(
    `SELECT id, name, type::text AS type, status,
            runs_30d AS "runs30d", cost_cents_30d AS "costCents30d", fte_hours_30d AS "fteHours30d"
     FROM agent.fleet_summary`
  );
  return rows;
}

// =====================================================================
// Risk
// =====================================================================

export async function getRisks(tenantId?: string, businessServiceLike?: string): Promise<Risk[]> {
  if (!isPgMode()) {
    const all = tenantId ? mock.risksForTenant(tenantId) : HERO_TENANTS.flatMap((t) => mock.risksForTenant(t));
    return businessServiceLike
      ? all.filter((r) => r.businessService?.toLowerCase().includes(businessServiceLike.toLowerCase()))
      : all;
  }
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (tenantId) { params.push(tenantId); clauses.push(`r.tenant_id = $${params.length}`); }
  if (businessServiceLike) { params.push(`%${businessServiceLike}%`); clauses.push(`r.business_service ILIKE $${params.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const orderBy = tenantId ? 'ORDER BY r.code' : 'ORDER BY r.tenant_id, r.code';
  const rows = await safeQuery<Risk>(
    `SELECT r.id::text AS id, r.tenant_id AS "tenantId", r.register_id::text AS "registerId",
            r.code, r.title, r.description, r.category,
            r.inherent_severity::text AS "inherentSeverity",
            r.inherent_likelihood::text AS "inherentLikelihood",
            r.residual_severity::text AS "residualSeverity",
            r.residual_likelihood::text AS "residualLikelihood",
            r.status::text AS status,
            r.treatment_strategy::text AS "treatmentStrategy",
            r.last_assessed_at AS "lastAssessedAt", r.next_review_at AS "nextReviewAt",
            r.business_service AS "businessService", r.tags,
            r.owner_user_id::text AS "ownerUserId", u.email AS "ownerEmail"
     FROM risk.risks r
     LEFT JOIN platform.users u ON u.id = r.owner_user_id
     ${where} ${orderBy} LIMIT 2000`,
    params
  );
  return rows;
}

export async function getRisk(id: string): Promise<Risk | undefined> {
  if (isPgMode()) {
    const rows = await safeQuery<Risk>(
      `SELECT r.id::text AS id, r.tenant_id AS "tenantId", r.register_id::text AS "registerId",
              r.code, r.title, r.description, r.category,
              r.inherent_severity::text AS "inherentSeverity",
              r.inherent_likelihood::text AS "inherentLikelihood",
              r.residual_severity::text AS "residualSeverity",
              r.residual_likelihood::text AS "residualLikelihood",
              r.status::text AS status,
              r.treatment_strategy::text AS "treatmentStrategy",
              r.last_assessed_at AS "lastAssessedAt", r.next_review_at AS "nextReviewAt",
              r.business_service AS "businessService", r.tags,
              r.owner_user_id::text AS "ownerUserId", u.email AS "ownerEmail"
         FROM risk.risks r
         LEFT JOIN platform.users u ON u.id = r.owner_user_id
        WHERE r.id = $1::uuid LIMIT 1`, [id]
    );
    return rows[0];
  }
  // Decode tenant from the mock id prefix.
  const parts = id.split('_');
  if (parts.length < 3) return undefined;
  const tenantId = `${parts[1]}_${parts[2]}`;
  const all = await getRisks(tenantId);
  return all.find((r) => r.id === id);
}

const SEV_RANK: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, informational: 1 };
const LIK_RANK: Record<string, number> = { 'almost-certain': 5, likely: 4, possible: 3, unlikely: 2, rare: 1 };

export async function getTopRisks(n: number, tenantId?: string): Promise<Risk[]> {
  if (!isPgMode()) return mock.topRisks(tenantId, n);
  const all = await getRisks(tenantId);
  return all
    .filter((r) => r.status !== 'closed')
    .sort((a, b) => {
      const rankA = (SEV_RANK[a.residualSeverity] ?? 0) * (LIK_RANK[a.residualLikelihood] ?? 0);
      const rankB = (SEV_RANK[b.residualSeverity] ?? 0) * (LIK_RANK[b.residualLikelihood] ?? 0);
      return rankB - rankA;
    })
    .slice(0, n);
}

export async function getHeatmapCells(tenantId?: string): Promise<HeatmapCell[]> {
  if (!isPgMode()) return mock.heatmapCells(tenantId);
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<HeatmapCell>(
    `SELECT sev::text AS sev, lik::text AS lik, n::int AS n FROM risk.heatmap_cells ${where}`,
    params
  );
  return rows;
}

export async function getFairRun(scenarioOrRiskId: string): Promise<FAIRRun | null> {
  if (!isPgMode()) return mock.fairRunForRisk(scenarioOrRiskId);
  // Try scenario_id first, then fall back to risk_id join.
  const rows = await safeQuery<FAIRRun>(
    `SELECT fr.id::text AS id, fr.tenant_id AS "tenantId", fr.scenario_id::text AS "scenarioId",
            fr.trials, fr.lec_percentiles AS "lecPercentiles",
            fr.ale_sgd AS "aleSgd", fr.aro, fr.run_at AS "runAt"
     FROM risk.fair_runs fr
     JOIN risk.scenarios s ON s.id = fr.scenario_id
     WHERE fr.scenario_id = $1::uuid OR s.risk_id = $1::uuid
     ORDER BY fr.run_at DESC LIMIT 1`,
    [scenarioOrRiskId]
  );
  return rows[0] ?? null;
}

export async function getFairScenarios(tenantId?: string) {
  if (!isPgMode()) return mock.fairScenariosForTenant(tenantId ?? 't_maybank');
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<import('$lib/data/types').FAIRScenario>(
    `SELECT id::text AS id, tenant_id AS "tenantId", risk_id::text AS "riskId",
            name, description, frequency_dist AS "frequencyDist", magnitude_dist AS "magnitudeDist"
     FROM risk.scenarios ${where} ORDER BY name`,
    params
  );
  return rows;
}

export async function getFairScenariosForRisk(riskId: string) {
  if (!isPgMode()) {
    const parts = riskId.split('_');
    if (parts.length < 3) return [];
    const tenantId = `${parts[1]}_${parts[2]}`;
    const all = await getFairScenarios(tenantId);
    return all.filter((s) => s.riskId === riskId);
  }
  const rows = await safeQuery<import('$lib/data/types').FAIRScenario>(
    `SELECT id::text AS id, tenant_id AS "tenantId", risk_id::text AS "riskId",
            name, description, frequency_dist AS "frequencyDist", magnitude_dist AS "magnitudeDist"
     FROM risk.scenarios WHERE risk_id = $1::uuid`,
    [riskId]
  );
  return rows;
}

export async function getRiskTreatments(riskId: string): Promise<RiskTreatment[]> {
  if (!isPgMode()) return [];
  return safeQuery<RiskTreatment>(
    `SELECT t.id::text AS id, t.tenant_id AS "tenantId", t.risk_id::text AS "riskId",
            t.strategy::text AS strategy, t.description,
            t.owner_user_id AS "ownerUserId", u.email AS "ownerEmail",
            t.due_at AS "dueAt", t.completed_at AS "completedAt",
            t.cost_sgd AS "costSgd", t.created_at AS "createdAt"
     FROM risk.treatments t
     LEFT JOIN platform.users u ON u.id = t.owner_user_id
     WHERE t.risk_id = $1::uuid ORDER BY t.created_at`, [riskId]
  );
}

export async function getRiskHistory(riskId: string): Promise<RiskHistoryEntry[]> {
  if (!isPgMode()) return [];
  return safeQuery<RiskHistoryEntry>(
    `SELECT ts, event, actor FROM (
       SELECT ts,
              action AS event,
              COALESCE(actor_email, 'system') AS actor
       FROM platform.audit_log
       WHERE target = 'risk:' || $1::text
       UNION ALL
       SELECT created_at AS ts,
              'Risk identified and registered' AS event,
              'Internal audit' AS actor
       FROM risk.risks WHERE id = $1::uuid
       UNION ALL
       SELECT last_assessed_at AS ts,
              'Residual re-assessed to ' || residual_severity::text || '/' || residual_likelihood::text AS event,
              'Risk Quantifier agent' AS actor
       FROM risk.risks WHERE id = $1::uuid AND last_assessed_at IS NOT NULL
       UNION ALL
       SELECT rt.created_at AS ts,
              'Treatment plan created: ' || rt.strategy::text AS event,
              COALESCE(u.email, 'Risk owner') AS actor
       FROM risk.treatments rt
       LEFT JOIN platform.users u ON u.id = rt.owner_user_id
       WHERE rt.risk_id = $1::uuid
     ) h ORDER BY ts DESC LIMIT 20`,
    [riskId]
  );
}

export async function getAppetiteStatements(tenantId?: string): Promise<AppetiteStatement[]> {
  if (!isPgMode()) return mock.appetiteStatementsForTenant(tenantId ?? 't_maybank');
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<AppetiteStatement>(
    `SELECT id::text AS id, tenant_id AS "tenantId", category, statement,
            threshold_sgd AS "thresholdSgd", severity_cap::text AS "severityCap"
     FROM risk.appetite_statements ${where} ORDER BY category LIMIT 200`,
    params
  );
  return rows;
}

// =====================================================================
// Frameworks / Compliance
// =====================================================================

export async function getFrameworks(): Promise<Framework[]> {
  if (!isPgMode()) return mock.FRAMEWORKS;
  const rows = await safeQuery<Framework>(
    `SELECT id, name, version, regulator, region, jurisdiction,
            total_requirements AS "totalRequirements", tags
     FROM compliance.frameworks ORDER BY name LIMIT 500`
  );
  return rows;
}

export async function getFramework(id: string): Promise<Framework | undefined> {
  const all = await getFrameworks();
  return all.find((f) => f.id === id);
}

export async function getRequirementsForFramework(id: string): Promise<Requirement[]> {
  if (!isPgMode()) return mock.getRequirementsForFramework(id);
  const rows = await safeQuery<Requirement>(
    `SELECT id, framework_id AS "frameworkId", code, title, description,
            parent_requirement_id AS "parentRequirementId", weight
     FROM compliance.requirements WHERE framework_id = $1 ORDER BY code LIMIT 1000`, [id]
  );
  return rows;
}

export async function getComplianceGaps(frameworkId: string, tenantId?: string): Promise<ComplianceGap[]> {
  if (!isPgMode()) return [];
  const params: unknown[] = [frameworkId];
  const tenantClause = tenantId ? ` AND g.tenant_id = $2` : '';
  if (tenantId) params.push(tenantId);
  return safeQuery<ComplianceGap>(
    `SELECT g.id, g.tenant_id AS "tenantId", g.assessment_id AS "assessmentId",
            g.requirement_id AS "requirementId",
            r.code AS "requirementCode", r.title AS "requirementTitle",
            g.severity::text AS severity, g.remediation_plan AS "remediationPlan",
            g.target_date AS "targetDate", g.owner_user_id::text AS "ownerUserId",
            u.email AS "ownerEmail",
            g.created_at AS "createdAt"
     FROM compliance.gaps g
     JOIN compliance.assessments a ON a.id = g.assessment_id
     JOIN compliance.requirements r ON r.id = g.requirement_id
     LEFT JOIN platform.users u ON u.id = g.owner_user_id
     WHERE a.framework_id = $1${tenantClause}
     ORDER BY g.created_at DESC LIMIT 2000`, params
  );
}

export async function getComplianceAttestations(frameworkId: string, tenantId?: string): Promise<ComplianceAttestation[]> {
  if (!isPgMode()) return [];
  const params: unknown[] = [frameworkId];
  const tenantClause = tenantId ? ` AND tenant_id = $2` : '';
  if (tenantId) params.push(tenantId);
  return safeQuery<ComplianceAttestation>(
    `SELECT id, tenant_id AS "tenantId", framework_id AS "frameworkId",
            signed_by_user_id AS "signedByUserId", signed_at AS "signedAt",
            valid_until AS "validUntil", attestation_text AS "attestationText",
            created_at AS "createdAt"
     FROM compliance.attestations
     WHERE framework_id = $1${tenantClause}
     ORDER BY signed_at DESC LIMIT 200`, params
  );
}

export async function getRequirementCoverage(frameworkId: string, tenantId?: string): Promise<RequirementCoverage[]> {
  if (!isPgMode()) return [];
  const params: unknown[] = [frameworkId];
  const tenantJoin = tenantId
    ? `JOIN control.library cl ON cl.id = m.control_id AND cl.tenant_id = $2`
    : `JOIN control.library cl ON cl.id = m.control_id`;
  if (tenantId) params.push(tenantId);
  return safeQuery<RequirementCoverage>(
    `SELECT m.requirement_id AS "requirementId",
            ROUND(AVG(m.coverage_pct)) AS "coveragePct",
            COUNT(DISTINCT m.control_id)::int AS "controlCount"
     FROM control.mappings m
     ${tenantJoin}
     WHERE m.framework_id = $1 AND m.requirement_id IS NOT NULL
     GROUP BY m.requirement_id LIMIT 2000`, params
  );
}

export async function getControlsByFramework(frameworkId: string, tenantId?: string): Promise<Control[]> {
  if (!isPgMode()) return [];
  const params: unknown[] = [frameworkId];
  const tenantClause = tenantId ? ` AND cl.tenant_id = $2` : '';
  if (tenantId) params.push(tenantId);
  return safeQuery<Control>(
    `SELECT DISTINCT cl.id, cl.tenant_id AS "tenantId", cl.code, cl.title,
            cl.description, cl.type::text AS type, cl.family, cl.frequency,
            cl.automated, cl.maturity::text AS maturity
     FROM control.library cl
     JOIN control.mappings m ON m.control_id = cl.id AND m.framework_id = $1
     WHERE TRUE${tenantClause}
     ORDER BY cl.code LIMIT 2000`, params
  );
}

export async function getRecentlyTestedControls(tenantId: string, limit = 6): Promise<Control[]> {
  if (!isPgMode()) return [];
  return safeQuery<Control>(
    `SELECT DISTINCT ON (cl.id) cl.id, cl.tenant_id AS "tenantId", cl.code, cl.title,
            cl.description, cl.type::text AS type, cl.family, cl.frequency,
            cl.automated, cl.maturity::text AS maturity,
            cl.owner_user_id::text AS "ownerUserId", u.email AS "ownerEmail",
            tr.result::text AS "lastTestResult", tr.ran_at AS "lastTestedAt"
     FROM control.library cl
     LEFT JOIN platform.users u ON u.id = cl.owner_user_id
     JOIN control.test_runs tr ON tr.control_id = cl.id
     WHERE cl.tenant_id = $1
       AND tr.ran_at > now() - interval '90 days'
     ORDER BY cl.id, tr.ran_at DESC
     LIMIT $2`, [tenantId, limit]
  );
}

function mockFrameworkScores(tenantId?: string): FrameworkScore[] {
  const top = ['soc2','iso-27001','mas-trm','nist-csf','pci-dss-4','gdpr','dora','eu-ai-act'];
  const tenants = tenantId ? [tenantId] : HERO_TENANTS;
  const out: FrameworkScore[] = [];
  for (const tid of tenants) {
    for (let i = 0; i < top.length; i++) {
      const fw = mock.FRAMEWORKS.find((f) => f.id === top[i]);
      if (!fw) continue;
      out.push({
        tenantId: tid,
        frameworkId: fw.id,
        name: fw.name,
        version: fw.version,
        region: fw.region,
        status: i % 2 === 0 ? 'complete' : 'in-progress',
        score: +(72 + (i * 3) % 22).toFixed(1),
        nextDueAt: new Date(Date.now() + (90 + i * 30) * 86_400_000).toISOString()
      });
    }
  }
  return out;
}

export async function getFrameworkScores(tenantId?: string): Promise<FrameworkScore[]> {
  if (!isPgMode()) return mockFrameworkScores(tenantId);
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<FrameworkScore>(
    `SELECT tenant_id AS "tenantId", framework_id AS "frameworkId", name, version, region,
            status::text AS status, score, next_due_at AS "nextDueAt"
     FROM compliance.framework_score ${where} ORDER BY name LIMIT 500`, params
  );
  return rows;
}

// =====================================================================
// Controls
// =====================================================================

export async function getControls(tenantId?: string): Promise<Control[]> {
  if (!isPgMode()) return tenantId ? mock.controlsForTenant(tenantId) : HERO_TENANTS.flatMap((t) => mock.controlsForTenant(t));
  const sql = tenantId
    ? `SELECT c.id, c.tenant_id AS "tenantId", c.code, c.title, c.description,
              c.type::text AS type, c.family, c.frequency, c.automated, c.maturity::text AS maturity,
              c.owner_user_id::text AS "ownerUserId", u.email AS "ownerEmail"
       FROM control.library c
       LEFT JOIN platform.users u ON u.id = c.owner_user_id
       WHERE c.tenant_id = $1 ORDER BY c.code LIMIT 2000`
    : `SELECT c.id, c.tenant_id AS "tenantId", c.code, c.title, c.description,
              c.type::text AS type, c.family, c.frequency, c.automated, c.maturity::text AS maturity,
              c.owner_user_id::text AS "ownerUserId", u.email AS "ownerEmail"
       FROM control.library c
       LEFT JOIN platform.users u ON u.id = c.owner_user_id
       ORDER BY c.tenant_id, c.code LIMIT 5000`;
  const rows = await safeQuery<Control>(sql, tenantId ? [tenantId] : []);
  return rows;
}

export async function getControl(id: string): Promise<Control | undefined> {
  if (!isPgMode()) return mock.getControlById(id);
  const rows = await safeQuery<Control>(
    `SELECT c.id, c.tenant_id AS "tenantId", c.code, c.title, c.description,
            c.type::text AS type, c.family, c.frequency, c.automated,
            c.maturity::text AS maturity,
            c.owner_user_id::text AS "ownerUserId", u.email AS "ownerEmail"
     FROM control.library c
     LEFT JOIN platform.users u ON u.id = c.owner_user_id
     WHERE c.id = $1`, [id]
  );
  return rows[0] ?? undefined;
}

export async function getControlTestRuns(controlId: string, limit = 20): Promise<ControlTestRun[]> {
  if (!isPgMode()) {
    const c = mock.getControlById(controlId);
    if (!c) return [];
    return mock.recentControlTestRuns(c.tenantId, limit).filter((r) => r.controlId === controlId);
  }
  const rows = await safeQuery<ControlTestRun>(
    `SELECT id, tenant_id AS "tenantId", control_id AS "controlId", test_id::text AS "testId",
            ran_at AS "ranAt", result::text AS result, evidence_item_id AS "evidenceItemId",
            agent_run_id AS "agentRunId", notes, duration_ms AS "durationMs"
     FROM control.test_runs WHERE control_id = $1 ORDER BY ran_at DESC LIMIT $2`, [controlId, limit]
  );
  return rows;
}

export async function getControlMappings(controlId: string): Promise<ControlMapping[]> {
  if (!isPgMode()) return [];
  return safeQuery<ControlMapping>(
    `SELECT id, control_id AS "controlId", framework_id AS "frameworkId",
            requirement_id AS "requirementId", coverage_pct AS "coveragePct", notes
     FROM control.mappings WHERE control_id = $1 ORDER BY framework_id LIMIT 500`,
    [controlId]
  );
}

export async function getControlTests(controlId: string): Promise<ControlTest[]> {
  if (!isPgMode()) return [];
  return safeQuery<ControlTest>(
    `SELECT id::text AS id, tenant_id AS "tenantId", control_id AS "controlId",
            name, kind::text AS kind, schedule_cron AS "scheduleCron", procedure_md AS "procedureMd"
     FROM control.tests WHERE control_id = $1 ORDER BY name LIMIT 200`,
    [controlId]
  );
}

export async function getControlExceptions(controlId: string): Promise<ControlException[]> {
  if (!isPgMode()) return [];
  return safeQuery<ControlException>(
    `SELECT id::text AS id, tenant_id AS "tenantId", control_id AS "controlId",
            justification, granted, expires_at AS "expiresAt", created_at AS "createdAt"
     FROM control.exceptions WHERE control_id = $1 ORDER BY created_at DESC LIMIT 200`,
    [controlId]
  );
}

export async function getEvidenceControlCounts(tenantId?: string): Promise<Record<number, number>> {
  if (!isPgMode()) return {};
  const where = tenantId ? 'WHERE tenant_id = $1 AND evidence_item_id IS NOT NULL' : 'WHERE evidence_item_id IS NOT NULL';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<{ evidenceItemId: number; cnt: number }>(
    `SELECT evidence_item_id AS "evidenceItemId", COUNT(DISTINCT control_id) AS cnt
     FROM control.test_runs ${where} GROUP BY evidence_item_id LIMIT 5000`,
    params
  );
  return Object.fromEntries(rows.map((r) => [r.evidenceItemId, Number(r.cnt)]));
}

export async function getControlMappingsByTenant(tenantId?: string): Promise<ControlMapping[]> {
  if (!isPgMode()) return [];
  const where = tenantId
    ? `WHERE cm.control_id IN (SELECT id FROM control.library WHERE tenant_id = $1)`
    : '';
  const params = tenantId ? [tenantId] : [];
  return safeQuery<ControlMapping>(
    `SELECT cm.id, cm.control_id AS "controlId", cm.framework_id AS "frameworkId",
            cm.requirement_id AS "requirementId", cm.coverage_pct AS "coveragePct", cm.notes
     FROM control.mappings cm ${where} ORDER BY cm.framework_id LIMIT 5000`,
    params
  );
}

export async function getRecentTestRuns(tenantId?: string, limit = 30): Promise<ControlTestRun[]> {
  if (!isPgMode()) {
    if (tenantId) return mock.recentControlTestRuns(tenantId, limit);
    // MSSP rollup: combine hero tenants.
    return HERO_TENANTS.flatMap((tid) => mock.recentControlTestRuns(tid, Math.ceil(limit / 3))).slice(0, limit);
  }
  const where = tenantId ? 'WHERE tenant_id = $2' : '';
  const params: unknown[] = [limit];
  if (tenantId) params.push(tenantId);
  const rows = await safeQuery<ControlTestRun>(
    `SELECT id, tenant_id AS "tenantId", control_id AS "controlId", test_id::text AS "testId",
            ran_at AS "ranAt", result::text AS result, evidence_item_id AS "evidenceItemId",
            agent_run_id AS "agentRunId", notes, duration_ms AS "durationMs"
     FROM control.test_runs ${where} ORDER BY ran_at DESC LIMIT $1`, params
  );
  return rows;
}

// =====================================================================
// Evidence
// =====================================================================

export async function getEvidence(tenantId?: string, limit?: number): Promise<EvidenceItem[]> {
  if (!isPgMode()) return tenantId ? mock.evidenceForTenant(tenantId, limit) : HERO_TENANTS.flatMap((t) => mock.evidenceForTenant(t, limit));
  const params: unknown[] = [];
  const whereParts: string[] = [];
  if (tenantId) { params.push(tenantId); whereParts.push(`i.tenant_id = $${params.length}`); }
  let limitSql = '';
  if (limit) { params.push(limit); limitSql = `LIMIT $${params.length}`; }
  const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const rows = await safeQuery<EvidenceItem>(
    `SELECT i.id, i.tenant_id AS "tenantId", i.collector_id AS "collectorId",
            i.control_id AS "controlId", i.kind::text AS kind, (i.metadata->>'domain') AS domain,
            i.title, i.source_url AS "sourceUrl",
            i.blob_url AS "blobUrl", i.captured_at AS "capturedAt", i.metadata,
            s.row_hash AS "rowHash", s.prev_hash AS "prevHash"
     FROM evidence.items i LEFT JOIN evidence.seals s ON s.item_id = i.id
     ${where} ORDER BY i.captured_at DESC ${limitSql}`, params
  );
  return rows;
}

export async function getEvidenceStats(tenantId?: string): Promise<{ total: number; last24h: number; chainOk: boolean }> {
  if (!isPgMode()) {
    const tid = tenantId ?? 't_maybank';
    const c = mock.evidenceHashChainOk(tid);
    return { total: c.total, last24h: mock.evidenceCount24h(tid), chainOk: c.ok };
  }
  const [totalRows, recentRows] = await Promise.all([
    safeQuery<{ n: string }>(
      tenantId
        ? `SELECT COUNT(*)::text AS n FROM evidence.items WHERE tenant_id = $1`
        : `SELECT COUNT(*)::text AS n FROM evidence.items`,
      tenantId ? [tenantId] : []
    ),
    safeQuery<{ n: string }>(
      tenantId
        ? `SELECT COUNT(*)::text AS n FROM evidence.items WHERE tenant_id = $1 AND captured_at >= now() - interval '24 hours'`
        : `SELECT COUNT(*)::text AS n FROM evidence.items WHERE captured_at >= now() - interval '24 hours'`,
      tenantId ? [tenantId] : []
    )
  ]);
  // Verify chain integrity: check that recent items have matching seals
  const chainRows = await safeQuery<{ ok: boolean }>(
    tenantId
      ? `SELECT (COUNT(i.id) FILTER (WHERE s.item_id IS NULL) = 0) AS ok
           FROM (SELECT id FROM evidence.items WHERE tenant_id = $1 ORDER BY captured_at DESC LIMIT 50) i
           LEFT JOIN evidence.seals s ON s.item_id = i.id`
      : `SELECT (COUNT(i.id) FILTER (WHERE s.item_id IS NULL) = 0) AS ok
           FROM (SELECT id FROM evidence.items ORDER BY captured_at DESC LIMIT 50) i
           LEFT JOIN evidence.seals s ON s.item_id = i.id`,
    tenantId ? [tenantId] : []
  );
  return {
    total: totalRows[0] ? Number(totalRows[0].n) : 0,
    last24h: recentRows[0] ? Number(recentRows[0].n) : 0,
    chainOk: chainRows[0]?.ok ?? true
  };
}

// =====================================================================
// Audits
// =====================================================================

export async function getAudits(tenantId?: string): Promise<AuditEngagement[]> {
  if (!isPgMode()) return tenantId ? mock.auditsForTenant(tenantId) : HERO_TENANTS.flatMap((t) => mock.auditsForTenant(t));
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<AuditEngagement>(
    `SELECT id::text AS id, tenant_id AS "tenantId", name, type::text AS type,
            lead_auditor AS "leadAuditor", opened_at AS "openedAt", closed_at AS "closedAt",
            scope, framework_id AS "frameworkId"
     FROM audit.engagements ${where} ORDER BY opened_at DESC LIMIT 1000`, params
  );
  return rows;
}

export async function getAudit(id: string): Promise<AuditEngagement | undefined> {
  if (isPgMode()) {
    const rows = await safeQuery<AuditEngagement>(
      `SELECT id::text AS id, tenant_id AS "tenantId", name, type::text AS type,
              lead_auditor AS "leadAuditor", opened_at AS "openedAt", closed_at AS "closedAt",
              scope, framework_id AS "frameworkId"
         FROM audit.engagements WHERE id = $1::uuid LIMIT 1`, [id]
    );
    return rows[0];
  }
  const parts = id.split('_');
  if (parts.length < 3) return undefined;
  const tenantId = `${parts[1]}_${parts[2]}`;
  return (await getAudits(tenantId)).find((a) => a.id === id);
}

export async function getAuditFindingsByTenant(tenantId?: string): Promise<Record<string, AuditFinding[]>> {
  if (!isPgMode()) return {};
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<AuditFinding>(
    `SELECT id::text AS id, tenant_id AS "tenantId", engagement_id::text AS "engagementId",
            severity::text AS severity, title, description, control_id AS "controlId",
            due_at AS "dueAt", status::text AS status
     FROM audit.findings ${where}
     ORDER BY due_at ASC NULLS LAST
     LIMIT 5000`,
    params
  );
  const map: Record<string, AuditFinding[]> = {};
  for (const f of rows) {
    if (!map[f.engagementId]) map[f.engagementId] = [];
    map[f.engagementId].push(f);
  }
  return map;
}

export async function getAuditFindings(engagementId: string): Promise<AuditFinding[]> {
  if (!isPgMode()) return mock.auditFindings(engagementId);
  const rows = await safeQuery<AuditFinding>(
    `SELECT id::text AS id, tenant_id AS "tenantId", engagement_id::text AS "engagementId",
            severity::text AS severity, title, description, control_id AS "controlId",
            due_at AS "dueAt", status::text AS status
     FROM audit.findings WHERE engagement_id = $1::uuid ORDER BY due_at ASC NULLS LAST LIMIT 2000`, [engagementId]
  );
  return rows;
}

export async function getAuditWorkpapers(engagementId: string): Promise<AuditWorkpaper[]> {
  if (!isPgMode()) return [];
  return safeQuery<AuditWorkpaper>(
    `SELECT id::text AS id, tenant_id AS "tenantId", engagement_id::text AS "engagementId",
            title, content_md AS "contentMd", created_by AS "createdBy",
            created_at AS "createdAt"
     FROM audit.workpapers WHERE engagement_id = $1::uuid ORDER BY created_at LIMIT 500`, [engagementId]
  );
}

// =====================================================================
// Regwatch
// =====================================================================

export async function getRegChanges(limit = 30): Promise<RegChange[]> {
  if (!isPgMode()) return mock.regChanges(limit);
  const rows = await safeQuery<RegChange>(
    `SELECT c.id::text AS id, c.source_id AS "sourceId", s.name AS "sourceName",
            s.regulator_code AS "regulatorCode", c.title, c.summary,
            c.published_at AS "publishedAt", c.effective_at AS "effectiveAt",
            c.severity::text AS severity, c.detected_by_agent_id AS "detectedByAgentId"
     FROM regwatch.changes c JOIN regwatch.sources s ON s.id = c.source_id
     ORDER BY c.published_at DESC LIMIT $1`, [limit]
  );
  return rows;
}

export async function getRegChange(id: string): Promise<RegChange | undefined> {
  if (isPgMode()) {
    const rows = await safeQuery<RegChange>(
      `SELECT c.id::text AS id, c.source_id AS "sourceId", s.name AS "sourceName",
              s.regulator_code AS "regulatorCode", c.title, c.summary,
              c.published_at AS "publishedAt", c.effective_at AS "effectiveAt",
              c.severity::text AS severity, c.detected_by_agent_id AS "detectedByAgentId"
         FROM regwatch.changes c JOIN regwatch.sources s ON s.id = c.source_id
        WHERE c.id = $1::uuid LIMIT 1`, [id]
    );
    return rows[0];
  }
  const all = await getRegChanges(100);
  return all.find((c) => c.id === id);
}

export async function getRegFrameworkRequirements(changeId: string, limit = 8): Promise<Requirement[]> {
  if (!isPgMode()) return [];
  return safeQuery<Requirement>(
    `SELECT DISTINCT r.id, r.framework_id AS "frameworkId", r.code, r.title,
            r.description, r.parent_requirement_id AS "parentRequirementId", r.weight
     FROM regwatch.impact_assessments ia
     JOIN compliance.requirements r ON r.framework_id = ia.framework_id
     WHERE ia.change_id = $1::uuid AND ia.framework_id IS NOT NULL
     ORDER BY r.code
     LIMIT $2`, [changeId, limit]
  );
}

export async function getRegSources(): Promise<RegSource[]> {
  if (!isPgMode()) return mock.REG_SOURCES;
  const rows = await safeQuery<RegSource>(
    `SELECT id, regulator_code AS "regulatorCode", name, source_url AS "sourceUrl",
            jurisdiction, last_scanned_at AS "lastScannedAt", enabled
     FROM regwatch.sources ORDER BY name LIMIT 500`
  );
  return rows;
}

export async function getImpactAssessments(changeId?: string, tenantId?: string): Promise<ImpactAssessment[]> {
  if (!isPgMode()) return changeId ? mock.impactAssessmentsForChange(changeId, tenantId) : HERO_TENANTS.flatMap((t) => mock.impactAssessmentsForChange('reg_hero_mas655', t));
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (changeId) { params.push(changeId); clauses.push(`ia.change_id = $${params.length}::uuid`); }
  if (tenantId) { params.push(tenantId); clauses.push(`ia.tenant_id = $${params.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await safeQuery<ImpactAssessment>(
    `SELECT ia.id::text AS id, ia.tenant_id AS "tenantId", t.name AS "tenantName",
            ia.change_id::text AS "changeId",
            ia.framework_id AS "frameworkId", f.name AS "frameworkName",
            ia.impact::text AS impact,
            ia.gaps_opened AS "gapsOpened", ia.assessed_by_agent_id AS "assessedByAgentId",
            ia.assessed_at AS "assessedAt", ia.notes
     FROM regwatch.impact_assessments ia
     LEFT JOIN platform.tenants t ON t.id = ia.tenant_id
     LEFT JOIN compliance.frameworks f ON f.id::text = ia.framework_id::text
     ${where} ORDER BY ia.assessed_at DESC LIMIT 2000`,
    params
  );
  return rows;
}

// =====================================================================
// Policies
// =====================================================================

export async function getPolicies(tenantId?: string): Promise<Policy[]> {
  if (!isPgMode()) return tenantId ? mock.policiesForTenant(tenantId) : HERO_TENANTS.flatMap((t) => mock.policiesForTenant(t));
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<Policy>(
    `SELECT id::text AS id, tenant_id AS "tenantId", code, title, jurisdiction,
            current_version_id::text AS "currentVersionId"
     FROM policy.documents ${where} ORDER BY code LIMIT 1000`, params
  );
  return rows;
}

export async function getPolicy(id: string): Promise<Policy | undefined> {
  if (isPgMode()) {
    const rows = await safeQuery<Policy>(
      `SELECT pd.id::text AS id, pd.tenant_id AS "tenantId", pd.code, pd.title, pd.jurisdiction,
              pd.current_version_id::text AS "currentVersionId",
              u.email AS "ownerEmail"
         FROM policy.documents pd
         LEFT JOIN platform.users u ON u.id = pd.owner_user_id
        WHERE pd.id = $1::uuid LIMIT 1`, [id]
    );
    return rows[0];
  }
  const parts = id.split('_');
  if (parts.length < 3) return undefined;
  const tenantId = `${parts[1]}_${parts[2]}`;
  return (await getPolicies(tenantId)).find((p) => p.id === id);
}

export async function getPolicyCurrentVersionByTenant(tenantId?: string): Promise<Record<string, PolicyVersion | undefined>> {
  if (!isPgMode()) return {};
  const where = tenantId ? 'WHERE v.tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<PolicyVersion & { documentId: string }>(
    `SELECT DISTINCT ON (v.document_id)
            v.id::text AS id, v.tenant_id AS "tenantId", v.document_id::text AS "documentId",
            v.version_no AS "versionNo", v.content_md AS "contentMd", v.status::text AS status,
            v.effective_at AS "effectiveAt", v.drafted_by_agent_id AS "draftedByAgentId"
     FROM policy.versions v
     ${where}
     ORDER BY v.document_id, (v.status = 'approved') DESC, v.version_no DESC LIMIT 1000`,
    params
  );
  const map: Record<string, PolicyVersion | undefined> = {};
  for (const v of rows) {
    map[v.documentId] = v;
  }
  return map;
}

export async function getPolicyVersions(id: string): Promise<PolicyVersion[]> {
  if (!isPgMode()) return mock.policyVersions(id);
  const rows = await safeQuery<PolicyVersion>(
    `SELECT id::text AS id, tenant_id AS "tenantId", document_id::text AS "documentId",
            version_no AS "versionNo", content_md AS "contentMd", status::text AS status,
            effective_at AS "effectiveAt", drafted_by_agent_id AS "draftedByAgentId"
     FROM policy.versions WHERE document_id = $1::uuid ORDER BY version_no LIMIT 100`, [id]
  );
  return rows;
}

export async function getPolicyAcks(versionId: string, limit = 20): Promise<PolicyAck[]> {
  if (!isPgMode()) return [];
  return safeQuery<PolicyAck>(
    `SELECT id, tenant_id AS "tenantId", version_id::text AS "versionId",
            user_id::text AS "userId", acknowledged_at AS "acknowledgedAt"
     FROM policy.acknowledgements WHERE version_id = $1::uuid
     ORDER BY acknowledged_at DESC LIMIT $2`, [versionId, limit]
  );
}

export async function getPolicyExceptions(documentId: string): Promise<PolicyException[]> {
  if (!isPgMode()) return [];
  return safeQuery<PolicyException>(
    `SELECT id::text AS id, tenant_id AS "tenantId", document_id::text AS "documentId",
            requester_user_id AS "requesterUserId", justification, granted,
            granted_by_user_id AS "grantedByUserId", expires_at AS "expiresAt",
            created_at AS "createdAt"
     FROM policy.exceptions WHERE document_id = $1::uuid ORDER BY created_at DESC LIMIT 200`, [documentId]
  );
}

export async function getPolicyFrameworkMappings(documentId: string): Promise<Framework[]> {
  if (!isPgMode()) return [];
  return safeQuery<Framework>(
    `SELECT f.id, f.name, f.version, f.regulator, f.region, f.jurisdiction,
            f.total_requirements AS "totalRequirements", f.tags
     FROM policy.document_frameworks df
     JOIN compliance.frameworks f ON f.id = df.framework_id
     WHERE df.document_id = $1::uuid
     ORDER BY f.region, f.name LIMIT 50`, [documentId]
  );
}

export async function getPolicyAckCount(tenantId?: string): Promise<number> {
  if (!isPgMode()) return 0;
  const params = tenantId ? [tenantId] : [];
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const rows = await safeQuery<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM policy.acknowledgements ${where}`, params
  );
  return parseInt(rows[0]?.count ?? '0', 10);
}

// =====================================================================
// Vendors
// =====================================================================

export async function getVendors(tenantId?: string): Promise<Vendor[]> {
  if (!isPgMode()) return tenantId ? mock.vendorsForTenant(tenantId) : HERO_TENANTS.flatMap((t) => mock.vendorsForTenant(t));
  const sql = tenantId
    ? `SELECT id::text AS id, tenant_id AS "tenantId", name, category,
              tier::text AS tier, criticality::text AS criticality,
              hq_country AS "hqCountry", primary_contact_email AS "primaryContactEmail",
              status::text AS status, employee_count AS "employeeCount"
       FROM vendor.vendors WHERE tenant_id = $1 ORDER BY name LIMIT 1000`
    : `SELECT id::text AS id, tenant_id AS "tenantId", name, category,
              tier::text AS tier, criticality::text AS criticality,
              hq_country AS "hqCountry", primary_contact_email AS "primaryContactEmail",
              status::text AS status, employee_count AS "employeeCount"
       FROM vendor.vendors ORDER BY tenant_id, name LIMIT 5000`;
  const rows = await safeQuery<Vendor>(sql, tenantId ? [tenantId] : []);
  return rows;
}

export async function getVendor(id: string): Promise<Vendor | undefined> {
  if (isPgMode()) {
    const rows = await safeQuery<Vendor>(
      `SELECT id::text AS id, tenant_id AS "tenantId", name, category,
              tier::text AS tier, criticality::text AS criticality,
              hq_country AS "hqCountry", primary_contact_email AS "primaryContactEmail",
              status::text AS status, employee_count AS "employeeCount"
         FROM vendor.vendors WHERE id = $1::uuid LIMIT 1`, [id]
    );
    return rows[0];
  }
  const parts = id.split('_');
  if (parts.length < 3) return undefined;
  const tenantId = `${parts[1]}_${parts[2]}`;
  return (await getVendors(tenantId)).find((v) => v.id === id);
}

export async function getVendorContractsByTenant(tenantId?: string): Promise<VendorContract[]> {
  if (!isPgMode()) return [];
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  return safeQuery<VendorContract>(
    `SELECT id::text AS id, tenant_id AS "tenantId", vendor_id::text AS "vendorId",
            contract_no AS "contractNo", value_sgd::float AS "valueSgd",
            starts_at AS "startsAt", ends_at AS "endsAt",
            renewal_window_days AS "renewalWindowDays"
     FROM vendor.contracts ${where} ORDER BY ends_at ASC NULLS LAST LIMIT 1000`,
    params
  );
}

export async function getVendorContracts(vendorId: string): Promise<VendorContract[]> {
  if (!isPgMode()) return [];
  const rows = await safeQuery<VendorContract>(
    `SELECT id::text AS id, tenant_id AS "tenantId", vendor_id::text AS "vendorId",
            contract_no AS "contractNo", value_sgd::float AS "valueSgd",
            starts_at AS "startsAt", ends_at AS "endsAt",
            renewal_window_days AS "renewalWindowDays"
     FROM vendor.contracts WHERE vendor_id = $1::uuid ORDER BY starts_at DESC LIMIT 200`,
    [vendorId]
  );
  return rows;
}

export async function getQuestionnaires(tenantId?: string, vendorId?: string): Promise<Questionnaire[]> {
  if (!isPgMode()) {
    const all = tenantId ? mock.questionnairesForVendor(tenantId) : HERO_TENANTS.flatMap((t) => mock.questionnairesForVendor(t));
    return vendorId ? all.filter((q) => q.vendorId === vendorId) : all;
  }
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (tenantId) { params.push(tenantId); clauses.push(`q.tenant_id = $${params.length}`); }
  if (vendorId) { params.push(vendorId); clauses.push(`q.vendor_id = $${params.length}::uuid`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await safeQuery<Questionnaire>(
    `SELECT q.id::text AS id, q.tenant_id AS "tenantId", q.vendor_id::text AS "vendorId",
            v.name AS "vendorName", q.template, q.status::text AS status,
            q.sent_at AS "sentAt", q.completed_at AS "completedAt",
            q.completed_by_agent_id AS "completedByAgentId", q.score
     FROM vendor.questionnaires q JOIN vendor.vendors v ON v.id = q.vendor_id
     ${where} ORDER BY q.sent_at DESC LIMIT 2000`, params
  );
  return rows;
}

export async function getQuestionnaire(id: string): Promise<Questionnaire | undefined> {
  if (isPgMode()) {
    const rows = await safeQuery<Questionnaire>(
      `SELECT q.id::text AS id, q.tenant_id AS "tenantId", q.vendor_id::text AS "vendorId",
              v.name AS "vendorName", q.template, q.status::text AS status,
              q.sent_at AS "sentAt", q.completed_at AS "completedAt",
              q.completed_by_agent_id AS "completedByAgentId", q.score
         FROM vendor.questionnaires q JOIN vendor.vendors v ON v.id = q.vendor_id
        WHERE q.id = $1::uuid LIMIT 1`, [id]
    );
    return rows[0];
  }
  // Mock id pattern is q_vnd_<tenant>_<n>.
  const m = /^q_vnd_(t_[a-z]+)_/.exec(id);
  if (!m) return undefined;
  return (await getQuestionnaires(m[1])).find((q) => q.id === id);
}

export async function getQuestionnaireResponses(questionnaireId: string): Promise<QuestionnaireResponse[]> {
  if (!isPgMode()) return mock.questionnaireResponsesFor(questionnaireId);
  const rows = await safeQuery<QuestionnaireResponse>(
    `SELECT id, questionnaire_id::text AS "questionnaireId", question_code AS "questionCode",
            response, confidence, source_evidence_item_id AS "sourceEvidenceItemId"
     FROM vendor.responses WHERE questionnaire_id = $1::uuid ORDER BY question_code LIMIT 500`, [questionnaireId]
  );
  return rows;
}

export async function getFourthParties(tenantId?: string, vendorId?: string): Promise<FourthParty[]> {
  if (!isPgMode()) {
    const all = tenantId ? mock.fourthPartiesForTenant(tenantId) : HERO_TENANTS.flatMap((t) => mock.fourthPartiesForTenant(t));
    return vendorId ? all.filter((fp) => fp.vendorId === vendorId) : all;
  }
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (tenantId) { params.push(tenantId); clauses.push(`fp.tenant_id = $${params.length}`); }
  if (vendorId) { params.push(vendorId); clauses.push(`fp.vendor_id = $${params.length}::uuid`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await safeQuery<FourthParty>(
    `SELECT fp.id::text AS id, fp.tenant_id AS "tenantId", fp.vendor_id::text AS "vendorId",
            v.name AS "vendorName", fp.name, fp.type, fp.region, fp.criticality::text AS criticality
     FROM vendor.fourth_parties fp JOIN vendor.vendors v ON v.id = fp.vendor_id
     ${where}
     ORDER BY fp.name
     LIMIT 2000`, params
  );
  return rows;
}

export async function getConcentrations(tenantId?: string): Promise<Concentration[]> {
  if (!isPgMode()) return tenantId ? mock.concentrationsForTenant(tenantId) : HERO_TENANTS.flatMap((t) => mock.concentrationsForTenant(t));
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<Concentration>(
    `SELECT id::text AS id, tenant_id AS "tenantId", dimension, key,
            vendor_count AS "vendorCount", exposure_sgd AS "exposureSgd"
     FROM vendor.concentrations ${where}
     ORDER BY exposure_sgd DESC
     LIMIT 1000`, params
  );
  return rows;
}

// =====================================================================
// Privacy / ESG / AI Gov
// =====================================================================

export async function getPrivacyActivities(tenantId?: string): Promise<PrivacyActivity[]> {
  if (!isPgMode()) return mock.privacyActivitiesForTenant(tenantId ?? 't_maybank');
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<PrivacyActivity>(
    `SELECT id::text AS id, tenant_id AS "tenantId", code, name, controller, processor,
            purpose, lawful_basis AS "lawfulBasis", data_categories AS "dataCategories",
            retention_period AS "retentionPeriod", cross_border AS "crossBorder",
            jurisdictions
     FROM privacy.processing_activities ${where} ORDER BY code LIMIT 2000`,
    params
  );
  return rows;
}

export async function getDPIAs(tenantId?: string): Promise<DPIA[]> {
  if (!isPgMode()) return mock.dpiasForTenant(tenantId ?? 't_maybank');
  const where = tenantId ? 'WHERE d.tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<DPIA>(
    `SELECT d.id::text AS id, d.tenant_id AS "tenantId",
            d.activity_id::text AS "activityId", a.name AS "activityName",
            d.status, d.residual_risk_severity::text AS "residualRiskSeverity",
            d.conducted_at AS "conductedAt",
            u.email AS "conductedByEmail"
     FROM privacy.dpias d
     JOIN privacy.processing_activities a ON a.id = d.activity_id
     LEFT JOIN platform.users u ON u.id::text = d.conducted_by::text
     ${where} ORDER BY d.created_at DESC LIMIT 2000`,
    params
  );
  return rows;
}

export async function getSubjectRequests(tenantId?: string): Promise<SubjectRequest[]> {
  if (!isPgMode()) return mock.subjectRequestsForTenant(tenantId ?? 't_maybank');
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<SubjectRequest>(
    `SELECT id::text AS id, tenant_id AS "tenantId", kind::text AS kind,
            requester_email AS "requesterEmail", received_at AS "receivedAt",
            due_at AS "dueAt", status::text AS status, resolved_at AS "resolvedAt"
     FROM privacy.subject_requests ${where} ORDER BY received_at DESC LIMIT 2000`,
    params
  );
  return rows;
}

export async function getBreaches(tenantId?: string): Promise<Breach[]> {
  if (!isPgMode()) return mock.breachesForTenant(tenantId ?? 't_maybank');
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<Breach>(
    `SELECT id::text AS id, tenant_id AS "tenantId", code,
            severity::text AS severity, occurred_at AS "occurredAt",
            detected_at AS "detectedAt", reported_at AS "reportedAt",
            affected_subjects AS "affectedSubjects",
            regulator_notified AS "regulatorNotified", root_cause AS "rootCause"
     FROM privacy.breaches ${where} ORDER BY occurred_at DESC LIMIT 2000`,
    params
  );
  return rows;
}

export async function getESGMetrics(tenantId?: string): Promise<ESGMetric[]> {
  if (!isPgMode()) return mock.esgMetricsForTenant(tenantId ?? 't_maybank');
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<ESGMetric>(
    `SELECT id, tenant_id AS "tenantId", period, scope, category,
            metric, value, unit, framework
     FROM esg.metrics ${where} ORDER BY period DESC, category, metric LIMIT 5000`,
    params
  );
  return rows;
}

export async function getESGDisclosures(tenantId?: string): Promise<ESGDisclosure[]> {
  if (!isPgMode()) return mock.esgDisclosuresForTenant(tenantId ?? 't_maybank');
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<ESGDisclosure>(
    `SELECT id::text AS id, tenant_id AS "tenantId", framework, period,
            status, published_at AS "publishedAt"
     FROM esg.disclosures ${where} ORDER BY period DESC, framework LIMIT 500`,
    params
  );
  return rows;
}

export async function getESGTargets(tenantId?: string): Promise<ESGTarget[]> {
  if (!isPgMode()) return mock.esgTargetsForTenant(tenantId ?? 't_maybank');
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<ESGTarget>(
    `SELECT t.id::text AS id, t.tenant_id AS "tenantId", t.framework, t.metric,
            t.baseline_value AS "baselineValue", t.baseline_period AS "baselinePeriod",
            t.target_value AS "targetValue", t.target_period AS "targetPeriod",
            u.email AS "ownerEmail"
     FROM esg.targets t
     LEFT JOIN platform.users u ON u.id = t.owner_user_id
     ${where.replace('tenant_id', 't.tenant_id')} ORDER BY t.framework, t.metric LIMIT 500`,
    params
  );
  return rows;
}

export async function getAIModels(tenantId?: string): Promise<AIModel[]> {
  if (!isPgMode()) return mock.aiModelsForTenant(tenantId ?? 't_maybank');
  const where = tenantId ? 'WHERE m.tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<AIModel>(
    `SELECT m.id::text AS id, m.tenant_id AS "tenantId", m.name, m.kind,
            m.risk_tier::text AS "riskTier", m.jurisdiction,
            m.eu_ai_act_class AS "euAiActClass",
            m.iso_42001_status::text AS "iso42001Status",
            m.owner_user_id::text AS "ownerUserId",
            u.email AS "ownerEmail",
            m.training_data_summary AS "trainingDataSummary"
     FROM ai_gov.models m
     LEFT JOIN platform.users u ON u.id = m.owner_user_id
     ${where} ORDER BY m.name LIMIT 500`,
    params
  );
  return rows;
}

export async function getAIModel(id: string): Promise<AIModel | undefined> {
  if (isPgMode()) {
    const rows = await safeQuery<AIModel>(
      `SELECT m.id::text AS id, m.tenant_id AS "tenantId", m.name, m.kind,
              m.risk_tier::text AS "riskTier", m.jurisdiction,
              m.eu_ai_act_class AS "euAiActClass",
              m.iso_42001_status::text AS "iso42001Status",
              m.owner_user_id::text AS "ownerUserId",
              u.email AS "ownerEmail",
              m.training_data_summary AS "trainingDataSummary"
         FROM ai_gov.models m
         LEFT JOIN platform.users u ON u.id = m.owner_user_id
        WHERE m.id = $1::uuid LIMIT 1`, [id]
    );
    return rows[0];
  }
  const parts = id.split('_');
  if (parts.length < 3) return undefined;
  const tenantId = `${parts[1]}_${parts[2]}`;
  return (await getAIModels(tenantId)).find((m) => m.id === id);
}

export async function getModelRisks(modelId: string): Promise<ModelRisk[]> {
  if (!isPgMode()) return mock.modelRisksForModel(modelId);
  const rows = await safeQuery<ModelRisk>(
    `SELECT id::text AS id, tenant_id AS "tenantId", model_id::text AS "modelId",
            risk_type AS "riskType", severity::text AS severity, mitigation
     FROM ai_gov.model_risk WHERE model_id = $1::uuid ORDER BY severity LIMIT 100`,
    [modelId]
  );
  return rows;
}

export async function getPromptsAudit(tenantId?: string, limit = 50, modelId?: string): Promise<PromptAuditEntry[]> {
  if (!isPgMode()) {
    const all = mock.promptsAuditForTenant(tenantId ?? 't_maybank', limit);
    return modelId ? all.filter((p) => p.modelId === modelId) : all;
  }
  const clauses: string[] = [];
  const params: unknown[] = [limit];
  if (tenantId) { params.push(tenantId); clauses.push(`tenant_id = $${params.length}`); }
  if (modelId) { params.push(modelId); clauses.push(`model_id = $${params.length}::uuid`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await safeQuery<PromptAuditEntry>(
    `SELECT id, tenant_id AS "tenantId", model_id::text AS "modelId",
            agent_run_id AS "agentRunId", prompt_redacted AS "promptRedacted",
            response_redacted AS "responseRedacted", tokens_in AS "tokensIn",
            tokens_out AS "tokensOut", cost_cents AS "costCents",
            captured_at AS "capturedAt"
     FROM ai_gov.prompts_audit ${where} ORDER BY captured_at DESC LIMIT $1`,
    params
  );
  return rows;
}

// =====================================================================
// SOX
// =====================================================================

export async function getSOXItgcs(tenantId?: string) {
  if (!isPgMode()) return mock.soxItgcsForTenant(tenantId ?? 't_maybank');
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<import('$lib/data/specialized').SOXItgc>(
    `SELECT id::text AS id, tenant_id AS "tenantId",
            control_ref AS code,
            title AS name,
            COALESCE(description, '') AS domain,
            '' AS owner,
            tested_at AS "lastTestedAt",
            CASE status::text
              WHEN 'effective'         THEN 'pass'
              WHEN 'deficiency'        THEN 'partial'
              WHEN 'material_weakness' THEN 'fail'
              ELSE 'pass'
            END AS result,
            COALESCE(frequency, 'quarterly') AS frequency
     FROM sox.itgcs ${where} ORDER BY control_ref LIMIT 2000`,
    params
  );
  return rows;
}

export async function getSOXKcas(tenantId?: string) {
  if (!isPgMode()) return mock.soxKcasForTenant(tenantId ?? 't_maybank');
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<import('$lib/data/specialized').SOXKca>(
    `SELECT k.id::text AS id, k.tenant_id AS "tenantId",
            k.attribute AS code,
            COALESCE(i.title, k.attribute) AS name,
            COALESCE(i.description, i.objective, '') AS process,
            '' AS owner,
            COALESCE(i.frequency, 'monthly') AS frequency,
            CASE i.control_type
              WHEN 'automated'       THEN 100
              WHEN 'itdm'            THEN 60
              ELSE 0
            END AS "automationPct",
            k.assessed_at AS "lastTestedAt",
            CASE i.status
              WHEN 'effective'          THEN 'pass'
              WHEN 'deficiency'         THEN 'fail'
              WHEN 'material_weakness'  THEN 'fail'
              ELSE 'partial'
            END AS result
     FROM sox.kcas k
     LEFT JOIN sox.itgcs i ON i.id = k.itgc_id
     ${where ? where.replace('tenant_id', 'k.tenant_id') : ''}
     ORDER BY k.attribute LIMIT 2000`,
    params
  );
  return rows;
}

export async function getSOXWalkthroughs(tenantId?: string) {
  if (!isPgMode()) return mock.soxWalkthroughsForTenant(tenantId ?? 't_maybank');
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<import('$lib/data/specialized').SOXWalkthrough>(
    `SELECT w.id::text AS id, w.tenant_id AS "tenantId",
            COALESCE(w.description, '') AS process,
            EXTRACT(YEAR FROM COALESCE(w.completed_at, w.created_at))::int AS year,
            CASE
              WHEN w.completed_at IS NOT NULL THEN 'complete'
              ELSE 'in-progress'
            END AS status,
            'Internal Audit' AS "conductedBy",
            COALESCE(w.completed_at, w.created_at) AS "conductedAt"
     FROM sox.walkthroughs w
     LEFT JOIN sox.itgcs i ON i.id = w.itgc_id
     ${where ? where.replace('tenant_id', 'w.tenant_id') : ''}
     ORDER BY COALESCE(w.completed_at, w.created_at) DESC LIMIT 2000`,
    params
  );
  return rows;
}

export async function getSOXDeficiencies(tenantId?: string) {
  if (!isPgMode()) return mock.soxDeficienciesForTenant(tenantId ?? 't_maybank');
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<import('$lib/data/specialized').SOXDeficiency>(
    `SELECT id::text AS id, tenant_id AS "tenantId",
            CASE severity::text
              WHEN 'material'    THEN 'high'
              WHEN 'significant' THEN 'medium'
              ELSE 'medium'
            END AS severity,
            description,
            COALESCE(root_cause, '') AS "rootCause",
            COALESCE(remediation_plan, '') AS remediation,
            COALESCE(remediated_at::date::text, (created_at + interval '90 days')::date::text) AS "targetDate",
            (remediated_at IS NOT NULL) AS "onTrack"
     FROM sox.deficiencies ${where} ORDER BY created_at DESC LIMIT 2000`,
    params
  );
  return rows;
}

// =====================================================================
// Incidents / Issues / BCM
// =====================================================================

export async function getIncidents(tenantId?: string, limit = 1000): Promise<Incident[]> {
  if (!isPgMode()) return tenantId ? mock.incidentsForTenant(tenantId) : HERO_TENANTS.flatMap((t) => mock.incidentsForTenant(t));
  const where = tenantId ? 'WHERE tenant_id = $2' : '';
  const params: unknown[] = [limit];
  if (tenantId) params.push(tenantId);
  const rows = await safeQuery<Incident>(
    `SELECT id::text AS id, tenant_id AS "tenantId", code, severity::text AS severity,
            title, status::text AS status, opened_at AS "openedAt",
            contained_at AS "containedAt", resolved_at AS "resolvedAt"
     FROM incident.incidents ${where} ORDER BY opened_at DESC LIMIT $1`, params
  );
  return rows;
}

export async function getIncident(id: string): Promise<Incident | undefined> {
  if (isPgMode()) {
    const rows = await safeQuery<Incident>(
      `SELECT id::text AS id, tenant_id AS "tenantId", code, severity::text AS severity,
              title, status::text AS status, opened_at AS "openedAt",
              contained_at AS "containedAt", resolved_at AS "resolvedAt"
         FROM incident.incidents WHERE id = $1::uuid LIMIT 1`, [id]
    );
    return rows[0];
  }
  const parts = id.split('_');
  if (parts.length < 3) return undefined;
  const tenantId = `${parts[1]}_${parts[2]}`;
  return (await getIncidents(tenantId)).find((i) => i.id === id);
}

export async function getIncidentTimeline(incidentId: string): Promise<TimelineEvent[]> {
  if (!isPgMode()) return mock.timelineForIncident(incidentId);
  const rows = await safeQuery<TimelineEvent>(
    `SELECT id, tenant_id AS "tenantId", incident_id::text AS "incidentId",
            ts, actor, event, source
     FROM incident.timeline_events WHERE incident_id = $1::uuid ORDER BY ts LIMIT 500`,
    [incidentId]
  );
  return rows;
}

export async function getPostmortem(incidentId: string): Promise<Postmortem | null> {
  if (!isPgMode()) return mock.postmortemForIncident(incidentId);
  const rows = await safeQuery<Postmortem>(
    `SELECT id::text AS id, tenant_id AS "tenantId", incident_id::text AS "incidentId",
            root_cause_md AS "rootCauseMd", corrective_actions_md AS "correctiveActionsMd",
            drafted_by_agent_id AS "draftedByAgentId", signed_off_at AS "signedOffAt"
     FROM incident.postmortems WHERE incident_id = $1::uuid LIMIT 1`,
    [incidentId]
  );
  return rows[0] ?? null;
}

export async function getIssues(tenantId?: string, openOnly?: boolean): Promise<Issue[]> {
  if (!isPgMode()) {
    const all = tenantId ? mock.issuesForTenant(tenantId) : HERO_TENANTS.flatMap((t) => mock.issuesForTenant(t));
    return openOnly ? all.filter((i) => i.status === 'open' || i.status === 'in-progress') : all;
  }
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (tenantId) { params.push(tenantId); clauses.push(`i.tenant_id = $${params.length}`); }
  if (openOnly) clauses.push(`i.status IN ('open', 'in-progress')`);
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await safeQuery<Issue>(
    `SELECT i.id::text AS id, i.tenant_id AS "tenantId", i.source::text AS source,
            i.source_id AS "sourceId", i.title, i.description, i.severity::text AS severity,
            i.status::text AS status, i.owner_user_id AS "ownerUserId", u.email AS "ownerEmail",
            i.due_at AS "dueAt", i.created_at AS "createdAt"
     FROM issue.issues i
     LEFT JOIN platform.users u ON u.id = i.owner_user_id
     ${where} ORDER BY i.due_at LIMIT 2000`, params
  );
  return rows;
}

export async function getVendorIssues(vendorId: string): Promise<Issue[]> {
  if (!isPgMode()) return [];
  return safeQuery<Issue>(
    `SELECT i.id::text AS id, i.tenant_id AS "tenantId", i.source::text AS source,
            i.source_id AS "sourceId", i.title, i.description, i.severity::text AS severity,
            i.status::text AS status, i.owner_user_id AS "ownerUserId", u.email AS "ownerEmail",
            i.due_at AS "dueAt", i.created_at AS "createdAt"
     FROM issue.issues i
     LEFT JOIN platform.users u ON u.id = i.owner_user_id
     WHERE i.vendor_id = $1::uuid ORDER BY i.due_at LIMIT 500`, [vendorId]
  );
}

export async function getIssue(id: string): Promise<Issue | undefined> {
  if (isPgMode()) {
    const rows = await safeQuery<Issue>(
      `SELECT i.id::text AS id, i.tenant_id AS "tenantId", i.source::text AS source,
              i.source_id AS "sourceId", i.title, i.description, i.severity::text AS severity,
              i.status::text AS status, i.owner_user_id AS "ownerUserId", u.email AS "ownerEmail",
              i.due_at AS "dueAt", i.created_at AS "createdAt"
         FROM issue.issues i
         LEFT JOIN platform.users u ON u.id = i.owner_user_id
        WHERE i.id = $1::uuid LIMIT 1`, [id]
    );
    return rows[0];
  }
  const parts = id.split('_');
  if (parts.length < 3) return undefined;
  const tenantId = `${parts[1]}_${parts[2]}`;
  const all = await getIssues(tenantId);
  return all.find((i) => i.id === id);
}

export async function getIssueActions(issueId: string): Promise<IssueAction[]> {
  if (!isPgMode()) return mock.actionsForIssue(issueId);
  const rows = await safeQuery<IssueAction>(
    `SELECT id::text AS id, tenant_id AS "tenantId", issue_id::text AS "issueId",
            description, due_at AS "dueAt", status
     FROM issue.actions WHERE issue_id = $1::uuid ORDER BY due_at LIMIT 200`,
    [issueId]
  );
  return rows;
}

export async function getBCMPlans(tenantId?: string): Promise<BCMPlan[]> {
  if (!isPgMode()) return mock.bcmPlansForTenant(tenantId ?? 't_maybank');
  const where = tenantId ? 'WHERE p.tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<BCMPlan>(
    `SELECT p.id::text AS id, p.tenant_id AS "tenantId", p.name,
            p.business_service AS "businessService",
            p.rto_minutes AS "rtoMinutes", p.rpo_minutes AS "rpoMinutes",
            p.last_tested_at AS "lastTestedAt", p.next_test_at AS "nextTestAt",
            p.description, p.recovery_strategy AS "recoveryStrategy",
            p.owner_user_id::text AS "ownerUserId", u.email AS "ownerEmail"
     FROM bcm.plans p
     LEFT JOIN platform.users u ON u.id = p.owner_user_id
     ${where} ORDER BY p.name LIMIT 500`,
    params
  );
  return rows;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getBCMPlan(id: string): Promise<BCMPlan | undefined> {
  if (isPgMode()) {
    if (!UUID_RE.test(id)) return undefined;
    const rows = await safeQuery<BCMPlan>(
      `SELECT p.id::text AS id, p.tenant_id AS "tenantId", p.name,
              p.business_service AS "businessService",
              p.rto_minutes AS "rtoMinutes", p.rpo_minutes AS "rpoMinutes",
              p.last_tested_at AS "lastTestedAt", p.next_test_at AS "nextTestAt",
              p.description, p.recovery_strategy AS "recoveryStrategy",
              p.owner_user_id::text AS "ownerUserId", u.email AS "ownerEmail"
       FROM bcm.plans p
       LEFT JOIN platform.users u ON u.id = p.owner_user_id
       WHERE p.id = $1::uuid LIMIT 1`,
      [id]
    );
    return rows[0];
  }
  const parts = id.split('_');
  if (parts.length < 3) return undefined;
  const tenantId = `${parts[1]}_${parts[2]}`;
  return (await getBCMPlans(tenantId)).find((p) => p.id === id);
}

export async function getBCMEscalationContacts(planId: string): Promise<BCMEscalationContact[]> {
  if (!isPgMode()) return [];
  return safeQuery<BCMEscalationContact>(
    `SELECT id::text AS id, tenant_id AS "tenantId", plan_id::text AS "planId",
            role, name, email, phone, sort_order AS "sortOrder"
     FROM bcm.escalation_contacts
     WHERE plan_id = $1::uuid ORDER BY sort_order, role LIMIT 50`,
    [planId]
  );
}

export async function getBCMDepsAndTestsByTenant(tenantId?: string): Promise<{
  deps: Record<string, BCMDependency[]>;
  tests: Record<string, BCMTest[]>;
}> {
  if (!isPgMode()) return { deps: {}, tests: {} };
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];

  const [depRows, testRows] = await Promise.all([
    safeQuery<BCMDependency & { planId: string }>(
      `SELECT id::text AS id, tenant_id AS "tenantId", plan_id::text AS "planId",
              dependency_kind AS "dependencyKind", name, criticality::text AS criticality,
              downtime_tolerance_hours AS "downtimeToleranceHours"
       FROM bcm.bias ${where} ORDER BY name LIMIT 2000`,
      params
    ),
    safeQuery<BCMTest & { planId: string }>(
      `SELECT id::text AS id, tenant_id AS "tenantId", plan_id::text AS "planId",
              kind, conducted_at AS "conductedAt", result::text AS result,
              lessons_md AS "lessonsMd"
       FROM bcm.tests ${where} ORDER BY conducted_at DESC LIMIT 1000`,
      params
    )
  ]);

  const deps: Record<string, BCMDependency[]> = {};
  for (const d of depRows) {
    if (!deps[d.planId]) deps[d.planId] = [];
    deps[d.planId].push(d);
  }
  const tests: Record<string, BCMTest[]> = {};
  for (const t of testRows) {
    if (!tests[t.planId]) tests[t.planId] = [];
    tests[t.planId].push(t);
  }
  return { deps, tests };
}

export async function getBCMDependencies(planId: string): Promise<BCMDependency[]> {
  if (!isPgMode()) return mock.bcmDependenciesForPlan(planId);
  const rows = await safeQuery<BCMDependency>(
    `SELECT id::text AS id, tenant_id AS "tenantId", plan_id::text AS "planId",
            dependency_kind AS "dependencyKind", name, criticality::text AS criticality,
            downtime_tolerance_hours AS "downtimeToleranceHours"
     FROM bcm.bias WHERE plan_id = $1::uuid`,
    [planId]
  );
  return rows;
}

export async function getBCMTests(planId: string): Promise<BCMTest[]> {
  if (!isPgMode()) return mock.bcmTestsForPlan(planId);
  const rows = await safeQuery<BCMTest>(
    `SELECT id::text AS id, tenant_id AS "tenantId", plan_id::text AS "planId",
            kind, conducted_at AS "conductedAt", result::text AS result,
            lessons_md AS "lessonsMd"
     FROM bcm.tests WHERE plan_id = $1::uuid ORDER BY conducted_at DESC`,
    [planId]
  );
  return rows;
}

// =====================================================================
// Workflows + Connectors + Audit Log
// =====================================================================

export async function getWorkflows(tenantId?: string): Promise<Workflow[]> {
  if (!isPgMode()) return mock.workflowsForTenant(tenantId ?? 't_maybank');
  const where = tenantId ? 'WHERE d.tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<Workflow>(
    `SELECT d.id::text AS id, d.tenant_id AS "tenantId", d.name, d.description,
            d.steps, d.version, d.enabled,
            last_exec.status::text AS "lastExecutionStatus",
            COALESCE(stats.success_rate, 0)::float AS "successRate30d"
     FROM workflow.definitions d
     LEFT JOIN LATERAL (
       SELECT status FROM workflow.executions
       WHERE workflow_id = d.id
       ORDER BY started_at DESC LIMIT 1
     ) last_exec ON true
     LEFT JOIN LATERAL (
       SELECT ROUND(
         COUNT(*) FILTER (WHERE status = 'success')::numeric / NULLIF(COUNT(*), 0), 4
       ) AS success_rate
       FROM workflow.executions
       WHERE workflow_id = d.id
         AND started_at >= now() - interval '30 days'
     ) stats ON true
     ${where} ORDER BY d.name LIMIT 500`,
    params
  );
  return rows;
}

export async function getWorkflow(id: string): Promise<Workflow | undefined> {
  if (isPgMode()) {
    const rows = await safeQuery<Workflow>(
      `SELECT id::text AS id, tenant_id AS "tenantId", name, description,
              steps, version, enabled
         FROM workflow.definitions WHERE id = $1::uuid LIMIT 1`, [id]
    );
    return rows[0];
  }
  const parts = id.split('_');
  if (parts.length < 3) return undefined;
  const tenantId = `${parts[1]}_${parts[2]}`;
  return (await getWorkflows(tenantId)).find((w) => w.id === id);
}

export async function getWorkflowExecutions(tenantId?: string, limit = 20, workflowId?: string): Promise<WorkflowExecution[]> {
  if (!isPgMode()) return mock.workflowExecutionsForTenant(tenantId ?? 't_maybank', limit).filter((e) => !workflowId || e.workflowId === workflowId);
  const clauses: string[] = [];
  const params: unknown[] = [limit];
  if (tenantId) { params.push(tenantId); clauses.push(`e.tenant_id = $${params.length}`); }
  if (workflowId) { params.push(workflowId); clauses.push(`e.workflow_id = $${params.length}::uuid`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await safeQuery<WorkflowExecution>(
    `SELECT e.id, e.tenant_id AS "tenantId", e.workflow_id::text AS "workflowId",
            d.name AS "workflowName", e.trigger, e.started_at AS "startedAt",
            e.ended_at AS "endedAt", e.status::text AS status
     FROM workflow.executions e
     JOIN workflow.definitions d ON d.id = e.workflow_id
     ${where} ORDER BY e.started_at DESC LIMIT $1`,
    params
  );
  return rows;
}

export async function getConnectors(tenantId?: string): Promise<Connector[]> {
  if (!isPgMode()) return mock.connectorsForTenant(tenantId ?? 't_maybank');
  const where = tenantId ? 'WHERE c.tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<Connector>(
    `SELECT c.id::text AS id, c.tenant_id AS "tenantId", c.kind, c.name,
            c.status::text AS status, c.last_sync_at AS "lastSyncAt",
            COALESCE(sj.records_24h, 0)::int AS "recordsIngested24h"
     FROM integration.connectors c
     LEFT JOIN LATERAL (
       SELECT SUM(records_ingested)::bigint AS records_24h
       FROM integration.sync_jobs
       WHERE connector_id = c.id
         AND started_at >= now() - interval '24 hours'
     ) sj ON true
     ${where} ORDER BY c.name LIMIT 500`, params
  );
  return rows;
}

export async function getConnectorCountsByTenant(): Promise<Record<string, { total: number; connected: number }>> {
  if (!isPgMode()) return {};
  const rows = await safeQuery<{ tenantId: string; total: number; connected: number }>(
    `SELECT tenant_id AS "tenantId",
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'connected')::int AS connected
     FROM integration.connectors
     GROUP BY tenant_id`
  );
  return Object.fromEntries(rows.map((r) => [r.tenantId, { total: r.total, connected: r.connected }]));
}

export async function getAuditLog(tenantId?: string, limit = 200): Promise<AuditLogEntry[]> {
  if (!isPgMode()) {
    // Synthesize a believable platform audit feed over the last 30 days using
    // mulberry32 + the active users list so the actor distribution is realistic.
    const { getUsersAll } = await import('$lib/data/users');
    const { mulberry32, hashStringToInt, pick } = await import('$lib/data/rng');
    const users = getUsersAll().filter((u) => !tenantId || u.tenantId === tenantId);
    const actions = [
      'user.login', 'risk.created', 'control.test.run', 'evidence.collected',
      'policy.acknowledged', 'agent.run.completed', 'tenant.switched',
      'export.report', 'policy.publish', 'vendor.questionnaire.sent',
      'audit.finding.closed', 'user.invited', 'mfa.enrolled'
    ];
    const targets = [
      'risk:R-0042', 'control:CT-0211', 'evidence:ev-99182', 'policy:p-info-sec/v3',
      'agent:ag_evidence/run-44102', 'audit:eng-2026-q2', 'vendor:vnd-stripe',
      'tenant:t_maybank', 'questionnaire:q-vnd-aws/2026q2', 'finding:F-1024'
    ];
    const results: AuditLogEntry['result'][] = [
      'success', 'success', 'success', 'success', 'success', 'success',
      'success', 'success', 'failure', 'denied'
    ];
    const userAgents = [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'curl/8.4.0',
      'NTTGRCHub-CLI/1.0.0'
    ];
    const rng = mulberry32(hashStringToInt(`audit:${tenantId ?? 'all'}`));
    let prevHash = '0000000000000000';
    const total = Math.max(limit, 200);
    const out: AuditLogEntry[] = [];
    for (let i = 0; i < total; i++) {
      const minsAgo = Math.floor(rng() * 30 * 24 * 60); // 30 days
      const u = users.length ? users[Math.floor(rng() * users.length)] : null;
      const action = pick(actions, rng);
      const target = pick(targets, rng);
      const result = pick(results, rng);
      const ua = pick(userAgents, rng);
      const oct = () => Math.floor(rng() * 254) + 1;
      const ip = `${oct()}.${oct()}.${oct()}.${oct()}`;
      const rowHash = (Math.floor(rng() * 0xffffffff)).toString(16).padStart(8, '0')
        + (Math.floor(rng() * 0xffffffff)).toString(16).padStart(8, '0');
      out.push({
        id: i + 1,
        ts: new Date(Date.now() - minsAgo * 60_000).toISOString(),
        tenantId: u?.tenantId ?? tenantId ?? 't_maybank',
        actorEmail: u?.email ?? 'system@ntt.com',
        action,
        target,
        result,
        ipAddress: ip,
        userAgent: ua,
        prevHash,
        rowHash
      });
      prevHash = rowHash;
    }
    out.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    return out.slice(0, limit);
  }
  const where = tenantId ? 'WHERE tenant_id = $2' : '';
  const params: unknown[] = [limit];
  if (tenantId) params.push(tenantId);
  return safeQuery<AuditLogEntry>(
    `SELECT id, ts, tenant_id AS "tenantId", actor_email AS "actorEmail",
            action, target, result, prev_hash AS "prevHash", COALESCE(row_hash, '') AS "rowHash",
            ip_address AS "ipAddress", user_agent AS "userAgent"
     FROM platform.audit_log ${where} ORDER BY ts DESC LIMIT $1`, params
  );
}

// =====================================================================
// Human Risk (KnowBe4)
// =====================================================================

export async function getHumanRiskSummary(tenantId?: string): Promise<HumanRiskSummary | null> {
  if (!isPgMode()) return mock.humanRiskSummary(tenantId ?? 't_maybank');

  if (!tenantId) {
    // All-tenants: headcount-weighted aggregate across every tenant.
    const [aggOrg, aggQuant] = await Promise.all([
      safeQuery<{
        tenantId: string; orgRiskScore: number; orgRiskScore12mAgo: number;
        phishPronePct: number; phishPronePct12mAgo: number; industryPhishPronePct: number;
        trainingCompletionPct: number; headcount: number; usersAtHighRisk: number;
        usersAtCriticalRisk: number; campaignsRun12m: number; reportingRatePct: number;
        riskLevel: string; riskScoreHistory: { period: string; score: number; ppp: number }[];
      }>(`
        SELECT 'all' AS "tenantId",
          SUM(headcount)::int AS headcount,
          ROUND(SUM(org_risk_score * headcount::numeric) / NULLIF(SUM(headcount), 0))::int AS "orgRiskScore",
          ROUND(SUM(org_risk_score_12m_ago * headcount::numeric) / NULLIF(SUM(headcount), 0))::int AS "orgRiskScore12mAgo",
          ROUND(SUM(phish_prone_pct * headcount::numeric) / NULLIF(SUM(headcount), 0), 1)::numeric AS "phishPronePct",
          ROUND(SUM(phish_prone_pct_12m_ago * headcount::numeric) / NULLIF(SUM(headcount), 0), 1)::numeric AS "phishPronePct12mAgo",
          ROUND(AVG(industry_phish_prone_pct), 1)::numeric AS "industryPhishPronePct",
          ROUND(SUM(training_completion_pct * headcount::numeric) / NULLIF(SUM(headcount), 0), 1)::numeric AS "trainingCompletionPct",
          SUM(users_at_high_risk)::int AS "usersAtHighRisk",
          SUM(users_at_critical_risk)::int AS "usersAtCriticalRisk",
          SUM(campaigns_run_12m)::int AS "campaignsRun12m",
          ROUND(AVG(reporting_rate_pct), 1)::numeric AS "reportingRatePct",
          CASE WHEN ROUND(SUM(org_risk_score * headcount::numeric) / NULLIF(SUM(headcount), 0)) >= 70 THEN 'critical'
               WHEN ROUND(SUM(org_risk_score * headcount::numeric) / NULLIF(SUM(headcount), 0)) >= 50 THEN 'high'
               WHEN ROUND(SUM(org_risk_score * headcount::numeric) / NULLIF(SUM(headcount), 0)) >= 30 THEN 'medium'
               ELSE 'low' END AS "riskLevel",
          (SELECT jsonb_agg(avg_score ORDER BY idx)
           FROM (
             SELECT ordinality - 1 AS idx,
                    ROUND(AVG((elem::text)::numeric))::int AS avg_score
             FROM human_risk.org_scores o2,
                  jsonb_array_elements(o2.risk_score_history) WITH ORDINALITY AS t(elem, ordinality)
             GROUP BY ordinality
           ) sub
          ) AS "riskScoreHistory"
        FROM human_risk.org_scores`
      ),
      safeQuery<{
        aro: number; perIncidentMeanSgd: number; perIncidentStdevSgd: number;
        aleSgd: number; aleSgd12mAgo: number; aleReducedSgd: number;
      }>(`
        SELECT ROUND(AVG(aro), 4)::numeric AS aro,
               ROUND(AVG(per_incident_mean_sgd))::int AS "perIncidentMeanSgd",
               ROUND(AVG(per_incident_stdev_sgd))::int AS "perIncidentStdevSgd",
               SUM(ale_sgd)::int AS "aleSgd",
               SUM(ale_sgd_12m_ago)::int AS "aleSgd12mAgo",
               SUM(ale_reduced_sgd)::int AS "aleReducedSgd"
        FROM human_risk.quant`
      )
    ]);
    if (!aggOrg.length) return null;
    const o = aggOrg[0];
    const q = aggQuant[0];
    const fallbackQuant = { aro: 0, perIncidentMeanSgd: 0, perIncidentStdevSgd: 0,
      aleSgd: 0, aleSgd12mAgo: 0, aleReducedSgd: 0,
      riskId: 'risk_all_humanrisk', scenarioId: 'scn_all_humanrisk' };
    return {
      tenantId: 'all',
      headcount: o.headcount,
      orgRiskScore: o.orgRiskScore,
      riskLevel: o.riskLevel as import('$lib/data/types').HumanRiskLevel,
      orgRiskScore12mAgo: o.orgRiskScore12mAgo,
      phishPronePct: +o.phishPronePct,
      phishPronePct12mAgo: +o.phishPronePct12mAgo,
      industryPhishPronePct: +o.industryPhishPronePct,
      trainingCompletionPct: +o.trainingCompletionPct,
      usersAtHighRisk: o.usersAtHighRisk,
      usersAtCriticalRisk: o.usersAtCriticalRisk,
      campaignsRun12m: o.campaignsRun12m,
      reportingRatePct: +o.reportingRatePct,
      riskScoreHistory: (() => {
        const raw: unknown[] = Array.isArray(o.riskScoreHistory) ? o.riskScoreHistory : [];
        if (!raw.length) return [];
        const scores = raw as number[];
        const pppStart = +o.phishPronePct12mAgo, pppEnd = +o.phishPronePct;
        const now = new Date();
        return scores.map((score, i) => {
          const d = new Date(now);
          d.setMonth(d.getMonth() - (scores.length - 1 - i));
          const period = d.toLocaleDateString('en-SG', { month: 'short', year: '2-digit' });
          const t = scores.length > 1 ? i / (scores.length - 1) : 1;
          const ppp = +(pppStart + (pppEnd - pppStart) * t).toFixed(1);
          return { period, score, ppp };
        });
      })(),
      quant: q ? {
        aro: +q.aro, perIncidentMeanSgd: q.perIncidentMeanSgd,
        perIncidentStdevSgd: q.perIncidentStdevSgd, aleSgd: q.aleSgd,
        aleSgd12mAgo: q.aleSgd12mAgo, aleReducedSgd: q.aleReducedSgd,
        riskId: 'risk_all_humanrisk', scenarioId: 'scn_all_humanrisk'
      } : fallbackQuant
    };
  }

  // Fetch org_scores and quant in parallel.
  type OrgRow = {
    tenantId: string;
    orgRiskScore: number;
    orgRiskScore12mAgo: number;
    phishPronePct: number;
    phishPronePct12mAgo: number;
    industryPhishPronePct: number;
    trainingCompletionPct: number;
    headcount: number;
    usersAtHighRisk: number;
    usersAtCriticalRisk: number;
    campaignsRun12m: number;
    reportingRatePct: number;
    riskLevel: string;
    riskScoreHistory: { period: string; score: number; ppp: number }[];
  };
  type QuantRow = {
    aro: number;
    perIncidentMeanSgd: number;
    perIncidentStdevSgd: number;
    aleSgd: number;
    aleSgd12mAgo: number;
    aleReducedSgd: number;
    riskId: string;
    scenarioId: string;
  };

  const [orgRows, quantRows] = await Promise.all([
    safeQuery<OrgRow>(
      `SELECT tenant_id AS "tenantId",
              org_risk_score AS "orgRiskScore",
              org_risk_score_12m_ago AS "orgRiskScore12mAgo",
              phish_prone_pct AS "phishPronePct",
              phish_prone_pct_12m_ago AS "phishPronePct12mAgo",
              industry_phish_prone_pct AS "industryPhishPronePct",
              training_completion_pct AS "trainingCompletionPct",
              headcount,
              users_at_high_risk AS "usersAtHighRisk",
              users_at_critical_risk AS "usersAtCriticalRisk",
              campaigns_run_12m AS "campaignsRun12m",
              reporting_rate_pct AS "reportingRatePct",
              risk_level AS "riskLevel",
              risk_score_history AS "riskScoreHistory"
         FROM human_risk.org_scores WHERE tenant_id = $1`,
      [tenantId]
    ),
    safeQuery<QuantRow>(
      `SELECT aro,
              per_incident_mean_sgd AS "perIncidentMeanSgd",
              per_incident_stdev_sgd AS "perIncidentStdevSgd",
              ale_sgd AS "aleSgd",
              ale_sgd_12m_ago AS "aleSgd12mAgo",
              ale_reduced_sgd AS "aleReducedSgd",
              risk_id AS "riskId",
              scenario_id AS "scenarioId"
         FROM human_risk.quant WHERE tenant_id = $1`,
      [tenantId]
    )
  ]);

  if (!orgRows.length) return null;

  const org = orgRows[0];
  const q = quantRows[0];
  const fallbackQuant = {
    aro: 0, perIncidentMeanSgd: 0, perIncidentStdevSgd: 0,
    aleSgd: 0, aleSgd12mAgo: 0, aleReducedSgd: 0,
    riskId: `risk_${tenantId}_humanrisk`, scenarioId: `scn_${tenantId}_humanrisk`
  };

  return {
    tenantId: org.tenantId,
    headcount: org.headcount,
    orgRiskScore: org.orgRiskScore,
    riskLevel: org.riskLevel as import('$lib/data/types').HumanRiskLevel,
    orgRiskScore12mAgo: org.orgRiskScore12mAgo,
    phishPronePct: +org.phishPronePct,
    phishPronePct12mAgo: +org.phishPronePct12mAgo,
    industryPhishPronePct: +org.industryPhishPronePct,
    trainingCompletionPct: +org.trainingCompletionPct,
    usersAtHighRisk: org.usersAtHighRisk,
    usersAtCriticalRisk: org.usersAtCriticalRisk,
    campaignsRun12m: org.campaignsRun12m,
    reportingRatePct: +org.reportingRatePct,
    riskScoreHistory: (() => {
      const raw: unknown[] = Array.isArray(org.riskScoreHistory) ? org.riskScoreHistory : [];
      if (!raw.length) return [];
      // DB stores plain score numbers; page expects { period, score, ppp }
      if (typeof raw[0] === 'number') {
        const scores = raw as number[];
        const pppStart = +org.phishPronePct12mAgo, pppEnd = +org.phishPronePct;
        const now = new Date();
        return scores.map((score, i) => {
          const d = new Date(now);
          d.setMonth(d.getMonth() - (scores.length - 1 - i));
          const period = d.toLocaleDateString('en-SG', { month: 'short', year: '2-digit' });
          const t = scores.length > 1 ? i / (scores.length - 1) : 1;
          const ppp = +(pppStart + (pppEnd - pppStart) * t).toFixed(1);
          return { period, score, ppp };
        });
      }
      return raw as { period: string; score: number; ppp: number }[];
    })(),
    quant: q ? {
      aro: +q.aro,
      perIncidentMeanSgd: q.perIncidentMeanSgd,
      perIncidentStdevSgd: q.perIncidentStdevSgd,
      aleSgd: q.aleSgd,
      aleSgd12mAgo: q.aleSgd12mAgo,
      aleReducedSgd: q.aleReducedSgd,
      riskId: q.riskId,
      scenarioId: q.scenarioId
    } : fallbackQuant
  };
}

export async function getHumanRiskUsers(tenantId?: string): Promise<HumanRiskUser[]> {
  if (!isPgMode()) return mock.humanRiskUsers(tenantId ?? 't_maybank');
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<HumanRiskUser>(
    `SELECT id, tenant_id AS "tenantId", name, email, department,
            job_title AS "jobTitle",
            risk_score AS "riskScore",
            risk_level AS "riskLevel",
            risk_score_30d_delta AS "riskScore30dDelta",
            phishing_sent AS "phishingSent",
            phishing_clicked AS "phishingClicked",
            phishing_reported AS "phishingReported",
            phishing_data_entered AS "phishingDataEntered",
            last_phish_result AS "lastPhishResult",
            last_phish_at AS "lastPhishAt",
            training_assigned AS "trainingAssigned",
            training_completed AS "trainingCompleted",
            training_completion_pct AS "trainingCompletionPct",
            last_training_at AS "lastTrainingAt",
            mfa_enabled AS "mfaEnabled",
            privileged_access AS "privilegedAccess",
            risk_history AS "riskHistory"
       FROM human_risk.users ${where} ORDER BY risk_score DESC LIMIT 5000`,
    params
  );
  return rows;
}

export async function getHumanRiskUser(id: string): Promise<HumanRiskUser | undefined> {
  if (!isPgMode()) return mock.humanRiskUser(id);
  const rows = await safeQuery<HumanRiskUser>(
    `SELECT id, tenant_id AS "tenantId", name, email, department,
            job_title AS "jobTitle",
            risk_score AS "riskScore",
            risk_level AS "riskLevel",
            risk_score_30d_delta AS "riskScore30dDelta",
            phishing_sent AS "phishingSent",
            phishing_clicked AS "phishingClicked",
            phishing_reported AS "phishingReported",
            phishing_data_entered AS "phishingDataEntered",
            last_phish_result AS "lastPhishResult",
            last_phish_at AS "lastPhishAt",
            training_assigned AS "trainingAssigned",
            training_completed AS "trainingCompleted",
            training_completion_pct AS "trainingCompletionPct",
            last_training_at AS "lastTrainingAt",
            mfa_enabled AS "mfaEnabled",
            privileged_access AS "privilegedAccess",
            risk_history AS "riskHistory"
       FROM human_risk.users WHERE id = $1`,
    [id]
  );
  return rows[0] ?? undefined;
}

export async function getHumanRiskDepartments(tenantId?: string): Promise<HumanRiskDepartment[]> {
  if (!isPgMode()) return mock.humanRiskDepartments(tenantId ?? 't_maybank');
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<HumanRiskDepartment>(
    `SELECT tenant_id AS "tenantId", department,
            headcount,
            avg_risk_score AS "avgRiskScore",
            risk_level AS "riskLevel",
            phish_prone_pct AS "phishPronePct",
            training_completion_pct AS "trainingCompletionPct",
            high_risk_users AS "highRiskUsers"
       FROM human_risk.departments ${where} ORDER BY avg_risk_score DESC`,
    params
  );
  return rows;
}

export async function getPhishingCampaigns(tenantId?: string): Promise<PhishingCampaign[]> {
  if (!isPgMode()) return mock.phishingCampaigns(tenantId ?? 't_maybank');
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<PhishingCampaign>(
    `SELECT id, tenant_id AS "tenantId", name, template,
            difficulty,
            sent_at AS "sentAt",
            recipients, delivered, opened, clicked,
            data_entered AS "dataEntered",
            reported,
            phish_prone_pct AS "phishPronePct",
            status::text AS status
       FROM human_risk.phishing_campaigns
      ${where}
      ORDER BY sent_at DESC`,
    params
  );
  return rows;
}

export async function getTrainingCampaigns(tenantId?: string): Promise<TrainingCampaign[]> {
  if (!isPgMode()) return mock.trainingCampaigns(tenantId ?? 't_maybank');
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<TrainingCampaign>(
    `SELECT id, tenant_id AS "tenantId", name,
            content_type::text AS "contentType",
            framework_ref AS "frameworkRef",
            enrolled, completed,
            completion_pct AS "completionPct",
            pass_rate AS "passRate",
            due_at AS "dueAt",
            status::text AS status
       FROM human_risk.training_campaigns
      ${where}
      ORDER BY due_at ASC`,
    params
  );
  return rows;
}

// =====================================================================
// KPI snapshot + Board narrative
// =====================================================================

async function computeVendorRiskIndex(tenantId?: string): Promise<number> {
  if (!isPgMode()) {
    const qs = tenantId
      ? mock.questionnairesForVendor(tenantId)
      : ['t_maybank', 't_grab', 't_govtech'].flatMap((t) => mock.questionnairesForVendor(t));
    const completed = qs.filter((q) => q.score != null);
    if (!completed.length) return 50;
    const avg = completed.reduce((s, q) => s + q.score!, 0) / completed.length;
    return Math.min(100, Math.max(0, Math.round(100 - avg)));
  }
  try {
    const sql = tenantId
      ? `SELECT ROUND(100 - COALESCE(AVG(q.score), 50))::int AS idx
           FROM vendor.questionnaires q
          WHERE q.tenant_id = $1 AND q.status = 'complete' AND q.score IS NOT NULL`
      : `SELECT ROUND(100 - COALESCE(AVG(q.score), 50))::int AS idx
           FROM vendor.questionnaires q
          WHERE q.status = 'complete' AND q.score IS NOT NULL`;
    const rows = await safeQuery<{ idx: number }>(sql, tenantId ? [tenantId] : []);
    const idx = rows[0]?.idx;
    return typeof idx === 'number' && !isNaN(idx) ? Math.min(100, Math.max(0, idx)) : 50;
  } catch {
    return 50;
  }
}

export async function getKpiSnapshot(tenantId?: string): Promise<KpiSnapshot> {
  let openCriticalRisks = 0, openFindings = 0, evidenceItems30d = 0, agentFteSaved30d = 0;

  if (isPgMode()) {
    const [riskRows, findingRows, evidenceRows] = await Promise.all([
      safeQuery<{ cnt: number }>(
        tenantId
          ? `SELECT COUNT(*)::int AS cnt FROM risk.risks WHERE tenant_id = $1 AND residual_severity = 'critical' AND status <> 'closed'`
          : `SELECT COUNT(*)::int AS cnt FROM risk.risks WHERE residual_severity = 'critical' AND status <> 'closed'`,
        tenantId ? [tenantId] : []
      ),
      safeQuery<{ cnt: number }>(
        tenantId
          ? `SELECT COUNT(*)::int AS cnt FROM audit.findings WHERE engagement_id IN (SELECT id FROM audit.engagements WHERE tenant_id = $1) AND status = 'open'`
          : `SELECT COUNT(*)::int AS cnt FROM audit.findings WHERE status = 'open'`,
        tenantId ? [tenantId] : []
      ),
      safeQuery<{ cnt: number }>(
        tenantId
          ? `SELECT COUNT(*)::int AS cnt FROM evidence.items WHERE tenant_id = $1 AND captured_at >= now() - interval '30 days'`
          : `SELECT COUNT(*)::int AS cnt FROM evidence.items WHERE captured_at >= now() - interval '30 days'`,
        tenantId ? [tenantId] : []
      )
    ]);
    openCriticalRisks = riskRows[0]?.cnt ?? 0;
    openFindings = findingRows[0]?.cnt ?? 0;
    evidenceItems30d = evidenceRows[0]?.cnt ?? 0;
  } else {
    const tenants = tenantId ? [tenantId] : (HERO_TENANTS as readonly string[]);
    for (const tid of tenants) {
      const risks = await getRisks(tid);
      openCriticalRisks += risks.filter((r) => r.residualSeverity === 'critical' && r.status !== 'closed').length;
      const audits = await getAudits(tid);
      for (const a of audits) {
        const f = await getAuditFindings(a.id);
        openFindings += f.filter((x) => x.status === 'open').length;
      }
      evidenceItems30d += mock.evidenceCount24h(tid) * 30;
    }
  }

  const ledger = await getCostLedger30d(tenantId);
  agentFteSaved30d = +ledger.reduce((s, e) => s + e.fteSavedHours, 0).toFixed(1);
  const scores = await getFrameworkScores(tenantId);
  const avgComplianceScore = scores.length
    ? +(scores.reduce((s, x) => s + (x.score ?? 0), 0) / scores.length).toFixed(1)
    : 0;
  const vendorRiskIndex = await computeVendorRiskIndex(tenantId);
  return {
    openCriticalRisks,
    avgComplianceScore,
    openFindings,
    vendorRiskIndex,
    agentFteSaved30d,
    evidenceItems30d
  };
}

export async function getKpiSnapshotBatch(tenantIds: string[]): Promise<Record<string, KpiSnapshot>> {
  if (!tenantIds.length) return {};
  if (!isPgMode()) {
    const result: Record<string, KpiSnapshot> = {};
    for (const tid of tenantIds) result[tid] = await getKpiSnapshot(tid);
    return result;
  }
  const [riskRows, findingRows, evidenceRows, ledgerRows, scoreRows, vendorRiskRows] = await Promise.all([
    safeQuery<{ tenantId: string; cnt: number }>(
      `SELECT tenant_id AS "tenantId", COUNT(*)::int AS cnt
       FROM risk.risks
       WHERE tenant_id = ANY($1) AND residual_severity = 'critical' AND status <> 'closed'
       GROUP BY tenant_id`, [tenantIds]
    ),
    safeQuery<{ tenantId: string; cnt: number }>(
      `SELECT e.tenant_id AS "tenantId", COUNT(f.id)::int AS cnt
       FROM audit.findings f
       JOIN audit.engagements e ON e.id = f.engagement_id
       WHERE e.tenant_id = ANY($1) AND f.status = 'open'
       GROUP BY e.tenant_id`, [tenantIds]
    ),
    safeQuery<{ tenantId: string; cnt: number }>(
      `SELECT tenant_id AS "tenantId", COUNT(*)::int AS cnt
       FROM evidence.items
       WHERE tenant_id = ANY($1) AND captured_at >= now() - interval '30 days'
       GROUP BY tenant_id`, [tenantIds]
    ),
    safeQuery<{ tenantId: string; fteHours: number }>(
      `SELECT tenant_id AS "tenantId", COALESCE(SUM(fte_saved_hours), 0)::float AS "fteHours"
       FROM agent.cost_ledger
       WHERE tenant_id = ANY($1) AND ts >= now() - interval '30 days'
       GROUP BY tenant_id`, [tenantIds]
    ),
    safeQuery<{ tenantId: string; avg: number }>(
      `SELECT tenant_id AS "tenantId", COALESCE(AVG(score), 0)::float AS avg
       FROM compliance.framework_score
       WHERE tenant_id = ANY($1)
       GROUP BY tenant_id`, [tenantIds]
    ),
    safeQuery<{ tenantId: string; idx: number }>(
      `SELECT tenant_id AS "tenantId",
              LEAST(100, GREATEST(0, ROUND(100 - COALESCE(AVG(score), 50))))::int AS idx
       FROM vendor.questionnaires
       WHERE tenant_id = ANY($1) AND status = 'complete' AND score IS NOT NULL
       GROUP BY tenant_id`, [tenantIds]
    )
  ]);

  const result: Record<string, KpiSnapshot> = {};
  for (const tid of tenantIds) {
    result[tid] = {
      openCriticalRisks: riskRows.find((r) => r.tenantId === tid)?.cnt ?? 0,
      openFindings: findingRows.find((r) => r.tenantId === tid)?.cnt ?? 0,
      evidenceItems30d: evidenceRows.find((r) => r.tenantId === tid)?.cnt ?? 0,
      agentFteSaved30d: +(ledgerRows.find((r) => r.tenantId === tid)?.fteHours ?? 0).toFixed(1),
      avgComplianceScore: +(scoreRows.find((r) => r.tenantId === tid)?.avg ?? 0).toFixed(1),
      vendorRiskIndex: vendorRiskRows.find((r) => r.tenantId === tid)?.idx ?? 50
    };
  }
  return result;
}

export async function getBoardNarrative(tenantId?: string): Promise<string> {
  const tenant = tenantId ? await getCurrentTenant(tenantId) : undefined;
  const name = tenant?.name ?? 'Group';
  const kpi = await getKpiSnapshot(tenantId);
  const hr = await getHumanRiskSummary(tenantId);
  const today = new Date().toLocaleDateString('en-SG', { month: 'long', year: 'numeric' });

  const provider = await getTenantProvider(tenantId);
  const metrics = [
    `Organisation: ${name}`,
    `Report date: ${today}`,
    `Open critical risks: ${kpi.openCriticalRisks}`,
    `Average compliance score: ${kpi.avgComplianceScore}/100`,
    `Open audit findings: ${kpi.openFindings}`,
    `Vendor risk index: ${kpi.vendorRiskIndex}/100 (higher = more risk)`,
    `Agent FTE saved (30d): ${kpi.agentFteSaved30d} hours`,
    `Evidence items collected (30d): ${kpi.evidenceItems30d}`,
    hr ? [
      `Human risk score: ${hr.orgRiskScore}/100 (${hr.riskLevel})`,
      `Phish-prone %: ${hr.phishPronePct}% (industry: ${hr.industryPhishPronePct}%)`,
      `Training completion: ${hr.trainingCompletionPct}%`,
      `Human-risk ALE: S$${(hr.quant.aleSgd / 1e6).toFixed(2)}M`
    ].join('\n') : ''
  ].filter(Boolean).join('\n');

  const system = `You are a senior GRC analyst at ${name} preparing a concise board risk pack narrative. Write in a formal, data-driven tone suitable for a board risk committee. Use markdown bold for the title. Do not invent numbers not listed in the user message.`;
  const user = `Write 4–5 short paragraphs. Focus on: (1) overall risk posture, (2) compliance, (3) third-party/vendor risk, (4) agentic AI operations ROI, and (5) human risk if data is provided.\n\nMetrics:\n${metrics}`;
  const text = await callLlm(system, user, provider, { maxTokens: 600 });
  if (text) return text;

  // Template fallback when no LLM key is configured.
  const hr2 = hr ? `\n\nHuman risk — the people layer — is quantified via the KnowBe4 Virtual Risk Officer integration, scoring all ${hr.headcount.toLocaleString()} staff with an organisation Human Risk Score of ${hr.orgRiskScore}/100 (${hr.riskLevel}). The phish-prone percentage stands at ${hr.phishPronePct}% vs. an industry benchmark of ${hr.industryPhishPronePct}%, with ${hr.trainingCompletionPct}% training completion. Translated through FAIR, the annualised loss expectancy is S$${(hr.quant.aleSgd / 1e6).toFixed(2)}M.` : '';
  return [
    `**${name} — Risk Pack, ${today}**`,
    '',
    `Aggregate risk posture: ${kpi.openCriticalRisks} open critical risk(s), average compliance score ${kpi.avgComplianceScore}/100, ${kpi.openFindings} open audit finding(s).`,
    '',
    `Vendor risk index: ${kpi.vendorRiskIndex}/100. Agent operations recovered ${kpi.agentFteSaved30d} FTE hours over the past 30 days; ${kpi.evidenceItems30d} evidence items collected.` + hr2
  ].join('\n');
}
