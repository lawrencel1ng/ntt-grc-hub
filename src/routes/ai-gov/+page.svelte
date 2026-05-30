<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import {
    BrainCircuit, ShieldCheck, BarChart3, Sparkles, ChevronRight, Award, Plus
  } from 'lucide-svelte';
  import type { AIModel, AIRiskTier, ISO42001Status, AIModelKind } from '$lib/data/types';
  import { enhance } from '$app/forms';
  import { addToast } from '$lib/stores/toast';

  export let data;
  export let form: { created?: boolean; createError?: string } | null = null;

  $: if (form?.created) { addToast('success', 'AI model registered.'); showRegisterForm = false; }
  $: if (form?.createError) addToast('error', form.createError);

  let showRegisterForm = false;

  // ---------- KPIs ----------
  $: total = data.models.length;
  $: highRisk = data.models.filter((m: AIModel) => m.riskTier === 'high' || m.riskTier === 'unacceptable').length;
  $: iso42001Compliant = data.models.filter((m: AIModel) => m.iso42001Status === 'compliant').length;
  $: iso42001Pct = total > 0 ? Math.round((iso42001Compliant / total) * 100) : 0;
  $: prompts24h = data.prompts.filter((p: { capturedAt: string }) =>
    (Date.now() - new Date(p.capturedAt).getTime()) <= 86_400_000).length;
  $: tsuzumiCount = data.models.filter((m: AIModel) => /tsuzumi/i.test(m.name)).length;

  // ---------- Helpers ----------
  function tierCls(t: AIRiskTier): string {
    switch (t) {
      case 'unacceptable': return 'bg-rose-100 text-rose-900 ring-rose-300';
      case 'high':         return 'bg-rose-50 text-rose-700 ring-rose-200';
      case 'limited':      return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'minimal':      return 'bg-violet-50 text-violet-700 ring-violet-200';
    }
  }
  function kindCls(k: AIModelKind): string {
    switch (k) {
      case 'llm':         return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'classifier':  return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'regression':  return 'bg-slate-100 text-slate-700 ring-slate-200';
      case 'vision':      return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'recommender': return 'bg-amber-50 text-amber-700 ring-amber-200';
    }
  }
  function isoCls(s: ISO42001Status): string {
    switch (s) {
      case 'compliant':     return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'in-progress':   return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'non-compliant': return 'bg-rose-50 text-rose-700 ring-rose-200';
    }
  }
</script>

<PageHeader title="AI Governance" subtitle="EU AI Act · ISO 42001 · NIST AI RMF · MAS FEAT {data.isAll ? '· aggregated view' : ''}">
  <svelte:fragment slot="actions">
    {#if !data.isAll}
      <button class="btn-primary" on:click={() => (showRegisterForm = !showRegisterForm)}>
        <Plus class="h-4 w-4" />
        <span>Register Model</span>
      </button>
    {/if}
  </svelte:fragment>
</PageHeader>

{#if showRegisterForm}
  <div class="card p-5">
    <h3 class="mb-4 text-sm font-semibold text-grc-ink">Register AI Model</h3>
    <form method="POST" action="?/registerModel" use:enhance class="space-y-4">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700">Name</span>
          <input name="name" class="input" placeholder="e.g. Credit Risk Classifier" required maxlength="256" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700">Kind</span>
          <select name="kind" class="input">
            <option value="llm">LLM</option>
            <option value="classifier">Classifier</option>
            <option value="regression">Regression</option>
            <option value="vision">Vision</option>
            <option value="recommender">Recommender</option>
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700">Risk Tier</span>
          <select name="riskTier" class="input">
            <option value="minimal">Minimal</option>
            <option value="limited">Limited</option>
            <option value="high">High</option>
            <option value="unacceptable">Unacceptable</option>
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700">Jurisdiction</span>
          <input name="jurisdiction" class="input" value="Singapore" maxlength="128" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700">ISO 42001 Status</span>
          <select name="iso42001Status" class="input">
            <option value="not-started">Not started</option>
            <option value="in-progress">In progress</option>
            <option value="certified">Certified</option>
          </select>
        </label>
      </div>
      <div class="flex gap-2">
        <button type="submit" class="btn-primary">Register model</button>
        <button type="button" class="btn-secondary" on:click={() => (showRegisterForm = false)}>Cancel</button>
      </div>
    </form>
  </div>
{/if}

<div class="space-y-6">
  <!-- KPI strip -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
    <Kpi label="Models in Production" value={total.toString()}>
      <BrainCircuit slot="icon" class="h-4 w-4 text-grc-primary" />
    </Kpi>
    <Kpi label="EU AI Act High-Risk" value={highRisk.toString()} tone="bad">
      <ShieldCheck slot="icon" class="h-4 w-4 text-rose-600" />
    </Kpi>
    <Kpi label="ISO 42001 Compliant" value={iso42001Pct.toString()} suffix="%" hint="{iso42001Compliant}/{total} models">
      <Award slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="Prompts Logged (24h)" value={prompts24h.toLocaleString()}>
      <BarChart3 slot="icon" class="h-4 w-4 text-blue-600" />
    </Kpi>
    <Kpi label="NTT Tsuzumi Models" value={tsuzumiCount.toString()} hint="sovereign LLM">
      <Sparkles slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
  </div>

  <!-- Hero callout — NTT Tsuzumi sovereign LLM story -->
  <div class="card bg-white p-5 ring-1 ring-inset ring-violet-200">
    <div class="flex items-start gap-3">
      <div class="rounded-md bg-violet-50 p-2 text-violet-700">
        <Sparkles class="h-5 w-5" />
      </div>
      <div class="flex-1">
        <div class="text-sm font-semibold text-slate-800">
          All {total} production model{total === 1 ? '' : 's'} risk-classified per EU AI Act.
        </div>
        <p class="mt-1 text-xs leading-relaxed text-slate-600">
          <span class="font-semibold">NTT Tsuzumi</span> (sovereign LLM, on-premise, Japanese-origin) covers
          {tsuzumiCount > 0 ? `${tsuzumiCount} of ${total} models` : 'designated sensitive workloads'} —
          air-gapped inference with full audit trail. ISO 42001 controls operational; prompts cryptographically sealed and
          retained for 7 years under MAS Notice 644 and applicable defence-grade data-handling policies.
        </p>
      </div>
      <a href="/decisions" class="inline-flex items-center gap-1 rounded-md border border-violet-300 bg-white px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50">
        View decisions <ChevronRight class="h-3 w-3" />
      </a>
    </div>
  </div>

  <!-- Models table -->
  <div class="card overflow-hidden">
    <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
      <h2 class="section-title">AI Model Inventory</h2>
      <span class="text-xs text-slate-400">{total} model{total === 1 ? '' : 's'} · click a row to view drift &amp; prompts</span>
    </div>
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-100 text-sm">
        <thead class="thead">
          <tr>
            <th class="px-4 py-2 text-left">Model</th>
            <th class="px-4 py-2 text-left">Kind</th>
            <th class="px-4 py-2 text-left">Owner</th>
            <th class="px-4 py-2 text-left">Risk Tier</th>
            <th class="px-4 py-2 text-left">EU AI Act</th>
            <th class="px-4 py-2 text-left">ISO 42001</th>
            <th class="px-4 py-2 text-left">Jurisdiction</th>
            <th class="w-8 px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {#each data.models as m (m.id)}
            <tr class="tr">
              <td class="td font-medium">
                <a href="/ai-gov/{m.id}" class="text-grc-primary hover:underline">{m.name}</a>
              </td>
              <td class="td">
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {kindCls(m.kind)}">{m.kind}</span>
              </td>
              <td class="td text-xs text-slate-600">{m.ownerEmail ?? '—'}</td>
              <td class="td">
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {tierCls(m.riskTier)}">{m.riskTier}</span>
              </td>
              <td class="td text-xs font-medium text-slate-700">{m.euAiActClass}</td>
              <td class="td">
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {isoCls(m.iso42001Status)}">{m.iso42001Status}</span>
              </td>
              <td class="td text-xs font-mono text-slate-600">{m.jurisdiction}</td>
              <td class="td">
                <a href="/ai-gov/{m.id}" class="text-slate-400 hover:text-grc-primary">
                  <ChevronRight class="h-4 w-4" />
                </a>
              </td>
            </tr>
          {:else}
            <tr><td colspan="8" class="px-4 py-8 text-center text-sm text-slate-500">No AI models registered.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>
