<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Gauge from '$lib/components/Gauge.svelte';
  import FrameworkBadge from '$lib/components/FrameworkBadge.svelte';
  import EvidenceChip from '$lib/components/EvidenceChip.svelte';
  import AgentTypeBadge from '$lib/components/AgentTypeBadge.svelte';
  import ProgressBar from '$lib/components/ProgressBar.svelte';
  import { addToast } from '$lib/stores/toast';
  import { downloadCsv } from '$lib/utils/csv';
  import { FileBarChart, ShieldCheck, FileLock2, AlertTriangle, Stamp, Download, X, Loader2, Plus } from 'lucide-svelte';
  import { enhance } from '$app/forms';
  import type { Requirement, Control, EvidenceItem, RequirementCoverage, ComplianceGap, ComplianceAttestation } from '$lib/data/types';

  export let data;
  export let form: { attested?: boolean; attestError?: string; gapUpdated?: boolean; gapId?: string; gapError?: string } | null = null;

  let showAttestForm = false;
  let editingGapId: string | null = null;
  $: if (form?.attested) { addToast('success', 'Attestation signed and recorded.'); showAttestForm = false; }
  $: if (form?.attestError) addToast('error', form.attestError);
  $: if (form?.gapUpdated) { addToast('success', 'Compliance gap updated.'); editingGapId = null; }
  $: if (form?.gapError) addToast('error', form.gapError);

  type Tab = 'requirements' | 'controls' | 'evidence' | 'gaps' | 'attestations';
  let tab: Tab = 'requirements';
  const TABS: { id: Tab; label: string; icon: typeof FileBarChart }[] = [
    { id: 'requirements',  label: 'Requirements', icon: FileBarChart },
    { id: 'controls',      label: 'Controls',     icon: ShieldCheck },
    { id: 'evidence',      label: 'Evidence',     icon: FileLock2 },
    { id: 'gaps',          label: 'Gaps',         icon: AlertTriangle },
    { id: 'attestations',  label: 'Attestations', icon: Stamp }
  ];

  // ---------- Requirement coverage from real control.mappings ----------
  type ReqStatus = 'pass' | 'warn' | 'fail' | 'na';
  $: coverageMap = new Map((data.coverage as RequirementCoverage[]).map((c) => [c.requirementId, c]));

  function reqCoverageFor(r: Requirement): number {
    return coverageMap.get(r.id)?.coveragePct ?? 0;
  }
  function reqStatus(r: Requirement): ReqStatus {
    const cov = reqCoverageFor(r);
    if (cov === 0) return 'na';
    if (cov >= 85) return 'pass';
    if (cov >= 50) return 'warn';
    return 'fail';
  }
  function statusCls(s: ReqStatus): string {
    if (s === 'pass') return 'bg-violet-50 text-violet-700 ring-violet-200';
    if (s === 'warn') return 'bg-amber-50 text-amber-700 ring-amber-200';
    if (s === 'fail') return 'bg-rose-50 text-rose-700 ring-rose-200';
    return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
  function statusColor(s: ReqStatus): string {
    if (s === 'pass') return 'bg-violet-500';
    if (s === 'warn') return 'bg-amber-500';
    if (s === 'fail') return 'bg-rose-500';
    return 'bg-slate-300';
  }

  // ---------- Mapped controls from real control.mappings ----------
  $: mappedControls = data.mappedControls as Control[];
  function controlCoverage(c: Control): number {
    const cov = coverageMap.get(c.id);
    return cov?.coveragePct ?? 80;
  }

  // ---------- Evidence linked to this framework ----------
  $: linkedEvidence = data.evidence.slice(0, 10);

  // ---------- Real compliance gaps from DB ----------
  $: gaps = data.gaps as ComplianceGap[];

  function sevCls(s: string): string {
    if (s === 'critical') return 'bg-rose-100 text-rose-800 ring-rose-200';
    if (s === 'high')     return 'bg-orange-50 text-orange-700 ring-orange-200';
    if (s === 'medium')   return 'bg-amber-50 text-amber-700 ring-amber-200';
    return 'bg-slate-100 text-slate-600 ring-slate-200';
  }

  // ---------- Real attestations from DB ----------
  $: attestations = data.attestations as ComplianceAttestation[];

  let packSummary: string | null = null;
  let packGenerating = false;

  async function generatePack() {
    if (packGenerating) return;
    packGenerating = true;
    packSummary = null;
    try {
      const res = await fetch(`/api/frameworks/${data.framework.id}/generate-pack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        packSummary = body.summary ?? null;
        addToast('success', `Evidence pack generated for ${data.framework.name}.`);
      } else {
        const msg = await res.text().catch(() => '');
        addToast('error', msg || 'Failed to generate evidence pack.');
      }
    } catch {
      addToast('error', 'Network error — check your connection and try again.');
    } finally {
      packGenerating = false;
    }
  }

  function downloadPackAsTxt() {
    if (!packSummary) return;
    const blob = new Blob([packSummary], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-pack-${data.framework.id}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadAttestation(a: ComplianceAttestation) {
    const content = [
      `Framework: ${data.framework.name} ${data.framework.version}`,
      `Signed at: ${a.signedAt?.slice(0, 10) ?? '—'}`,
      `Valid until: ${a.validUntil?.slice(0, 10) ?? '—'}`,
      '',
      a.attestationText
    ].join('\n');
    downloadCsv(`attestation-${data.framework.id}-${a.signedAt?.slice(0, 10) ?? 'unknown'}.txt`, content);
  }
</script>

<PageHeader
  title={data.framework.name}
  breadcrumbs={[{ label: 'Frameworks', href: '/frameworks' }, { label: data.framework.name }]}
>
  <svelte:fragment slot="actions">
    <FrameworkBadge name={data.framework.name} version={data.framework.version} region={data.framework.region} />
    <button class="btn-primary" on:click={generatePack} disabled={packGenerating}>
      {#if packGenerating}
        <Loader2 class="h-4 w-4 animate-spin" />
        <span>Generating…</span>
      {:else}
        <Download class="h-4 w-4" />
        <span>Generate Audit Pack</span>
      {/if}
    </button>
  </svelte:fragment>
</PageHeader>

{#if packSummary}
  <div class="card border-l-4 border-violet-400 p-5">
    <div class="flex items-center justify-between">
      <h2 class="section-title text-sm">Generated Compliance Pack</h2>
      <div class="flex items-center gap-2">
        <button class="btn-secondary py-1 text-xs" on:click={downloadPackAsTxt}>
          <Download class="h-3 w-3" /> Download .txt
        </button>
        <button class="text-slate-400 hover:text-slate-600" on:click={() => (packSummary = null)} aria-label="Dismiss">
          <X class="h-4 w-4" />
        </button>
      </div>
    </div>
    <div class="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 px-4 py-3 font-mono text-xs leading-relaxed text-slate-700 ring-1 ring-inset ring-slate-200">
      {packSummary}
    </div>
  </div>
{/if}

<div class="space-y-6">
  <!-- Header card with metadata + gauge -->
  <div class="card flex flex-col gap-6 p-6 md:flex-row md:items-center">
    <div class="flex-1 space-y-3">
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div class="section-title text-xs">Regulator</div>
          <div class="mt-1 font-medium text-slate-800">{data.framework.regulator}</div>
        </div>
        <div>
          <div class="section-title text-xs">Region</div>
          <div class="mt-1 font-medium text-slate-800">{data.framework.region}</div>
        </div>
        <div>
          <div class="section-title text-xs">Jurisdiction</div>
          <div class="mt-1 font-medium text-slate-800">{data.framework.jurisdiction}</div>
        </div>
        <div>
          <div class="section-title text-xs">Requirements</div>
          <div class="mt-1 font-mono text-slate-800">{data.framework.totalRequirements}</div>
        </div>
      </div>
      <div class="flex flex-wrap gap-1.5">
        {#each data.framework.tags as t}
          <span class="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">#{t}</span>
        {/each}
      </div>
    </div>
    <div class="md:w-72">
      <Gauge value={data.score?.score ?? 0} label="Compliance score" suffix="%" />
    </div>
  </div>

  <!-- Tabs nav -->
  <div class="card overflow-hidden">
    <div class="flex flex-wrap border-b border-slate-100 px-2">
      {#each TABS as t}
        {@const Icon = t.icon}
        <button
          type="button"
          class="-mb-px flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors {tab === t.id
            ? 'border-grc-primary text-grc-primary'
            : 'border-transparent text-slate-500 hover:text-slate-700'}"
          on:click={() => (tab = t.id)}
        >
          <Icon class="h-4 w-4" />
          {t.label}
        </button>
      {/each}
    </div>

    <!-- Requirements -->
    {#if tab === 'requirements'}
      <div class="overflow-x-auto">
        {#if data.requirements.length === 0}
          <div class="p-8 text-center text-sm text-slate-500">No requirements loaded for this framework. (Top 8 frameworks have requirement detail.)</div>
        {:else}
          <table class="min-w-full divide-y divide-slate-100 text-sm">
            <thead class="thead">
              <tr>
                <th class="px-4 py-2 text-left">Code</th>
                <th class="px-4 py-2 text-left">Title</th>
                <th class="px-4 py-2 text-left">Status</th>
                <th class="px-4 py-2 text-left">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {#each data.requirements as r (r.id)}
                {@const s = reqStatus(r)}
                {@const cov = reqCoverageFor(r)}
                <tr class="tr">
                  <td class="td font-mono text-xs text-slate-500">{r.code}</td>
                  <td class="td">{r.title}</td>
                  <td class="td">
                    <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {statusCls(s)}">{s}</span>
                  </td>
                  <td class="td">
                    <div class="flex items-center gap-2">
                      <div class="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                        <div class="h-full rounded-full {statusColor(s)}" style="width:{cov}%"></div>
                      </div>
                      <span class="font-mono text-xs text-slate-500">{cov}%</span>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>

    <!-- Controls -->
    {:else if tab === 'controls'}
      <div class="overflow-x-auto">
        {#if mappedControls.length === 0}
          <div class="p-8 text-center text-sm text-slate-500">No controls mapped under the active tenant.</div>
        {:else}
          <table class="min-w-full divide-y divide-slate-100 text-sm">
            <thead class="thead">
              <tr>
                <th class="px-4 py-2 text-left">Code</th>
                <th class="px-4 py-2 text-left">Title</th>
                <th class="px-4 py-2 text-left">Type</th>
                <th class="px-4 py-2 text-left">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {#each mappedControls as c (c.id)}
                {@const cov = controlCoverage(c)}
                <tr class="tr">
                  <td class="td font-mono text-xs text-slate-500">
                    <a href="/controls/{c.id}" class="text-grc-primary hover:underline">{c.code}</a>
                  </td>
                  <td class="td">{c.title}</td>
                  <td class="td"><span class="tag tag-slate">{c.type}</span></td>
                  <td class="td">
                    <div class="flex items-center gap-2">
                      <ProgressBar value={cov} />
                      <span class="font-mono text-xs text-slate-500 w-10 text-right">{cov}%</span>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>

    <!-- Evidence -->
    {:else if tab === 'evidence'}
      <div class="p-5">
        {#if linkedEvidence.length === 0}
          <div class="text-sm text-slate-500">No evidence items linked under the active tenant.</div>
        {:else}
          <div class="space-y-2">
            {#each linkedEvidence as e (e.id)}
              <div class="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50">
                <div class="min-w-0 flex-1">
                  <div class="truncate text-sm font-medium text-slate-800">{e.title}</div>
                  <div class="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                    <FrameworkBadge name={data.framework.name} region={data.framework.region} />
                    <span>·</span>
                    <span>{e.kind}</span>
                    <span>·</span>
                    <span>{e.capturedAt.slice(0, 19).replace('T', ' ')}</span>
                  </div>
                </div>
                <EvidenceChip hash={e.rowHash ?? ''} />
              </div>
            {/each}
          </div>
        {/if}
      </div>

    <!-- Gaps -->
    {:else if tab === 'gaps'}
      <div class="overflow-x-auto">
        {#if gaps.length === 0}
          <div class="p-8 text-center text-sm text-slate-500">No compliance gaps recorded for this framework.</div>
        {:else}
          <table class="min-w-full divide-y divide-slate-100 text-sm">
            <thead class="thead">
              <tr>
                <th class="px-4 py-2 text-left">Severity</th>
                <th class="px-4 py-2 text-left">Requirement</th>
                <th class="px-4 py-2 text-left">Remediation</th>
                <th class="px-4 py-2 text-left">Target Date</th>
                <th class="w-8 px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {#each gaps as g (g.id)}
                <tr class="tr">
                  <td class="td">
                    <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {sevCls(g.severity)}">{g.severity}</span>
                  </td>
                  <td class="td">
                    <div class="font-mono text-xs text-slate-500">{g.requirementCode}</div>
                    <div class="text-xs text-slate-700">{g.requirementTitle}</div>
                  </td>
                  <td class="td text-xs text-slate-600">
                    {#if editingGapId === g.id}
                      <textarea name="remediationPlan" form="gap-form-{g.id}"
                        class="input h-16 w-full resize-none text-xs"
                        placeholder="Describe remediation steps…"
                        maxlength="4096">{g.remediationPlan ?? ''}</textarea>
                    {:else}
                      {g.remediationPlan ?? '—'}
                    {/if}
                  </td>
                  <td class="td font-mono text-xs text-slate-500">
                    {#if editingGapId === g.id}
                      <input name="targetDate" form="gap-form-{g.id}" type="date"
                        class="input text-xs" value={g.targetDate?.slice(0, 10) ?? ''} />
                    {:else}
                      {g.targetDate?.slice(0, 10) ?? '—'}
                    {/if}
                  </td>
                  <td class="td">
                    {#if editingGapId === g.id}
                      <form id="gap-form-{g.id}" method="POST" action="?/updateGap" use:enhance
                        class="flex flex-col gap-1">
                        <input type="hidden" name="gapId" value={g.id} />
                        <button type="submit" class="btn-primary py-0.5 text-[11px]">Save</button>
                        <button type="button" class="btn-ghost py-0.5 text-[11px]"
                          on:click={() => (editingGapId = null)}>Cancel</button>
                      </form>
                    {:else}
                      <button type="button" class="text-slate-400 hover:text-grc-primary"
                        title="Edit remediation" on:click={() => (editingGapId = g.id)}>
                        <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>

    <!-- Attestations -->
    {:else if tab === 'attestations'}
      <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <span class="text-xs text-slate-500">{attestations.length} attestation{attestations.length !== 1 ? 's' : ''}</span>
        <button class="btn-ghost text-xs" on:click={() => (showAttestForm = !showAttestForm)}>
          <Plus class="h-3.5 w-3.5" />
          Sign attestation
        </button>
      </div>
      {#if showAttestForm}
        <div class="border-b border-slate-100 bg-slate-50 px-5 py-4">
          <form method="POST" action="?/signAttestation" use:enhance class="space-y-3">
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-700">Attestation statement</span>
              <textarea name="attestationText" rows="3" class="input resize-none" required maxlength="4096"
                placeholder="I attest that all {data.framework.name} controls have been reviewed and are operating effectively as of {new Date().toISOString().slice(0, 10)}."></textarea>
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-700">Valid until (optional)</span>
              <input name="validUntil" type="date" class="input w-48" />
            </label>
            <div class="flex gap-2">
              <button type="submit" class="btn-primary">Sign & record</button>
              <button type="button" class="btn-secondary" on:click={() => (showAttestForm = false)}>Cancel</button>
            </div>
          </form>
        </div>
      {/if}
      <div class="overflow-x-auto">
        {#if attestations.length === 0}
          <div class="p-8 text-center text-sm text-slate-500">No attestations on record for this framework.</div>
        {:else}
          <table class="min-w-full divide-y divide-slate-100 text-sm">
            <thead class="thead">
              <tr>
                <th class="px-4 py-2 text-left">Attestation</th>
                <th class="px-4 py-2 text-left">Signed At</th>
                <th class="px-4 py-2 text-left">Valid Until</th>
                <th class="px-4 py-2 text-right">Download</th>
              </tr>
            </thead>
            <tbody>
              {#each attestations as a (a.id)}
                <tr class="tr">
                  <td class="td text-xs text-slate-700">{a.attestationText}</td>
                  <td class="td font-mono text-xs text-slate-500">{a.signedAt?.slice(0, 10) ?? '—'}</td>
                  <td class="td font-mono text-xs text-slate-500">{a.validUntil?.slice(0, 10) ?? '—'}</td>
                  <td class="td text-right">
                    <button class="btn-ghost p-1" on:click={() => downloadAttestation(a)}>
                      <Download class="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    {/if}
  </div>
</div>
