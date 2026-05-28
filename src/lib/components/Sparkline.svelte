<script lang="ts">
  export let data: number[] = [];
  export let stroke: string = '#6d28d9';
  export let fill: string = 'rgba(139,92,246,0.12)';
  export let width: number = 120;
  export let height: number = 36;

  $: max = Math.max(...data, 1);
  $: min = Math.min(...data, 0);
  $: range = max - min || 1;

  function points(d: number[]) {
    const step = width / Math.max(d.length - 1, 1);
    return d.map((v, i) => `${i * step},${height - ((v - min) / range) * height}`).join(' ');
  }
  $: poly = points(data);
  $: areaPoly = `0,${height} ${poly} ${width},${height}`;
</script>

<svg viewBox="0 0 {width} {height}" class="w-full" preserveAspectRatio="none" aria-hidden="true">
  <polygon points={areaPoly} fill={fill} />
  <polyline points={poly} fill="none" stroke={stroke} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
</svg>
