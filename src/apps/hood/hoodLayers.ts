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

export type HoodFurStyle = "short" | "long" | "curly";
export const HOOD_FUR_STYLES: HoodFurStyle[] = ["short", "long", "curly"];
export type HoodFurPattern = "solid" | "tipped" | "spotted" | "striped";
export const HOOD_FUR_PATTERNS: HoodFurPattern[] = ["solid", "tipped", "spotted", "striped"];

export type HoodLayer = {
  /** Only used for layers 2+; layer 1 follows the HUVA master toggle. */
  on: boolean;
  /** HÖJD FRÅN BOTTEN: where the sides end, from the bottom of the view up. */
  height: number;
  /** Horizontal and vertical screen offsets, as fractions of the view. */
  offsetX: number;
  offsetY: number;
  /** ÖPPNING: face opening, tight..wide. */
  opening: number;
  /** ÖPPNINGSHÖJD: vertical opening size in screen heights; 0 follows ÖPPNING. */
  openingHeight: number;
  /**
   * ÖPPNINGSBREDD: opening width in screen widths (1 = edge to edge, up to
   * HOOD_OPENING_WIDTH_MAX); 0 = AUTO, follow ÖPPNING.
   */
  openingWidth: number;
  /** FUR. */
  fur: boolean;
  furColor: string;
  furStyle: HoodFurStyle;
  furPattern: HoodFurPattern;
  furSize: number;
  furWidth: number;
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
  /** TYNGD: cloth heaviness; a negative value reverses its response to movement. */
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
  /** DRA NER BLIXTLÅS: how far the zipper is pulled down (0 = closed). */
  zipperOpen: number;
  /** FLYTANDE: how much the cloth below FLYTGRÄNS floats and bends in the waves. */
  floating: number;
  /** EGEN LÄNGD: the layer ends at LÄNGD (with the MUDD at its hem) instead of running on down. */
  /** 0..1: VATTENFÄRG, how blue the water inside the cloth looks (0 = neutral grey). */
  waterTint: number;
  /** 0..1: DROPPAR, water dripping from the wet cloth's hem (needs the cloth to have been in water). */
  dripping: number;
  /** 0..1: DROPPANTAL, how many drops form along the edges. */
  dripAmount: number;
  /** 0..1: DROPPTILLVÄXT, how fast the beads grow and let go (slow .. fast). */
  dripGrow: number;
  /** 0..1: HUVA BAKÅT, the top hood pulled back off the head. */
  pullBack: number;
  /** 0..1: HALS NERÅT, the funnel neck (and the lower part of the hood) pulled down. */
  neckBack: number;
  /**
   * HUVA SEPARAT FRÅN HALS: with MUN OCH HALS the neck is its own collar
   * wrapped around you (like a sweater or winter coat, optionally a funnel
   * with KRAGE UPPÅT) and the hood is mounted separately, pulled back and
   * over. Off = the old single piece.
   */
  separate: boolean;
  /**
   * 3D-TYG: draw this layer as real geometry in the scene (a collar and a
   * hood with real padding) instead of the flat overlay. Water inside,
   * dripping, floating and LÄNGD stay with the flat overlay.
   */
  real3d: boolean;
  /** 3D mesh horizontal subdivisions; vertical subdivisions scale with it. */
  meshResolution: number;
  lengthOn: boolean;
  /** 0..1: LÄNGD, from a short collar (0) to an ankle-long dress (1); past the float suit it wraps around you in water. */
  length: number;
  /** 3D-PUFFAR: the padding has real depth: puffs bulge over the opening's edge and over each other. */
  puff3d: boolean;
  /** SKUGGA PÅ VYN: the old soft shadow on the view inside the opening (off by default). */
  viewShadow: boolean;
  /** BLIXTLÅS FÄST I TYGET: zipper teeth follow the cloth (off = fixed to the view, the old look). */
  zipperFixed: boolean;
  /** DRAGARE PÅ UTSIDAN: pull tab on the outside (off = pull hanging inside, the old look). */
  zipperPullOut: boolean;
};

export const HOOD_MAX_LAYERS = 4;
export const HOOD_MESH_RESOLUTION_MIN = 192;
export const HOOD_MESH_RESOLUTION_MAX = 512;
export const HOOD_MESH_RESOLUTION_STEP = 32;
export const HOOD_MESH_RESOLUTION_DEFAULT = 384;
export const HOOD_MESH_RESOLUTION_VERTICAL_RATIO = 3 / 8;
// ÖPPNINGSBREDD's EXTREME max (12 screen widths); the everyday max is 3.
/** PUFFHÖJD goes past 100% (up to this) for extra-fat puffs. */
export const HOOD_PUFF_HEIGHT_MAX = 2.5;
export const HOOD_OPENING_WIDTH_MAX = 12;
export const HOOD_OPENING_HEIGHT_MAX = 3;

export function sanitizeHoodMeshResolution(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return HOOD_MESH_RESOLUTION_DEFAULT;
  const clamped = Math.max(HOOD_MESH_RESOLUTION_MIN, Math.min(HOOD_MESH_RESOLUTION_MAX, value));
  return (
    HOOD_MESH_RESOLUTION_MIN +
    Math.round((clamped - HOOD_MESH_RESOLUTION_MIN) / HOOD_MESH_RESOLUTION_STEP) *
      HOOD_MESH_RESOLUTION_STEP
  );
}

export const HOOD_LAYER_DEFAULTS: HoodLayer = {
  on: true,
  height: 0.3,
  offsetX: 0,
  offsetY: 0,
  opening: 0.5,
  openingHeight: 0,
  openingWidth: 0,
  fur: false,
  furColor: "#f4f1e8",
  furStyle: "short",
  furPattern: "solid",
  furSize: 0.5,
  furWidth: 0.35,
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
  zipperOpen: 0,
  floating: 0,
  waterTint: 0,
  dripping: 0,
  dripAmount: 0.7,
  dripGrow: 0.5,
  pullBack: 0,
  neckBack: 0,
  separate: false,
  real3d: false,
  meshResolution: HOOD_MESH_RESOLUTION_DEFAULT,
  lengthOn: false,
  length: 0.6,
  puff3d: false,
  viewShadow: false,
  zipperFixed: true,
  zipperPullOut: true,
};

export function patchHoodLayers(
  layers: readonly HoodLayer[],
  patch: Partial<HoodLayer>,
): HoodLayer[] {
  return layers.map((layer) => ({ ...layer, ...patch }));
}

const NUMBER_KEYS = [
  "height",
  "opening",
  "openingHeight",
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
  "zipperOpen",
  "floating",
  "length",
  "waterTint",
  "dripping",
  "dripAmount",
  "dripGrow",
  "pullBack",
  "neckBack",
  "meshResolution",
  "furSize",
  "furWidth",
  "offsetX",
  "offsetY",
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
  "fur",
  "lengthOn",
  "puff3d",
  "separate",
  "real3d",
] as const;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Fills in and clamps whatever an old save or an imported file holds. */
export function sanitizeHoodLayer(raw: unknown): HoodLayer {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: HoodLayer = { ...HOOD_LAYER_DEFAULTS };
  for (const k of NUMBER_KEYS) {
    const v = src[k];
    if (typeof v === "number" && Number.isFinite(v)) {
      out[k] =
        k === "meshResolution"
          ? sanitizeHoodMeshResolution(v)
          : k === "offsetX" || k === "offsetY"
            ? Math.max(-1, Math.min(1, v))
            : k === "puffHeight"
              ? Math.max(0, Math.min(HOOD_PUFF_HEIGHT_MAX, v))
              : k === "weight"
                ? Math.max(-1, Math.min(1, v))
                : clamp01(v);
    }
  }
  for (const k of BOOL_KEYS) {
    if (typeof src[k] === "boolean") out[k] = src[k] as boolean;
  }
  if (HOOD_STYLES.includes(src.style as HoodStyle)) out.style = src.style as HoodStyle;
  const w = src.openingWidth;
  if (typeof w === "number" && Number.isFinite(w))
    out.openingWidth = Math.max(0, Math.min(HOOD_OPENING_WIDTH_MAX, w));
  const h = src.openingHeight;
  if (typeof h === "number" && Number.isFinite(h))
    out.openingHeight = Math.max(0, Math.min(HOOD_OPENING_HEIGHT_MAX, h));
  if (typeof src.color === "string" && /^#[0-9a-fA-F]{6}$/.test(src.color)) out.color = src.color;
  if (typeof src.furColor === "string" && /^#[0-9a-fA-F]{6}$/.test(src.furColor))
    out.furColor = src.furColor;
  if (typeof src.cuffColor === "string" && /^#[0-9a-fA-F]{6}$/.test(src.cuffColor))
    out.cuffColor = src.cuffColor;
  if (HOOD_CUFF_MATERIALS.includes(src.cuffMaterial as HoodCuffMaterial))
    out.cuffMaterial = src.cuffMaterial as HoodCuffMaterial;
  if (HOOD_FUR_STYLES.includes(src.furStyle as HoodFurStyle))
    out.furStyle = src.furStyle as HoodFurStyle;
  if (HOOD_FUR_PATTERNS.includes(src.furPattern as HoodFurPattern))
    out.furPattern = src.furPattern as HoodFurPattern;
  return out;
}

export type HoodLayerDetails = Pick<
  HoodLayer,
  | "openingHeight"
  | "offsetX"
  | "offsetY"
  | "fur"
  | "furColor"
  | "furStyle"
  | "furPattern"
  | "furSize"
  | "furWidth"
>;

export function sanitizeHoodLayerDetails(raw: unknown): HoodLayerDetails {
  const layer = sanitizeHoodLayer(raw);
  return {
    openingHeight: layer.openingHeight,
    offsetX: layer.offsetX,
    offsetY: layer.offsetY,
    fur: layer.fur,
    furColor: layer.furColor,
    furStyle: layer.furStyle,
    furPattern: layer.furPattern,
    furSize: layer.furSize,
    furWidth: layer.furWidth,
  };
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
