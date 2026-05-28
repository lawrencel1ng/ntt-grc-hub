<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import Radar from '$lib/components/Radar.svelte';
  import Sankey from '$lib/components/Sankey.svelte';
  import BarChart from '$lib/components/BarChart.svelte';
  import AgentTypeBadge from '$lib/components/AgentTypeBadge.svelte';
  import { addToast } from '$lib/stores/toast';
  import { formatIsoSgt } from '$lib/utils/dates';
  import {
    Sparkles, Download, Printer, Bot, FileBarChart, AlertTriangle, ShieldCheck,
    Building2, Activity, DollarSign, TrendingUp, Calendar
  } from 'lucide-svelte';
  import type {
    Risk, RiskSeverity, RiskLikelihood, Concentration, Vendor, FAIRScenario
  } from '$lib/data/types';

  export let data;

  // ---------- Generated metadata ----------
  // The board pack is a snapshot — pin its "generated at" 11 minutes ago to
  // match the spec's wow-path step 11 ("Board Narrator generates 1-page CEO
  // summary live · 11 min ago").
  const generatedAt = new Date(Date.now() - 11 * 60_000);
  const month = generatedAt.toLocaleString('en-SG', { month: 'long', year: 'numeric' });
  const tenantName = data.tenant?.name ?? 'Group';

  // ---------- Sev/Lik helpers ----------
  const SEV_RANK: Record<RiskSeverity, number> = { info: 1, low: 2, medium: 3, high: 4, critical: 5 };
  const LIK_RANK: Record<RiskLikelihood, number> = { rare: 1, unlikely: 2, possible: 3, likely: 4, 'almost-certain': 5 };
  function residual(r: Risk): number { return SEV_RANK[r.residualSeverity] * LIK_RANK[r.residualLikelihood]; }
  function sevCls(sev: RiskSeverity): string {
    switch (sev) {
      case 'critical': return 'bg-rose-50 text-rose-700 ring-rose-200';
      case 'high':     return 'bg-orange-50 text-orange-700 ring-orange-200';
      case 'medium':   return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'low':      return 'bg-violet-50 text-violet-700 ring-violet-200';
      default:         return 'bg-slate-100 text-slate-700 ring-slate-200';
    }
  }
  function treatmentCls(t: string): string {
    switch (t) {
      case 'mitigate': return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'transfer': return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'accept':   return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'avoid':    return 'bg-violet-50 text-violet-700 ring-violet-200';
      default:         return 'bg-slate-100 text-slate-700 ring-slate-200';
    }
  }

  // ---------- ALE per risk: look up most material scenario for the risk;
  // fall back to a deterministic estimate scaled by residual rank. ----------
  function aleForRisk(r: Risk): number {
    const scn = data.scenarios.find((s: FAIRScenario) => s.riskId === r.id);
    if (scn) {
      // Use scenario's magnitude mode as a proxy when no run is wired here.
      const mid = scn.magnitudeDist.mode ?? scn.magnitudeDist.mean ?? 750_000;
      const freq = scn.frequencyDist.mode ?? scn.frequencyDist.mean ?? 0.5;
      return Math.round(mid * freq);
    }
    // Deterministic fallback so the card always renders a number.
    const rank = residual(r);
    return Math.round((rank / 25) * 4_200_000);
  }
  function fmtAle(n: number): string {
    if (n >= 1e6) return `S$${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `S$${Math.round(n / 1e3)}K`;
    return `S$${n}`;
  }

  // ---------- Narrative ----------
  $: paragraphs = data.narrative
    .split('\n')
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 0 && !s.startsWith('**'));

  // ---------- Radar — top 8 frameworks current vs target ----------
  $: top8 = data.frameworks.slice(0, 8);
  $: radarAxes = top8.map((f) => f.name.length > 16 ? f.name.slice(0, 14) + '…' : f.name);
  $: radarSeries = [
    { name: 'Current', color: '#6d28d9', values: top8.map((f) => f.score ?? 0) },
    { name: 'Target', color: '#d946ef', values: top8.map(() => 90) }
  ];

  // ---------- Sankey — vendor concentration ----------
  // Source column: dimension (cloud / region / processor)
  // Middle column: concentration key (e.g. AWS, ap-southeast-1)
  // Right column: exposure tier bucket (we map dollars to bucket labels).
  function exposureBucket(sgd: number): { id: string; name: string } {
    if (sgd >= 8_000_000) return { id: 'b-critical', name: 'Critical (> S$8M)' };
    if (sgd >= 3_000_000) return { id: 'b-high',     name: 'High (S$3–8M)' };
    if (sgd >= 1_000_000) return { id: 'b-medium',   name: 'Medium (S$1–3M)' };
    return { id: 'b-low', name: 'Low (< S$1M)' };
  }
  $: sankeyData = (() => {
    const conc: Concentration[] = data.concentrations.slice(0, 10);
    const nodes: { id: string; name: string; column: 0 | 1 | 2 }[] = [];
    const links: { source: string; target: string; value: number; color?: string }[] = [];
    const seen = new Set<string>();
    const dims = Array.from(new Set(conc.map((c) => c.dimension)));
    for (const d of dims) {
      const id = `dim:${d}`;
      nodes.push({ id, name: d.toUpperCase(), column: 0 });
      seen.add(id);
    }
    for (const c of conc) {
      const midId = `key:${c.dimension}:${c.key}`;
      if (!seen.has(midId)) {
        nodes.push({ id: midId, name: c.key, column: 1 });
        seen.add(midId);
      }
      const b = exposureBucket(c.exposureSgd);
      if (!seen.has(b.id)) {
        nodes.push({ id: b.id, name: b.name, column: 2 });
        seen.add(b.id);
      }
      const v = Math.max(1, c.vendorCount);
      const color = c.exposureSgd >= 8_000_000 ? '#e11d48'
                   : c.exposureSgd >= 3_000_000 ? '#f97316'
                   : c.exposureSgd >= 1_000_000 ? '#f59e0b' : '#8b5cf6';
      links.push({ source: `dim:${c.dimension}`, target: midId, value: v, color });
      links.push({ source: midId, target: b.id, value: v, color });
    }
    return { nodes, links };
  })();

  // ---------- Resilience snapshot KPIs ----------
  $: totalIBS = data.plans.length;
  $: withinRto = data.planRows.filter((r) => {
    const last = r.tests[0];
    return last && (last.result === 'pass' || last.result === 'partial');
  }).length;
  $: withinRtoPct = totalIBS ? Math.round((withinRto / totalIBS) * 100) : 0;
  $: testsYTD = data.planRows.reduce((s, r) => {
    const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
    return s + r.tests.filter((t) => new Date(t.conductedAt).getTime() >= yearStart).length;
  }, 0);
  $: drillsPassed = data.planRows.reduce((s, r) =>
    s + r.tests.filter((t) => t.result === 'pass').length, 0);
  // Concentration risk: % of vendor exposure in the top concentration vs total
  $: concentrationPct = (() => {
    const total = data.concentrations.reduce((s, c) => s + c.exposureSgd, 0) || 1;
    const top = Math.max(...data.concentrations.map((c) => c.exposureSgd), 0);
    return Math.round((top / total) * 100);
  })();

  // ---------- Critical vendors snapshot ----------
  $: criticalVendors = data.vendors
    .filter((v: Vendor) => v.criticality === 'critical')
    .slice(0, 5);

  // ---------- Agent ROI ----------
  $: fleetCostMonthly = data.agents.reduce((s, a) => s + (a.costMonthlyEstimateCents ?? 0), 0) / 100;
  $: totalFteHours30d = data.fleet.reduce((s, x) => s + (x.fteHours30d ?? 0), 0);
  $: fteSaved = +(totalFteHours30d / 160).toFixed(1);
  // S$120 fully-loaded cost per FTE-hour; 30d → annual via *12/30
  $: annualSavings = Math.round((totalFteHours30d * 120 * 12) / 30);

  $: roiBarLabels = data.agents.map((a) => a.name.split(' ')[0]).slice(0, 10);
  $: roiBarSeries = (() => {
    const costMap = new Map<string, { cost: number; fte: number }>();
    for (const e of data.cost30d) {
      const prev = costMap.get(e.agentId) ?? { cost: 0, fte: 0 };
      costMap.set(e.agentId, { cost: prev.cost + e.costCents, fte: prev.fte + e.fteSavedHours });
    }
    const cost = data.agents.slice(0, 10).map((a) => Math.round((costMap.get(a.id)?.cost ?? 0) / 100));
    const fte = data.agents.slice(0, 10).map((a) => Math.round(costMap.get(a.id)?.fte ?? 0));
    return [
      { name: 'Cost (S$)', color: '#6d28d9', data: cost },
      { name: 'FTE-hours saved', color: '#d946ef', data: fte }
    ];
  })();

  // ---------- Actions ----------
  function onPrint() {
    addToast('info', 'Print dialog would open here (demo). Layout is print-ready.');
  }
  function onDownload() {
    addToast('info', 'PDF export would be generated server-side (demo).');
  }

  function fmtRel(ts: Date): string {
    const diff = Math.floor((Date.now() - ts.getTime()) / 60_000);
    return `${diff} min ago`;
  }
</script>

<PageHeader title="Board Pack" subtitle="Pre-rendered, board-ready risk report for {tenantName}.">
  <svelte:fragment slot="actions">
    <button class="btn-secondary" on:click={onPrint}>
      <Printer class="h-4 w-4" />
      <span>Print</span>
    </button>
    <button class="btn-primary" on:click={onDownload}>
      <Download class="h-4 w-4" />
      <span>Download PDF</span>
    </button>
  </svelte:fragment>
</PageHeader>

<div class="mx-auto max-w-5xl px-2 sm:px-4">
  <!-- ============================================================ -->
  <!-- Cover strip — sober board document                            -->
  <!-- ============================================================ -->
  <div class="relative overflow-hidden rounded-xl bg-white px-8 py-7 ring-1 ring-inset ring-slate-200" style="border-top: 4px solid #6d28d9;">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="min-w-0">
        <div class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          NTT GRC Hub · Board Risk Pack
        </div>
        <h2 class="font-serif text-3xl font-bold leading-tight text-grc-ink">
          Board Risk Pack — {month}
        </h2>
        <p class="mt-1 text-sm text-slate-500">{tenantName} · Confidential to the Board of Directors</p>
      </div>
      <div class="flex items-center gap-3">
        <AgentTypeBadge type="intelligent" />
        <div class="rounded-md bg-slate-50 px-3 py-2 text-right ring-1 ring-inset ring-slate-200">
          <div class="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
            <Sparkles class="h-3 w-3 text-violet-600" />
            Generated by Board Narrator
          </div>
          <div class="mt-0.5 text-[11px] text-slate-500">7 min read · {fmtRel(generatedAt)}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ============================================================ -->
  <!-- 1. Executive Summary                                          -->
  <!-- ============================================================ -->
  <section class="card mt-8 p-8 lg:p-10">
    <header class="mb-5 flex items-baseline justify-between border-b border-slate-200 pb-3">
      <div>
        <div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-grc-primary">Section 01</div>
        <h3 class="mt-1 font-serif text-2xl font-bold text-grc-ink">Executive Summary</h3>
      </div>
      <span class="text-xs text-slate-400">May 2026 · Pages 1 of 6</span>
    </header>
    <div class="space-y-4 text-slate-700" style="line-height: 1.7;">
      {#each paragraphs as p, i}
        <p class="{i === 0 ? 'text-lg font-medium text-slate-900 first-letter:float-left first-letter:mr-2 first-letter:font-serif first-letter:text-5xl first-letter:font-bold first-letter:leading-none first-letter:text-grc-primary' : 'text-[15px]'}">
          {p}
        </p>
      {/each}
    </div>
  </section>

  <!-- ============================================================ -->
  <!-- 2. Top 5 Risks                                                -->
  <!-- ============================================================ -->
  <section class="card mt-8 p-8 lg:p-10">
    <header class="mb-5 flex items-baseline justify-between border-b border-slate-200 pb-3">
      <div>
        <div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-grc-primary">Section 02</div>
        <h3 class="mt-1 font-serif text-2xl font-bold text-grc-ink">Top 5 Risks (Residual)</h3>
      </div>
      <span class="text-xs text-slate-400">Quantified by Risk Quantifier · FAIR</span>
    </header>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      {#each data.topRisks.slice(0, 5) as r, i}
        {@const ale = aleForRisk(r)}
        {@const rank = residual(r)}
        <div class="rounded-xl bg-white p-5 ring-1 ring-inset ring-slate-200 {i === 0 ? 'md:col-span-2 ring-violet-300' : ''}">
          <div class="mb-2 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="rounded-md bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">#{i + 1}</span>
              <span class="font-mono text-[11px] text-slate-500">{r.code}</span>
              <span class="rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset {sevCls(r.residualSeverity)}">
                {r.residualSeverity} · {rank}
              </span>
            </div>
            <span class="rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset {treatmentCls(r.treatmentStrategy)}">
              {r.treatmentStrategy}
            </span>
          </div>
          <h4 class="mb-2 {i === 0 ? 'text-xl font-semibold' : 'text-base font-semibold'} text-slate-900">
            {r.title}
          </h4>
          {#if i === 0 && r.description}
            <p class="mb-3 text-sm text-slate-600">{r.description}</p>
          {/if}
          <div class="flex flex-wrap items-baseline gap-4 text-xs text-slate-500">
            <div>
              <div class="text-[10px] uppercase tracking-wider text-slate-400">Residual ALE</div>
              <div class="font-mono text-lg font-bold text-grc-primary">{fmtAle(ale)}</div>
            </div>
            <div>
              <div class="text-[10px] uppercase tracking-wider text-slate-400">Owner</div>
              <div class="text-sm font-medium text-slate-700">{r.ownerUserId ?? 'Risk Office'}</div>
            </div>
            <div>
              <div class="text-[10px] uppercase tracking-wider text-slate-400">Category</div>
              <div class="text-sm font-medium text-slate-700">{r.category}</div>
            </div>
            {#if r.businessService}
              <div>
                <div class="text-[10px] uppercase tracking-wider text-slate-400">Business Service</div>
                <div class="text-sm font-medium text-slate-700">{r.businessService}</div>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </section>

  <!-- ============================================================ -->
  <!-- 3. Compliance Posture                                         -->
  <!-- ============================================================ -->
  <section class="card mt-8 p-8 lg:p-10">
    <header class="mb-5 flex items-baseline justify-between border-b border-slate-200 pb-3">
      <div>
        <div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-grc-primary">Section 03</div>
        <h3 class="mt-1 font-serif text-2xl font-bold text-grc-ink">Compliance Posture</h3>
      </div>
      <span class="text-xs text-slate-400">Top 8 frameworks · Current vs target 90</span>
    </header>
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div class="lg:col-span-3">
        <Radar axes={radarAxes} series={radarSeries} maxValue={100} height={360} />
      </div>
      <div class="lg:col-span-2 flex flex-col justify-center">
        <div class="rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-200">
          <div class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Aggregate Score</div>
          <div class="mt-1 font-mono text-[26px] font-semibold tracking-tight text-grc-primary">{data.kpis.avgComplianceScore.toFixed(1)}<span class="text-base text-slate-400">/100</span></div>
          <div class="mt-1 text-xs text-violet-700">+3.2 vs prior quarter</div>
        </div>
        <p class="mt-4 text-sm text-slate-600 leading-relaxed">
          <span class="font-semibold text-slate-800">8 of 35 frameworks tracked closely;</span>
          27 others sit at a routine cadence with Audit Companion sweeps quarterly.
          SOC 2 Type II, ISO 27001:2022 and MAS TRM remain green. PCI DSS 4.0
          readiness has lifted 6 points after Control Tester closed three KMS-rotation
          gaps this cycle.
        </p>
      </div>
    </div>
  </section>

  <!-- ============================================================ -->
  <!-- 4. Third-Party Concentration                                  -->
  <!-- ============================================================ -->
  <section class="card mt-8 p-8 lg:p-10">
    <header class="mb-5 flex items-baseline justify-between border-b border-slate-200 pb-3">
      <div>
        <div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-grc-primary">Section 04</div>
        <h3 class="mt-1 font-serif text-2xl font-bold text-grc-ink">Third-Party Concentration</h3>
      </div>
      <span class="text-xs text-slate-400">{data.concentrations.length} concentrations · {data.vendors.length} vendors</span>
    </header>
    <div class="rounded-xl bg-slate-50/60 p-4 ring-1 ring-inset ring-slate-200">
      <Sankey nodes={sankeyData.nodes} links={sankeyData.links} height={420} />
    </div>
    <p class="mt-4 text-sm text-slate-600 leading-relaxed">
      <span class="font-semibold text-slate-800">Concentration on AWS ap-southeast-1</span>
      remains the single largest watch item, with {data.concentrations[0]?.vendorCount ?? 22} vendors and roughly
      <span class="font-mono">S${((data.concentrations[0]?.exposureSgd ?? 11_500_000) / 1_000_000).toFixed(1)}M</span>
      of total exposure. A vendor exit-plan workstream is recommended for the next quarter to
      lift the concentration risk below 40%.
    </p>
  </section>

  <!-- ============================================================ -->
  <!-- 5. Resilience Snapshot                                        -->
  <!-- ============================================================ -->
  <section class="card mt-8 p-8 lg:p-10">
    <header class="mb-5 flex items-baseline justify-between border-b border-slate-200 pb-3">
      <div>
        <div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-grc-primary">Section 05</div>
        <h3 class="mt-1 font-serif text-2xl font-bold text-grc-ink">Operational Resilience Snapshot</h3>
      </div>
      <span class="text-xs text-slate-400">DORA · APRA CPS 230 · MAS 658</span>
    </header>
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi label="IBS Within RTO" value={withinRtoPct.toString()} suffix="%" hint="{withinRto}/{totalIBS} services">
        <ShieldCheck slot="icon" class="h-4 w-4 text-violet-600" />
      </Kpi>
      <Kpi label="BCM Tests YTD" value={testsYTD.toString()} hint="all plan kinds">
        <Calendar slot="icon" class="h-4 w-4 text-grc-primary" />
      </Kpi>
      <Kpi label="Drills Passed" value={drillsPassed.toString()} hint="pass-result tests">
        <Activity slot="icon" class="h-4 w-4 text-violet-600" />
      </Kpi>
      <Kpi label="Concentration Risk" value={concentrationPct.toString()} suffix="%" tone="bad" hint="top concentration share">
        <AlertTriangle slot="icon" class="h-4 w-4 text-rose-600" />
      </Kpi>
    </div>
    <div class="mt-5 overflow-hidden rounded-xl border border-slate-200">
      <table class="min-w-full divide-y divide-slate-100 text-sm">
        <thead class="thead">
          <tr>
            <th class="px-3 py-2 text-left">Business Service</th>
            <th class="px-3 py-2 text-left">RTO</th>
            <th class="px-3 py-2 text-left">RPO</th>
            <th class="px-3 py-2 text-left">Last Test</th>
            <th class="px-3 py-2 text-left">Result</th>
          </tr>
        </thead>
        <tbody>
          {#each data.planRows.slice(0, 5) as r}
            {@const last = r.tests[0]}
            <tr class="tr">
              <td class="td font-medium">{r.plan.businessService}</td>
              <td class="td font-mono text-xs">{r.plan.rtoMinutes >= 60 ? `${Math.round(r.plan.rtoMinutes / 60)}h` : `${r.plan.rtoMinutes}m`}</td>
              <td class="td font-mono text-xs">{r.plan.rpoMinutes >= 60 ? `${Math.round(r.plan.rpoMinutes / 60)}h` : `${r.plan.rpoMinutes}m`}</td>
              <td class="td text-xs text-slate-500">{r.plan.lastTestedAt ? formatIsoSgt(r.plan.lastTestedAt).slice(0, 10) : '—'}</td>
              <td class="td">
                {#if last}
                  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset {last.result === 'pass' ? 'bg-violet-50 text-violet-700 ring-violet-200' : last.result === 'partial' ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-rose-50 text-rose-700 ring-rose-200'}">
                    {last.result}
                  </span>
                {:else}
                  <span class="text-xs text-slate-400">—</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <!-- ============================================================ -->
  <!-- 6. Agent ROI Summary                                          -->
  <!-- ============================================================ -->
  <section class="card mt-8 overflow-hidden p-0 lg:p-0">
    <div class="bg-white p-8 lg:p-10">
      <header class="mb-5 flex items-baseline justify-between border-b border-slate-200 pb-3">
        <div>
          <div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-700">Section 06</div>
          <h3 class="mt-1 font-serif text-2xl font-bold text-grc-ink">Agent ROI Summary</h3>
        </div>
        <span class="text-xs text-slate-400">10 named agents · 30-day window</span>
      </header>
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div class="rounded-xl bg-white p-4 ring-1 ring-inset ring-slate-200/70">
          <div class="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Annual Savings</div>
          <div class="mt-1 font-mono text-[26px] font-semibold tracking-tight text-violet-700">
            S${(annualSavings / 1_000_000).toFixed(1)}M
          </div>
          <div class="mt-1 text-[11px] text-slate-500">avoided fully-loaded FTE cost</div>
        </div>
        <div class="rounded-xl bg-white p-4 ring-1 ring-inset ring-slate-200/70">
          <div class="text-[10px] font-semibold uppercase tracking-wider text-slate-500">FTE Replaced</div>
          <div class="mt-1 font-mono text-[26px] font-semibold tracking-tight text-violet-700">{fteSaved}</div>
          <div class="mt-1 text-[11px] text-slate-500">@ 160 hrs/FTE</div>
        </div>
        <div class="rounded-xl bg-white p-4 ring-1 ring-inset ring-slate-200/70">
          <div class="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Monthly Fleet Cost</div>
          <div class="mt-1 font-mono text-[26px] font-semibold tracking-tight text-slate-800">
            S${Math.round(fleetCostMonthly).toLocaleString()}
          </div>
          <div class="mt-1 text-[11px] text-slate-500">all 10 agents · capped</div>
        </div>
        <div class="rounded-xl bg-white p-4 ring-1 ring-inset ring-slate-200/70">
          <div class="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Fleet Uptime</div>
          <div class="mt-1 font-mono text-[26px] font-semibold tracking-tight text-violet-700">99.2%</div>
          <div class="mt-1 text-[11px] text-slate-500">30-day SLA</div>
        </div>
      </div>

      <div class="mt-6 rounded-xl bg-white p-5 ring-1 ring-inset ring-slate-200/70">
        <div class="mb-3 flex items-baseline justify-between">
          <h4 class="text-sm font-semibold text-slate-800">Cost vs FTE-hours Saved (per agent · 30d)</h4>
          <span class="text-xs text-slate-400">side-by-side</span>
        </div>
        <BarChart labels={roiBarLabels} series={roiBarSeries} stacked={false} height={220} />
      </div>

      <p class="mt-5 text-[11px] leading-relaxed text-slate-500">
        Powered by 10 named agents — <span class="font-medium text-slate-700">Evidence Collector,
        Control Tester, Vendor Risk Analyst, Policy Drafter, Regulatory Horizon, Audit Companion,
        Risk Quantifier, Incident Investigator, Control Mapper, Board Narrator.</span>
        Run-rate cost of approximately S${Math.round(fleetCostMonthly).toLocaleString()} per month against an avoided
        cost of ~S${Math.round((annualSavings / 12) / 1000).toLocaleString()}K per month — a
        <span class="font-semibold text-violet-700">{Math.round((annualSavings / 12) / Math.max(fleetCostMonthly, 1))}× ROI</span>.
      </p>
    </div>
  </section>

  <!-- Magazine footer -->
  <div class="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-[11px] text-slate-400">
    <div class="flex items-center gap-2">
      <Bot class="h-3.5 w-3.5 text-violet-500" />
      <span>Generated by Board Narrator · Tsuzumi · {formatIsoSgt(generatedAt.toISOString())}</span>
    </div>
    <div>Confidential — Board of Directors only · NTT GRC Hub · v1.0.0-demo</div>
  </div>
</div>
