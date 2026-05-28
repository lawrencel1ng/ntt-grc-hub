<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-svelte';
  import { toasts } from '$lib/stores/toast';
</script>

<div class="pointer-events-none fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-2">
  {#each $toasts as toast (toast.id)}
    <div
      class="pointer-events-auto flex w-80 items-start gap-3 rounded-xl bg-white p-4 shadow-lg ring-1
        {toast.kind === 'success' ? 'ring-emerald-200' : toast.kind === 'error' ? 'ring-rose-200' : toast.kind === 'warn' ? 'ring-amber-200' : 'ring-blue-200'}"
      in:fly={{ y: 16, duration: 220 }}
      out:fade={{ duration: 160 }}
    >
      <span class="mt-0.5 flex-shrink-0
        {toast.kind === 'success' ? 'text-emerald-500' : toast.kind === 'error' ? 'text-rose-500' : toast.kind === 'warn' ? 'text-amber-500' : 'text-blue-500'}">
        {#if toast.kind === 'success'}
          <CheckCircle2 class="h-5 w-5" />
        {:else if toast.kind === 'error'}
          <XCircle class="h-5 w-5" />
        {:else if toast.kind === 'warn'}
          <AlertTriangle class="h-5 w-5" />
        {:else}
          <Info class="h-5 w-5" />
        {/if}
      </span>
      <p class="flex-1 text-sm font-medium text-slate-800">{toast.message}</p>
      <span class="flex-shrink-0 text-slate-300">
        <X class="h-4 w-4" />
      </span>
    </div>
  {/each}
</div>
