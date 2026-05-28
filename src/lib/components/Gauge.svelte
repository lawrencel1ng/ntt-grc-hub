<script lang="ts">
  export let value: number = 0;
  export let label: string = '';
  export let width: number = 220;
  export let height: number = 140;
  export let suffix: string = '';

  $: clamped = Math.max(0, Math.min(100, value));

  $: cx = width / 2;
  $: cy = height - 16;
  $: radius = Math.min(width / 2 - 12, height - 24);
  $: thickness = 16;

  // semicircle from 180° to 360°
  function arcPath(start: number, end: number, r: number): string {
    const a0 = (start * Math.PI) / 180;
    const a1 = (end * Math.PI) / 180;
    const x0 = cx + Math.cos(a0) * r;
    const y0 = cy + Math.sin(a0) * r;
    const x1 = cx + Math.cos(a1) * r;
    const y1 = cy + Math.sin(a1) * r;
    const large = end - start > 180 ? 1 : 0;
    return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }

  // value → angle [180, 360]
  $: valAngle = 180 + (clamped / 100) * 180;

  $: valueColor = clamped < 40 ? '#e11d48' : clamped < 70 ? '#f59e0b' : '#047857';
</script>

<div class="flex w-full flex-col items-center">
  <svg viewBox="0 0 {width} {height}" class="w-full max-w-[260px]" role="img" aria-label="{label} gauge: {clamped}">
    <!-- background segments: red 0-40, amber 40-70, emerald 70-100 -->
    <path d={arcPath(180, 180 + 0.4 * 180, radius)} fill="none" stroke="#fecdd3" stroke-width={thickness} stroke-linecap="butt" />
    <path d={arcPath(180 + 0.4 * 180, 180 + 0.7 * 180, radius)} fill="none" stroke="#fed7aa" stroke-width={thickness} stroke-linecap="butt" />
    <path d={arcPath(180 + 0.7 * 180, 360, radius)} fill="none" stroke="#bbf7d0" stroke-width={thickness} stroke-linecap="butt" />

    <!-- value arc -->
    {#if clamped > 0}
      <path d={arcPath(180, valAngle, radius)} fill="none" stroke={valueColor} stroke-width={thickness} stroke-linecap="round" />
    {/if}

    <!-- center text -->
    <text x={cx} y={cy - radius / 2 + 6} text-anchor="middle" font-size="32" font-weight="700" fill="#0f172a">{Math.round(clamped)}{suffix}</text>
    {#if label}
      <text x={cx} y={cy - radius / 2 + 24} text-anchor="middle" font-size="11" fill="#64748b">{label}</text>
    {/if}
  </svg>
</div>
