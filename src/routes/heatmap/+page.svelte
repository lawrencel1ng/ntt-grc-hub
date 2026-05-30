<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Heatmap5x5 from '$lib/components/Heatmap5x5.svelte';
  import LECCurve from '$lib/components/LECCurve.svelte';
  import Gauge from '$lib/components/Gauge.svelte';
  import AgentTypeBadge from '$lib/components/AgentTypeBadge.svelte';
  import { addToast } from '$lib/stores/toast';
  import { runFAIR } from '$lib/utils/fair';
  import { goto } from '$app/navigation';
  import { Calculator, AlertTriangle, ChevronRight, Bot } from 'lucide-svelte';
  import type { Risk, RiskSeverity, RiskLikelihood, HeatmapCell, FAIRScenario } from '$lib/data/types';

  export let data;

  // ---------- Score conversions ----------
  const SEV_RANK: Record<RiskSeverity, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
  const LIK_RANK: Record<RiskLikelihood, number> = { 'almost-certain': 5, likely: 4, possible: 3, unlikely: 2, rare: 1 };
  const SEV_FROM: Record<number, RiskSeverity> = { 5: 'critical', 4: 'high', 3: 'medium', 2: 'low', 1: 'info' };
  const LIK_FROM: Record<number, RiskLikelihood> = { 5: 'almost-certain', 4: 'likely', 3: 'possible', 2: 'unlikely', 1: 'rare' };

  $: numericHeatmap = data.cells.map((c: HeatmapCell) => ({
    sev: SEV_RANK[c.sev],
    lik: LIK_RANK[c.lik],
    n: c.n
  }));

  // ---------- Cell selection ----------
  let selectedSev: number | null = null;
  let selectedLik: number | null = null;

  function handleCellClick(sev: number, lik: number) {
    if (selectedSev === sev && selectedLik === lik) {
      selectedSev = null;
      selectedLik = null;
    } else {
      selectedSev = sev;
      selectedLik = lik;
    }
  }

  $: cellRisks = (selectedSev === null || selectedLik === null) ? [] : data.risks.filter((r: Risk) =>
    SEV_RANK[r.residualSeverity] === selectedSev &&
    LIK_RANK[r.residualLikelihood] === selectedLik
  );

  // ---------- Appetite — average residual score per category as 0..100 ----------
  function avgScoreForCategory(cat: string): number {
    const risksInCat = data.risks.filter((r: Risk) => r.category === cat);
    if (risksInCat.length === 0) return 0;
    const sum = risksInCat.reduce((s: number, r: Risk) => s + SEV_RANK[r.residualSeverity] * LIK_RANK[r.residualLikelihood], 0);
    return Math.round((sum / risksInCat.length / 25) * 100);
  }

  // ---------- FAIR — compute the curve client-side from the run percentiles
  //  (so we always have a curve even if the stored run is sparse).
  $: scenarioCurve = (() => {
    if (!data.selectedScenario) return [];
    const out = runFAIR({
      trials: 10_000,
      seed: `scn-${data.selectedScenario.id}`,
      frequencyDist: data.selectedScenario.frequencyDist,
      magnitudeDist: data.selectedScenario.magnitudeDist
    });
    return out.lecCurve;
  })();

  // The displayed percentile/ALE values prefer the pre-computed run when
  // present (hero scenario hits the curated S$4.2M ALE). Otherwise the
  // freshly computed run is used.
  $: derivedRun = (() => {
    if (!data.selectedScenario) return null;
    return runFAIR({
      trials: 10_000,
      seed: `scn-${data.selectedScenario.id}`,
      frequencyDist: data.selectedScenario.frequencyDist,
      magnitudeDist: data.selectedScenario.magnitudeDist
    });
  })();

  $: displayPercentiles = data.fair?.lecPercentiles ?? (derivedRun ? {
    p10: derivedRun.percentiles.p10,
    p25: derivedRun.percentiles.p25,
    p50: derivedRun.percentiles.p50,
    p75: derivedRun.percentiles.p75,
    p90: derivedRun.percentiles.p90,
    p95: derivedRun.percentiles.p95,
    p99: derivedRun.percentiles.p99
  } : null);
  $: displayAle = data.fair?.aleSgd ?? derivedRun?.ale ?? 0;
  $: displayAro = data.fair?.aro ?? derivedRun?.aro ?? 0;
  $: displayRunAt = data.fair?.runAt ?? new Date().toISOString();

  function fmtMoney(n: number, currency = 'SGD'): string {
    if (n >= 1e9) return `${currency} ${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `${currency} ${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `${currency} ${(n / 1e3).toFixed(0)}K`;
    return `${currency} ${n.toFixed(0)}`;
  }

  function fmtRel(iso?: string): string {
    if (!iso) return '—';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60)   return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  function selectScenario(s: FAIRScenario) {
    goto(`/heatmap?scenario=${encodeURIComponent(s.id)}`, { keepFocus: true, noScroll: true });
  }

  async function runQuant() {
    const res = await fetch('/api/heatmap/run-quant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) {
      addToast('success', 'Risk Quantifier agent queued. Re-running 10k-trial Monte Carlo for all scenarios.');
    } else {
      const msg = await res.text().catch(() => '');
      addToast('error', msg || 'Failed to queue FAIR quantification.');
    }
  }
</script>

<PageHeader title="Risk Heatmap & FAIR Quantification" subtitle="{numericHeatmap.reduce((s, c) => s + c.n, 0).toLocaleString()} residual risks placed · {data.scenarios.length} scenarios · {data.isAll ? 'aggregated view' : data.effectiveTenantId}">
  <svelte:fragment slot="actions">
    <AgentTypeBadge type="intelligent" />
    <button class="btn-primary" on:click={runQuant}>
      <Calculator class="h-4 w-4" />
      <span>Run Quantification</span>
    </button>
  </svelte:fragment>
</PageHeader>

<div class="space-y-6">
  <!-- Top row: heatmap + appetite -->
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
    <div class="card p-5 lg:col-span-2">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="section-title">Residual Risk Heatmap</h2>
        <span class="text-xs text-slate-400">Click a cell to filter the risks below.</span>
      </div>
      <Heatmap5x5 cells={numericHeatmap} onCellClick={handleCellClick} height={380} />
    </div>

    <div class="card p-5">
      <h2 class="section-title mb-3">Risk Appetite</h2>
      <div class="space-y-4">
        {#each data.appetite as a}
          {@const score = avgScoreForCategory(a.category)}
          <div class="flex items-center gap-3">
            <div class="w-24 shrink-0 text-xs">
              <div class="font-semibold text-grc-ink">{a.category}</div>
              <div class="text-[10px] text-slate-500">cap {a.severityCap}</div>
            </div>
            <div class="flex-1">
              <div class="-my-3">
                <Gauge value={Math.max(0, 100 - score)} width={160} height={84} suffix="" />
              </div>
            </div>
            <div class="w-16 shrink-0 text-right text-[11px] text-slate-500">
              <div class="font-mono">{fmtMoney(a.thresholdSgd)}</div>
              <div>threshold</div>
            </div>
          </div>
        {:else}
          <div class="text-xs text-slate-500">No appetite statements defined.</div>
        {/each}
      </div>
    </div>
  </div>

  <!-- Drill-down: filtered risks in selected cell -->
  {#if selectedSev !== null && selectedLik !== null}
    <div class="card p-5">
      <div class="mb-3 flex items-center justify-between">
        <div>
          <h2 class="section-title">Risks in cell · {SEV_FROM[selectedSev]} / {LIK_FROM[selectedLik]}</h2>
          <p class="mt-1 text-xs text-slate-500">{cellRisks.length} matching risks.</p>
        </div>
        <button class="btn-ghost py-1 text-xs" on:click={() => { selectedSev = null; selectedLik = null; }}>Clear filter</button>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100 text-sm">
          <thead class="thead">
            <tr>
              <th class="px-4 py-2 text-left">Code</th>
              <th class="px-4 py-2 text-left">Title</th>
              <th class="px-4 py-2 text-left">Category</th>
              <th class="px-4 py-2 text-left">Treatment</th>
              <th class="w-8 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {#each cellRisks.slice(0, 12) as r (r.id)}
              <tr class="tr">
                <td class="td font-mono text-xs"><a href="/risk/{r.id}" class="text-grc-primary hover:underline">{r.code}</a></td>
                <td class="td max-w-md truncate">{r.title}</td>
                <td class="td"><span class="tag tag-slate">{r.category}</span></td>
                <td class="td"><span class="tag tag-emerald">{r.treatmentStrategy}</span></td>
                <td class="td"><a href="/risk/{r.id}" class="text-slate-400 hover:text-grc-primary"><ChevronRight class="h-4 w-4" /></a></td>
              </tr>
            {:else}
              <tr><td colspan="5" class="px-4 py-6 text-center text-sm text-slate-500">No risks in this cell.</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}

  <!-- FAIR scenario selector + curve -->
  {#if data.selectedScenario}
    <div class="card p-5">
      <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="section-title">FAIR Quantification — Loss Exceedance Curve</h2>
          <div class="mt-1 flex items-center gap-2 text-sm">
            <span class="font-semibold text-grc-ink">{data.selectedScenario.name}</span>
          </div>
          {#if data.selectedScenario.description}
            <p class="mt-1 max-w-2xl text-xs text-slate-500">{data.selectedScenario.description}</p>
          {/if}
        </div>
        <select class="input w-72 py-1.5" on:change={(e) => {
          const sid = (e.currentTarget as HTMLSelectElement).value;
          const s = data.scenarios.find((x) => x.id === sid);
          if (s) selectScenario(s);
        }}>
          {#each data.scenarios as s}
            <option value={s.id} selected={s.id === data.selectedScenario?.id}>{s.name}</option>
          {/each}
        </select>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div class="lg:col-span-2">
          <LECCurve points={scenarioCurve} percentiles={displayPercentiles ? { p50: displayPercentiles.p50, p90: displayPercentiles.p90, p99: displayPercentiles.p99 } : { p50: 0, p90: 0, p99: 0 }} height={300} />
        </div>
        <div class="space-y-4">
          <div class="rounded-xl border-2 border-rose-200 bg-gradient-to-br from-rose-50 to-white p-4">
            <div class="text-[11px] uppercase tracking-wider text-rose-700">Annualised Loss Expectancy (ALE)</div>
            <div class="mt-1 font-mono text-3xl font-bold text-rose-700">{fmtMoney(displayAle)}</div>
            <div class="mt-1 text-[11px] text-rose-700/80">ARO {displayAro.toFixed(2)} occurrences/yr · 10,000 trials</div>
          </div>
          <div class="flex items-center gap-2 rounded-lg bg-violet-50 px-3 py-2 text-[11px] text-violet-700">
            <Bot class="h-3 w-3" />
            <span>Last run by</span>
            <AgentTypeBadge type="intelligent" />
            <span class="font-semibold">Risk Quantifier</span>
            <span>· {fmtRel(displayRunAt)}</span>
          </div>
        </div>
      </div>

      {#if displayPercentiles}
        <div class="mt-5 overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-100 text-sm">
            <thead class="thead">
              <tr>
                <th class="px-4 py-2 text-left">Percentile</th>
                <th class="px-4 py-2 text-right">P10</th>
                <th class="px-4 py-2 text-right">P25</th>
                <th class="px-4 py-2 text-right">P50</th>
                <th class="px-4 py-2 text-right">P75</th>
                <th class="px-4 py-2 text-right">P90</th>
                <th class="px-4 py-2 text-right">P95</th>
                <th class="px-4 py-2 text-right">P99</th>
              </tr>
            </thead>
            <tbody>
              <tr class="tr">
                <td class="td">Loss (SGD)</td>
                <td class="td text-right font-mono">{fmtMoney(displayPercentiles.p10)}</td>
                <td class="td text-right font-mono">{fmtMoney(displayPercentiles.p25)}</td>
                <td class="td text-right font-mono">{fmtMoney(displayPercentiles.p50)}</td>
                <td class="td text-right font-mono">{fmtMoney(displayPercentiles.p75)}</td>
                <td class="td text-right font-mono text-amber-700 font-semibold">{fmtMoney(displayPercentiles.p90)}</td>
                <td class="td text-right font-mono text-orange-700 font-semibold">{fmtMoney(displayPercentiles.p95)}</td>
                <td class="td text-right font-mono text-rose-700 font-semibold">{fmtMoney(displayPercentiles.p99)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {:else}
    <div class="card p-5 text-sm text-slate-500">
      <AlertTriangle class="inline h-4 w-4 text-amber-600" /> No FAIR scenarios defined for this tenant.
    </div>
  {/if}
</div>
