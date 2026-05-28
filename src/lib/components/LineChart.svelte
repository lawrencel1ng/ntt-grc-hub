<script lang="ts">
  export let labels: string[] = [];
  export let series: { name: string; color: string; data: number[]; area?: boolean }[] = [];
  export let width: number = 640;
  export let height: number = 220;
  export let yMin: number | null = null;
  export let yMax: number | null = null;
  export let unit: string = '';

  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 24;

  $: chartW = width - padL - padR;
  $: chartH = height - padT - padB;

  $: allValues = series.flatMap((s) => s.data);
  $: computedMax = yMax ?? (allValues.length ? Math.max(...allValues) : 1);
  $: computedMin = yMin ?? (allValues.length ? Math.min(0, Math.min(...allValues)) : 0);
  $: range = computedMax - computedMin || 1;

  function xAt(i: number, len: number): number {
    return padL + (i * chartW) / Math.max(len - 1, 1);
  }
  function yAt(v: number): number {
    return padT + chartH - ((v - computedMin) / range) * chartH;
  }

  function linePath(data: number[]): string {
    return data
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i, data.length).toFixed(1)} ${yAt(v).toFixed(1)}`)
      .join(' ');
  }
  function areaPath(data: number[]): string {
    if (!data.length) return '';
    const top = data
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i, data.length).toFixed(1)} ${yAt(v).toFixed(1)}`)
      .join(' ');
    const last = xAt(data.length - 1, data.length).toFixed(1);
    const baseY = yAt(computedMin).toFixed(1);
    return `${top} L ${last} ${baseY} L ${padL} ${baseY} Z`;
  }

  // 4 horizontal gridlines
  $: gridYs = [0, 0.25, 0.5, 0.75, 1].map((p) => ({
    y: padT + chartH * (1 - p),
    label: (computedMin + p * range).toFixed(0)
  }));
</script>

<div class="w-full">
  {#if series.length > 1}
    <div class="mb-2 flex flex-wrap gap-3 text-xs">
      {#each series as s}
        <div class="flex items-center gap-1.5">
          <span class="h-0.5 w-4 rounded" style="background:{s.color}"></span>
          <span class="text-slate-600">{s.name}</span>
        </div>
      {/each}
    </div>
  {/if}
  <svg viewBox="0 0 {width} {height}" class="w-full" preserveAspectRatio="none">
    <!-- gridlines -->
    {#each gridYs as g}
      <line x1={padL} x2={width - padR} y1={g.y} y2={g.y} stroke="#e2e8f0" stroke-width="1" stroke-dasharray="2 3" />
      <text x={padL - 6} y={g.y + 3} text-anchor="end" font-size="9" fill="#94a3b8">{g.label}{unit}</text>
    {/each}
    <!-- x-axis labels -->
    {#each labels as label, i}
      {#if i % Math.max(1, Math.ceil(labels.length / 8)) === 0 || i === labels.length - 1}
        <text x={xAt(i, labels.length)} y={height - 6} text-anchor="middle" font-size="9" fill="#94a3b8">{label}</text>
      {/if}
    {/each}
    <!-- series -->
    {#each series as s}
      {#if s.area}
        <path d={areaPath(s.data)} fill={s.color} opacity="0.14" />
      {/if}
      <path d={linePath(s.data)} fill="none" stroke={s.color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    {/each}
  </svg>
</div>
