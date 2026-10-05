// JS-side wave height field, ported verbatim from src/routes/index.tsx in the
// web app — used to keep the camera's buoyancy physics numerically in sync
// with the ocean surface the GPU actually renders. See
// src/three/materials/oceanMaterial.ts for the matching TSL vertex
// displacement.
import type { OceanWaveComponent } from "./fftOceanSpectrum";
import { sampleOceanWaveHeight } from "./fftOceanSpectrum";

export function shapedWave(theta: number, p: number): number {
  if (p <= 1) return Math.sin(theta);
  const k = Math.min(1, Math.max(0, (p - 1) / 5));
  const amount = (p - 1) * 0.08;
  const wrapped = Math.atan2(Math.sin(theta - Math.PI / 2), Math.cos(theta - Math.PI / 2));
  const width = 0.72 * (1 - k) + 0.6 * k;
  const crest = Math.exp(-(wrapped * wrapped) / (2 * width * width));
  const mean = width * 0.3989;
  const base = Math.sin(theta);
  const peakBoost = Math.pow(Math.max(base, 0), 1 + 0.8 * k) - 0.3183 * k;
  const stokes = -Math.cos(2 * theta) * k * 0.01;
  return (base + stokes + amount * (crest - mean) + k * 0.55 * peakBoost) / (1 + amount * 0.28 + k * 0.35 + k * 0.01);
}

export function waveHeight(
  x: number,
  z: number,
  t: number,
  amp: number,
  regular: boolean,
  cross: boolean,
  period: number = 1,
  peak: number = 1,
  dir: number = 0,
  realistic: boolean = false,
  realisticComponents: OceanWaveComponent[] | null = null,
  dying: boolean = false,
  dyingComponents: OceanWaveComponent[] | null = null,
  dyingAmp: number = 0,
  dyingT: number = 0,
  freq: number = 1,
): number {
  const c = -Math.sin(dir),
    s = -Math.cos(dir);
  const xr = c * x + s * z;
  const zr = -s * x + c * z;
  if (dying && dyingComponents) {
    return sampleOceanWaveHeight(dyingComponents, xr, zr, dyingT, freq) * dyingAmp;
  }
  if (realistic && realisticComponents) {
    return sampleOceanWaveHeight(realisticComponents, xr, zr, t, freq) * amp;
  }
  if (regular) {
    const kx = (0.12 * freq) / period;
    const kz = (0.09 * freq) / period;
    const rx = shapedWave(xr * kx + t * 0.9, peak) * 2.6 * amp;
    const rz = cross ? shapedWave(zr * kz + t * 0.9 + 1.1, peak) * 1.4 * amp : 0;
    return rx + rz;
  }
  const w1 = shapedWave(xr * 0.12 * freq + t * 0.9, peak) * 1.0;
  const w2 = shapedWave(zr * 0.17 * freq + t * 0.7 + 1.3, peak) * 0.75;
  const w3 = shapedWave((xr * 0.22 + zr * 0.19) * freq + t * 1.4 + 2.1, peak) * 0.5;
  const w4 = shapedWave((xr * 0.31 - zr * 0.11) * freq + t * 1.8 + 0.4, peak) * 0.35;
  return (w1 + w2 + w3 + w4) * amp;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const v = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return v * v * (3 - 2 * v);
}

export function vortexSurfaceHeight(
  x: number,
  z: number,
  t: number,
  amp: number,
  period: number,
  opening: number,
  freq: number = 1,
  spin: number = 1,
): number {
  const op = Math.max(1, opening);
  const r = Math.hypot(x, z);
  const g = Math.exp(-(r * r) / (op * op));
  const pit = -op * 1.6 * g;
  const stableFade = 1 - smoothstep(220, 520, r);
  const kR = (0.12 * freq) / period;
  const arms = Math.max(1, Math.floor(kR * op * 0.6 + 0.5));
  const theta = Math.atan2(z, x);
  const phase = r * kR + t * 0.9 - spin * arms * (theta - spin * 0.35 * t);
  const a0 = Math.min(2.6 * amp, op * 0.35);
  const ring = Math.sin(phase) * a0 * stableFade * (1 - g);
  return pit + ring;
}
