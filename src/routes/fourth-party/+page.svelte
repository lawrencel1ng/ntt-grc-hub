<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import Sankey from '$lib/components/Sankey.svelte';
  import { GitFork, Cloud, AlertTriangle, Percent, ShieldAlert } from 'lucide-svelte';
  import type { Concentration } from '$lib/data/types';

  export let data;

  const THRESHOLD_PCT = 40;

  // ---------- KPIs ----------
  $: totalFp = data.fourthParties.length;
  $: uniqueCloud = (() => {
    const s = new Set<string>();
    for (const fp of data.fourthParties) {
      if (fp.type === 'cloud') s.add(fp.name.split(' (')[0]);
    }
    return s.size;
  })();

  function concentrationPct(c: Concentration): number {
    return data.vendors.length > 0
      ? Math.round((c.vendorCount / data.vendors.length) * 100)
      : 0;
  }
  $: critical = data.concentrations.filter((c) => concentrationPct(c) >= THRESHOLD_PCT).length;
  $: avgConcentration = data.concentrations.length > 0
    ? Math.round(data.concentrations.reduce((s, c) => s + concentrationPct(c), 0) / data.concentrations.length)
    : 0;

  // ---------- Concentration table helpers ----------
  function dimensionCls(d: Concentration['dimension']): string {
    switch (d) {
      case 'cloud':     return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'region':    return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'processor': return 'bg-amber-50 text-amber-700 ring-amber-200';
    }
  }
  function pctCls(pct: number): string {
    if (pct >= THRESHOLD_PCT) return 'bg-rose-100 text-rose-800 ring-rose-200';
    if (pct >= 20)            return 'bg-amber-50 text-amber-700 ring-amber-200';
    return 'bg-violet-50 text-violet-700 ring-violet-200';
  }
  function statusLabel(pct: number): string {
    if (pct >= THRESHOLD_PCT) return 'over threshold';
    if (pct >= 20)            return 'watch';
    return 'within tolerance';
  }
  function fmtMoney(n: number): string {
    if (n >= 1e6) return `S$${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `S$${(n / 1e3).toFixed(0)}K`;
    return `S$${n}`;
  }

  // Sort concentrations by % desc to surface highest-risk vendors first.
  $: sortedConcentrations = [...data.concentrations].sort(
    (a, b) => concentrationPct(b) - concentrationPct(a)
  );

  $: vendorNodeCount = data.sankey.nodes.filter((n) => n.column === 0).length;
  $: fpNodeCount = data.sankey.nodes.filter((n) => n.column === 1).length;
  $: destNodeCount = data.sankey.nodes.filter((n) => n.column === 2).length;
</script>

<PageHeader
  title="4th-Party Concentration Map"
  subtitle="Discover hidden supply-chain risk via sub-processors {data.isAll ? '· aggregated view' : ''}"
/>

<div class="space-y-6">
  <!-- KPI strip -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <Kpi label="Total 4th Parties" value={totalFp.toString()}>
      <GitFork slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="Unique Cloud Providers" value={uniqueCloud.toString()}>
      <Cloud slot="icon" class="h-4 w-4 text-blue-600" />
    </Kpi>
    <Kpi label="Critical Concentrations" value={critical.toString()} suffix={`> ${THRESHOLD_PCT}%`} tone="bad">
      <AlertTriangle slot="icon" class="h-4 w-4 text-rose-600" />
    </Kpi>
    <Kpi label="Avg Concentration" value={avgConcentration.toString()} suffix="%" hint="across dimensions">
      <Percent slot="icon" class="h-4 w-4 text-grc-primary" />
    </Kpi>
  </div>

  <!-- Threshold alert -->
  {#if critical > 0}
    <div class="rounded-xl border-2 border-rose-300 bg-gradient-to-br from-rose-50 to-white px-5 py-3">
      <div class="flex items-start gap-3">
        <div class="rounded-lg bg-rose-100 p-2 text-rose-700">
          <ShieldAlert class="h-5 w-5" />
        </div>
        <div class="flex-1 text-sm">
          <div class="font-semibold text-rose-900">
            {critical} concentration{critical === 1 ? '' : 's'} exceed {THRESHOLD_PCT}% threshold
          </div>
          <div class="mt-0.5 text-xs text-rose-700">
            Review with the Vendor Risk Analyst agent — consider multi-region failover, second-source procurement, or exit-plan workstreams.
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Sankey hero -->
  <div class="card p-5">
    <div class="mb-3 flex items-center justify-between">
      <div>
        <div class="section-title">Supply-chain Sankey</div>
        <div class="mt-0.5 text-xs text-slate-500">
          Vendor → 4th-party → Cloud/Region · {vendorNodeCount} vendors, {fpNodeCount} 4th-parties, {destNodeCount} destinations
        </div>
      </div>
      <div class="flex items-center gap-3 text-[11px] text-slate-500">
        <span class="inline-flex items-center gap-1"><span class="inline-block h-2 w-3 rounded bg-violet-500/50"></span>low</span>
        <span class="inline-flex items-center gap-1"><span class="inline-block h-2 w-3 rounded bg-amber-500/50"></span>medium</span>
        <span class="inline-flex items-center gap-1"><span class="inline-block h-2 w-3 rounded bg-rose-500/50"></span>high (&gt;{THRESHOLD_PCT}%)</span>
      </div>
    </div>
    <div class="overflow-x-auto">
      <Sankey nodes={data.sankey.nodes} links={data.sankey.links} width={1100} height={Math.max(420, data.sankey.nodes.length * 12)} />
    </div>
  </div>

  <!-- Concentrations table -->
  <div class="card overflow-hidden">
    <div class="border-b border-slate-100 px-5 py-3">
      <div class="section-title">Concentrations</div>
      <div class="mt-0.5 text-xs text-slate-500">Aggregations across cloud, region, and processor dimensions.</div>
    </div>
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-100 text-sm">
        <thead class="thead">
          <tr>
            <th class="px-4 py-2 text-left">Dimension</th>
            <th class="px-4 py-2 text-left">Key</th>
            <th class="px-4 py-2 text-right">Vendors</th>
            <th class="px-4 py-2 text-right">% of fleet</th>
            <th class="px-4 py-2 text-right">Exposure (S$)</th>
            <th class="px-4 py-2 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {#each sortedConcentrations as c (c.id)}
            {@const pct = concentrationPct(c)}
            <tr class="tr">
              <td class="td">
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {dimensionCls(c.dimension)}">{c.dimension}</span>
              </td>
              <td class="td font-mono text-xs">{c.key}</td>
              <td class="td text-right font-mono">{c.vendorCount}</td>
              <td class="td text-right font-mono">
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {pctCls(pct)}">{pct}%</span>
              </td>
              <td class="td text-right font-mono text-rose-700">{fmtMoney(c.exposureSgd)}</td>
              <td class="td">
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {pctCls(pct)}">{statusLabel(pct)}</span>
              </td>
            </tr>
          {:else}
            <tr><td colspan="6" class="px-4 py-8 text-center text-sm text-slate-500">No concentrations recorded.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>
