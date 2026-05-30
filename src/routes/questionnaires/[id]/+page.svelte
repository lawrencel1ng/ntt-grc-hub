<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Gauge from '$lib/components/Gauge.svelte';
  import ConfidenceBar from '$lib/components/ConfidenceBar.svelte';
  import EvidenceChip from '$lib/components/EvidenceChip.svelte';
  import AgentTypeBadge from '$lib/components/AgentTypeBadge.svelte';
  import { Bot, Building } from 'lucide-svelte';
  import type { QuestionnaireStatus, QuestionnaireResponse } from '$lib/data/types';

  export let data;

  // ---------- Helpers ----------
  function templateCls(t: 'SIG' | 'CAIQ' | 'Custom'): string {
    switch (t) {
      case 'SIG':    return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'CAIQ':   return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'Custom': return 'bg-slate-100 text-slate-600 ring-slate-200';
    }
  }
  function statusCls(s: QuestionnaireStatus): string {
    switch (s) {
      case 'complete':    return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'in-progress': return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'sent':        return 'bg-amber-50 text-amber-700 ring-amber-200';
    }
  }
  function confBorder(c: number): string {
    if (c >= 80) return 'border-l-4 border-l-violet-400';
    if (c >= 60) return 'border-l-4 border-l-amber-400';
    return 'border-l-4 border-l-rose-400';
  }
  function fmtDateTime(iso?: string): string {
    if (!iso) return '—';
    return iso.replace('T', ' ').slice(0, 16) + ' UTC';
  }

  function evidenceFor(r: QuestionnaireResponse) {
    if (!r.sourceEvidenceItemId || data.evidence.length === 0) return null;
    return data.evidence.find((e) => e.id === r.sourceEvidenceItemId) ?? null;
  }

  // ---------- Pagination ----------
  const PAGE = 50;
  let page = 1;
  $: pageCount = Math.max(1, Math.ceil(data.responses.length / PAGE));
  $: pageRows = data.responses.slice((page - 1) * PAGE, page * PAGE);
  $: if (page > pageCount) page = 1;

  $: isAgent = Boolean(data.questionnaire.completedByAgentId);
  // Count of responses with attached source evidence (mirrors the banner copy).
  $: sourcedCount = data.responses.filter((r) => evidenceFor(r) !== null).length;

  function truncate(s: string, n = 60): string {
    if (!s) return '';
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }
</script>

<PageHeader
  title={data.vendor?.name ?? data.questionnaire.vendorName ?? data.questionnaire.vendorId}
  breadcrumbs={[
    { label: 'Questionnaires', href: '/questionnaires' },
    { label: data.vendor?.name ?? data.questionnaire.vendorId }
  ]}
>
  <svelte:fragment slot="actions">
    <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset {templateCls(data.questionnaire.template)}">{data.questionnaire.template}</span>
    <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset {statusCls(data.questionnaire.status)}">{data.questionnaire.status}</span>
  </svelte:fragment>
</PageHeader>

<div class="space-y-6">
  <!-- Header card -->
  <div class="card flex flex-wrap items-center gap-6 p-5">
    <div class="rounded-lg bg-blue-50 p-3 text-blue-700">
      <Building class="h-6 w-6" />
    </div>
    <div class="min-w-0 flex-1">
      <div class="text-xs uppercase tracking-wider text-slate-500">Vendor</div>
      <div class="mt-0.5 text-lg font-semibold text-grc-ink">
        {#if data.vendor}
          <a href="/vendors/{data.vendor.id}" class="hover:underline">{data.vendor.name}</a>
        {:else}
          {data.questionnaire.vendorName ?? data.questionnaire.vendorId}
        {/if}
      </div>
      <div class="mt-0.5 text-xs text-slate-500">
        Sent {fmtDateTime(data.questionnaire.sentAt)}
        {#if data.questionnaire.completedAt}· completed {fmtDateTime(data.questionnaire.completedAt)}{/if}
      </div>
    </div>
    {#if data.questionnaire.score !== undefined}
      <div class="w-48">
        <Gauge value={data.questionnaire.score} label="overall score" />
      </div>
    {/if}
  </div>

  <!-- Agent attribution banner -->
  {#if isAgent}
    <div class="card flex items-start gap-3 bg-white p-5 ring-1 ring-inset ring-violet-200">
      <div class="rounded-md bg-violet-50 p-2 text-violet-700">
        <Bot class="h-5 w-5" />
      </div>
      <div class="flex-1">
        <div class="flex items-center gap-2 text-sm font-semibold text-slate-800">
          Auto-filled by Vendor Risk Analyst agent
          <AgentTypeBadge type="intelligent" />
        </div>
        <div class="mt-1 text-xs text-slate-600">
          Completed {fmtDateTime(data.questionnaire.completedAt)} ·
          Avg confidence <span class="font-mono font-semibold">{data.avgConfidence}%</span> ·
          Source: <span class="font-mono font-semibold">{sourcedCount}</span> evidence items
        </div>
      </div>
    </div>
  {/if}

  <!-- Question-by-question table -->
  <div class="card overflow-hidden">
    <div class="border-b border-slate-100 px-5 py-3 text-xs text-slate-500">
      {data.responses.length} responses · left-border colour shows confidence band
    </div>
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-100 text-sm">
        <thead class="thead">
          <tr>
            <th class="px-4 py-2 text-left">Code</th>
            <th class="px-4 py-2 text-left">Question</th>
            <th class="px-4 py-2 text-left">Response</th>
            <th class="px-4 py-2 text-left">Confidence</th>
            <th class="px-4 py-2 text-left">Source Evidence</th>
          </tr>
        </thead>
        <tbody>
          {#each pageRows as r (r.id)}
            {@const ev = evidenceFor(r)}
            <tr class="tr {confBorder(r.confidence)}">
              <td class="td font-mono text-xs text-slate-500">{r.questionCode}</td>
              <td class="td max-w-md">
                <div class="truncate text-slate-700">Does the vendor implement controls aligned to {data.questionnaire.template} domain {r.questionCode}?</div>
              </td>
              <td class="td max-w-xs">
                <span class="font-medium text-slate-800">{truncate(r.response, 56)}</span>
              </td>
              <td class="td"><ConfidenceBar value={r.confidence} /></td>
              <td class="td">
                {#if ev}
                  <a href="/evidence" class="inline-flex">
                    <EvidenceChip hash={ev.rowHash ?? ''} filename={ev.title.slice(0, 18)} />
                  </a>
                {:else}
                  <span class="text-xs text-slate-400">—</span>
                {/if}
              </td>
            </tr>
          {:else}
            <tr><td colspan="5" class="px-4 py-8 text-center text-sm text-slate-500">No responses recorded.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if data.responses.length > PAGE}
      <div class="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
        <span>Showing {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, data.responses.length)} of {data.responses.length}</span>
        <div class="flex items-center gap-2">
          <button class="btn-ghost py-1 text-xs" on:click={() => page = Math.max(1, page - 1)} disabled={page === 1}>Prev</button>
          <span class="font-mono">{page} / {pageCount}</span>
          <button class="btn-ghost py-1 text-xs" on:click={() => page = Math.min(pageCount, page + 1)} disabled={page === pageCount}>Next</button>
        </div>
      </div>
    {/if}
  </div>
</div>
