// =====================================================================
//  Server-side data dispatcher. Every public function checks DATA_MODE
//  and either issues a Postgres query (when `pg`) or returns the
//  in-memory mock fixtures (default). Routes import only from here so
//  swapping the backing store is a one-line change.
// =====================================================================

import { env } from '$env/dynamic/private';
import { isPgMode, getPool } from './pg';
import * as mock from '$lib/data/mock';
import type {
  Tenant, Agent, AgentRun, AgentDecision, AgentFleetSummary, CostLedgerEntry, AgentTool,
  Risk, FAIRRun, AppetiteStatement, HeatmapCell,
  Framework, Requirement, FrameworkScore,
  Control, ControlTestRun,
  EvidenceItem,
  AuditEngagement, AuditFinding,
  Policy, PolicyVersion,
  Vendor, Questionnaire, FourthParty, Concentration, QuestionnaireResponse,
  PrivacyActivity, DPIA, SubjectRequest, Breach,
  ESGMetric, ESGDisclosure, ESGTarget,
  AIModel, ModelRisk, PromptAuditEntry,
  Incident, TimelineEvent, Postmortem,
  Issue, IssueAction,
  BCMPlan, BCMDependency, BCMTest,
  RegChange, ImpactAssessment, RegSource,
  Workflow, WorkflowExecution,
  Connector,
  AuditLogEntry,
  KpiSnapshot,
  HumanRiskSummary, HumanRiskUser, HumanRiskDepartment, PhishingCampaign, TrainingCampaign
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

/**
 * Resolve the owning tenant of a row by its primary key. In pg mode the
 * detail-page id is a DB UUID, not the mock `kind_tenant_n` string, so the
 * tenant can't be parsed out of the id. A 1-column lookup lets the by-id
 * getters reuse the existing tenant-scoped list query (which already maps
 * every column). `table` is always a hard-coded literal — never user input.
 * Returns undefined when the row isn't found so callers fall back to their
 * mock-prefix decoding.
 */
async function tenantOfRow(table: string, id: string): Promise<string | undefined> {
  const rows = await safeQuery<{ tenantId: string }>(
    `SELECT tenant_id AS "tenantId" FROM ${table} WHERE id = $1`,
    [id]
  );
  return rows[0]?.tenantId;
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
            created_at AS "createdAt"
     FROM platform.tenants ORDER BY name`
  );
  return rows.length ? rows : mock.TENANTS;
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
     FROM platform.users ${where} ORDER BY name`, params
  );
  if (rows.length) return rows;
  const { getUsersAll, getUsersForTenant } = await import('$lib/data/users');
  return tenantId ? getUsersForTenant(tenantId) : getUsersAll();
}

// =====================================================================
// Agents
// =====================================================================

export async function getLiveAgentCount(): Promise<number> {
  if (!isPgMode()) return mock.liveAgentCount();
  const rows = await safeQuery<{ n: string }>(`SELECT COUNT(*)::text AS n FROM agent.agents WHERE status = 'running'`);
  return rows.length ? Number(rows[0].n) : mock.liveAgentCount();
}

export async function getAgents(): Promise<Agent[]> {
  if (!isPgMode()) return mock.AGENTS;
  const rows = await safeQuery<Agent>(
    `SELECT id, name, slug, description, type::text AS type, status, owner_team AS "ownerTeam",
            cost_per_run_cents AS "costPerRunCents", cost_monthly_estimate_cents AS "costMonthlyEstimateCents",
            fte_equivalent AS "fteEquivalent"
     FROM agent.agents ORDER BY name`
  );
  return rows.length ? rows : mock.AGENTS;
}

export async function getAgent(id: string): Promise<Agent | undefined> {
  const all = await getAgents();
  return all.find((a) => a.id === id);
}

export async function getAgentTools(agentId: string): Promise<AgentTool[]> {
  if (!isPgMode()) return mock.AGENT_TOOLS.filter((t) => t.agentId === agentId);
  const rows = await safeQuery<AgentTool>(
    `SELECT agent_id AS "agentId", tool_name AS "toolName", tool_kind AS "toolKind", description
     FROM agent.tools WHERE agent_id = $1`, [agentId]
  );
  return rows.length ? rows : mock.AGENT_TOOLS.filter((t) => t.agentId === agentId);
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
  return rows.length ? rows : mock.recentAgentRuns(limit, tenantId);
}

export async function getAgentRunsForAgent(agentId: string, limit = 20): Promise<AgentRun[]> {
  if (!isPgMode()) return mock.recentAgentRuns(limit).filter((r) => r.agentId === agentId);
  const rows = await safeQuery<AgentRun>(
    `SELECT r.id, r.tenant_id AS "tenantId", r.agent_id AS "agentId", a.name AS "agentName",
            r.trigger::text AS trigger, r.started_at AS "startedAt", r.ended_at AS "endedAt",
            r.status::text AS status, r.input_summary AS "inputSummary", r.output_summary AS "outputSummary",
            r.tools_called AS "toolsCalled", r.cost_cents AS "costCents", r.latency_ms AS "latencyMs"
     FROM agent.runs r JOIN agent.agents a ON a.id = r.agent_id
     WHERE r.agent_id = $1 ORDER BY r.started_at DESC LIMIT $2`, [agentId, limit]
  );
  return rows.length ? rows : mock.recentAgentRuns(limit).filter((r) => r.agentId === agentId);
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
  return rows.length ? rows : mock.recentDecisions(limit, tenantId);
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
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<CostLedgerEntry>(
    `SELECT tenant_id AS "tenantId", agent_id AS "agentId", ts, runs, cost_cents AS "costCents",
            fte_saved_hours AS "fteSavedHours"
     FROM agent.cost_ledger ${where} AND ts >= now() - interval '30 days'`.replace('WHERE  AND', 'WHERE'),
    params
  );
  return rows.length ? rows : mock.agentCostLedger30d(tenantId);
}

export async function getAgentFleetSummary(): Promise<AgentFleetSummary[]> {
  if (!isPgMode()) return mock.agentFleetSummary();
  const rows = await safeQuery<AgentFleetSummary>(
    `SELECT id, name, type::text AS type, status,
            runs_30d AS "runs30d", cost_cents_30d AS "costCents30d", fte_hours_30d AS "fteHours30d"
     FROM agent.fleet_summary`
  );
  return rows.length ? rows : mock.agentFleetSummary();
}

// =====================================================================
// Risk
// =====================================================================

export async function getRisks(tenantId?: string): Promise<Risk[]> {
  if (!isPgMode()) return tenantId ? mock.risksForTenant(tenantId) : HERO_TENANTS.flatMap((t) => mock.risksForTenant(t));
  const sql = tenantId
    ? `SELECT id::text AS id, tenant_id AS "tenantId", register_id::text AS "registerId",
              code, title, description, category,
              inherent_severity::text AS "inherentSeverity",
              inherent_likelihood::text AS "inherentLikelihood",
              residual_severity::text AS "residualSeverity",
              residual_likelihood::text AS "residualLikelihood",
              status::text AS status,
              treatment_strategy::text AS "treatmentStrategy",
              last_assessed_at AS "lastAssessedAt", next_review_at AS "nextReviewAt",
              business_service AS "businessService", tags
       FROM risk.risks WHERE tenant_id = $1 ORDER BY code`
    : `SELECT id::text AS id, tenant_id AS "tenantId", register_id::text AS "registerId",
              code, title, description, category,
              inherent_severity::text AS "inherentSeverity",
              inherent_likelihood::text AS "inherentLikelihood",
              residual_severity::text AS "residualSeverity",
              residual_likelihood::text AS "residualLikelihood",
              status::text AS status,
              treatment_strategy::text AS "treatmentStrategy",
              last_assessed_at AS "lastAssessedAt", next_review_at AS "nextReviewAt",
              business_service AS "businessService", tags
       FROM risk.risks ORDER BY tenant_id, code`;
  const rows = await safeQuery<Risk>(sql, tenantId ? [tenantId] : []);
  return rows.length ? rows : (tenantId ? mock.risksForTenant(tenantId) : HERO_TENANTS.flatMap((t) => mock.risksForTenant(t)));
}

export async function getRisk(id: string): Promise<Risk | undefined> {
  if (isPgMode()) {
    const tid = await tenantOfRow('risk.risks', id);
    if (tid) return (await getRisks(tid)).find((r) => r.id === id);
  }
  // Decode tenant from the mock id prefix.
  const parts = id.split('_');
  if (parts.length < 3) return undefined;
  const tenantId = `${parts[1]}_${parts[2]}`;
  const all = await getRisks(tenantId);
  return all.find((r) => r.id === id);
}

const SEV_RANK: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, informational: 1 };
const LIK_RANK: Record<string, number> = { almost_certain: 5, likely: 4, possible: 3, unlikely: 2, rare: 1 };

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
  return rows.length ? rows : mock.heatmapCells(tenantId);
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
  return rows[0] ?? mock.fairRunForRisk(scenarioOrRiskId);
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
  return rows.length ? rows : mock.fairScenariosForTenant(tenantId ?? 't_maybank');
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

export async function getAppetiteStatements(tenantId?: string): Promise<AppetiteStatement[]> {
  if (!isPgMode()) return mock.appetiteStatementsForTenant(tenantId ?? 't_maybank');
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<AppetiteStatement>(
    `SELECT id::text AS id, tenant_id AS "tenantId", category, statement,
            threshold_sgd AS "thresholdSgd", severity_cap::text AS "severityCap"
     FROM risk.appetite_statements ${where} ORDER BY category`,
    params
  );
  return rows.length ? rows : mock.appetiteStatementsForTenant(tenantId ?? 't_maybank');
}

// =====================================================================
// Frameworks / Compliance
// =====================================================================

export async function getFrameworks(): Promise<Framework[]> {
  if (!isPgMode()) return mock.FRAMEWORKS;
  const rows = await safeQuery<Framework>(
    `SELECT id, name, version, regulator, region, jurisdiction,
            total_requirements AS "totalRequirements", tags
     FROM compliance.frameworks ORDER BY name`
  );
  return rows.length ? rows : mock.FRAMEWORKS;
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
     FROM compliance.requirements WHERE framework_id = $1 ORDER BY code`, [id]
  );
  return rows.length ? rows : mock.getRequirementsForFramework(id);
}

export async function getFrameworkScores(tenantId?: string): Promise<FrameworkScore[]> {
  if (!isPgMode()) {
    // Synthesize scores per tenant from FRAMEWORKS list for top 8.
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
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<FrameworkScore>(
    `SELECT tenant_id AS "tenantId", framework_id AS "frameworkId", name, version, region,
            status::text AS status, score, next_due_at AS "nextDueAt"
     FROM compliance.framework_score ${where}`, params
  );
  return rows;
}

// =====================================================================
// Controls
// =====================================================================

export async function getControls(tenantId?: string): Promise<Control[]> {
  if (!isPgMode()) return tenantId ? mock.controlsForTenant(tenantId) : HERO_TENANTS.flatMap((t) => mock.controlsForTenant(t));
  const sql = tenantId
    ? `SELECT id, tenant_id AS "tenantId", code, title, description, type::text AS type,
              family, frequency, automated, maturity::text AS maturity
       FROM control.library WHERE tenant_id = $1 ORDER BY code`
    : `SELECT id, tenant_id AS "tenantId", code, title, description, type::text AS type,
              family, frequency, automated, maturity::text AS maturity
       FROM control.library ORDER BY tenant_id, code`;
  const rows = await safeQuery<Control>(sql, tenantId ? [tenantId] : []);
  return rows.length ? rows : (tenantId ? mock.controlsForTenant(tenantId) : HERO_TENANTS.flatMap((t) => mock.controlsForTenant(t)));
}

export async function getControl(id: string): Promise<Control | undefined> {
  if (!isPgMode()) return mock.getControlById(id);
  const rows = await safeQuery<Control>(
    `SELECT id, tenant_id AS "tenantId", code, title, description, type::text AS type,
            family, frequency, automated, maturity::text AS maturity
     FROM control.library WHERE id = $1`, [id]
  );
  return rows[0] ?? mock.getControlById(id);
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
  if (rows.length) return rows;
  const c = mock.getControlById(controlId);
  if (!c) return [];
  return mock.recentControlTestRuns(c.tenantId, limit).filter((r) => r.controlId === controlId);
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
  if (rows.length) return rows;
  if (tenantId) return mock.recentControlTestRuns(tenantId, limit);
  return HERO_TENANTS.flatMap((tid) => mock.recentControlTestRuns(tid, Math.ceil(limit / 3))).slice(0, limit);
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
  return rows.length ? rows : (tenantId ? mock.evidenceForTenant(tenantId, limit) : HERO_TENANTS.flatMap((t) => mock.evidenceForTenant(t, limit)));
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
  return {
    total: totalRows[0] ? Number(totalRows[0].n) : 0,
    last24h: recentRows[0] ? Number(recentRows[0].n) : 0,
    chainOk: true
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
     FROM audit.engagements ${where} ORDER BY opened_at DESC`, params
  );
  return rows.length ? rows : (tenantId ? mock.auditsForTenant(tenantId) : HERO_TENANTS.flatMap((t) => mock.auditsForTenant(t)));
}

export async function getAudit(id: string): Promise<AuditEngagement | undefined> {
  if (isPgMode()) {
    const tid = await tenantOfRow('audit.engagements', id);
    if (tid) return (await getAudits(tid)).find((a) => a.id === id);
    return (await getAudits()).find((a) => a.id === id);
  }
  const parts = id.split('_');
  if (parts.length < 3) return undefined;
  const tenantId = `${parts[1]}_${parts[2]}`;
  return (await getAudits(tenantId)).find((a) => a.id === id);
}

export async function getAuditFindings(engagementId: string): Promise<AuditFinding[]> {
  if (!isPgMode()) return mock.auditFindings(engagementId);
  const rows = await safeQuery<AuditFinding>(
    `SELECT id::text AS id, tenant_id AS "tenantId", engagement_id::text AS "engagementId",
            severity::text AS severity, title, description, control_id AS "controlId",
            due_at AS "dueAt", status::text AS status
     FROM audit.findings WHERE engagement_id = $1`, [engagementId]
  );
  return rows.length ? rows : mock.auditFindings(engagementId);
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
  return rows.length ? rows : mock.regChanges(limit);
}

export async function getRegChange(id: string): Promise<RegChange | undefined> {
  const all = await getRegChanges(100);
  return all.find((c) => c.id === id);
}

export async function getRegSources(): Promise<RegSource[]> {
  if (!isPgMode()) return mock.REG_SOURCES;
  const rows = await safeQuery<RegSource>(
    `SELECT id, regulator_code AS "regulatorCode", name, source_url AS "sourceUrl",
            jurisdiction, last_scanned_at AS "lastScannedAt", enabled
     FROM regwatch.sources ORDER BY name`
  );
  return rows.length ? rows : mock.REG_SOURCES;
}

export async function getImpactAssessments(changeId: string, tenantId?: string): Promise<ImpactAssessment[]> {
  if (!isPgMode()) return mock.impactAssessmentsForChange(changeId, tenantId);
  const clauses: string[] = ['change_id = $1::uuid'];
  const params: unknown[] = [changeId];
  if (tenantId) { params.push(tenantId); clauses.push(`tenant_id = $${params.length}`); }
  const rows = await safeQuery<ImpactAssessment>(
    `SELECT id::text AS id, tenant_id AS "tenantId", change_id::text AS "changeId",
            framework_id AS "frameworkId", impact::text AS impact,
            gaps_opened AS "gapsOpened", assessed_by_agent_id AS "assessedByAgentId",
            assessed_at AS "assessedAt", notes
     FROM regwatch.impact_assessments WHERE ${clauses.join(' AND ')}`,
    params
  );
  return rows.length ? rows : mock.impactAssessmentsForChange(changeId, tenantId);
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
     FROM policy.documents ${where} ORDER BY code`, params
  );
  return rows.length ? rows : (tenantId ? mock.policiesForTenant(tenantId) : HERO_TENANTS.flatMap((t) => mock.policiesForTenant(t)));
}

export async function getPolicy(id: string): Promise<Policy | undefined> {
  if (isPgMode()) {
    const tid = await tenantOfRow('policy.documents', id);
    if (tid) return (await getPolicies(tid)).find((p) => p.id === id);
  }
  const parts = id.split('_');
  if (parts.length < 3) return undefined;
  const tenantId = `${parts[1]}_${parts[2]}`;
  return (await getPolicies(tenantId)).find((p) => p.id === id);
}

export async function getPolicyVersions(id: string): Promise<PolicyVersion[]> {
  if (!isPgMode()) return mock.policyVersions(id);
  const rows = await safeQuery<PolicyVersion>(
    `SELECT id::text AS id, tenant_id AS "tenantId", document_id::text AS "documentId",
            version_no AS "versionNo", content_md AS "contentMd", status::text AS status,
            effective_at AS "effectiveAt", drafted_by_agent_id AS "draftedByAgentId"
     FROM policy.versions WHERE document_id = $1 ORDER BY version_no`, [id]
  );
  return rows.length ? rows : mock.policyVersions(id);
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
              status::text AS status
       FROM vendor.vendors WHERE tenant_id = $1 ORDER BY name`
    : `SELECT id::text AS id, tenant_id AS "tenantId", name, category,
              tier::text AS tier, criticality::text AS criticality,
              hq_country AS "hqCountry", primary_contact_email AS "primaryContactEmail",
              status::text AS status
       FROM vendor.vendors ORDER BY tenant_id, name`;
  const rows = await safeQuery<Vendor>(sql, tenantId ? [tenantId] : []);
  return rows.length ? rows : (tenantId ? mock.vendorsForTenant(tenantId) : HERO_TENANTS.flatMap((t) => mock.vendorsForTenant(t)));
}

export async function getVendor(id: string): Promise<Vendor | undefined> {
  if (isPgMode()) {
    const tid = await tenantOfRow('vendor.vendors', id);
    if (tid) return (await getVendors(tid)).find((v) => v.id === id);
  }
  const parts = id.split('_');
  if (parts.length < 3) return undefined;
  const tenantId = `${parts[1]}_${parts[2]}`;
  return (await getVendors(tenantId)).find((v) => v.id === id);
}

export async function getQuestionnaires(tenantId?: string): Promise<Questionnaire[]> {
  if (!isPgMode()) return tenantId ? mock.questionnairesForVendor(tenantId) : HERO_TENANTS.flatMap((t) => mock.questionnairesForVendor(t));
  const where = tenantId ? 'WHERE q.tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<Questionnaire>(
    `SELECT q.id::text AS id, q.tenant_id AS "tenantId", q.vendor_id::text AS "vendorId",
            v.name AS "vendorName", q.template, q.status::text AS status,
            q.sent_at AS "sentAt", q.completed_at AS "completedAt",
            q.completed_by_agent_id AS "completedByAgentId", q.score
     FROM vendor.questionnaires q JOIN vendor.vendors v ON v.id = q.vendor_id
     ${where} ORDER BY q.sent_at DESC`, params
  );
  return rows.length ? rows : (tenantId ? mock.questionnairesForVendor(tenantId) : HERO_TENANTS.flatMap((t) => mock.questionnairesForVendor(t)));
}

export async function getQuestionnaire(id: string): Promise<Questionnaire | undefined> {
  if (isPgMode()) {
    const tid = await tenantOfRow('vendor.questionnaires', id);
    if (tid) return (await getQuestionnaires(tid)).find((q) => q.id === id);
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
     FROM vendor.responses WHERE questionnaire_id = $1`, [questionnaireId]
  );
  return rows.length ? rows : mock.questionnaireResponsesFor(questionnaireId);
}

export async function getFourthParties(tenantId?: string): Promise<FourthParty[]> {
  if (!isPgMode()) return tenantId ? mock.fourthPartiesForTenant(tenantId) : HERO_TENANTS.flatMap((t) => mock.fourthPartiesForTenant(t));
  const where = tenantId ? 'WHERE fp.tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<FourthParty>(
    `SELECT fp.id::text AS id, fp.tenant_id AS "tenantId", fp.vendor_id::text AS "vendorId",
            v.name AS "vendorName", fp.name, fp.type, fp.region, fp.criticality::text AS criticality
     FROM vendor.fourth_parties fp JOIN vendor.vendors v ON v.id = fp.vendor_id
     ${where}`, params
  );
  return rows.length ? rows : (tenantId ? mock.fourthPartiesForTenant(tenantId) : HERO_TENANTS.flatMap((t) => mock.fourthPartiesForTenant(t)));
}

export async function getConcentrations(tenantId?: string): Promise<Concentration[]> {
  if (!isPgMode()) return tenantId ? mock.concentrationsForTenant(tenantId) : HERO_TENANTS.flatMap((t) => mock.concentrationsForTenant(t));
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<Concentration>(
    `SELECT id::text AS id, tenant_id AS "tenantId", dimension, key,
            vendor_count AS "vendorCount", exposure_sgd AS "exposureSgd"
     FROM vendor.concentrations ${where}`, params
  );
  return rows.length ? rows : (tenantId ? mock.concentrationsForTenant(tenantId) : HERO_TENANTS.flatMap((t) => mock.concentrationsForTenant(t)));
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
     FROM privacy.processing_activities ${where} ORDER BY code`,
    params
  );
  return rows.length ? rows : mock.privacyActivitiesForTenant(tenantId ?? 't_maybank');
}

export async function getDPIAs(tenantId?: string): Promise<DPIA[]> {
  if (!isPgMode()) return mock.dpiasForTenant(tenantId ?? 't_maybank');
  const where = tenantId ? 'WHERE d.tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<DPIA>(
    `SELECT d.id::text AS id, d.tenant_id AS "tenantId",
            d.activity_id::text AS "activityId", a.name AS "activityName",
            d.status, d.residual_risk_severity::text AS "residualRiskSeverity",
            d.conducted_at AS "conductedAt"
     FROM privacy.dpias d
     JOIN privacy.processing_activities a ON a.id = d.activity_id
     ${where} ORDER BY d.created_at DESC`,
    params
  );
  return rows.length ? rows : mock.dpiasForTenant(tenantId ?? 't_maybank');
}

export async function getSubjectRequests(tenantId?: string): Promise<SubjectRequest[]> {
  if (!isPgMode()) return mock.subjectRequestsForTenant(tenantId ?? 't_maybank');
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<SubjectRequest>(
    `SELECT id::text AS id, tenant_id AS "tenantId", kind::text AS kind,
            requester_email AS "requesterEmail", received_at AS "receivedAt",
            due_at AS "dueAt", status::text AS status, resolved_at AS "resolvedAt"
     FROM privacy.subject_requests ${where} ORDER BY received_at DESC`,
    params
  );
  return rows.length ? rows : mock.subjectRequestsForTenant(tenantId ?? 't_maybank');
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
     FROM privacy.breaches ${where} ORDER BY occurred_at DESC`,
    params
  );
  return rows.length ? rows : mock.breachesForTenant(tenantId ?? 't_maybank');
}

export async function getESGMetrics(tenantId?: string): Promise<ESGMetric[]> {
  if (!isPgMode()) return mock.esgMetricsForTenant(tenantId ?? 't_maybank');
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<ESGMetric>(
    `SELECT id, tenant_id AS "tenantId", period, scope, category,
            metric, value, unit, framework
     FROM esg.metrics ${where} ORDER BY period DESC, category, metric`,
    params
  );
  return rows.length ? rows : mock.esgMetricsForTenant(tenantId ?? 't_maybank');
}

export async function getESGDisclosures(tenantId?: string): Promise<ESGDisclosure[]> {
  if (!isPgMode()) return mock.esgDisclosuresForTenant(tenantId ?? 't_maybank');
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<ESGDisclosure>(
    `SELECT id::text AS id, tenant_id AS "tenantId", framework, period,
            status, published_at AS "publishedAt"
     FROM esg.disclosures ${where} ORDER BY period DESC, framework`,
    params
  );
  return rows.length ? rows : mock.esgDisclosuresForTenant(tenantId ?? 't_maybank');
}

export async function getESGTargets(tenantId?: string): Promise<ESGTarget[]> {
  if (!isPgMode()) return mock.esgTargetsForTenant(tenantId ?? 't_maybank');
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<ESGTarget>(
    `SELECT id::text AS id, tenant_id AS "tenantId", framework, metric,
            baseline_value AS "baselineValue", baseline_period AS "baselinePeriod",
            target_value AS "targetValue", target_period AS "targetPeriod"
     FROM esg.targets ${where} ORDER BY framework, metric`,
    params
  );
  return rows.length ? rows : mock.esgTargetsForTenant(tenantId ?? 't_maybank');
}

export async function getAIModels(tenantId?: string): Promise<AIModel[]> {
  if (!isPgMode()) return mock.aiModelsForTenant(tenantId ?? 't_maybank');
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<AIModel>(
    `SELECT id::text AS id, tenant_id AS "tenantId", name, kind,
            risk_tier::text AS "riskTier", jurisdiction,
            eu_ai_act_class AS "euAiActClass",
            iso_42001_status::text AS "iso42001Status"
     FROM ai_gov.models ${where} ORDER BY name`,
    params
  );
  return rows.length ? rows : mock.aiModelsForTenant(tenantId ?? 't_maybank');
}

export async function getAIModel(id: string): Promise<AIModel | undefined> {
  if (isPgMode()) {
    const tid = await tenantOfRow('ai_gov.models', id);
    if (tid) return (await getAIModels(tid)).find((m) => m.id === id);
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
     FROM ai_gov.model_risk WHERE model_id = $1::uuid ORDER BY severity`,
    [modelId]
  );
  return rows.length ? rows : mock.modelRisksForModel(modelId);
}

export async function getPromptsAudit(tenantId?: string, limit = 50): Promise<PromptAuditEntry[]> {
  if (!isPgMode()) return mock.promptsAuditForTenant(tenantId ?? 't_maybank', limit);
  const clauses: string[] = [];
  const params: unknown[] = [limit];
  if (tenantId) { params.push(tenantId); clauses.push(`tenant_id = $${params.length}`); }
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
  return rows.length ? rows : mock.promptsAuditForTenant(tenantId ?? 't_maybank', limit);
}

// =====================================================================
// SOX
// =====================================================================

export async function getSOXItgcs(tenantId?: string) {
  const tid = tenantId ?? 't_maybank';
  if (!isPgMode()) return mock.soxItgcsForTenant(tid);
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
     FROM sox.itgcs ${where} ORDER BY control_ref`,
    params
  );
  return rows.length ? rows : mock.soxItgcsForTenant(tid);
}

export async function getSOXKcas(tenantId?: string) {
  const tid = tenantId ?? 't_maybank';
  if (!isPgMode()) return mock.soxKcasForTenant(tid);
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<import('$lib/data/specialized').SOXKca>(
    `SELECT id::text AS id, tenant_id AS "tenantId",
            attribute AS code,
            attribute AS name,
            '' AS process,
            '' AS owner,
            'monthly' AS frequency,
            0 AS "automationPct",
            assessed_at AS "lastTestedAt",
            'pass' AS result
     FROM sox.kcas ${where} ORDER BY attribute`,
    params
  );
  return rows.length ? rows : mock.soxKcasForTenant(tid);
}

export async function getSOXWalkthroughs(tenantId?: string) {
  const tid = tenantId ?? 't_maybank';
  if (!isPgMode()) return mock.soxWalkthroughsForTenant(tid);
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<import('$lib/data/specialized').SOXWalkthrough>(
    `SELECT id::text AS id, tenant_id AS "tenantId",
            COALESCE(description, '') AS process,
            EXTRACT(YEAR FROM COALESCE(completed_at, created_at))::int AS year,
            CASE
              WHEN completed_at IS NOT NULL THEN 'complete'
              ELSE 'in-progress'
            END AS status,
            '' AS "conductedBy",
            COALESCE(completed_at, created_at) AS "conductedAt"
     FROM sox.walkthroughs ${where} ORDER BY COALESCE(completed_at, created_at) DESC`,
    params
  );
  return rows.length ? rows : mock.soxWalkthroughsForTenant(tid);
}

export async function getSOXDeficiencies(tenantId?: string) {
  const tid = tenantId ?? 't_maybank';
  if (!isPgMode()) return mock.soxDeficienciesForTenant(tid);
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
            '' AS "rootCause",
            COALESCE(remediation_plan, '') AS remediation,
            COALESCE(remediated_at::date::text, (created_at + interval '90 days')::date::text) AS "targetDate",
            (remediated_at IS NOT NULL) AS "onTrack"
     FROM sox.deficiencies ${where} ORDER BY created_at DESC`,
    params
  );
  return rows.length ? rows : mock.soxDeficienciesForTenant(tid);
}

// =====================================================================
// Incidents / Issues / BCM
// =====================================================================

export async function getIncidents(tenantId?: string): Promise<Incident[]> {
  if (!isPgMode()) return tenantId ? mock.incidentsForTenant(tenantId) : HERO_TENANTS.flatMap((t) => mock.incidentsForTenant(t));
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<Incident>(
    `SELECT id::text AS id, tenant_id AS "tenantId", code, severity::text AS severity,
            title, status::text AS status, opened_at AS "openedAt",
            contained_at AS "containedAt", resolved_at AS "resolvedAt"
     FROM incident.incidents ${where} ORDER BY opened_at DESC`, params
  );
  return rows.length ? rows : (tenantId ? mock.incidentsForTenant(tenantId) : HERO_TENANTS.flatMap((t) => mock.incidentsForTenant(t)));
}

export async function getIncident(id: string): Promise<Incident | undefined> {
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
     FROM incident.timeline_events WHERE incident_id = $1::uuid ORDER BY ts`,
    [incidentId]
  );
  return rows.length ? rows : mock.timelineForIncident(incidentId);
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
  return rows[0] ?? mock.postmortemForIncident(incidentId);
}

export async function getIssues(tenantId?: string): Promise<Issue[]> {
  if (!isPgMode()) return tenantId ? mock.issuesForTenant(tenantId) : HERO_TENANTS.flatMap((t) => mock.issuesForTenant(t));
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<Issue>(
    `SELECT id::text AS id, tenant_id AS "tenantId", source::text AS source,
            source_id AS "sourceId", title, severity::text AS severity, status::text AS status,
            owner_user_id AS "ownerUserId", due_at AS "dueAt"
     FROM issue.issues ${where} ORDER BY due_at`, params
  );
  return rows.length ? rows : (tenantId ? mock.issuesForTenant(tenantId) : HERO_TENANTS.flatMap((t) => mock.issuesForTenant(t)));
}

export async function getIssue(id: string): Promise<Issue | undefined> {
  if (isPgMode()) {
    const tid = await tenantOfRow('issue.issues', id);
    if (tid) return (await getIssues(tid)).find((i) => i.id === id);
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
     FROM issue.actions WHERE issue_id = $1::uuid ORDER BY due_at`,
    [issueId]
  );
  return rows.length ? rows : mock.actionsForIssue(issueId);
}

export async function getBCMPlans(tenantId?: string): Promise<BCMPlan[]> {
  if (!isPgMode()) return mock.bcmPlansForTenant(tenantId ?? 't_maybank');
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<BCMPlan>(
    `SELECT id::text AS id, tenant_id AS "tenantId", name, business_service AS "businessService",
            rto_minutes AS "rtoMinutes", rpo_minutes AS "rpoMinutes",
            last_tested_at AS "lastTestedAt", next_test_at AS "nextTestAt"
     FROM bcm.plans ${where} ORDER BY name`,
    params
  );
  return rows.length ? rows : mock.bcmPlansForTenant(tenantId ?? 't_maybank');
}

export async function getBCMPlan(id: string): Promise<BCMPlan | undefined> {
  const parts = id.split('_');
  if (parts.length < 3) return undefined;
  const tenantId = `${parts[1]}_${parts[2]}`;
  return (await getBCMPlans(tenantId)).find((p) => p.id === id);
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
  return rows.length ? rows : mock.bcmDependenciesForPlan(planId);
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
  return rows.length ? rows : mock.bcmTestsForPlan(planId);
}

// =====================================================================
// Workflows + Connectors + Audit Log
// =====================================================================

export async function getWorkflows(tenantId?: string): Promise<Workflow[]> {
  if (!isPgMode()) return mock.workflowsForTenant(tenantId ?? 't_maybank');
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<Workflow>(
    `SELECT id::text AS id, tenant_id AS "tenantId", name, description,
            steps, version, enabled
     FROM workflow.definitions ${where} ORDER BY name`,
    params
  );
  return rows.length ? rows : mock.workflowsForTenant(tenantId ?? 't_maybank');
}

export async function getWorkflow(id: string): Promise<Workflow | undefined> {
  if (isPgMode()) {
    const tid = await tenantOfRow('workflow.definitions', id);
    if (tid) return (await getWorkflows(tid)).find((w) => w.id === id);
  }
  const parts = id.split('_');
  if (parts.length < 3) return undefined;
  const tenantId = `${parts[1]}_${parts[2]}`;
  return (await getWorkflows(tenantId)).find((w) => w.id === id);
}

export async function getWorkflowExecutions(tenantId?: string, limit = 20): Promise<WorkflowExecution[]> {
  if (!isPgMode()) return mock.workflowExecutionsForTenant(tenantId ?? 't_maybank', limit);
  const clauses: string[] = [];
  const params: unknown[] = [limit];
  if (tenantId) { params.push(tenantId); clauses.push(`e.tenant_id = $${params.length}`); }
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
  return rows.length ? rows : mock.workflowExecutionsForTenant(tenantId ?? 't_maybank', limit);
}

export async function getConnectors(tenantId?: string): Promise<Connector[]> {
  if (!isPgMode()) return mock.connectorsForTenant(tenantId ?? 't_maybank');
  const where = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  const rows = await safeQuery<Connector>(
    `SELECT id::text AS id, tenant_id AS "tenantId", kind, name, status::text AS status,
            last_sync_at AS "lastSyncAt"
     FROM integration.connectors ${where}`, params
  );
  return rows.length ? rows : mock.connectorsForTenant(tenantId ?? 't_maybank');
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
            action, target, result, prev_hash AS "prevHash", row_hash AS "rowHash"
     FROM platform.audit_log ${where} ORDER BY ts DESC LIMIT $1`, params
  );
}

// =====================================================================
// Human Risk (KnowBe4)
// =====================================================================

export async function getHumanRiskSummary(tenantId?: string): Promise<HumanRiskSummary | null> {
  const tid = tenantId ?? 't_maybank';
  if (!isPgMode()) return mock.humanRiskSummary(tid);

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
      [tid]
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
      [tid]
    )
  ]);

  if (!orgRows.length) return mock.humanRiskSummary(tid);

  const org = orgRows[0];
  const q = quantRows[0];
  const fallbackQuant = mock.humanRiskSummary(tid)?.quant ?? {
    aro: 0, perIncidentMeanSgd: 0, perIncidentStdevSgd: 0,
    aleSgd: 0, aleSgd12mAgo: 0, aleReducedSgd: 0,
    riskId: `risk_${tid}_humanrisk`, scenarioId: `scn_${tid}_humanrisk`
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
    riskScoreHistory: Array.isArray(org.riskScoreHistory) ? org.riskScoreHistory : [],
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
  const tid = tenantId ?? 't_maybank';
  if (!isPgMode()) return mock.humanRiskUsers(tid);
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
       FROM human_risk.users WHERE tenant_id = $1 ORDER BY risk_score DESC`,
    [tid]
  );
  return rows.length ? rows : mock.humanRiskUsers(tid);
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
  return rows[0] ?? mock.humanRiskUser(id);
}

export async function getHumanRiskDepartments(tenantId?: string): Promise<HumanRiskDepartment[]> {
  const tid = tenantId ?? 't_maybank';
  if (!isPgMode()) return mock.humanRiskDepartments(tid);
  const rows = await safeQuery<HumanRiskDepartment>(
    `SELECT tenant_id AS "tenantId", department,
            headcount,
            avg_risk_score AS "avgRiskScore",
            risk_level AS "riskLevel",
            phish_prone_pct AS "phishPronePct",
            training_completion_pct AS "trainingCompletionPct",
            high_risk_users AS "highRiskUsers"
       FROM human_risk.departments WHERE tenant_id = $1 ORDER BY avg_risk_score DESC`,
    [tid]
  );
  return rows.length ? rows : mock.humanRiskDepartments(tid);
}

export async function getPhishingCampaigns(tenantId?: string): Promise<PhishingCampaign[]> {
  const tid = tenantId ?? 't_maybank';
  if (!isPgMode()) return mock.phishingCampaigns(tid);
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
      WHERE tenant_id = $1
      ORDER BY sent_at DESC`,
    [tid]
  );
  return rows.length ? rows : mock.phishingCampaigns(tid);
}

export async function getTrainingCampaigns(tenantId?: string): Promise<TrainingCampaign[]> {
  const tid = tenantId ?? 't_maybank';
  if (!isPgMode()) return mock.trainingCampaigns(tid);
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
      WHERE tenant_id = $1
      ORDER BY due_at ASC`,
    [tid]
  );
  return rows.length ? rows : mock.trainingCampaigns(tid);
}

// =====================================================================
// KPI snapshot + Board narrative
// =====================================================================

async function computeVendorRiskIndex(tenantId?: string): Promise<number> {
  if (!isPgMode()) return 62;
  try {
    const sql = tenantId
      ? `SELECT ROUND(100 - COALESCE(AVG(q.score), 50))::int AS idx
           FROM vendor.questionnaires q
          WHERE q.tenant_id = $1 AND q.status = 'completed' AND q.score IS NOT NULL`
      : `SELECT ROUND(100 - COALESCE(AVG(q.score), 50))::int AS idx
           FROM vendor.questionnaires q
          WHERE q.status = 'completed' AND q.score IS NOT NULL`;
    const rows = await safeQuery<{ idx: number }>(sql, tenantId ? [tenantId] : []);
    const idx = rows[0]?.idx;
    return typeof idx === 'number' && !isNaN(idx) ? Math.min(100, Math.max(0, idx)) : 50;
  } catch {
    return 50;
  }
}

export async function getKpiSnapshot(tenantId?: string): Promise<KpiSnapshot> {
  const tenants = tenantId ? [tenantId] : (HERO_TENANTS as readonly string[]);
  let openCriticalRisks = 0, openFindings = 0, evidenceItems30d = 0, agentFteSaved30d = 0;
  for (const tid of tenants) {
    const risks = await getRisks(tid);
    openCriticalRisks += risks.filter((r) => r.residualSeverity === 'critical' && r.status !== 'closed').length;
    const audits = await getAudits(tid);
    for (const a of audits) {
      const f = await getAuditFindings(a.id);
      openFindings += f.filter((x) => x.status === 'open').length;
    }
    evidenceItems30d += isPgMode() ? 0 : mock.evidenceCount24h(tid) * 30;
  }
  if (isPgMode()) {
    const rows = await safeQuery<{ cnt: number }>(
      tenantId
        ? `SELECT COUNT(*)::int AS cnt FROM evidence.items WHERE tenant_id = $1 AND collected_at >= now() - interval '30 days'`
        : `SELECT COUNT(*)::int AS cnt FROM evidence.items WHERE collected_at >= now() - interval '30 days'`,
      tenantId ? [tenantId] : []
    );
    evidenceItems30d = rows[0]?.cnt ?? 0;
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

export async function getBoardNarrative(tenantId?: string): Promise<string> {
  const tenant = tenantId ? await getCurrentTenant(tenantId) : undefined;
  const name = tenant?.name ?? 'Group';
  const kpi = await getKpiSnapshot(tenantId);
  const hr = mock.humanRiskSummary(tenantId ?? 't_maybank');
  const today = new Date().toLocaleDateString('en-SG', { month: 'long', year: 'numeric' });

  const apiKey = env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey });
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

      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: `You are a senior GRC analyst at NTT preparing a concise board risk pack narrative. Write 4–5 short paragraphs in a formal, data-driven tone suitable for a board risk committee. Use markdown bold for the title. Reference the exact metrics below. Focus on: (1) overall risk posture, (2) compliance, (3) third-party/vendor risk, (4) agentic AI operations ROI, and (5) human risk if data is provided. Do not invent numbers not listed below.\n\nMetrics:\n${metrics}`
        }]
      });
      const text = message.content[0].type === 'text' ? message.content[0].text : '';
      if (text.trim()) return text.trim();
    } catch (e) {
      console.warn('[board] LLM narrative failed, falling back to template:', (e as Error).message);
    }
  }

  // Template fallback when ANTHROPIC_API_KEY is not configured.
  const hr2 = hr ? `\n\nHuman risk — the people layer — is quantified via the KnowBe4 Virtual Risk Officer integration, scoring all ${hr.headcount.toLocaleString()} staff with an organisation Human Risk Score of ${hr.orgRiskScore}/100 (${hr.riskLevel}). The phish-prone percentage stands at ${hr.phishPronePct}% vs. an industry benchmark of ${hr.industryPhishPronePct}%, with ${hr.trainingCompletionPct}% training completion. Translated through FAIR, the annualised loss expectancy is S$${(hr.quant.aleSgd / 1e6).toFixed(2)}M.` : '';
  return [
    `**${name} — Risk Pack, ${today}**`,
    '',
    `Aggregate risk posture: ${kpi.openCriticalRisks} open critical risk(s), average compliance score ${kpi.avgComplianceScore}/100, ${kpi.openFindings} open audit finding(s).`,
    '',
    `Vendor risk index: ${kpi.vendorRiskIndex}/100. Agent operations recovered ${kpi.agentFteSaved30d} FTE hours over the past 30 days; ${kpi.evidenceItems30d} evidence items collected.` + hr2
  ].join('\n');
}
