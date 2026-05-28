<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import LineChart from '$lib/components/LineChart.svelte';
  import Sparkline from '$lib/components/Sparkline.svelte';
  import AgentTypeBadge from '$lib/components/AgentTypeBadge.svelte';
  import { addToast } from '$lib/stores/toast';
  import {
    BrainCircuit, Calculator, BookOpen, AlertTriangle, ScrollText, Activity,
    ShieldCheck, Sparkles
  } from 'lucide-svelte';
  import type {
    AIModel, AIRiskTier, ISO42001Status, AIModelKind, ModelRisk, PromptAuditEntry, RiskSeverity, ModelRiskType
  } from '$lib/data/types';
  import { hashStringToInt, mulberry32 } from '$lib/data/rng';

  export let data;

  // ---------- Tabs ----------
  type Tab = 'overview' | 'risk' | 'prompts' | 'monitoring';
  let tab: Tab = 'overview';
  const TABS: { id: Tab; label: string; icon: typeof BookOpen }[] = [
    { id: 'overview',   label: 'Overview',         icon: BookOpen },
    { id: 'risk',       label: 'Model Risk',       icon: AlertTriangle },
    { id: 'prompts',    label: 'Prompts Audit',    icon: ScrollText },
    { id: 'monitoring', label: 'Drift & Monitoring', icon: Activity }
  ];

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
  function sevCls(s: RiskSeverity | string): string {
    if (s === 'critical') return 'bg-rose-100 text-rose-800 ring-rose-200';
    if (s === 'high')     return 'bg-orange-50 text-orange-700 ring-orange-200';
    if (s === 'medium')   return 'bg-amber-50 text-amber-700 ring-amber-200';
    if (s === 'low')      return 'bg-yellow-50 text-yellow-700 ring-yellow-200';
    return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
  function riskTypeCls(t: ModelRiskType): string {
    switch (t) {
      case 'bias':           return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'hallucination':  return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'drift':          return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'explainability': return 'bg-slate-100 text-slate-700 ring-slate-200';
      case 'privacy':        return 'bg-rose-50 text-rose-700 ring-rose-200';
    }
  }

  // ---------- Risk-tier explanation ----------
  function tierExplain(t: AIRiskTier): string {
    switch (t) {
      case 'unacceptable':
        return 'Prohibited under EU AI Act Art. 5. Includes social-scoring by public authorities, real-time biometric ID in public spaces. Cannot be deployed.';
      case 'high':
        return 'Subject to EU AI Act Annex III obligations: risk-management system, data governance, transparency, human oversight, accuracy/robustness, conformity assessment, CE marking and post-market monitoring.';
      case 'limited':
        return 'Transparency obligations (Art. 52): users must be informed they are interacting with an AI system. No conformity assessment required.';
      case 'minimal':
        return 'No specific obligations beyond voluntary codes of conduct. Most spam filters, AI-enabled video games.';
    }
  }

  // ---------- Drift score (synthesised) ----------
  $: driftScore = (() => {
    const rng = mulberry32(hashStringToInt(`drift:${data.model.id}`));
    return +(rng() * 0.18).toFixed(3); // 0 — 0.18
  })();

  // ---------- Prompts in last 24h ----------
  $: prompts24h = data.prompts.filter((p: PromptAuditEntry) =>
    (Date.now() - new Date(p.capturedAt).getTime()) <= 86_400_000).length;

  // ---------- Synthesised owner ----------
  function ownerFor(m: AIModel): string {
    const map: Record<AIModelKind, string> = {
      classifier: 'Data Science / Risk',
      llm: 'AI Platform / NLP',
      regression: 'Quant / Pricing',
      vision: 'Document AI',
      recommender: 'Marketing Analytics'
    };
    return map[m.kind];
  }

  // ---------- Training data summary (synthesised) ----------
  function trainingFor(m: AIModel): string {
    switch (m.kind) {
      case 'classifier':
        return '4.2M labelled transactions (2022–2025) · 89/11 train/holdout · stratified by jurisdiction. Class balance: pos 6.4% / neg 93.6%.';
      case 'llm':
        return 'Fine-tuned on 18M proprietary support tickets + sanitised customer-chat transcripts (PII redacted). Base: Tsuzumi-7B sovereign LLM (NTT, on-prem).';
      case 'regression':
        return '12-year loan-performance panel, 380K accounts, 47 features. Time-aware CV with quarterly walk-forward validation.';
      case 'vision':
        return '320K KYC document images (ID, passport, utility bill). Synthetic augmentations: rotation, lighting, occlusion. Annotated by 3rd-party (Scale AI).';
      case 'recommender':
        return '5.8M user-product interactions (90d window). Implicit feedback via SASRec architecture. Cold-start handled by content embeddings.';
    }
  }

  // ---------- Drift sparklines + monitoring chart ----------
  function monitoring(seedKey: string, base: number, jitter: number, n = 30): number[] {
    const rng = mulberry32(hashStringToInt(`mon:${data.model.id}:${seedKey}`));
    const out: number[] = [];
    let v = base;
    for (let i = 0; i < n; i++) {
      v = Math.max(0.5, Math.min(1.0, v + (rng() - 0.5) * jitter));
      out.push(+v.toFixed(4));
    }
    return out;
  }
  $: accuracySeries = monitoring('acc', 0.93, 0.012);
  $: confidenceSeries = monitoring('cnf', 0.86, 0.020);

  const DAYS_30 = (() => {
    const out: string[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      out.push(`${d.getMonth() + 1}/${d.getDate()}`);
    }
    return out;
  })();

  // ---------- Actions ----------
  function runRiskAssessment() {
    addToast('success', `Risk assessment queued for ${data.model.name}. Risk Quantifier agent will report in ~30s.`);
  }

  function fmtTime(iso: string): string {
    return iso.slice(0, 19).replace('T', ' ');
  }
</script>

<PageHeader
  title={data.model.name}
  breadcrumbs={[{ label: 'AI Governance', href: '/ai-gov' }, { label: data.model.name }]}
>
  <svelte:fragment slot="actions">
    <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {kindCls(data.model.kind)}">{data.model.kind}</span>
    <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {tierCls(data.model.riskTier)}">{data.model.riskTier}</span>
    <button class="btn-primary" on:click={runRiskAssessment}>
      <Calculator class="h-4 w-4" />
      <span>Run Risk Assessment</span>
    </button>
  </svelte:fragment>
</PageHeader>

<div class="space-y-6">
  <!-- Title card -->
  <div class="card p-5">
    <div class="flex items-start gap-3">
      <div class="rounded-lg bg-violet-50 p-2 text-violet-700"><BrainCircuit class="h-5 w-5" /></div>
      <div class="flex-1">
        <h2 class="text-lg font-semibold text-grc-ink">{data.model.name}</h2>
        <p class="mt-1 text-sm text-slate-600">Owner: <span class="font-medium text-slate-800">{ownerFor(data.model)}</span> · Jurisdiction <span class="font-mono">{data.model.jurisdiction}</span></p>
      </div>
      <div class="flex items-center gap-2">
        <AgentTypeBadge type="intelligent" />
        <span class="text-xs text-slate-500">Risk Quantifier</span>
      </div>
    </div>
  </div>

  <!-- KPI strip -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <Kpi label="EU AI Act Class" value={data.model.euAiActClass}>
      <ShieldCheck slot="icon" class="h-4 w-4 text-rose-600" />
    </Kpi>
    <Kpi label="ISO 42001 Status" value={data.model.iso42001Status}>
      <ScrollText slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="Prompts (24h)" value={prompts24h.toLocaleString()}>
      <Activity slot="icon" class="h-4 w-4 text-blue-600" />
    </Kpi>
    <Kpi label="Drift Score" value={driftScore.toString()} hint={driftScore < 0.05 ? 'stable' : driftScore < 0.12 ? 'monitor' : 'investigate'} tone={driftScore < 0.05 ? 'good' : 'bad'}>
      <Sparkles slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
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

    <!-- Overview -->
    {#if tab === 'overview'}
      <div class="space-y-4 p-5 text-sm">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <div class="section-title text-xs">Kind</div>
            <div class="mt-1 font-medium text-slate-800">{data.model.kind}</div>
          </div>
          <div>
            <div class="section-title text-xs">Owner</div>
            <div class="mt-1 font-medium text-slate-800">{ownerFor(data.model)}</div>
          </div>
          <div>
            <div class="section-title text-xs">Jurisdiction</div>
            <div class="mt-1 font-mono font-medium text-slate-800">{data.model.jurisdiction}</div>
          </div>
        </div>
        <div>
          <div class="section-title text-xs">Training Data Summary</div>
          <p class="mt-1 leading-relaxed text-slate-700">{trainingFor(data.model)}</p>
        </div>
        <div class="rounded-lg border-2 border-rose-200 bg-rose-50/40 p-4">
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {tierCls(data.model.riskTier)}">{data.model.riskTier}</span>
            <span class="text-sm font-semibold text-rose-900">Risk Tier Explanation</span>
          </div>
          <p class="mt-2 text-xs leading-relaxed text-rose-900/80">{tierExplain(data.model.riskTier)}</p>
        </div>
      </div>

    <!-- Model Risk -->
    {:else if tab === 'risk'}
      <div class="divide-y divide-slate-100">
        {#each data.risks as r (r.id)}
          <div class="px-5 py-4">
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {riskTypeCls(r.riskType)}">{r.riskType}</span>
                  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {sevCls(r.severity)}">{r.severity}</span>
                </div>
                <p class="mt-2 text-sm text-slate-700"><span class="font-semibold">Mitigation:</span> {r.mitigation}</p>
              </div>
            </div>
          </div>
        {:else}
          <div class="px-4 py-8 text-center text-sm text-slate-500">No model risks recorded.</div>
        {/each}
      </div>

    <!-- Prompts Audit -->
    {:else if tab === 'prompts'}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100 text-sm">
          <thead class="thead">
            <tr>
              <th class="px-4 py-2 text-left">Timestamp</th>
              <th class="px-4 py-2 text-left">Prompt (redacted)</th>
              <th class="px-4 py-2 text-left">Response (redacted)</th>
              <th class="px-4 py-2 text-right">Tokens In</th>
              <th class="px-4 py-2 text-right">Tokens Out</th>
              <th class="px-4 py-2 text-right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {#each data.prompts as p (p.id)}
              <tr class="tr">
                <td class="td font-mono text-[11px]">{fmtTime(p.capturedAt)}</td>
                <td class="td max-w-md truncate text-xs text-slate-600">{p.promptRedacted}</td>
                <td class="td max-w-md truncate text-xs text-slate-600">{p.responseRedacted}</td>
                <td class="td text-right font-mono text-xs">{p.tokensIn}</td>
                <td class="td text-right font-mono text-xs">{p.tokensOut}</td>
                <td class="td text-right font-mono text-xs">${(p.costCents / 100).toFixed(4)}</td>
              </tr>
            {:else}
              <tr><td colspan="6" class="px-4 py-8 text-center text-sm text-slate-500">No prompts captured.</td></tr>
            {/each}
          </tbody>
        </table>
        {#if data.prompts.length > 0}
          <div class="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">
            Showing last {data.prompts.length} prompt{data.prompts.length === 1 ? '' : 's'}. All values cryptographically sealed via evidence ledger.
          </div>
        {/if}
      </div>

    <!-- Drift & Monitoring -->
    {:else if tab === 'monitoring'}
      <div class="grid grid-cols-1 gap-6 p-5 lg:grid-cols-2">
        <div>
          <div class="section-title text-xs">Accuracy (last 30 days)</div>
          <div class="mt-2 rounded-lg border border-slate-200 bg-white p-3">
            <Sparkline data={accuracySeries.map((v) => v * 100)} height={56} stroke="#8b5cf6" fill="rgba(16,185,129,0.12)" />
            <div class="mt-2 flex items-center justify-between text-xs">
              <span class="text-slate-500">latest:</span>
              <span class="font-mono font-semibold text-violet-700">{(accuracySeries.at(-1)! * 100).toFixed(2)}%</span>
            </div>
          </div>
        </div>
        <div>
          <div class="section-title text-xs">Confidence Trend (30 days)</div>
          <div class="mt-2 rounded-lg border border-slate-200 bg-white p-3">
            <LineChart
              labels={DAYS_30}
              series={[{ name: 'Confidence', color: '#8b5cf6', data: confidenceSeries.map((v) => +(v * 100).toFixed(2)), area: true }]}
              height={180}
              unit="%"
            />
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
