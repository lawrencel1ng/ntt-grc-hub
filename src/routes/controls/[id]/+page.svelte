<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import StatusDot from '$lib/components/StatusDot.svelte';
  import FrameworkBadge from '$lib/components/FrameworkBadge.svelte';
  import EvidenceChip from '$lib/components/EvidenceChip.svelte';
  import AgentTypeBadge from '$lib/components/AgentTypeBadge.svelte';
  import Sparkline from '$lib/components/Sparkline.svelte';
  import { addToast } from '$lib/stores/toast';
  import { Bot, Play, ShieldCheck, Calendar, Activity, Layers, AlertCircle, FileLock2, Pencil } from 'lucide-svelte';
  import type { ControlTestResult, ControlMapping, ControlTest, ControlException } from '$lib/data/types';
  import { enhance } from '$app/forms';

  export let data;
  export let form: { editSuccess?: boolean; editError?: string } | null = null;

  $: if (form?.editSuccess) { addToast('success', 'Control updated.'); showEditForm = false; }
  $: if (form?.editError) addToast('error', form.editError);

  let showEditForm = false;

  // ---------- Real mappings from control.mappings ----------
  $: mappings = (data.mappings as ControlMapping[]).map((m) => ({
    mapping: m,
    framework: data.frameworks.find((f) => f.id === m.frameworkId),
    requirementCode: m.requirementId ?? `${m.frameworkId.toUpperCase()}-???`,
    coverage: m.coveragePct
  })).filter((m) => m.framework);

  // ---------- Real tests from control.tests ----------
  $: tests = data.tests as ControlTest[];

  // ---------- Sparkline of last 30 runs ----------
  $: sparkData = (() => {
    const arr = [...data.runs].reverse().slice(-30);
    return arr.map((r) => r.result === 'pass' ? 100 : r.result === 'partial' ? 60 : r.result === 'na' ? 50 : 10);
  })();

  // ---------- Pagination of runs ----------
  let visible = 20;
  $: visibleRuns = data.runs.slice(0, visible);

  // ---------- Real exceptions from control.exceptions ----------
  $: exceptions = data.exceptions as ControlException[];

  function fmtRel(iso?: string): string {
    if (!iso) return '—';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60)   return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  async function runTest() {
    try {
      const res = await fetch(`/api/controls/${data.control.id}/run-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        addToast('success', `Test queued for ${data.control.code}.`);
      } else {
        const msg = await res.text().catch(() => '');
        addToast('error', msg || 'Failed to queue control test.');
      }
    } catch {
      addToast('error', 'Network error — check your connection and try again.');
    }
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
    <button class="btn-secondary" on:click={() => (showEditForm = !showEditForm)}>
      <Pencil class="h-4 w-4" />
      <span>Edit</span>
    </button>
    <button class="btn-primary" on:click={runTest}>
      <Play class="h-4 w-4" />
      <span>Run Test</span>
    </button>
  </svelte:fragment>
</PageHeader>

{#if showEditForm}
  <div class="card p-5">
    <h3 class="mb-4 text-sm font-semibold text-grc-ink">Edit Control</h3>
    <form method="POST" action="?/updateControl" use:enhance class="space-y-4">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label class="block sm:col-span-2">
          <span class="mb-1 block text-xs font-medium text-slate-700">Title</span>
          <input name="title" class="input" value={data.control.title} required maxlength="256" />
        </label>
        <label class="block sm:col-span-2">
          <span class="mb-1 block text-xs font-medium text-slate-700">Description</span>
          <textarea name="description" class="input h-20 resize-none" maxlength="2048">{data.control.description ?? ''}</textarea>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700">Type</span>
          <select name="type" class="input" value={data.control.type}>
            <option value="technical">Technical</option>
            <option value="process">Process</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700">Maturity</span>
          <select name="maturity" class="input" value={data.control.maturity}>
            <option value="initial">Initial</option>
            <option value="developing">Developing</option>
            <option value="defined">Defined</option>
            <option value="managed">Managed</option>
            <option value="optimised">Optimised</option>
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700">Frequency</span>
          <input name="frequency" class="input" value={data.control.frequency} maxlength="64" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700">Automated</span>
          <select name="automated" class="input" value={data.control.automated ? 'true' : 'false'}>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
      </div>
      <div class="flex gap-2">
        <button type="submit" class="btn-primary">Save changes</button>
        <button type="button" class="btn-secondary" on:click={() => (showEditForm = false)}>Cancel</button>
      </div>
    </form>
  </div>
{/if}

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
            {@const lastRun = data.runs.find((r) => r.testId === t.id)}
            <tr class="tr">
              <td class="td">{t.name}</td>
              <td class="td"><span class="tag tag-slate">{t.kind}</span></td>
              <td class="td text-xs text-slate-500">{t.scheduleCron ?? '—'}</td>
              <td class="td">{#if lastRun}<StatusDot status={lastRun.result} withLabel />{:else}<span class="text-xs text-slate-400">no runs</span>{/if}</td>
              <td class="td w-40"><Sparkline data={sparkData} /></td>
            </tr>
          {:else}
            <tr><td colspan="5" class="px-4 py-6 text-center text-sm text-slate-500">No test definitions on record.</td></tr>
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
            <div class="font-medium text-amber-900">{exc.justification}</div>
            <div class="mt-1 text-xs text-amber-700">{exc.granted ? 'Granted' : 'Pending'} · expires {exc.expiresAt ? exc.expiresAt.slice(0, 10) : 'no expiry'}</div>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>
