// Realistic ("FFT ocean") waveform — ported to three.js from:
//
//   OceanDemo — https://github.com/drsounds/OceanDemo
//   "Port of the Unity Ocean demo https://github.com/gasgiant/FFT-Ocean in
//   Babylon.js WebGPU", by Popov (evpopov.com). MIT licensed.
//
// That project drives the ocean surface with a real Tessendorf/JONSWAP FFT
// simulation: a directional wave spectrum (local wind sea + distant swell,
// each a JONSWAP spectrum with cosine-2s directional spreading, a TMA
// shallow-water correction and a short-wave fade) is evaluated on a dense
// k-space grid, given a random complex amplitude per bin, evolved forward in
// time via the dispersion relation, and turned into a height/displacement
// field with an inverse FFT — see its src/scenes/{initialSpectrum,
// timeDependentSpectrum,wavesCascade,wavesGenerator}.* and the WGSL compute
// shaders under src/assets/ocean/.
//
// three.js's WebGLRenderer here has no compute-shader/IFFT pipeline (the
// original needs WebGPU), so instead of the FFT this module evaluates the
// exact same JONSWAP directional spectrum (formulas ported verbatim below)
// at a modest number of stochastically-sampled wave vectors — a classic
// "sum of sinusoids" realization of the spectrum (the same statistics an
// FFT would produce, just without the O(N log N) trick to sum thousands of
// bins). Each sample becomes one cosine term with an amplitude derived from
// the spectral density at that wave vector, so the result carries the same
// dual wind-sea/swell character, dispersion relation and multi-scale
// (cascade) structure as the source repo, at a cost cheap enough for a
// per-vertex GLSL loop.
//
// Kept intentionally separate from the analytic "regelbunden/spridd" wave
// modes already in routes/index.tsx — this is a third, optional waveform.

const G = 9.81;
// Deep-water-ish depth so tanh(k*depth) saturates for nearly all sampled k
// (the OceanDemo default of 3m is a shallow test pond; this scene is a deep
// meditative ocean). The dispersion relation still uses the real formula,
// so shoaling behavior remains physically consistent if this is changed.
const DEPTH = 500;

// The two JONSWAP spectra straight from OceanDemo's WavesSettings (local
// wind sea + distant swell) — see src/scenes/wavesSettings.ts.
type DisplaySpectrumSettings = {
  scale: number;
  windSpeed: number;
  windDirection: number; // degrees
  fetch: number;
  spreadBlend: number;
  swell: number;
  peakEnhancement: number;
  shortWavesFade: number;
};

const LOCAL_SPECTRUM: DisplaySpectrumSettings = {
  scale: 0.5,
  windSpeed: 1.5,
  windDirection: -29.81,
  fetch: 100000,
  spreadBlend: 1,
  swell: 0.198,
  peakEnhancement: 3.3,
  shortWavesFade: 0.01,
};

const SWELL_SPECTRUM: DisplaySpectrumSettings = {
  scale: 0.5,
  windSpeed: 1.5,
  windDirection: 90,
  fetch: 300000,
  spreadBlend: 1,
  swell: 1,
  peakEnhancement: 3.3,
  shortWavesFade: 0.01,
};

// The three cascade length scales (meters) from wavesGenerator.ts — one
// covers big swell, one mid chop, one fine ripple.
const CASCADE_LENGTH_SCALES = [250, 17, 5];
// How many discrete wave components to spend on each cascade (sums to
// FFT_WAVE_COUNT). Weighted toward the swell cascade since it dominates the
// visible silhouette; the fine cascade mostly adds sparkle.
const CASCADE_COMPONENT_COUNTS = [14, 10, 8];
export const FFT_WAVE_COUNT = CASCADE_COMPONENT_COUNTS.reduce((a, b) => a + b, 0);

// Resolved (radians / SI) spectrum parameters — ported from
// WavesSettings.setParametersToShader / _fillSettingsStruct.
type SpectrumParams = {
  scale: number;
  angle: number;
  spreadBlend: number;
  swell: number;
  alpha: number;
  peakOmega: number;
  gamma: number;
  shortWavesFade: number;
};

function jonswapAlpha(g: number, fetch: number, windSpeed: number): number {
  return 0.076 * Math.pow((g * fetch) / windSpeed / windSpeed, -0.22);
}

function jonswapPeakOmega(g: number, fetch: number, windSpeed: number): number {
  return 22 * Math.pow((windSpeed * fetch) / g / g, -0.33);
}

function resolveSpectrum(display: DisplaySpectrumSettings): SpectrumParams {
  return {
    scale: display.scale,
    angle: (display.windDirection / 180) * Math.PI,
    spreadBlend: display.spreadBlend,
    swell: Math.max(0.01, Math.min(1, display.swell)),
    alpha: jonswapAlpha(G, display.fetch, display.windSpeed),
    peakOmega: jonswapPeakOmega(G, display.fetch, display.windSpeed),
    gamma: display.peakEnhancement,
    shortWavesFade: display.shortWavesFade,
  };
}

// Dispersion relation (frequency.wgsl) — deep/shallow water phase speed.
function dispersion(k: number, g: number, depth: number): number {
  return Math.sqrt(g * k * Math.tanh(Math.min(k * depth, 20)));
}

// d(omega)/dk (frequencyDerivative.wgsl).
function dispersionDerivative(k: number, g: number, depth: number): number {
  const th = Math.tanh(Math.min(k * depth, 20));
  const ch = Math.cosh(k * depth);
  return (g * ((depth * k) / (ch * ch) + th)) / dispersion(k, g, depth) / 2;
}

// Mitsuyasu-type normalisation for the cosine-2s directional spread.
function normalisationFactor(s: number): number {
  const s2 = s * s;
  const s3 = s2 * s;
  const s4 = s3 * s;
  if (s < 5) return -0.000564 * s4 + 0.00776 * s3 - 0.044 * s2 + 0.192 * s + 0.163;
  return -4.8e-8 * s4 + 1.07e-5 * s3 - 9.53e-4 * s2 + 5.9e-2 * s + 3.93e-1;
}

function cosine2s(theta: number, s: number): number {
  return normalisationFactor(s) * Math.pow(Math.abs(Math.cos(0.5 * theta)), 2 * s);
}

function spreadPower(omega: number, peakOmega: number): number {
  if (omega > peakOmega) return 9.77 * Math.pow(Math.abs(omega / peakOmega), -2.5);
  return 6.97 * Math.pow(Math.abs(omega / peakOmega), 5);
}

// Directional spreading function (directionSpectrum.wgsl).
function directionSpectrum(theta: number, omega: number, pars: SpectrumParams): number {
  const s =
    spreadPower(omega, pars.peakOmega) +
    16 * Math.tanh(Math.min(omega / pars.peakOmega, 20)) * pars.swell * pars.swell;
  const cosSpread = (2 / Math.PI) * Math.cos(theta) * Math.cos(theta);
  const cos2s = cosine2s(theta - pars.angle, s);
  return cosSpread + (cos2s - cosSpread) * pars.spreadBlend; // mix(cosSpread, cos2s, spreadBlend)
}

// TMA (shallow-water) correction (TMACorrection.wgsl).
function tmaCorrection(omega: number, g: number, depth: number): number {
  const omegaH = omega * Math.sqrt(depth / g);
  if (omegaH <= 1) return 0.5 * omegaH * omegaH;
  if (omegaH < 2) return 1 - 0.5 * (2 - omegaH) * (2 - omegaH);
  return 1;
}

// JONSWAP frequency spectrum (JONSWAP.wgsl).
function jonswap(omega: number, g: number, depth: number, pars: SpectrumParams): number {
  const sigma = omega <= pars.peakOmega ? 0.07 : 0.09;
  const r = Math.exp(
    (-(omega - pars.peakOmega) * (omega - pars.peakOmega)) /
      (2 * sigma * sigma * pars.peakOmega * pars.peakOmega),
  );
  const oneOverOmega = 1 / omega;
  const peakOmegaOverOmega = pars.peakOmega / omega;
  return (
    pars.scale *
    tmaCorrection(omega, g, depth) *
    pars.alpha *
    g *
    g *
    Math.pow(oneOverOmega, 5) *
    Math.exp(-1.25 * Math.pow(peakOmegaOverOmega, 4)) *
    Math.pow(Math.abs(pars.gamma), r)
  );
}

// Fades out wavelengths shorter than the simulated scale (shortWavesFade.wgsl).
function shortWavesFade(kLength: number, pars: SpectrumParams): number {
  return Math.exp(-pars.shortWavesFade * pars.shortWavesFade * kLength * kLength);
}

export type OceanWaveComponent = {
  kx: number;
  kz: number;
  amplitude: number;
  omega: number;
  phase: number;
};

// Every sampled component's peak-to-peak contribution is normalized so the
// set's total amplitude lands near this reference — matching the ~2.6×amp
// peak the existing analytic wave modes use, so the shared VÅG (amplitude)
// dial stays meaningful across all three waveform types.
const REFERENCE_TOTAL_AMPLITUDE = 2.6;

// Samples the JONSWAP local+swell spectrum at a stochastic set of wave
// vectors spanning the three OceanDemo cascade length scales, producing a
// fixed list of cosine components: height(x,z,t) = Σ A·cos(k·[x,z] − ωt + φ).
// This is the direct-summation form of linear (Airy) wave theory the source
// repo's FFT accelerates — see the module header for the full derivation.
export function generateOceanWaveComponents(): OceanWaveComponent[] {
  const local = resolveSpectrum(LOCAL_SPECTRUM);
  const swell = resolveSpectrum(SWELL_SPECTRUM);

  const components: OceanWaveComponent[] = [];

  let kMin = 0.0001;
  for (let c = 0; c < CASCADE_LENGTH_SCALES.length; c++) {
    const isLast = c === CASCADE_LENGTH_SCALES.length - 1;
    // Same boundary rule as WavesGenerator.initializeCascades, but the last
    // (finest) cascade is capped instead of left unbounded — wavelengths
    // much shorter than the mesh's vertex spacing would just alias, and the
    // existing shader already layers high-frequency ripple sines on top.
    const kMax = isLast ? 40 : ((2 * Math.PI) / CASCADE_LENGTH_SCALES[c + 1]) * 6;
    const count = CASCADE_COMPONENT_COUNTS[c];
    const lnMin = Math.log(kMin);
    const lnMax = Math.log(kMax);

    for (let j = 0; j < count; j++) {
      // Stratified sample in log(k) (one per bin) with a fully random
      // direction — the spectrum's directional weighting (not the sampling
      // pattern) is what shapes the result toward the wind/swell direction.
      const lnK = lnMin + ((j + Math.random()) / count) * (lnMax - lnMin);
      const k = Math.exp(lnK);
      const theta = Math.random() * Math.PI * 2;

      const omega = dispersion(k, G, DEPTH);
      const dOmegaDk = dispersionDerivative(k, G, DEPTH);

      const spectrum =
        jonswap(omega, G, DEPTH, local) *
          directionSpectrum(theta, omega, local) *
          shortWavesFade(k, local) +
        jonswap(omega, G, DEPTH, swell) *
          directionSpectrum(theta, omega, swell) *
          shortWavesFade(k, swell);

      // Monte-Carlo area element for a sample stratified in log(k) but
      // random in theta over the full circle: dkx·dkz = k·dk·dθ, with
      // dk = k·d(ln k), integrated over θ∈[0,2π) and divided by the number
      // of radial strata sharing that ln(k) range.
      const areaElement = ((2 * Math.PI * k * k) / count) * (lnMax - lnMin);
      const variance = Math.max(0, (2 * spectrum * Math.abs(dOmegaDk) * areaElement) / k);
      const amplitude = Math.sqrt(variance);

      components.push({
        kx: k * Math.cos(theta),
        kz: k * Math.sin(theta),
        amplitude,
        omega,
        phase: Math.random() * Math.PI * 2,
      });
    }
    kMin = kMax;
  }

  const total = components.reduce((sum, c) => sum + c.amplitude, 0) || 1;
  const scale = REFERENCE_TOTAL_AMPLITUDE / total;
  for (const c of components) c.amplitude *= scale;

  return components;
}

// Packs components into the flat arrays the vertex shader's uniform arrays
// expect: vec4(kx, kz, amplitude, omega) per component, plus a parallel
// phase array (kept separate since GLSL vec4 arrays here already carry 4
// floats each).
export function packOceanWaveComponents(components: OceanWaveComponent[]): {
  wave: Float32Array;
  phase: Float32Array;
} {
  const wave = new Float32Array(components.length * 4);
  const phase = new Float32Array(components.length);
  components.forEach((c, i) => {
    wave[i * 4 + 0] = c.kx;
    wave[i * 4 + 1] = c.kz;
    wave[i * 4 + 2] = c.amplitude;
    wave[i * 4 + 3] = c.omega;
    phase[i] = c.phase;
  });
  return { wave, phase };
}

// JS-side mirror of the vertex shader's fftHeight() — used by the camera's
// wave-following physics so it floats on this waveform exactly like the
// analytic modes it sits alongside (see waveHeight() in routes/index.tsx).
export function sampleOceanWaveHeight(
  components: OceanWaveComponent[],
  x: number,
  z: number,
  t: number,
): number {
  let h = 0;
  for (const c of components) {
    h += c.amplitude * Math.cos(c.kx * x + c.kz * z - c.omega * t + c.phase);
  }
  return h;
}
