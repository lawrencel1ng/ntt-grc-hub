// =====================================================================
//  /tenants-compare — MSSP tenant rollup. Fans out per-tenant KPIs +
//  vendor/audit counts for hero tenants in parallel, and surfaces a
//  lightweight summary for remaining tenants. In pg mode uses real
//  tenant IDs from the DB; in mock mode falls back to static IDs.
// =====================================================================

import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
  getTenantSummaries,
  getKpiSnapshot,
  getVendors,
  getAudits,
  getCostLedger30d,
  getFrameworkScores,
  getRisks
} from '$lib/server/data';
import { isPgMode } from '$lib/server/pg';
import { can } from '$lib/server/auth';
import { HERO_TENANT_IDS, SHALLOW_TENANT_IDS } from '$lib/data/tenants';

interface HeroSnapshot {
  tenantId: string;
  openCriticalRisks: number;
  avgComplianceScore: number;
  openFindings: number;
  vendorRiskIndex: number;
  agentFteSaved30d: number;
  totalRisks: number;
  totalVendors: number;
  criticalVendors: number;
  activeFrameworks: number;
  lastAuditAt?: string;
}

interface ShallowSnapshot {
  tenantId: string;
  openRisks: number;
  agentFteSaved30d: number;
  avgComplianceScore: number;
}

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw error(401, 'Not authenticated');
  if (!can(locals.user.role, 'admin-settings')) {
    throw error(403, 'Tenant Compare requires admin access');
  }

  const tenants = await getTenantSummaries();

  // In pg mode derive hero/shallow from the real tenant list.
  // Sort by MRR descending: top 3 are hero, the rest shallow.
  // In mock mode fall back to the static ID lists (which match mock tenantIds).
  let heroIds: string[];
  let shallowIds: string[];
  if (isPgMode() && tenants.length > 0) {
    const sorted = [...tenants].sort((a, b) => (b.mrrSgd ?? 0) - (a.mrrSgd ?? 0));
    heroIds = sorted.slice(0, Math.min(3, sorted.length)).map((t) => t.id);
    shallowIds = sorted.slice(3).map((t) => t.id);
  } else {
    heroIds = [...HERO_TENANT_IDS];
    shallowIds = [...SHALLOW_TENANT_IDS];
  }

  // ---------- Per-tenant snapshots ----------
  const heroes: HeroSnapshot[] = await Promise.all(
    heroIds.map(async (tid) => {
      const [kpi, vendors, audits, ledger, scores, risks] = await Promise.all([
        getKpiSnapshot(tid),
        getVendors(tid),
        getAudits(tid),
        getCostLedger30d(tid),
        getFrameworkScores(tid),
        getRisks(tid)
      ]);
      const fteHours = ledger.reduce((s, e) => s + e.fteSavedHours, 0);
      const fteSaved30d = +(fteHours / 160).toFixed(1);
      const criticalVendors = vendors.filter((v) => v.criticality === 'critical' || v.tier === '1').length;
      const lastAudit = audits
        .map((a) => a.openedAt)
        .sort()
        .pop();
      return {
        tenantId: tid,
        openCriticalRisks: kpi.openCriticalRisks,
        avgComplianceScore: kpi.avgComplianceScore,
        openFindings: kpi.openFindings,
        vendorRiskIndex: kpi.vendorRiskIndex,
        agentFteSaved30d: fteSaved30d,
        totalRisks: risks.length,
        totalVendors: vendors.length,
        criticalVendors,
        activeFrameworks: scores.length,
        lastAuditAt: lastAudit
      };
    })
  );

  // ---------- Shallow tenants (lightweight) ----------
  const shallow: ShallowSnapshot[] = await Promise.all(
    shallowIds.map(async (tid) => {
      const [risks, ledger, scores] = await Promise.all([
        getRisks(tid),
        getCostLedger30d(tid),
        getFrameworkScores(tid)
      ]);
      const fteHours = ledger.reduce((s, e) => s + e.fteSavedHours, 0);
      const avg = scores.length
        ? +(scores.reduce((s, x) => s + (x.score ?? 0), 0) / scores.length).toFixed(1)
        : 0;
      return {
        tenantId: tid,
        openRisks: risks.length,
        agentFteSaved30d: +(fteHours / 160).toFixed(1),
        avgComplianceScore: avg
      };
    })
  );

  // ---------- Aggregate KPIs across ALL tenants ----------
  const totalCritical = heroes.reduce((s, h) => s + h.openCriticalRisks, 0);
  const totalFindings = heroes.reduce((s, h) => s + h.openFindings, 0);
  const totalFte = +(heroes.reduce((s, h) => s + h.agentFteSaved30d, 0) +
                     shallow.reduce((s, h) => s + h.agentFteSaved30d, 0)).toFixed(1);
  const avgScore = +(
    (heroes.reduce((s, h) => s + h.avgComplianceScore, 0) +
     shallow.reduce((s, h) => s + h.avgComplianceScore, 0)) /
    Math.max(1, heroes.length + shallow.length)
  ).toFixed(1);

  const auditsByTenant = await Promise.all(heroIds.map((tid) => getAudits(tid)));
  const activeAudits = auditsByTenant.flat().filter((a) => !a.closedAt).length;

  return {
    tenants,
    heroes,
    shallow,
    aggregate: {
      totalTenants: tenants.length,
      avgComplianceScore: avgScore,
      totalOpenCritical: totalCritical,
      totalActiveAudits: activeAudits,
      totalFte30d: totalFte,
      totalOpenFindings: totalFindings
    }
  };
};
