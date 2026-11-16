import {
  createGlbLibrary,
  readGlbFile,
  sceneNameFromFile,
  userSceneMaxBytes,
  type UserSceneMeta,
} from "@/lib/userScenes";

// DEKORATIONER: the player's own .glb models placed in a scene as
// decorations, each with a position/rotation/scale and an optional repeat
// (an array of copies). The layout is plain JSON kept per scene in the
// settings snapshot (Persisted.decorations), so it autosaves, rides along in
// saved presets/states and in bath links like every other setting.
//
// A decoration's model is referenced by `src`, one of:
//   - "local:<id>"  the model is stored in this device's IndexedDB (same
//                   GLB library code as EGNA SCENER, its own database). It
//                   only works on this device, so it is dropped from links.
//   - "data:model/gltf-binary;base64,<…>"  a very small model embedded in
//                   the JSON itself, so links, presets and state files carry
//                   it to another device. Only models up to
//                   DECORATION_EMBED_MAX_BYTES are embedded.

export const DECORATION_LOCAL_PREFIX = "local:";
export const DECORATION_DATA_PREFIX = "data:model/gltf-binary;base64,";
export const DECORATION_ID_PREFIX = "deco:";

// Largest model that is embedded in the JSON. Bath links are base62 of the
// gzipped settings, so every embedded byte costs about 1.4 URL characters;
// 32 KB keeps a link with a couple of small models well under 100 KB.
export const DECORATION_EMBED_MAX_BYTES = 32 * 1024;
// Total embedded bytes one bath link carries; models past the budget are
// left out of the link (they stay in local settings).
export const DECORATION_LINK_EMBED_BUDGET = 128 * 1024;
// How many decorations one scene may hold, and copies one repeat may make.
export const DECORATION_MAX_PER_SCENE = 64;
export const DECORATION_MAX_COPIES = 400;
export const DECORATION_MAX_REPEAT_PER_AXIS = 50;
// The settings key for "no scene" (the open ocean).
export const DECORATION_NO_SCENE_KEY = "__ocean__";

export type Vec3 = [number, number, number];

export type DecorationRepeat = {
  // Copies along each axis (1 = no repeat on that axis).
  count: Vec3;
  // Distance between copies along each axis, in the decoration's own
  // rotated frame, in meters (before scale).
  spacing: Vec3;
  // Extra yaw per copy, in degrees (spirals, fans).
  stepRotY: number;
  // Scale factor per copy (1 = same size, 0.9 = each copy 10% smaller).
  stepScale: number;
};

export type Decoration = {
  id: string;
  name: string;
  src: string;
  // Model size in bytes (for the embed guard and the list).
  size: number;
  visible: boolean;
  position: Vec3;
  // Degrees, applied in XYZ order.
  rotation: Vec3;
  scale: Vec3;
  repeat: DecorationRepeat;
};

// Settings shape: scene key → that scene's decorations.
export type DecorationsByScene = Record<string, Decoration[]>;

export const DEFAULT_DECORATION_REPEAT: DecorationRepeat = {
  count: [1, 1, 1],
  spacing: [2, 2, 2],
  stepRotY: 0,
  stepScale: 1,
};

export function decorationSceneKey(sceneId: string | null | undefined): string {
  return sceneId || DECORATION_NO_SCENE_KEY;
}

export const isLocalDecorationSrc = (src: string) => src.startsWith(DECORATION_LOCAL_PREFIX);
export const isEmbeddedDecorationSrc = (src: string) => src.startsWith(DECORATION_DATA_PREFIX);

export function decorationCopyCount(repeat: DecorationRepeat): number {
  return repeat.count[0] * repeat.count[1] * repeat.count[2];
}

// ---- sanitizing (settings, presets, state files and links are untrusted) --

const finite = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function vec3(v: unknown, fallback: Vec3, lo = -1e5, hi = 1e5): Vec3 {
  const a = Array.isArray(v) ? v : [];
  return [
    clamp(finite(a[0], fallback[0]), lo, hi),
    clamp(finite(a[1], fallback[1]), lo, hi),
    clamp(finite(a[2], fallback[2]), lo, hi),
  ];
}

// Clamps the per-axis counts so the total stays within DECORATION_MAX_COPIES,
// trimming the largest axis first.
export function clampRepeatCount(count: Vec3): Vec3 {
  const c = count.map((n) =>
    clamp(Math.round(finite(n, 1)), 1, DECORATION_MAX_REPEAT_PER_AXIS),
  ) as Vec3;
  while (c[0] * c[1] * c[2] > DECORATION_MAX_COPIES) {
    const i = c.indexOf(Math.max(...c));
    c[i] -= 1;
  }
  return c;
}

function sanitizeRepeat(v: unknown): DecorationRepeat {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    count: clampRepeatCount(vec3(o.count, DEFAULT_DECORATION_REPEAT.count, 1, 50)),
    spacing: vec3(o.spacing, DEFAULT_DECORATION_REPEAT.spacing, -1000, 1000),
    stepRotY: clamp(finite(o.stepRotY, 0), -360, 360),
    stepScale: clamp(finite(o.stepScale, 1), 0.5, 2),
  };
}

const SRC_RE = /^(local:deco:[\w-]{1,80}|data:model\/gltf-binary;base64,[A-Za-z0-9+/]+={0,2})$/;

export function sanitizeDecoration(v: unknown): Decoration | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.src !== "string" || !SRC_RE.test(o.src)) return null;
  // An embedded model over the cap (hand-edited JSON) is refused rather
  // than bloating every autosave.
  if (isEmbeddedDecorationSrc(o.src)) {
    const b64 = o.src.length - DECORATION_DATA_PREFIX.length;
    if (b64 * 0.75 > DECORATION_EMBED_MAX_BYTES + 4) return null;
  }
  return {
    id: typeof o.id === "string" && o.id ? o.id.slice(0, 80) : newDecorationId(),
    name: typeof o.name === "string" && o.name ? o.name.slice(0, 60) : "GLB",
    src: o.src,
    size: clamp(Math.round(finite(o.size, 0)), 0, 1e10),
    visible: o.visible !== false,
    position: vec3(o.position, [0, 0, 0]),
    rotation: vec3(o.rotation, [0, 0, 0], -3600, 3600),
    scale: vec3(o.scale, [1, 1, 1], 0.001, 1000),
    repeat: sanitizeRepeat(o.repeat),
  };
}

export function sanitizeDecorations(v: unknown): DecorationsByScene {
  const out: DecorationsByScene = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const [key, list] of Object.entries(v as Record<string, unknown>)) {
    if (!Array.isArray(list) || key.length > 200) continue;
    const clean = list
      .map(sanitizeDecoration)
      .filter((d): d is Decoration => d !== null)
      .slice(0, DECORATION_MAX_PER_SCENE);
    if (clean.length) out[key] = clean;
  }
  return out;
}

// ---- links ----------------------------------------------------------------

export type LinkDecorations = {
  decorations: DecorationsByScene;
  // Decorations left out: models only stored on this device, and embedded
  // models past DECORATION_LINK_EMBED_BUDGET.
  droppedLocal: number;
  droppedOverBudget: number;
};

// What a bath link carries: only the current scene's decorations, only the
// embedded ones (a "local:" model can't be opened on another device), and
// only up to the link's embed budget.
export function decorationsForLink(all: DecorationsByScene, sceneKey: string): LinkDecorations {
  const list = all[sceneKey] ?? [];
  let budget = DECORATION_LINK_EMBED_BUDGET;
  let droppedLocal = 0;
  let droppedOverBudget = 0;
  const kept: Decoration[] = [];
  for (const d of list) {
    if (!isEmbeddedDecorationSrc(d.src)) {
      droppedLocal++;
      continue;
    }
    if (d.size > budget) {
      droppedOverBudget++;
      continue;
    }
    budget -= d.size;
    kept.push(d);
  }
  return {
    decorations: kept.length ? { [sceneKey]: kept } : {},
    droppedLocal,
    droppedOverBudget,
  };
}

// Opening a link replaces the stored settings with the link's; for
// decorations that would wipe the visitor's own layouts in every other
// scene, so the link's scenes are laid over what is already stored.
export function mergeLinkedDecorations(stored: unknown, linked: unknown): DecorationsByScene {
  return { ...sanitizeDecorations(stored), ...sanitizeDecorations(linked) };
}

// ---- model storage ----------------------------------------------------------

export const decorationLibrary = createGlbLibrary("aquafulness-decorations", DECORATION_ID_PREFIX);

export function newDecorationId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

export function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

// The model bytes behind a decoration's src, or null if a local model is
// missing on this device.
export async function loadDecorationModel(src: string): Promise<ArrayBuffer | null> {
  if (isEmbeddedDecorationSrc(src)) {
    return base64ToArrayBuffer(src.slice(DECORATION_DATA_PREFIX.length));
  }
  if (isLocalDecorationSrc(src)) {
    return decorationLibrary.get(src.slice(DECORATION_LOCAL_PREFIX.length));
  }
  return null;
}

// Largest file accepted as a decoration (same caps as EGNA SCENER).
export function decorationMaxBytes(): number {
  return userSceneMaxBytes();
}

export type ImportedDecorationModel = {
  src: string;
  name: string;
  size: number;
  embedded: boolean;
};

// Validates a picked .glb and turns it into a decoration src: embedded in the
// JSON when it is at most DECORATION_EMBED_MAX_BYTES (and `embed` allows),
// otherwise copied into this device's decoration library.
export async function importDecorationModel(
  file: File,
  { embed = true }: { embed?: boolean } = {},
): Promise<ImportedDecorationModel> {
  if (embed && file.size <= DECORATION_EMBED_MAX_BYTES) {
    const buffer = await readGlbFile(file, DECORATION_EMBED_MAX_BYTES);
    return {
      src: DECORATION_DATA_PREFIX + bytesToBase64(new Uint8Array(buffer)),
      name: sceneNameFromFile(file.name),
      size: buffer.byteLength,
      embedded: true,
    };
  }
  const meta: UserSceneMeta = await decorationLibrary.add(file);
  return {
    src: DECORATION_LOCAL_PREFIX + meta.id,
    name: meta.name,
    size: meta.size,
    embedded: false,
  };
}

// Turns a local decoration into an embedded one (only when small enough), or
// an embedded one into a local one. Returns the new src.
export async function embedDecorationModel(src: string): Promise<string> {
  const data = await loadDecorationModel(src);
  if (!data) throw new Error("model missing");
  if (data.byteLength > DECORATION_EMBED_MAX_BYTES) throw new Error("too large to embed");
  return DECORATION_DATA_PREFIX + bytesToBase64(new Uint8Array(data));
}

export async function unembedDecorationModel(d: Decoration): Promise<string> {
  const data = await loadDecorationModel(d.src);
  if (!data) throw new Error("model missing");
  const file = new File([data], `${d.name}.glb`, { type: "model/gltf-binary" });
  const meta = await decorationLibrary.add(file);
  return DECORATION_LOCAL_PREFIX + meta.id;
}

// Removes stored local models no decoration in `all` (or in any saved
// preset/state the caller passes in `alsoKeep`) refers to any more.
export async function pruneDecorationLibrary(
  all: DecorationsByScene,
  alsoKeep: Iterable<string> = [],
): Promise<void> {
  const used = new Set<string>(alsoKeep);
  for (const list of Object.values(all)) for (const d of list) used.add(d.src);
  const stored = await decorationLibrary.list();
  for (const m of stored) {
    if (!used.has(DECORATION_LOCAL_PREFIX + m.id)) {
      await decorationLibrary.remove(m.id).catch(() => undefined);
    }
  }
}

export function newDecoration(
  model: ImportedDecorationModel,
  position: Vec3,
  yawDeg = 0,
): Decoration {
  return {
    id: newDecorationId(),
    name: model.name,
    src: model.src,
    size: model.size,
    visible: true,
    position,
    rotation: [0, yawDeg, 0],
    scale: [1, 1, 1],
    repeat: { ...DEFAULT_DECORATION_REPEAT },
  };
}
