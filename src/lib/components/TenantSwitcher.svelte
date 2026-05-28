<script lang="ts">
  import { currentTenantId, ALL_TENANTS_ID, type TenantSummary } from '$lib/stores/tenant';
  import { invalidateAll } from '$app/navigation';
  import { ChevronDown, Building2, ShieldAlert } from 'lucide-svelte';
  export let tenants: TenantSummary[] = [];
  let open = false;
  let busy = false;

  $: current = tenants.find((t) => t.id === $currentTenantId);
  $: label = current?.name ?? 'All Tenants';
  $: classified = current?.classified === true;

  async function pick(tid: string) {
    if (busy) return;
    busy = true;
    open = false;
    try {
      // 1. Persist active tenant on the server (cookie used by hooks.server.ts).
      await fetch('/api/tenant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tenantId: tid === ALL_TENANTS_ID ? '' : tid })
      });
      // 2. Update the client store so the chip + banner re-render immediately.
      currentTenantId.set(tid);
      // 3. Re-run every loader so the whole app re-scopes to the new tenant.
      await invalidateAll();
    } finally {
      busy = false;
    }
  }
</script>

<div class="relative">
  <button class="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          disabled={busy}
          on:click={() => (open = !open)}>
    <Building2 class="h-4 w-4 text-grc-primary" />
    <span>{label}</span>
    {#if classified}<ShieldAlert class="h-4 w-4 text-rose-500" />{/if}
    <ChevronDown class="h-3.5 w-3.5 text-slate-400" />
  </button>
  {#if open}
    <div class="absolute left-0 z-40 mt-1 w-72 rounded-lg border border-slate-200 bg-white shadow-lg">
      <button class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
              on:click={() => pick(ALL_TENANTS_ID)}>
        <span class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">MSSP</span>
        <span class="flex-1 font-medium">All Tenants (rollup)</span>
      </button>
      <div class="border-t border-slate-100"></div>
      {#each tenants as t}
        <button class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                on:click={() => pick(t.id)}>
          <div class="flex-1">
            <div class="font-medium text-slate-900">{t.name}</div>
            <div class="text-xs text-slate-500">{t.industry} · {t.region} · {t.primaryFramework}</div>
          </div>
          {#if t.classified}<span class="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-700 ring-1 ring-inset ring-rose-200">Sovereign</span>{/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
