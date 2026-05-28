<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Gauge from '$lib/components/Gauge.svelte';
  import FrameworkBadge from '$lib/components/FrameworkBadge.svelte';
  import EvidenceChip from '$lib/components/EvidenceChip.svelte';
  import AgentTypeBadge from '$lib/components/AgentTypeBadge.svelte';
  import ProgressBar from '$lib/components/ProgressBar.svelte';
  import { addToast } from '$lib/stores/toast';
  import { FileBarChart, ShieldCheck, FileLock2, AlertTriangle, Stamp, Download } from 'lucide-svelte';
  import type { Requirement, Control, EvidenceItem } from '$lib/data/types';

  export let data;

  type Tab = 'requirements' | 'controls' | 'evidence' | 'gaps' | 'attestations';
  let tab: Tab = 'requirements';
  const TABS: { id: Tab; label: string; icon: typeof FileBarChart }[] = [
    { id: 'requirements',  label: 'Requirements', icon: FileBarChart },
    { id: 'controls',      label: 'Controls',     icon: ShieldCheck },
    { id: 'evidence',      label: 'Evidence',     icon: FileLock2 },
    { id: 'gaps',          label: 'Gaps',         icon: AlertTriangle },
    { id: 'attestations',  label: 'Attestations', icon: Stamp }
  ];

  // ---------- Status synthesis for requirements (deterministic) ----------
  type ReqStatus = 'pass' | 'warn' | 'fail' | 'na';
  function reqStatus(r: Requirement): ReqStatus {
    const n = r.id.charCodeAt(r.id.length - 1) + r.id.charCodeAt(r.id.length - 2);
    if (n % 9 === 0) return 'fail';
    if (n % 6 === 0) return 'warn';
    if (n % 11 === 0) return 'na';
    return 'pass';
  }
  function reqCoverage(r: Requirement): number {
    const s = reqStatus(r);
    if (s === 'pass') return 95 + (r.id.length % 5);
    if (s === 'warn') return 60 + (r.id.length % 15);
    if (s === 'fail') return 20 + (r.id.length % 25);
    return 0;
  }
  function statusCls(s: ReqStatus): string {
    if (s === 'pass') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    if (s === 'warn') return 'bg-amber-50 text-amber-700 ring-amber-200';
    if (s === 'fail') return 'bg-rose-50 text-rose-700 ring-rose-200';
    return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
  function statusColor(s: ReqStatus): string {
    if (s === 'pass') return 'bg-emerald-500';
    if (s === 'warn') return 'bg-amber-500';
    if (s === 'fail') return 'bg-rose-500';
    return 'bg-slate-300';
  }

  // ---------- Mapped controls (heuristic: 1 in 8 of the tenant catalog) ----------
  $: mappedControls = data.controls.filter((_: Control, i: number) => i % 8 === 0).slice(0, 20);
  function controlCoverage(c: Control): number {
    const n = c.id.charCodeAt(c.id.length - 1);
    return 60 + (n % 40);
  }

  // ---------- Evidence linked to this framework (mock subset) ----------
  $: linkedEvidence = data.evidence.slice(0, 10);

  // ---------- Synthesised gaps (8) ----------
  $: gaps = (() => {
    const GAP_TITLES = [
      'KMS rotation not enforced on prod buckets',
      'Cross-border outsourcing register incomplete',
      'Exit-plan documentation missing for AWS',
      'Privileged access review stale (>120d)',
      'No DPIA on new AI assistant',
      'Backup restore not tested last quarter',
      'Logging gap on internal CRM',
      'Vendor SOC 2 missing for 4 Tier-1 vendors'
    ];
    const SEVS: ('critical' | 'high' | 'medium' | 'low')[] = ['critical','high','high','medium','medium','medium','low','low'];
    return GAP_TITLES.map((t, i) => ({
      id: `gap_${data.framework.id}_${i}`,
      title: t,
      severity: SEVS[i % SEVS.length],
      remediation: 'Owner to ratify remediation plan, execute and seal evidence.',
      targetDate: new Date(Date.now() + (30 + i * 12) * 86_400_000).toISOString().slice(0, 10),
      owner: ['Adi T.', 'Wei L.', 'Mei C.', 'Ravi K.'][i % 4],
      openedByAgent: data.framework.id === 'mas-notice-655' && i < 7
    }));
  })();

  // Hero — make the framework detail meaningful for MAS Notice 655.
  $: isMas655 = data.framework.id === 'mas-notice-655';

  function sevCls(s: string): string {
    if (s === 'critical') return 'bg-rose-100 text-rose-800 ring-rose-200';
    if (s === 'high')     return 'bg-orange-50 text-orange-700 ring-orange-200';
    if (s === 'medium')   return 'bg-amber-50 text-amber-700 ring-amber-200';
    return 'bg-slate-100 text-slate-600 ring-slate-200';
  }

  // ---------- Attestations (3) ----------
  $: attestations = [
    { signedBy: 'Lawrence Khoo (CISO)',   signedAt: '2026-04-18', validUntil: '2027-04-18' },
    { signedBy: 'Mei Chen (DPO)',         signedAt: '2026-02-09', validUntil: '2027-02-09' },
    { signedBy: 'Adi Tan (Head of Risk)', signedAt: '2025-11-22', validUntil: '2026-11-22' }
  ];

  function generatePack() {
    addToast('success', `Audit Companion queued · pack for ${data.framework.name} in ~8 seconds.`);
  }
</script>

<PageHeader
  title={data.framework.name}
  breadcrumbs={[{ label: 'Frameworks', href: '/frameworks' }, { label: data.framework.name }]}
>
  <svelte:fragment slot="actions">
    <FrameworkBadge name={data.framework.name} version={data.framework.version} region={data.framework.region} />
    <button class="btn-primary" on:click={generatePack}>
      <Download class="h-4 w-4" />
      <span>Generate Audit Pack</span>
    </button>
  </svelte:fragment>
</PageHeader>

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
                {@const cov = reqCoverage(r)}
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
        <table class="min-w-full divide-y divide-slate-100 text-sm">
          <thead class="thead">
            <tr>
              <th class="px-4 py-2 text-left">Severity</th>
              <th class="px-4 py-2 text-left">Title</th>
              <th class="px-4 py-2 text-left">Remediation</th>
              <th class="px-4 py-2 text-left">Owner</th>
              <th class="px-4 py-2 text-left">Target Date</th>
              <th class="px-4 py-2 text-left">Origin</th>
            </tr>
          </thead>
          <tbody>
            {#each gaps as g (g.id)}
              <tr class="tr">
                <td class="td">
                  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {sevCls(g.severity)}">{g.severity}</span>
                </td>
                <td class="td">{g.title}</td>
                <td class="td text-xs text-slate-600">{g.remediation}</td>
                <td class="td text-xs text-slate-600">{g.owner}</td>
                <td class="td font-mono text-xs text-slate-500">{g.targetDate}</td>
                <td class="td">
                  {#if g.openedByAgent && isMas655}
                    <div class="flex items-center gap-1.5">
                      <AgentTypeBadge type="intelligent" />
                      <span class="text-[11px] text-slate-500">Reg Horizon</span>
                    </div>
                  {:else}
                    <span class="text-xs text-slate-500">Manual</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

    <!-- Attestations -->
    {:else if tab === 'attestations'}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100 text-sm">
          <thead class="thead">
            <tr>
              <th class="px-4 py-2 text-left">Signed By</th>
              <th class="px-4 py-2 text-left">Signed At</th>
              <th class="px-4 py-2 text-left">Valid Until</th>
              <th class="px-4 py-2 text-right">Download</th>
            </tr>
          </thead>
          <tbody>
            {#each attestations as a}
              <tr class="tr">
                <td class="td">{a.signedBy}</td>
                <td class="td font-mono text-xs text-slate-500">{a.signedAt}</td>
                <td class="td font-mono text-xs text-slate-500">{a.validUntil}</td>
                <td class="td text-right">
                  <button class="btn-ghost p-1" on:click={() => addToast('info', 'Attestation download started.')}>
                    <Download class="h-4 w-4" />
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>
