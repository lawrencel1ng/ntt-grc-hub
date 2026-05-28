import type { Framework, Requirement } from './types';

// Mirrors db/seed.sql section 3 (compliance.frameworks). 35+ rows.
export const FRAMEWORKS: Framework[] = [
  // -------- Global --------
  { id: 'soc2',           name: 'SOC 2',                       version: '2017 TSC',     regulator: 'AICPA',     region: 'Global',    jurisdiction: 'US',   totalRequirements: 80,  tags: ['audit','security'] },
  { id: 'iso-27001',      name: 'ISO/IEC 27001',               version: '2022',         regulator: 'ISO',       region: 'Global',    jurisdiction: 'INTL', totalRequirements: 93,  tags: ['security','isms'] },
  { id: 'iso-27017',      name: 'ISO/IEC 27017',               version: '2015',         regulator: 'ISO',       region: 'Global',    jurisdiction: 'INTL', totalRequirements: 37,  tags: ['cloud','security'] },
  { id: 'iso-27018',      name: 'ISO/IEC 27018',               version: '2019',         regulator: 'ISO',       region: 'Global',    jurisdiction: 'INTL', totalRequirements: 25,  tags: ['privacy','cloud'] },
  { id: 'iso-27701',      name: 'ISO/IEC 27701',               version: '2019',         regulator: 'ISO',       region: 'Global',    jurisdiction: 'INTL', totalRequirements: 49,  tags: ['privacy'] },
  { id: 'iso-22301',      name: 'ISO 22301',                   version: '2019',         regulator: 'ISO',       region: 'Global',    jurisdiction: 'INTL', totalRequirements: 62,  tags: ['bcm'] },
  { id: 'iso-42001',      name: 'ISO/IEC 42001',               version: '2023',         regulator: 'ISO',       region: 'Global',    jurisdiction: 'INTL', totalRequirements: 38,  tags: ['ai-governance'] },
  { id: 'nist-csf',       name: 'NIST CSF 2.0',                version: '2.0',          regulator: 'NIST',      region: 'Global',    jurisdiction: 'US',   totalRequirements: 106, tags: ['security'] },
  { id: 'nist-80053',     name: 'NIST SP 800-53',              version: 'Rev 5',        regulator: 'NIST',      region: 'Global',    jurisdiction: 'US',   totalRequirements: 421, tags: ['security','federal'] },
  { id: 'nist-airmf',     name: 'NIST AI RMF',                 version: '1.0',          regulator: 'NIST',      region: 'Global',    jurisdiction: 'US',   totalRequirements: 72,  tags: ['ai-governance'] },
  { id: 'pci-dss-4',      name: 'PCI DSS',                     version: '4.0',          regulator: 'PCI SSC',   region: 'Global',    jurisdiction: 'INTL', totalRequirements: 281, tags: ['payments'] },
  // -------- EU --------
  { id: 'gdpr',           name: 'GDPR',                        version: '2016/679',     regulator: 'EDPB',      region: 'EU',        jurisdiction: 'EU',   totalRequirements: 99,  tags: ['privacy'] },
  { id: 'dora',           name: 'DORA',                        version: '2022/2554',    regulator: 'EBA',       region: 'EU',        jurisdiction: 'EU',   totalRequirements: 112, tags: ['operational-resilience','financial'] },
  { id: 'nis2',           name: 'NIS2',                        version: '2022/2555',    regulator: 'ENISA',     region: 'EU',        jurisdiction: 'EU',   totalRequirements: 86,  tags: ['security','critical-infra'] },
  { id: 'eu-ai-act',      name: 'EU AI Act',                   version: '2024/1689',    regulator: 'EC',        region: 'EU',        jurisdiction: 'EU',   totalRequirements: 113, tags: ['ai-governance'] },
  { id: 'csrd',           name: 'CSRD',                        version: '2022/2464',    regulator: 'EC',        region: 'EU',        jurisdiction: 'EU',   totalRequirements: 82,  tags: ['esg','sustainability'] },
  // -------- Americas --------
  { id: 'hipaa',          name: 'HIPAA Security Rule',         version: '2013',         regulator: 'HHS',       region: 'Americas',  jurisdiction: 'US',   totalRequirements: 54,  tags: ['healthcare','privacy'] },
  { id: 'ccpa',           name: 'CCPA / CPRA',                 version: '2023',         regulator: 'CPPA',      region: 'Americas',  jurisdiction: 'US',   totalRequirements: 46,  tags: ['privacy'] },
  { id: 'sox',            name: 'SOX',                         version: '2002',         regulator: 'SEC',       region: 'Americas',  jurisdiction: 'US',   totalRequirements: 44,  tags: ['financial','audit'] },
  { id: 'fedramp-mod',    name: 'FedRAMP Moderate',            version: 'Rev 5',        regulator: 'FedRAMP',   region: 'Americas',  jurisdiction: 'US',   totalRequirements: 325, tags: ['security','federal','cloud'] },
  { id: 'fedramp-high',   name: 'FedRAMP High',                version: 'Rev 5',        regulator: 'FedRAMP',   region: 'Americas',  jurisdiction: 'US',   totalRequirements: 421, tags: ['security','federal','cloud'] },
  // -------- Singapore --------
  { id: 'mas-trm',        name: 'MAS TRM Guidelines',          version: '2021',         regulator: 'MAS',       region: 'Singapore', jurisdiction: 'SG',   totalRequirements: 188, tags: ['financial','security'] },
  { id: 'mas-notice-655', name: 'MAS Notice 655',              version: '2024 update',  regulator: 'MAS',       region: 'Singapore', jurisdiction: 'SG',   totalRequirements: 38,  tags: ['financial','outsourcing'] },
  { id: 'mas-notice-644', name: 'MAS Notice 644',              version: '2022',         regulator: 'MAS',       region: 'Singapore', jurisdiction: 'SG',   totalRequirements: 22,  tags: ['financial','incident-reporting'] },
  { id: 'im8',            name: 'IM8 (GovTech)',               version: 'v9.0',         regulator: 'GovTech',   region: 'Singapore', jurisdiction: 'SG',   totalRequirements: 142, tags: ['sovereign','public-sector'] },
  { id: 'pdpa-sg',        name: 'PDPA Singapore',              version: '2020',         regulator: 'PDPC',      region: 'Singapore', jurisdiction: 'SG',   totalRequirements: 58,  tags: ['privacy'] },
  // -------- APAC banking --------
  { id: 'hkma-tmg1',      name: 'HKMA TM-G-1',                 version: '2019',         regulator: 'HKMA',      region: 'APAC',      jurisdiction: 'HK',   totalRequirements: 48,  tags: ['financial'] },
  { id: 'apra-cps234',    name: 'APRA CPS 234',                version: '2019',         regulator: 'APRA',      region: 'APAC',      jurisdiction: 'AU',   totalRequirements: 36,  tags: ['financial','security'] },
  { id: 'apra-cps230',    name: 'APRA CPS 230',                version: '2023',         regulator: 'APRA',      region: 'APAC',      jurisdiction: 'AU',   totalRequirements: 42,  tags: ['financial','operational-resilience'] },
  { id: 'rbi-cyber',      name: 'RBI Cyber Security Framework',version: '2016',         regulator: 'RBI',       region: 'APAC',      jurisdiction: 'IN',   totalRequirements: 54,  tags: ['financial','security'] },
  { id: 'ojk-1103',       name: 'OJK POJK 11/03/2022',         version: '2022',         regulator: 'OJK',       region: 'APAC',      jurisdiction: 'ID',   totalRequirements: 38,  tags: ['financial'] },
  { id: 'bnm-rmit',       name: 'BNM RMiT',                    version: '2020',         regulator: 'BNM',       region: 'APAC',      jurisdiction: 'MY',   totalRequirements: 62,  tags: ['financial','security'] },
  { id: 'bot-itrisk',     name: 'BOT IT Risk',                 version: '2021',         regulator: 'BOT',       region: 'APAC',      jurisdiction: 'TH',   totalRequirements: 34,  tags: ['financial','security'] },
  { id: 'bsp-982',        name: 'BSP Circular 982',            version: '2017',         regulator: 'BSP',       region: 'APAC',      jurisdiction: 'PH',   totalRequirements: 28,  tags: ['financial'] },
  // -------- APAC privacy --------
  { id: 'pipl',           name: 'PIPL',                        version: '2021',         regulator: 'CAC',       region: 'APAC',      jurisdiction: 'CN',   totalRequirements: 74,  tags: ['privacy'] },
  { id: 'appi',           name: 'APPI',                        version: '2022',         regulator: 'PPC',       region: 'APAC',      jurisdiction: 'JP',   totalRequirements: 56,  tags: ['privacy'] },
  { id: 'pipa',           name: 'PIPA',                        version: '2020',         regulator: 'PIPC',      region: 'APAC',      jurisdiction: 'KR',   totalRequirements: 48,  tags: ['privacy'] },
  { id: 'pdpa-my',        name: 'PDPA Malaysia',               version: '2010',         regulator: 'JPDP',      region: 'APAC',      jurisdiction: 'MY',   totalRequirements: 32,  tags: ['privacy'] },
  { id: 'pdpa-th',        name: 'PDPA Thailand',               version: '2019',         regulator: 'PDPC-TH',   region: 'APAC',      jurisdiction: 'TH',   totalRequirements: 38,  tags: ['privacy'] },
  { id: 'aus-privacy',    name: 'Privacy Act',                 version: '1988',         regulator: 'OAIC',      region: 'APAC',      jurisdiction: 'AU',   totalRequirements: 42,  tags: ['privacy'] },
  // -------- ESG --------
  { id: 'ghg-protocol',   name: 'GHG Protocol',                version: '2015 rev',     regulator: 'WRI/WBCSD', region: 'Global',    jurisdiction: 'INTL', totalRequirements: 28,  tags: ['esg','ghg'] },
  { id: 'issb-s1-s2',     name: 'ISSB IFRS S1/S2',             version: '2023',         regulator: 'ISSB',      region: 'Global',    jurisdiction: 'INTL', totalRequirements: 46,  tags: ['esg','disclosure'] },
  { id: 'tcfd',           name: 'TCFD',                        version: '2017 rev 2021',regulator: 'FSB',       region: 'Global',    jurisdiction: 'INTL', totalRequirements: 11,  tags: ['esg','climate'] }
];

// Requirement pool used for the top 8 frameworks. Matches the seed
// generator pattern (30 unique themes recycled with index suffix).
const REQ_TITLE_POOL: string[] = [
  'Access control policy',           'Encryption at rest',          'Encryption in transit',
  'Privileged access review',        'Vulnerability management',    'Incident response plan',
  'Data classification',             'Logging and monitoring',      'Change management',
  'Backup and recovery testing',     'Vendor risk management',      'Personnel security',
  'Business continuity testing',     'Risk assessment cadence',     'Security awareness training',
  'Audit log retention',             'MFA enforcement',             'Patch management SLA',
  'Network segmentation',            'Data retention policy',       'Subject access request handling',
  'Cross-border transfer controls',  'AI model risk management',    'Penetration testing',
  'Configuration baseline',          'Disaster recovery RTO/RPO',   'Cryptographic key management',
  'Third-party SOC2 review',         'Endpoint protection',         'Cloud workload isolation'
];

const TOP_FRAMEWORK_COUNTS: Record<string, number> = {
  soc2: 80, 'iso-27001': 60, 'nist-csf': 60, 'pci-dss-4': 80,
  'mas-trm': 70, gdpr: 50, dora: 60, 'eu-ai-act': 40
};

function buildRequirements(frameworkId: string, count: number): Requirement[] {
  const out: Requirement[] = [];
  for (let g = 1; g <= count; g++) {
    out.push({
      id: `${frameworkId}-R${String(g).padStart(3, '0')}`,
      frameworkId,
      code: `${frameworkId.toUpperCase()}-${String(g).padStart(3, '0')}`,
      title: `${REQ_TITLE_POOL[(g - 1) % REQ_TITLE_POOL.length]} (${frameworkId.toUpperCase()}.${g})`,
      description: `Auto-generated requirement for ${frameworkId} — clause ${g}`,
      weight: g % 7 === 0 ? 2.0 : g % 3 === 0 ? 1.5 : 1.0
    });
  }
  return out;
}

export const REQUIREMENTS: Record<string, Requirement[]> = Object.fromEntries(
  Object.entries(TOP_FRAMEWORK_COUNTS).map(([fid, n]) => [fid, buildRequirements(fid, n)])
);

export function getFrameworkById(id: string): Framework | undefined {
  return FRAMEWORKS.find((f) => f.id === id);
}

export function getRequirementsForFramework(frameworkId: string): Requirement[] {
  return REQUIREMENTS[frameworkId] ?? [];
}
