<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import FrameworkBadge from '$lib/components/FrameworkBadge.svelte';
  import AgentTypeBadge from '$lib/components/AgentTypeBadge.svelte';
  import { enhance } from '$app/forms';
  import { addToast } from '$lib/stores/toast';
  import { FileText, History, UserCheck, AlertCircle, Library, Edit, ScrollText } from 'lucide-svelte';
  import type { PolicyVersion, PolicyVersionStatus } from '$lib/data/types';

  export let data;
  export let form;
  $: if (form?.editSuccess) { addToast('success', 'Policy saved.'); editing = false; }
  $: if (form?.editError) addToast('error', form.editError);
  let editing = false;
  let editContent = '';
  let editStatus = 'draft';

  type Tab = 'current' | 'history' | 'acks' | 'exceptions' | 'mappings';
  let tab: Tab = 'current';
  const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
    { id: 'current',    label: 'Current Version', icon: FileText },
    { id: 'history',    label: 'Version History', icon: History },
    { id: 'acks',       label: 'Acknowledgements', icon: UserCheck },
    { id: 'exceptions', label: 'Exceptions',      icon: AlertCircle },
    { id: 'mappings',   label: 'Mappings',        icon: Library }
  ];

  $: current = data.versions.find((v) => v.status === 'approved') ?? data.versions[data.versions.length - 1];

  // ---------- Naive markdown renderer ----------
  // Splits the content on blank lines; lines starting with `# ` are h1,
  // `## ` are h2, otherwise paragraphs. No external libraries per the
  // task instructions.
  function renderBlocks(md: string): { kind: 'h1' | 'h2' | 'p'; text: string }[] {
    if (!md) return [];
    const blocks = md.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
    return blocks.map((b) => {
      if (b.startsWith('## ')) return { kind: 'h2' as const, text: b.slice(3) };
      if (b.startsWith('# '))  return { kind: 'h1' as const, text: b.slice(2) };
      return { kind: 'p' as const, text: b };
    });
  }
  $: blocks = current ? renderBlocks(current.contentMd) : [];

  function statusCls(s?: PolicyVersionStatus): string {
    if (s === 'approved')  return 'bg-violet-50 text-violet-700 ring-violet-200';
    if (s === 'in-review') return 'bg-amber-50 text-amber-700 ring-amber-200';
    if (s === 'draft')     return 'bg-blue-50 text-blue-700 ring-blue-200';
    if (s === 'retired')   return 'bg-slate-100 text-slate-600 ring-slate-200';
    return 'bg-slate-100 text-slate-700 ring-slate-200';
  }

  function fmtDate(iso?: string): string { return iso ? iso.slice(0, 10) : '—'; }

  import type { PolicyAck, PolicyException } from '$lib/data/types';
  $: acks = data.acks as PolicyAck[];
  $: exceptions = data.exceptions as PolicyException[];

  // ---------- Mapped frameworks ----------
  $: mappedFrameworks = (() => {
    const t = data.policy.title.toLowerCase();
    const ids: string[] = [];
    if (t.includes('security') || t.includes('access') || t.includes('cryptography')) ids.push('iso-27001', 'soc2');
    if (t.includes('outsourcing')) ids.push('mas-notice-655', 'mas-trm');
    if (t.includes('privacy')) ids.push('gdpr', 'pdpa-sg');
    if (t.includes('ai')) ids.push('eu-ai-act', 'iso-42001');
    if (t.includes('continuity') || t.includes('backup')) ids.push('iso-22301');
    if (t.includes('esg')) ids.push('csrd', 'issb-s1-s2');
    if (ids.length === 0) ids.push('iso-27001');
    return [...new Set(ids)].map((id) => data.frameworks.find((f) => f.id === id)).filter(Boolean);
  })();

  function startEdit() {
    editContent = current?.contentMd ?? '';
    editStatus = current?.status ?? 'draft';
    editing = true;
  }
</script>

<PageHeader
  title={data.policy.title}
  breadcrumbs={[{ label: 'Policies', href: '/policies' }, { label: data.policy.title }]}
>
  <svelte:fragment slot="actions">
    <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {statusCls(current?.status)}">{current?.status ?? 'draft'}</span>
    <button class="btn-primary" on:click={startEdit}>
      <Edit class="h-4 w-4" />
      <span>Edit</span>
    </button>
  </svelte:fragment>
</PageHeader>

<div class="space-y-6">
  <!-- Header card -->
  <div class="card p-5">
    <div class="flex items-start gap-3">
      <div class="rounded-lg bg-violet-50 p-2 text-violet-700"><ScrollText class="h-5 w-5" /></div>
      <div class="grid flex-1 grid-cols-1 gap-4 text-sm md:grid-cols-3">
        <div>
          <div class="section-title text-xs">Code</div>
          <div class="mt-1 font-mono text-slate-800">{data.policy.code}</div>
        </div>
        <div>
          <div class="section-title text-xs">Jurisdiction</div>
          <div class="mt-1 text-slate-800">{data.policy.jurisdiction}</div>
        </div>
        <div>
          <div class="section-title text-xs">Owner</div>
          <div class="mt-1 text-slate-800">Policy Office</div>
        </div>
      </div>
    </div>
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

    <!-- Current Version -->
    {#if tab === 'current'}
      {#if editing}
        <form method="POST" action="?/updatePolicy" use:enhance class="space-y-4 p-5">
          <input type="hidden" name="versionId" value={current?.id ?? ''} />
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-700">Status</label>
            <select name="status" class="input w-40" bind:value={editStatus}>
              <option value="draft">Draft</option>
              <option value="in-review">In Review</option>
              <option value="approved">Approved</option>
              <option value="retired">Retired</option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-700">Content (Markdown)</label>
            <textarea
              name="contentMd"
              class="input min-h-[320px] w-full font-mono text-xs"
              bind:value={editContent}
            ></textarea>
          </div>
          <div class="flex gap-2">
            <button type="submit" class="btn-primary">Save</button>
            <button type="button" class="btn-secondary" on:click={() => (editing = false)}>Cancel</button>
          </div>
        </form>
      {:else}
        <div class="space-y-4 p-5">
          {#if current?.draftedByAgentId}
            <div class="flex items-start gap-3 rounded-xl border-2 border-violet-200 bg-violet-50 px-4 py-3">
              <AgentTypeBadge type="intelligent" />
              <div class="flex-1 text-sm">
                <div class="font-semibold text-violet-900">Drafted by Policy Drafter agent</div>
                <div class="mt-0.5 text-xs text-violet-700">Generated from current framework baseline; HITL approved.</div>
              </div>
            </div>
          {/if}
          <article class="prose prose-slate max-w-none">
            {#each blocks as b}
              {#if b.kind === 'h1'}
                <h1 class="mt-4 text-2xl font-bold text-grc-ink">{b.text}</h1>
              {:else if b.kind === 'h2'}
                <h2 class="mt-4 text-lg font-semibold text-grc-ink">{b.text}</h2>
              {:else}
                <p class="mt-2 text-sm leading-relaxed text-slate-700">{b.text}</p>
              {/if}
            {/each}
          </article>
        </div>
      {/if}

    <!-- Version History -->
    {:else if tab === 'history'}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100 text-sm">
          <thead class="thead">
            <tr>
              <th class="px-4 py-2 text-left">Version</th>
              <th class="px-4 py-2 text-left">Status</th>
              <th class="px-4 py-2 text-left">Effective</th>
              <th class="px-4 py-2 text-left">Drafted By</th>
            </tr>
          </thead>
          <tbody>
            {#each data.versions as v (v.id)}
              <tr class="tr">
                <td class="td font-mono text-xs">{v.versionNo}</td>
                <td class="td"><span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {statusCls(v.status)}">{v.status}</span></td>
                <td class="td font-mono text-xs text-slate-500">{fmtDate(v.effectiveAt)}</td>
                <td class="td">
                  {#if v.draftedByAgentId}
                    <div class="flex items-center gap-1.5">
                      <AgentTypeBadge type="intelligent" />
                      <span class="text-[11px] text-slate-500">Policy Drafter</span>
                    </div>
                  {:else}
                    <span class="text-xs text-slate-500">Policy Office</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

    <!-- Acknowledgements -->
    {:else if tab === 'acks'}
      <div class="space-y-4 p-5">
        {#if acks.length === 0}
          <div class="text-sm text-slate-500">No acknowledgements recorded for the current version.</div>
        {:else}
          <table class="min-w-full divide-y divide-slate-100 text-sm">
            <thead class="thead">
              <tr>
                <th class="px-4 py-2 text-left">User ID</th>
                <th class="px-4 py-2 text-left">Acknowledged</th>
              </tr>
            </thead>
            <tbody>
              {#each acks as u (u.id)}
                <tr class="tr">
                  <td class="td font-mono text-xs text-slate-500">{u.userId.slice(0, 8)}…</td>
                  <td class="td"><span class="font-mono text-xs text-violet-700">{u.acknowledgedAt.slice(0, 16).replace('T', ' ')}</span></td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>

    <!-- Exceptions -->
    {:else if tab === 'exceptions'}
      <div class="p-5">
        {#if exceptions.length === 0}
          <div class="text-sm text-slate-500">No exception requests on file.</div>
        {:else}
          <ul class="space-y-2">
            {#each exceptions as exc (exc.id)}
              <li class="rounded-lg border {exc.granted ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'} px-3 py-2 text-sm">
                <div class="font-medium {exc.granted ? 'text-amber-900' : 'text-slate-700'}">{exc.justification}</div>
                <div class="mt-1 text-xs {exc.granted ? 'text-amber-700' : 'text-slate-500'}">
                  {exc.granted ? 'Granted' : 'Pending'}{exc.expiresAt ? ` · expires ${exc.expiresAt.slice(0, 10)}` : ''}
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </div>

    <!-- Mappings -->
    {:else if tab === 'mappings'}
      <div class="p-5">
        {#if mappedFrameworks.length === 0}
          <div class="text-sm text-slate-500">No framework mappings.</div>
        {:else}
          <div class="flex flex-wrap gap-2">
            {#each mappedFrameworks as fw}
              {#if fw}
                <a href="/frameworks/{fw.id}">
                  <FrameworkBadge name={fw.name} region={fw.region} version={fw.version} />
                </a>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
