// VIND: any number of winds, each with its own direction, speed and
// gustiness, added from the VIND button in the main view. Their sum is the
// live wind (WindField below). Optionally it steers the wave direction,
// adds to the floating body's sway and pushes a wind-driven surface current,
// and it drives the wind sound (lib/windSound.ts).
//
// Direction convention: `bearing` is where the wind blows TOWARD, in the same
// compass-bearing convention as waveDir and STRÖM/SVAJ (x = sin, z = cos, see
// worldXZBearing in settingsShared). The UI shows the "from" side as well.
//
// Other effects (rain, snow) can read the live wind with getWindVector() /
// getWindAt() without touching the settings.

export type WindSource = {
  id: string;
  /** Degrees, 0..360: where the wind blows toward (x = sin, z = cos). */
  bearing: number;
  /** m/s at 10 m above the water. */
  speed: number;
  /** 0..1: how much the speed varies in gusts. */
  gust: number;
  on: boolean;
};

export const WIND_MAX_SOURCES = 8;
export const WIND_MAX_SPEED = 40;
// Height (m) where a wind's nominal speed applies, as in weather reports.
export const WIND_REF_HEIGHT = 10;

export function newWindId() {
  return `w${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function makeWind(bearing: number, speed = 8): WindSource {
  return {
    id: newWindId(),
    bearing: ((bearing % 360) + 360) % 360,
    speed,
    gust: 0.35,
    on: true,
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const num = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

/** Keeps whatever a save, preset or share link holds to a sane wind list. */
export function sanitizeWinds(raw: unknown): WindSource[] {
  if (!Array.isArray(raw)) return [];
  const out: WindSource[] = [];
  for (const w of raw) {
    if (!w || typeof w !== "object") continue;
    const o = w as Record<string, unknown>;
    out.push({
      id: typeof o.id === "string" && o.id ? o.id : newWindId(),
      bearing: ((num(o.bearing, 0) % 360) + 360) % 360,
      speed: clamp(num(o.speed, 8), 0, WIND_MAX_SPEED),
      gust: clamp(num(o.gust, 0.35), 0, 1),
      on: o.on !== false,
    });
    if (out.length >= WIND_MAX_SOURCES) break;
  }
  return out;
}

/** Bearing (deg) the wind comes FROM, for display. */
export function windFromBearing(bearing: number) {
  return (((bearing + 180) % 360) + 360) % 360;
}

const COMPASS_KEYS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const;
export type CompassKey = (typeof COMPASS_KEYS)[number];
export function compassKey(bearing: number): CompassKey {
  const i = Math.round((((bearing % 360) + 360) % 360) / 45) % 8;
  return COMPASS_KEYS[i];
}

/**
 * Wind speed factor with height above the water (power law, open sea):
 * 1 at WIND_REF_HEIGHT, ~0.7 at the surface, ~2 at 1 km.
 */
export function heightFactor(heightAboveWater: number) {
  const h = clamp(heightAboveWater, 1, 3000);
  return Math.pow(h / WIND_REF_HEIGHT, 0.16);
}

// Smooth value noise in 0..1 — a few incommensurate sines, so gusts swell
// and ease rather than jitter.
function gustNoise(t: number, seed: number) {
  const a = Math.sin(t * 0.31 + seed * 1.7);
  const b = Math.sin(t * 0.73 + seed * 4.1);
  const c = Math.sin(t * 1.9 + seed * 2.3);
  return (a * 0.5 + b * 0.33 + c * 0.17) * 0.5 + 0.5;
}

function seedOf(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 1000) / 37;
}

export type WindVector = {
  /** m/s along world x / z at WIND_REF_HEIGHT, gusts included. */
  x: number;
  z: number;
  speed: number;
  /** Where the wind blows toward (deg, x = sin, z = cos). */
  bearing: number;
  /** 0..1, how gusty the current moment is relative to the mean. */
  gust: number;
};

const ZERO: WindVector = { x: 0, z: 0, speed: 0, bearing: 0, gust: 0 };
let live: WindVector = ZERO;

/** The live combined wind at WIND_REF_HEIGHT (zero when no winds are on). */
export function getWindVector(): Readonly<WindVector> {
  return live;
}

/** The live combined wind scaled to a height above the water. */
export function getWindAt(heightAboveWater: number): { x: number; z: number; speed: number } {
  const f = heightFactor(heightAboveWater);
  return { x: live.x * f, z: live.z * f, speed: live.speed * f };
}

/** Sum of the winds (no gusts) — what the UI shows as the resultant. */
export function sumWinds(winds: readonly WindSource[]): WindVector {
  let x = 0,
    z = 0;
  for (const w of winds) {
    if (!w.on || w.speed <= 0) continue;
    const r = (w.bearing * Math.PI) / 180;
    x += Math.sin(r) * w.speed;
    z += Math.cos(r) * w.speed;
  }
  const speed = Math.hypot(x, z);
  return {
    x,
    z,
    speed,
    bearing: speed > 1e-6 ? ((Math.atan2(x, z) * 180) / Math.PI + 360) % 360 : 0,
    gust: 0,
  };
}

/**
 * Wave direction (radians) steered toward the wind: a vector blend of the
 * wave dial's own direction and the wind's, weighted by `strength` and by how
 * strong the wind is (a light breeze barely turns the swell).
 */
export function steerWaveDir(waveDirDeg: number, wind: WindVector, strength: number) {
  const base = (waveDirDeg * Math.PI) / 180;
  if (strength <= 0 || wind.speed < 0.05) return base;
  const w = clamp(strength, 0, 1) * clamp(wind.speed / 6, 0, 1);
  const wr = (wind.bearing * Math.PI) / 180;
  const x = Math.sin(base) * (1 - w) + Math.sin(wr) * w;
  const z = Math.cos(base) * (1 - w) + Math.cos(wr) * w;
  if (Math.hypot(x, z) < 1e-4) return wr;
  // Keep the result on the same branch as `base` so the shortest-path
  // easing of uDir never spins the ocean.
  const out = Math.atan2(x, z);
  return base + Math.atan2(Math.sin(out - base), Math.cos(out - base));
}

/**
 * Per-frame wind state: eases toggles and slider moves, adds each wind's
 * gusts, publishes the live vector and yields the sway and current offsets.
 */
export class WindField {
  // Eased resultant, so adding/removing a wind or moving a slider swells
  // in rather than snapping.
  private ex = 0;
  private ez = 0;
  // Eased effect strengths.
  private swayK = 0;
  private currentK = 0;
  private t = 0;
  wind: WindVector = ZERO;

  update(dt: number, winds: readonly WindSource[]) {
    this.t += dt;
    let x = 0,
      z = 0,
      meanSpeed = 0;
    for (const w of winds) {
      if (!w.on || w.speed <= 0) continue;
      const g = clamp(w.gust, 0, 1);
      const n = gustNoise(this.t, seedOf(w.id));
      // Gusts both swell (up to +60 %) and lull (down to -40 %).
      const s = w.speed * (1 + g * (n * 1.0 - 0.4));
      // Gusts also veer the direction a little.
      const veer = g * 12 * (gustNoise(this.t * 0.7, seedOf(w.id) + 9) - 0.5);
      const r = ((w.bearing + veer) * Math.PI) / 180;
      x += Math.sin(r) * s;
      z += Math.cos(r) * s;
      meanSpeed += w.speed;
    }
    const k = 1 - Math.exp(-dt / 0.8);
    this.ex += (x - this.ex) * k;
    this.ez += (z - this.ez) * k;
    const speed = Math.hypot(this.ex, this.ez);
    this.wind = {
      x: this.ex,
      z: this.ez,
      speed,
      bearing: speed > 1e-6 ? ((Math.atan2(this.ex, this.ez) * 180) / Math.PI + 360) % 360 : 0,
      gust: meanSpeed > 0 ? clamp(speed / meanSpeed - 0.6, 0, 1) : 0,
    };
    live = this.wind;
    return this.wind;
  }

  /**
   * Sideways lean (m) of a floating body pushed by the wind: a steady
   * downwind offset plus a gust-driven breathing on top. Fed into the sway
   * spring's target, so it keeps the same floating inertia.
   */
  sway(dt: number, on: boolean, strength: number) {
    this.swayK += ((on ? clamp(strength, 0, 4) : 0) - this.swayK) * (1 - Math.exp(-dt / 1.2));
    if (this.swayK < 1e-4) return { x: 0, z: 0 };
    const breathe = 0.75 + 0.5 * gustNoise(this.t * 1.6, 3.3);
    const m = 0.12 * this.swayK * breathe;
    return { x: this.wind.x * m, z: this.wind.z * m };
  }

  /**
   * Wind-driven surface current: ~3.5 % of the wind speed, downwind, as a
   * displacement (m) for this frame.
   */
  current(dt: number, on: boolean, strength: number) {
    this.currentK += ((on ? clamp(strength, 0, 4) : 0) - this.currentK) * (1 - Math.exp(-dt / 1.5));
    if (this.currentK < 1e-4) return { dx: 0, dz: 0 };
    const m = 0.035 * this.currentK * dt;
    return { dx: this.wind.x * m, dz: this.wind.z * m };
  }

  reset() {
    this.ex = this.ez = 0;
    this.wind = ZERO;
    live = ZERO;
  }
}

// ---------------------------------------------------------------------------
// Sound mix: the pure part of the wind sound (lib/windSound.ts plays it).

export type WindHearing = {
  /** Apparent wind speed at the ears (m/s), own motion included. */
  apparent: number;
  /** -1 (wind from behind) .. 1 (wind straight into the face). */
  facing: number;
  /** -1 (wind on the left ear) .. 1 (right ear). */
  pan: number;
};

/**
 * What the ears feel: the wind at this height minus the camera's own
 * velocity (running into the wind makes it louder, running with it
 * quieter), and which side it comes from relative to the look direction.
 */
export function hearWind(
  wind: { x: number; z: number },
  camVel: { x: number; z: number },
  forward: { x: number; z: number },
  breeze: number,
): WindHearing {
  // Air moving past the ears, in the camera's frame.
  const ax = wind.x - camVel.x;
  const az = wind.z - camVel.z;
  const directional = Math.hypot(ax, az);
  const apparent = Math.hypot(directional, breeze);
  if (directional < 1e-4) return { apparent, facing: 0, pan: 0 };
  // Direction the air comes FROM, as a unit vector.
  const fx = -ax / directional;
  const fz = -az / directional;
  const fl = Math.hypot(forward.x, forward.z) || 1;
  const fwx = forward.x / fl,
    fwz = forward.z / fl;
  // Right = forward rotated -90° about y (matches padToWorldXZ's basis).
  const rx = -fwz,
    rz = fwx;
  const w = directional / Math.max(apparent, 1e-4);
  return {
    apparent,
    facing: (fx * fwx + fz * fwz) * w,
    pan: (fx * rx + fz * rz) * w,
  };
}

/**
 * HÖJDLJUD: how the soundscape changes with height above the water.
 * - water: gain multiplier for the ambient (underwater) water track — full
 *   in and right at the water, fading out as the camera rises.
 * - surface: level (0..1) of the broadband surf/air noise that takes over
 *   just above the water and itself fades away higher up.
 * - breeze: extra wind (m/s) that grows with altitude, so the high air is
 *   windy even with no winds added.
 */
export function altitudeMix(heightAboveWater: number) {
  const h = heightAboveWater;
  const ss = (a: number, b: number, x: number) => {
    const u = clamp((x - a) / (b - a), 0, 1);
    return u * u * (3 - 2 * u);
  };
  if (h <= 0) return { water: 1, surface: 0, breeze: 0 };
  return {
    water: 1 - ss(1.5, 30, h),
    surface: ss(0.5, 4, h) * (1 - ss(20, 160, h)),
    breeze: 16 * ss(15, 600, h),
  };
}
