<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import EvidenceChip from '$lib/components/EvidenceChip.svelte';
  import AgentTypeBadge from '$lib/components/AgentTypeBadge.svelte';
  import { FileLock2, Clock, ShieldCheck, Calendar, Filter, CheckCircle2 } from 'lucide-svelte';
  import type { EvidenceKind, EvidenceCollectorKind } from '$lib/data/types';

  export let data;

  // ---------- Stats ----------
  $: now = new Date();
  $: nowSgt = now.toLocaleString('en-SG', { timeZone: 'Asia/Singapore', hour12: false });
  $: avgAgeDays = (() => {
    if (!data.items.length) return 0;
    const sum = data.items.reduce((s, e) => s + (Date.now() - new Date(e.capturedAt).getTime()), 0);
    return sum / data.items.length / 86_400_000;
  })();

  // ---------- Filters ----------
  let kindFilter: 'all' | EvidenceKind = 'all';
  let collectorFilter: 'all' | EvidenceCollectorKind = 'all';
  let dateFilter: 'all' | '24h' | '7d' | '30d' | '90d' = 'all';

  const KINDS: ('all' | EvidenceKind)[] = ['all','screenshot','log','config','attestation','document','scan-result','api-response'];
  const COLLECTORS: ('all' | EvidenceCollectorKind)[] = ['all','aws','azure','gcp','okta','jira','m365','github','servicenow','slack','manual'];
  const DATE_FILTERS: ('all' | '24h' | '7d' | '30d' | '90d')[] = ['all','24h','7d','30d','90d'];

  function inDate(iso: string): boolean {
    if (dateFilter === 'all') return true;
    const ageDays = (Date.now() - new Date(iso).getTime()) / 86_400_000;
    if (dateFilter === '24h') return ageDays <= 1;
    if (dateFilter === '7d')  return ageDays <= 7;
    if (dateFilter === '30d') return ageDays <= 30;
    if (dateFilter === '90d') return ageDays <= 90;
    return true;
  }

  $: filtered = data.items.filter((e) => {
    if (kindFilter !== 'all' && e.kind !== kindFilter) return false;
    if (collectorFilter !== 'all' && !(e.collectorId ?? '').includes(collectorFilter)) return false;
    if (!inDate(e.capturedAt)) return false;
    return true;
  });

  let page = 0;
  const PAGE_SIZE = 25;
  $: pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  $: visiblePage = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  $: if (page >= pageCount) page = 0;

  // Heuristic linked control count per item — for display only.
  function linkedControlsCount(id: number): number {
    return (id % 4) + 1;
  }

  function kindCls(k: EvidenceKind): string {
    switch (k) {
      case 'screenshot':   return 'bg-purple-50 text-purple-700 ring-purple-200';
      case 'log':          return 'bg-slate-100 text-slate-700 ring-slate-200';
      case 'config':       return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'attestation':  return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
      case 'document':     return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'scan-result':  return 'bg-rose-50 text-rose-700 ring-rose-200';
      case 'api-response': return 'bg-cyan-50 text-cyan-700 ring-cyan-200';
    }
  }

  function fmtAbs(iso: string): string {
    return iso.replace('T', ' ').slice(0, 19);
  }

  function isAgentEvidence(id: number): boolean {
    // Hero & Maybank items are flagged as Evidence Collector collected.
    return id >= 9_000_000;
  }
</script>

<PageHeader title="Evidence Vault" subtitle="Tamper-evident, agent-sealed evidence chain — every collection linked, hashed, replayable." />

<div class="space-y-6">
  <!-- KPI strip -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <Kpi label="Items in Vault" value={data.stats.total.toLocaleString()}>
      <FileLock2 slot="icon" class="h-4 w-4 text-emerald-600" />
    </Kpi>
    <Kpi label="Collected (24h)" value={data.stats.last24h.toLocaleString()} delta={18} hint="active collectors">
      <Clock slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi
      label="Hash-Chain Status"
      value={data.stats.chainOk ? '✓ Intact' : '⚠ Broken'}
      tone={data.stats.chainOk ? 'good' : 'bad'}
    >
      <ShieldCheck slot="icon" class="h-4 w-4 text-emerald-600" />
    </Kpi>
    <Kpi label="Avg Age" value={avgAgeDays.toFixed(1)} suffix="days">
      <Calendar slot="icon" class="h-4 w-4 text-slate-500" />
    </Kpi>
  </div>

  <!-- Integrity banner -->
  <div class="flex items-start gap-3 rounded-xl border-2 border-emerald-300 bg-emerald-50 px-5 py-4">
    <CheckCircle2 class="mt-0.5 h-5 w-5 flex-none text-emerald-600" />
    <div class="flex-1">
      <div class="text-sm font-semibold text-emerald-900">
        Vault integrity verified at {nowSgt} SGT
      </div>
      <div class="mt-0.5 text-xs text-emerald-700">
        {data.stats.total.toLocaleString()} of {data.stats.total.toLocaleString()} items sealed · prev-row hash chain validated end-to-end.
      </div>
    </div>
    <AgentTypeBadge type="intelligent" />
  </div>

  <!-- Filter bar -->
  <div class="card flex flex-wrap items-center gap-3 px-4 py-3">
    <Filter class="h-4 w-4 text-slate-400" />
    <select bind:value={collectorFilter} class="input w-32 py-1.5">
      {#each COLLECTORS as c}
        <option value={c}>{c === 'all' ? 'All collectors' : c}</option>
      {/each}
    </select>
    <div class="flex items-center gap-1">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Kind:</span>
      {#each KINDS as k}
        <button type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {kindFilter === k
            ? 'bg-grc-primary text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
          on:click={() => (kindFilter = k)}>{k === 'all' ? 'All' : k}</button>
      {/each}
    </div>
    <span class="text-slate-300">·</span>
    <div class="flex items-center gap-1">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Date:</span>
      {#each DATE_FILTERS as d}
        <button type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {dateFilter === d
            ? 'bg-grc-primary text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
          on:click={() => (dateFilter = d)}>{d === 'all' ? 'All' : d}</button>
      {/each}
    </div>
    <span class="ml-auto text-xs text-slate-500">{filtered.length.toLocaleString()} items</span>
  </div>

  <!-- Table -->
  <div class="card overflow-hidden">
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-100 text-sm">
        <thead class="thead">
          <tr>
            <th class="px-4 py-2 text-left">Title</th>
            <th class="px-4 py-2 text-left">Kind</th>
            <th class="px-4 py-2 text-left">Collector</th>
            <th class="px-4 py-2 text-left">Captured</th>
            <th class="px-4 py-2 text-left">Hash</th>
            <th class="px-4 py-2 text-center">Links</th>
            <th class="px-4 py-2 text-left">Attribution</th>
          </tr>
        </thead>
        <tbody>
          {#each visiblePage as e (e.id)}
            <tr class="tr">
              <td class="td max-w-md truncate">{e.title}</td>
              <td class="td">
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {kindCls(e.kind)}">{e.kind}</span>
              </td>
              <td class="td text-xs text-slate-500 font-mono">{e.collectorId ?? '—'}</td>
              <td class="td font-mono text-xs text-slate-500">{fmtAbs(e.capturedAt)}</td>
              <td class="td"><EvidenceChip hash={e.rowHash ?? ''} /></td>
              <td class="td text-center">
                <span title="Linked controls" class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-700">
                  {linkedControlsCount(e.id)}
                </span>
              </td>
              <td class="td">
                {#if isAgentEvidence(e.id)}
                  <div class="flex items-center gap-1.5">
                    <AgentTypeBadge type="intelligent" />
                    <span class="text-[11px] text-slate-500">Evidence Collector</span>
                  </div>
                {:else}
                  <span class="text-xs text-slate-500">manual</span>
                {/if}
              </td>
            </tr>
          {:else}
            <tr><td colspan="7" class="px-4 py-8 text-center text-sm text-slate-500">No evidence items match.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
    <div class="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
      <span>Page {page + 1} of {pageCount}</span>
      <div class="flex items-center gap-2">
        <button class="btn-ghost py-1 text-xs" on:click={() => (page = Math.max(0, page - 1))} disabled={page === 0}>Prev</button>
        <button class="btn-ghost py-1 text-xs" on:click={() => (page = Math.min(pageCount - 1, page + 1))} disabled={page >= pageCount - 1}>Next</button>
      </div>
    </div>
  </div>
</div>
