<script lang="ts">
  import { Copy, Check } from 'lucide-svelte';
  export let hash: string = '';
  export let filename: string = '';
  export let truncate: number = 8;

  let copied = false;

  function shortHash(h: string): string {
    if (!h) return '—';
    return h.length > truncate ? h.slice(0, truncate) : h;
  }

  async function copyHash() {
    if (!hash) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(hash);
      }
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      // ignore
    }
  }
</script>

<button
  type="button"
  class="evidence-chip cursor-pointer transition-colors hover:bg-slate-100"
  on:click={copyHash}
  title="Click to copy full hash: {hash}"
>
  <span class="text-slate-500">{shortHash(hash)}</span>
  {#if filename}
    <span class="text-slate-300">·</span>
    <span class="truncate">{filename}</span>
  {/if}
  {#if copied}
    <Check class="h-3 w-3 text-emerald-600" />
  {:else}
    <Copy class="h-3 w-3 text-slate-400" />
  {/if}
</button>
