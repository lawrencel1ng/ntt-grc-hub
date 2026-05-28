# NTT GRC Hub — Demo Walkthrough

**Audience:** prospect CISO + Head of Risk + procurement.
**Duration:** 20 minutes (15 min demo + 5 min Q&A buffer).
**Setup:** `npm install && npm run dev` → open <http://localhost:5182/> in a clean browser tab. Confirm the top-bar shows "All Tenants" and the live agent chip is animating before you start.

Each step below has four lines:

- **Action** — exactly what to click or type.
- **Point at** — where on screen to draw the eye.
- **Say** — the one-line message the prospect should walk away with.
- **Expected** — what the audience actually sees, so you know you're on track.

---

## Step 1 — Land on the Risk Cockpit (All Tenants rollup) · 0:30

- **Action:** open <http://localhost:5182/>. Do not switch tenant yet.
- **Point at:** top-bar tenant chip ("All Tenants · MSSP"), then sweep across the KPI strip (Open Critical Risks, Avg Compliance Score, FTE saved by agents).
- **Say:** *"This is what NTT sees when we run GRC as a service for multiple regulated tenants. One pane of glass, MSSP-native — none of Archer, MetricStream or ServiceNow IRM can do this out of the box."*
- **Expected:** emerald cockpit with rollup KPIs, 5×5 heatmap, live agent stream pulsing on the right.

## Step 2 — Switch to Maybank Singapore · 1:30

- **Action:** click the tenant chip → choose **Maybank Singapore**. Wait one beat for the page to re-render.
- **Point at:** the heatmap shifting; the framework score row (MAS TRM, MAS Notice 655, ISO 27001, PCI DSS 4.0 visible).
- **Say:** *"Every loader in the app just re-scoped to this tenant. The heatmap, framework scores, top risks — all Maybank-only now. Notice we already have MAS Notice 655 lit up."*
- **Expected:** heatmap re-renders with bank-shaped distribution; tenant chip shows "Maybank Singapore"; numbers in the KPI strip drop to a single-tenant scale.

## Step 3 — FAIR scenario — $4.2M ALE · 2:30

- **Action:** navigate to **`/heatmap`** (sidebar → Enterprise Risk → Heatmap & FAIR).
- **Point at:** the LEC curve and the annualised loss expectancy callout.
- **Say:** *"Monte Carlo, 10,000 trials, built in. Archer and MetricStream charge extra for this; 6clicks doesn't have it at all. Our Risk Quantifier agent re-runs the simulation whenever a contributing risk changes."*
- **Expected:** LEC (Loss Exceedance Curve) renders with a ~S$4.2M ALE annotation and a smooth descending curve from 0–100% probability.

## Step 4 — Agent Fleet (the moat) · 4:00

- **Action:** sidebar → **Agentic OS → Agent Fleet** (`/agents`).
- **Point at:** the 10 agent cards, the type chips (Deterministic / AI-powered / Intelligent), the cost ledger, and the "4.7 FTE replaced · ~S$1.2M/yr saved" headline.
- **Say:** *"Ten named, autonomous agents. Each has a job, a cost, a confidence record and an audit trail. This is the only product in the GRC market with a fleet — competitors have one chatbot at best."*
- **Expected:** ten cards in a grid, every card showing live status dot, cost per month, FTE-equivalent saved, and a small sparkline.

## Step 5 — Regulatory Horizon detail · 5:30

- **Action:** open **`/agents/ag_regwatch`** (click the Regulatory Horizon card).
- **Point at:** the "MAS Notice 655 update detected · 11 min ago" entry at the top of the Decisions tab.
- **Say:** *"Continuous, not annual. Forty-plus regulator sources. The agent classified this change as high-impact and dispatched the handoff in eleven minutes."*
- **Expected:** agent header with type "Intelligent (multi-tool)" and $200/mo cost; a recent decision row about MAS Notice 655.

## Step 6 — Click into the change → Control Mapper opens 7 gaps · 7:00

- **Action:** open **`/regwatch`**, click the **MAS Notice 655** hero card at the top.
- **Point at:** the impact-assessment block showing 7 newly opened control gaps mapped by the Control Mapper agent.
- **Say:** *"This is multi-agent in action. Regulatory Horizon detected the change, Control Mapper instantly mapped it across our control library and opened the gaps. No human in the loop yet — and the audit trail captures every step."*
- **Expected:** regulatory change detail with linked control gaps, owner assignments and a "drafted by ag_mapper" attribution.

## Step 7 — Control Tester last run failed 3 AWS encryption controls · 9:00

- **Action:** open **`/agents/ag_tester`**, scroll to the latest run.
- **Point at:** the run-log entry showing 3 encryption controls failing on an AWS account.
- **Say:** *"This is what continuous control testing looks like — live cloud config, every hour, with the agent interpreting failures into plain-English remediation suggestions."*
- **Expected:** an agent run with a "failed" status badge and an output summary listing three control IDs.

## Step 8 — Evidence Vault, hash-chain seal · 11:00

- **Action:** open **`/evidence`**.
- **Point at:** the "hash chain intact" banner at the top, then the freshest 47 evidence items captured in the last hour.
- **Say:** *"Every item is sealed: prev-hash, row-hash. Tamper-evident without the blockchain hand-waving. The Evidence Collector agent feeds this 24/7 from AWS, Azure, GCP, Okta, Jira, GitHub, M365 and ServiceNow."*
- **Expected:** chain-intact banner in emerald; evidence rows with hash chips you can hover for the seal payload.

## Step 9 — Audit Companion assembles a pack in 8 seconds · 13:00

- **Action:** open **`/audits`**, click into any in-flight ISO 27001 surveillance engagement.
- **Point at:** the auto-generated evidence pack with the "assembled by ag_audit in 8s" attribution; the linked evidence-to-control-to-requirement chain.
- **Say:** *"This used to take a Big Four senior two weeks of evidence-chasing. The Audit Companion does it in eight seconds because everything is already linked in the graph."*
- **Expected:** audit detail with findings table, evidence chips, and the agent attribution chip in the header.

## Step 10 — Switch to MINDEF · 15:00

- **Action:** tenant chip → **MINDEF Defence Cloud**.
- **Point at:** the **red classified banner** that appears across the top of the shell; the tenant chip now shows a shield icon.
- **Say:** *"Sovereign tenant. Classification banner is mandatory. The data slice is in-country only, the LLM is NTT Tsuzumi — no cross-border flows. This is the credential that wins Defence and GovTech."*
- **Expected:** "CLASSIFIED // SOVEREIGN // NTT-MANAGED" banner pinned above the topbar; KPIs and frameworks change to sovereign-only (IM8, ITSG-33, NIST 800-53, ISO 22301).

## Step 11 — Board Narrator generates the CEO summary · 16:30

- **Action:** open **`/board`**.
- **Point at:** the magazine-style 1-page narrative + KPI grid + appendix; the "generated by ag_board · 11 min ago" stamp.
- **Say:** *"Executive output from operational data. The Board Narrator agent runs monthly on a cron and on-demand whenever a director clicks 'refresh'. This is the page the CEO and the chair actually read."*
- **Expected:** clean magazine layout, narrative paragraphs, supporting charts, and a small generation-attribution chip.

## Step 12 — Agent ROI · 18:00

- **Action:** scroll back to **`/agents`** and let the Fleet ROI strip catch the eye, or open the Agent Fleet ROI card on the cockpit.
- **Point at:** total fleet cost (~S$950/mo) vs FTE-equivalent (4.7) vs avoided cost (~S$97,500/mo).
- **Say:** *"One hundred-x ROI on the agent fleet, fully budgeted and audit-trailed. This closes the business case in any boardroom."*
- **Expected:** the three figures rendered as KPIs with the avoided-cost number highlighted.

## Step 13 — Tenant Compare (MSSP) · 19:00

- **Action:** switch back to **All Tenants**, then open **`/tenants-compare`**.
- **Point at:** Maybank vs MINDEF vs Grab posture row-by-row; the column highlighting the highest residual risk per dimension.
- **Say:** *"NTT-as-MSP. We can show every customer their posture, benchmark them privately against the cohort, and surface the cross-tenant risks no single customer can see."*
- **Expected:** comparison grid with three columns of KPIs and a green/amber/red posture chip per row.

## Step 14 — ⌘K palette · 19:45

- **Action:** press **⌘K** (or click the search field in the top bar). Type `mas 655`, then `evidence`, then `ag_regwatch`.
- **Point at:** the unified result list — risks, controls, evidence, agents — all keyboard-navigable.
- **Say:** *"Polish detail — but the kind of polish that GRC analysts feel every day. This is what 'made for operators' means."*
- **Expected:** command palette opens centered, results filter as you type, results are clickable and jump to the right route.

---

## Reset between demos

```bash
# Reset the active tenant cookie back to the All Tenants rollup.
curl -X POST http://localhost:5182/api/tenant \
  -H 'content-type: application/json' \
  -d '{"tenantId":""}'
```

Or simply switch the topbar back to **All Tenants** before the next run-through.
