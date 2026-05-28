// =====================================================================
//  Mock users for admin pages. Deterministic per-tenant using mulberry32.
//  Spec: 6 RBAC roles · ~30 users across 8 tenants · APAC-flavoured names.
// =====================================================================

import type { User, Role, UserStatus } from './types';
import { hashStringToInt, mulberry32, pick } from './rng';
import { TENANTS } from './tenants';

const FIRST_NAMES = [
  'Lawrence', 'Mei Lin', 'Aaron', 'Priya', 'Hiroshi', 'Siti', 'Wei Jie',
  'Aisha', 'Daniel', 'Farah', 'Ravi', 'Yuki', 'Jia Hao', 'Nadia', 'Marcus',
  'Devi', 'Kenji', 'Chloe', 'Arjun', 'Sofia', 'Tan', 'Lim', 'Rashid',
  'Anita', 'Benedict', 'Mia', 'Joshua', 'Amelia', 'Ravi', 'Mei Ling',
  'Ethan', 'Aiko', 'Ravi', 'Sarah', 'Vikram', 'Hana', 'Liam', 'Olivia',
  'Bhumi', 'Caleb'
];

const LAST_NAMES = [
  'Khoo', 'Tan', 'Lim', 'Wong', 'Ng', 'Lee', 'Goh', 'Chua', 'Singh',
  'Kumar', 'Rahman', 'Patel', 'Sato', 'Tanaka', 'Nakamura', 'Yamamoto',
  'Anand', 'Sharma', 'Iyer', 'Bose', 'Chen', 'Zhang', 'Liu', 'Wang',
  'Hassan', 'Aziz', 'D\'Cruz', 'Fernando', 'Soh', 'Teo'
];

const ROLES: Role[] = ['admin', 'risk-owner', 'control-owner', 'auditor', 'agent-operator', 'viewer'];

const STATUSES: UserStatus[] = ['active', 'active', 'active', 'active', 'active', 'invited', 'disabled', 'locked'];

// Per-tenant user count — hero tenants get more users.
const USER_COUNTS: Record<string, number> = {
  t_maybank: 6,
  t_mindef: 5,
  t_grab: 5,
  t_singhealth: 3,
  t_govtech: 3,
  t_astar: 2,
  t_mediacorp: 2,
  t_singtel: 4
};

function emailFor(tenantId: string, first: string, last: string): string {
  const dom = ({
    t_maybank: 'maybank.com.sg',
    t_mindef: 'mindef.gov.sg',
    t_grab: 'grab.com',
    t_singhealth: 'singhealth.com.sg',
    t_govtech: 'govtech.gov.sg',
    t_astar: 'astar.edu.sg',
    t_mediacorp: 'mediacorp.sg',
    t_singtel: 'singtel.com'
  } as Record<string, string>)[tenantId] ?? 'ntt.com';
  const f = first.toLowerCase().replace(/\s+/g, '.').replace(/'/g, '');
  const l = last.toLowerCase().replace(/\s+/g, '').replace(/'/g, '');
  return `${f}.${l}@${dom}`;
}

function buildUsersForTenant(tenantId: string): User[] {
  const count = USER_COUNTS[tenantId] ?? 3;
  const rng = mulberry32(hashStringToInt(`users:${tenantId}`));
  const users: User[] = [];
  // Ensure at least one admin and one auditor per tenant.
  const seededRoles: Role[] = ['admin', 'auditor'];
  while (seededRoles.length < count) seededRoles.push(pick(ROLES, rng));
  for (let i = 0; i < count; i++) {
    const first = pick(FIRST_NAMES, rng);
    const last = pick(LAST_NAMES, rng);
    const role = seededRoles[i];
    const status = pick(STATUSES, rng);
    const mfaEnabled = role === 'admin' ? true : rng() > 0.18;
    const lastLoginAt = status === 'invited'
      ? undefined
      : new Date(Date.now() - Math.floor(rng() * 30) * 86_400_000 - Math.floor(rng() * 86_400_000)).toISOString();
    users.push({
      id: `usr_${tenantId.slice(2)}_${i + 1}`,
      tenantId,
      email: emailFor(tenantId, first, last),
      name: `${first} ${last}`,
      role,
      status,
      mfaEnabled,
      lastLoginAt
    });
  }
  return users;
}

let _cache: User[] | null = null;
export function getUsersAll(): User[] {
  if (_cache) return _cache;
  _cache = TENANTS.flatMap((t) => buildUsersForTenant(t.id));
  return _cache;
}

export function getUsersForTenant(tenantId: string): User[] {
  return getUsersAll().filter((u) => u.tenantId === tenantId);
}

// -------------------------------------------------------------
// RBAC permission matrix — used by /admin/users.
// -------------------------------------------------------------

export const CAPABILITIES = [
  'view-dashboard',
  'manage-risks',
  'approve-controls',
  'run-agents',
  'approve-decisions',
  'view-evidence',
  'export-data',
  'manage-policies',
  'audit-log-access',
  'admin-settings'
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const RBAC_MATRIX: Record<Role, Record<Capability, boolean>> = {
  admin: {
    'view-dashboard': true, 'manage-risks': true, 'approve-controls': true,
    'run-agents': true, 'approve-decisions': true, 'view-evidence': true,
    'export-data': true, 'manage-policies': true, 'audit-log-access': true,
    'admin-settings': true
  },
  'risk-owner': {
    'view-dashboard': true, 'manage-risks': true, 'approve-controls': false,
    'run-agents': true, 'approve-decisions': true, 'view-evidence': true,
    'export-data': true, 'manage-policies': false, 'audit-log-access': false,
    'admin-settings': false
  },
  'control-owner': {
    'view-dashboard': true, 'manage-risks': false, 'approve-controls': true,
    'run-agents': true, 'approve-decisions': false, 'view-evidence': true,
    'export-data': true, 'manage-policies': false, 'audit-log-access': false,
    'admin-settings': false
  },
  auditor: {
    'view-dashboard': true, 'manage-risks': false, 'approve-controls': false,
    'run-agents': false, 'approve-decisions': false, 'view-evidence': true,
    'export-data': true, 'manage-policies': false, 'audit-log-access': true,
    'admin-settings': false
  },
  'agent-operator': {
    'view-dashboard': true, 'manage-risks': false, 'approve-controls': false,
    'run-agents': true, 'approve-decisions': true, 'view-evidence': true,
    'export-data': false, 'manage-policies': false, 'audit-log-access': false,
    'admin-settings': false
  },
  viewer: {
    'view-dashboard': true, 'manage-risks': false, 'approve-controls': false,
    'run-agents': false, 'approve-decisions': false, 'view-evidence': true,
    'export-data': false, 'manage-policies': false, 'audit-log-access': false,
    'admin-settings': false
  }
};
