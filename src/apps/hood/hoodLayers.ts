// HUVA layers: the hood (apps/hood/Hood.ts) can be worn as several layers,
// each with its own settings, drawn in order (a later layer over an earlier
// one). Layer 1 is stored in the flat hood* settings (so settings saved
// before layers existed keep working); layers 2+ are stored as an array in
// hoodExtraLayers. This file holds the layer type, the defaults, the
// sanitizer for imported data, and the saved layer sets (SPARA / LADDA /
// EXPORTERA / IMPORTERA in the HUVA settings).

export type HoodCuffMaterial = "knit" | "smooth" | "rubber";
export const HOOD_CUFF_MATERIALS: HoodCuffMaterial[] = ["knit", "smooth", "rubber"];

export type HoodStyle = "classic" | "puffy" | "quilted" | "shell" | "down";
export const HOOD_STYLES: HoodStyle[] = ["classic", "puffy", "quilted", "shell", "down"];
/** The styles with padding (PUFFSTORLEK, PUFFHÖJD, PUFFTJOCKLEK, UPPBLÅSNING). */
export const HOOD_PADDED_STYLES: HoodStyle[] = ["puffy", "quilted", "down"];

export type HoodLayer = {
  /** Only used for layers 2+; layer 1 follows the HUVA master toggle. */
  on: boolean;
  /** HÖJD FRÅN BOTTEN: where the sides end, from the bottom of the view up. */
  height: number;
  /** ÖPPNING: face opening, tight..wide. */
  opening: number;
  /**
   * ÖPPNINGSBREDD: opening width in screen widths (1 = edge to edge, up to
   * HOOD_OPENING_WIDTH_MAX); 0 = AUTO, follow ÖPPNING.
   */
  openingWidth: number;
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
  /** VATTENLUGN: how calmly the water inside follows the waves (0 = instantly). */
  waterCalm: number;
  /** HUVHÖJD: how low the hood hangs over the forehead (0 = high, 1 = low). */
  drop: number;
  /** TYNGD: how heavy the cloth is — sags more, lags further behind moves. */
  weight: number;
  /** VÅTA VECK: fine clinging wrinkles, like wet cloth. */
  wrinkles: number;
  /** MÖRKHET: darkens the lighting, for really dark fabric. */
  darkness: number;
  /** RUNDHET: the opening's shape, boxy (0) .. round (1). */
  roundness: number;
  /**
   * STIL: classic cloth, winter-coat padding (puffy channels / quilted
   * diamonds / big down baffles), or a smooth, taut shell jacket.
   */
  style: HoodStyle;
  /** PUFFSTORLEK / PUFFHÖJD: padding size and how much it bulges. */
  puffSize: number;
  puffHeight: number;
  /** PUFFTJOCKLEK: how full the padding is, flat seams (0) .. fat round puffs (1). */
  puffThickness: number;
  /** UPPBLÅSNING I VATTEN: how much the puffs swell once the hood is in the water. */
  puffInflate: number;
  /**
   * REFLEKTERAR LJUS: the wet sheen reflects the bright sky and light, like
   * wet clothes, instead of mostly the dark water (which reads as black).
   */
  reflectLight: boolean;
  /** MUDD: ribbed cuff along the bottom; MUDDHÖJD / RIBBSTORLEK. */
  cuff: boolean;
  cuffHeight: number;
  cuffSize: number;
  /** MUDD VID HALSKANT: cuff along the funnel neck's top edge, on the cloth (off = old bottom band). */
  cuffTop: boolean;
  /** EGEN MUDD: the cuff's own MUDDFÄRG, MUDDGLANS and MUDDMATERIAL (off = same as the hood). */
  cuffCustom: boolean;
  cuffColor: string;
  cuffMetallic: number;
  cuffMaterial: HoodCuffMaterial;
  /** HÄNGER FRÅN TOPPEN: top follows you, heavy bottom lags and twists (off = rigid sway, the old look). */
  hanging: boolean;
  /** HUVDEL: the hood above the face; off with MUN OCH HALS = a separate funnel neck only. */
  hoodTop: boolean;
  /** KRAGE UPPÅT: the neck cover's edge bends up over the mouth. */
  collarUp: boolean;
  /** SKUGGA PÅ VYN: the old soft shadow on the view inside the opening (off by default). */
  viewShadow: boolean;
  /** BLIXTLÅS FÄST I TYGET: zipper teeth follow the cloth (off = fixed to the view, the old look). */
  zipperFixed: boolean;
  /** DRAGARE PÅ UTSIDAN: pull tab on the outside (off = pull hanging inside, the old look). */
  zipperPullOut: boolean;
};

export const HOOD_MAX_LAYERS = 4;
// ÖPPNINGSBREDD's EXTREME max (12 screen widths); the everyday max is 3.
export const HOOD_OPENING_WIDTH_MAX = 12;

export const HOOD_LAYER_DEFAULTS: HoodLayer = {
  on: true,
  height: 0.3,
  opening: 0.5,
  openingWidth: 0,
  color: "#2b3a55",
  metallic: 0.5,
  motion: 0.5,
  lowerOn: false,
  lowerHeight: 0.45,
  zipperOn: false,
  waterOn: false,
  waterLevel: 0.3,
  waterCalm: 0.6,
  drop: 0,
  weight: 0.4,
  wrinkles: 0,
  darkness: 0,
  roundness: 0.85,
  style: "classic",
  puffSize: 0.4,
  puffHeight: 0.5,
  puffThickness: 0.5,
  puffInflate: 0,
  reflectLight: true,
  cuff: false,
  cuffHeight: 0.3,
  cuffSize: 0.5,
  cuffTop: true,
  cuffCustom: false,
  cuffColor: "#1f2a40",
  cuffMetallic: 0.15,
  cuffMaterial: "knit",
  hanging: true,
  hoodTop: true,
  collarUp: false,
  viewShadow: false,
  zipperFixed: true,
  zipperPullOut: true,
};

const NUMBER_KEYS = [
  "height",
  "opening",
  "metallic",
  "motion",
  "lowerHeight",
  "waterLevel",
  "waterCalm",
  "drop",
  "weight",
  "wrinkles",
  "darkness",
  "roundness",
  "puffSize",
  "puffHeight",
  "puffThickness",
  "puffInflate",
  "cuffHeight",
  "cuffSize",
  "cuffMetallic",
] as const;
const BOOL_KEYS = [
  "on",
  "lowerOn",
  "zipperOn",
  "waterOn",
  "cuff",
  "reflectLight",
  "cuffTop",
  "cuffCustom",
  "hanging",
  "hoodTop",
  "collarUp",
  "viewShadow",
  "zipperFixed",
  "zipperPullOut",
] as const;

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
  if (HOOD_STYLES.includes(src.style as HoodStyle)) out.style = src.style as HoodStyle;
  const w = src.openingWidth;
  if (typeof w === "number" && Number.isFinite(w))
    out.openingWidth = Math.max(0, Math.min(HOOD_OPENING_WIDTH_MAX, w));
  if (typeof src.color === "string" && /^#[0-9a-fA-F]{6}$/.test(src.color)) out.color = src.color;
  if (typeof src.cuffColor === "string" && /^#[0-9a-fA-F]{6}$/.test(src.cuffColor))
    out.cuffColor = src.cuffColor;
  if (HOOD_CUFF_MATERIALS.includes(src.cuffMaterial as HoodCuffMaterial))
    out.cuffMaterial = src.cuffMaterial as HoodCuffMaterial;
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
