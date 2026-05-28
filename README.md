# NTT GRC Hub

> **Agentic GRC Operating System — designed by NTT Singapore for regulated APAC enterprises.**

NTT GRC Hub inverts the legacy GRC stack. Where Archer, MetricStream, ServiceNow IRM, OneTrust and 6clicks build top-down from compliance frameworks (audit-shaped tools with risk bolted on), GRC Hub flows reality **up** — controls, evidence, vendors, policies, incidents — through an **agent orchestration layer** to a **risk intelligence layer**. A SOC 2 report, MAS attestation or ISO certificate is a *byproduct* of doing risk management correctly.

This repository is the **interactive demo** of the platform: a SvelteKit application with comprehensive UI/UX, hand-built SVG charts, mock data for three hero tenants, and a full PostgreSQL schema ready to back a production deployment.

**Tagline:** *From audit compliance to continuous risk reduction.*

---

## Highlights

- **Agent Fleet** — 10 named autonomous agents (Evidence Collector, Control Tester, Vendor Risk Analyst, Policy Drafter, Regulatory Horizon, Audit Companion, Risk Quantifier, Incident Investigator, Control Mapper, Board Narrator). Each is a first-class object with status, type, cost, FTE-saved, decisions, tools and HITL queue.
- **Agent ROI dashboard** — fleet runs at ~S$950/mo and replaces ~4.7 FTE (~S$1.2M/yr) — visible in the Risk Cockpit.
- **Risk Cockpit** — KPI strip, 5×5 heatmap, framework scores, live SSE agent stream, top residual risks, recent decisions, board narrative preview.
- **FAIR Monte Carlo quantification** — built-in Risk Quantifier agent, LEC curve, ALE (S$4.2M scenario surfaces from the wow path).
- **Hash-chained Evidence Vault** — every evidence item sealed with `prev_hash`/`row_hash`; tamper-evident chain validates on read.
- **Continuous Control Testing** — Control Tester re-evaluates technical controls every hour against live cloud config.
- **Regulatory Horizon** — multi-tool agent scanning 40+ regulator sources (MAS, APRA, EU, OJK, RBI, etc.) with auto-impact tagging.
- **Audit Companion** — assembles full evidence packs in seconds, linking evidence-to-control-to-requirement.
- **Compliance library — 35+ frameworks** — SOC 2, ISO 27001, MAS TRM, MAS Notice 655, DORA, NIS2, EU AI Act, PCI DSS 4.0, IM8, ITSG-33, NIST 800-53, GDPR, PDPA, PIPL, GHG Protocol, ISSB IFRS S1/S2 and more.
- **Enterprise Risk** — ERM register, treatments, appetite statements, issues, postmortems, operational resilience (DORA / APRA CPS 230).
- **Third-Party / TPRM** — vendor inventory, auto-filled SIG/CAIQ questionnaires, 4th-party concentration graph (AWS ap-southeast-1 alert).
- **Specialized modules** — Privacy (RoPA, DPIA, DSAR, breaches), ESG (CSRD/ISSB/GHG), AI Governance (model registry, EU AI Act, ISO 42001, prompt audit), SOX (ITGC, KCAs, walkthroughs), BCM (plans, BIAs, tests).
- **MSSP-native multi-tenant** — top-bar tenant switcher, "All Tenants" rollup, cross-tenant comparison page, sovereign banner on classified tenants.
- **Sovereign LLM ready** — NTT Tsuzumi endpoint stubbed in; MINDEF tenant is configured for in-country only with no cross-border flow.
- **Board Pack** — Board Narrator agent generates a magazine-style 1-page narrative + KPI grid + risk and framework appendices.
- **Tamper-evident platform audit log** — every admin action sealed in `platform.audit_log`, 7-year retention.

---

## Competitive positioning

| Capability | **NTT GRC Hub** | 6clicks | Archer | MetricStream | ServiceNow IRM | OneTrust |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Named autonomous agents | **10 (fleet)** | 1 (Hailey) | None | None | Workflow only | None |
| Agent ROI dashboard | **Yes** | No | No | No | No | No |
| Hash-chained evidence | **Yes** | No | No | Partial | No | No |
| APAC regulator coverage | **18 frameworks** | ~5 | ~8 | ~10 | ~6 | ~6 |
| Sovereign LLM (NTT Tsuzumi) | **Yes** | No | No | No | No | No |
| FAIR Monte Carlo built-in | **Yes** | Add-on | Add-on | Yes | No | No |
| Multi-tenant MSSP-native | **Yes** | Partial | No | No | Partial | No |
| Tier-1 carrier integration | **Yes (AS2914)** | No | No | No | No | No |

**The NTT moat:** the only vendor combining (a) a Tier-1 global carrier (AS2914), (b) sovereign datacenters in Singapore, (c) a sovereign LLM (Tsuzumi), (d) a global managed-services arm, and (e) a 10-agent autonomous GRC fleet — under one roof.

---

## Visual identity

Emerald-and-slate palette (`#047857` primary, slate-900 sidebar) — deliberately distinct from the navy-blue **NTT Cloud Control** sibling product. Agent moments glow in violet (`#a855f7`); risk states use amber→rose. Sidebar gradient runs `from-slate-900 via-slate-800 to-slate-900`. Wordmark: Inter 600, tracking -0.01em.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend framework | **SvelteKit 2** with **Svelte 5** runes, TypeScript |
| Styling | **Tailwind CSS 3** with emerald/slate design tokens |
| Icons | Lucide-svelte + custom inline SVG agent glyphs |
| Charts | Hand-built SVG — bar, line, sparkline, donut, gauge, **5×5 heatmap**, **sankey**, **radar**, **FAIR LEC curve** (zero JS-runtime dependencies) |
| Database | **PostgreSQL 16+** (schema in `db/init.sql`, seed in `db/seed.sql`) |
| Data layer | Dual-mode: TypeScript fixtures (default) + Postgres-backed routes (via `DATA_MODE=pg`) |
| Realtime | Server-Sent Events (`/api/events`) for agent stream |
| Auth | Stubbed (demo); 6 RBAC roles ready for OIDC/SAML swap |
| AI runtime | Stub returning curated responses; UI wired for NTT Tsuzumi or Anthropic Claude |
| Port | **5182** (5181 reserved by NTT Cloud Control) |
| Packaging | Docker + docker-compose |

---

## Project structure

```
ntt-grc-hub/
├── README.md
├── Dockerfile
├── docker-compose.yml
├── package.json
├── svelte.config.js · vite.config.ts · tsconfig.json
├── tailwind.config.ts · postcss.config.js
├── db/
│   ├── init.sql        # ~50 tables across 17 schemas + views + enums
│   └── seed.sql        # 3 hero tenants + 5 shallow tenants
├── docs/
│   └── superpowers/    # specs/ and plans/
├── scripts/
│   └── demo-walkthrough.md   # 20-min presenter script
├── static/
│   └── logos/ntt-grc-hub.svg
└── src/
    ├── app.css · app.html · app.d.ts
    ├── hooks.server.ts       # demo auth + tenant cookie
    ├── lib/
    │   ├── components/       # Sidebar, TopBar, TenantSwitcher,
    │   │                     # Heatmap5x5, LECCurve, Sankey, Radar,
    │   │                     # AgentCard, EvidenceChip, ClassifiedBanner, …
    │   ├── data/             # Mock fixtures (tenant slices, agents,
    │   │                     # risks, controls, vendors, evidence, …)
    │   ├── server/           # data.ts dispatcher · pg.ts pool · sse.ts
    │   ├── stores/           # tenant, sidebar, toast, auth
    │   └── utils/            # fair.ts · hash-chain.ts · csv.ts
    └── routes/
        ├── +layout.{server.ts,svelte}     # shell + classified banner
        ├── +page.{server.ts,svelte}       # Risk Cockpit
        ├── api/{events,tenant}/+server.ts
        ├── board/ · stream/ · tenants-compare/
        ├── risk/ · heatmap/ · issues/ · resilience/
        ├── frameworks/ · controls/ · evidence/ · audits/
        ├── regwatch/ · policies/
        ├── vendors/ · questionnaires/ · fourth-party/
        ├── privacy/ · esg/ · ai-gov/ · sox/ · bcm/
        ├── agents/ · decisions/ · workflows/ · connectors/
        └── admin/{tenants,users,audit,settings}
```

---

## Demo walkthrough

See [`scripts/demo-walkthrough.md`](scripts/demo-walkthrough.md) for the full 20-minute presenter script with click-by-click instructions for the **wow path**: Risk Cockpit → Maybank → FAIR $4.2M ALE → Agent Fleet → Regulatory Horizon (MAS Notice 655) → Control Mapper → Control Tester → Evidence Vault → Audit Companion → MINDEF (classified banner) → Board Narrator → Agent ROI → Tenant Compare → ⌘K.

---

## Setup

```bash
# 1. Install
git clone <repo>  ntt-grc-hub && cd ntt-grc-hub
npm install

# 2. Run the demo (mock-data mode — no database required)
npm run dev
# → open http://localhost:5182/

# 3. (Optional) Bring up the Postgres-backed mode
createdb ntt_grc_hub
npm run db:init      # psql -f db/init.sql
npm run db:seed      # psql -f db/seed.sql
DATA_MODE=pg npm run dev
```

### Docker

```bash
# Bring up the app + Postgres (DB auto-seeds on first boot).
docker compose up -d --build
# → open http://localhost:5182/
```

---

## Configuration

`.env` keys (see `.env.example`):

| Variable | Default | Purpose |
|---|---|---|
| `DATA_MODE` | `mock` | Set to `pg` to use the Postgres backend; anything else uses in-memory fixtures |
| `DATABASE_URL` | `postgres://localhost:5432/ntt_grc_hub` | Connection string when `DATA_MODE=pg` |
| `SESSION_SECRET` | `demo-secret-rotate-in-prod` | Cookie signing secret — rotate for any non-demo use |
| `TSUZUMI_ENDPOINT` | `stub` | NTT Tsuzumi LLM endpoint; `stub` returns curated demo responses |
| `NODE_ENV` | `development` | Standard Node env |

---

## Status

This is the **interactive demo** — every screen is wired with realistic data, agents emit believable telemetry, and the wow path runs end-to-end. The PostgreSQL schema and front-end are production-ready; `src/lib/server/data.ts` is a drop-in dispatcher between mock and Postgres backends.

© 2026 NTT Singapore. Demo build.
