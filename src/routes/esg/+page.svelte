<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import LineChart from '$lib/components/LineChart.svelte';
  import ProgressBar from '$lib/components/ProgressBar.svelte';
  import FrameworkBadge from '$lib/components/FrameworkBadge.svelte';
  import { enhance } from '$app/forms';
  import { addToast } from '$lib/stores/toast';
  import {
    Leaf, Cloud, Factory, FileText, Target, TrendingDown, BarChart3, Plus
  } from 'lucide-svelte';
  import type { ESGMetric, ESGDisclosure, ESGTarget } from '$lib/data/types';
  import { downloadCsv } from '$lib/utils/csv';

  export let data;
  export let form: {
    disclosureUpdated?: boolean; disclosureId?: string; newStatus?: string; disclosureError?: string;
    disclosureCreated?: boolean; createDisclosureError?: string;
    metricLogged?: boolean; metricError?: string;
    targetAdded?: boolean; targetError?: string;
  } | null = null;

  let showMetricForm = false;
  let showTargetForm = false;
  let showDisclosureForm = false;

  $: if (form?.disclosureUpdated && form.disclosureId && form.newStatus) {
    data = {
      ...data,
      disclosures: data.disclosures.map((d: ESGDisclosure) =>
        d.id === form!.disclosureId ? { ...d, status: form!.newStatus as ESGDisclosure['status'] } : d
      )
    };
    addToast('success', `Disclosure status updated to "${form.newStatus}".`);
  }
  $: if (form?.disclosureError) addToast('error', form.disclosureError);
  $: if (form?.disclosureCreated) { addToast('success', 'Disclosure package created.'); showDisclosureForm = false; }
  $: if (form?.createDisclosureError) addToast('error', form.createDisclosureError);
  $: if (form?.metricLogged) { addToast('success', 'Metric recorded.'); showMetricForm = false; }
  $: if (form?.metricError) addToast('error', form.metricError);
  $: if (form?.targetAdded) { addToast('success', 'Target added.'); showTargetForm = false; }
  $: if (form?.targetError) addToast('error', form.targetError);

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
  // Current value: sum latest-period metrics that match the target's unit/scope.
  function currentValue(t: ESGTarget): number | null {
    const unit = t.metric.toLowerCase().includes('co2') ? 'tCO2e'
               : t.metric.toLowerCase().includes('gj') ? 'GJ'
               : t.metric.toLowerCase().includes('kwh') ? 'kWh' : null;
    const scope = t.metric.toLowerCase().includes('scope 1') ? 'scope1'
                : t.metric.toLowerCase().includes('scope 2') ? 'scope2'
                : t.metric.toLowerCase().includes('scope 3') ? 'scope3' : null;
    const matching = (data.metrics as ESGMetric[]).filter((m) =>
      (!unit || m.unit === unit) && (!scope || m.scope === scope)
    );
    if (matching.length === 0) return null;
    const latestPeriod = matching.reduce((a, b) => a.period > b.period ? a : b).period;
    const sum = matching.filter((m) => m.period === latestPeriod).reduce((s, m) => s + m.value, 0);
    return Math.round(sum);
  }
  function onTrack(t: ESGTarget): boolean | null {
    const cur = currentValue(t);
    if (cur === null) return null;
    const baseYear = parseInt(t.baselinePeriod, 10) || 2024;
    const targetYear = parseInt(t.targetPeriod, 10) || 2030;
    const elapsedFrac = (2026 - baseYear) / Math.max(1, targetYear - baseYear);
    const valueFrac = (t.baselineValue - cur) / Math.max(1, (t.baselineValue - t.targetValue));
    return valueFrac >= elapsedFrac * 0.85;
  }
  $: measuredTargets = data.targets.filter((t: ESGTarget) => currentValue(t) !== null);
  $: onTargetPct = measuredTargets.length
    ? Math.round((measuredTargets.filter((t: ESGTarget) => onTrack(t) === true).length / measuredTargets.length) * 100)
    : 0;

  // ---------- Hero LineChart: emissions trend from real metrics ----------
  // Aggregate tCO2e values by (period, scope) from the DB-loaded metrics.
  function buildEmissionMap(scope: 'scope1' | 'scope2' | 'scope3'): Map<string, number> {
    const map = new Map<string, number>();
    for (const m of data.metrics as ESGMetric[]) {
      if (m.scope !== scope || m.unit !== 'tCO2e') continue;
      map.set(m.period, (map.get(m.period) ?? 0) + m.value);
    }
    return map;
  }

  $: chartPeriods = (() => {
    const periodsSet = new Set<string>();
    for (const m of data.metrics as ESGMetric[]) {
      if (m.unit === 'tCO2e') periodsSet.add(m.period);
    }
    return [...periodsSet].sort();
  })();

  $: scope12Target = data.targets
    .filter((t: ESGTarget) => /Scope 1|Scope 2/i.test(t.metric))
    .reduce((s: number, t: ESGTarget) => s + t.targetValue, 0);

  $: heroSeries = (() => {
    if (chartPeriods.length === 0) return [];
    const s1map = buildEmissionMap('scope1');
    const s2map = buildEmissionMap('scope2');
    const s3map = buildEmissionMap('scope3');
    const series = [
      { name: 'Scope 1', color: '#8b5cf6', data: chartPeriods.map((p) => Math.round(s1map.get(p) ?? 0)), area: false },
      { name: 'Scope 2', color: '#3b82f6', data: chartPeriods.map((p) => Math.round(s2map.get(p) ?? 0)), area: false },
      { name: 'Scope 3', color: '#6366f1', data: chartPeriods.map((p) => Math.round(s3map.get(p) ?? 0)), area: false },
    ];
    // Only add a Target line if real scope 1/2 target data exists in the DB
    const s12Targets = (data.targets as ESGTarget[]).filter((t) => /Scope 1|Scope 2/i.test(t.metric));
    if (s12Targets.length > 0) {
      // Targets store annual tCO2e; chart periods are quarterly — scale to match.
      const periodsAreQuarterly = chartPeriods.some((p) => p.includes('-Q'));
      const periodDivisor = periodsAreQuarterly ? 4 : 1;
      const baseVal = s12Targets.reduce((s, t) => s + t.baselineValue, 0) / periodDivisor;
      const targetVal = s12Targets.reduce((s, t) => s + t.targetValue, 0) / periodDivisor;
      const baseYear = parseInt(s12Targets[0].baselinePeriod, 10) || 2020;
      const targetYear = parseInt(s12Targets[0].targetPeriod, 10) || 2030;
      series.push({ name: 'Target', color: '#ef4444', area: false, data: chartPeriods.map((p) => {
        const year = parseInt(p, 10) || baseYear;
        const frac = Math.min(1, Math.max(0, (year - baseYear) / Math.max(1, targetYear - baseYear)));
        return Math.round(baseVal + (targetVal - baseVal) * frac);
      })});
    }
    return series;
  })();

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

  function downloadDisclosureReport(d: ESGDisclosure) {
    const matched = (data.metrics as ESGMetric[]).filter(
      (m) => m.framework === d.framework || m.period === d.period
    );
    const lines = [
      `# ${d.framework} ESG Disclosure — ${d.period}`,
      `Status: ${d.status}`,
      d.publishedAt ? `Published: ${d.publishedAt.slice(0, 10)}` : '',
      '',
      '## Emissions (tCO₂e)',
      ...['scope1', 'scope2', 'scope3'].map((sc) => {
        const total = matched
          .filter((m) => m.scope === sc && m.unit === 'tCO2e')
          .reduce((s, m) => s + m.value, 0);
        return `- ${sc.replace('scope', 'Scope ')}: ${total.toLocaleString()} tCO₂e`;
      }),
      '',
      '## All Metrics',
      matched.length
        ? matched.map((m) => `- [${m.scope}] ${m.category} / ${m.metric}: ${m.value} ${m.unit}`).join('\n')
        : '- No metrics on record for this period.',
    ].filter((l) => l !== undefined).join('\n');

    const blob = new Blob([lines], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `esg-${d.framework.toLowerCase()}-${d.period}-report.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    addToast('success', `Downloaded ${d.framework} ${d.period} report.`);
  }

  function downloadDisclosureCSV(d: ESGDisclosure) {
    const matched = (data.metrics as ESGMetric[]).filter(
      (m) => m.framework === d.framework || m.period === d.period
    );
    if (matched.length === 0) { addToast('error', 'No metrics found for this disclosure period.'); return; }
    const csvContent = [
      'period,framework,scope,category,metric,value,unit',
      ...matched.map((m) =>
        [m.period, m.framework, m.scope, m.category, m.metric, m.value, m.unit]
          .map((v) => (String(v).includes(',') ? `"${v}"` : v))
          .join(',')
      )
    ].join('\n');
    downloadCsv(`esg-${d.framework.toLowerCase()}-${d.period}-metrics.csv`, csvContent);
    addToast('success', `Downloaded ${matched.length} metric rows as CSV.`);
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
    <LineChart labels={chartPeriods} series={heroSeries} height={280} unit=" t" />
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
      <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <span class="text-xs text-slate-500">{data.metrics.length} metric{data.metrics.length !== 1 ? 's' : ''}</span>
        <button class="btn-ghost text-xs" on:click={() => (showMetricForm = !showMetricForm)}>
          <Plus class="h-3.5 w-3.5" />
          Log metric
        </button>
      </div>
      {#if showMetricForm}
        <div class="border-b border-slate-100 bg-slate-50 px-5 py-4">
          <form method="POST" action="?/logMetric" use:enhance class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-700">Period</span>
              <input name="period" type="text" class="input" placeholder="2026-Q1" required maxlength="32" />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-700">Scope</span>
              <select name="scope" class="input" required>
                <option value="scope1">Scope 1</option>
                <option value="scope2">Scope 2</option>
                <option value="scope3">Scope 3</option>
              </select>
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-700">Framework</span>
              <select name="framework" class="input" required>
                <option value="GHG">GHG</option>
                <option value="CSRD">CSRD</option>
                <option value="ISSB">ISSB</option>
                <option value="TCFD">TCFD</option>
              </select>
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-700">Category</span>
              <input name="category" type="text" class="input" placeholder="Combustion" required maxlength="128" />
            </label>
            <label class="block sm:col-span-2">
              <span class="mb-1 block text-xs font-medium text-slate-700">Metric</span>
              <input name="metric" type="text" class="input" placeholder="Natural gas combustion" required maxlength="256" />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-700">Value</span>
              <input name="value" type="number" step="any" class="input" placeholder="1234.5" required />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-700">Unit</span>
              <input name="unit" type="text" class="input" placeholder="tCO2e" required maxlength="32" />
            </label>
            <div class="flex gap-2 sm:col-span-2 lg:col-span-4">
              <button type="submit" class="btn-primary">Record</button>
              <button type="button" class="btn-secondary" on:click={() => (showMetricForm = false)}>Cancel</button>
            </div>
          </form>
        </div>
      {/if}
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
      <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <span class="text-xs text-slate-500">{data.disclosures.length} disclosure package{data.disclosures.length !== 1 ? 's' : ''}</span>
        <button class="btn-ghost text-xs" on:click={() => (showDisclosureForm = !showDisclosureForm)}>
          <Plus class="h-3.5 w-3.5" />
          New disclosure
        </button>
      </div>

      {#if showDisclosureForm}
        <form method="POST" action="?/createDisclosure" use:enhance class="border-b border-slate-100 bg-slate-50 p-5">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label class="block text-[11px] text-slate-500 mb-0.5" for="disc-framework">Framework</label>
              <select id="disc-framework" name="framework" class="input">
                <option value="CSRD">CSRD</option>
                <option value="ISSB">ISSB</option>
                <option value="GHG">GHG Protocol</option>
                <option value="TCFD">TCFD</option>
              </select>
            </div>
            <div>
              <label class="block text-[11px] text-slate-500 mb-0.5" for="disc-period">Period</label>
              <input id="disc-period" name="period" type="text" class="input" placeholder="FY2025" required maxlength="32" />
            </div>
            <div class="flex items-end gap-2">
              <button type="submit" class="btn-primary text-xs py-1 px-3">Create</button>
              <button type="button" class="btn-secondary text-xs py-1 px-3" on:click={() => (showDisclosureForm = false)}>Cancel</button>
            </div>
          </div>
        </form>
      {/if}

      <div class="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 lg:grid-cols-2">
        {#each data.disclosures as d (d.id)}
          <div class="rounded-lg bg-white ring-1 ring-inset ring-slate-200/70 p-4">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <FrameworkBadge name={d.framework} region="ESG" />
                <div class="mt-2 font-semibold text-grc-ink">{d.framework} {d.period} Disclosure</div>
                <div class="mt-1 text-xs text-slate-500">Published {fmtDate(d.publishedAt)}</div>
              </div>
              <form method="POST" action="?/updateDisclosureStatus" use:enhance class="flex items-center gap-1">
                <input type="hidden" name="disclosureId" value={d.id} />
                <select name="status" class="input py-0.5 text-[11px]" value={d.status}>
                  <option value="draft">draft</option>
                  <option value="in-review">in-review</option>
                  <option value="published">published</option>
                  <option value="retired">retired</option>
                </select>
                <button type="submit" class="btn-ghost p-1 text-[11px]">✓</button>
              </form>
            </div>
            <p class="mt-3 text-xs leading-relaxed text-slate-600">
              {d.framework} {d.period} report covering Scope 1/2/3 emissions, energy intensity, water stewardship,
              and board oversight of climate-related risks per TCFD pillars.
            </p>
            <div class="mt-3 flex items-center gap-2 text-xs">
              <button type="button" class="text-grc-primary hover:underline" on:click={() => downloadDisclosureReport(d)}>View report →</button>
              <span class="text-slate-300">·</span>
              <button type="button" class="text-grc-primary hover:underline" on:click={() => downloadDisclosureCSV(d)}>Download CSV</button>
            </div>
          </div>
        {:else}
          <div class="col-span-2 px-4 py-8 text-center text-sm text-slate-500">No disclosures published.</div>
        {/each}
      </div>

    <!-- Targets -->
    {:else if tab === 'targets'}
      <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <span class="text-xs text-slate-500">{data.targets.length} target{data.targets.length !== 1 ? 's' : ''}</span>
        <button class="btn-ghost text-xs" on:click={() => (showTargetForm = !showTargetForm)}>
          <Plus class="h-3.5 w-3.5" />
          Add target
        </button>
      </div>
      {#if showTargetForm}
        <div class="border-b border-slate-100 bg-slate-50 px-5 py-4">
          <form method="POST" action="?/addTarget" use:enhance class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-700">Framework</span>
              <select name="framework" class="input" required>
                <option value="GHG">GHG</option>
                <option value="CSRD">CSRD</option>
                <option value="ISSB">ISSB</option>
                <option value="TCFD">TCFD</option>
              </select>
            </label>
            <label class="block sm:col-span-2">
              <span class="mb-1 block text-xs font-medium text-slate-700">Metric</span>
              <input name="metric" type="text" class="input" placeholder="Scope 1 + 2 tCO2e reduction" required maxlength="256" />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-700">Baseline value</span>
              <input name="baselineValue" type="number" step="any" class="input" placeholder="100000" required />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-700">Baseline period</span>
              <input name="baselinePeriod" type="text" class="input" placeholder="2020" required maxlength="32" />
            </label>
            <div></div>
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-700">Target value</span>
              <input name="targetValue" type="number" step="any" class="input" placeholder="50000" required />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-700">Target period</span>
              <input name="targetPeriod" type="text" class="input" placeholder="2030" required maxlength="32" />
            </label>
            <div></div>
            <div class="flex gap-2 sm:col-span-2 lg:col-span-3">
              <button type="submit" class="btn-primary">Add target</button>
              <button type="button" class="btn-secondary" on:click={() => (showTargetForm = false)}>Cancel</button>
            </div>
          </form>
        </div>
      {/if}
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
              {@const achieved = cur !== null ? t.baselineValue - cur : null}
              {@const pct = achieved !== null && reduction > 0 ? Math.max(0, Math.min(100, (achieved / reduction) * 100)) : null}
              {@const track = onTrack(t)}
              <tr class="tr">
                <td class="td"><FrameworkBadge name={t.framework} region="ESG" /></td>
                <td class="td font-medium">{t.metric}</td>
                <td class="td text-right font-mono text-xs">{t.baselineValue.toLocaleString()}</td>
                <td class="td font-mono text-xs text-slate-500">{t.baselinePeriod}</td>
                <td class="td text-right font-mono text-xs">{t.targetValue.toLocaleString()}</td>
                <td class="td font-mono text-xs text-slate-500">{t.targetPeriod}</td>
                <td class="td text-xs text-slate-500">{t.ownerEmail ?? '—'}</td>
                <td class="td">
                  {#if pct !== null && cur !== null}
                    <div class="space-y-1">
                      <div class="flex items-center gap-2">
                        <ProgressBar value={pct} color={track ? 'bg-violet-500' : 'bg-amber-500'} />
                        <span class="font-mono text-[10px] text-slate-500">{Math.round(pct)}%</span>
                      </div>
                      <div class="text-[10px] text-slate-500">current: <span class="font-mono">{cur.toLocaleString()}</span></div>
                    </div>
                  {:else}
                    <span class="text-xs text-slate-400">No data</span>
                  {/if}
                </td>
                <td class="td text-center">
                  {#if track === true}
                    <span class="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700 ring-1 ring-inset ring-violet-200">on-track</span>
                  {:else if track === false}
                    <span class="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">at-risk</span>
                  {:else}
                    <span class="text-xs text-slate-400">—</span>
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
