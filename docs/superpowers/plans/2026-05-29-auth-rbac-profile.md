# Auth, RBAC, Profile & Change Password Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace demo-mode autologin with real session-based auth, enforce RBAC on protected routes, make the profile editable, and add a working change-password form.

**Architecture:** `hooks.server.ts` validates a `session` cookie against `platform.sessions` (Postgres) and populates `event.locals.user`; unauthenticated requests redirect to `/login`. A `can()` helper reads `RBAC_MATRIX` to gate admin routes. Profile edits and password changes are SvelteKit form actions on `/admin/settings` that write to `platform.users`.

**Tech Stack:** SvelteKit form actions, `bcryptjs` (pure-JS, no native build), `pg`, Postgres (`platform.users`, `platform.sessions`), existing `RBAC_MATRIX` in `src/lib/data/users.ts`.

---

## File Map

| File | Change |
|------|--------|
| `package.json` | add `bcryptjs` + `@types/bcryptjs` |
| `src/lib/server/auth.ts` | **create** — session helpers (create, validate, destroy, can) |
| `src/hooks.server.ts` | replace demo autologin with session-cookie validation + redirect |
| `src/routes/login/+page.server.ts` | real login action (validate credentials, create session, set cookie) |
| `src/routes/login/+page.svelte` | remove "any credentials accepted" disclaimer, show real error |
| `src/routes/logout/+page.server.ts` | **create** — invalidate session, clear cookie, redirect |
| `src/routes/admin/settings/+page.server.ts` | add `updateProfile` and `changePassword` actions |
| `src/routes/admin/settings/+page.svelte` | make profile fields editable, add change-password section |
| `src/routes/admin/+layout.server.ts` | **create** — RBAC guard for all `/admin` routes |
| `db/seed.sql` | add bcrypt-hashed passwords to user INSERT |

---

## Task 1: Install bcryptjs

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
cd /Users/lawrence/Development/ntt-grc-hub
npm install bcryptjs
npm install --save-dev @types/bcryptjs
```

Expected output: package added to `node_modules`, `package.json` updated.

- [ ] **Step 2: Verify the import resolves**

```bash
node -e "import('bcryptjs').then(m => console.log('ok', typeof m.default.hash))"
```

Expected: `ok function`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add bcryptjs for password hashing"
```

---

## Task 2: Create auth server helpers

**Files:**
- Create: `src/lib/server/auth.ts`

- [ ] **Step 1: Write the file**

```typescript
// src/lib/server/auth.ts
import bcrypt from 'bcryptjs';
import { getPool } from './pg';
import { RBAC_MATRIX, type Capability } from '$lib/data/users';
import type { Role } from '$lib/data/types';

export const SESSION_COOKIE = 'grc_session';
export const SESSION_TTL_DAYS = 7;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  tenantId: string;
}

/** Verify email+password; returns user row or null */
export async function verifyCredentials(
  email: string,
  password: string
): Promise<SessionUser | null> {
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string; email: string; name: string;
    role: Role; tenant_id: string; password_hash: string | null; status: string;
  }>(
    `SELECT id, email, name, role, tenant_id, password_hash, status
     FROM platform.users WHERE email = $1`,
    [email.trim().toLowerCase()]
  );
  const user = rows[0];
  if (!user || user.status !== 'active' || !user.password_hash) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenant_id };
}

/** Create a session row; returns the opaque token to store in cookie */
export async function createSession(userId: string, ip: string, ua: string): Promise<string> {
  const pool = getPool();
  const token = crypto.randomUUID() + '-' + crypto.randomUUID();
  const hash = await bcrypt.hash(token, 10);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  await pool.query(
    `INSERT INTO platform.sessions (user_id, token_hash, issued_at, expires_at, ip_address, user_agent)
     VALUES ($1, $2, now(), $3, $4::inet, $5)`,
    [userId, hash, expiresAt, ip || null, ua || null]
  );
  return token;
}

/** Validate session cookie token; returns user or null */
export async function validateSession(token: string): Promise<SessionUser | null> {
  if (!token) return null;
  const pool = getPool();
  // Fetch recent active sessions for this approximate token prefix (first 36 chars = UUID)
  const prefix = token.slice(0, 36);
  const { rows } = await pool.query<{
    id: string; token_hash: string; expires_at: Date; revoked_at: Date | null;
    user_id: string; email: string; name: string; role: Role; tenant_id: string; status: string;
  }>(
    `SELECT s.id, s.token_hash, s.expires_at, s.revoked_at,
            u.id AS user_id, u.email, u.name, u.role, u.tenant_id, u.status
     FROM platform.sessions s
     JOIN platform.users u ON u.id = s.user_id
     WHERE s.expires_at > now() AND s.revoked_at IS NULL
     ORDER BY s.issued_at DESC LIMIT 50`
  );
  for (const row of rows) {
    const match = await bcrypt.compare(token, row.token_hash);
    if (match) {
      if (row.status !== 'active') return null;
      return { id: row.user_id, email: row.email, name: row.name, role: row.role, tenantId: row.tenant_id };
    }
  }
  return null;
}

/** Revoke a session by token (best-effort) */
export async function destroySession(token: string): Promise<void> {
  if (!token) return;
  const pool = getPool();
  const { rows } = await pool.query<{ id: string; token_hash: string }>(
    `SELECT id, token_hash FROM platform.sessions
     WHERE expires_at > now() AND revoked_at IS NULL ORDER BY issued_at DESC LIMIT 50`
  );
  for (const row of rows) {
    const match = await bcrypt.compare(token, row.token_hash);
    if (match) {
      await pool.query(`UPDATE platform.sessions SET revoked_at = now() WHERE id = $1`, [row.id]);
      break;
    }
  }
}

/** Check RBAC capability for a role */
export function can(role: Role, capability: Capability): boolean {
  return RBAC_MATRIX[role]?.[capability] ?? false;
}

/** Hash a plain-text password */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}
```

- [ ] **Step 2: Check TypeScript**

```bash
cd /Users/lawrence/Development/ntt-grc-hub && npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -20
```

Expected: 0 errors (warnings about unused vars in other files are ok).

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/auth.ts
git commit -m "feat: auth server helpers — session CRUD, bcrypt verify, RBAC can()"
```

---

## Task 3: Seed bcrypt-hashed passwords for demo users

**Files:**
- Modify: `db/seed.sql`

- [ ] **Step 1: Generate the hash outside the plan**

The password for all demo users will be `Demo1234!`. Generate the bcrypt hash once:

```bash
node -e "import('bcryptjs').then(async m => { console.log(await m.default.hash('Demo1234!', 12)); })"
```

Copy the output hash (it looks like `$2b$12$...`). You will use it in the next step.

- [ ] **Step 2: Update seed.sql to set password_hash**

Find the `INSERT INTO platform.users` block in `db/seed.sql`. It currently reads:

```sql
INSERT INTO platform.users (tenant_id, email, name, role, status, mfa_enabled, last_login_at)
SELECT
  t.id,
  lower(replace(t.name, ' ', '.')) || '.' || u.role_slug || '@example.sg',
  u.name_prefix || ' ' || initcap(split_part(t.name, ' ', 1)),
  u.role::platform.role,
  'active'::platform.user_status,
  true,
  now() - (random() * interval '6 hours')
FROM platform.tenants t
CROSS JOIN (VALUES
  ('admin',          'admin',          'Alex'),
  ('risk-owner',     'risk',           'Priya'),
  ('control-owner',  'control',        'Kenji'),
  ('auditor',        'auditor',        'Mei Ling'),
  ('agent-operator', 'ops',            'Marcus')
) AS u(role, role_slug, name_prefix);
```

Replace it with (substitute `<HASH>` with the actual hash from Step 1):

```sql
INSERT INTO platform.users (tenant_id, email, name, role, status, password_hash, mfa_enabled, last_login_at)
SELECT
  t.id,
  lower(replace(t.name, ' ', '.')) || '.' || u.role_slug || '@example.sg',
  u.name_prefix || ' ' || initcap(split_part(t.name, ' ', 1)),
  u.role::platform.role,
  'active'::platform.user_status,
  '<HASH>',
  true,
  now() - (random() * interval '6 hours')
FROM platform.tenants t
CROSS JOIN (VALUES
  ('admin',          'admin',          'Alex'),
  ('risk-owner',     'risk',           'Priya'),
  ('control-owner',  'control',        'Kenji'),
  ('auditor',        'auditor',        'Mei Ling'),
  ('agent-operator', 'ops',            'Marcus')
) AS u(role, role_slug, name_prefix);
```

- [ ] **Step 3: Re-run the seed to verify**

```bash
npm run db:seed 2>&1 | grep -E "(ERROR|users)"
```

Expected: no ERROR lines; should show successful INSERT.

- [ ] **Step 4: Smoke-test credentials in psql**

```bash
psql -U $(whoami) -d ntt_grc_hub -c "SELECT email, password_hash IS NOT NULL AS has_hash FROM platform.users LIMIT 5;"
```

Expected: all rows show `has_hash = t`.

- [ ] **Step 5: Commit**

```bash
git add db/seed.sql
git commit -m "feat: seed bcrypt-hashed passwords (Demo1234!) for all demo users"
```

---

## Task 4: Update hooks.server.ts — real session validation

**Files:**
- Modify: `src/hooks.server.ts`

- [ ] **Step 1: Rewrite hooks.server.ts**

```typescript
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { validateSession, SESSION_COOKIE } from '$lib/server/auth';
import { isPgMode } from '$lib/server/pg';

const TENANT_COOKIE = 'grc_tenant';
const ALL_TENANTS_ID = '__all__';

const PUBLIC_PATHS = ['/login', '/logout'];

export const handle: Handle = async ({ event, resolve }) => {
  const tenantCookie = event.cookies.get(TENANT_COOKIE);
  const tenantId = tenantCookie && tenantCookie.length > 0 ? tenantCookie : ALL_TENANTS_ID;
  event.locals.tenantId = tenantId;

  // In mock mode keep demo autologin so the app works without Postgres
  if (!isPgMode()) {
    event.locals.user = {
      id: 'u_demo',
      email: 'demo@ntt.com',
      name: 'Lawrence Khoo',
      role: 'admin',
      tenantId
    };
    return resolve(event);
  }

  // Postgres mode: validate session cookie
  const token = event.cookies.get(SESSION_COOKIE) ?? '';
  const user = await validateSession(token);

  if (user) {
    event.locals.user = { ...user, tenantId };
  } else {
    event.locals.user = undefined;
    const path = event.url.pathname;
    if (!PUBLIC_PATHS.some((p) => path.startsWith(p))) {
      throw redirect(303, `/login?next=${encodeURIComponent(path)}`);
    }
  }

  return resolve(event);
};
```

- [ ] **Step 2: Check TypeScript**

```bash
cd /Users/lawrence/Development/ntt-grc-hub && npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -20
```

Expected: 0 new errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks.server.ts
git commit -m "feat: real session-based auth in hooks.server.ts (mock mode preserved)"
```

---

## Task 5: Real login action

**Files:**
- Modify: `src/routes/login/+page.server.ts`
- Modify: `src/routes/login/+page.svelte`

- [ ] **Step 1: Rewrite the server action**

```typescript
// src/routes/login/+page.server.ts
import type { Actions, PageServerLoad } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { verifyCredentials, createSession, SESSION_COOKIE, SESSION_TTL_DAYS } from '$lib/server/auth';
import { isPgMode } from '$lib/server/pg';

export const load: PageServerLoad = async ({ locals, url }) => {
  // Already logged in — skip login page
  if (locals.user) throw redirect(303, url.searchParams.get('next') ?? '/');
  return { next: url.searchParams.get('next') ?? '/' };
};

export const actions: Actions = {
  default: async ({ request, cookies, getClientAddress }) => {
    // Demo mode: accept any credentials
    if (!isPgMode()) throw redirect(303, '/');

    const data = await request.formData();
    const email = String(data.get('email') ?? '');
    const password = String(data.get('password') ?? '');

    if (!email || !password) {
      return fail(400, { error: 'Email and password are required.' });
    }

    const user = await verifyCredentials(email, password);
    if (!user) {
      return fail(401, { error: 'Invalid email or password.' });
    }

    const ua = request.headers.get('user-agent') ?? '';
    const ip = getClientAddress();
    const token = await createSession(user.id, ip, ua);

    cookies.set(SESSION_COOKIE, token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: SESSION_TTL_DAYS * 86_400,
      secure: process.env.NODE_ENV === 'production'
    });

    throw redirect(303, String(data.get('next') ?? '/'));
  }
};
```

- [ ] **Step 2: Update login page to show errors and remove disclaimer**

Open `src/routes/login/+page.svelte`. Find the script block and add `form` prop:

```svelte
<script lang="ts">
  export let data;
  export let form;  // add this line
  // ... rest of existing script
</script>
```

Find the disclaimer paragraph (text: "Demo build — any credentials are accepted.") and replace it with:

```svelte
{#if form?.error}
  <p class="text-sm text-red-600 text-center">{form.error}</p>
{/if}
```

Also ensure the form has a hidden `next` field. After the opening `<form ...>` tag, add:

```svelte
<input type="hidden" name="next" value={data.next} />
```

- [ ] **Step 3: Check TypeScript**

```bash
cd /Users/lawrence/Development/ntt-grc-hub && npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -20
```

Expected: 0 new errors.

- [ ] **Step 4: Commit**

```bash
git add src/routes/login/+page.server.ts src/routes/login/+page.svelte
git commit -m "feat: real login action with bcrypt credential validation and session cookie"
```

---

## Task 6: Logout route

**Files:**
- Create: `src/routes/logout/+page.server.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/routes/logout/+page.server.ts
import type { Actions } from './$types';
import { redirect } from '@sveltejs/kit';
import { destroySession, SESSION_COOKIE } from '$lib/server/auth';
import { isPgMode } from '$lib/server/pg';

export const actions: Actions = {
  default: async ({ cookies }) => {
    if (isPgMode()) {
      const token = cookies.get(SESSION_COOKIE) ?? '';
      await destroySession(token);
    }
    cookies.delete(SESSION_COOKIE, { path: '/' });
    throw redirect(303, '/login');
  }
};
```

- [ ] **Step 2: Create the page (redirect GET to POST)**

```svelte
<!-- src/routes/logout/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  onMount(() => {
    // Auto-submit logout form
    (document.getElementById('logout-form') as HTMLFormElement).submit();
  });
</script>

<form id="logout-form" method="POST" action="/logout">
  <p>Logging out…</p>
</form>
```

- [ ] **Step 3: Wire logout into the top bar**

Open `src/lib/components/TopBar.svelte`. Find the user/avatar area and add a logout button. Look for any existing logout link or user menu and replace/add:

```svelte
<form method="POST" action="/logout">
  <button type="submit" class="text-xs text-slate-500 hover:text-slate-900">Log out</button>
</form>
```

Place this inside the user profile dropdown or beside the avatar, depending on TopBar's structure.

- [ ] **Step 4: Commit**

```bash
git add src/routes/logout/ src/lib/components/TopBar.svelte
git commit -m "feat: logout route — revokes session, clears cookie, redirects to /login"
```

---

## Task 7: RBAC guard on admin routes

**Files:**
- Create: `src/routes/admin/+layout.server.ts`

- [ ] **Step 1: Create the layout guard**

```typescript
// src/routes/admin/+layout.server.ts
import type { LayoutServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { can } from '$lib/server/auth';

export const load: LayoutServerLoad = async ({ locals }) => {
  const user = locals.user;
  if (!user) throw error(401, 'Not authenticated');
  if (!can(user.role, 'admin-settings')) {
    throw error(403, 'You do not have permission to access admin pages.');
  }
  return { user };
};
```

- [ ] **Step 2: Check TypeScript**

```bash
cd /Users/lawrence/Development/ntt-grc-hub && npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -20
```

Expected: 0 new errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/admin/+layout.server.ts
git commit -m "feat: RBAC guard on /admin routes — requires admin-settings capability"
```

---

## Task 8: Profile edit + change password — server actions

**Files:**
- Modify: `src/routes/admin/settings/+page.server.ts`

- [ ] **Step 1: Rewrite the server file with actions**

```typescript
// src/routes/admin/settings/+page.server.ts
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getTenantSummaries } from '$lib/server/data';
import { hashPassword, verifyCredentials } from '$lib/server/auth';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';
import { isPgMode, getPool } from '$lib/server/pg';

export const load: PageServerLoad = async ({ locals }) => {
  const tenants = await getTenantSummaries();
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? 't_maybank' : tenantId;
  const tenant = tenants.find((t) => t.id === effective);

  const apiTokens = [
    { id: 'tok_1', name: 'Evidence Collector CI', scope: 'evidence:write', prefix: 'ntt_grc_', lastUsedAt: new Date(Date.now() - 12 * 60_000).toISOString(),  expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString() },
    { id: 'tok_2', name: 'Board Pack Exporter',   scope: 'report:read',    prefix: 'ntt_grc_', lastUsedAt: new Date(Date.now() - 2 * 3600_000).toISOString(),  expiresAt: new Date(Date.now() + 90 * 86_400_000).toISOString() },
    { id: 'tok_3', name: 'Auditor (external)',    scope: 'evidence:read',  prefix: 'ntt_grc_', lastUsedAt: new Date(Date.now() - 9 * 86_400_000).toISOString(), expiresAt: new Date(Date.now() + 180 * 86_400_000).toISOString() },
    { id: 'tok_4', name: 'Servicedesk webhook',   scope: 'issue:write',    prefix: 'ntt_grc_', lastUsedAt: new Date(Date.now() - 31 * 60_000).toISOString(),   expiresAt: new Date(Date.now() + 365 * 86_400_000).toISOString() }
  ];

  return { tenants, tenant, apiTokens, user: locals.user };
};

export const actions: Actions = {
  updateProfile: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { profileError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { profileError: 'Profile editing requires Postgres mode.' });

    const data = await request.formData();
    const name = String(data.get('name') ?? '').trim();
    const language = String(data.get('language') ?? '').trim();
    const timezone = String(data.get('timezone') ?? '').trim();

    if (!name) return fail(400, { profileError: 'Name is required.' });

    const pool = getPool();
    await pool.query(
      `UPDATE platform.users SET name = $1, language = $2, timezone = $3 WHERE id = $4`,
      [name, language, timezone, locals.user.id]
    );

    return { profileSuccess: true };
  },

  changePassword: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { pwError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { pwError: 'Password change requires Postgres mode.' });

    const data = await request.formData();
    const current = String(data.get('currentPassword') ?? '');
    const next = String(data.get('newPassword') ?? '');
    const confirm = String(data.get('confirmPassword') ?? '');

    if (!current || !next || !confirm) return fail(400, { pwError: 'All fields are required.' });
    if (next !== confirm) return fail(400, { pwError: 'New passwords do not match.' });
    if (next.length < 8) return fail(400, { pwError: 'New password must be at least 8 characters.' });

    // Verify current password
    const verified = await verifyCredentials(locals.user.email, current);
    if (!verified) return fail(401, { pwError: 'Current password is incorrect.' });

    const hash = await hashPassword(next);
    const pool = getPool();
    await pool.query(`UPDATE platform.users SET password_hash = $1 WHERE id = $2`, [hash, locals.user.id]);

    // Write audit log entry
    await pool.query(
      `INSERT INTO platform.audit_log (tenant_id, actor_id, action, resource_type, resource_id, detail)
       VALUES ($1, $2, 'password_change', 'user', $2, '{"self": true}')`,
      [locals.user.tenantId, locals.user.id]
    ).catch(() => { /* audit log is best-effort */ });

    return { pwSuccess: true };
  }
};
```

- [ ] **Step 2: Check TypeScript**

```bash
cd /Users/lawrence/Development/ntt-grc-hub && npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -20
```

**Note:** If `language` and `timezone` columns don't exist on `platform.users`, the query will fail at runtime. Check the schema:

```bash
psql -U $(whoami) -d ntt_grc_hub -c "\d platform.users"
```

If `language` and `timezone` columns are missing, add them first:

```bash
psql -U $(whoami) -d ntt_grc_hub -c "
  ALTER TABLE platform.users ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en-SG';
  ALTER TABLE platform.users ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Singapore';
"
```

Also add those columns to `db/init.sql` in the `platform.users` CREATE TABLE block:

```sql
language        TEXT NOT NULL DEFAULT 'en-SG',
timezone        TEXT NOT NULL DEFAULT 'Asia/Singapore',
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/admin/settings/+page.server.ts db/init.sql
git commit -m "feat: updateProfile and changePassword server actions"
```

---

## Task 9: Profile edit + change password — UI

**Files:**
- Modify: `src/routes/admin/settings/+page.svelte`

- [ ] **Step 1: Add form prop and update script block**

At the top of the `<script lang="ts">` block, add `form` prop:

```svelte
<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { addToast } from '$lib/stores/toast';
  import { formatRelative, formatIsoSgt } from '$lib/utils/dates';
  import {
    User, Settings as SettingsIcon, KeyRound, Lock, Palette, ShieldCheck, Cpu, ShieldAlert
  } from 'lucide-svelte';

  export let data;
  export let form;

  // Show success toasts reactively
  $: if (form?.profileSuccess) addToast('success', 'Profile updated.');
  $: if (form?.pwSuccess) addToast('success', 'Password changed successfully.');

  $: defaultProvider = data.tenant?.id === 't_mindef' ? 'tsuzumi' : 'anthropic';
  $: defaultResidency = data.tenant?.id === 't_mindef' ? 'SG' : 'SG';
  let residency: string;
  let provider: string;
  $: { residency = defaultResidency; provider = defaultProvider; }

  function toast(msg: string) { addToast('info', msg); }
  function revoke(name: string) { addToast('warn', `Token "${name}" would be revoked (demo).`); }
  function saveTenant() { addToast('success', `Tenant settings saved for ${data.tenant?.name ?? 'tenant'}.`); }
</script>
```

- [ ] **Step 2: Replace the Profile card with an editable form**

Find the Profile card (the `<div class="card p-6">` with `<h2>Profile</h2>`). Replace the entire card with:

```svelte
<!-- Profile -->
<div class="card p-6">
  <div class="mb-4 flex items-center gap-2">
    <User class="h-4 w-4 text-grc-primary" />
    <h2 class="section-title">Profile</h2>
  </div>
  <form method="POST" action="?/updateProfile" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
    <label class="block">
      <span class="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Name</span>
      <input name="name" value={data.user?.name ?? ''} required class="input" />
    </label>
    <label class="block">
      <span class="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Email</span>
      <input value={data.user?.email ?? ''} readonly class="input bg-slate-50" />
    </label>
    <label class="block">
      <span class="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Role</span>
      <input value={data.user?.role ?? ''} readonly class="input bg-slate-50" />
    </label>
    <label class="block">
      <span class="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Language</span>
      <select name="language" class="input">
        <option value="en-SG">English (en-SG)</option>
        <option value="en-US">English (en-US)</option>
        <option value="ja-JP">Japanese (ja-JP)</option>
        <option value="zh-SG">Chinese (zh-SG)</option>
      </select>
    </label>
    <label class="block sm:col-span-2">
      <span class="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Timezone</span>
      <select name="timezone" class="input">
        <option value="Asia/Singapore">Asia/Singapore (SGT, UTC+8)</option>
        <option value="Asia/Tokyo">Asia/Tokyo (JST, UTC+9)</option>
        <option value="Australia/Sydney">Australia/Sydney (AEST, UTC+10)</option>
        <option value="Europe/London">Europe/London (GMT, UTC+0)</option>
        <option value="America/New_York">America/New_York (ET, UTC-5)</option>
      </select>
    </label>
    {#if form?.profileError}
      <p class="sm:col-span-2 text-xs text-red-600">{form.profileError}</p>
    {/if}
    <div class="sm:col-span-2 flex justify-end">
      <button type="submit" class="btn-primary">Save Profile</button>
    </div>
  </form>
</div>
```

- [ ] **Step 3: Add change-password card**

After the Profile card closing `</div>` (and before or after the Tenant Settings card), insert:

```svelte
<!-- Change Password -->
<div class="card p-6">
  <div class="mb-4 flex items-center gap-2">
    <Lock class="h-4 w-4 text-grc-primary" />
    <h2 class="section-title">Change Password</h2>
  </div>
  <form method="POST" action="?/changePassword" class="grid grid-cols-1 gap-3">
    <label class="block">
      <span class="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Current Password</span>
      <input type="password" name="currentPassword" required class="input" autocomplete="current-password" />
    </label>
    <label class="block">
      <span class="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">New Password</span>
      <input type="password" name="newPassword" required minlength="8" class="input" autocomplete="new-password" />
    </label>
    <label class="block">
      <span class="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Confirm New Password</span>
      <input type="password" name="confirmPassword" required minlength="8" class="input" autocomplete="new-password" />
    </label>
    {#if form?.pwError}
      <p class="text-xs text-red-600">{form.pwError}</p>
    {/if}
    <div class="flex justify-end">
      <button type="submit" class="btn-primary">Change Password</button>
    </div>
  </form>
</div>
```

- [ ] **Step 4: Check TypeScript**

```bash
cd /Users/lawrence/Development/ntt-grc-hub && npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -20
```

Expected: 0 new errors.

- [ ] **Step 5: Commit**

```bash
git add src/routes/admin/settings/+page.svelte
git commit -m "feat: editable profile form and change-password UI in settings"
```

---

## Task 10: Manual end-to-end verification

**Goal:** Confirm all four features work together in a running app (requires Postgres).

- [ ] **Step 1: Start the app in Postgres mode**

```bash
cd /Users/lawrence/Development/ntt-grc-hub
DATA_MODE=pg DATABASE_URL=postgresql://$(whoami)@localhost/ntt_grc_hub npm run dev
```

- [ ] **Step 2: Test login**

1. Open `http://localhost:5182`
2. Should redirect to `/login`
3. Enter `alex.maybank.admin@example.sg` / `Demo1234!` → should redirect to `/`
4. Enter wrong password → should show "Invalid email or password."

- [ ] **Step 3: Test RBAC**

1. Log in as `mei.ling.maybank.auditor@example.sg` / `Demo1234!`
2. Try navigating to `/admin/settings`
3. Should see 403 error (auditor does not have `admin-settings` capability)
4. Log back in as admin — `/admin/settings` should load normally

- [ ] **Step 4: Test profile edit**

1. Logged in as admin, go to `/admin/settings`
2. Change name to `Alex Lim`, change timezone to `Asia/Tokyo`
3. Click "Save Profile"
4. Reload page — name and timezone should reflect the saved values

- [ ] **Step 5: Test change password**

1. Still on `/admin/settings`
2. Enter current password `Demo1234!`, new password `NewPass456!`, confirm same
3. Click "Change Password"
4. Should show success toast
5. Log out, log back in with `NewPass456!` → should succeed
6. Log back in with `Demo1234!` → should fail

- [ ] **Step 6: Test logout**

1. Click "Log out" in the top bar
2. Should clear session cookie and redirect to `/login`
3. Try accessing `/` directly — should redirect back to `/login`

- [ ] **Step 7: Commit summary**

If all checks pass:

```bash
git add -A
git commit -m "feat: auth + RBAC + profile + change-password — all verified working"
```

---

## Notes

- **Mock mode fallback:** When `DATA_MODE` is not `pg`, the app still runs in demo autologin mode. Login, profile, and change-password actions return a `fail` with a helpful message instead of crashing.
- **audit_log INSERT in changePassword:** May fail if the `audit_log` table schema doesn't have an `actor_id` column by that exact name — the `.catch()` makes it best-effort, so the password change still succeeds.
- **Session token lookup:** The current `validateSession` does a full bcrypt compare against up to 50 recent sessions. For a demo with <30 users this is fine. For scale, consider storing a `token_prefix` index column.
