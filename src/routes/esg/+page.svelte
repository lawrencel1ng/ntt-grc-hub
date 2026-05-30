<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import LineChart from '$lib/components/LineChart.svelte';
  import ProgressBar from '$lib/components/ProgressBar.svelte';
  import FrameworkBadge from '$lib/components/FrameworkBadge.svelte';
  import {
    Leaf, Cloud, Factory, FileText, Target, TrendingDown, BarChart3
  } from 'lucide-svelte';
  import type { ESGMetric, ESGDisclosure, ESGTarget } from '$lib/data/types';
  import { hashStringToInt, mulberry32 } from '$lib/data/rng';

  export let data;

  // ---------- KPIs by scope ----------
  function scopeTotal(scope: 'scope1' | 'scope2' | 'scope3'): number {
    // Sum tCO2e values across all periods for that scope
    return Math.round(data.metrics
      .filter((m: ESGMetric) => m.scope === scope && m.unit === 'tCO2e')
      .reduce((s: number, m: ESGMetric) => s + m.value, 0));
  }
  $: scope1 = scopeTotal('scope1');
  $: scope2 = scopeTotal('scope2');
  $: scope3 = scopeTotal('scope3');
  $: totalDisclosures = data.disclosures.length;

  // ---------- Targets / On-Target % ----------
  // Synthesize "current value" for each target by interpolating between baseline and target.
  function currentValue(t: ESGTarget): number {
    const rng = mulberry32(hashStringToInt(`cv:${t.id}`));
    const progress = 0.35 + rng() * 0.55; // 35–90% of the way
    return Math.round(t.baselineValue - (t.baselineValue - t.targetValue) * progress);
  }
  function onTrack(t: ESGTarget): boolean {
    const baseYear = parseInt(t.baselinePeriod, 10) || 2024;
    const targetYear = parseInt(t.targetPeriod, 10) || 2030;
    const elapsedFrac = (2026 - baseYear) / Math.max(1, targetYear - baseYear);
    const valueFrac = (t.baselineValue - currentValue(t)) / Math.max(1, (t.baselineValue - t.targetValue));
    return valueFrac >= elapsedFrac * 0.85;
  }
  $: onTargetPct = data.targets.length
    ? Math.round((data.targets.filter(onTrack).length / data.targets.length) * 100)
    : 0;

  // ---------- Hero LineChart: 24-month emissions trend ----------
  const MONTHS_24 = (() => {
    const out: string[] = [];
    const d = new Date();
    for (let i = 23; i >= 0; i--) {
      const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
      out.push(m.toLocaleString('en', { month: 'short', year: '2-digit' }));
    }
    return out;
  })();

  function emissionSeries(scope: 'scope1' | 'scope2' | 'scope3', base: number): number[] {
    const rng = mulberry32(hashStringToInt(`em:${scope}:${data.effectiveTenantId}`));
    const out: number[] = [];
    // Start higher and trend downward to "base" by month 24.
    const start = base * (scope === 'scope3' ? 1.4 : 1.25);
    for (let i = 0; i < 24; i++) {
      const t = i / 23;
      const trend = start - (start - base) * t;
      const jitter = (rng() - 0.5) * base * 0.08;
      out.push(Math.max(0, Math.round((trend + jitter) / 24)));
    }
    return out;
  }
  // Target line: assume net-zero glide (scope1+2 target value / 12 per month)
  $: scope12Target = data.targets
    .filter((t: ESGTarget) => /Scope 1|Scope 2/i.test(t.metric))
    .reduce((s: number, t: ESGTarget) => s + t.targetValue, 0);
  function targetLine(): number[] {
    const t = (scope12Target || 1800) / 12; // monthly target
    return Array.from({ length: 24 }).map((_, i) => Math.round(t * (1 - i * 0.012)));
  }

  $: heroSeries = [
    { name: 'Scope 1', color: '#8b5cf6', data: emissionSeries('scope1', Math.max(scope1, 600)), area: false },
    { name: 'Scope 2', color: '#3b82f6', data: emissionSeries('scope2', Math.max(scope2, 1800)), area: false },
    { name: 'Scope 3', color: '#8b5cf6', data: emissionSeries('scope3', Math.max(scope3, 4000)), area: false },
    { name: 'Target',  color: '#ef4444', data: targetLine() }
  ];

  // ---------- Tabs ----------
  type Tab = 'metrics' | 'disclosures' | 'targets';
  let tab: Tab = 'metrics';
  const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
    { id: 'metrics',     label: 'Metrics',     icon: BarChart3 },
    { id: 'disclosures', label: 'Disclosures', icon: FileText },
    { id: 'targets',     label: 'Targets',     icon: Target }
  ];

  function scopeCls(s: string): string {
    switch (s) {
      case 'scope1': return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'scope2': return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'scope3': return 'bg-violet-50 text-violet-700 ring-violet-200';
      default:       return 'bg-slate-100 text-slate-600 ring-slate-200';
    }
  }

  function fmtNum(n: number): string {
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return n.toFixed(2);
  }

  function fmtDate(iso?: string): string {
    if (!iso) return '—';
    return iso.slice(0, 10);
  }

  function disclosureStatusCls(s: string): string {
    switch (s) {
      case 'published': return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'in-review': return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'draft':     return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'retired':   return 'bg-slate-100 text-slate-500 ring-slate-200';
      default:          return 'bg-slate-100 text-slate-600 ring-slate-200';
    }
  }
</script>

<PageHeader title="ESG / Sustainability" subtitle="CSRD · ISSB · GHG Protocol · TCFD {data.isAll ? '· aggregated view' : ''}" />

<div class="space-y-6">
  <!-- KPI strip -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
    <Kpi label="Scope 1" value={fmtNum(scope1)} suffix="tCO2e">
      <Factory slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="Scope 2" value={fmtNum(scope2)} suffix="tCO2e">
      <Cloud slot="icon" class="h-4 w-4 text-blue-600" />
    </Kpi>
    <Kpi label="Scope 3" value={fmtNum(scope3)} suffix="tCO2e">
      <Leaf slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="Total Disclosures" value={totalDisclosures.toString()}>
      <FileText slot="icon" class="h-4 w-4 text-grc-primary" />
    </Kpi>
    <Kpi label="On-Target" value={onTargetPct.toString()} suffix="%" hint="of climate targets">
      <Target slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
  </div>

  <!-- Hero chart -->
  <div class="card p-5">
    <div class="mb-4 flex items-start justify-between">
      <div>
        <div class="section-title">Emissions Trend (last 24 months)</div>
        <p class="mt-1 text-xs text-slate-500">Monthly tCO2e by scope. Dashed red line shows board-approved 2030 glide-path.</p>
      </div>
      <span class="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200">
        <TrendingDown class="h-3 w-3" /> trending down
      </span>
    </div>
    <LineChart labels={MONTHS_24} series={heroSeries} height={280} unit=" t" />
  </div>

  <!-- Tabs -->
  <div class="card overflow-hidden">
    <div class="flex flex-wrap border-b border-slate-100 px-2">
      {#each TABS as t}
        {@const Icon = t.icon}
        <button type="button"
          class="-mb-px flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors {tab === t.id
            ? 'border-grc-primary text-grc-primary'
            : 'border-transparent text-slate-500 hover:text-slate-700'}"
          on:click={() => (tab = t.id)}>
          <Icon class="h-4 w-4" />
          {t.label}
        </button>
      {/each}
    </div>

    <!-- Metrics -->
    {#if tab === 'metrics'}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100 text-sm">
          <thead class="thead">
            <tr>
              <th class="px-4 py-2 text-left">Period</th>
              <th class="px-4 py-2 text-left">Scope</th>
              <th class="px-4 py-2 text-left">Category</th>
              <th class="px-4 py-2 text-left">Metric</th>
              <th class="px-4 py-2 text-right">Value</th>
              <th class="px-4 py-2 text-left">Unit</th>
              <th class="px-4 py-2 text-left">Framework</th>
            </tr>
          </thead>
          <tbody>
            {#each data.metrics.slice(0, 80) as m (m.id)}
              <tr class="tr">
                <td class="td font-mono text-xs">{m.period}</td>
                <td class="td">
                  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {scopeCls(m.scope)}">{m.scope}</span>
                </td>
                <td class="td text-xs text-slate-600">{m.category}</td>
                <td class="td">{m.metric}</td>
                <td class="td text-right font-mono">{m.value.toLocaleString()}</td>
                <td class="td text-xs text-slate-500">{m.unit}</td>
                <td class="td">
                  <FrameworkBadge name={m.framework} region="ESG" />
                </td>
              </tr>
            {:else}
              <tr><td colspan="7" class="px-4 py-8 text-center text-sm text-slate-500">No ESG metrics recorded.</td></tr>
            {/each}
          </tbody>
        </table>
      </div>

    <!-- Disclosures -->
    {:else if tab === 'disclosures'}
      <div class="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 lg:grid-cols-2">
        {#each data.disclosures as d (d.id)}
          <div class="rounded-lg bg-white ring-1 ring-inset ring-slate-200/70 p-4">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <FrameworkBadge name={d.framework} region="ESG" />
                <div class="mt-2 font-semibold text-grc-ink">{d.framework} {d.period} Disclosure</div>
                <div class="mt-1 text-xs text-slate-500">Published {fmtDate(d.publishedAt)}</div>
              </div>
              <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {disclosureStatusCls(d.status)}">{d.status}</span>
            </div>
            <p class="mt-3 text-xs leading-relaxed text-slate-600">
              {d.framework} {d.period} report covering Scope 1/2/3 emissions, energy intensity, water stewardship,
              and board oversight of climate-related risks per TCFD pillars. Assured by KPMG (limited assurance).
            </p>
            <div class="mt-3 flex items-center gap-2 text-xs">
              <button type="button" class="text-grc-primary hover:underline">View report →</button>
              <span class="text-slate-300">·</span>
              <button type="button" class="text-grc-primary hover:underline">Download XBRL</button>
            </div>
          </div>
        {:else}
          <div class="col-span-2 px-4 py-8 text-center text-sm text-slate-500">No disclosures published.</div>
        {/each}
      </div>

    <!-- Targets -->
    {:else if tab === 'targets'}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100 text-sm">
          <thead class="thead">
            <tr>
              <th class="px-4 py-2 text-left">Framework</th>
              <th class="px-4 py-2 text-left">Metric</th>
              <th class="px-4 py-2 text-right">Baseline</th>
              <th class="px-4 py-2 text-left">Base Period</th>
              <th class="px-4 py-2 text-right">Target</th>
              <th class="px-4 py-2 text-left">Target Period</th>
              <th class="px-4 py-2 text-left">Owner</th>
              <th class="w-64 px-4 py-2 text-left">Progress</th>
              <th class="px-4 py-2 text-center">On-Track</th>
            </tr>
          </thead>
          <tbody>
            {#each data.targets as t (t.id)}
              {@const cur = currentValue(t)}
              {@const reduction = t.baselineValue - t.targetValue}
              {@const achieved = t.baselineValue - cur}
              {@const pct = reduction > 0 ? Math.max(0, Math.min(100, (achieved / reduction) * 100)) : 0}
              {@const track = onTrack(t)}
              <tr class="tr">
                <td class="td"><FrameworkBadge name={t.framework} region="ESG" /></td>
                <td class="td font-medium">{t.metric}</td>
                <td class="td text-right font-mono text-xs">{t.baselineValue.toLocaleString()}</td>
                <td class="td font-mono text-xs text-slate-500">{t.baselinePeriod}</td>
                <td class="td text-right font-mono text-xs">{t.targetValue.toLocaleString()}</td>
                <td class="td font-mono text-xs text-slate-500">{t.targetPeriod}</td>
                <td class="td text-xs text-slate-600">CSO Office</td>
                <td class="td">
                  <div class="space-y-1">
                    <div class="flex items-center gap-2">
                      <ProgressBar value={pct} color={track ? 'bg-violet-500' : 'bg-amber-500'} />
                      <span class="font-mono text-[10px] text-slate-500">{Math.round(pct)}%</span>
                    </div>
                    <div class="text-[10px] text-slate-500">current: <span class="font-mono">{cur.toLocaleString()}</span></div>
                  </div>
                </td>
                <td class="td text-center">
                  {#if track}
                    <span class="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700 ring-1 ring-inset ring-violet-200">on-track</span>
                  {:else}
                    <span class="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">at-risk</span>
                  {/if}
                </td>
              </tr>
            {:else}
              <tr><td colspan="9" class="px-4 py-8 text-center text-sm text-slate-500">No targets set.</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>
