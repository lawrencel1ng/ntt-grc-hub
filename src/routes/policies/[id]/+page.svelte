<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import ProgressBar from '$lib/components/ProgressBar.svelte';
  import FrameworkBadge from '$lib/components/FrameworkBadge.svelte';
  import AgentTypeBadge from '$lib/components/AgentTypeBadge.svelte';
  import { addToast } from '$lib/stores/toast';
  import { FileText, History, UserCheck, AlertCircle, Library, Edit, ScrollText } from 'lucide-svelte';
  import type { PolicyVersion, PolicyVersionStatus } from '$lib/data/types';

  export let data;

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
    if (s === 'approved')  return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    if (s === 'in-review') return 'bg-amber-50 text-amber-700 ring-amber-200';
    if (s === 'draft')     return 'bg-blue-50 text-blue-700 ring-blue-200';
    if (s === 'retired')   return 'bg-slate-100 text-slate-600 ring-slate-200';
    return 'bg-slate-100 text-slate-700 ring-slate-200';
  }

  function fmtDate(iso?: string): string { return iso ? iso.slice(0, 10) : '—'; }

  // ---------- Acks (synthesised) ----------
  $: ackRate = data.policy.tenantId === 't_maybank' || data.policy.tenantId === 't_grab' || data.policy.tenantId === 't_mindef'
    ? 0.78 : 0.92;
  $: ackUsers = [
    { name: 'Lawrence Khoo',  email: 'lawrence@example.sg',  ackedAt: '2026-04-12 10:14' },
    { name: 'Adi Tan',        email: 'adi@example.sg',       ackedAt: '2026-04-13 09:32' },
    { name: 'Mei Chen',       email: 'mei@example.sg',       ackedAt: '2026-04-14 14:01' },
    { name: 'Ravi Kumar',     email: 'ravi@example.sg',      ackedAt: '2026-04-19 08:48' },
    { name: 'Wei L. Liang',   email: 'wei@example.sg',       ackedAt: '2026-04-22 17:22' },
    { name: 'Sara Lim',       email: 'sara@example.sg',      ackedAt: '' },
    { name: 'Daniel Ng',      email: 'daniel@example.sg',    ackedAt: '' }
  ];

  // ---------- Exceptions ----------
  $: exceptions = data.policy.title.toLowerCase().includes('outsourcing')
    ? [{ id: 'exc_1', title: 'AWS Mumbai region grandfathered until 2026-12-31', requestedBy: 'Adi T.', approvedBy: 'CISO', expiresAt: '2026-12-31' }]
    : [];

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

  function editPolicy() {
    addToast('info', 'Policy editor coming next phase.');
  }
</script>

<PageHeader
  title={data.policy.title}
  breadcrumbs={[{ label: 'Policies', href: '/policies' }, { label: data.policy.title }]}
>
  <svelte:fragment slot="actions">
    <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {statusCls(current?.status)}">{current?.status ?? 'draft'}</span>
    <button class="btn-primary" on:click={editPolicy}>
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
        <div>
          <div class="flex items-center justify-between text-sm">
            <span class="font-medium text-slate-700">Ack rate</span>
            <span class="font-mono text-slate-600">{(ackRate * 100).toFixed(1)}%</span>
          </div>
          <div class="mt-2"><ProgressBar value={ackRate * 100} /></div>
        </div>
        <table class="min-w-full divide-y divide-slate-100 text-sm">
          <thead class="thead">
            <tr>
              <th class="px-4 py-2 text-left">User</th>
              <th class="px-4 py-2 text-left">Email</th>
              <th class="px-4 py-2 text-left">Acknowledged</th>
            </tr>
          </thead>
          <tbody>
            {#each ackUsers as u}
              <tr class="tr">
                <td class="td">{u.name}</td>
                <td class="td text-xs text-slate-500 font-mono">{u.email}</td>
                <td class="td">
                  {#if u.ackedAt}
                    <span class="font-mono text-xs text-emerald-700">{u.ackedAt}</span>
                  {:else}
                    <span class="text-xs text-amber-700">pending</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

    <!-- Exceptions -->
    {:else if tab === 'exceptions'}
      <div class="p-5">
        {#if exceptions.length === 0}
          <div class="text-sm text-slate-500">No exception requests on file.</div>
        {:else}
          <ul class="space-y-2">
            {#each exceptions as exc}
              <li class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                <div class="font-medium text-amber-900">{exc.title}</div>
                <div class="mt-1 text-xs text-amber-700">Requested by {exc.requestedBy} · approved by {exc.approvedBy} · expires {exc.expiresAt}</div>
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
