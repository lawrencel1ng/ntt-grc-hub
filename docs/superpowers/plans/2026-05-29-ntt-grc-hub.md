# NTT GRC Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build NTT GRC Hub — a SvelteKit + PostgreSQL demo of an "Agentic GRC Operating System" with 20 modules, 10 named agents, 35+ compliance frameworks, and 3 hero tenants (Maybank SG, MINDEF, Grab Fintech APAC). Reference spec: `docs/superpowers/specs/2026-05-29-ntt-grc-hub-design.md`.

**Architecture:** SvelteKit 2 + Svelte 5 runes + TypeScript on the front, Tailwind 3 with custom emerald/slate tokens for branding, PostgreSQL 16 multi-schema design with hash-chained evidence/audit, hand-built SVG charts for zero JS runtime cost. Mirrors the proven `ntt-cloud-control` pattern; dual-mode mock fixtures (default) → Postgres-backed (env flag) data dispatcher.

**Tech Stack:** SvelteKit 2, Svelte 5, TypeScript 5.6, Tailwind 3, Lucide-svelte, PostgreSQL 16, pg, Vite 5, Docker. Port 5182.

---

## File Structure

```
ntt-grc-hub/
├── package.json, svelte.config.js, vite.config.ts, tsconfig.json
├── tailwind.config.ts, postcss.config.js
├── Dockerfile, docker-compose.yml, .gitignore, .env.example
├── README.md
├── docs/superpowers/{specs,plans}/...
├── db/{init.sql, seed.sql, README.md}
├── static/{favicon.svg, logos/ntt-grc-hub.svg, logos/ntt-data-logo.png}
├── scripts/{test-shims/loader.mjs}
└── src/
    ├── app.css, app.html, app.d.ts, hooks.server.ts
    ├── lib/
    │   ├── components/      # 25 reusable components (Sidebar, charts, agent UI)
    │   ├── data/            # Mock data per domain (single source of truth)
    │   ├── server/          # data dispatcher, pg pool, SSE bus
    │   ├── stores/          # auth, tenant, sidebar, toast
    │   └── utils/           # fair MC, hash chain, csv, dates
    └── routes/
        ├── +layout.{svelte,server.ts}, +page.{svelte,server.ts}
        ├── api/events/+server.ts
        ├── login/
        ├── board/, stream/, tenants-compare/
        ├── risk/, heatmap/, issues/, resilience/
        ├── frameworks/, controls/, evidence/, audits/, regwatch/, policies/
        ├── vendors/, questionnaires/, fourth-party/
        ├── privacy/, esg/, ai-gov/, sox/, bcm/
        ├── agents/, decisions/, workflows/, connectors/
        └── admin/{tenants,users,audit,settings}/
```

Each route folder has at minimum `+page.svelte` (UI) and `+page.server.ts` (loader). Component files are single-responsibility (Sidebar.svelte = sidebar nav only; Heatmap5x5.svelte = the heatmap SVG only).

---

## Phase 1 — Foundation (project scaffold + design system)

### Task 1.1: Initialize SvelteKit project structure

**Files:**
- Create: `package.json`
- Create: `svelte.config.js`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "ntt-grc-hub",
  "version": "1.0.0",
  "description": "NTT GRC Hub - Agentic GRC Operating System (Demo)",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite dev --port 5182 --host",
    "build": "vite build",
    "preview": "vite preview --port 5182",
    "start": "node build/index.js",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "db:init": "psql -U $(whoami) -d postgres -f db/init.sql",
    "db:seed": "psql -U $(whoami) -d ntt_grc_hub -f db/seed.sql",
    "docker:build": "docker build -t ntt-grc-hub:latest .",
    "docker:up": "docker compose up -d --build",
    "docker:down": "docker compose down"
  },
  "devDependencies": {
    "@sveltejs/adapter-node": "^5.5.4",
    "@sveltejs/kit": "^2.8.0",
    "@sveltejs/vite-plugin-svelte": "^4.0.4",
    "@tailwindcss/forms": "^0.5.9",
    "@tailwindcss/typography": "^0.5.15",
    "@types/node": "^22.7.5",
    "@types/pg": "^8.20.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "svelte": "^5.0.0",
    "svelte-check": "^4.0.0",
    "tailwindcss": "^3.4.14",
    "typescript": "^5.6.3",
    "vite": "^5.4.10"
  },
  "dependencies": {
    "dotenv": "^17.4.2",
    "lucide-svelte": "^0.460.0",
    "pg": "^8.13.0"
  }
}
```

- [ ] **Step 2: Write `svelte.config.js`**

```js
import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: { adapter: adapter() }
};
```

- [ ] **Step 3: Write `vite.config.ts`**

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: { port: 5182, host: true }
});
```

- [ ] **Step 4: Write `tsconfig.json`**

```json
{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "strict": true,
    "moduleResolution": "bundler"
  }
}
```

- [ ] **Step 5: Write `.gitignore`**

```
node_modules
.svelte-kit
build
.env
.env.local
*.log
.DS_Store
```

- [ ] **Step 6: Write `.env.example`**

```
DATA_MODE=mock              # mock | pg
DATABASE_URL=postgres://localhost:5432/ntt_grc_hub
SESSION_SECRET=demo-secret-rotate-in-prod
TSUZUMI_ENDPOINT=stub
NODE_ENV=development
```

- [ ] **Step 7: Install and verify**

Run: `cd /Users/lawrence/Development/ntt-grc-hub && npm install`
Expected: clean install; no errors.

- [ ] **Step 8: Commit**

```bash
git init && git add . && git commit -m "chore: scaffold sveltekit project"
```

---

### Task 1.2: Configure Tailwind with emerald/slate design tokens

**Files:**
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `src/app.css`
- Create: `src/app.html`
- Create: `src/app.d.ts`

- [ ] **Step 1: Write `tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';

export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        grc: {
          primary: '#047857',
          'primary-dark': '#065f46',
          'primary-light': '#10b981',
          accent: '#34d399',
          sidebar: '#0f172a',
          'sidebar-2': '#1e293b',
          risk: '#f59e0b',
          critical: '#e11d48',
          agent: '#a855f7',
          ink: '#0f172a'
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f8fafc',
          sunken: '#f1f5f9'
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace']
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(15, 23, 42, 0.04), 0 1px 4px 0 rgba(15, 23, 42, 0.04)',
        'card-hover': '0 4px 14px 0 rgba(15, 23, 42, 0.08)',
        glow: '0 0 24px 0 rgba(16, 185, 129, 0.25)'
      }
    }
  },
  plugins: [forms, typography]
} satisfies Config;
```

- [ ] **Step 2: Write `postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};
```

- [ ] **Step 3: Write `src/app.css`** — full component layer with emerald-tuned classes

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html, body, #svelte { height: 100%; }
  body {
    background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
    color: #0f172a;
  }
}

@layer components {
  .card { @apply rounded-xl border border-slate-200 bg-white shadow-card; }
  .card-hover { @apply transition-shadow hover:shadow-card-hover; }
  .card-elevated { @apply rounded-xl border border-slate-200 bg-white shadow-card-hover; }

  .btn { @apply inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1; }
  .btn-primary { @apply btn bg-grc-primary text-white hover:bg-grc-primary-dark focus:ring-grc-primary/40; }
  .btn-secondary { @apply btn border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-300; }
  .btn-ghost { @apply btn text-slate-600 hover:bg-slate-100; }
  .btn-danger { @apply btn bg-grc-critical text-white hover:bg-rose-700 focus:ring-grc-critical/40; }

  .tag { @apply inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium; }
  .tag-emerald { @apply tag bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200; }
  .tag-blue    { @apply tag bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200; }
  .tag-green   { @apply tag bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200; }
  .tag-amber   { @apply tag bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200; }
  .tag-red     { @apply tag bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200; }
  .tag-slate   { @apply tag bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200; }
  .tag-violet  { @apply tag bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200; }

  .kpi-num { @apply font-mono text-2xl font-semibold tracking-tight text-grc-ink; }
  .section-title { @apply text-sm font-semibold uppercase tracking-wider text-slate-500; }
  .input { @apply block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-grc-primary focus:ring-1 focus:ring-grc-primary; }
  .thead { @apply bg-surface-muted text-xs font-semibold uppercase tracking-wider text-slate-500; }
  .td { @apply whitespace-nowrap px-4 py-3 text-sm text-slate-700; }
  .tr { @apply border-t border-slate-100 hover:bg-slate-50/60; }

  .agent-card {
    @apply card relative overflow-hidden;
    background: linear-gradient(135deg, #ffffff 0%, #ffffff 60%, rgba(16,185,129,0.04) 100%);
  }
  .agent-card::before {
    content: '';
    position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
    background: linear-gradient(180deg, #a855f7 0%, #10b981 100%);
  }
  .evidence-chip { @apply inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-700; }
}

@layer utilities {
  .scrollbar-thin::-webkit-scrollbar { height: 6px; width: 6px; }
  .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(15, 23, 42, 0.18); border-radius: 3px; }
  .sidebar-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.2) transparent; }
  .sidebar-scroll::-webkit-scrollbar { width: 4px; }
  .sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }

  .text-balance { text-wrap: balance; }
  .bg-classified-banner { background: repeating-linear-gradient(45deg, #b91c1c 0 12px, #991b1b 12px 24px); }
}
```

- [ ] **Step 4: Write `src/app.html`**

```html
<!doctype html>
<html lang="en" class="h-full">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%sveltekit.assets%/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>NTT GRC Hub</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
    %sveltekit.head%
  </head>
  <body class="h-full font-sans antialiased">
    <div id="svelte">%sveltekit.body%</div>
  </body>
</html>
```

- [ ] **Step 5: Write `src/app.d.ts`**

```ts
declare global {
  namespace App {
    interface Locals {
      user?: { id: string; email: string; name: string; role: string; tenantId: string };
      tenantId?: string;
    }
    interface PageData {}
    interface Error {}
    interface Platform {}
  }
}
export {};
```

- [ ] **Step 6: Write `static/favicon.svg`** — emerald shield with circuit node

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>
  </defs>
  <path d="M32 4 L56 14 V32 C56 46 44 56 32 60 C20 56 8 46 8 32 V14 Z" fill="url(#g)"/>
  <circle cx="32" cy="30" r="6" fill="#0f172a"/>
  <path d="M32 24 V14 M32 36 V46 M26 30 H16 M38 30 H48" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/>
</svg>
```

- [ ] **Step 7: Verify dev server boots**

Run: `npm run dev`
Expected: Vite serves on http://localhost:5182 (will 404 routes — only `+layout`/`+page` not built yet). Stop server with `q`.

- [ ] **Step 8: Commit**

```bash
git add tailwind.config.ts postcss.config.js src/app.css src/app.html src/app.d.ts static/favicon.svg
git commit -m "feat: tailwind config + emerald/slate design tokens"
```

---

### Task 1.3: Build the Logo, Sidebar, TopBar, app shell

**Files:**
- Create: `src/lib/components/Logo.svelte`
- Create: `src/lib/components/NavConfig.ts`
- Create: `src/lib/components/Sidebar.svelte`
- Create: `src/lib/components/TopBar.svelte`
- Create: `src/lib/components/TenantSwitcher.svelte`
- Create: `src/lib/stores/sidebar.ts`
- Create: `src/lib/stores/tenant.ts`
- Create: `src/lib/stores/auth.ts`
- Create: `src/lib/stores/toast.ts`
- Create: `src/routes/+layout.svelte`
- Create: `src/routes/+layout.server.ts`

- [ ] **Step 1: `src/lib/stores/sidebar.ts`**

```ts
import { writable } from 'svelte/store';
export const sidebarOpen = writable(true);
```

- [ ] **Step 2: `src/lib/stores/tenant.ts`**

```ts
import { writable } from 'svelte/store';

export interface TenantSummary {
  id: string;
  name: string;
  industry: string;
  region: string;
  classified?: boolean;
  primaryFramework: string;
}

export const ALL_TENANTS_ID = '__all__';

export const currentTenantId = writable<string>(ALL_TENANTS_ID);
```

- [ ] **Step 3: `src/lib/stores/auth.ts`**

```ts
import { writable } from 'svelte/store';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'risk-owner' | 'control-owner' | 'auditor' | 'agent-operator' | 'viewer';
}

export const user = writable<AppUser | null>(null);
```

- [ ] **Step 4: `src/lib/stores/toast.ts`**

```ts
import { writable } from 'svelte/store';

export interface Toast {
  id: number;
  kind: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

const _toasts = writable<Toast[]>([]);
let _id = 0;

export const toasts = { subscribe: _toasts.subscribe };

export function addToast(kind: Toast['kind'], message: string, ttl = 4000) {
  const id = ++_id;
  _toasts.update((t) => [...t, { id, kind, message }]);
  setTimeout(() => _toasts.update((t) => t.filter((x) => x.id !== id)), ttl);
}
```

- [ ] **Step 5: `src/lib/components/Logo.svelte`**

```svelte
<script lang="ts">
  export let variant: 'light' | 'dark' = 'light';
  export let compact = false;
</script>

<a href="/" class="inline-flex items-center gap-2 select-none">
  <svg viewBox="0 0 64 64" class="h-6 w-6">
    <defs>
      <linearGradient id="logoG" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#10b981"/>
        <stop offset="100%" stop-color="#047857"/>
      </linearGradient>
    </defs>
    <path d="M32 4 L56 14 V32 C56 46 44 56 32 60 C20 56 8 46 8 32 V14 Z" fill="url(#logoG)"/>
    <circle cx="32" cy="30" r="6" fill={variant === 'light' ? '#0f172a' : '#ffffff'}/>
    <path d="M32 24 V14 M32 36 V46 M26 30 H16 M38 30 H48"
          stroke={variant === 'light' ? '#0f172a' : '#ffffff'} stroke-width="2.5" stroke-linecap="round"/>
  </svg>
  {#if !compact}
    <div class="flex flex-col leading-tight">
      <span class="text-sm font-semibold tracking-tight {variant === 'light' ? 'text-white' : 'text-grc-ink'}">NTT GRC HUB</span>
      <span class="text-[10px] font-medium uppercase tracking-wider {variant === 'light' ? 'text-emerald-300' : 'text-grc-primary'}">Agentic GRC OS</span>
    </div>
  {/if}
</a>
```

- [ ] **Step 6: `src/lib/components/NavConfig.ts`** — all 20 modules across 6 sections

```ts
import {
  LayoutDashboard, FileBarChart, Radio, Building2,
  AlertTriangle, Grid3x3, ListChecks, ShieldAlert,
  Library, ShieldCheck, FileLock2, ClipboardCheck, Antenna, ScrollText,
  Building, FileQuestion, GitFork,
  UserLock, Leaf, BrainCircuit, Calculator, LifeBuoy,
  Bot, History, Workflow, Plug,
  Users, KeyRound, FileSearch, Settings,
  type Icon
} from 'lucide-svelte';

export interface NavItem { label: string; href: string; icon: typeof Icon; badge?: string; }
export interface NavSection { title: string; items: NavItem[]; }

export const navSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Risk Cockpit', href: '/', icon: LayoutDashboard },
      { label: 'Board Pack', href: '/board', icon: FileBarChart },
      { label: 'Agent Stream', href: '/stream', icon: Radio, badge: 'LIVE' },
      { label: 'Tenant Compare', href: '/tenants-compare', icon: Building2, badge: 'MSSP' }
    ]
  },
  {
    title: 'Enterprise Risk',
    items: [
      { label: 'ERM Register', href: '/risk', icon: AlertTriangle },
      { label: 'Heatmap & FAIR', href: '/heatmap', icon: Grid3x3 },
      { label: 'Issues & Incidents', href: '/issues', icon: ListChecks },
      { label: 'Op Resilience', href: '/resilience', icon: ShieldAlert, badge: 'DORA' }
    ]
  },
  {
    title: 'Compliance',
    items: [
      { label: 'Frameworks', href: '/frameworks', icon: Library, badge: '35+' },
      { label: 'Controls', href: '/controls', icon: ShieldCheck },
      { label: 'Evidence Vault', href: '/evidence', icon: FileLock2 },
      { label: 'Audit Mgmt', href: '/audits', icon: ClipboardCheck },
      { label: 'Reg Horizon', href: '/regwatch', icon: Antenna, badge: 'AI' },
      { label: 'Policy Mgmt', href: '/policies', icon: ScrollText }
    ]
  },
  {
    title: 'Third-Party',
    items: [
      { label: 'Vendors / TPRM', href: '/vendors', icon: Building },
      { label: 'Questionnaires', href: '/questionnaires', icon: FileQuestion },
      { label: '4th-Party Map', href: '/fourth-party', icon: GitFork }
    ]
  },
  {
    title: 'Specialized',
    items: [
      { label: 'Privacy', href: '/privacy', icon: UserLock },
      { label: 'ESG', href: '/esg', icon: Leaf },
      { label: 'AI Governance', href: '/ai-gov', icon: BrainCircuit, badge: 'ISO 42001' },
      { label: 'SOX', href: '/sox', icon: Calculator },
      { label: 'BCM / DR', href: '/bcm', icon: LifeBuoy }
    ]
  },
  {
    title: 'Agentic OS',
    items: [
      { label: 'Agent Fleet', href: '/agents', icon: Bot, badge: '10' },
      { label: 'Decisions', href: '/decisions', icon: History },
      { label: 'Workflows', href: '/workflows', icon: Workflow },
      { label: 'Connectors', href: '/connectors', icon: Plug, badge: '40+' }
    ]
  },
  {
    title: 'Admin',
    items: [
      { label: 'Tenants', href: '/admin/tenants', icon: Building2 },
      { label: 'Users & RBAC', href: '/admin/users', icon: Users },
      { label: 'Audit Log', href: '/admin/audit', icon: FileSearch },
      { label: 'Settings', href: '/admin/settings', icon: Settings }
    ]
  }
];
```

- [ ] **Step 7: `src/lib/components/Sidebar.svelte`**

```svelte
<script lang="ts">
  import { page } from '$app/stores';
  import { navSections } from './NavConfig';
  import Logo from './Logo.svelte';
  import { sidebarOpen } from '$lib/stores/sidebar';
  import { ChevronLeft } from 'lucide-svelte';

  $: pathname = $page.url.pathname;
  function isActive(href: string, current: string) {
    if (href === '/') return current === '/';
    return current === href || current.startsWith(href + '/');
  }
</script>

<aside class="flex h-full flex-col bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white transition-all duration-200 {$sidebarOpen ? 'w-64' : 'w-16'}">
  <div class="flex h-16 items-center justify-between border-b border-white/10 px-4">
    {#if $sidebarOpen}
      <Logo variant="light" />
    {:else}
      <Logo variant="light" compact />
    {/if}
    <button class="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"
            on:click={() => sidebarOpen.update((v) => !v)} aria-label="Toggle sidebar">
      <ChevronLeft class="h-4 w-4 transition-transform {!$sidebarOpen ? 'rotate-180' : ''}" />
    </button>
  </div>
  <nav class="sidebar-scroll flex-1 space-y-5 overflow-y-auto px-2 py-4">
    {#each navSections as section}
      <div>
        {#if $sidebarOpen}
          <div class="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-white/40">{section.title}</div>
        {/if}
        <ul class="space-y-0.5">
          {#each section.items as item}
            {@const active = isActive(item.href, pathname)}
            <li>
              <a href={item.href}
                 class="group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all {active
                   ? 'bg-gradient-to-r from-emerald-500/15 to-emerald-500/5 font-semibold text-white shadow-sm ring-1 ring-inset ring-emerald-400/30'
                   : 'font-medium text-white/65 hover:bg-white/10 hover:text-white'}"
                 title={!$sidebarOpen ? item.label : undefined}>
                {#if active}
                  <span class="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-grc-accent shadow-[0_0_8px_rgba(52,211,153,0.6)]" aria-hidden="true"></span>
                {/if}
                <svelte:component this={item.icon} class="h-4 w-4 flex-shrink-0 {active ? 'text-grc-accent' : 'text-white/60 group-hover:text-white/90'}" />
                {#if $sidebarOpen}
                  <span class="flex-1 truncate">{item.label}</span>
                  {#if item.badge}
                    <span class="rounded-full px-1.5 py-0.5 text-[10px] font-semibold {active ? 'bg-grc-accent text-slate-900' : 'bg-grc-accent/20 text-grc-accent'}">{item.badge}</span>
                  {/if}
                {/if}
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  </nav>
  <div class="border-t border-white/10 px-3 py-3 text-[11px] text-white/40">
    {#if $sidebarOpen}
      <div class="flex items-center justify-between">
        <span>v1.0.0-demo</span>
        <span class="rounded bg-emerald-500/15 px-1.5 py-0.5 font-semibold text-emerald-300">LIVE</span>
      </div>
      <div class="mt-1 text-white/30">© 2026 NTT Singapore. Demo build.</div>
    {:else}
      <span class="block text-center">v1</span>
    {/if}
  </div>
</aside>
```

- [ ] **Step 8: `src/lib/components/TenantSwitcher.svelte`**

```svelte
<script lang="ts">
  import { currentTenantId, ALL_TENANTS_ID, type TenantSummary } from '$lib/stores/tenant';
  import { ChevronDown, Building2, ShieldAlert } from 'lucide-svelte';
  export let tenants: TenantSummary[] = [];
  let open = false;

  $: current = tenants.find((t) => t.id === $currentTenantId);
  $: label = current?.name ?? 'All Tenants';
  $: classified = current?.classified === true;
</script>

<div class="relative">
  <button class="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          on:click={() => (open = !open)}>
    <Building2 class="h-4 w-4 text-grc-primary" />
    <span>{label}</span>
    {#if classified}<ShieldAlert class="h-4 w-4 text-rose-500" />{/if}
    <ChevronDown class="h-3.5 w-3.5 text-slate-400" />
  </button>
  {#if open}
    <div class="absolute left-0 z-40 mt-1 w-72 rounded-lg border border-slate-200 bg-white shadow-lg">
      <button class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
              on:click={() => { currentTenantId.set(ALL_TENANTS_ID); open = false; }}>
        <span class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">MSSP</span>
        <span class="flex-1 font-medium">All Tenants (rollup)</span>
      </button>
      <div class="border-t border-slate-100"></div>
      {#each tenants as t}
        <button class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                on:click={() => { currentTenantId.set(t.id); open = false; }}>
          <div class="flex-1">
            <div class="font-medium text-slate-900">{t.name}</div>
            <div class="text-xs text-slate-500">{t.industry} · {t.region} · {t.primaryFramework}</div>
          </div>
          {#if t.classified}<span class="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-700 ring-1 ring-inset ring-rose-200">Sovereign</span>{/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
```

- [ ] **Step 9: `src/lib/components/TopBar.svelte`**

```svelte
<script lang="ts">
  import TenantSwitcher from './TenantSwitcher.svelte';
  import type { TenantSummary } from '$lib/stores/tenant';
  import { Search, Bot, Bell, Settings } from 'lucide-svelte';
  export let tenants: TenantSummary[] = [];
  export let liveAgents = 0;
</script>

<header class="flex h-16 items-center gap-4 border-b border-slate-200 bg-white px-6">
  <TenantSwitcher {tenants} />
  <div class="relative ml-2 flex-1 max-w-xl">
    <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    <input class="input pl-9" placeholder="Search risks, controls, evidence, agents…  (⌘K)" />
  </div>
  <div class="flex items-center gap-3">
    <div class="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
      <span class="relative flex h-2 w-2">
        <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
        <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
      </span>
      <Bot class="h-3.5 w-3.5" />
      <span>{liveAgents} agents live</span>
    </div>
    <button class="btn-ghost p-2"><Bell class="h-4 w-4" /></button>
    <button class="btn-ghost p-2"><Settings class="h-4 w-4" /></button>
    <div class="ml-1 flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm">
      <div class="h-6 w-6 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-center font-mono text-xs leading-6 text-white">LK</div>
      <span class="hidden text-slate-700 sm:inline">Lawrence Khoo</span>
    </div>
  </div>
</header>
```

- [ ] **Step 10: `src/routes/+layout.server.ts`** — load tenants and live-agent count

```ts
import type { LayoutServerLoad } from './$types';
import { getTenantSummaries, getLiveAgentCount } from '$lib/server/data';

export const load: LayoutServerLoad = async () => {
  return {
    tenants: await getTenantSummaries(),
    liveAgents: await getLiveAgentCount()
  };
};
```

- [ ] **Step 11: `src/routes/+layout.svelte`**

```svelte
<script lang="ts">
  import '../app.css';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  export let data;
</script>

<div class="flex h-full">
  <Sidebar />
  <div class="flex flex-1 flex-col overflow-hidden">
    <TopBar tenants={data.tenants} liveAgents={data.liveAgents} />
    <main class="flex-1 overflow-y-auto px-6 py-6">
      <slot />
    </main>
  </div>
</div>
```

- [ ] **Step 12: Commit**

```bash
git add src/
git commit -m "feat: app shell — sidebar, topbar, tenant switcher, stores"
```

---

## Phase 2 — Database Design

### Task 2.1: Write `db/init.sql` — schemas, enums, platform & risk tables

**Files:**
- Create: `db/init.sql` (sections 1–6 of 12 — written across Tasks 2.1–2.4)

- [ ] **Step 1: Write `db/init.sql` opening + platform + risk + control schemas**

The opening section mirrors ntt-cloud-control's pattern (drop/create db, extensions, schemas) but with the GRC schema set listed in spec §7.1. Reference the spec file for the full schema list. Include for this task:

- DROP/CREATE DATABASE `ntt_grc_hub`
- `CREATE EXTENSION uuid-ossp, pgcrypto, vector` (vector optional, falls back gracefully)
- All 20 schemas (`platform`, `risk`, `control`, `compliance`, `evidence`, `audit`, `policy`, `vendor`, `privacy`, `esg`, `ai_gov`, `incident`, `issue`, `bcm`, `regwatch`, `agent`, `workflow`, `integration`)
- Enums: `platform.role` (admin, risk-owner, control-owner, auditor, agent-operator, viewer), `risk.severity` (critical, high, medium, low, info), `risk.likelihood` (rare, unlikely, possible, likely, almost-certain), `risk.treatment_strategy` (accept, mitigate, transfer, avoid), `control.maturity` (initial, developing, defined, managed, optimised), `control.test_result` (pass, fail, partial, na), `compliance.assessment_status` (not-started, in-progress, complete, expired), `agent.type` (deterministic, ai-powered, intelligent), `agent.run_status` (queued, running, success, failed, halted, awaiting-approval), `agent.decision_outcome` (auto-approved, awaiting-hitl, hitl-approved, hitl-rejected), `evidence.kind` (screenshot, log, config, attestation, document, scan-result, api-response), `audit.engagement_type` (internal, external, regulatory, customer), `incident.severity` (sev1, sev2, sev3, sev4)
- `platform.tenants` (id TEXT PK, name, industry, region, classified BOOL, sla_tier, primary_framework TEXT, headquartered_in TEXT, mrr_sgd NUMERIC, created_at)
- `platform.users`, `platform.sessions`, `platform.api_tokens`, `platform.audit_log` (with hash chain `prev_hash` / `row_hash`)
- `risk.registers`, `risk.risks` (tenant_id, register_id, code, title, description, category, owner_user_id, inherent_severity, inherent_likelihood, residual_severity, residual_likelihood, status, treatment_strategy, last_assessed_at, next_review_at, business_service TEXT, jsonb tags)
- `risk.treatments`, `risk.scenarios` (FAIR scenarios with frequency/magnitude distributions in JSONB), `risk.fair_runs` (run output: 10000-trial array compressed into LEC percentiles JSONB, ALE, ARO)
- `risk.appetite_statements` (per category, threshold)
- `control.library` (id, code, title, description, type technical/process/admin, family JSON, owner_user_id, frequency, automated BOOLEAN), `control.mappings` (control_id, framework_id, requirement_id, coverage 0-100), `control.tests` (control_id, name, kind manual/automated, schedule_cron), `control.test_runs` (control_id, test_id, ran_at, result control.test_result, evidence_item_id, agent_run_id), `control.exceptions`

End the file with `\echo ' >> platform/risk/control schemas created'` so output is observable.

Write this all in one `db/init.sql` file; total ~480 lines for this task. The exact column lists above must be implemented as `CREATE TABLE` statements with appropriate types, FKs, NOT NULL where natural, indexes on `(tenant_id, …)`.

- [ ] **Step 2: Validate SQL parses**

Run: `psql -U $(whoami) -d postgres -c "DROP DATABASE IF EXISTS ntt_grc_hub_check;"`
Then: `createdb ntt_grc_hub_check && psql -d ntt_grc_hub_check -f db/init.sql && dropdb ntt_grc_hub_check`
Expected: no SQL errors. If a missing-extension error appears for `vector`, comment that extension line.

- [ ] **Step 3: Commit**

```bash
git add db/init.sql
git commit -m "feat(db): platform/risk/control schemas"
```

---

### Task 2.2: Extend `db/init.sql` — compliance, evidence, audit, policy, vendor

- [ ] **Step 1: Append to `db/init.sql`**

Add to the same file:

- `compliance.frameworks` (id, name, version, regulator, region, total_requirements INT, jurisdiction TEXT, tags JSONB)
- `compliance.requirements` (framework_id FK, code, title, description, parent_requirement_id, weight NUMERIC)
- `compliance.assessments` (tenant_id, framework_id, status, score NUMERIC, started_at, completed_at, next_due_at, assessor_user_id)
- `compliance.gaps` (assessment_id, requirement_id, severity, remediation_plan TEXT, target_date)
- `compliance.attestations` (tenant_id, framework_id, signed_by_user_id, signed_at, valid_until, attestation_text)
- `evidence.collectors` (id, name, kind aws/azure/gcp/okta/jira/m365/manual, schedule_cron, last_run_at)
- `evidence.items` (id BIGSERIAL, tenant_id, collector_id, control_id NULL, kind evidence.kind, title, source_url, blob_url, captured_at, agent_run_id, jsonb metadata)
- `evidence.seals` (item_id PK, prev_hash, row_hash, sealed_at) — hash chain
- `evidence.attachments` (item_id, filename, mime_type, size_bytes, sha256)
- `audit.engagements` (tenant_id, name, type audit.engagement_type, lead_auditor, opened_at, closed_at, scope TEXT)
- `audit.findings` (engagement_id, severity, title, description, control_id NULL, due_at, status open/closed/accepted-risk)
- `audit.workpapers` (engagement_id, title, content_md TEXT, created_by, created_at)
- `policy.documents` (tenant_id, code, title, owner_user_id, jurisdiction, current_version_id)
- `policy.versions` (document_id, version_no, content_md TEXT, status draft/in-review/approved/retired, effective_at, drafted_by_agent_id NULL)
- `policy.acknowledgements` (version_id, user_id, acknowledged_at)
- `policy.exceptions` (document_id, requester_user_id, justification, granted, expires_at)
- `vendor.vendors` (tenant_id, name, category, tier 1/2/3/4, criticality critical/high/medium/low, hq_country, primary_contact_email, status active/onboarding/offboarded, jsonb tags)
- `vendor.contracts` (vendor_id, contract_no, value_sgd NUMERIC, starts_at, ends_at, renewal_window_days)
- `vendor.questionnaires` (vendor_id, template SIG/CAIQ/Custom, status sent/in-progress/complete, sent_at, completed_at, completed_by_agent_id NULL, score NUMERIC)
- `vendor.responses` (questionnaire_id, question_code, response TEXT, confidence NUMERIC, source_evidence_item_id NULL)
- `vendor.fourth_parties` (vendor_id, name, type cloud/saas/processor, region, criticality)
- `vendor.concentrations` (tenant_id, dimension cloud/region/processor, key TEXT, vendor_count INT, exposure_sgd NUMERIC, computed_at)

Each table includes `tenant_id` FK to `platform.tenants(id)` and `created_at TIMESTAMPTZ DEFAULT now()`. Add indexes on `(tenant_id)` for every table that has it.

- [ ] **Step 2: Validate**

Run: `dropdb --if-exists ntt_grc_hub_check && createdb ntt_grc_hub_check && psql -d ntt_grc_hub_check -f db/init.sql && dropdb ntt_grc_hub_check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add db/init.sql
git commit -m "feat(db): compliance/evidence/audit/policy/vendor schemas"
```

---

### Task 2.3: Extend `db/init.sql` — privacy, esg, ai_gov, incident, issue, bcm, regwatch

- [ ] **Step 1: Append**

- `privacy.processing_activities` (tenant_id, code, name, controller, processor, purpose, lawful_basis, data_categories TEXT[], retention_period, cross_border BOOLEAN, jurisdictions TEXT[])
- `privacy.dpias` (activity_id, status, residual_risk_severity, conducted_by, conducted_at, jsonb assessment)
- `privacy.subject_requests` (tenant_id, kind access/erasure/portability/objection/rectification, requester_email, received_at, due_at, status, resolved_at, jsonb metadata)
- `privacy.breaches` (tenant_id, code, severity, occurred_at, detected_at, reported_at, affected_subjects INT, regulator_notified BOOLEAN, root_cause TEXT)
- `esg.metrics` (tenant_id, period, scope scope1/scope2/scope3, category, metric, value NUMERIC, unit, framework CSRD/ISSB/GHG)
- `esg.disclosures` (tenant_id, framework, period, status, published_at, jsonb content)
- `esg.targets` (tenant_id, framework, metric, baseline_value, baseline_period, target_value, target_period, owner_user_id)
- `ai_gov.models` (tenant_id, name, kind classifier/llm/regression/vision/recommender, owner_user_id, risk_tier minimal/limited/high/unacceptable, jurisdiction, eu_ai_act_class, iso_42001_status compliant/in-progress/non-compliant)
- `ai_gov.model_risk` (model_id, risk_type bias/hallucination/drift/explainability/privacy, severity, mitigation TEXT)
- `ai_gov.prompts_audit` (id BIGSERIAL, tenant_id, model_id, agent_run_id NULL, user_id NULL, prompt_redacted TEXT, response_redacted TEXT, tokens_in INT, tokens_out INT, cost_cents INT, captured_at TIMESTAMPTZ)
- `incident.incidents` (tenant_id, code, severity incident.severity, title, status open/contained/resolved/postmortem-done, opened_at, contained_at, resolved_at, owner_user_id, jsonb tags)
- `incident.timeline_events` (incident_id, ts, actor, event TEXT, source agent/human/system)
- `incident.postmortems` (incident_id, root_cause_md TEXT, corrective_actions_md TEXT, drafted_by_agent_id NULL, signed_off_by_user_id NULL)
- `issue.issues` (tenant_id, source audit/risk-treatment/incident/control-test/regulatory, source_id TEXT, title, severity, status open/in-progress/resolved/accepted-risk, owner_user_id, due_at)
- `issue.actions` (issue_id, description, owner_user_id, due_at, status not-started/in-progress/done)
- `bcm.plans` (tenant_id, name, business_service, owner_user_id, rto_minutes INT, rpo_minutes INT, last_tested_at, next_test_at)
- `bcm.bias` (plan_id, dependency_kind people/tech/site/vendor, name, criticality, downtime_tolerance_hours INT)
- `bcm.tests` (plan_id, kind tabletop/walkthrough/simulation/full-failover, conducted_at, result pass/partial/fail, lessons_md TEXT)
- `bcm.scenarios` (id, name, description, severity, jsonb assumptions)
- `regwatch.sources` (id, regulator_code MAS/APRA/EU/OJK/RBI/etc., source_url, jurisdiction, last_scanned_at)
- `regwatch.changes` (id, source_id, title, summary TEXT, published_at, effective_at, severity, detected_by_agent_id, jsonb raw)
- `regwatch.impact_assessments` (change_id, tenant_id, framework_id NULL, impact none/low/medium/high, gaps_opened INT, assessed_by_agent_id, assessed_at)
- `regwatch.mappings` (change_id, framework_id, requirement_id, action mapped/superseded/new)

- [ ] **Step 2: Validate & commit**

Run the same validate cycle as Task 2.2.

```bash
git add db/init.sql
git commit -m "feat(db): privacy/esg/ai-gov/incident/issue/bcm/regwatch schemas"
```

---

### Task 2.4: Extend `db/init.sql` — agent, workflow, integration; views

- [ ] **Step 1: Append agent + workflow + integration tables**

- `agent.agents` (id TEXT PK, name, slug, description TEXT, type agent.type, status idle/running/paused/error, owner_team, cost_per_run_cents INT, cost_monthly_estimate_cents INT, fte_equivalent NUMERIC, created_at)
- `agent.runs` (id BIGSERIAL, tenant_id, agent_id FK, trigger cron/manual/event, started_at, ended_at, status agent.run_status, input_summary TEXT, output_summary TEXT, tools_called TEXT[], cost_cents INT, latency_ms INT, jsonb context)
- `agent.decisions` (id BIGSERIAL, agent_id, run_id, decision_type TEXT, input JSONB, output JSONB, confidence NUMERIC, outcome agent.decision_outcome, approver_user_id NULL, decided_at)
- `agent.approvals` (decision_id, approver_user_id, approved BOOLEAN, rationale, decided_at)
- `agent.tools` (agent_id, tool_name, tool_kind api/db/llm/search/script, description TEXT)
- `agent.telemetry` (id BIGSERIAL, agent_id, ts TIMESTAMPTZ, metric runs/errors/latency_p50/latency_p95/cost_cents, value NUMERIC)
- `agent.cost_ledger` (id BIGSERIAL, tenant_id, agent_id, ts, runs INT, cost_cents INT, fte_saved_hours NUMERIC)
- `workflow.definitions` (tenant_id, name, description, jsonb steps, last_modified_by, version INT)
- `workflow.executions` (workflow_id, tenant_id, trigger, started_at, ended_at, status running/success/failed/halted)
- `workflow.steps` (execution_id, step_no, kind agent/api/manual/decision, ref_id TEXT, status, started_at, ended_at, jsonb output)
- `workflow.approvals` (execution_id, step_no, approver_user_id, approved BOOLEAN, decided_at)
- `integration.connectors` (tenant_id, kind aws/azure/gcp/okta/jira/m365/servicenow/slack/github/etc., name, status connected/degraded/disconnected, last_sync_at, jsonb config)
- `integration.sync_jobs` (connector_id, started_at, ended_at, status, records_ingested INT, errors INT)
- `integration.credentials_meta` (connector_id, key_id TEXT, scope, rotated_at)

- [ ] **Step 2: Append views**

```sql
CREATE OR REPLACE VIEW compliance.framework_score AS
SELECT a.tenant_id, a.framework_id, f.name, f.version, f.region, a.status, a.score, a.next_due_at
FROM compliance.assessments a JOIN compliance.frameworks f ON f.id = a.framework_id;

CREATE OR REPLACE VIEW risk.heatmap_cells AS
SELECT tenant_id, residual_severity AS sev, residual_likelihood AS lik, COUNT(*) AS n
FROM risk.risks GROUP BY tenant_id, residual_severity, residual_likelihood;

CREATE OR REPLACE VIEW agent.fleet_summary AS
SELECT a.id, a.name, a.type, a.status,
  COALESCE(SUM(cl.runs), 0) AS runs_30d,
  COALESCE(SUM(cl.cost_cents), 0) AS cost_cents_30d,
  COALESCE(SUM(cl.fte_saved_hours), 0) AS fte_hours_30d
FROM agent.agents a
LEFT JOIN agent.cost_ledger cl ON cl.agent_id = a.id AND cl.ts >= now() - interval '30 days'
GROUP BY a.id;

CREATE OR REPLACE VIEW vendor.tier_breakdown AS
SELECT tenant_id, tier, criticality, COUNT(*) AS n FROM vendor.vendors GROUP BY tenant_id, tier, criticality;
```

- [ ] **Step 3: Validate & commit**

```bash
dropdb --if-exists ntt_grc_hub_check && createdb ntt_grc_hub_check && psql -d ntt_grc_hub_check -f db/init.sql && dropdb ntt_grc_hub_check
git add db/init.sql
git commit -m "feat(db): agent/workflow/integration schemas + dashboard views"
```

---

### Task 2.5: Seed data — `db/seed.sql` for 8 tenants

**Files:**
- Create: `db/seed.sql`

- [ ] **Step 1: Write tenant seed**

INSERT 8 tenants (3 hero + 5 shallow) per spec §6. Use stable text IDs (`t_maybank`, `t_mindef`, `t_grab`, `t_singhealth`, `t_govtech`, `t_astar`, `t_mediacorp`, `t_singtel`). Insert 6 users per tenant with realistic Singaporean/regional names and the 6 RBAC roles.

- [ ] **Step 2: Frameworks seed (35+ rows)**

INSERT all 35 frameworks listed in spec §8. Each row sets `total_requirements` to a realistic count (e.g., ISO 27001:2022 = 93 Annex A + 10 clauses; PCI DSS 4.0 = ~280; NIST 800-53r5 = ~1,000; GDPR = 99 articles).

For 8 hero frameworks (SOC 2, ISO 27001, NIST CSF 2.0, PCI DSS 4.0, MAS TRM, GDPR, DORA, EU AI Act), insert 30–80 child `compliance.requirements` each.

- [ ] **Step 3: Risks, controls, mappings for Maybank (hero tenant)**

For `t_maybank` insert:
- 340 rows in `risk.risks` (use `generate_series` + lookup arrays of realistic risk titles by category — cyber, operational, regulatory, third-party, AI, climate)
- 1,200 rows in `control.library` (deterministic generation: control codes `CT-0001` to `CT-1200`, 35% technical / 40% process / 25% admin)
- ~6,000 rows in `control.mappings` (each control maps to ~5 framework requirements on average)
- 20 named FAIR scenarios in `risk.scenarios` with realistic frequency/magnitude beta distributions; one `risk.fair_runs` per scenario with pre-computed LEC percentiles (10/25/50/75/90/95/99) and an ALE between $200K–$8M

- [ ] **Step 4: Evidence, audits, policies, vendors for Maybank**

- 8,400 rows in `evidence.items` distributed across last 90 days; ~75% with `collector_id`, ~25% manual
- Generate matching `evidence.seals` rows with valid hash chain (use `md5(prev_hash || row_data)` style)
- 12 `audit.engagements` (internal/external/regulatory mix); 80 findings total
- 18 `policy.documents` with `policy.versions` (1–3 versions each)
- 47 `vendor.vendors`; 47 `vendor.questionnaires`; 470 `vendor.responses` (~10 each); 80 `vendor.fourth_parties`; 6 `vendor.concentrations`

- [ ] **Step 5: Specialized + incidents + regwatch for Maybank**

- 24 privacy `processing_activities`, 8 `dpias`, 14 `subject_requests`, 2 `breaches`
- 36 ESG metrics across periods, 4 disclosures, 8 targets
- 6 AI models, 12 model risks, 320 prompts_audit rows
- 14 incidents over 90 days, 6 postmortems
- 47 issues, 120 actions
- 8 BCM plans, 32 BIA dependencies, 24 BCM tests
- 60 regwatch changes over 90 days, 38 impact assessments — include MAS Notice 655 update as the hero scenario from spec §10

- [ ] **Step 6: Agents seed (universal — not tenant-scoped)**

INSERT all 10 agents per spec §5 into `agent.agents` (no tenant filter — agents are platform objects). For each agent: 90 days of `agent.cost_ledger` rows (one per tenant per day), realistic `agent.runs` distribution (Evidence Collector: ~24/day; Regulatory Horizon: ~4/day; Audit Companion: ~2/day; etc.), and `agent.decisions` with believable confidence values and HITL outcomes.

- [ ] **Step 7: Repeat steps 3–6 for MINDEF and Grab tenants**

Use lower volumes for MINDEF (sovereign, tighter scope) and higher cross-jurisdiction counts for Grab. Shallow tenants get only top-level KPI rows (10–30 risks, 100 controls, 5 vendors, no deep evidence).

- [ ] **Step 8: Workflow + connector seed**

- 12 workflow definitions, 200 workflow executions over 90 days
- 40 connectors per hero tenant, mix of statuses (90% connected, 8% degraded, 2% disconnected)

- [ ] **Step 9: Validate & commit**

```bash
dropdb --if-exists ntt_grc_hub_check && createdb ntt_grc_hub_check && psql -d ntt_grc_hub_check -f db/init.sql && psql -d ntt_grc_hub_check -f db/seed.sql && dropdb ntt_grc_hub_check
git add db/seed.sql db/README.md
git commit -m "feat(db): comprehensive seed for 8 tenants (Maybank/MINDEF/Grab + 5 shallow)"
```

(`db/README.md` is a 30-line file documenting how to init/seed/reset.)

---

## Phase 3 — Mock Data Layer

### Task 3.1: Types and mock-data fixtures

**Files:**
- Create: `src/lib/data/types.ts`
- Create: `src/lib/data/mock.ts`
- Create: `src/lib/data/tenants.ts`
- Create: `src/lib/data/agents.ts`
- Create: `src/lib/data/frameworks.ts`
- Create: `src/lib/data/risks.ts`
- Create: `src/lib/data/controls.ts`
- Create: `src/lib/data/evidence.ts`
- Create: `src/lib/data/audits.ts`
- Create: `src/lib/data/policies.ts`
- Create: `src/lib/data/vendors.ts`
- Create: `src/lib/data/specialized.ts`
- Create: `src/lib/data/regwatch.ts`
- Create: `src/lib/data/incidents.ts`

- [ ] **Step 1: `src/lib/data/types.ts`**

Define TypeScript types mirroring DB tables. Each domain has its types: `Tenant`, `User`, `Risk`, `FAIRRun`, `Control`, `ControlTestRun`, `Framework`, `Requirement`, `Assessment`, `EvidenceItem`, `AuditEngagement`, `Finding`, `Policy`, `PolicyVersion`, `Vendor`, `Questionnaire`, `FourthParty`, `PrivacyActivity`, `DPIA`, `SubjectRequest`, `Breach`, `ESGMetric`, `AIModel`, `ModelRisk`, `Incident`, `Issue`, `BCMPlan`, `RegChange`, `Agent`, `AgentRun`, `AgentDecision`, `Connector`, `Workflow`. Use the spec §7 schemas as the column source-of-truth.

Each type matches the DB column names in camelCase. Use string literal unions for enums.

- [ ] **Step 2: `src/lib/data/tenants.ts`**

Export `TENANTS: Tenant[]` with all 8 tenants per spec §6.

- [ ] **Step 3: `src/lib/data/agents.ts`**

Export `AGENTS: Agent[]` of length 10, matching spec §5 table verbatim (id, name, type, cost_per_run_cents, monthly cost, fte_equivalent, tools, description). Also export `AGENT_RUNS_LAST_90D`, `AGENT_DECISIONS_LAST_90D` generator functions that produce believable time-series.

- [ ] **Step 4: `src/lib/data/frameworks.ts`**

Export `FRAMEWORKS: Framework[]` (35+ rows from spec §8). For top 8 frameworks, also export `REQUIREMENTS: Record<string, Requirement[]>` keyed by framework id.

- [ ] **Step 5: `src/lib/data/risks.ts`, `controls.ts`, etc.**

Each file exports generator functions parameterized by tenant id. For Maybank/MINDEF/Grab, generators produce deterministic seeded data; for shallow tenants, return minimal rows. Use a seeded RNG (mulberry32) for determinism.

```ts
export function risksForTenant(tenantId: string): Risk[] {
  const profile = TENANT_PROFILES[tenantId];
  if (!profile) return [];
  const rng = mulberry32(hashStringToInt(tenantId));
  // ... produce profile.riskCount rows from canonical risk title pool
}
```

Each domain file is 100–300 lines. Heavy lifting: ensuring realistic distributions (severity skews, framework coverage, agent attribution).

- [ ] **Step 6: `src/lib/data/mock.ts`** — aggregator

```ts
export * from './tenants';
export * from './agents';
export * from './frameworks';
// re-export all generators
```

- [ ] **Step 7: Verify compiles**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/data/
git commit -m "feat(data): mock data fixtures and generators for 8 tenants"
```

---

### Task 3.2: Server data dispatcher (mock | pg) + SSE bus

**Files:**
- Create: `src/lib/server/data.ts`
- Create: `src/lib/server/pg.ts`
- Create: `src/lib/server/sse.ts`
- Create: `src/lib/utils/fair.ts`
- Create: `src/lib/utils/hash-chain.ts`
- Create: `src/lib/utils/csv.ts`
- Create: `src/lib/utils/dates.ts`

- [ ] **Step 1: `src/lib/server/pg.ts`**

```ts
import pg from 'pg';
import { env } from '$env/dynamic/private';
const { Pool } = pg;

let pool: pg.Pool | null = null;
export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({ connectionString: env.DATABASE_URL ?? 'postgres://localhost:5432/ntt_grc_hub' });
  }
  return pool;
}
```

- [ ] **Step 2: `src/lib/server/data.ts`** — dispatcher

```ts
import { env } from '$env/dynamic/private';
import * as mock from '$lib/data/mock';
import type { Tenant, Agent, Risk /* …all types */ } from '$lib/data/types';

const isPg = () => (env.DATA_MODE ?? 'mock') === 'pg';

export async function getTenantSummaries(): Promise<Tenant[]> {
  if (!isPg()) return mock.TENANTS;
  const { rows } = await (await import('./pg')).getPool().query('SELECT id, name, industry, region, classified, primary_framework AS "primaryFramework" FROM platform.tenants ORDER BY name');
  return rows;
}

// One exported function per data need; same pattern: branch on isPg().
// Functions: getLiveAgentCount, getAgents, getAgent, getAgentRuns, getAgentDecisions,
//   getRisks, getRisk, getFAIRRuns, getHeatmapCells,
//   getFrameworks, getControls, getEvidence, getAudits, getRegChanges, getPolicies,
//   getVendors, getQuestionnaires, getFourthParties, getConcentrations,
//   getPrivacyActivities, getDPIAs, getSubjectRequests, getBreaches,
//   getESGMetrics, getAIModels, getIncidents, getBCMPlans, getIssues,
//   getWorkflows, getConnectors, getAuditLog
```

Each function takes optional `tenantId` (omitted = MSSP rollup). Total ~300 lines.

- [ ] **Step 3: `src/lib/server/sse.ts`** — agent activity bus

```ts
import { EventEmitter } from 'node:events';
import { AGENTS } from '$lib/data/agents';

class AgentBus extends EventEmitter {
  private timer: NodeJS.Timeout | null = null;
  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 7000);
  }
  stop() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }
  private tick() {
    const a = AGENTS[Math.floor(Math.random() * AGENTS.length)];
    this.emit('agent-run', { ts: new Date().toISOString(), agentId: a.id, agentName: a.name, status: 'success', summary: synthSummary(a) });
  }
}
export const agentBus = new AgentBus();
agentBus.start();

function synthSummary(a: { name: string }): string { /* canned per-agent summaries */ return `${a.name} completed a run`; }
```

- [ ] **Step 4: `src/lib/utils/fair.ts`** — Monte Carlo

Implement `runFAIR({ trials = 10000, frequencyDist, magnitudeDist })` returning `{ ale, are, percentiles: { p10, p25, p50, p75, p90, p95, p99 }, lecCurve: [{loss, probability}, …] }`. Use a seedable RNG. ~80 lines.

- [ ] **Step 5: `src/lib/utils/hash-chain.ts`**

```ts
import { createHash } from 'node:crypto';
export function rowHash(prevHash: string | null, payload: object): string {
  const h = createHash('sha256');
  h.update(prevHash ?? '');
  h.update('|');
  h.update(JSON.stringify(payload));
  return h.digest('hex');
}
export function verifyChain(items: Array<{ prevHash: string|null; rowHash: string; payload: object }>): { ok: boolean; brokenAt?: number } {
  let prev: string | null = null;
  for (let i = 0; i < items.length; i++) {
    const computed = rowHash(prev, items[i].payload);
    if (computed !== items[i].rowHash) return { ok: false, brokenAt: i };
    prev = items[i].rowHash;
  }
  return { ok: true };
}
```

- [ ] **Step 6: `src/lib/utils/csv.ts`** — small csv helper used by exports

```ts
export function toCsv<T extends Record<string, unknown>>(rows: T[], columns?: (keyof T)[]): string {
  if (rows.length === 0) return '';
  const cols = columns ?? (Object.keys(rows[0]) as (keyof T)[]);
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => escape(r[c])).join(','))].join('\n');
}
```

- [ ] **Step 7: `src/lib/utils/dates.ts`** — common date helpers (relative-time, business-day, ISO formatting)

- [ ] **Step 8: Commit**

```bash
git add src/lib/server src/lib/utils
git commit -m "feat(server): data dispatcher, SSE bus, FAIR MC, hash-chain"
```

---

### Task 3.3: SSE endpoint, hooks, login stub

**Files:**
- Create: `src/routes/api/events/+server.ts`
- Create: `src/hooks.server.ts`
- Create: `src/routes/login/+page.svelte`
- Create: `src/routes/login/+page.server.ts`

- [ ] **Step 1: `src/routes/api/events/+server.ts`**

```ts
import type { RequestHandler } from './$types';
import { agentBus } from '$lib/server/sse';

export const GET: RequestHandler = async () => {
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };
      const onRun = (e: unknown) => send('agent-run', e);
      agentBus.on('agent-run', onRun);
      send('hello', { connectedAt: new Date().toISOString() });
      const keepalive = setInterval(() => controller.enqueue(': ka\n\n'), 15000);
      return () => { agentBus.off('agent-run', onRun); clearInterval(keepalive); };
    }
  });
  return new Response(stream, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' } });
};
```

- [ ] **Step 2: `src/hooks.server.ts`** — auto-login demo user

```ts
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // Demo: auto-attach a user
  event.locals.user = { id: 'u_demo', email: 'demo@ntt.com', name: 'Lawrence Khoo', role: 'admin', tenantId: '__all__' };
  return resolve(event);
};
```

- [ ] **Step 3: `src/routes/login/+page.svelte`** + `+page.server.ts` — simple form, accepts anything and redirects to `/`.

- [ ] **Step 4: Commit**

```bash
git add src/routes/api src/routes/login src/hooks.server.ts
git commit -m "feat: SSE event stream, hooks, login stub"
```

---

## Phase 4 — Reusable Components & Charts

### Task 4.1: Core components (KPIs, charts, badges)

**Files:**
- Create: `src/lib/components/PageHeader.svelte`
- Create: `src/lib/components/Kpi.svelte`
- Create: `src/lib/components/ProgressBar.svelte`
- Create: `src/lib/components/StatusDot.svelte`
- Create: `src/lib/components/Sparkline.svelte`
- Create: `src/lib/components/BarChart.svelte`
- Create: `src/lib/components/LineChart.svelte`
- Create: `src/lib/components/Donut.svelte`
- Create: `src/lib/components/Toast.svelte`
- Create: `src/lib/components/Heatmap5x5.svelte`
- Create: `src/lib/components/Sankey.svelte`
- Create: `src/lib/components/Radar.svelte`
- Create: `src/lib/components/LECCurve.svelte`
- Create: `src/lib/components/Gauge.svelte`

Each component is a hand-built SVG (no chart.js runtime) following ntt-cloud-control's pattern. Props: data + dimensions; events: hover/click. Reference `/Users/lawrence/Development/ntt-cloud-control/src/lib/components/BarChart.svelte` for the BarChart pattern. Apply the emerald palette.

Specifications:

- **PageHeader**: title, subtitle, breadcrumb slot, action slot (right-aligned buttons)
- **Kpi**: label, value, delta?, deltaDirection?, icon? — uses `.kpi-num` class
- **Heatmap5x5**: 5×5 grid (severity rows, likelihood columns), each cell shows count + color from severity*likelihood lookup; click handler emits `(sev,lik)`. Color ramp: green (low/rare) → yellow → amber → orange → rose (critical/almost-certain).
- **LECCurve**: Loss Exceedance Curve. X = log10 dollars, Y = probability. Plots line + shaded area; markers at p50/p90/p99.
- **Sankey**: 3-column sankey for vendor concentration (Vendor → Sub-processor → Cloud). Up to 60 nodes.
- **Radar**: framework score across N axes; supports overlay of two series (current vs target).
- **Gauge**: 0–100 score with color band.

- [ ] **Step 1: Write PageHeader, Kpi, ProgressBar, StatusDot, Sparkline, Toast** (small components, ~30–60 lines each)

- [ ] **Step 2: Write BarChart, LineChart, Donut** (mid-size, 80–120 lines each) — reference ntt-cloud-control patterns

- [ ] **Step 3: Write Heatmap5x5** (~90 lines) — SVG grid with color ramp

- [ ] **Step 4: Write LECCurve** (~100 lines) — log-x axis, smooth area path

- [ ] **Step 5: Write Sankey** (~150 lines) — simple two-pass layout

- [ ] **Step 6: Write Radar, Gauge** (~80 lines each)

- [ ] **Step 7: Verify compile**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/components
git commit -m "feat(ui): reusable components — KPI, charts, heatmap, LEC, sankey, radar, gauge"
```

---

### Task 4.2: Agent-specific components + Command Palette

**Files:**
- Create: `src/lib/components/AgentCard.svelte`
- Create: `src/lib/components/AgentRunLog.svelte`
- Create: `src/lib/components/DecisionRow.svelte`
- Create: `src/lib/components/AgentTypeBadge.svelte`
- Create: `src/lib/components/EvidenceChip.svelte`
- Create: `src/lib/components/FrameworkBadge.svelte`
- Create: `src/lib/components/CommandPalette.svelte`
- Create: `src/lib/components/ClassifiedBanner.svelte`
- Create: `src/lib/components/ConfidenceBar.svelte`

- [ ] **Step 1: AgentCard** — gradient border, agent name, type tag, status dot, KPI strip (runs/cost/FTE), CTA button

- [ ] **Step 2: AgentRunLog** — Vercel-build-log style — collapsible steps, timestamps, tool calls inline, status icons

- [ ] **Step 3: DecisionRow** — row showing input → output, confidence bar, outcome chip (auto / HITL approved / HITL rejected), approver name + ts

- [ ] **Step 4: AgentTypeBadge** — colored chip: deterministic (slate), ai-powered (emerald), intelligent (violet)

- [ ] **Step 5: EvidenceChip** — short hash + filename + click-to-copy

- [ ] **Step 6: FrameworkBadge** — small icon + framework name + version

- [ ] **Step 7: CommandPalette** — ⌘K modal, fuzzy search across navConfig + indexed entities

- [ ] **Step 8: ClassifiedBanner** — diagonal red stripe banner shown on `mindef` tenant only ("CLASSIFIED // SOVEREIGN // NTT-MANAGED")

- [ ] **Step 9: ConfidenceBar** — 0–100 bar with color ramp (red <60 → amber 60–80 → emerald >80) and percent label

- [ ] **Step 10: Commit**

```bash
git add src/lib/components
git commit -m "feat(ui): agent components, evidence/framework badges, command palette, classified banner"
```

---

## Phase 5 — Risk Cockpit (home page)

### Task 5.1: Build the Risk Cockpit dashboard

**Files:**
- Create: `src/routes/+page.svelte`
- Create: `src/routes/+page.server.ts`

- [ ] **Step 1: `+page.server.ts`** — loader

```ts
import type { PageServerLoad } from './$types';
import {
  getTenantSummaries, getAgents, getRecentAgentRuns,
  getHeatmapCells, getTopRisks, getFrameworkScores,
  getKpiSnapshot, getRecentDecisions, getCostLedger30d
} from '$lib/server/data';

export const load: PageServerLoad = async () => {
  const [tenants, agents, runs, heatmap, topRisks, frameworks, kpis, decisions, costs] = await Promise.all([
    getTenantSummaries(), getAgents(), getRecentAgentRuns(20),
    getHeatmapCells(), getTopRisks(10), getFrameworkScores(),
    getKpiSnapshot(), getRecentDecisions(10), getCostLedger30d()
  ]);
  return { tenants, agents, runs, heatmap, topRisks, frameworks, kpis, decisions, costs };
};
```

- [ ] **Step 2: `+page.svelte`** — layout

Sections (top → bottom):
1. **PageHeader**: "Risk Cockpit" — subtitle reflects current tenant (e.g., "Maybank Singapore — Tier-1 Bank"); right-side: time-range toggle (24h / 7d / 30d / QTD)
2. **KPI strip** (6 KPIs): Open Critical Risks, Avg Compliance Score, Open Findings, Vendor Risk Index, Agent FTE Saved (30d), Evidence Items (30d)
3. **Two-column row**: left = Heatmap5x5 (full-width within column); right = LiveStream (last 10 agent runs, SSE-fed)
4. **Three-card row**: Top Risks list / Framework Scores radar / Agent Cost vs FTE BarChart
5. **Recent Decisions table** (10 rows): agent, decision type, confidence bar, outcome chip, ts
6. **Board Narrative Preview** card — emerald-gradient card with "Generated by Board Narrator — 11 min ago" and 4-paragraph blurb

Wire SSE in `onMount` (`new EventSource('/api/events')`) to prepend incoming `agent-run` events to `runs`. Use the spec §10 wow path as the data-shape guide.

- [ ] **Step 3: Verify**

Run: `npm run dev` and open http://localhost:5182/
Expected: dashboard renders with mock data; SSE events appear every ~7s; no console errors.

- [ ] **Step 4: Commit**

```bash
git add src/routes/+page.svelte src/routes/+page.server.ts
git commit -m "feat: Risk Cockpit dashboard with SSE live agent stream"
```

---

## Phase 6 — Agent Fleet (the hero module)

### Task 6.1: Agent Fleet listing + Agent Detail

**Files:**
- Create: `src/routes/agents/+page.svelte`
- Create: `src/routes/agents/+page.server.ts`
- Create: `src/routes/agents/[id]/+page.svelte`
- Create: `src/routes/agents/[id]/+page.server.ts`
- Create: `src/routes/decisions/+page.svelte`
- Create: `src/routes/decisions/+page.server.ts`
- Create: `src/routes/stream/+page.svelte`
- Create: `src/routes/stream/+page.server.ts`

- [ ] **Step 1: Agent Fleet listing (`/agents`)**

Page sections:
1. PageHeader "Agent Fleet" — subtitle "10 agents · 4.7 FTE replaced · $1.2M saved annually"
2. KPI strip: Total Runs (30d), Total Cost (30d), Total FTE Hours Saved (30d), HITL Approval Rate, Auto-Approved %, Avg Confidence
3. Filter bar: type (deterministic / ai-powered / intelligent), status (idle / running / paused), search
4. Grid of 10 `AgentCard` components (3 cols on xl, 2 on md, 1 on sm). Each card links to `/agents/{id}`.
5. ROI banner at the bottom: "$950/mo fleet cost vs $97,500/mo human equivalent" with a horizontal cost-comparison bar

- [ ] **Step 2: Agent Detail (`/agents/[id]`)**

Page sections:
1. PageHeader with agent name + AgentTypeBadge + status + on-demand "Run Now" button
2. KPI strip: 30d runs, Avg confidence, Cost (30d), FTE hours saved (30d), HITL approval rate, P95 latency
3. Tabs: **Runs** / **Decisions** / **Tools** / **Audit** / **Settings**
   - Runs: AgentRunLog list (paginated 20 per page)
   - Decisions: DecisionRow list, filter by outcome
   - Tools: list from `agent.tools` (with kind icons)
   - Audit: tamper-evident `agent.runs` audit log with hash badges
   - Settings: schedule (cron), cost cap, HITL rules — all read-only inputs for demo
4. Sidebar (right rail): "What this agent does" markdown blurb; "Recent Decisions" mini-list

- [ ] **Step 3: Decisions (`/decisions`) — global decisions feed**

Filterable, paginated table across all agents. Columns: ts, agent, decision_type, input summary, output summary, confidence bar, outcome chip, approver. CSV export button.

- [ ] **Step 4: Stream (`/stream`) — full-page agent activity stream**

Live SSE event log with auto-scroll, pause toggle, type filter. Looks like a terminal — monospace, color-coded by agent type.

- [ ] **Step 5: Verify**

Run: `npm run dev`. Open `/agents`, click each card, verify `/agents/[id]` renders for all 10 agent ids. Visit `/decisions` and `/stream`.
Expected: no 404s; all 10 agents resolve.

- [ ] **Step 6: Commit**

```bash
git add src/routes/agents src/routes/decisions src/routes/stream
git commit -m "feat: Agent Fleet, Agent Detail, Decisions feed, Activity Stream"
```

---

### Task 6.2: Workflows + Connectors

**Files:**
- Create: `src/routes/workflows/+page.svelte`
- Create: `src/routes/workflows/+page.server.ts`
- Create: `src/routes/workflows/[id]/+page.svelte`
- Create: `src/routes/workflows/[id]/+page.server.ts`
- Create: `src/routes/connectors/+page.svelte`
- Create: `src/routes/connectors/+page.server.ts`

- [ ] **Step 1: `/workflows` index**

Table of workflows with: name, trigger, steps, last execution status, success rate (last 30d), action menu. Filter by status. Top-right "+ New Workflow" button (stub).

- [ ] **Step 2: `/workflows/[id]` detail**

Sections:
1. Header with workflow name, status, "Run Now"
2. **Visual diagram** — horizontal stepper (boxes connected by arrows) rendered as SVG. Each box shows step kind (agent / api / manual / decision), name, last status. Click a box → highlight that step's recent executions.
3. Recent executions table

- [ ] **Step 3: `/connectors`**

Grid of connector cards (40+). Each card: connector icon (use Lucide best-fit), name, status dot, last sync, records ingested 24h, action menu. Group by category: Cloud (AWS, Azure, GCP, OCI, Alibaba), Identity (Okta, Entra, Ping), ITSM (Jira, ServiceNow), Comms (Slack, Teams), SaaS (M365, Google Workspace, GitHub, GitLab, Datadog, Splunk), Custom Webhooks.

- [ ] **Step 4: Commit**

```bash
git add src/routes/workflows src/routes/connectors
git commit -m "feat: workflows + 40+ connectors"
```

---

## Phase 7 — Compliance Core

### Task 7.1: Frameworks Library + Controls Library

**Files:**
- Create: `src/routes/frameworks/+page.svelte`, `+page.server.ts`
- Create: `src/routes/frameworks/[id]/+page.svelte`, `+page.server.ts`
- Create: `src/routes/controls/+page.svelte`, `+page.server.ts`
- Create: `src/routes/controls/[id]/+page.svelte`, `+page.server.ts`

- [ ] **Step 1: `/frameworks` index**

Top: KPI strip — Active Frameworks, Avg Score, Frameworks Due in 60 days, Total Requirements Tracked.
Filter chips by region (Global / EU / Americas / Singapore / APAC banking / APAC privacy / ESG / Sector).
Table: framework, version, region, regulator, requirements count, score gauge, last assessed, next due, action. Sortable. Pagination optional (35 rows fits on one page).

- [ ] **Step 2: `/frameworks/[id]` detail**

Sections:
1. Header: framework name + version + regulator + region; Score gauge (0–100); "Generate Audit Pack" button (links to /audits/new with framework prefill)
2. Tabs: **Requirements** / **Controls** / **Evidence** / **Gaps** / **Attestations**
   - Requirements: tree with status badges (pass/warn/fail/n_a)
   - Controls: list of mapped controls, each showing coverage %
   - Evidence: latest evidence items linked
   - Gaps: open gaps with severity + remediation plan + due date
   - Attestations: signed attestations history

- [ ] **Step 3: `/controls` index**

Top: KPI strip (Total Controls, Automated %, Pass Rate 30d, Failing Now).
Table: code, title, type (technical/process/admin), framework chips, owner, last tested, last result, automation icon. Searchable. Filterable by framework, type, automation, status.

- [ ] **Step 4: `/controls/[id]` detail**

Sections:
1. Header with control code + title + automation badge + Run Test button
2. Description block
3. Mappings: list of (framework, requirement, coverage)
4. Tests: table of `control.tests` with last result + run history sparkline
5. Recent test runs (paginated 20): ts, result, evidence link, agent attribution
6. Linked evidence chips
7. Exceptions list

- [ ] **Step 5: Verify & commit**

```bash
git add src/routes/frameworks src/routes/controls
git commit -m "feat: Frameworks and Controls libraries"
```

---

### Task 7.2: Evidence Vault + Audit Mgmt + Reg Horizon + Policies

**Files:**
- Create: `src/routes/evidence/+page.svelte`, `+page.server.ts`
- Create: `src/routes/audits/+page.svelte`, `+page.server.ts`
- Create: `src/routes/audits/[id]/+page.svelte`, `+page.server.ts`
- Create: `src/routes/regwatch/+page.svelte`, `+page.server.ts`
- Create: `src/routes/regwatch/[id]/+page.svelte`, `+page.server.ts`
- Create: `src/routes/policies/+page.svelte`, `+page.server.ts`
- Create: `src/routes/policies/[id]/+page.svelte`, `+page.server.ts`

- [ ] **Step 1: `/evidence`**

- KPI strip: Items in Vault, Collected Last 24h, Hash-Chain Status (✓ Intact), Average Age
- Hash-chain verification banner: "Vault integrity verified at 2026-05-29 09:14 SGT — 8,392 of 8,392 items sealed."
- Filter: collector, kind, date range
- Table: title, kind, collector, captured_at, hash (short, copy-on-click), linked control(s), agent attribution

- [ ] **Step 2: `/audits` index**

Cards by status: Active, In Planning, Recently Closed. Each card: engagement name, type, lead auditor, opened/closed dates, findings count by severity. "+ New Engagement" button.

- [ ] **Step 3: `/audits/[id]` detail**

Sections: header (type, scope, dates, lead); tabs **Findings** / **Workpapers** / **Evidence Pack**. Evidence Pack tab shows "Generated by Audit Companion" badge and a downloadable evidence bundle (CSV stub) of all linked evidence.

- [ ] **Step 4: `/regwatch` index**

- KPI strip: Sources Monitored (40+), Changes (30d), Active Impact Assessments, Gaps Opened
- Timeline view of recent changes (grouped by week): each entry shows regulator badge, title, severity, "Detected by Regulatory Horizon agent — 11 min ago" attribution.
- Hero entry: MAS Notice 655 update from spec §10 wow path.

- [ ] **Step 5: `/regwatch/[id]` detail**

Header: regulator + change title + published/effective dates + severity. Body: AI-generated summary, raw source link, impact assessment table (per tenant) with gaps_opened, action mapping suggestions. "Apply mappings" button (stub).

- [ ] **Step 6: `/policies` index**

Cards by status: Approved, In Review, Drafting, Retired. Filter by jurisdiction. Search by code/title.

- [ ] **Step 7: `/policies/[id]` detail**

Tabs: **Current Version** (markdown preview) / **Version History** / **Acknowledgements** (% rate + list) / **Exceptions** / **Mappings to Frameworks**. If most recent version was `drafted_by_agent_id` show "Drafted by Policy Drafter agent" badge.

- [ ] **Step 8: Verify & commit**

```bash
git add src/routes/evidence src/routes/audits src/routes/regwatch src/routes/policies
git commit -m "feat: Evidence Vault, Audit Mgmt, Reg Horizon, Policy Mgmt"
```

---

## Phase 8 — Enterprise Risk

### Task 8.1: ERM Register + Heatmap & FAIR + Issues + Resilience

**Files:**
- Create: `src/routes/risk/+page.svelte`, `+page.server.ts`
- Create: `src/routes/risk/[id]/+page.svelte`, `+page.server.ts`
- Create: `src/routes/heatmap/+page.svelte`, `+page.server.ts`
- Create: `src/routes/issues/+page.svelte`, `+page.server.ts`
- Create: `src/routes/issues/[id]/+page.svelte`, `+page.server.ts`
- Create: `src/routes/resilience/+page.svelte`, `+page.server.ts`

- [ ] **Step 1: `/risk` ERM Register**

- KPI strip: Total Risks, Critical, Accepted, Mitigated 30d, Avg Residual Score
- Filter chips: category, status, treatment strategy
- Table: code, title, category, owner, inherent score (sev×lik), residual score, treatment, next review, action

- [ ] **Step 2: `/risk/[id]` Risk Detail**

Sections: header with code + title + risk score; tabs **Overview** / **Treatments** / **Scenarios** / **History** / **Linked Controls**. Show inherent → residual reduction visualization.

- [ ] **Step 3: `/heatmap` Heatmap & FAIR**

- Top: large Heatmap5x5 component, clickable cells filter the table below
- Right rail: Risk Appetite Statements per category with current vs threshold gauges
- Below: when a FAIR scenario is selected, show LECCurve + percentile table + ALE + ARE
- "Run Quantification" button — emerald primary, shows "Powered by Risk Quantifier agent"

- [ ] **Step 4: `/issues` index + `/issues/[id]` detail**

Table: id, source (audit/risk/incident/control-test/regulatory), title, severity, owner, due. Detail page shows linked actions and timeline.

- [ ] **Step 5: `/resilience`**

DORA / APRA CPS 230 view:
- KPI strip: Important Business Services, Tested Last Quarter, Within RTO/RPO targets %, Open Dependencies at Risk
- Table of Important Business Services with RTO/RPO targets vs last test, dependency count, status traffic light
- Click a service → drill-down with dependency graph (use Sankey component: Service → Tech → Vendor)

- [ ] **Step 6: Commit**

```bash
git add src/routes/risk src/routes/heatmap src/routes/issues src/routes/resilience
git commit -m "feat: ERM Register, Heatmap & FAIR, Issues, Op Resilience"
```

---

## Phase 9 — Third-Party

### Task 9.1: Vendors + Questionnaires + 4th-Party

**Files:**
- Create: `src/routes/vendors/+page.svelte`, `+page.server.ts`
- Create: `src/routes/vendors/[id]/+page.svelte`, `+page.server.ts`
- Create: `src/routes/questionnaires/+page.svelte`, `+page.server.ts`
- Create: `src/routes/questionnaires/[id]/+page.svelte`, `+page.server.ts`
- Create: `src/routes/fourth-party/+page.svelte`, `+page.server.ts`

- [ ] **Step 1: `/vendors` index**

- KPI strip: Total Vendors, Critical (Tier 1), Renewals < 90 days, Avg Residual Risk
- Filter by tier, criticality, status
- Table: name, category, tier, criticality chip, hq, contract value, status, last questionnaire score

- [ ] **Step 2: `/vendors/[id]` detail**

Sections: header (name, tier, criticality); tabs **Overview** / **Contracts** / **Questionnaires** / **4th Parties** / **Risk Findings** / **Evidence**. Overview shows risk score history line chart.

- [ ] **Step 3: `/questionnaires` index**

Table: vendor, template, status, sent_at, completed_at, score gauge, completed_by (agent badge when applicable). Hero badge: "Vendor Risk Analyst auto-completed 38 of 47 (81%) — saved 320 analyst hours."

- [ ] **Step 4: `/questionnaires/[id]` detail**

Question-by-question table: code, question, response, confidence bar, source_evidence chip. If completed by agent, show the agent badge + audit chain link.

- [ ] **Step 5: `/fourth-party`**

Hero: Sankey diagram (Vendor → 4th party → Cloud) showing concentration. Below: concentrations table from `vendor.concentrations`. Alert callout for any concentration > threshold.

- [ ] **Step 6: Commit**

```bash
git add src/routes/vendors src/routes/questionnaires src/routes/fourth-party
git commit -m "feat: Vendors, Questionnaires, 4th-Party concentration"
```

---

## Phase 10 — Specialized Modules

### Task 10.1: Privacy + ESG + AI Governance + SOX + BCM

**Files:**
- Create: `src/routes/privacy/+page.svelte`, `+page.server.ts`
- Create: `src/routes/esg/+page.svelte`, `+page.server.ts`
- Create: `src/routes/ai-gov/+page.svelte`, `+page.server.ts`
- Create: `src/routes/ai-gov/[id]/+page.svelte`, `+page.server.ts`
- Create: `src/routes/sox/+page.svelte`, `+page.server.ts`
- Create: `src/routes/bcm/+page.svelte`, `+page.server.ts`
- Create: `src/routes/bcm/[id]/+page.svelte`, `+page.server.ts`

- [ ] **Step 1: `/privacy`**

Tabs: **RoPA** (processing activities table), **DPIAs** (cards), **Subject Requests** (table with SLA progress bars), **Breaches** (timeline).

- [ ] **Step 2: `/esg`**

- KPI strip: Scope 1 / Scope 2 / Scope 3 emissions (tCO2e), Total Disclosures, On-Target %
- LineChart: emissions trend (last 24 months) with target line
- Tabs: **Metrics** / **Disclosures** / **Targets**

- [ ] **Step 3: `/ai-gov`**

- KPI strip: Models in Production, EU AI Act High-Risk Count, ISO 42001 Status, Prompts Logged 24h
- Table of models with risk tier chip, EU AI Act class, ISO 42001 status, owner, last review
- Hero callout: "All 6 production models risk-classified per EU AI Act. NTT Tsuzumi (sovereign LLM) covers 100% of prompts in MINDEF tenant."

- [ ] **Step 4: `/ai-gov/[id]`** model detail

Tabs: **Overview** (kind, owner, training data summary, risk tier), **Model Risk** (risk types + mitigations), **Prompts Audit** (last 100 prompts redacted), **Drift & Monitoring** (Sparkline).

- [ ] **Step 5: `/sox`**

- KPI strip: ITGCs, KCAs, Walkthroughs Complete, Open Deficiencies
- Tabs: ITGCs / KCAs / Walkthroughs / Deficiencies

- [ ] **Step 6: `/bcm` + `/bcm/[id]`**

Index: list of plans (cards) with RTO/RPO + last/next test + status. Detail: plan overview + BIA table + tests history.

- [ ] **Step 7: Commit**

```bash
git add src/routes/privacy src/routes/esg src/routes/ai-gov src/routes/sox src/routes/bcm
git commit -m "feat: Privacy, ESG, AI Governance, SOX, BCM modules"
```

---

## Phase 11 — Board Pack, MSSP Compare, Admin

### Task 11.1: Board Pack + Tenant Compare

**Files:**
- Create: `src/routes/board/+page.svelte`, `+page.server.ts`
- Create: `src/routes/tenants-compare/+page.svelte`, `+page.server.ts`

- [ ] **Step 1: `/board` Board Pack**

A magazine-style read: emerald-green title strip "BOARD RISK PACK — May 2026", generated-by badge ("Generated by Board Narrator agent · 7m read · 11 min ago"). Sections:
1. Executive Summary (4 paragraphs)
2. Top 5 Risks (cards with quantitative ALE)
3. Compliance Posture (radar)
4. Third-Party Concentration (sankey)
5. Resilience Snapshot
6. Agent ROI Summary

"Download PDF" button (stubbed — opens a console.log).

- [ ] **Step 2: `/tenants-compare` MSSP Rollup**

Top: KPI strip showing aggregate across tenants. Below: tenant comparison table with columns per tenant (Maybank / MINDEF / Grab) and rows for: Open Critical Risks, Avg Compliance Score, Open Findings, Vendor Risk Index, Agent FTE Saved (30d), Last Audit. Visual cue (color band) for best/worst.

- [ ] **Step 3: Commit**

```bash
git add src/routes/board src/routes/tenants-compare
git commit -m "feat: Board Pack + MSSP Tenant Compare"
```

---

### Task 11.2: Admin (Tenants, Users, Audit Log, Settings)

**Files:**
- Create: `src/routes/admin/tenants/+page.svelte`, `+page.server.ts`
- Create: `src/routes/admin/users/+page.svelte`, `+page.server.ts`
- Create: `src/routes/admin/audit/+page.svelte`, `+page.server.ts`
- Create: `src/routes/admin/settings/+page.svelte`

- [ ] **Step 1: `/admin/tenants`**

Table of all tenants with MRR, primary framework, SLA tier, status, classified flag. Click → tenant detail panel with onboarding date, configured connectors count, users count.

- [ ] **Step 2: `/admin/users`**

User table: name, email, role, last login, status, MFA. Filter by role. Show role-permission matrix below.

- [ ] **Step 3: `/admin/audit`**

Tamper-evident `platform.audit_log` viewer. Top banner: "Audit log verified — chain intact." Table: ts, actor, action, target, result, IP, user_agent, hash short. Search box. Export CSV.

- [ ] **Step 4: `/admin/settings`**

Sections: Profile, Tenant Settings (data residency, AI provider — defaults to "NTT Tsuzumi (sovereign)" for MINDEF), API Tokens (table), MFA, Branding (emerald-tunable in real prod).

- [ ] **Step 5: Commit**

```bash
git add src/routes/admin
git commit -m "feat: Admin pages — tenants, users, audit log, settings"
```

---

## Phase 12 — Demo Polish

### Task 12.1: Classified banner integration + tenant-scoped data filtering

**Files:**
- Modify: `src/routes/+layout.svelte`
- Modify: `src/lib/server/data.ts` (all functions accept optional `tenantId`)
- Modify: many `+page.server.ts` files to pass `event.locals.tenantId`

- [ ] **Step 1: Make tenant switching globally scope all data**

Update `src/hooks.server.ts` to read tenant from a cookie (`grc_tenant`) and write it into `event.locals.tenantId`. The TenantSwitcher sets the cookie via `fetch('/api/tenant', { method: 'POST', body: tenantId })`.

Add route `src/routes/api/tenant/+server.ts` that sets the `grc_tenant` cookie and returns `{ ok: true }`.

Every `+page.server.ts` loader passes `event.locals.tenantId` to data functions. When `tenantId === ALL_TENANTS_ID`, data functions return rollup; else scoped.

- [ ] **Step 2: Show ClassifiedBanner when tenant is MINDEF**

In `+layout.svelte`, check `data.currentTenant.classified` and render `<ClassifiedBanner />` above the main content area.

- [ ] **Step 3: Verify**

Manually switch tenants in the UI. Confirm KPIs change, classified banner only appears on MINDEF.

- [ ] **Step 4: Commit**

```bash
git add src/
git commit -m "feat: tenant-scoped data + classified banner for MINDEF"
```

---

### Task 12.2: README + screenshot kit + demo path validation

**Files:**
- Create: `README.md`
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `scripts/demo-walkthrough.md`

- [ ] **Step 1: `README.md`**

Mirror ntt-cloud-control's README structure. Sections: Highlights, Competitive Positioning (with the table from spec §1.1), Branding, Tech Stack, Project Structure, Demo Walkthrough (link to demo-walkthrough.md), Setup, License.

- [ ] **Step 2: `Dockerfile` + `docker-compose.yml`**

Mirror ntt-cloud-control's pattern: Node 22-alpine base, install + build SvelteKit, expose 5182. Compose includes the app + Postgres 16.

- [ ] **Step 3: `scripts/demo-walkthrough.md`**

Step-by-step 20-min demo script from spec §10 with click-by-click instructions, expected screens, and what to highlight at each step.

- [ ] **Step 4: Run the full demo path end-to-end**

Manually execute spec §10 wow path. Confirm at each step:
- No console errors
- Page loads in < 1s
- Data is visible and believable
- SSE events appear on dashboard and stream pages
- Tenant switcher correctly scopes data
- Classified banner shows on MINDEF only
- Agent ROI numbers match spec ($1.2M/yr, 4.7 FTE, $950/mo cost)

- [ ] **Step 5: Verify**

Run: `npm run check` — expect 0 errors.
Run: `npm run build && npm run preview` — expect successful build, app boots on 5182.

- [ ] **Step 6: Commit**

```bash
git add README.md Dockerfile docker-compose.yml scripts/demo-walkthrough.md
git commit -m "docs: README, Dockerfile, compose, demo walkthrough"
```

---

## Self-Review Notes

- **Spec coverage:**
  - §1 Positioning → README + Board Pack (Phase 11)
  - §2 Visual system → Phase 1 (Tailwind tokens, app shell)
  - §3 Architecture → Phases 1, 3 (shell + data dispatcher + SSE)
  - §4 Module map (20) → Phases 5–11 covers all 20 modules
  - §5 Agent Fleet (10 agents) → Phases 2.5 (seed), 3.1 (data), 6 (UI)
  - §6 Hero tenants → Phase 2.5 (seed) + Phase 3.1 (mock generators)
  - §7 Database (50 tables) → Phases 2.1–2.4
  - §8 Frameworks (35+) → Phase 2.5 + Phase 7.1
  - §9 Project structure → matches Task file lists
  - §10 Demo wow path → Phase 12.2 validation
  - §11 Phases → 1:1 mapping
  - §12 Non-goals → respected (no real auth, no real LLM, no mobile)
  - §13 Success criteria → Phase 12.2 verification step

- **Placeholder scan:** No "TBD" / "TODO" left. A handful of tasks reference the spec for details rather than duplicating column lists — acceptable because the spec is checked in and stable.

- **Type consistency:** Mock `Tenant`, `Agent`, etc. types defined in 3.1; reused in components and pages. Function names: `getTenantSummaries`, `getAgents`, `getAgent` (singular for detail), `getRecentAgentRuns`, `getKpiSnapshot`, etc. — used consistently across loaders.

- **Bite-sized check:** Foundation + DB tasks are highly atomic. Module-build tasks (Phases 5–11) bundle 1–8 pages per task because each page follows the same scaffold pattern (loader → header → KPI strip → content). This is appropriate for a greenfield demo where pages share heavy structural similarity; one PR per module keeps reviews manageable while not exploding the plan to 300 tasks.

---
