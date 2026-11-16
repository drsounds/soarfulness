import { useSyncExternalStore } from "react";

// HIMMELSLJUS: how the sky and the sun look and light the scene.
//
//  - SOLTONING (sunrise/sunset shading of the backdrop): its color, strength,
//    how long the golden hour lasts and how much of the skybox it covers.
//  - Skybox horizontal rotation (on top of each skybox's own manifest
//    rotationY).
//  - An optional sun drawn into the skybox, at the time-of-day sun position.
//  - How strongly the sun and the sky light a loaded .glb scene.
//
// The settings component (components/SkyLookSettings.tsx) edits this store
// and the render loop reads it every frame with getSkyLook(), so both stay
// self-contained. It's saved as the `skyLook` field of the main settings
// (see the store below), so bath links, presets and states include it.

export const SUN_TINT_COLOR_MODES = ["sun", "sky", "custom"] as const;
export type SunTintColorMode = (typeof SUN_TINT_COLOR_MODES)[number];

export type SkyLook = {
  /** SOLTONING strength, 1 = the original look. */
  tintStrength: number;
  /** Golden-hour window: how far (in sun elevation, 0..1) from the horizon
   * the shading reaches before it has faded out. Bigger = lasts longer. */
  tintWidth: number;
  /** 0 = shade toward the sun and the horizon only (the original look),
   * 1 = shade the whole skybox evenly. */
  tintSpread: number;
  /** Where the shading's color comes from: the time-of-day sun color, the
   * backdrop's own horizon color, or tintColor. */
  tintColorMode: SunTintColorMode;
  tintColor: string;
  /** Extra horizontal rotation of the skybox, degrees. */
  rotationDeg: number;
  /** SOL I HIMLEN: draw the sun into the skybox. */
  sunDiscOn: boolean;
  /** Angular diameter of the sun disc, degrees. */
  sunDiscSize: number;
  /** Halo around the disc, 0..2. */
  sunDiscGlow: number;
  /** How strongly the sun lights a loaded scene, 1 = default. */
  sceneSunLight: number;
  /** How strongly the sky (ambient + reflections) lights it, 1 = default. */
  sceneSkyLight: number;
};

export const SKY_LOOK_DEFAULTS: SkyLook = {
  tintStrength: 1,
  tintWidth: 0.32,
  tintSpread: 0,
  tintColorMode: "sun",
  tintColor: "#ff9a5c",
  rotationDeg: 0,
  sunDiscOn: false,
  sunDiscSize: 2.5,
  sunDiscGlow: 0.6,
  sceneSunLight: 1,
  sceneSkyLight: 1,
};

const HEX = /^#[0-9a-f]{6}$/i;
const num = (v: unknown, d: number, lo: number, hi: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;

export function sanitizeSkyLook(raw: unknown): SkyLook {
  const d = SKY_LOOK_DEFAULTS;
  if (!raw || typeof raw !== "object") return { ...d };
  const r = raw as Record<string, unknown>;
  return {
    tintStrength: num(r.tintStrength, d.tintStrength, 0, 10),
    tintWidth: num(r.tintWidth, d.tintWidth, 0.02, 2),
    tintSpread: num(r.tintSpread, d.tintSpread, 0, 1),
    tintColorMode: SUN_TINT_COLOR_MODES.includes(r.tintColorMode as SunTintColorMode)
      ? (r.tintColorMode as SunTintColorMode)
      : d.tintColorMode,
    tintColor: typeof r.tintColor === "string" && HEX.test(r.tintColor) ? r.tintColor : d.tintColor,
    rotationDeg: num(r.rotationDeg, d.rotationDeg, -100000, 100000),
    sunDiscOn: typeof r.sunDiscOn === "boolean" ? r.sunDiscOn : d.sunDiscOn,
    sunDiscSize: num(r.sunDiscSize, d.sunDiscSize, 0.05, 90),
    sunDiscGlow: num(r.sunDiscGlow, d.sunDiscGlow, 0, 10),
    sceneSunLight: num(r.sceneSunLight, d.sceneSunLight, 0, 20),
    sceneSkyLight: num(r.sceneSkyLight, d.sceneSkyLight, 0, 20),
  };
}

// ---------------------------------------------------------------------------
// Math shared by the render loop.

type Rgb = [number, number, number];

/** Sun elevation (-1..1) for the TIMEOFDAY dial (0 = midnight, 0.5 = noon). */
function sunElevation(t: number): number {
  return -Math.cos(t * Math.PI * 2);
}

/** SOLTONING: how strongly sunrise/sunset shades the backdrop (0..1) —
 * peaks with the sun just at the horizon and fades out `width` (in sun
 * elevation) above or below it. width 0.32 is the original window. */
export function goldenHourAmount(t: number, width = SKY_LOOK_DEFAULTS.tintWidth): number {
  const elev = sunElevation(t);
  const x = Math.min(1, Math.max(0, 1 - Math.abs(elev - 0.03) / Math.max(0.02, width)));
  return x * x * (3 - 2 * x);
}

export function hexToRgb01(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Scales a color so its brightest channel is 1 (black → white). */
export function normalizeRgb(c: readonly number[]): Rgb {
  const m = Math.max(c[0], c[1], c[2]);
  if (m < 1e-4) return [1, 1, 1];
  return [c[0] / m, c[1] / m, c[2] / m];
}

/** The SOLTONING shade color (brightest channel 1). "sky" uses the
 * backdrop's own horizon color, pushed a little toward more saturation so a
 * pale sky still reads as a tint; falls back to the sun color until that
 * color is known. */
export function sunTintRgb(look: SkyLook, sun: readonly number[], skyHorizon: Rgb | null): Rgb {
  if (look.tintColorMode === "custom") return normalizeRgb(hexToRgb01(look.tintColor));
  if (look.tintColorMode === "sky" && skyHorizon) {
    const n = normalizeRgb(skyHorizon);
    const avg = (n[0] + n[1] + n[2]) / 3;
    return normalizeRgb(n.map((v) => Math.max(0, avg + (v - avg) * 1.6)));
  }
  return normalizeRgb(sun);
}

// Neutral (unshaded) dawn/dusk sky colors — what the time-of-day palette
// uses at sunrise/sunset in place of its built-in orange whenever a real
// backdrop is showing, so the water and fog only turn warm through
// SOLTONING (in the same color and amount as the backdrop itself).
export const NEUTRAL_TWILIGHT = {
  top: [0.22, 0.32, 0.55] as Rgb,
  bot: [0.42, 0.5, 0.64] as Rgb,
};

/** Average colors of a backdrop image: the upper sky and the band just
 * above the horizon (display 0..1 values). `equirect` images have the
 * horizon at half height; flat backdrop photos are sampled in the upper
 * part instead. Returns null if the image can't be read (not loaded yet,
 * or cross-origin). */
export function sampleSkyColors(
  image: CanvasImageSource | null | undefined,
  equirect: boolean,
): { top: Rgb; horizon: Rgb } | null {
  if (!image || typeof document === "undefined") return null;
  try {
    const w = 64;
    const h = 32;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    const avg = (r0: number, r1: number): Rgb => {
      const out: Rgb = [0, 0, 0];
      let n = 0;
      for (let y = Math.max(0, r0); y < Math.min(h, r1); y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          out[0] += data[i];
          out[1] += data[i + 1];
          out[2] += data[i + 2];
          n++;
        }
      }
      return n ? [out[0] / n / 255, out[1] / n / 255, out[2] / n / 255] : [0.5, 0.6, 0.7];
    };
    // Equirect: row 0 is straight up, row h/2 the horizon. Upper sky =
    // 25°–70° up, horizon band = 0°–12° up.
    return equirect
      ? { top: avg(4, 11), horizon: avg(14, 16) }
      : { top: avg(0, 8), horizon: avg(11, 16) };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Store. In memory only: routes/index.tsx seeds it from the saved settings
// (initSkyLook) and saves it back with them as the `skyLook` field, so bath
// links, presets and state files carry it like any other setting.

const listeners = new Set<() => void>();
let state: SkyLook = { ...SKY_LOOK_DEFAULTS };
let version = 0;

export function getSkyLook(): SkyLook {
  return state;
}

function emit() {
  version++;
  listeners.forEach((l) => l());
}

/** Seeds the store from saved settings without notifying anyone (runs while
 * the page component is first rendering). */
export function initSkyLook(raw: unknown) {
  state = sanitizeSkyLook(raw);
  version++;
}

export function setSkyLook(update: Partial<SkyLook> | ((s: SkyLook) => SkyLook)) {
  state = typeof update === "function" ? update(state) : { ...state, ...update };
  emit();
}

export function resetSkyLook() {
  setSkyLook({ ...SKY_LOOK_DEFAULTS });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getVersion = () => version;

/** Re-renders on any change. */
export function useSkyLook(): SkyLook {
  useSyncExternalStore(subscribe, getVersion, () => 0);
  return getSkyLook();
}
