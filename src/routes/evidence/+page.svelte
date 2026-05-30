<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import EvidenceChip from '$lib/components/EvidenceChip.svelte';
  import AgentTypeBadge from '$lib/components/AgentTypeBadge.svelte';
  import { enhance } from '$app/forms';
  import { addToast } from '$lib/stores/toast';
  import { FileLock2, Clock, ShieldCheck, Calendar, Filter, CheckCircle2, LayoutGrid, Plus } from 'lucide-svelte';
  import type { EvidenceKind, EvidenceCollectorKind, EvidenceDomain } from '$lib/data/types';
  import { EVIDENCE_DOMAINS, EVIDENCE_DOMAIN_LABELS } from '$lib/data/types';

  export let data;
  export let form: { evidenceError?: string; evidenceCollected?: boolean } | undefined = undefined;

  let showCollectForm = false;

  $: if (form?.evidenceCollected) { addToast('success', 'Evidence item recorded.'); showCollectForm = false; }

  // ---------- Domain coverage ----------
  // Count items per GRC domain so the vault visibly covers all ten.
  $: domainCounts = (() => {
    const c: Record<string, number> = {};
    for (const d of EVIDENCE_DOMAINS) c[d] = 0;
    for (const e of data.items) {
      const d = (e.domain ?? (e.metadata?.domain as EvidenceDomain | undefined));
      if (d && d in c) c[d] += 1;
    }
    return c;
  })();
  $: domainsCovered = EVIDENCE_DOMAINS.filter((d) => domainCounts[d] > 0).length;

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
  let domainFilter: 'all' | EvidenceDomain = 'all';

  function domainOf(e: { domain?: EvidenceDomain; metadata?: Record<string, unknown> }): EvidenceDomain | undefined {
    return e.domain ?? (e.metadata?.domain as EvidenceDomain | undefined);
  }

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
    if (domainFilter !== 'all' && domainOf(e) !== domainFilter) return false;
    if (!inDate(e.capturedAt)) return false;
    return true;
  });

  let page = 0;
  const PAGE_SIZE = 25;
  $: pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  $: visiblePage = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  $: if (page >= pageCount) page = 0;

  function linkedControlsCount(id: number): number {
    return (data.controlCounts as Record<number, number>)[id] ?? 0;
  }

  function kindCls(k: EvidenceKind): string {
    switch (k) {
      case 'screenshot':   return 'bg-purple-50 text-purple-700 ring-purple-200';
      case 'log':          return 'bg-slate-100 text-slate-700 ring-slate-200';
      case 'config':       return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'attestation':  return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'document':     return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'scan-result':  return 'bg-rose-50 text-rose-700 ring-rose-200';
      case 'api-response': return 'bg-slate-100 text-slate-700 ring-slate-200';
    }
  }

  function fmtAbs(iso: string): string {
    return iso.replace('T', ' ').slice(0, 19);
  }

  function isAgentEvidence(e: { collectorId?: string }): boolean {
    return !!e.collectorId;
  }
</script>

<PageHeader title="Evidence Vault" subtitle="Tamper-evident, agent-sealed evidence chain — every collection linked, hashed, replayable.">
  <svelte:fragment slot="actions">
    {#if !data.isAll}
      <button class="btn-primary" on:click={() => (showCollectForm = !showCollectForm)}>
        <Plus class="h-4 w-4" /> Collect Evidence
      </button>
    {/if}
  </svelte:fragment>
</PageHeader>

{#if showCollectForm && !data.isAll}
  <div class="card space-y-4 p-4">
    <h3 class="font-semibold text-slate-800">Log Evidence Item</h3>
    <form method="POST" action="?/collectEvidence" use:enhance class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div class="sm:col-span-2">
        <label class="label" for="ev-title">Title <span class="text-rose-500">*</span></label>
        <input id="ev-title" name="title" type="text" class="input" placeholder="MAS TRM control test evidence pack" required maxlength="512" />
      </div>
      <div>
        <label class="label" for="ev-kind">Kind</label>
        <select id="ev-kind" name="kind" class="input">
          <option value="document">Document</option>
          <option value="screenshot">Screenshot</option>
          <option value="log">Log</option>
          <option value="config">Config</option>
          <option value="attestation">Attestation</option>
          <option value="scan-result">Scan Result</option>
          <option value="api-response">API Response</option>
        </select>
      </div>
      <div>
        <label class="label" for="ev-domain">Domain</label>
        <select id="ev-domain" name="domain" class="input">
          <option value="">— None —</option>
          {#each EVIDENCE_DOMAINS as d}
            <option value={d}>{EVIDENCE_DOMAIN_LABELS[d]}</option>
          {/each}
        </select>
      </div>
      <div class="sm:col-span-2">
        <label class="label" for="ev-url">Source URL</label>
        <input id="ev-url" name="sourceUrl" type="url" class="input" placeholder="https://…" maxlength="2048" />
      </div>
      {#if form?.evidenceError}
        <p class="sm:col-span-2 text-sm text-rose-600">{form.evidenceError}</p>
      {/if}
      <div class="sm:col-span-2 flex gap-2 justify-end">
        <button type="button" class="btn-secondary" on:click={() => (showCollectForm = false)}>Cancel</button>
        <button type="submit" class="btn-primary"><Plus class="h-4 w-4" /> Record</button>
      </div>
    </form>
  </div>
{/if}

<div class="space-y-6">
  <!-- KPI strip -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <Kpi label="Items in Vault" value={data.stats.total.toLocaleString()}>
      <FileLock2 slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="Collected (24h)" value={data.stats.last24h.toLocaleString()} hint="last 24 hours">
      <Clock slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi
      label="Hash-Chain Status"
      value={data.stats.chainOk ? '✓ Intact' : '⚠ Broken'}
      tone={data.stats.chainOk ? 'good' : 'bad'}
    >
      <ShieldCheck slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="Avg Age" value={avgAgeDays.toFixed(1)} suffix="days">
      <Calendar slot="icon" class="h-4 w-4 text-slate-500" />
    </Kpi>
  </div>

  <!-- Integrity banner -->
  <div class="flex items-start gap-3 rounded-xl border-2 border-violet-300 bg-violet-50 px-5 py-4">
    <CheckCircle2 class="mt-0.5 h-5 w-5 flex-none text-violet-600" />
    <div class="flex-1">
      <div class="text-sm font-semibold text-violet-900">
        Vault integrity verified at {nowSgt} SGT
      </div>
      <div class="mt-0.5 text-xs text-violet-700">
        {data.stats.total.toLocaleString()} of {data.stats.total.toLocaleString()} items sealed · prev-row hash chain validated end-to-end.
      </div>
    </div>
    <AgentTypeBadge type="intelligent" />
  </div>

  <!-- GRC domain coverage -->
  <div class="card px-5 py-4">
    <div class="mb-3 flex items-center gap-2">
      <LayoutGrid class="h-4 w-4 text-violet-600" />
      <h2 class="text-sm font-semibold text-slate-800">GRC Evidence Coverage</h2>
      <span class="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700 ring-1 ring-inset ring-violet-200">
        {domainsCovered}/{EVIDENCE_DOMAINS.length} domains
      </span>
      <span class="ml-auto text-[11px] text-slate-400">Click a domain to filter</span>
    </div>
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {#each EVIDENCE_DOMAINS as d}
        <button type="button"
          class="flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors {domainFilter === d
            ? 'border-grc-primary bg-grc-primary/5'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}"
          on:click={() => (domainFilter = domainFilter === d ? 'all' : d)}>
          <span class="text-xs font-medium text-slate-700">{EVIDENCE_DOMAIN_LABELS[d]}</span>
          <span class="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums {domainCounts[d] > 0
            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200'
            : 'bg-slate-100 text-slate-400'}">
            {domainCounts[d]}
          </span>
        </button>
      {/each}
    </div>
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
            <th class="px-4 py-2 text-left">Domain</th>
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
                {#if domainOf(e)}
                  <span class="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-inset ring-slate-200">{EVIDENCE_DOMAIN_LABELS[domainOf(e)!]}</span>
                {:else}
                  <span class="text-xs text-slate-400">—</span>
                {/if}
              </td>
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
                {#if isAgentEvidence(e)}
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
            <tr><td colspan="8" class="px-4 py-8 text-center text-sm text-slate-500">No evidence items match.</td></tr>
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
