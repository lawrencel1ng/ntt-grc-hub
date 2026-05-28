// FAIR Monte Carlo simulation — basic but believable. Given a frequency
// distribution and magnitude distribution, draw `trials` samples,
// summarise as Loss Exceedance Curve (LEC) percentiles + ALE + ARO.

import { mulberry32, hashStringToInt } from '../data/rng';

export interface Distribution {
  kind: 'beta-pert' | 'lognormal' | 'uniform' | string;
  min?: number;
  mode?: number;
  max?: number;
  mean?: number;
  stdev?: number;
}

export interface FAIRInput {
  trials?: number;
  seed?: string;
  frequencyDist: Distribution;
  magnitudeDist: Distribution;
}

export interface FAIROutput {
  trials: number;
  ale: number;
  aro: number;
  percentiles: { p10: number; p25: number; p50: number; p75: number; p90: number; p95: number; p99: number };
  lecCurve: { loss: number; probability: number }[];
}

function sampleFrequency(d: Distribution, rng: () => number): number {
  if (d.kind === 'beta-pert') {
    // Simple PERT approximation: weighted mean of min, mode, max.
    const min = d.min ?? 0;
    const mode = d.mode ?? 1;
    const max = d.max ?? mode * 2;
    const u = rng();
    return min + (max - min) * (u * 0.6 + (mode - min) / (max - min) * 0.4);
  }
  if (d.kind === 'uniform') {
    const min = d.min ?? 0;
    const max = d.max ?? 1;
    return min + rng() * (max - min);
  }
  return Math.max(0, (d.mean ?? 1) + (rng() - 0.5) * 2 * (d.stdev ?? 0.2));
}

function sampleMagnitude(d: Distribution, rng: () => number): number {
  if (d.kind === 'lognormal') {
    const mean = d.mean ?? 100_000;
    const stdev = d.stdev ?? mean * 0.5;
    // Box–Muller for a normal sample, then exponentiate the log-mean.
    const u1 = Math.max(rng(), 1e-9);
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const mu = Math.log(Math.max(mean, 1));
    const sigma = Math.max(0.1, Math.log(1 + (stdev / Math.max(mean, 1))));
    return Math.exp(mu + sigma * z);
  }
  if (d.kind === 'uniform') {
    const min = d.min ?? 0;
    const max = d.max ?? min + 100_000;
    return min + rng() * (max - min);
  }
  // beta-pert fallback for magnitudes
  const min = d.min ?? 0;
  const mode = d.mode ?? 100_000;
  const max = d.max ?? mode * 5;
  const u = rng();
  return min + (max - min) * (u * 0.6 + (mode - min) / (max - min) * 0.4);
}

export function runFAIR(input: FAIRInput): FAIROutput {
  const trials = input.trials ?? 10_000;
  const seed = hashStringToInt(input.seed ?? 'fair-default');
  const rng = mulberry32(seed);
  const losses: number[] = new Array(trials);
  let freqSum = 0;
  for (let i = 0; i < trials; i++) {
    const freq = Math.max(0, sampleFrequency(input.frequencyDist, rng));
    const mag = Math.max(0, sampleMagnitude(input.magnitudeDist, rng));
    losses[i] = freq * mag;
    freqSum += freq;
  }
  losses.sort((a, b) => a - b);
  const pct = (p: number) => losses[Math.min(trials - 1, Math.floor((p / 100) * trials))];
  const ale = losses.reduce((s, v) => s + v, 0) / trials;
  const aro = freqSum / trials;
  // LEC curve: probability that loss >= x at 12 sampled x values.
  const lecCurve: { loss: number; probability: number }[] = [];
  for (let i = 1; i <= 12; i++) {
    const idx = Math.floor((i / 13) * trials);
    const loss = losses[idx];
    const exceed = (trials - idx) / trials;
    lecCurve.push({ loss, probability: exceed });
  }
  return {
    trials,
    ale,
    aro,
    percentiles: {
      p10: pct(10), p25: pct(25), p50: pct(50),
      p75: pct(75), p90: pct(90), p95: pct(95), p99: pct(99)
    },
    lecCurve
  };
}
