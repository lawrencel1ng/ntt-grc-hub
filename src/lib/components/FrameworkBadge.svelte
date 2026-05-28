<script lang="ts">
  import { Library } from 'lucide-svelte';
  export let name: string;
  export let version: string = '';
  export let region: string = 'Global';

  // region → color class
  function regionCls(r: string): string {
    const key = r.toLowerCase();
    if (key.includes('eu') || key === 'europe') return 'bg-indigo-50 text-indigo-700 ring-indigo-200';
    if (key.includes('americas') || key.includes('us')) return 'bg-cyan-50 text-cyan-700 ring-cyan-200';
    if (key.includes('singapore') || key === 'sg') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    if (key.includes('apac') || key.includes('asia')) return 'bg-teal-50 text-teal-700 ring-teal-200';
    if (key.includes('esg')) return 'bg-lime-50 text-lime-700 ring-lime-200';
    return 'bg-blue-50 text-blue-700 ring-blue-200'; // Global default
  }

  $: cls = regionCls(region);
</script>

<span class="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset {cls}">
  <Library class="h-3 w-3" />
  <span class="font-semibold">{name}</span>
  {#if version}<span class="opacity-70">v{version}</span>{/if}
</span>
