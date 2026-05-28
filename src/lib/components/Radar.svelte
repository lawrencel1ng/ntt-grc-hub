<script lang="ts">
  export let axes: string[] = [];
  export let series: { name: string; color: string; values: number[] }[] = [];
  export let width: number = 360;
  export let height: number = 320;
  export let maxValue: number = 100;
  export let levels: number = 4;

  $: cx = width / 2;
  $: cy = height / 2;
  $: radius = Math.min(width, height) / 2 - 44;

  function pointAt(idx: number, value: number): { x: number; y: number } {
    const angle = (Math.PI * 2 * idx) / Math.max(axes.length, 1) - Math.PI / 2;
    const r = (Math.max(0, Math.min(maxValue, value)) / maxValue) * radius;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  }

  function polygon(values: number[]): string {
    return values
      .map((v, i) => {
        const p = pointAt(i, v);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(' ');
  }

  $: rings = Array.from({ length: levels }, (_, i) => ((i + 1) / levels) * radius);
  $: axisLines = axes.map((label, i) => {
    const angle = (Math.PI * 2 * i) / Math.max(axes.length, 1) - Math.PI / 2;
    const x2 = cx + Math.cos(angle) * radius;
    const y2 = cy + Math.sin(angle) * radius;
    const lx = cx + Math.cos(angle) * (radius + 16);
    const ly = cy + Math.sin(angle) * (radius + 16);
    return { x2, y2, label, lx, ly, anchor: Math.cos(angle) > 0.3 ? 'start' : Math.cos(angle) < -0.3 ? 'end' : 'middle' };
  });
</script>

<div class="w-full">
  {#if series.length > 1}
    <div class="mb-2 flex flex-wrap justify-center gap-3 text-xs">
      {#each series as s}
        <div class="flex items-center gap-1.5">
          <span class="h-2 w-2 rounded-sm" style="background:{s.color}"></span>
          <span class="text-slate-600">{s.name}</span>
        </div>
      {/each}
    </div>
  {/if}
  <svg viewBox="0 0 {width} {height}" class="w-full" role="img" aria-label="Radar chart">
    <!-- rings -->
    {#each rings as r}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="2 3" />
    {/each}
    <!-- axes -->
    {#each axisLines as a}
      <line x1={cx} y1={cy} x2={a.x2} y2={a.y2} stroke="#e2e8f0" stroke-width="1" />
      <text x={a.lx} y={a.ly} text-anchor={a.anchor} font-size="10" fill="#475569" dominant-baseline="middle">{a.label}</text>
    {/each}
    <!-- series -->
    {#each series as s}
      <polygon points={polygon(s.values)} fill={s.color} fill-opacity="0.18" stroke={s.color} stroke-width="1.8" stroke-linejoin="round" />
      {#each s.values as v, i}
        {@const p = pointAt(i, v)}
        <circle cx={p.x} cy={p.y} r="2.8" fill={s.color} />
      {/each}
    {/each}
  </svg>
</div>
