<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import EvidenceChip from '$lib/components/EvidenceChip.svelte';
  import AgentTypeBadge from '$lib/components/AgentTypeBadge.svelte';
  import { addToast } from '$lib/stores/toast';
  import { Download, FileBarChart, FileText, Package, Zap, ClipboardCheck } from 'lucide-svelte';
  import type { EngagementType, AuditFinding } from '$lib/data/types';

  export let data;

  type Tab = 'findings' | 'workpapers' | 'pack';
  let tab: Tab = 'findings';
  const TABS: { id: Tab; label: string; icon: typeof Download }[] = [
    { id: 'findings',   label: 'Findings',     icon: FileBarChart },
    { id: 'workpapers', label: 'Workpapers',   icon: FileText },
    { id: 'pack',       label: 'Evidence Pack', icon: Package }
  ];

  function typeCls(t: EngagementType): string {
    switch (t) {
      case 'external':   return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'internal':   return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'regulatory': return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'customer':   return 'bg-violet-50 text-violet-700 ring-violet-200';
    }
  }
  function sevCls(s: string): string {
    if (s === 'critical') return 'bg-rose-100 text-rose-800 ring-rose-200';
    if (s === 'high')     return 'bg-orange-50 text-orange-700 ring-orange-200';
    if (s === 'medium')   return 'bg-amber-50 text-amber-700 ring-amber-200';
    return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
  function statusCls(s: string): string {
    if (s === 'open')          return 'bg-rose-50 text-rose-700 ring-rose-200';
    if (s === 'closed')        return 'bg-violet-50 text-violet-700 ring-violet-200';
    if (s === 'accepted-risk') return 'bg-amber-50 text-amber-700 ring-amber-200';
    return 'bg-slate-100 text-slate-700 ring-slate-200';
  }

  function exportFindings() {
    const headers = ['severity','title','description','status','due_at'];
    const rows: string[][] = data.findings.map((f) => [f.severity, f.title, f.description ?? '', f.status, f.dueAt ?? '']);
    const csv = [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
    // eslint-disable-next-line no-console
    console.log('[audit] findings CSV:\n', csv);
    addToast('success', `Findings CSV exported (${rows.length} rows).`);
  }
  function escapeCsv(s: string): string {
    if (s.includes('"') || s.includes(',') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function downloadPack() {
    const headers = ['id','title','kind','captured_at','hash'];
    const rows: string[][] = data.evidence.map((e) => [String(e.id), e.title, e.kind, e.capturedAt, e.rowHash ?? '']);
    const csv = [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
    // eslint-disable-next-line no-console
    console.log(`[audit] evidence-pack CSV (${rows.length} items):\n`, csv);
    addToast('success', `Evidence pack downloaded — ${rows.length} items, 8s assembly via Audit Companion.`);
  }

  // ---------- Synthesised workpapers ----------
  $: workpapers = [
    { id: 'wp_1', title: 'Scope memo',                            createdBy: 'Audit Companion (agent)', createdAt: data.audit.openedAt.slice(0, 10), preview: 'In-scope systems include all production workloads classified Tier-1 and Tier-2; data centres in SG-east and SG-west; identity perimeter via Okta.' },
    { id: 'wp_2', title: 'Risk assessment',                        createdBy: data.audit.leadAuditor,    createdAt: data.audit.openedAt.slice(0, 10), preview: 'Top-3 risks: privileged access drift; cross-border outsourcing under MAS 655; data residency for analytics workloads.' },
    { id: 'wp_3', title: 'Control testing methodology',            createdBy: data.audit.leadAuditor,    createdAt: data.audit.openedAt.slice(0, 10), preview: 'Sampling approach: 25 per family with stratification by criticality; auto-walkthroughs via Control Tester agent where available.' },
    { id: 'wp_4', title: 'Sample of control testing — encryption', createdBy: 'Audit Companion (agent)', createdAt: data.audit.openedAt.slice(0, 10), preview: 'Inspected KMS rotation evidence for 12 production buckets; 9 passed, 3 failed (HERO finding).' }
  ];

  function fmtDate(iso?: string): string {
    return iso ? iso.slice(0, 10) : '—';
  }

  // Group findings by severity for narrative
  $: findingsBySev = (() => {
    const out: Record<string, AuditFinding[]> = { critical: [], high: [], medium: [], low: [] };
    for (const f of data.findings) {
      if (f.severity in out) out[f.severity].push(f);
    }
    return out;
  })();
  void findingsBySev;
</script>

<PageHeader
  title={data.audit.name}
  breadcrumbs={[{ label: 'Audits', href: '/audits' }, { label: data.audit.name }]}
>
  <svelte:fragment slot="actions">
    <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset {typeCls(data.audit.type)}">{data.audit.type}</span>
  </svelte:fragment>
</PageHeader>

<div class="space-y-6">
  <!-- Metadata header card -->
  <div class="card p-5">
    <div class="flex items-start gap-3">
      <div class="rounded-lg bg-violet-50 p-2 text-violet-700"><ClipboardCheck class="h-5 w-5" /></div>
      <div class="flex-1">
        <div class="grid grid-cols-1 gap-4 text-sm md:grid-cols-4">
          <div>
            <div class="section-title text-xs">Lead Auditor</div>
            <div class="mt-1 font-medium text-slate-800">{data.audit.leadAuditor}</div>
          </div>
          <div>
            <div class="section-title text-xs">Opened</div>
            <div class="mt-1 font-mono text-slate-800">{fmtDate(data.audit.openedAt)}</div>
          </div>
          <div>
            <div class="section-title text-xs">Closed</div>
            <div class="mt-1 font-mono text-slate-800">{fmtDate(data.audit.closedAt)}</div>
          </div>
          <div>
            <div class="section-title text-xs">Framework</div>
            <div class="mt-1 font-medium text-slate-800">
              {#if data.audit.frameworkId}
                <a href="/frameworks/{data.audit.frameworkId}" class="text-grc-primary hover:underline">{data.audit.frameworkId}</a>
              {:else}
                —
              {/if}
            </div>
          </div>
        </div>
        {#if data.audit.scope}
          <div class="mt-3">
            <div class="section-title text-xs">Scope</div>
            <div class="mt-1 text-sm text-slate-700">{data.audit.scope}</div>
          </div>
        {/if}
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

    <!-- Findings -->
    {#if tab === 'findings'}
      <div class="flex items-center justify-end gap-2 border-b border-slate-100 px-5 py-3">
        <button class="btn-secondary py-1 text-xs" on:click={exportFindings}>
          <Download class="h-3 w-3" /> Export CSV
        </button>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100 text-sm">
          <thead class="thead">
            <tr>
              <th class="px-4 py-2 text-left">Severity</th>
              <th class="px-4 py-2 text-left">Title</th>
              <th class="px-4 py-2 text-left">Description</th>
              <th class="px-4 py-2 text-left">Control</th>
              <th class="px-4 py-2 text-left">Due</th>
              <th class="px-4 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {#each data.findings as f (f.id)}
              <tr class="tr">
                <td class="td"><span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {sevCls(f.severity)}">{f.severity}</span></td>
                <td class="td">{f.title}</td>
                <td class="td max-w-md truncate text-xs text-slate-500">{f.description}</td>
                <td class="td text-xs text-slate-500 font-mono">
                  {#if f.controlId}
                    <a href="/controls/{f.controlId}" class="hover:underline">{f.controlId.slice(0, 16)}…</a>
                  {:else}
                    —
                  {/if}
                </td>
                <td class="td font-mono text-xs text-slate-500">{fmtDate(f.dueAt)}</td>
                <td class="td"><span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {statusCls(f.status)}">{f.status}</span></td>
              </tr>
            {:else}
              <tr><td colspan="6" class="px-4 py-6 text-center text-sm text-slate-500">No findings recorded.</td></tr>
            {/each}
          </tbody>
        </table>
      </div>

    <!-- Workpapers -->
    {:else if tab === 'workpapers'}
      <div class="divide-y divide-slate-100">
        {#each workpapers as wp}
          <div class="px-5 py-4">
            <div class="flex items-start justify-between">
              <div>
                <div class="font-semibold text-grc-ink">{wp.title}</div>
                <div class="mt-0.5 text-xs text-slate-500">{wp.createdBy} · {wp.createdAt}</div>
              </div>
              <button class="btn-ghost p-1" on:click={() => addToast('info', `Opening ${wp.title}`)}>
                <Download class="h-4 w-4" />
              </button>
            </div>
            <p class="mt-2 text-sm text-slate-600">{wp.preview}</p>
          </div>
        {/each}
      </div>

    <!-- Evidence Pack -->
    {:else if tab === 'pack'}
      <div class="space-y-4 p-5">
        <div class="flex items-start gap-3 rounded-xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 to-white px-5 py-4">
          <div class="rounded-lg bg-violet-100 p-2 text-violet-700">
            <Zap class="h-5 w-5" />
          </div>
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold text-violet-900">Generated by Audit Companion agent</span>
              <AgentTypeBadge type="intelligent" />
            </div>
            <div class="mt-1 text-xs text-violet-700">
              {data.evidence.length} evidence items assembled in <span class="font-mono font-semibold">8 seconds</span>.
              Previously: ~3 days of manual assembly.
            </div>
          </div>
          <button class="btn-primary" on:click={downloadPack}>
            <Download class="h-4 w-4" />
            Download CSV
          </button>
        </div>

        <div>
          <h3 class="section-title mb-3">Evidence Items ({data.evidence.length})</h3>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {#each data.evidence as e (e.id)}
              <div class="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                <div class="truncate font-medium text-slate-800">{e.title}</div>
                <div class="mt-1 flex items-center justify-between gap-2">
                  <span class="text-slate-500">{e.kind}</span>
                  <EvidenceChip hash={e.rowHash ?? ''} />
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
