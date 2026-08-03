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
//
// OceanDemo's own mesh is fine enough to resolve all three via a real IFFT;
// this port instead displaces a 600×600 plane with 320 segments (see the
// `geo` PlaneGeometry in routes/index.tsx), i.e. ~1.875m between vertices, so
// its Nyquist limit is only k ≈ π/1.875 ≈ 1.68 rad/m (wavelengths below
// ~3.75m). The original [250, 17, 5] scales pushed the mid/fine cascades'
// kMax up to ~7.5 and ~40 rad/m — far past that limit — so per-vertex
// sampling of those components aliased into uncorrelated noise instead of
// smooth chop, reading as a jagged, boiling surface rather than a wave.
// Scaled up so every cascade's kMax stays comfortably under the mesh's
// Nyquist limit — this is a mesh-resolution ceiling, not an artistic
// choice, so don't lower it further without also raising the plane's
// segment count.
const CASCADE_LENGTH_SCALES = [250, 90, 40];
// How many discrete wave components to spend on each cascade (sums to
// FFT_WAVE_COUNT). Weighted toward the swell cascade since it dominates the
// visible silhouette; the fine cascade mostly adds sparkle.
const CASCADE_COMPONENT_COUNTS = [14, 10, 8];
export const FFT_WAVE_COUNT = CASCADE_COMPONENT_COUNTS.reduce((a, b) => a + b, 0);
// Extra per-cascade damping applied on top of the JONSWAP density itself.
// The analytic "regelbunden" wave keeps its big swell (~2.6×amp) completely
// separate from its high-frequency ripple terms (a fixed, tiny ~0.17 total
// that doesn't scale with amp at all), so raising VÅG only makes the big
// rollers taller, never the chop faster/steeper. The FFT cascades all share
// one amplitude budget, so without this the mid/fine cascades' steeper,
// higher-omega components end up carrying a disproportionate share of the
// visible motion — many short, crossing crests reading as agitated chop
// ("boiling") instead of calm swell. Damping them down brings the realistic
// waveform's tempo and height in line with the other two modes at the same
// VÅG/TEMPO dial values.
const CASCADE_AMPLITUDE_WEIGHT = [1, 0.15, 0.04];

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

// Deep-water approximation (ignoring the tanh(k·depth) shoaling correction,
// negligible at these low k and DEPTH) of the wavenumber where a spectrum's
// JONSWAP density actually peaks — used only to pick where cascade sampling
// should concentrate, not for the wave physics itself (which still uses the
// exact dispersion() relation).
function spectrumPeakK(pars: SpectrumParams): number {
  return (pars.peakOmega * pars.peakOmega) / G;
}

// Deterministic PRNG (mulberry32) so the FFT wave modes can be generated
// with a fixed, reproducible component set — same wave every load — instead
// of the true Math.random() each generate*WaveComponents() call otherwise
// uses. See SLUMPA VÅGOR in routes/index.tsx: off (default) passes a seeded
// instance of this so the wave is constant session to session; on passes
// Math.random() itself for genuine per-load variety.
export function createSeededRandom(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
export function generateOceanWaveComponents(random: () => number = Math.random): OceanWaveComponent[] {
  const local = resolveSpectrum(LOCAL_SPECTRUM);
  const swell = resolveSpectrum(SWELL_SPECTRUM);

  const components: OceanWaveComponent[] = [];

  // Sampling the swell cascade all the way down to a near-zero kMin spends
  // most of its stratified log(k) bins far below where the JONSWAP density
  // actually peaks — each still gets a full direction/phase/amplitude share
  // after renormalization, so the sum reads as a mix of many faint,
  // random-direction, mismatched-frequency terms rather than one coherent
  // swell, and the camera's buoyancy heave inherits that unevenness cycle to
  // cycle. Starting the band near the spectra's own peak wavenumber (deep-
  // water k ≈ ω²/g) concentrates every sampled component where the energy
  // actually is, so it reads as one much more coherent, evenly cycling swell.
  let kMin = 0.35 * Math.min(spectrumPeakK(local), spectrumPeakK(swell));
  for (let c = 0; c < CASCADE_LENGTH_SCALES.length; c++) {
    const isLast = c === CASCADE_LENGTH_SCALES.length - 1;
    // Same boundary rule as WavesGenerator.initializeCascades, but the last
    // (finest) cascade is capped instead of left unbounded — wavelengths
    // much shorter than the mesh's vertex spacing would just alias, and the
    // existing shader already layers high-frequency ripple sines on top.
    // Cap stays under the ~1.68 rad/m Nyquist limit of the 600m/320-segment
    // water plane (see the CASCADE_LENGTH_SCALES comment above).
    const kMax = isLast ? 1.4 : ((2 * Math.PI) / CASCADE_LENGTH_SCALES[c + 1]) * 6;
    const count = CASCADE_COMPONENT_COUNTS[c];
    const lnMin = Math.log(kMin);
    const lnMax = Math.log(kMax);

    for (let j = 0; j < count; j++) {
      // Stratified sample in log(k) (one per bin).
      const lnK = lnMin + ((j + random()) / count) * (lnMax - lnMin);
      const k = Math.exp(lnK);
      const omega = dispersion(k, G, DEPTH);
      const dOmegaDk = dispersionDerivative(k, G, DEPTH);

      const jLocal = jonswap(omega, G, DEPTH, local);
      const jSwell = jonswap(omega, G, DEPTH, swell);
      // Direction was previously sampled fully at random (0..2π), relying
      // only on directionSpectrum()'s amplitude weighting below to suppress
      // off-axis draws. A real FFT bins thousands of directions, so that
      // washes out statistically; this sum-of-sinusoids realization only
      // has `count` samples per cascade, so an unlucky handful of
      // moderately-weighted off-axis draws reads as chaotic crossing chop
      // ("boiling") instead of one coherent swell — worse still after
      // narrowing the k band above concentrated more samples into this
      // cascade's now non-negligible range. Centering each draw on whichever
      // spectrum's own frequency density dominates at this k (still jittered
      // within a wide-ish arc, not forced onto a single ray) keeps samples
      // clustered near the two physically real directions — local wind sea
      // and distant swell — instead of scattering across the whole circle.
      const centerAngle = jLocal > jSwell ? local.angle : swell.angle;
      const directionalSpread = (50 * Math.PI) / 180;
      const theta = centerAngle + (random() * 2 - 1) * directionalSpread;

      const spectrum =
        jLocal * directionSpectrum(theta, omega, local) * shortWavesFade(k, local) +
        jSwell * directionSpectrum(theta, omega, swell) * shortWavesFade(k, swell);

      // Monte-Carlo area element, still using the full-circle dkx·dkz =
      // k·dk·dθ normalization (dk = k·d(ln k), θ∈[0,2π)) even though theta is
      // now drawn from a narrower arc above — the area element only sets each
      // sample's *relative* weight before the total gets renormalized to
      // REFERENCE_TOTAL_AMPLITUDE below, so this under-counts the sampled
      // arc's true share of the circle and effectively over-weights it,
      // which is exactly the intended effect (concentrate energy toward the
      // two coherent directions instead of spreading it "fairly" over 360°).
      const areaElement = ((2 * Math.PI * k * k) / count) * (lnMax - lnMin);
      const variance = Math.max(0, (2 * spectrum * Math.abs(dOmegaDk) * areaElement) / k);
      const amplitude = Math.sqrt(variance) * CASCADE_AMPLITUDE_WEIGHT[c];

      components.push({
        kx: k * Math.cos(theta),
        kz: k * Math.sin(theta),
        amplitude,
        omega,
        phase: random() * Math.PI * 2,
      });
    }
    kMin = kMax;
  }

  const total = components.reduce((sum, c) => sum + c.amplitude, 0) || 1;
  const scale = REFERENCE_TOTAL_AMPLITUDE / total;
  for (const c of components) c.amplitude *= scale;

  return components;
}

// "Dying wave" — a single long, decaying swell train, the classic
// surf-forecasting "dying swell" left over once the wind that raised it has
// moved on: no local wind-sea chop, just one smooth, long-period roller.
// Reuses the same JONSWAP direct-summation machinery as
// generateOceanWaveComponents() above, but sampled from only the swell-type
// spectrum over a single, very-long-wavelength band — nowhere near the
// water plane's Nyquist limit (see the CASCADE_LENGTH_SCALES comment above),
// so it stays smooth by construction rather than needing cascade damping.
const DYING_SWELL_SPECTRUM: DisplaySpectrumSettings = {
  scale: 0.5,
  windSpeed: 3,
  windDirection: 0,
  fetch: 800000,
  spreadBlend: 1,
  swell: 1,
  peakEnhancement: 6,
  shortWavesFade: 0.01,
};

// Wavelengths of ~52m and up — long enough that even several of these
// summed together read as one slow, rolling swell rather than chop.
const DYING_WAVE_KMAX = 0.12;
export const DYING_WAVE_COUNT = 10;

export function generateDyingWaveComponents(random: () => number = Math.random): OceanWaveComponent[] {
  const pars = resolveSpectrum(DYING_SWELL_SPECTRUM);
  const components: OceanWaveComponent[] = [];

  // Same reasoning as generateOceanWaveComponents() above: start the band
  // near the spectrum's own peak wavenumber instead of a near-zero floor, so
  // every sampled component clusters around the same frequency/wavelength
  // instead of spending bins on faint, mismatched, near-DC terms — reads as
  // one coherent, evenly cycling swell rather than an uneven beat.
  const kMin = 0.35 * spectrumPeakK(pars);
  const kMax = DYING_WAVE_KMAX;
  const lnMin = Math.log(kMin);
  const lnMax = Math.log(kMax);

  for (let j = 0; j < DYING_WAVE_COUNT; j++) {
    const lnK = lnMin + ((j + random()) / DYING_WAVE_COUNT) * (lnMax - lnMin);
    const k = Math.exp(lnK);
    const omega = dispersion(k, G, DEPTH);
    const dOmegaDk = dispersionDerivative(k, G, DEPTH);

    // Same reasoning as generateOceanWaveComponents(): jitter direction
    // within a wide-ish arc around the spectrum's own angle instead of
    // drawing fully at random, so the handful of samples read as one
    // coherent swell train instead of chop crossing in from everywhere.
    const directionalSpread = (50 * Math.PI) / 180;
    const theta = pars.angle + (random() * 2 - 1) * directionalSpread;

    const spectrum = jonswap(omega, G, DEPTH, pars) * directionSpectrum(theta, omega, pars) * shortWavesFade(k, pars);

    const areaElement = ((2 * Math.PI * k * k) / DYING_WAVE_COUNT) * (lnMax - lnMin);
    const variance = Math.max(0, (2 * spectrum * Math.abs(dOmegaDk) * areaElement) / k);
    const amplitude = Math.sqrt(variance);

    components.push({
      kx: k * Math.cos(theta),
      kz: k * Math.sin(theta),
      amplitude,
      omega,
      phase: random() * Math.PI * 2,
    });
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

// FREKVENS (see waveFreq in routes/index.tsx) multiplies every component's
// wavenumber, so a component generated safely below the water plane's ~1.68
// rad/m Nyquist limit (see the CASCADE_LENGTH_SCALES comment above) can be
// pushed straight past it and alias into uncorrelated noise — the same
// "boiling surface" failure the cascade scales were raised to avoid. Fade
// such components out instead. The fade only starts above the generators'
// own kMax (DYING_WAVE_KMAX / the last cascade's 1.4 cap), so at FREKVENS = 1
// nothing is attenuated and the waveform is bit-for-bit what it was before.
const K_ALIAS_FADE_START = 1.4;
const K_ALIAS_FADE_END = 1.75;

export function kAliasFade(k: number): number {
  const v = Math.max(
    0,
    Math.min(1, (k - K_ALIAS_FADE_START) / (K_ALIAS_FADE_END - K_ALIAS_FADE_START)),
  );
  return 1 - v * v * (3 - 2 * v);
}

// The two fade edges, injected into the vertex shader so its fftHeight()/
// dyingHeight() apply the exact same attenuation as kAliasFade() above.
export const K_ALIAS_FADE_GLSL = {
  start: K_ALIAS_FADE_START.toFixed(2),
  end: K_ALIAS_FADE_END.toFixed(2),
};

// JS-side mirror of the vertex shader's fftHeight() — used by the camera's
// wave-following physics so it floats on this waveform exactly like the
// analytic modes it sits alongside (see waveHeight() in routes/index.tsx).
// `freq` is the FREKVENS multiplier on the spatial wavenumbers only: crests
// pack closer together without the temporal rate (omega, driven by TEMPO)
// changing, matching how uPeriod already works for the analytic modes.
export function sampleOceanWaveHeight(
  components: OceanWaveComponent[],
  x: number,
  z: number,
  t: number,
  freq: number = 1,
): number {
  let h = 0;
  for (const c of components) {
    const kx = c.kx * freq;
    const kz = c.kz * freq;
    const fade = freq === 1 ? 1 : kAliasFade(Math.hypot(kx, kz));
    h += c.amplitude * fade * Math.cos(kx * x + kz * z - c.omega * t + c.phase);
  }
  return h;
}
