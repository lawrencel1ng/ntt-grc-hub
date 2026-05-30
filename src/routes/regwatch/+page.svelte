<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import AgentTypeBadge from '$lib/components/AgentTypeBadge.svelte';
  import { Antenna, FileText, Activity, AlertTriangle, ChevronRight, ExternalLink, Sparkles } from 'lucide-svelte';
  import type { RiskSeverity, RegChange } from '$lib/data/types';

  export let data;

  // ---------- KPIs ----------
  $: sourcesCount = data.sources.filter((s) => s.enabled).length;
  $: changes30d = data.changes.filter((c) => (Date.now() - new Date(c.publishedAt).getTime()) / 86_400_000 <= 30).length;
  $: activeImpacts = data.activeImpacts as number;
  $: gapsOpened30d = data.gapsOpened30d as number;

  // ---------- Hero callout — most recent critical/high change ----------
  const SEV_ORDER: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
  $: hero = data.changes.slice().sort((a, b) =>
    (SEV_ORDER[b.severity] ?? 0) - (SEV_ORDER[a.severity] ?? 0) ||
    b.publishedAt.localeCompare(a.publishedAt)
  )[0] ?? null;
  $: heroImpact = data.heroImpact;

  function regColor(code?: string): string {
    switch (code) {
      case 'MAS':  return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'APRA': return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'EU':   return 'bg-indigo-50 text-indigo-700 ring-indigo-200';
      case 'OJK':  return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'RBI':  return 'bg-orange-50 text-orange-700 ring-orange-200';
      case 'HKMA': return 'bg-slate-100 text-slate-700 ring-slate-200';
      case 'BNM':  return 'bg-rose-50 text-rose-700 ring-rose-200';
      case 'PDPC': return 'bg-violet-50 text-violet-700 ring-violet-200';
      default:     return 'bg-slate-100 text-slate-700 ring-slate-200';
    }
  }
  function sevCls(s: RiskSeverity): string {
    if (s === 'critical') return 'bg-rose-100 text-rose-800 ring-rose-200';
    if (s === 'high')     return 'bg-orange-50 text-orange-700 ring-orange-200';
    if (s === 'medium')   return 'bg-amber-50 text-amber-700 ring-amber-200';
    return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
  function sevBar(s: RiskSeverity): { w: string; cls: string } {
    if (s === 'critical') return { w: '95%', cls: 'bg-rose-500' };
    if (s === 'high')     return { w: '75%', cls: 'bg-orange-500' };
    if (s === 'medium')   return { w: '50%', cls: 'bg-amber-500' };
    if (s === 'low')      return { w: '25%', cls: 'bg-slate-400' };
    return { w: '5%', cls: 'bg-slate-300' };
  }
  function fmtRel(iso: string): string {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60)    return `${Math.floor(diff)}s ago`;
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  // ---------- Group changes by week ----------
  function weekKey(iso: string): string {
    const d = new Date(iso);
    const year = d.getUTCFullYear();
    // ISO week (approximate)
    const start = new Date(Date.UTC(year, 0, 1));
    const week = Math.floor(((d.getTime() - start.getTime()) / 86_400_000 + start.getUTCDay()) / 7);
    return `${year}-W${String(week).padStart(2, '0')}`;
  }
  $: groupedChanges = (() => {
    const non = hero ? data.changes.filter((c) => c.id !== hero.id) : data.changes;
    const map = new Map<string, RegChange[]>();
    for (const c of non) {
      const k = weekKey(c.publishedAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(c);
    }
    return [...map.entries()];
  })();
</script>

<PageHeader title="Regulatory Horizon" subtitle="Powered by Regulatory Horizon agent — {sourcesCount} source{sourcesCount === 1 ? '' : 's'} monitored, 24/7.">
  <svelte:fragment slot="actions">
    <AgentTypeBadge type="intelligent" />
  </svelte:fragment>
</PageHeader>

<div class="space-y-6">
  <!-- KPI strip -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <Kpi label="Sources Monitored" value={sourcesCount.toString()}>
      <Antenna slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="Changes (30d)" value={changes30d.toString()} delta={4}>
      <FileText slot="icon" class="h-4 w-4 text-blue-600" />
    </Kpi>
    <Kpi label="Active Impact Assessments" value={activeImpacts.toString()}>
      <Activity slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="Gaps Opened (30d)" value={gapsOpened30d.toString()} tone="bad">
      <AlertTriangle slot="icon" class="h-4 w-4 text-rose-600" />
    </Kpi>
  </div>

  <!-- Hero callout -->
  {#if hero}
    <a href="/regwatch/{hero.id}" class="block">
      <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-50 via-amber-50 to-white p-6 ring-2 ring-rose-200 hover:ring-rose-300">
        <div class="absolute -right-4 -top-4 opacity-10"><Sparkles class="h-32 w-32 text-rose-500" /></div>
        <div class="relative flex items-start gap-3">
          <div class="rounded-lg bg-rose-100 p-2 text-rose-700"><AlertTriangle class="h-5 w-5" /></div>
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ring-1 ring-inset {regColor(hero.regulatorCode)}">{hero.regulatorCode}</span>
              <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {sevCls(hero.severity)}">{hero.severity}</span>
              <span class="text-xs text-slate-500">· detected {fmtRel(hero.publishedAt)} by</span>
              <AgentTypeBadge type="intelligent" />
              <span class="text-xs text-slate-500">Regulatory Horizon agent</span>
            </div>
            <h2 class="mt-2 text-xl font-bold text-rose-900">{hero.title}</h2>
            <p class="mt-1 max-w-3xl text-sm text-slate-700">{hero.summary}</p>
            {#if heroImpact}
              <div class="mt-3 inline-flex flex-wrap items-center gap-3 rounded-lg bg-white/70 px-3 py-2 text-xs ring-1 ring-rose-100">
                <span class="font-semibold text-rose-900">Impact assessed:</span>
                <span class="text-slate-700">{heroImpact.gapsOpened} new gaps{heroImpact.frameworkName ? ` · framework ${heroImpact.frameworkName}` : ''}{heroImpact.tenantName ? ` · ${heroImpact.tenantName}` : ''} · {fmtRel(heroImpact.assessedAt)}</span>
              </div>
            {/if}
          </div>
          <ChevronRight class="mt-2 h-5 w-5 text-rose-400" />
        </div>
      </div>
    </a>
  {/if}

  <!-- Timeline -->
  <div class="space-y-4">
    {#each groupedChanges as [week, items]}
      <div>
        <h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{week}</h3>
        <div class="card overflow-hidden">
          <div class="divide-y divide-slate-100">
            {#each items as c (c.id)}
              {@const bar = sevBar(c.severity)}
              <a href="/regwatch/{c.id}" class="block px-4 py-3 hover:bg-slate-50">
                <div class="flex items-start gap-3">
                  <span class="mt-1 inline-flex flex-none items-center rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ring-1 ring-inset {regColor(c.regulatorCode)}">{c.regulatorCode ?? '—'}</span>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <span class="truncate font-medium text-slate-800">{c.title}</span>
                      <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {sevCls(c.severity)}">{c.severity}</span>
                    </div>
                    <div class="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <span>{c.sourceName}</span>
                      <span>·</span>
                      <span>{c.publishedAt.slice(0, 10)}</span>
                      <span>·</span>
                      <span>Detected by Regulatory Horizon agent · {fmtRel(c.publishedAt)}</span>
                    </div>
                    <div class="mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-slate-100">
                      <div class="h-full rounded-full {bar.cls}" style="width:{bar.w}"></div>
                    </div>
                  </div>
                  <ChevronRight class="mt-1 h-4 w-4 text-slate-400" />
                </div>
              </a>
            {/each}
          </div>
        </div>
      </div>
    {/each}
  </div>
</div>
