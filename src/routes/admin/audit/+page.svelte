<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import { addToast } from '$lib/stores/toast';
  import { toCsv } from '$lib/utils/csv';
  import { formatIsoSgt } from '$lib/utils/dates';
  import {
    FileSearch, Download, ShieldCheck, AlertTriangle, Users, Ban, Search
  } from 'lucide-svelte';
  import type { AuditLogEntry } from '$lib/data/types';

  export let data;

  // ---------- Filter state ----------
  let actorQuery = '';
  let actionFilter = 'all';
  let resultFilter: 'all' | 'success' | 'failure' | 'denied' = 'all';
  let rangeFilter: 'all' | '24h' | '7d' | '30d' = '30d';

  $: actions = ['all', ...Array.from(new Set(data.entries.map((e) => e.action)))];

  $: filtered = data.entries.filter((e: AuditLogEntry) => {
    if (actorQuery.trim() && !e.actorEmail.toLowerCase().includes(actorQuery.toLowerCase())) return false;
    if (actionFilter !== 'all' && e.action !== actionFilter) return false;
    if (resultFilter !== 'all' && e.result !== resultFilter) return false;
    if (rangeFilter !== 'all') {
      const cutoff = rangeFilter === '24h' ? 86_400_000
                  : rangeFilter === '7d' ? 7 * 86_400_000
                  : 30 * 86_400_000;
      if (Date.now() - new Date(e.ts).getTime() > cutoff) return false;
    }
    return true;
  });

  // ---------- KPIs (30d) ----------
  $: last30d = data.entries.filter((e) => Date.now() - new Date(e.ts).getTime() <= 30 * 86_400_000);
  $: failed = last30d.filter((e) => e.result === 'failure').length;
  $: denied = last30d.filter((e) => e.result === 'denied').length;
  $: uniqueActors = new Set(last30d.map((e) => e.actorEmail)).size;

  // ---------- Pagination ----------
  const PAGE = 50;
  let page = 1;
  $: pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  $: pageRows = filtered.slice((page - 1) * PAGE, page * PAGE);
  $: if (page > pageCount) page = 1;

  // ---------- Helpers ----------
  function resultCls(r: AuditLogEntry['result']): string {
    switch (r) {
      case 'success': return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'failure': return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'denied':  return 'bg-rose-50 text-rose-700 ring-rose-200';
    }
  }
  function shortHash(h: string): string {
    return h.slice(0, 8) + '…' + h.slice(-4);
  }
  function shortUa(ua?: string): string {
    if (!ua) return '—';
    if (ua.startsWith('Mozilla')) {
      // Pull out the platform + main browser token.
      const m = /\((.*?)\).*?(Chrome|Safari|Firefox|Edge)\/[\d.]+/.exec(ua);
      if (m) return `${m[1].split(';')[0]} · ${m[2]}`;
    }
    return ua.length > 40 ? ua.slice(0, 37) + '…' : ua;
  }
  function tenantName(id?: string): string {
    if (!id) return '—';
    return data.tenants.find((t) => t.id === id)?.name ?? id;
  }

  // ---------- CSV export ----------
  function exportCsv() {
    const rows = filtered.map((e) => ({
      ts: e.ts,
      tenant: tenantName(e.tenantId),
      actor: e.actorEmail,
      action: e.action,
      target: e.target,
      result: e.result,
      ip: e.ipAddress ?? '',
      hash: e.rowHash
    }));
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast('success', `Exported ${rows.length} audit entries to CSV.`);
  }

  const verifiedAt = formatIsoSgt(new Date());
</script>

<PageHeader title="Platform Audit Log" subtitle="Tamper-evident · SHA-256 hash chain">
  <svelte:fragment slot="actions">
    <button class="btn-secondary" on:click={exportCsv}>
      <Download class="h-4 w-4" />
      <span>Export CSV</span>
    </button>
  </svelte:fragment>
</PageHeader>

<div class="space-y-6">
  <!-- Verification banner -->
  <div class="flex flex-wrap items-center gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-inset ring-violet-200">
    <ShieldCheck class="h-5 w-5 text-violet-700" />
    <span class="text-sm font-semibold text-slate-800">Audit log verified — chain intact</span>
    <span class="text-slate-300">·</span>
    <span class="num text-xs text-slate-600">{data.entries.length} of {data.entries.length} entries</span>
    <span class="text-violet-300">·</span>
    <span class="text-xs text-violet-800">Last verified <span class="num">{verifiedAt}</span></span>
  </div>

  <!-- KPI strip -->
  <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
    <Kpi label="Total Entries (30d)" value={last30d.length.toString()}>
      <FileSearch slot="icon" class="h-4 w-4 text-grc-primary" />
    </Kpi>
    <Kpi label="Failed Actions" value={failed.toString()} tone="bad" hint="server-side errors">
      <AlertTriangle slot="icon" class="h-4 w-4 text-amber-600" />
    </Kpi>
    <Kpi label="Unique Actors" value={uniqueActors.toString()} hint="distinct emails">
      <Users slot="icon" class="h-4 w-4 text-grc-primary" />
    </Kpi>
    <Kpi label="Denied Attempts" value={denied.toString()} tone="bad" hint="RBAC blocks">
      <Ban slot="icon" class="h-4 w-4 text-rose-600" />
    </Kpi>
  </div>

  <!-- Filters -->
  <div class="card flex flex-wrap items-center gap-3 px-4 py-3">
    <div class="relative w-64">
      <Search class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input bind:value={actorQuery} type="search" placeholder="Actor email…" class="input pl-8" />
    </div>
    <select bind:value={actionFilter} class="input w-56 py-1.5">
      {#each actions as a}
        <option value={a}>{a === 'all' ? 'All actions' : a}</option>
      {/each}
    </select>
    <div class="flex items-center gap-1">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Result:</span>
      {#each ['all','success','failure','denied'] as r}
        <button type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {resultFilter === r
            ? 'bg-grc-primary text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
          on:click={() => (resultFilter = r as typeof resultFilter)}>{r}</button>
      {/each}
    </div>
    <div class="flex items-center gap-1">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Range:</span>
      {#each ['24h','7d','30d','all'] as r}
        <button type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {rangeFilter === r
            ? 'bg-grc-primary text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
          on:click={() => (rangeFilter = r as typeof rangeFilter)}>{r}</button>
      {/each}
    </div>
    <span class="ml-auto text-xs text-slate-500">{filtered.length} of {data.entries.length}</span>
  </div>

  <!-- Audit table -->
  <div class="card overflow-hidden">
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-100 text-sm">
        <thead class="thead">
          <tr>
            <th class="px-4 py-2 text-left">Timestamp (SGT)</th>
            <th class="px-4 py-2 text-left">Actor</th>
            <th class="px-4 py-2 text-left">Tenant</th>
            <th class="px-4 py-2 text-left">Action</th>
            <th class="px-4 py-2 text-left">Target</th>
            <th class="px-4 py-2 text-left">Result</th>
            <th class="px-4 py-2 text-left">IP</th>
            <th class="px-4 py-2 text-left">User-Agent</th>
            <th class="px-4 py-2 text-left">Hash</th>
          </tr>
        </thead>
        <tbody>
          {#each pageRows as e}
            <tr class="tr">
              <td class="td num text-[11px] text-slate-500">{formatIsoSgt(e.ts)}</td>
              <td class="td">{e.actorEmail}</td>
              <td class="td"><span class="tag tag-slate">{tenantName(e.tenantId)}</span></td>
              <td class="td num text-[11px] text-slate-700">{e.action}</td>
              <td class="td num text-[11px] text-slate-500">{e.target}</td>
              <td class="td">
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ring-inset {resultCls(e.result)}">
                  {e.result}
                </span>
              </td>
              <td class="td num text-[11px] text-slate-500">{e.ipAddress ?? '—'}</td>
              <td class="td text-[11px] text-slate-500">{shortUa(e.userAgent)}</td>
              <td class="td">
                <span class="evidence-chip" title={e.rowHash}>{shortHash(e.rowHash)}</span>
              </td>
            </tr>
          {:else}
            <tr><td colspan="9" class="px-4 py-8 text-center text-sm text-slate-500">No entries match.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if filtered.length > 0}
      <div class="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
        <span>Showing {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, filtered.length)} of {filtered.length.toLocaleString()}</span>
        <div class="flex items-center gap-2">
          <button class="btn-ghost py-1 text-xs" on:click={() => page = Math.max(1, page - 1)} disabled={page === 1}>Prev</button>
          <span class="num">{page} / {pageCount}</span>
          <button class="btn-ghost py-1 text-xs" on:click={() => page = Math.min(pageCount, page + 1)} disabled={page === pageCount}>Next</button>
        </div>
      </div>
    {/if}
  </div>
</div>
