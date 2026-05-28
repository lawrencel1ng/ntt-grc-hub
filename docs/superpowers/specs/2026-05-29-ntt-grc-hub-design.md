# NTT GRC Hub — Design Specification

**Date:** 2026-05-29
**Status:** Approved (brainstorming) — ready for implementation planning
**Owner:** NTT Singapore — GRC Engineering
**Codename:** NTT GRC Hub (`ntt-grc-hub`)

---

## 1. Vision & Positioning

> **"The world's first Agentic GRC Operating System."**

The legacy GRC market (Archer, MetricStream, ServiceNow IRM, OneTrust, 6clicks) is built top-down from compliance frameworks: an audit-shaped tool with risk bolted on. **NTT GRC Hub inverts the stack.** Reality flows up — controls, evidence, vendors, policies, incidents — through an **agent orchestration layer** to a **risk intelligence layer** at the top. Framework output (SOC 2 report, MAS attestation, ISO certificate) is a *byproduct* of doing risk management correctly.

**Tagline:** *"From audit compliance to continuous risk reduction."*

### 1.1 Competitive moat

| Capability | NTT GRC Hub | 6clicks | Archer | MetricStream | ServiceNow IRM | OneTrust |
|---|---|---|---|---|---|---|
| Named autonomous agents | **10 (fleet)** | 1 (Hailey) | None | None | Workflow only | None |
| Agent ROI dashboard | **Yes** | No | No | No | No | No |
| Hash-chained evidence | **Yes** | No | No | Partial | No | No |
| APAC regulator coverage | **18 frameworks** | ~5 | ~8 | ~10 | ~6 | ~6 |
| Sovereign LLM (NTT Tsuzumi) | **Yes** | No | No | No | No | No |
| FAIR Monte Carlo built-in | **Yes** | Add-on | Add-on | Yes | No | No |
| Multi-tenant MSSP-native | **Yes** | Partial | No | No | Partial | No |
| Tier-1 carrier integration | **Yes (AS2914)** | No | No | No | No | No |

### 1.2 The three-types-of-automation thesis

Per the LinkedIn GRC Engineering thesis, the platform makes all three types visible and budgeted as first-class objects:

1. **Deterministic** — scripts, APIs, if-then rules (e.g., GCP encryption check) — `$0/mo` per agent
2. **AI-powered** — LLM-in-workflow (e.g., vendor questionnaire response drafting) — `$50–200/mo` per agent
3. **Intelligent** — multi-agent, multi-tool, autonomous decisions (e.g., regulatory horizon scanning across 40 sources) — `$15/mo per use vs $24K/yr human analyst`

Each agent in the Agent Fleet is tagged with its automation type and shows live cost vs. human-FTE savings.

---

## 2. Brand & Visual System

### 2.1 Color tokens (Tailwind extension)

```ts
colors: {
  grc: {
    primary:     '#047857',  // emerald-700 — trust, assurance
    'primary-dark': '#065f46', // emerald-800 — hover
    'primary-light': '#10b981', // emerald-500 — highlight
    accent:      '#34d399',  // emerald-400 — agent moments
    sidebar:     '#0f172a',  // slate-900
    'sidebar-2': '#1e293b',  // slate-800 — gradient end
    risk:        '#f59e0b',  // amber-500 — warnings
    critical:    '#e11d48',  // rose-600 — critical risk
    agent:       '#a855f7',  // violet-500 — agent telemetry
    ink:         '#0f172a',
  },
  surface: {
    DEFAULT: '#ffffff',
    muted:   '#f8fafc',  // slate-50
    sunken:  '#f1f5f9',  // slate-100
  },
}
```

### 2.2 Component conventions

Same Tailwind component layer as `ntt-cloud-control` (`.card`, `.btn-primary`, `.tag-*`, `.kpi-num`, `.input`, `.thead/td/tr`), retuned to emerald. Adds:

- `.agent-card` — gradient border (violet→emerald), glow-on-active
- `.risk-cell-*` — heatmap cells (5 severity tiers)
- `.evidence-chip` — file/hash chip with copy-on-click

### 2.3 Brand identity

- **Wordmark:** "NTT GRC HUB" — Inter, weight 600, tracking -0.01em
- **Logo glyph:** shield + circuit-node lockup (inline SVG, emerald gradient)
- **Tagline lockup:** Wordmark / "Agentic GRC OS"
- **Sidebar:** dark slate gradient (`from-slate-900 via-slate-800 to-slate-900`) — distinct from ntt-cloud-control's navy-blue gradient
- **Top bar:** white with thin emerald underline, tenant chip on the left

---

## 3. Architecture

### 3.1 Tech stack (matches ntt-cloud-control pattern)

| Layer | Technology |
|---|---|
| Frontend framework | SvelteKit 2 with Svelte 5 runes, TypeScript |
| Styling | Tailwind CSS 3 with custom emerald/slate tokens |
| Icons | Lucide-svelte + ~6 hand-built custom agent glyphs |
| Charts | Hand-built SVG — bar, line, sparkline, donut, gauge, **heatmap (5×5)**, **sankey**, **radar**, **FAIR LEC curve** |
| Database | PostgreSQL 16+ with `db/init.sql`, `db/seed.sql` |
| Data layer | Dual-mode: mock TypeScript fixtures (default) + Postgres-backed routes (via env flag) — same pattern as ntt-cloud-control |
| Realtime | Server-Sent Events (`/api/events`) for agent activity stream + control test results |
| Auth | Stubbed SAML/OIDC; 6 RBAC roles (admin, risk-owner, control-owner, auditor, agent-operator, viewer) |
| AI runtime | Stubbed (returns curated demo responses); UI wired for swap to NTT Tsuzumi or Anthropic |
| Port | 5182 (5181 reserved by ntt-cloud-control) |
| Packaging | Docker + docker-compose mirroring ntt-cloud-control |

### 3.2 Application shell

```
┌──────────────────────────────────────────────────────────────┐
│ [Tenant▾]  NTT GRC HUB    [⌘K Search]   [Agents 7 live] [⚙] │
├────────┬─────────────────────────────────────────────────────┤
│ SIDE   │  Risk Cockpit                                       │
│ NAV    │  ──────────────────────────────────────────────     │
│        │  KPI strip · Live agent stream · Heatmap · Top      │
│ (slate │  risks · Framework scores · Recent decisions ·      │
│  grad) │  Board narrative preview                            │
│        │                                                     │
└────────┴─────────────────────────────────────────────────────┘
```

- Sidebar: collapsible, 6 sections (Overview, Enterprise Risk, Compliance, Third-Party, Specialized, Agentic OS, Admin)
- Top bar: tenant switcher chip (MSSP mode), global ⌘K palette, live agent count, profile/settings
- Content area: page header + module-specific layout

### 3.3 Multi-tenant MSSP model

- Top-bar tenant switcher (default: "All Tenants" rollup, then per-tenant)
- "All Tenants" view shows aggregate KPIs and tenant comparison table
- Switching to a tenant scopes every page to that tenant
- Hero tenants seeded with deep data (see §6); other tenants seeded shallow for switcher realism

---

## 4. Module Map (20 modules)

```
OVERVIEW
  · Risk Cockpit (home)              — dashboard / hero page
  · Board Pack                       — generated CEO/board view
  · Agent Activity Stream            — live SSE feed of agent runs
  · Tenant Comparison (MSSP rollup)  — cross-tenant scorecard

ENTERPRISE RISK
  · ERM Register                     — top-down risks, owners, treatments
  · Risk Heatmap & Quantification    — 5×5 heatmap + FAIR Monte Carlo (LEC)
  · Issues & Incidents               — operational issues, postmortems
  · Operational Resilience           — DORA / APRA CPS 230 — important business services, dependency mapping

COMPLIANCE
  · Frameworks Library               — 35+ frameworks with controls and status
  · Controls Library                 — unified controls catalog with framework mappings
  · Evidence Vault                   — hash-chained, immutable evidence store
  · Audit Management                 — engagements, scopes, findings, workpapers
  · Regulatory Horizon Scan          — incoming regulator changes, impact assessments
  · Policy Management                — policy lifecycle, acknowledgements, exceptions

THIRD-PARTY
  · Vendor / TPRM                    — vendor inventory, tiers, risk scores
  · Vendor Questionnaires            — auto-filled by Vendor Risk Analyst agent
  · 4th-party Concentration          — sub-processor / cloud concentration graph

SPECIALIZED
  · Privacy                          — GDPR / PDPA / PIPL — RoPA, DPIAs, DSARs, breaches
  · ESG / Sustainability             — CSRD / ISSB / GHG metrics, disclosures, targets
  · AI Governance                    — model registry, EU AI Act classification, ISO 42001
  · SOX & Financial Controls         — ITGC, KCAs, walkthroughs
  · BCM / DR Plans                   — plans, BIAs, tests, scenarios

AGENTIC OS
  · Agent Fleet                      — hero page: 10 named agents
  · Agent Runs & Decisions           — every decision auditable, with confidence
  · Automation Workflows             — visual workflow builder (HITL approvals)
  · Integrations / Connectors        — 40+ connector stubs (AWS, Azure, GCP, Okta, Jira, Slack, ServiceNow, etc.)

ADMIN
  · Tenants · Users & RBAC · Audit Log · Settings
```

---

## 5. Agent Fleet (the moat)

Ten named agents. Each is a first-class object with: status, type tag (deterministic / AI-powered / intelligent), live runs, decisions made (with confidence), tools used, cost, FTE-equivalent savings, audit trail, and HITL approval queue.

| # | Agent | Job | Trigger | Type | Cost model |
|---|---|---|---|---|---|
| 1 | **Evidence Collector** | Pulls evidence from AWS, Azure, GCP, Okta, Jira, GitHub, M365, ServiceNow into Evidence Vault. Hashes and seals each item. | Cron 6h + on-demand | Deterministic | $0/mo |
| 2 | **Control Tester** | Continuously evaluates technical controls against live cloud config (encryption, IAM, network, logging). | Cron 1h | Deterministic + LLM (for interpretation) | $30/mo |
| 3 | **Vendor Risk Analyst** | Ingests vendor SOC 2 / ISO reports, auto-fills SIG/CAIQ questionnaires, scores residual risk. | New vendor + quarterly | LLM | $80/mo |
| 4 | **Policy Drafter** | Drafts and updates policy documents from framework + org context. | On framework change or policy expiry | LLM | $120/mo |
| 5 | **Regulatory Horizon** | Scans 40+ regulator sources (MAS, APRA, EU, OJK, RBI, etc.) and tags impact. | Daily | Intelligent (multi-tool) | $200/mo |
| 6 | **Audit Companion** | Assembles auditor evidence packs on-demand, links evidence-to-control-to-requirement. | Audit event | Intelligent | $150/mo |
| 7 | **Risk Quantifier** | Runs FAIR Monte Carlo simulation on selected risks (10,000 trials), produces LEC curve and ALE. | On risk update | Deterministic + LLM (scenario shaping) | $40/mo |
| 8 | **Incident Investigator** | Builds incident timeline from logs/tickets/chat, produces draft postmortem. | New P1/P2 incident | Intelligent | $180/mo |
| 9 | **Control Mapper** | Maps a new/custom control into all 35+ frameworks, with semantic similarity confidence. | New control | LLM | $60/mo |
| 10 | **Board Narrator** | Generates monthly board-ready risk narratives (1 page + appendix) from quantitative data. | Monthly + on-demand | LLM | $90/mo |

**Total fleet cost:** ≈ $950/mo. **Estimated FTE replaced:** 4.7 (mid-tier GRC analyst @ $90K = ~$1.2M/yr savings). This headline drives the **Agent ROI** dashboard.

### 5.1 Agent UI conventions
- Each agent has a detail page: header (status, type, cost, FTE-saved), tabs for *Runs · Decisions · Tools · Audit · Settings*
- Decisions tab shows: input, output, confidence (%), tools called, HITL state (approved/rejected/auto), latency, cost in cents
- Runs tab shows a stream-style log with collapsible steps (think Linear/Vercel build log)

---

## 6. Hero Tenants (investor-grade seed data)

### 6.1 Maybank Singapore
- Industry: Tier-1 Bank, Singapore
- Frameworks: MAS TRM, MAS Notice 655, ISO 27001, PCI DSS 4.0, DORA, CSRD
- Scale: 340 risks, 1,200 controls, 47 vendors, 12 active audits, 8,400 evidence items, 18 policies
- Hero scenario: MAS Notice 655 update detected by Regulatory Horizon → 7 new control gaps surfaced → Control Mapper assigns to controls → Policy Drafter generates draft amendment → Audit Companion assembles attestation pack

### 6.2 MINDEF Defence Cloud
- Industry: Defence, Singapore
- Frameworks: IM8, ITSG-33, ISO 27001, ISO 22301, NIST 800-53 (sovereign-only)
- Scale: 220 risks, 900 controls, 8 vendors (all SG-resident), 4 audits, 5,200 evidence items
- Hero scenario: Classification banner visible, sovereign-only data flag enforced, NTT Tsuzumi LLM only (no cross-border)

### 6.3 Grab Fintech APAC
- Industry: Multi-jurisdiction fintech (SG, ID, MY, TH, PH, VN, IN)
- Frameworks: MAS, OJK (ID), BNM RMiT (MY), BOT (TH), BSP (PH), RBI (IN), PDPA-SG/MY/TH, PIPL-CN
- Scale: 410 risks, 1,500 controls, 89 vendors, 24 audits, 11,000 evidence items, 4th-party concentration map
- Hero scenario: Cross-jurisdiction risk view, vendor concentration alert (4 critical vendors all on AWS SG)

### 6.4 Shallow tenants (for switcher realism)
Five additional tenants seeded with KPIs only: SingHealth, GovTech, A*STAR, Mediacorp, Singtel.

---

## 7. Database Design (PostgreSQL 16+, multi-schema)

### 7.1 Schemas

```
platform.*    tenants, users, roles, permissions, sessions, api_tokens, audit_log
risk.*        registers, risks, treatments, scenarios, fair_runs, appetite_statements
control.*     library, mappings, tests, test_runs, exceptions, owners
compliance.*  frameworks, requirements, assessments, gaps, attestations
evidence.*    items, attachments, seals (hash chain), collectors, metadata
audit.*       engagements, scopes, findings, recommendations, workpapers
policy.*      documents, versions, acknowledgements, exceptions, distribution_lists
vendor.*      vendors, contracts, questionnaires, responses, fourth_parties, concentrations
privacy.*     processing_activities (RoPA), dpias, subject_requests, breaches
esg.*         metrics, disclosures, targets, ghg_emissions
ai_gov.*      models, model_risk, eu_ai_act_classification, prompts_audit
incident.*    incidents, timeline_events, postmortems, lessons_learned
issue.*       issues, actions, owners
bcm.*         plans, bias, tests, scenarios, dependencies
regwatch.*    sources, changes, impact_assessments, mappings
agent.*       agents, runs, decisions, approvals, tools, telemetry, cost_ledger
workflow.*    definitions, executions, steps, approvals
integration.* connectors, sync_jobs, credentials_meta (no secrets in DB)
```

≈ 50 tables total.

### 7.2 Key design decisions

- **Tamper-evident audit + evidence**: `platform.audit_log` and `evidence.seals` use a hash chain (`prev_hash`, `row_hash`) — same pattern as ntt-cloud-control.
- **Tenant isolation**: every business table has `tenant_id TEXT NOT NULL REFERENCES platform.tenants(id)`. Row-level security policies stubbed but not enabled in demo (mock auth).
- **JSONB for blobs**: vendor questionnaire responses, evidence metadata, agent decision payloads, FAIR scenario configs all stored as JSONB.
- **Time-series**: `risk.fair_runs`, `agent.runs`, `agent.telemetry`, `evidence.items.collected_at` carry timestamps; we store last 90 days with believable density (1–3 events per hour during business hours).
- **Enums**: severity, status, framework, agent_type, decision_outcome, etc. (~25 enums).
- **Views**: `compliance.framework_score`, `risk.heatmap_5x5`, `vendor.tier_breakdown`, `agent.fleet_summary` for dashboard queries.

### 7.3 Files

- `db/init.sql` — schema + enums + tables + views (~1,800 lines)
- `db/seed.sql` — seed data for 3 hero tenants + 5 shallow tenants (~3,500 lines)

---

## 8. Compliance Framework Library (35+)

| Region | Frameworks |
|---|---|
| Global | SOC 2, ISO 27001, ISO 27017, ISO 27018, ISO 27701, ISO 22301, ISO 42001, NIST CSF 2.0, NIST 800-53, NIST AI RMF, PCI DSS 4.0 |
| EU | GDPR, DORA, NIS2, EU AI Act, CSRD |
| Americas | HIPAA, CCPA, SOX, FedRAMP Moderate/High |
| Singapore | MAS TRM, MAS Notice 655, MAS Notice 644, IM8 (GovTech), PDPA-SG |
| APAC banking | HKMA TM-G-1, APRA CPS 234, APRA CPS 230, RBI Cyber Security, OJK POJK 11/03/2022, BNM RMiT, BOT IT Risk, BSP Circular 982 |
| APAC privacy | PIPL (CN), APPI (JP), PIPA (KR), PDPA (TH/MY), Privacy Act (AU) |
| ESG | GHG Protocol, ISSB IFRS S1/S2, TCFD |

Each framework: name, version, regulator, region, total requirements, applicability tags. Top 8 frameworks fully populated with requirements (~50–150 each); others have requirement counts + status only.

---

## 9. Project Structure

```
ntt-grc-hub/
├── README.md
├── Dockerfile
├── docker-compose.yml
├── package.json
├── svelte.config.js
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── db/
│   ├── init.sql
│   ├── seed.sql
│   └── README.md
├── docs/
│   └── superpowers/specs/2026-05-29-ntt-grc-hub-design.md  (this file)
├── static/
│   └── logos/ntt-grc-hub.svg
├── scripts/
│   └── (mirror ntt-cloud-control patterns)
└── src/
    ├── app.css
    ├── app.html
    ├── app.d.ts
    ├── hooks.server.ts
    ├── lib/
    │   ├── components/
    │   │   ├── Sidebar.svelte, TopBar.svelte, Logo.svelte
    │   │   ├── PageHeader.svelte, Kpi.svelte, Sparkline.svelte
    │   │   ├── BarChart.svelte, Donut.svelte, Heatmap5x5.svelte
    │   │   ├── Sankey.svelte, Radar.svelte, LECCurve.svelte
    │   │   ├── AgentCard.svelte, AgentRunLog.svelte, DecisionRow.svelte
    │   │   ├── EvidenceChip.svelte, FrameworkBadge.svelte
    │   │   ├── TenantSwitcher.svelte, CommandPalette.svelte
    │   │   ├── StatusDot.svelte, ProgressBar.svelte, Toast.svelte
    │   │   ├── NavConfig.ts
    │   ├── data/
    │   │   ├── mock.ts                # demo single source of truth
    │   │   ├── tenants/maybank.ts, mindef.ts, grab.ts
    │   │   ├── agents.ts, frameworks.ts, controls.ts
    │   │   ├── risks.ts, vendors.ts, policies.ts, evidence.ts
    │   ├── server/
    │   │   ├── data.ts                # mock|pg dispatcher
    │   │   ├── pg.ts                  # postgres pool
    │   │   ├── sse.ts                 # agent event bus
    │   ├── stores/
    │   │   ├── auth.ts, tenant.ts, sidebar.ts, toast.ts
    │   └── utils/
    │       ├── fair.ts                # Monte Carlo simulation
    │       ├── hash-chain.ts          # evidence sealing
    │       └── csv.ts
    └── routes/
        ├── +layout.server.ts, +layout.svelte
        ├── +page.server.ts, +page.svelte    # Risk Cockpit
        ├── login/
        ├── api/events/+server.ts            # SSE
        ├── board/                            # Board Pack
        ├── stream/                           # Agent Activity Stream
        ├── tenants-compare/                  # MSSP rollup
        ├── risk/                             # ERM Register
        ├── heatmap/                          # Heatmap & FAIR
        ├── issues/, resilience/
        ├── frameworks/, controls/, evidence/, audits/, regwatch/, policies/
        ├── vendors/, questionnaires/, fourth-party/
        ├── privacy/, esg/, ai-gov/, sox/, bcm/
        ├── agents/                           # Agent Fleet (+ /[id])
        ├── decisions/, workflows/, connectors/
        └── admin/{tenants,users,audit,settings}
```

---

## 10. Demo "Wow" Path (20-min walkthrough)

A scripted, time-budgeted demo sequence used to validate the build and structure the seed data:

| # | Time | Action | Why it wows |
|---|---|---|---|
| 1 | 0:30 | Land on **Risk Cockpit (All Tenants)** — MSSP rollup across 3 tenants | Multi-tenant MSSP angle (NTT differentiator) |
| 2 | 1:30 | Switch to **Maybank Singapore** → heatmap shows freshly elevated risk | Live, scoped tenant context |
| 3 | 2:30 | Click into **FAIR scenario** showing $4.2M ALE with LEC curve | Quantitative risk built-in (Archer/MetricStream charge extra) |
| 4 | 4:00 | Open **Agent Fleet** → 10 agents, color-coded by automation type, cost ledger | The moat — incumbents have nothing like this |
| 5 | 5:30 | **Regulatory Horizon** detail page — MAS Notice 655 update detected 11 min ago | "Continuous" not "annual" — agentic |
| 6 | 7:00 | Drill into the change → **Control Mapper** has opened 7 control gaps automatically | Multi-agent handoff visible |
| 7 | 9:00 | **Control Tester** last run failed 3 AWS encryption controls (live data) | Real continuous control testing |
| 8 | 11:00 | **Evidence Vault** — Evidence Collector auto-attached 47 items in last hour; show hash-chain seal | Tamper-evident, blockchain-without-the-blockchain |
| 9 | 13:00 | **Audit Companion** assembles ISO 27001 surveillance audit pack in 8 seconds | Auditor superpower; usually weeks of analyst work |
| 10 | 15:00 | Switch to **MINDEF** — classification banner appears, sovereign-only filter enforced | Sovereign + regulated industry credentials |
| 11 | 16:30 | **Board Narrator** generates live 1-page CEO summary | Executive-grade output from operational data |
| 12 | 18:00 | **Agent ROI** view: 10 agents replaced 4.7 FTE, saved $1.2M/yr | Closes the business case |
| 13 | 19:00 | **Tenant Compare** (MSSP) shows Grab vs Maybank vs MINDEF posture | NTT-as-MSP value |
| 14 | 19:45 | Open **⌘K** → search across risks, controls, evidence, agents | Polish detail |

---

## 11. Implementation Phases

The implementation plan (separate document) will sequence the build in phases:

1. **Foundation** — project scaffold, Tailwind tokens, app shell (sidebar, topbar, tenant switcher), Logo, layout
2. **Database** — `db/init.sql` (all 50 tables, views, enums), `db/seed.sql` (hero tenants)
3. **Mock data layer** — TypeScript fixtures matching DB shape, dual-mode dispatcher
4. **Risk Cockpit (home)** — KPIs, heatmap, live agent stream (SSE), framework scores
5. **Agent Fleet** — agent list, agent detail, runs/decisions/cost — the moat module
6. **Compliance core** — Frameworks, Controls, Evidence Vault, Audits
7. **Enterprise Risk** — ERM Register, Heatmap & FAIR Monte Carlo, Issues, Resilience
8. **Third-Party** — Vendors, Questionnaires, 4th-party concentration
9. **Specialized** — Privacy, ESG, AI Governance, SOX, BCM
10. **Regulatory Horizon + Policy Mgmt**
11. **Admin** — Tenants, Users, Audit Log, Settings
12. **Demo polish** — wow-path tested end-to-end, README, screenshot kit

---

## 12. Non-Goals (explicit)

- Production-ready authentication (stubbed)
- Real LLM calls (curated demo responses)
- Real cloud connector integrations (status simulated)
- Mobile-responsive design beyond "doesn't break on tablet"
- i18n (English only for demo)
- Workflow builder visual editor (the *workflows page* exists; the *editor* is read-only diagram)
- Per-user analytics / usage telemetry beyond what's needed for the audit log

---

## 13. Success Criteria

- [ ] All 20 modules navigable; none returns 404 or empty state in demo
- [ ] Risk Cockpit loads in < 1s with mock data
- [ ] Agent Activity Stream emits at least one event every 10s via SSE
- [ ] The full 20-min wow path runs without console errors
- [ ] Database initializes and seeds cleanly with `npm run db:init && npm run db:seed`
- [ ] `npm run check` passes (svelte-check + tsc)
- [ ] README explains setup, demo path, and competitive positioning in under 5 minutes of reading
- [ ] Visual identity is clearly distinct from ntt-cloud-control (emerald vs blue, slate vs navy)
