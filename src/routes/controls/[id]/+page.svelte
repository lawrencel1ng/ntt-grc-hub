<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import StatusDot from '$lib/components/StatusDot.svelte';
  import FrameworkBadge from '$lib/components/FrameworkBadge.svelte';
  import EvidenceChip from '$lib/components/EvidenceChip.svelte';
  import AgentTypeBadge from '$lib/components/AgentTypeBadge.svelte';
  import Sparkline from '$lib/components/Sparkline.svelte';
  import { addToast } from '$lib/stores/toast';
  import { Bot, Play, ShieldCheck, Calendar, Activity, Layers, AlertCircle, FileLock2 } from 'lucide-svelte';
  import type { ControlTestResult, Control } from '$lib/data/types';

  export let data;

  // ---------- Synthesised mappings (heuristic) ----------
  function controlFrameworks(c: Control): string[] {
    const fwIds = ['soc2', 'iso-27001', 'mas-trm', 'pci-dss-4', 'gdpr', 'nist-csf'];
    const seed = c.id.charCodeAt(c.id.length - 1);
    return [fwIds[seed % fwIds.length], fwIds[(seed + 3) % fwIds.length]];
  }
  $: mappings = controlFrameworks(data.control).map((fid, i) => {
    const fw = data.frameworks.find((f) => f.id === fid);
    const seed = data.control.id.charCodeAt(data.control.id.length - 1 - i);
    return {
      framework: fw,
      requirementCode: fw ? `${fw.id.toUpperCase()}-${String((seed % 60) + 1).padStart(3, '0')}` : '—',
      coverage: 60 + (seed % 40)
    };
  }).filter((m) => m.framework);

  // ---------- Synthesised tests (3) ----------
  $: tests = [
    { id: `tst_${data.control.id}_1`, name: `${data.control.title} — automated check`, kind: data.control.automated ? 'automated' : 'manual', schedule: data.control.frequency, lastResult: data.runs[0]?.result ?? 'pass' as ControlTestResult },
    { id: `tst_${data.control.id}_2`, name: `${data.control.title} — quarterly attestation`, kind: 'manual', schedule: 'quarterly', lastResult: 'pass' as ControlTestResult }
  ];

  // ---------- Sparkline of last 30 runs ----------
  $: sparkData = (() => {
    const arr = [...data.runs].reverse().slice(-30);
    return arr.map((r) => r.result === 'pass' ? 100 : r.result === 'partial' ? 60 : r.result === 'na' ? 50 : 10);
  })();

  // ---------- Pagination of runs ----------
  let visible = 20;
  $: visibleRuns = data.runs.slice(0, visible);

  // ---------- Synthesised exceptions ----------
  $: exceptions = data.control.title.toLowerCase().includes('encrypt')
    ? [{ id: 'exc_1', title: 'Legacy archive bucket grandfathered until 2026-09-30', approvedBy: 'CISO', expiresAt: '2026-09-30' }]
    : [];

  function fmtRel(iso?: string): string {
    if (!iso) return '—';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60)   return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  function runTest() {
    addToast('success', `Test queued for ${data.control.code}`);
  }
</script>

<PageHeader
  title={data.control.code}
  breadcrumbs={[{ label: 'Controls', href: '/controls' }, { label: data.control.code }]}
>
  <svelte:fragment slot="actions">
    {#if data.control.automated}
      <span class="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 ring-1 ring-inset ring-violet-200">
        <Bot class="h-3 w-3" />
        Automated
      </span>
    {/if}
    <button class="btn-primary" on:click={runTest}>
      <Play class="h-4 w-4" />
      <span>Run Test</span>
    </button>
  </svelte:fragment>
</PageHeader>

<div class="space-y-6">
  <!-- Header -->
  <div class="card p-5">
    <div class="flex items-start gap-3">
      <div class="rounded-lg bg-violet-50 p-2 text-violet-700"><ShieldCheck class="h-5 w-5" /></div>
      <div class="flex-1">
        <h2 class="text-lg font-semibold text-grc-ink">{data.control.title}</h2>
        <p class="mt-1 text-sm text-slate-600">{data.control.description}</p>
        <div class="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span class="tag tag-slate">{data.control.type}</span>
          <span class="flex items-center gap-1"><Calendar class="h-3 w-3" /> {data.control.frequency}</span>
          <span class="flex items-center gap-1"><Layers class="h-3 w-3" /> {data.control.family.join(' / ')}</span>
          <span class="flex items-center gap-1"><Activity class="h-3 w-3" /> maturity: <span class="font-medium text-slate-700">{data.control.maturity}</span></span>
        </div>
      </div>
    </div>
  </div>

  <!-- Mappings -->
  <div class="card overflow-hidden">
    <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
      <h2 class="section-title">Mappings</h2>
      <span class="text-xs text-slate-400">{mappings.length} frameworks</span>
    </div>
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-100 text-sm">
        <thead class="thead">
          <tr>
            <th class="px-4 py-2 text-left">Framework</th>
            <th class="px-4 py-2 text-left">Requirement</th>
            <th class="px-4 py-2 text-left">Coverage</th>
          </tr>
        </thead>
        <tbody>
          {#each mappings as m}
            <tr class="tr">
              <td class="td">
                <a href="/frameworks/{m.framework?.id}">
                  <FrameworkBadge name={m.framework!.name} region={m.framework!.region} />
                </a>
              </td>
              <td class="td font-mono text-xs text-slate-600">{m.requirementCode}</td>
              <td class="td">
                <div class="flex items-center gap-2">
                  <div class="h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
                    <div class="h-full rounded-full bg-violet-500" style="width:{m.coverage}%"></div>
                  </div>
                  <span class="font-mono text-xs text-slate-500">{m.coverage}%</span>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Tests -->
  <div class="card overflow-hidden">
    <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
      <h2 class="section-title">Tests</h2>
      <span class="text-xs text-slate-400">{tests.length} test{tests.length === 1 ? '' : 's'} · 30d trend</span>
    </div>
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-100 text-sm">
        <thead class="thead">
          <tr>
            <th class="px-4 py-2 text-left">Name</th>
            <th class="px-4 py-2 text-left">Kind</th>
            <th class="px-4 py-2 text-left">Schedule</th>
            <th class="px-4 py-2 text-left">Last Result</th>
            <th class="px-4 py-2 text-left">Trend (30d)</th>
          </tr>
        </thead>
        <tbody>
          {#each tests as t}
            <tr class="tr">
              <td class="td">{t.name}</td>
              <td class="td"><span class="tag tag-slate">{t.kind}</span></td>
              <td class="td text-xs text-slate-500">{t.schedule}</td>
              <td class="td"><StatusDot status={t.lastResult} withLabel /></td>
              <td class="td w-40"><Sparkline data={sparkData} /></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Recent test runs -->
  <div class="card overflow-hidden">
    <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
      <h2 class="section-title">Recent Test Runs</h2>
      <span class="text-xs text-slate-400">{data.runs.length} total</span>
    </div>
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-100 text-sm">
        <thead class="thead">
          <tr>
            <th class="px-4 py-2 text-left">Timestamp</th>
            <th class="px-4 py-2 text-left">Result</th>
            <th class="px-4 py-2 text-left">Evidence</th>
            <th class="px-4 py-2 text-left">Attribution</th>
            <th class="px-4 py-2 text-right">Duration</th>
          </tr>
        </thead>
        <tbody>
          {#each visibleRuns as r (r.id)}
            <tr class="tr">
              <td class="td font-mono text-xs text-slate-500">{r.ranAt.replace('T', ' ').slice(0, 19)}</td>
              <td class="td"><StatusDot status={r.result} withLabel /></td>
              <td class="td">
                {#if r.evidenceItemId}
                  <EvidenceChip hash={`evd${r.evidenceItemId}`} />
                {:else}
                  <span class="text-xs text-slate-400">—</span>
                {/if}
              </td>
              <td class="td">
                {#if r.agentRunId}
                  <div class="flex items-center gap-1.5">
                    <AgentTypeBadge type="ai-powered" />
                    <span class="text-[11px] text-slate-500">Control Tester</span>
                  </div>
                {:else}
                  <span class="text-xs text-slate-500">manual</span>
                {/if}
              </td>
              <td class="td text-right font-mono text-xs">{r.durationMs ? `${r.durationMs}ms` : '—'}</td>
            </tr>
          {:else}
            <tr><td colspan="5" class="px-4 py-6 text-center text-sm text-slate-500">No test runs yet.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if data.runs.length > visible}
      <div class="flex justify-center border-t border-slate-100 px-4 py-2">
        <button class="btn-ghost py-1 text-xs" on:click={() => (visible += 20)}>Load 20 more</button>
      </div>
    {/if}
  </div>

  <!-- Linked evidence -->
  <div class="card p-5">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="section-title">Linked Evidence</h2>
      <span class="text-xs text-slate-400">{data.evidence.length} items · most recent {fmtRel(data.evidence[0]?.capturedAt)}</span>
    </div>
    {#if data.evidence.length === 0}
      <div class="text-sm text-slate-500">No evidence linked yet.</div>
    {:else}
      <div class="flex flex-wrap gap-2">
        {#each data.evidence as e (e.id)}
          <EvidenceChip hash={e.rowHash ?? ''} filename={e.title} />
        {/each}
      </div>
    {/if}
  </div>

  <!-- Exceptions -->
  {#if exceptions.length > 0}
    <div class="card p-5">
      <h2 class="section-title mb-3 flex items-center gap-2"><AlertCircle class="h-4 w-4 text-amber-600" /> Exceptions</h2>
      <ul class="space-y-2 text-sm">
        {#each exceptions as exc}
          <li class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <div class="font-medium text-amber-900">{exc.title}</div>
            <div class="mt-1 text-xs text-amber-700">Approved by {exc.approvedBy} · expires {exc.expiresAt}</div>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>
