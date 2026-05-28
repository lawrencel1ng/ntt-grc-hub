<script lang="ts">
  export let points: { loss: number; probability: number }[] = [];
  export let percentiles: { p50: number; p90: number; p99: number } = { p50: 0, p90: 0, p99: 0 };
  export let width: number = 640;
  export let height: number = 260;
  export let currency: string = 'SGD';

  const padL = 56;
  const padR = 16;
  const padT = 16;
  const padB = 36;

  const logMin = 4; // 10^4
  const logMax = 9; // 10^9

  $: chartW = width - padL - padR;
  $: chartH = height - padT - padB;

  function xAt(loss: number): number {
    const l = loss <= 0 ? logMin : Math.max(logMin, Math.min(logMax, Math.log10(loss)));
    const t = (l - logMin) / (logMax - logMin);
    return padL + t * chartW;
  }
  function yAt(p: number): number {
    return padT + chartH - Math.max(0, Math.min(1, p)) * chartH;
  }

  $: sortedPts = [...points].sort((a, b) => a.loss - b.loss);

  function curvePath(pts: typeof sortedPts): string {
    if (!pts.length) return '';
    return pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(p.loss).toFixed(1)} ${yAt(p.probability).toFixed(1)}`)
      .join(' ');
  }
  function areaPath(pts: typeof sortedPts): string {
    if (!pts.length) return '';
    const top = pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(p.loss).toFixed(1)} ${yAt(p.probability).toFixed(1)}`)
      .join(' ');
    const lastX = xAt(pts[pts.length - 1].loss).toFixed(1);
    const baseY = yAt(0).toFixed(1);
    const firstX = xAt(pts[0].loss).toFixed(1);
    return `${top} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
  }

  function fmtMoney(n: number): string {
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
    return `${n}`;
  }

  // x-axis log ticks
  const logTicks = [4, 5, 6, 7, 8, 9];
  // y-axis gridlines
  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  $: markers = [
    { label: 'P50', value: percentiles.p50, color: '#6d28d9' },
    { label: 'P90', value: percentiles.p90, color: '#f59e0b' },
    { label: 'P99', value: percentiles.p99, color: '#e11d48' }
  ];
  // P50 marker uses violet (low-risk percentile in the rose-amber-violet scale).
</script>

<svg viewBox="0 0 {width} {height}" class="w-full" role="img" aria-label="Loss exceedance curve">
  <!-- Y gridlines -->
  {#each yTicks as t}
    <line x1={padL} x2={width - padR} y1={yAt(t)} y2={yAt(t)} stroke="#e2e8f0" stroke-width="1" stroke-dasharray="2 3" />
    <text x={padL - 6} y={yAt(t) + 3} text-anchor="end" font-size="9" fill="#94a3b8">{(t * 100).toFixed(0)}%</text>
  {/each}

  <!-- X log ticks -->
  {#each logTicks as l}
    <line x1={xAt(Math.pow(10, l))} x2={xAt(Math.pow(10, l))} y1={padT} y2={padT + chartH} stroke="#f1f5f9" stroke-width="1" />
    <text x={xAt(Math.pow(10, l))} y={padT + chartH + 14} text-anchor="middle" font-size="9" fill="#94a3b8">{fmtMoney(Math.pow(10, l))}</text>
  {/each}
  <text x={padL + chartW / 2} y={height - 6} text-anchor="middle" font-size="10" font-weight="600" fill="#475569">Loss ({currency})</text>
  <text x="12" y={padT + chartH / 2} text-anchor="middle" font-size="10" font-weight="600" fill="#475569" transform="rotate(-90 12 {padT + chartH / 2})">Exceedance Probability</text>

  <!-- area + curve -->
  {#if sortedPts.length}
    <path d={areaPath(sortedPts)} fill="#8b5cf6" opacity="0.12" />
    <path d={curvePath(sortedPts)} fill="none" stroke="#6d28d9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  {/if}

  <!-- percentile markers -->
  {#each markers as m}
    {#if m.value > 0}
      <line x1={xAt(m.value)} x2={xAt(m.value)} y1={padT} y2={padT + chartH} stroke={m.color} stroke-width="1" stroke-dasharray="3 3" />
      <circle cx={xAt(m.value)} cy={padT + chartH - 8} r="3.5" fill={m.color} />
      <text x={xAt(m.value)} y={padT + 12} text-anchor="middle" font-size="10" font-weight="700" fill={m.color}>{m.label}</text>
      <text x={xAt(m.value)} y={padT + 24} text-anchor="middle" font-size="9" fill={m.color}>{fmtMoney(m.value)}</text>
    {/if}
  {/each}
</svg>
