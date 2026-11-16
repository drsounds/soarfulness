import { useSyncExternalStore } from "react";
import {
  EDGE_FILTER_DEFAULT,
  cloneEdgeFilter,
  sanitizeEdgeFilter,
  type EdgeFilter,
} from "@/lib/edgeSelect";

// LJUSSLINGOR: decorative string / festoon lights hung over the scene, the
// bulb counterpart of NEON (which outlines the loaded scene's edges).
//
// Everything about them lives here and in their own localStorage key, not in
// the big settings object in routes/index.tsx: the settings component
// (apps/string-lights/StringLightsPanel.tsx) edits this store, and the renderer
// (apps/string-lights/StringLightsFx.ts) reads it every frame. Strings are remembered
// per scene (keyed by sceneId, "__none__" without a scene), so each scene
// keeps its own decoration.
//
// Coordinates: a string's anchors are world x/z, with heights measured from
// the water surface, so a string stays above the water when its level moves.

export const STRING_LIGHTS_KEY = "aquafulness:stringLights:v1";
export const STRING_LIGHTS_NO_SCENE = "__none__";
export const STRING_LIGHTS_MAX_STRINGS = 12;
export const STRING_LIGHTS_MAX_BULBS = 300;
/** Hard ceiling for the real-light pool (LJUSKÄLLOR), across all strings. */
export const STRING_LIGHTS_MAX_EMITTERS = 8;

export const STRING_LIGHT_CURVES = ["catenary", "parabola", "festoon", "straight"] as const;
export type StringLightCurve = (typeof STRING_LIGHT_CURVES)[number];

export const STRING_LIGHT_BULBS = ["globe", "fairy", "c9", "lantern", "star"] as const;
export type StringLightBulb = (typeof STRING_LIGHT_BULBS)[number];

export const STRING_LIGHT_PATTERNS = ["repeat", "mirror", "blocks", "gradient", "random"] as const;
export type StringLightPattern = (typeof STRING_LIGHT_PATTERNS)[number];

export const STRING_LIGHT_ANIMS = [
  "steady",
  "twinkle",
  "chase",
  "fade",
  "pulse",
  "alternate",
  "colorshift",
] as const;
export type StringLightAnim = (typeof STRING_LIGHT_ANIMS)[number];

export const STRING_LIGHT_PALETTES = {
  warm: ["#ffd9a0"],
  coolwhite: ["#eef6ff"],
  classic: ["#ff3b30", "#ffcc00", "#34c759", "#0a84ff", "#ff9500"],
  christmas: ["#ff2a2a", "#2ad45a"],
  candy: ["#ff3355", "#ffffff"],
  ocean: ["#29e0ff", "#2a6bff", "#18d6a8"],
  sunset: ["#ff8a3d", "#ff4f9a", "#a35cff"],
  neon: ["#ff2bd6", "#20f0ff"],
  midsummer: ["#ffe14a", "#4aa8ff", "#ffffff"],
  custom: [] as string[],
} as const satisfies Record<string, readonly string[]>;
export type StringLightPaletteId = keyof typeof STRING_LIGHT_PALETTES;
export const STRING_LIGHT_PALETTE_IDS = Object.keys(
  STRING_LIGHT_PALETTES,
) as StringLightPaletteId[];
export const STRING_LIGHT_MAX_CUSTOM_COLORS = 6;

export type StringLight = {
  id: string;
  /** Hidden strings keep their settings but aren't drawn. */
  visible: boolean;
  // Placement — anchor A at (x, heightA above water, z), anchor B `span`
  // metres away along `yaw` (degrees, 0 = +x), heightB above water.
  x: number;
  z: number;
  yaw: number;
  span: number;
  heightA: number;
  heightB: number;
  // Hanging curve.
  curve: StringLightCurve;
  /** Lowest point below the straight anchor line, metres. */
  sag: number;
  /** FESTOON: number of drapes between the anchors. */
  drapes: number;
  /** Wind sway, 0..1. */
  sway: number;
  wireColor: string;
  // Bulbs.
  bulbCount: number;
  bulbSize: number;
  bulbStyle: StringLightBulb;
  /** How far each bulb hangs below the wire, metres. */
  bulbDrop: number;
  brightness: number;
  glow: number;
  glowSize: number;
  // Colors.
  palette: StringLightPaletteId;
  customColors: string[];
  pattern: StringLightPattern;
  /** BLOCKS: bulbs per color block. */
  blockSize: number;
  // Animation.
  anim: StringLightAnim;
  speed: number;
  /** 0..1 how deep the animation dims bulbs (1 = all the way to dark). */
  animDepth: number;
  /** -1 or 1, for CHASE / COLOR SHIFT. */
  direction: number;
  /** Feed real point lights (shared, capped pool — see emitters). */
  emitLight: boolean;
};

/**
 * KANTLJUS: bulbs along the loaded scene's mesh edges (and, optionally,
 * imported .glb files), instead of / in addition to hanging strings. On by
 * default once LJUSSLINGOR itself is on; the edge filter picks which edges
 * (by direction and x/y/z range) — see lib/edgeSelect.ts.
 */
export type EdgeLights = Pick<
  StringLight,
  | "bulbSize"
  | "bulbStyle"
  | "brightness"
  | "glow"
  | "glowSize"
  | "palette"
  | "customColors"
  | "pattern"
  | "blockSize"
  | "anim"
  | "speed"
  | "animDepth"
  | "direction"
> & {
  on: boolean;
  /** Also light imported .glb files (EGNA SCENER scenes, DEKORATIONER). */
  includeImported: boolean;
  filter: EdgeFilter;
  /** Metres between bulbs along an edge. */
  spacing: number;
  /** Cap on bulbs over all edges; the spacing widens to stay under it. */
  maxBulbs: number;
  /** Only edges within this many metres of the camera get bulbs (0 = whole scene). */
  radius: number;
};

export const EDGE_LIGHTS_MAX_BULBS = 4000;

export const EDGE_LIGHTS_DEFAULTS: EdgeLights = {
  on: true,
  includeImported: true,
  filter: cloneEdgeFilter(EDGE_FILTER_DEFAULT),
  spacing: 0.5,
  maxBulbs: 800,
  radius: 40,
  bulbSize: 0.06,
  bulbStyle: "fairy",
  brightness: 1.2,
  glow: 0.8,
  glowSize: 1,
  palette: "warm",
  customColors: ["#ffb347", "#ff6f91", "#6fd3ff"],
  pattern: "repeat",
  blockSize: 3,
  anim: "twinkle",
  speed: 1,
  animDepth: 0.4,
  direction: 1,
};

export function sanitizeEdgeLights(raw: unknown): EdgeLights {
  const d = EDGE_LIGHTS_DEFAULTS;
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    on: typeof r.on === "boolean" ? r.on : d.on,
    includeImported: typeof r.includeImported === "boolean" ? r.includeImported : d.includeImported,
    filter: sanitizeEdgeFilter(r.filter),
    spacing: num(r.spacing, d.spacing, 0.05, 20),
    maxBulbs: int(r.maxBulbs, d.maxBulbs, 10, EDGE_LIGHTS_MAX_BULBS),
    radius: num(r.radius, d.radius, 0, 1000),
    bulbSize: num(r.bulbSize, d.bulbSize, 0.01, 0.6),
    bulbStyle: oneOf(STRING_LIGHT_BULBS, r.bulbStyle, d.bulbStyle),
    brightness: num(r.brightness, d.brightness, 0, 4),
    glow: num(r.glow, d.glow, 0, 3),
    glowSize: num(r.glowSize, d.glowSize, 0.2, 4),
    palette: oneOf(STRING_LIGHT_PALETTE_IDS, r.palette, d.palette),
    customColors: Array.isArray(r.customColors)
      ? r.customColors
          .filter((c): c is string => typeof c === "string" && HEX.test(c))
          .slice(0, STRING_LIGHT_MAX_CUSTOM_COLORS)
      : [...d.customColors],
    pattern: oneOf(STRING_LIGHT_PATTERNS, r.pattern, d.pattern),
    blockSize: int(r.blockSize, d.blockSize, 1, 20),
    anim: oneOf(STRING_LIGHT_ANIMS, r.anim, d.anim),
    speed: num(r.speed, d.speed, 0, 10),
    animDepth: num(r.animDepth, d.animDepth, 0, 1),
    direction: r.direction === -1 ? -1 : 1,
  };
}

export type StringLightsState = {
  on: boolean;
  edge: EdgeLights;
  /** LJUSKÄLLOR: how many real point lights all strings may use together. */
  emitters: number;
  /** Shrinks glow by day (1 = same as at night). */
  dayGlow: number;
  scenes: Record<string, StringLight[]>;
};

export const STRING_LIGHT_DEFAULTS: Omit<StringLight, "id" | "x" | "z" | "yaw"> = {
  visible: true,
  span: 10,
  heightA: 3.2,
  heightB: 3.2,
  curve: "catenary",
  sag: 0.9,
  drapes: 3,
  sway: 0.25,
  wireColor: "#1b1b1b",
  bulbCount: 24,
  bulbSize: 0.07,
  bulbStyle: "globe",
  bulbDrop: 0.08,
  brightness: 1.2,
  glow: 0.8,
  glowSize: 1,
  palette: "warm",
  customColors: ["#ffb347", "#ff6f91", "#6fd3ff"],
  pattern: "repeat",
  blockSize: 3,
  anim: "steady",
  speed: 1,
  animDepth: 0.6,
  direction: 1,
  emitLight: false,
};

export const STRING_LIGHTS_DEFAULT_STATE: StringLightsState = {
  on: false,
  edge: EDGE_LIGHTS_DEFAULTS,
  emitters: 4,
  dayGlow: 0.35,
  scenes: {},
};

// ---------------------------------------------------------------------------
// Sanitizing (localStorage and imported data are untrusted)

const HEX = /^#[0-9a-f]{6}$/i;
const num = (v: unknown, d: number, lo: number, hi: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
const int = (v: unknown, d: number, lo: number, hi: number) => Math.round(num(v, d, lo, hi));
const color = (v: unknown, d: string) => (typeof v === "string" && HEX.test(v) ? v : d);
function oneOf<T extends string>(list: readonly T[], v: unknown, d: T): T {
  return list.includes(v as T) ? (v as T) : d;
}

export function newStringLightId(): string {
  return `sl_${Math.random().toString(36).slice(2, 10)}`;
}

export function sanitizeStringLight(raw: unknown): StringLight | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const d = STRING_LIGHT_DEFAULTS;
  return {
    id: typeof r.id === "string" && r.id.length <= 40 ? r.id : newStringLightId(),
    visible: typeof r.visible === "boolean" ? r.visible : true,
    x: num(r.x, 0, -5000, 5000),
    z: num(r.z, 0, -5000, 5000),
    yaw: num(r.yaw, 0, -360, 360),
    span: num(r.span, d.span, 0.5, 200),
    heightA: num(r.heightA, d.heightA, -10, 60),
    heightB: num(r.heightB, d.heightB, -10, 60),
    curve: oneOf(STRING_LIGHT_CURVES, r.curve, d.curve),
    sag: num(r.sag, d.sag, 0, 30),
    drapes: int(r.drapes, d.drapes, 1, 12),
    sway: num(r.sway, d.sway, 0, 1),
    wireColor: color(r.wireColor, d.wireColor),
    bulbCount: int(r.bulbCount, d.bulbCount, 1, STRING_LIGHTS_MAX_BULBS),
    bulbSize: num(r.bulbSize, d.bulbSize, 0.01, 0.6),
    bulbStyle: oneOf(STRING_LIGHT_BULBS, r.bulbStyle, d.bulbStyle),
    bulbDrop: num(r.bulbDrop, d.bulbDrop, 0, 1),
    brightness: num(r.brightness, d.brightness, 0, 4),
    glow: num(r.glow, d.glow, 0, 3),
    glowSize: num(r.glowSize, d.glowSize, 0.2, 4),
    palette: oneOf(STRING_LIGHT_PALETTE_IDS, r.palette, d.palette),
    customColors: Array.isArray(r.customColors)
      ? r.customColors
          .filter((c): c is string => typeof c === "string" && HEX.test(c))
          .slice(0, STRING_LIGHT_MAX_CUSTOM_COLORS)
      : [...d.customColors],
    pattern: oneOf(STRING_LIGHT_PATTERNS, r.pattern, d.pattern),
    blockSize: int(r.blockSize, d.blockSize, 1, 20),
    anim: oneOf(STRING_LIGHT_ANIMS, r.anim, d.anim),
    speed: num(r.speed, d.speed, 0, 10),
    animDepth: num(r.animDepth, d.animDepth, 0, 1),
    direction: r.direction === -1 ? -1 : 1,
    emitLight: typeof r.emitLight === "boolean" ? r.emitLight : d.emitLight,
  };
}

export function sanitizeStringLightsState(raw: unknown): StringLightsState {
  const d = STRING_LIGHTS_DEFAULT_STATE;
  if (!raw || typeof raw !== "object") return { ...d, scenes: {} };
  const r = raw as Record<string, unknown>;
  const scenes: Record<string, StringLight[]> = {};
  if (r.scenes && typeof r.scenes === "object") {
    for (const [key, list] of Object.entries(r.scenes as Record<string, unknown>)) {
      if (!Array.isArray(list) || key.length > 200) continue;
      const strings = list
        .map(sanitizeStringLight)
        .filter((s): s is StringLight => s !== null)
        .slice(0, STRING_LIGHTS_MAX_STRINGS);
      if (strings.length) scenes[key] = strings;
    }
  }
  return {
    on: typeof r.on === "boolean" ? r.on : d.on,
    edge: sanitizeEdgeLights(r.edge),
    emitters: int(r.emitters, d.emitters, 0, STRING_LIGHTS_MAX_EMITTERS),
    dayGlow: num(r.dayGlow, d.dayGlow, 0, 1),
    scenes,
  };
}

/** The colors a string cycles through (custom falls back to warm white). */
export function stringLightColors(s: Pick<StringLight, "palette" | "customColors">): string[] {
  const list = s.palette === "custom" ? s.customColors : STRING_LIGHT_PALETTES[s.palette];
  return list.length ? [...list] : ["#ffd9a0"];
}

// ---------------------------------------------------------------------------
// Store

const listeners = new Set<() => void>();

function read(): StringLightsState {
  try {
    const raw = window.localStorage.getItem(STRING_LIGHTS_KEY);
    return sanitizeStringLightsState(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...STRING_LIGHTS_DEFAULT_STATE, scenes: {} };
  }
}

let state: StringLightsState | null = null;
let sceneKey = STRING_LIGHTS_NO_SCENE;
let version = 0;

/** Current state (read lazily so SSR never touches localStorage). */
export function getStringLights(): StringLightsState {
  if (!state) state = typeof window === "undefined" ? STRING_LIGHTS_DEFAULT_STATE : read();
  return state;
}

/** Bumped on every change, so the renderer can skip rebuilding. */
export function getStringLightsVersion(): number {
  return version;
}

function emit() {
  version++;
  listeners.forEach((l) => l());
}

export function setStringLights(update: (s: StringLightsState) => StringLightsState) {
  state = update(getStringLights());
  try {
    window.localStorage.setItem(STRING_LIGHTS_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable: still applies for this session */
  }
  emit();
}

export function sceneKeyFor(sceneId: string | null | undefined): string {
  return sceneId || STRING_LIGHTS_NO_SCENE;
}

export function getStringLightsSceneKey(): string {
  return sceneKey;
}

/** Called by the renderer when the loaded scene changes. */
export function setStringLightsSceneKey(key: string) {
  if (key === sceneKey) return;
  sceneKey = key;
  emit();
}

export function stringsForScene(s: StringLightsState, key: string): StringLight[] {
  return s.scenes[key] ?? [];
}

export function setEdgeLights(update: (e: EdgeLights) => EdgeLights) {
  setStringLights((s) => ({ ...s, edge: update(s.edge) }));
}

export function setSceneStrings(key: string, update: (list: StringLight[]) => StringLight[]) {
  setStringLights((s) => {
    const next = update(stringsForScene(s, key)).slice(0, STRING_LIGHTS_MAX_STRINGS);
    const scenes = { ...s.scenes };
    if (next.length) scenes[key] = next;
    else delete scenes[key];
    return { ...s, scenes };
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STRING_LIGHTS_KEY) return;
    state = read();
    emit();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const getVersion = () => version;

/** Re-renders on any change; returns [state, current scene key]. */
export function useStringLights(): [StringLightsState, string] {
  useSyncExternalStore(subscribe, getVersion, () => 0);
  return [getStringLights(), sceneKey];
}

// ---------------------------------------------------------------------------
// Placement helper: the renderer records where the camera is each frame so
// "add in front of me" can place a string without index.tsx plumbing.

export const stringLightsView = { x: 0, y: 0, z: 0, yaw: 0, waterY: 0 };

/** A new string centered `dist` m in front of the camera, across the view. */
export function stringInFrontOfView(dist = 7): StringLight {
  const v = stringLightsView;
  const d = STRING_LIGHT_DEFAULTS;
  const cx = v.x + Math.cos(v.yaw) * dist;
  const cz = v.z + Math.sin(v.yaw) * dist;
  // Run perpendicular to the view direction.
  const along = v.yaw + Math.PI / 2;
  const x = cx - (Math.cos(along) * d.span) / 2;
  const z = cz - (Math.sin(along) * d.span) / 2;
  return {
    ...d,
    customColors: [...d.customColors],
    id: newStringLightId(),
    x: +x.toFixed(2),
    z: +z.toFixed(2),
    yaw: +((along * 180) / Math.PI).toFixed(1),
  };
}

// ---------------------------------------------------------------------------
// Geometry math (pure, unit-tested)

/** Solves a·cosh(L/2a) − a = sag for the catenary parameter a. */
export function catenaryParam(span: number, sag: number): number {
  if (sag <= 1e-6) return Infinity;
  const f = (a: number) => a * Math.cosh(span / (2 * a)) - a - sag;
  // f decreases in a; bracket and bisect.
  let lo = span / 60;
  let hi = Math.max(span, (span * span) / (8 * sag)) * 4;
  while (f(lo) < 0) lo /= 2;
  for (let i = 0; i < 80; i++) {
    const mid = 0.5 * (lo + hi);
    if (f(mid) > 0) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/**
 * How far below the straight anchor line the wire hangs at t ∈ [0,1],
 * normalized to the deepest point (1 at the bottom of a drape).
 */
export function sagShape(
  curve: StringLightCurve,
  t: number,
  span: number,
  sag: number,
  drapes: number,
): number {
  t = Math.min(1, Math.max(0, t));
  switch (curve) {
    case "straight":
      return 0;
    case "parabola":
      return 4 * t * (1 - t);
    case "festoon": {
      const n = Math.max(1, Math.round(drapes));
      const u = (t * n) % 1;
      const local = t >= 1 ? 0 : u;
      return catenaryUnit(local, span / n, sag);
    }
    default:
      return catenaryUnit(t, span, sag);
  }
}

function catenaryUnit(t: number, span: number, sag: number): number {
  const a = catenaryParam(span, sag);
  if (!Number.isFinite(a)) return 4 * t * (1 - t);
  const x = (t - 0.5) * span;
  const top = Math.cosh(span / (2 * a));
  const denom = top - 1;
  if (denom < 1e-9) return 4 * t * (1 - t);
  return (top - Math.cosh(x / a)) / denom;
}

/**
 * The wire's points in the string's local frame: anchor A at the origin,
 * anchor B at (span, heightB − heightA, 0). y is up.
 */
export function stringCurvePoints(
  s: Pick<StringLight, "span" | "heightA" | "heightB" | "curve" | "sag" | "drapes">,
  segments: number,
): [number, number, number][] {
  const out: [number, number, number][] = [];
  const dh = s.heightB - s.heightA;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const y = dh * t - s.sag * sagShape(s.curve, t, s.span, s.sag, s.drapes);
    out.push([t * s.span, y, 0]);
  }
  return out;
}

/** Which palette color (index) bulb `i` of `n` gets, and a blend weight for GRADIENT. */
export function paletteIndex(
  pattern: StringLightPattern,
  i: number,
  n: number,
  colors: number,
  blockSize: number,
): { a: number; b: number; f: number } {
  if (colors <= 1) return { a: 0, b: 0, f: 0 };
  switch (pattern) {
    case "mirror": {
      const period = 2 * colors - 2;
      const k = i % period;
      const idx = k < colors ? k : period - k;
      return { a: idx, b: idx, f: 0 };
    }
    case "blocks": {
      const idx = Math.floor(i / Math.max(1, blockSize)) % colors;
      return { a: idx, b: idx, f: 0 };
    }
    case "gradient": {
      const p = n <= 1 ? 0 : (i / (n - 1)) * (colors - 1);
      const a = Math.min(colors - 1, Math.floor(p));
      return { a, b: Math.min(colors - 1, a + 1), f: p - a };
    }
    case "random": {
      // Deterministic per bulb, so it doesn't reshuffle on every rebuild.
      const h = Math.sin((i + 1) * 12.9898) * 43758.5453;
      const idx = Math.floor((h - Math.floor(h)) * colors) % colors;
      return { a: idx, b: idx, f: 0 };
    }
    default:
      return { a: i % colors, b: i % colors, f: 0 };
  }
}

/**
 * Brightness multiplier (0..1) of bulb `i` of `n` at time `t` seconds.
 * `seed` is a fixed per-bulb random in [0,1).
 */
export function bulbLevel(
  anim: StringLightAnim,
  t: number,
  i: number,
  n: number,
  speed: number,
  depth: number,
  direction: number,
  seed: number,
): number {
  const lo = 1 - Math.min(1, Math.max(0, depth));
  const mix = (w: number) => lo + (1 - lo) * w;
  const s = Math.max(0, speed);
  switch (anim) {
    case "twinkle": {
      // Each bulb has its own rate and phase; sharpened so most stay lit
      // and a few dip at any moment.
      const w = 0.5 + 0.5 * Math.sin(t * s * (2 + seed * 3) + seed * 40);
      return mix(Math.pow(w, 0.35));
    }
    case "chase": {
      const pos = (((direction * t * s * 6 - i) % 6) + 6) % 6;
      const w = Math.max(0, 1 - pos / 2.2);
      return mix(w);
    }
    case "fade":
      return mix(0.5 + 0.5 * Math.cos(t * s * Math.PI));
    case "pulse": {
      const phase = n <= 1 ? 0 : (i / n) * Math.PI * 2;
      return mix(0.5 + 0.5 * Math.sin(t * s * 2 - direction * phase));
    }
    case "alternate":
      return mix((Math.floor(t * s) + i) % 2 === 0 ? 1 : 0);
    default:
      return 1;
  }
}
