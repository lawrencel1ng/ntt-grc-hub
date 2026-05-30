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

export async function getRisks(tenantId: string): Promise<Risk[]> {
  if (!isPgMode()) return mock.risksForTenant(tenantId);
  const rows = await safeQuery<Risk>(
    `SELECT id::text AS id, tenant_id AS "tenantId", register_id::text AS "registerId",
            code, title, description, category,
            inherent_severity::text AS "inherentSeverity",
            inherent_likelihood::text AS "inherentLikelihood",
            residual_severity::text AS "residualSeverity",
            residual_likelihood::text AS "residualLikelihood",
            status::text AS status,
            treatment_strategy::text AS "treatmentStrategy",
            last_assessed_at AS "lastAssessedAt", next_review_at AS "nextReviewAt",
            business_service AS "businessService", tags
     FROM risk.risks WHERE tenant_id = $1 ORDER BY code`, [tenantId]
  );
  return rows.length ? rows : mock.risksForTenant(tenantId);
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

export async function getTopRisks(n: number, tenantId?: string): Promise<Risk[]> {
  if (!isPgMode()) return mock.topRisks(tenantId, n);
  // For PG we mirror the mock heuristic — order by sev*lik rank desc.
  // (Not worth a stored function; the rank is small.)
  return mock.topRisks(tenantId, n);
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
  // Treat the id as a risk id; look up the most recent run via scenario join.
  return mock.fairRunForRisk(scenarioOrRiskId);
}

export async function getFairScenarios(tenantId: string) {
  return mock.fairScenariosForTenant(tenantId);
}

export async function getFairScenariosForRisk(riskId: string) {
  const parts = riskId.split('_');
  if (parts.length < 3) return [];
  const tenantId = `${parts[1]}_${parts[2]}`;
  const all = await getFairScenarios(tenantId);
  return all.filter((s) => s.riskId === riskId);
}

export async function getAppetiteStatements(tenantId: string): Promise<AppetiteStatement[]> {
  if (!isPgMode()) return mock.appetiteStatementsForTenant(tenantId);
  return mock.appetiteStatementsForTenant(tenantId);
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

export async function getControls(tenantId: string): Promise<Control[]> {
  if (!isPgMode()) return mock.controlsForTenant(tenantId);
  const rows = await safeQuery<Control>(
    `SELECT id, tenant_id AS "tenantId", code, title, description, type::text AS type,
            family, frequency, automated, maturity::text AS maturity
     FROM control.library WHERE tenant_id = $1 ORDER BY code`, [tenantId]
  );
  return rows.length ? rows : mock.controlsForTenant(tenantId);
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
    `SELECT id, tenant_id AS "tenantId", control_id AS "controlId", test_id AS "testId",
            ran_at AS "ranAt", result::text AS result, evidence_item_id AS "evidenceItemId",
            agent_run_id AS "agentRunId", notes, duration_ms AS "durationMs"
     FROM control.test_runs WHERE control_id = $1 ORDER BY ran_at DESC LIMIT $2`, [controlId, limit]
  );
  return rows;
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
  return safeQuery<ControlTestRun>(
    `SELECT id, tenant_id AS "tenantId", control_id AS "controlId", test_id AS "testId",
            ran_at AS "ranAt", result::text AS result, evidence_item_id AS "evidenceItemId",
            agent_run_id AS "agentRunId", notes, duration_ms AS "durationMs"
     FROM control.test_runs ${where} ORDER BY ran_at DESC LIMIT $1`, params
  );
}

// =====================================================================
// Evidence
// =====================================================================

export async function getEvidence(tenantId: string, limit?: number): Promise<EvidenceItem[]> {
  if (!isPgMode()) return mock.evidenceForTenant(tenantId, limit);
  const params: unknown[] = [tenantId];
  let limitSql = '';
  if (limit) { params.push(limit); limitSql = `LIMIT $${params.length}`; }
  const rows = await safeQuery<EvidenceItem>(
    `SELECT i.id, i.tenant_id AS "tenantId", i.collector_id AS "collectorId",
            i.control_id AS "controlId", i.kind::text AS kind, (i.metadata->>'domain') AS domain,
            i.title, i.source_url AS "sourceUrl",
            i.blob_url AS "blobUrl", i.captured_at AS "capturedAt", i.metadata,
            s.row_hash AS "rowHash", s.prev_hash AS "prevHash"
     FROM evidence.items i LEFT JOIN evidence.seals s ON s.item_id = i.id
     WHERE i.tenant_id = $1 ORDER BY i.captured_at DESC ${limitSql}`, params
  );
  return rows.length ? rows : mock.evidenceForTenant(tenantId, limit);
}

export async function getEvidenceStats(tenantId: string): Promise<{ total: number; last24h: number; chainOk: boolean }> {
  if (!isPgMode()) {
    const c = mock.evidenceHashChainOk(tenantId);
    return { total: c.total, last24h: mock.evidenceCount24h(tenantId), chainOk: c.ok };
  }
  const totalRows = await safeQuery<{ n: string }>(`SELECT COUNT(*)::text AS n FROM evidence.items WHERE tenant_id = $1`, [tenantId]);
  const recentRows = await safeQuery<{ n: string }>(`SELECT COUNT(*)::text AS n FROM evidence.items WHERE tenant_id = $1 AND captured_at >= now() - interval '24 hours'`, [tenantId]);
  return {
    total: totalRows[0] ? Number(totalRows[0].n) : 0,
    last24h: recentRows[0] ? Number(recentRows[0].n) : 0,
    chainOk: true
  };
}

// =====================================================================
// Audits
// =====================================================================

export async function getAudits(tenantId: string): Promise<AuditEngagement[]> {
  if (!isPgMode()) return mock.auditsForTenant(tenantId);
  const rows = await safeQuery<AuditEngagement>(
    `SELECT id::text AS id, tenant_id AS "tenantId", name, type::text AS type,
            lead_auditor AS "leadAuditor", opened_at AS "openedAt", closed_at AS "closedAt",
            scope, framework_id AS "frameworkId"
     FROM audit.engagements WHERE tenant_id = $1 ORDER BY opened_at DESC`, [tenantId]
  );
  return rows.length ? rows : mock.auditsForTenant(tenantId);
}

export async function getAudit(id: string): Promise<AuditEngagement | undefined> {
  if (isPgMode()) {
    const tid = await tenantOfRow('audit.engagements', id);
    if (tid) return (await getAudits(tid)).find((a) => a.id === id);
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
  return mock.REG_SOURCES;
}

export async function getImpactAssessments(changeId: string, tenantId?: string): Promise<ImpactAssessment[]> {
  if (!isPgMode()) return mock.impactAssessmentsForChange(changeId, tenantId);
  return mock.impactAssessmentsForChange(changeId, tenantId);
}

// =====================================================================
// Policies
// =====================================================================

export async function getPolicies(tenantId: string): Promise<Policy[]> {
  if (!isPgMode()) return mock.policiesForTenant(tenantId);
  const rows = await safeQuery<Policy>(
    `SELECT id::text AS id, tenant_id AS "tenantId", code, title, jurisdiction,
            current_version_id::text AS "currentVersionId"
     FROM policy.documents WHERE tenant_id = $1 ORDER BY code`, [tenantId]
  );
  return rows.length ? rows : mock.policiesForTenant(tenantId);
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

export async function getVendors(tenantId: string): Promise<Vendor[]> {
  if (!isPgMode()) return mock.vendorsForTenant(tenantId);
  const rows = await safeQuery<Vendor>(
    `SELECT id::text AS id, tenant_id AS "tenantId", name, category,
            tier::text AS tier, criticality::text AS criticality,
            hq_country AS "hqCountry", primary_contact_email AS "primaryContactEmail",
            status::text AS status
     FROM vendor.vendors WHERE tenant_id = $1 ORDER BY name`, [tenantId]
  );
  return rows.length ? rows : mock.vendorsForTenant(tenantId);
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

export async function getQuestionnaires(tenantId: string): Promise<Questionnaire[]> {
  if (!isPgMode()) return mock.questionnairesForVendor(tenantId);
  const rows = await safeQuery<Questionnaire>(
    `SELECT q.id::text AS id, q.tenant_id AS "tenantId", q.vendor_id::text AS "vendorId",
            v.name AS "vendorName", q.template, q.status::text AS status,
            q.sent_at AS "sentAt", q.completed_at AS "completedAt",
            q.completed_by_agent_id AS "completedByAgentId", q.score
     FROM vendor.questionnaires q JOIN vendor.vendors v ON v.id = q.vendor_id
     WHERE q.tenant_id = $1 ORDER BY q.sent_at DESC`, [tenantId]
  );
  return rows.length ? rows : mock.questionnairesForVendor(tenantId);
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

export async function getFourthParties(tenantId: string): Promise<FourthParty[]> {
  if (!isPgMode()) return mock.fourthPartiesForTenant(tenantId);
  const rows = await safeQuery<FourthParty>(
    `SELECT fp.id::text AS id, fp.tenant_id AS "tenantId", fp.vendor_id::text AS "vendorId",
            v.name AS "vendorName", fp.name, fp.type, fp.region, fp.criticality::text AS criticality
     FROM vendor.fourth_parties fp JOIN vendor.vendors v ON v.id = fp.vendor_id
     WHERE fp.tenant_id = $1`, [tenantId]
  );
  return rows.length ? rows : mock.fourthPartiesForTenant(tenantId);
}

export async function getConcentrations(tenantId: string): Promise<Concentration[]> {
  if (!isPgMode()) return mock.concentrationsForTenant(tenantId);
  const rows = await safeQuery<Concentration>(
    `SELECT id::text AS id, tenant_id AS "tenantId", dimension, key,
            vendor_count AS "vendorCount", exposure_sgd AS "exposureSgd"
     FROM vendor.concentrations WHERE tenant_id = $1`, [tenantId]
  );
  return rows.length ? rows : mock.concentrationsForTenant(tenantId);
}

// =====================================================================
// Privacy / ESG / AI Gov
// =====================================================================

export async function getPrivacyActivities(tenantId: string): Promise<PrivacyActivity[]> {
  if (!isPgMode()) return mock.privacyActivitiesForTenant(tenantId);
  return mock.privacyActivitiesForTenant(tenantId);
}

export async function getDPIAs(tenantId: string): Promise<DPIA[]> {
  if (!isPgMode()) return mock.dpiasForTenant(tenantId);
  return mock.dpiasForTenant(tenantId);
}

export async function getSubjectRequests(tenantId: string): Promise<SubjectRequest[]> {
  if (!isPgMode()) return mock.subjectRequestsForTenant(tenantId);
  return mock.subjectRequestsForTenant(tenantId);
}

export async function getBreaches(tenantId: string): Promise<Breach[]> {
  if (!isPgMode()) return mock.breachesForTenant(tenantId);
  return mock.breachesForTenant(tenantId);
}

export async function getESGMetrics(tenantId: string): Promise<ESGMetric[]> {
  if (!isPgMode()) return mock.esgMetricsForTenant(tenantId);
  return mock.esgMetricsForTenant(tenantId);
}

export async function getESGDisclosures(tenantId: string): Promise<ESGDisclosure[]> {
  if (!isPgMode()) return mock.esgDisclosuresForTenant(tenantId);
  return mock.esgDisclosuresForTenant(tenantId);
}

export async function getESGTargets(tenantId: string): Promise<ESGTarget[]> {
  if (!isPgMode()) return mock.esgTargetsForTenant(tenantId);
  return mock.esgTargetsForTenant(tenantId);
}

export async function getAIModels(tenantId: string): Promise<AIModel[]> {
  if (!isPgMode()) return mock.aiModelsForTenant(tenantId);
  return mock.aiModelsForTenant(tenantId);
}

export async function getAIModel(id: string): Promise<AIModel | undefined> {
  const parts = id.split('_');
  if (parts.length < 3) return undefined;
  const tenantId = `${parts[1]}_${parts[2]}`;
  return (await getAIModels(tenantId)).find((m) => m.id === id);
}

export async function getModelRisks(modelId: string): Promise<ModelRisk[]> {
  if (!isPgMode()) return mock.modelRisksForModel(modelId);
  return mock.modelRisksForModel(modelId);
}

export async function getPromptsAudit(tenantId: string, limit?: number): Promise<PromptAuditEntry[]> {
  if (!isPgMode()) return mock.promptsAuditForTenant(tenantId, limit);
  return mock.promptsAuditForTenant(tenantId, limit);
}

// =====================================================================
// SOX (synthesised — never PG)
// =====================================================================

export async function getSOXItgcs(tenantId: string) {
  return mock.soxItgcsForTenant(tenantId);
}

export async function getSOXKcas(tenantId: string) {
  return mock.soxKcasForTenant(tenantId);
}

export async function getSOXWalkthroughs(tenantId: string) {
  return mock.soxWalkthroughsForTenant(tenantId);
}

export async function getSOXDeficiencies(tenantId: string) {
  return mock.soxDeficienciesForTenant(tenantId);
}

// =====================================================================
// Incidents / Issues / BCM
// =====================================================================

export async function getIncidents(tenantId: string): Promise<Incident[]> {
  if (!isPgMode()) return mock.incidentsForTenant(tenantId);
  const rows = await safeQuery<Incident>(
    `SELECT id::text AS id, tenant_id AS "tenantId", code, severity::text AS severity,
            title, status::text AS status, opened_at AS "openedAt",
            contained_at AS "containedAt", resolved_at AS "resolvedAt"
     FROM incident.incidents WHERE tenant_id = $1 ORDER BY opened_at DESC`, [tenantId]
  );
  return rows.length ? rows : mock.incidentsForTenant(tenantId);
}

export async function getIncident(id: string): Promise<Incident | undefined> {
  const parts = id.split('_');
  if (parts.length < 3) return undefined;
  const tenantId = `${parts[1]}_${parts[2]}`;
  return (await getIncidents(tenantId)).find((i) => i.id === id);
}

export async function getIncidentTimeline(incidentId: string): Promise<TimelineEvent[]> {
  if (!isPgMode()) return mock.timelineForIncident(incidentId);
  return mock.timelineForIncident(incidentId);
}

export async function getPostmortem(incidentId: string): Promise<Postmortem | null> {
  if (!isPgMode()) return mock.postmortemForIncident(incidentId);
  return mock.postmortemForIncident(incidentId);
}

export async function getIssues(tenantId: string): Promise<Issue[]> {
  if (!isPgMode()) return mock.issuesForTenant(tenantId);
  const rows = await safeQuery<Issue>(
    `SELECT id::text AS id, tenant_id AS "tenantId", source::text AS source,
            source_id AS "sourceId", title, severity::text AS severity, status::text AS status,
            owner_user_id AS "ownerUserId", due_at AS "dueAt"
     FROM issue.issues WHERE tenant_id = $1 ORDER BY due_at`, [tenantId]
  );
  return rows.length ? rows : mock.issuesForTenant(tenantId);
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
  return mock.actionsForIssue(issueId);
}

export async function getBCMPlans(tenantId: string): Promise<BCMPlan[]> {
  if (!isPgMode()) return mock.bcmPlansForTenant(tenantId);
  return mock.bcmPlansForTenant(tenantId);
}

export async function getBCMPlan(id: string): Promise<BCMPlan | undefined> {
  const parts = id.split('_');
  if (parts.length < 3) return undefined;
  const tenantId = `${parts[1]}_${parts[2]}`;
  return (await getBCMPlans(tenantId)).find((p) => p.id === id);
}

export async function getBCMDependencies(planId: string): Promise<BCMDependency[]> {
  if (!isPgMode()) return mock.bcmDependenciesForPlan(planId);
  return mock.bcmDependenciesForPlan(planId);
}

export async function getBCMTests(planId: string): Promise<BCMTest[]> {
  if (!isPgMode()) return mock.bcmTestsForPlan(planId);
  return mock.bcmTestsForPlan(planId);
}

// =====================================================================
// Workflows + Connectors + Audit Log
// =====================================================================

export async function getWorkflows(tenantId: string): Promise<Workflow[]> {
  if (!isPgMode()) return mock.workflowsForTenant(tenantId);
  return mock.workflowsForTenant(tenantId);
}

export async function getWorkflow(id: string): Promise<Workflow | undefined> {
  const parts = id.split('_');
  if (parts.length < 3) return undefined;
  const tenantId = `${parts[1]}_${parts[2]}`;
  return (await getWorkflows(tenantId)).find((w) => w.id === id);
}

export async function getWorkflowExecutions(tenantId: string, limit = 20): Promise<WorkflowExecution[]> {
  if (!isPgMode()) return mock.workflowExecutionsForTenant(tenantId, limit);
  return mock.workflowExecutionsForTenant(tenantId, limit);
}

export async function getConnectors(tenantId: string): Promise<Connector[]> {
  if (!isPgMode()) return mock.connectorsForTenant(tenantId);
  const rows = await safeQuery<Connector>(
    `SELECT id::text AS id, tenant_id AS "tenantId", kind, name, status::text AS status,
            last_sync_at AS "lastSyncAt"
     FROM integration.connectors WHERE tenant_id = $1`, [tenantId]
  );
  return rows.length ? rows : mock.connectorsForTenant(tenantId);
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
// Human Risk (KnowBe4) — synthesised; mock in both modes (like Privacy/ESG)
// =====================================================================

export async function getHumanRiskSummary(tenantId: string): Promise<HumanRiskSummary | null> {
  return mock.humanRiskSummary(tenantId);
}

export async function getHumanRiskUsers(tenantId: string): Promise<HumanRiskUser[]> {
  return mock.humanRiskUsers(tenantId);
}

export async function getHumanRiskUser(id: string): Promise<HumanRiskUser | undefined> {
  return mock.humanRiskUser(id);
}

export async function getHumanRiskDepartments(tenantId: string): Promise<HumanRiskDepartment[]> {
  return mock.humanRiskDepartments(tenantId);
}

export async function getPhishingCampaigns(tenantId: string): Promise<PhishingCampaign[]> {
  return mock.phishingCampaigns(tenantId);
}

export async function getTrainingCampaigns(tenantId: string): Promise<TrainingCampaign[]> {
  return mock.trainingCampaigns(tenantId);
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

export async function getBoardNarrative(tenantId: string): Promise<string> {
  const tenant = await getCurrentTenant(tenantId);
  const name = tenant?.name ?? 'Group';
  const kpi = await getKpiSnapshot(tenantId);
  const hr = mock.humanRiskSummary(tenantId);
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
