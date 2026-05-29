// Shared demo-account list used by the login UI and the mock-mode auth hook.
// Each entry is a fully resolved user record so login in DATA_MODE=mock can set
// the picked identity into a cookie and the hook can hydrate locals.user from it.

import type { AppUser } from '$lib/stores/auth';

export interface DemoLogin {
  email: string;
  password: string;
  name: string;
  role: AppUser['role'];
  tenantId: string;     // Seed-tenant id, or '__all__' for platform admins
  tenantName: string;   // Display name shown in the demo-accounts panel
}

export const DEMO_LOGINS: DemoLogin[] = [
  { email: 'admin@ntt.sg',      password: 'demo', name: 'Lawrence Tan',  role: 'admin',          tenantId: '__all__',  tenantName: 'NTT Singapore (Platform Admin)' },
  { email: 'ciso@maybank.sg',   password: 'demo', name: 'Aisha Rahman',  role: 'risk-owner',     tenantId: 't_maybank', tenantName: 'Maybank Singapore' },
  { email: 'auditor@mindef.sg', password: 'demo', name: 'Col. R. Kumar', role: 'auditor',        tenantId: 't_mindef',  tenantName: 'MINDEF Defence Cloud' },
  { email: 'control@grab.com',  password: 'demo', name: 'Wei Ming Lee',  role: 'control-owner',  tenantId: 't_grab',    tenantName: 'Grab Fintech APAC' },
  { email: 'agent-ops@ntt.sg',  password: 'demo', name: 'Priya Nair',    role: 'agent-operator', tenantId: '__all__',  tenantName: 'NTT Singapore' },
  { email: 'viewer@maybank.sg', password: 'demo', name: 'Jason Chua',    role: 'viewer',         tenantId: 't_maybank', tenantName: 'Maybank Singapore' }
];

/** Default identity used when no demo cookie is present (matches old hardcoded fallback). */
export const DEFAULT_DEMO_LOGIN: DemoLogin = {
  email: 'demo@ntt.com',
  password: 'demo',
  name: 'Lawrence Khoo',
  role: 'admin',
  tenantId: '__all__',
  tenantName: 'NTT Singapore'
};

export function findDemoLogin(email: string): DemoLogin | null {
  const normalised = email.trim().toLowerCase();
  return DEMO_LOGINS.find((d) => d.email.toLowerCase() === normalised) ?? null;
}

/** Cookie names — exported so login / hooks / logout all agree. */
export const DEMO_USER_COOKIE = 'grc_demo_user';
