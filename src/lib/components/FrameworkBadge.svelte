<script lang="ts">
  import { Library } from 'lucide-svelte';
  export let name: string;
  export let version: string = '';
  export let region: string = 'Global';

  // region → color class (consolidated palette: violet / amber / slate, one blue for Global)
  function regionCls(r: string): string {
    const key = r.toLowerCase();
    if (key.includes('eu') || key === 'europe') return 'bg-slate-100 text-slate-700 ring-slate-200';
    if (key.includes('americas') || key.includes('us')) return 'bg-slate-100 text-slate-700 ring-slate-200';
    if (key.includes('singapore') || key === 'sg') return 'bg-violet-50 text-violet-700 ring-violet-200';
    if (key.includes('apac') || key.includes('asia')) return 'bg-violet-100 text-violet-800 ring-violet-300';
    if (key.includes('esg')) return 'bg-amber-50 text-amber-700 ring-amber-200';
    return 'bg-blue-50 text-blue-700 ring-blue-200'; // Global default
  }

  $: cls = regionCls(region);
</script>

<span class="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset {cls}">
  <Library class="h-3 w-3" />
  <span class="font-semibold">{name}</span>
  {#if version}<span class="opacity-70">v{version}</span>{/if}
</span>
