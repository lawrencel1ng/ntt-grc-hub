import type { Tenant } from './types';

// Mirrors db/seed.sql section 1 (platform.tenants).
export const TENANTS: Tenant[] = [
  {
    id: 't_maybank',
    name: 'Maybank Singapore',
    industry: 'Banking',
    region: 'SG',
    classified: false,
    slaTier: 'platinum',
    primaryFramework: 'mas-trm',
    headquarteredIn: 'Singapore',
    mrrSgd: 84000,
    createdAt: '2024-01-15T08:00:00+08:00'
  },
  {
    id: 't_mindef',
    name: 'MINDEF Defence Cloud',
    industry: 'Defence',
    region: 'SG',
    classified: true,
    slaTier: 'sovereign',
    primaryFramework: 'im8',
    headquarteredIn: 'Singapore',
    mrrSgd: 120000,
    createdAt: '2023-11-02T08:00:00+08:00'
  },
  {
    id: 't_grab',
    name: 'Grab Fintech APAC',
    industry: 'Fintech',
    region: 'APAC',
    classified: false,
    slaTier: 'platinum',
    primaryFramework: 'mas-trm',
    headquarteredIn: 'Singapore',
    mrrSgd: 68000,
    createdAt: '2024-03-20T08:00:00+08:00'
  },
  {
    id: 't_singhealth',
    name: 'SingHealth',
    industry: 'Healthcare',
    region: 'SG',
    classified: false,
    slaTier: 'standard',
    primaryFramework: 'iso-27001',
    headquarteredIn: 'Singapore',
    mrrSgd: 22000,
    createdAt: '2024-05-10T08:00:00+08:00'
  },
  {
    id: 't_govtech',
    name: 'GovTech Singapore',
    industry: 'Public Sector',
    region: 'SG',
    classified: false,
    slaTier: 'gold',
    primaryFramework: 'im8',
    headquarteredIn: 'Singapore',
    mrrSgd: 38000,
    createdAt: '2024-02-14T08:00:00+08:00'
  },
  {
    id: 't_astar',
    name: 'A*STAR',
    industry: 'Research',
    region: 'SG',
    classified: false,
    slaTier: 'standard',
    primaryFramework: 'iso-27001',
    headquarteredIn: 'Singapore',
    mrrSgd: 14000,
    createdAt: '2024-08-22T08:00:00+08:00'
  },
  {
    id: 't_mediacorp',
    name: 'Mediacorp',
    industry: 'Media',
    region: 'SG',
    classified: false,
    slaTier: 'standard',
    primaryFramework: 'pdpa-sg',
    headquarteredIn: 'Singapore',
    mrrSgd: 9800,
    createdAt: '2024-09-05T08:00:00+08:00'
  },
  {
    id: 't_singtel',
    name: 'Singtel',
    industry: 'Telecommunications',
    region: 'APAC',
    classified: false,
    slaTier: 'gold',
    primaryFramework: 'iso-27001',
    headquarteredIn: 'Singapore',
    mrrSgd: 42000,
    createdAt: '2024-04-18T08:00:00+08:00'
  }
];

export const HERO_TENANT_IDS = ['t_maybank', 't_mindef', 't_grab'] as const;
export const SHALLOW_TENANT_IDS = ['t_singhealth', 't_govtech', 't_astar', 't_mediacorp', 't_singtel'] as const;

// Per-tenant volume profile — drives generator densities so a Maybank
// view shows believable scale and a shallow tenant feels lighter.
export const TENANT_PROFILES: Record<string, {
  riskCount: number;
  controlCount: number;
  evidenceCount: number;
  vendorCount: number;
  policyCount: number;
  incidentCount: number;
  issueCount: number;
  bcmPlanCount: number;
  modelCount: number;
}> = {
  t_maybank:    { riskCount: 340, controlCount: 1200, evidenceCount: 8400, vendorCount: 47, policyCount: 18, incidentCount: 14, issueCount: 47, bcmPlanCount: 8, modelCount: 6 },
  t_grab:       { riskCount: 410, controlCount: 1500, evidenceCount: 11000, vendorCount: 89, policyCount: 18, incidentCount: 12, issueCount: 56, bcmPlanCount: 8, modelCount: 6 },
  t_mindef:     { riskCount: 220, controlCount: 900,  evidenceCount: 5200, vendorCount: 8,  policyCount: 12, incidentCount: 6,  issueCount: 18, bcmPlanCount: 8, modelCount: 6 },
  t_singhealth: { riskCount: 28,  controlCount: 60,   evidenceCount: 200,  vendorCount: 5,  policyCount: 6,  incidentCount: 2,  issueCount: 6,  bcmPlanCount: 2, modelCount: 0 },
  t_govtech:    { riskCount: 36,  controlCount: 90,   evidenceCount: 400,  vendorCount: 5,  policyCount: 8,  incidentCount: 3,  issueCount: 8,  bcmPlanCount: 2, modelCount: 0 },
  t_astar:      { riskCount: 18,  controlCount: 45,   evidenceCount: 120,  vendorCount: 5,  policyCount: 4,  incidentCount: 1,  issueCount: 4,  bcmPlanCount: 1, modelCount: 0 },
  t_mediacorp:  { riskCount: 14,  controlCount: 30,   evidenceCount: 90,   vendorCount: 5,  policyCount: 4,  incidentCount: 1,  issueCount: 3,  bcmPlanCount: 1, modelCount: 0 },
  t_singtel:    { riskCount: 42,  controlCount: 120,  evidenceCount: 280,  vendorCount: 5,  policyCount: 8,  incidentCount: 2,  issueCount: 9,  bcmPlanCount: 2, modelCount: 0 }
};
