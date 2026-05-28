import type { RegChange, RegSource, ImpactAssessment, RiskSeverity, RegImpact } from './types';
import { hashStringToInt, mulberry32 } from './rng';

export const REG_SOURCES: RegSource[] = [
  { id: 'src_mas',    regulatorCode: 'MAS',   name: 'Monetary Authority of Singapore', sourceUrl: 'https://www.mas.gov.sg/news', jurisdiction: 'SG', enabled: true, lastScannedAt: new Date(Date.now() - 4 * 60 * 1000).toISOString() },
  { id: 'src_apra',   regulatorCode: 'APRA',  name: 'Australian Prudential Regulation Authority', sourceUrl: 'https://www.apra.gov.au/news-and-publications', jurisdiction: 'AU', enabled: true, lastScannedAt: new Date(Date.now() - 38 * 60 * 1000).toISOString() },
  { id: 'src_eu',     regulatorCode: 'EU',    name: 'European Commission (DORA/NIS2/AI Act)', sourceUrl: 'https://eur-lex.europa.eu', jurisdiction: 'EU', enabled: true, lastScannedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString() },
  { id: 'src_ojk',    regulatorCode: 'OJK',   name: 'Otoritas Jasa Keuangan', sourceUrl: 'https://www.ojk.go.id', jurisdiction: 'ID', enabled: true, lastScannedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString() },
  { id: 'src_rbi',    regulatorCode: 'RBI',   name: 'Reserve Bank of India', sourceUrl: 'https://www.rbi.org.in', jurisdiction: 'IN', enabled: true, lastScannedAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString() },
  { id: 'src_hkma',   regulatorCode: 'HKMA',  name: 'Hong Kong Monetary Authority', sourceUrl: 'https://www.hkma.gov.hk', jurisdiction: 'HK', enabled: true, lastScannedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString() },
  { id: 'src_bnm',    regulatorCode: 'BNM',   name: 'Bank Negara Malaysia', sourceUrl: 'https://www.bnm.gov.my', jurisdiction: 'MY', enabled: true, lastScannedAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString() },
  { id: 'src_bot',    regulatorCode: 'BOT',   name: 'Bank of Thailand', sourceUrl: 'https://www.bot.or.th', jurisdiction: 'TH', enabled: true, lastScannedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString() },
  { id: 'src_bsp',    regulatorCode: 'BSP',   name: 'Bangko Sentral ng Pilipinas', sourceUrl: 'https://www.bsp.gov.ph', jurisdiction: 'PH', enabled: true, lastScannedAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString() },
  { id: 'src_pdpc',   regulatorCode: 'PDPC',  name: 'Personal Data Protection Commission SG', sourceUrl: 'https://www.pdpc.gov.sg', jurisdiction: 'SG', enabled: true, lastScannedAt: new Date(Date.now() - 7 * 3600 * 1000).toISOString() },
  { id: 'src_govtech',regulatorCode: 'IM8',   name: 'GovTech Singapore IM8', sourceUrl: 'https://www.tech.gov.sg/im8', jurisdiction: 'SG', enabled: true, lastScannedAt: new Date(Date.now() - 9 * 3600 * 1000).toISOString() },
  { id: 'src_pipc',   regulatorCode: 'PIPC',  name: 'Personal Information Protection Commission KR', sourceUrl: 'https://www.pipc.go.kr', jurisdiction: 'KR', enabled: true, lastScannedAt: new Date(Date.now() - 11 * 3600 * 1000).toISOString() }
];

const CHANGE_SPECS = [
  { sourceId: 'src_mas',    title: 'MAS update' },
  { sourceId: 'src_apra',   title: 'APRA prudential update' },
  { sourceId: 'src_eu',     title: 'EU technical standard' },
  { sourceId: 'src_ojk',    title: 'OJK regulation revision' },
  { sourceId: 'src_rbi',    title: 'RBI cyber directive' },
  { sourceId: 'src_hkma',   title: 'HKMA circular' },
  { sourceId: 'src_bnm',    title: 'BNM policy update' },
  { sourceId: 'src_pdpc',   title: 'PDPC clarification' }
];

const CHANGE_SEVS: RiskSeverity[] = ['high','medium','medium','low','critical'];

export function regChanges(limit: number): RegChange[] {
  const out: RegChange[] = [];
  // Hero entry first — MAS Notice 655 update detected 11 min ago.
  out.push({
    id: 'reg_hero_mas655',
    sourceId: 'src_mas',
    sourceName: 'MAS',
    regulatorCode: 'MAS',
    title: 'MAS Notice 655 update — Outsourcing (HERO)',
    summary: 'MAS has issued an update to Notice 655 introducing stricter requirements on cross-border outsourcing, exit plans, and concentration risk reporting. Effective 90 days from publication.',
    publishedAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
    effectiveAt: new Date(Date.now() + 90 * 86_400_000).toISOString(),
    severity: 'high',
    detectedByAgentId: 'ag_regwatch'
  });
  let id = 1000;
  for (let g = 1; g <= 60 && out.length < limit; g++) {
    const spec = CHANGE_SPECS[g % CHANGE_SPECS.length];
    const src = REG_SOURCES.find((s) => s.id === spec.sourceId);
    out.push({
      id: `reg_${id++}`,
      sourceId: spec.sourceId,
      sourceName: src?.name,
      regulatorCode: src?.regulatorCode,
      title: `${spec.title} #${g}`,
      summary: 'Auto-seeded summary of the regulatory change. Severity tagged by Regulatory Horizon agent.',
      publishedAt: new Date(Date.now() - g * 3 * 86_400_000).toISOString(),
      effectiveAt: new Date(Date.now() + (90 - g * 2) * 86_400_000).toISOString(),
      severity: CHANGE_SEVS[g % CHANGE_SEVS.length],
      detectedByAgentId: 'ag_regwatch'
    });
  }
  return out.slice(0, limit);
}

const IMPACT_VALUES: RegImpact[] = ['high','medium','medium','low','none'];
const IMPACT_FRAMEWORKS = ['mas-trm','iso-27001','dora','gdpr','pci-dss-4'];

export function impactAssessmentsForChange(changeId: string, tenantId?: string): ImpactAssessment[] {
  const rng = mulberry32(hashStringToInt(`impact:${changeId}`));
  // Hero: 7 gaps opened against MAS Notice 655 for Maybank.
  if (changeId === 'reg_hero_mas655') {
    return [{
      id: 'ia_hero',
      tenantId: 't_maybank',
      changeId,
      frameworkId: 'mas-notice-655',
      impact: 'high',
      gapsOpened: 7,
      assessedByAgentId: 'ag_regwatch',
      assessedAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
      notes: 'HERO: 7 new control gaps opened. Control Mapper to assign owners. Policy Drafter to draft Outsourcing Policy amendment.'
    }];
  }
  const tenants = tenantId ? [tenantId] : ['t_maybank','t_grab','t_mindef'];
  return tenants.map((tid, i) => ({
    id: `ia_${changeId}_${tid}`,
    tenantId: tid,
    changeId,
    frameworkId: IMPACT_FRAMEWORKS[i % IMPACT_FRAMEWORKS.length],
    impact: IMPACT_VALUES[i % IMPACT_VALUES.length],
    gapsOpened: Math.floor(rng() * 7),
    assessedByAgentId: 'ag_regwatch',
    assessedAt: new Date(Date.now() - i * 3600 * 1000).toISOString(),
    notes: 'Auto-seeded impact assessment.'
  }));
}
