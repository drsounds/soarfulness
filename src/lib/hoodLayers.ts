// HUVA layers: the hood (lib/sceneFx/hood.ts) can be worn as several layers,
// each with its own settings, drawn in order (a later layer over an earlier
// one). Layer 1 is stored in the flat hood* settings (so settings saved
// before layers existed keep working); layers 2+ are stored as an array in
// hoodExtraLayers. This file holds the layer type, the defaults, the
// sanitizer for imported data, and the saved layer sets (SPARA / LADDA /
// EXPORTERA / IMPORTERA in the HUVA settings).

export type HoodLayer = {
  /** Only used for layers 2+; layer 1 follows the HUVA master toggle. */
  on: boolean;
  /** HÖJD FRÅN BOTTEN: where the sides end, from the bottom of the view up. */
  height: number;
  /** ÖPPNING: face opening, tight..wide. */
  opening: number;
  /** HUVFÄRG. */
  color: string;
  /** METALLGLANS: matte..wet metallic sheen. */
  metallic: number;
  /** RÖRELSE: sway and flutter. */
  motion: number;
  /** MUN OCH HALS + TÄCKHÖJD. */
  lowerOn: boolean;
  lowerHeight: number;
  /** BLIXTLÅS. */
  zipperOn: boolean;
  /** VATTEN I HUVAN + VATTENNIVÅ. */
  waterOn: boolean;
  waterLevel: number;
  /** HUVHÖJD: how low the hood hangs over the forehead (0 = high, 1 = low). */
  drop: number;
  /** TYNGD: how heavy the cloth is — sags more, lags further behind moves. */
  weight: number;
  /** VÅTA VECK: fine clinging wrinkles, like wet cloth. */
  wrinkles: number;
  /** MÖRKHET: darkens the lighting, for really dark fabric. */
  darkness: number;
};

export const HOOD_MAX_LAYERS = 4;

export const HOOD_LAYER_DEFAULTS: HoodLayer = {
  on: true,
  height: 0.3,
  opening: 0.5,
  color: "#2b3a55",
  metallic: 0.5,
  motion: 0.5,
  lowerOn: false,
  lowerHeight: 0.45,
  zipperOn: false,
  waterOn: false,
  waterLevel: 0.3,
  drop: 0,
  weight: 0.4,
  wrinkles: 0,
  darkness: 0,
};

const NUMBER_KEYS = [
  "height",
  "opening",
  "metallic",
  "motion",
  "lowerHeight",
  "waterLevel",
  "drop",
  "weight",
  "wrinkles",
  "darkness",
] as const;
const BOOL_KEYS = ["on", "lowerOn", "zipperOn", "waterOn"] as const;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Fills in and clamps whatever an old save or an imported file holds. */
export function sanitizeHoodLayer(raw: unknown): HoodLayer {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: HoodLayer = { ...HOOD_LAYER_DEFAULTS };
  for (const k of NUMBER_KEYS) {
    const v = src[k];
    if (typeof v === "number" && Number.isFinite(v)) out[k] = clamp01(v);
  }
  for (const k of BOOL_KEYS) {
    if (typeof src[k] === "boolean") out[k] = src[k] as boolean;
  }
  if (typeof src.color === "string" && /^#[0-9a-fA-F]{6}$/.test(src.color)) out.color = src.color;
  return out;
}

export function sanitizeHoodLayers(raw: unknown): HoodLayer[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, HOOD_MAX_LAYERS).map(sanitizeHoodLayer);
}

// --- Export / import file ---------------------------------------------------

export const HOOD_LAYERS_FILE_APP = "aquafulness-hood-layers";

export type HoodLayersFile = {
  app: typeof HOOD_LAYERS_FILE_APP;
  version: 1;
  name?: string;
  layers: HoodLayer[];
};

export function hoodLayersToFile(layers: HoodLayer[], name?: string): HoodLayersFile {
  return { app: HOOD_LAYERS_FILE_APP, version: 1, name, layers };
}

/** Returns the layers in an exported file, or null if it isn't one. */
export function hoodLayersFromFile(data: unknown): HoodLayer[] | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (d.app !== HOOD_LAYERS_FILE_APP) return null;
  const layers = sanitizeHoodLayers(d.layers);
  return layers.length > 0 ? layers : null;
}

// --- Saved layer sets (localStorage) ----------------------------------------

const SAVED_KEY = "aquafulness:hoodLayerSets:v1";

export type SavedHoodLayerSet = { id: string; name: string; layers: HoodLayer[] };

export function loadSavedHoodLayerSets(): SavedHoodLayerSet[] {
  try {
    const raw = window.localStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (s): s is Record<string, unknown> =>
          !!s && typeof s === "object" && typeof (s as { id?: unknown }).id === "string",
      )
      .map((s) => ({
        id: s.id as string,
        name: typeof s.name === "string" ? s.name : "",
        layers: sanitizeHoodLayers(s.layers),
      }))
      .filter((s) => s.layers.length > 0);
  } catch {
    return [];
  }
}

export function storeSavedHoodLayerSets(sets: SavedHoodLayerSet[]): void {
  try {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(sets));
  } catch {
    // Storage full or blocked: the sets just aren't kept.
  }
}
