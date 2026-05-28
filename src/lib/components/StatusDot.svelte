<script lang="ts">
  export let status: 'connected' | 'degraded' | 'disconnected' | 'green' | 'amber' | 'red' | 'healthy' | 'warning' | 'critical' | 'operational' | 'running' | 'stopped' | 'error' | 'available' | 'maintenance' | 'idle' | 'paused' | 'pass' | 'fail' | 'warn' | 'n/a' | string = 'connected';
  export let withLabel = true;

  const good = new Set(['connected', 'green', 'healthy', 'operational', 'running', 'available', 'pass']);
  const warnSet = new Set(['degraded', 'amber', 'warning', 'maintenance', 'idle', 'paused', 'warn']);
  const bad = new Set(['disconnected', 'red', 'critical', 'error', 'fail', 'stopped']);

  $: color = good.has(status)
    ? 'bg-emerald-500'
    : warnSet.has(status)
      ? 'bg-amber-500'
      : bad.has(status)
        ? 'bg-rose-500'
        : 'bg-slate-400';
  $: textCls = good.has(status)
    ? 'text-emerald-700'
    : warnSet.has(status)
      ? 'text-amber-700'
      : bad.has(status)
        ? 'text-rose-700'
        : 'text-slate-600';
</script>

<span class="inline-flex items-center gap-1.5">
  <span class="relative flex h-2 w-2">
    <span class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-50 {color}"></span>
    <span class="relative inline-flex h-2 w-2 rounded-full {color}"></span>
  </span>
  {#if withLabel}<span class="text-xs font-medium {textCls}">{status}</span>{/if}
</span>
