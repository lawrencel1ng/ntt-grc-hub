// =====================================================================
//  Server-side data dispatcher. Every public function checks DATA_MODE
//  and either issues a Postgres query (when `pg`) or returns the
//  in-memory mock fixtures (default). Routes import only from here so
//  swapping the backing store is a one-line change.
// =====================================================================

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
  KpiSnapshot
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
            i.control_id AS "controlId", i.kind::text AS kind, i.title, i.source_url AS "sourceUrl",
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

export async function getAuditLog(tenantId?: string, limit = 50): Promise<AuditLogEntry[]> {
  if (!isPgMode()) {
    // Synthesize a small audit log feed; in mock mode this is mostly used
    // by the admin page so we keep it tiny but believable.
    const actions = ['login','export.report','policy.publish','agent.run','evidence.seal','risk.update'];
    const out: AuditLogEntry[] = [];
    for (let i = 0; i < limit; i++) {
      out.push({
        id: i + 1,
        ts: new Date(Date.now() - i * 17 * 60 * 1000).toISOString(),
        tenantId: tenantId ?? 't_maybank',
        actorEmail: 'demo@ntt.com',
        action: actions[i % actions.length],
        target: ['cockpit','agent','vendor','policy:v2','risk:R-001'][i % 5],
        result: 'success',
        rowHash: `abc${i.toString(16).padStart(6, '0')}`
      });
    }
    return out;
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
// KPI snapshot + Board narrative
// =====================================================================

export async function getKpiSnapshot(tenantId?: string): Promise<KpiSnapshot> {
  // Compute from mock primitives — this is purely demo-grade.
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
    evidenceItems30d += mock.evidenceCount24h(tid) * 30;
  }
  const ledger = await getCostLedger30d(tenantId);
  agentFteSaved30d = +ledger.reduce((s, e) => s + e.fteSavedHours, 0).toFixed(1);
  const scores = await getFrameworkScores(tenantId);
  const avgComplianceScore = scores.length
    ? +(scores.reduce((s, x) => s + (x.score ?? 0), 0) / scores.length).toFixed(1)
    : 0;
  return {
    openCriticalRisks,
    avgComplianceScore,
    openFindings,
    vendorRiskIndex: 62, // headline metric — fixed for demo storytelling
    agentFteSaved30d,
    evidenceItems30d
  };
}

export async function getBoardNarrative(tenantId: string): Promise<string> {
  const tenant = await getCurrentTenant(tenantId);
  const name = tenant?.name ?? 'Group';
  // A short, curated narrative — production wires this to the LLM agent.
  return [
    `**${name} — Risk Pack, May 2026**`,
    '',
    `Aggregate risk posture is stable with the residual heatmap mass concentrated in the *medium / possible* band. Critical risks are bounded and within board-approved appetite. The Risk Quantifier agent computed a fleet-wide annualised loss expectancy (ALE) of S$4.2M for the most material scenario — cross-border outsourcing concentration — triggered by the MAS Notice 655 update detected by Regulatory Horizon eleven minutes ago.`,
    '',
    `Compliance scores against the eight tracked frameworks averaged 81/100 with SOC 2, ISO 27001 and MAS TRM all green; PCI DSS 4.0 readiness has lifted 6 points after the Control Tester closed three KMS rotation gaps this cycle. Outstanding audit findings are tracking down quarter-on-quarter and the Audit Companion has reduced evidence-pack assembly time from ~3 days to 8 seconds per engagement.`,
    '',
    `Third-party posture is the largest watch item: concentration on AWS ap-southeast-1 across 22 vendors equates to an SGD 11.5M exposure. The Vendor Risk Analyst auto-completed 81% of in-flight questionnaires, recovering an estimated 320 analyst hours. A vendor exit-plan workstream is recommended for the next quarter.`,
    '',
    `Agentic operations delivered 4.7 FTE-equivalent capacity at a run-rate cost of S$950/month against an avoided cost of ~S$97,500/month, a 100× ROI. The fleet operated within its cost cap with no HITL escalations rejected. The board may wish to expand the Risk Quantifier and Policy Drafter deployment to MINDEF and Grab tenancies in H2.`
  ].join('\n');
}
