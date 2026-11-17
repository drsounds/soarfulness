import sandTextureAsset from "@/assets/sand_cc0_512.jpg.asset.json";

// Bath rings settings: this app's slice of the persisted settings snapshot
// (lib/settingsShared.ts `Persisted` is the intersection of every app's
// slice). The defaults are spread into DEFAULTS in routes/index.tsx.

export type TorusRingsSettings = {
  torusRingsOn: boolean;
  torusRadius: number;
  torusTube: number;
  torusScale: number;
  torusOpacity: number;
  torusTextureIdx: number;
  torusCellSize: number;
  torusVerticalSpacing: number;
  torusVerticalCount: number;
  torusViewDistance: number;
  torusFadeDistance: number;
};

export const TORUS_RINGS_DEFAULTS: TorusRingsSettings = {
  // Floating torus "bath rings" field — off by default so existing scenes
  // look unchanged until explicitly turned on. Defaults per the feature
  // spec: emissive white, 50% opacity. Scale defaults to 20x (from the
  // Strandpark default state).
  torusRingsOn: false,
  torusRadius: 0.6,
  torusTube: 0.02,
  torusScale: 20,
  torusOpacity: 0.5,
  torusTextureIdx: 0,
  // Edge-to-edge gaps between rings (horizontal XZ / vertical Y), not
  // center distances — TorusRingField adds the ring's own scaled size on
  // top, so resizing rings never makes neighbours intersect.
  torusCellSize: 2,
  torusVerticalSpacing: 13.58,
  torusVerticalCount: 5,
  torusViewDistance: 26,
  torusFadeDistance: 8,
};

/** Every key TorusRingsSettings owns, in declaration order (presets, sharing). */
export const TORUS_RINGS_SETTING_KEYS = Object.keys(
  TORUS_RINGS_DEFAULTS,
) as (keyof TorusRingsSettings)[];

// Surface presets for the floating torus "bath rings" field (see
// apps/torus-rings/TorusRingField.ts) — "off" renders a flat emissive
// color with no texture map at all.
export const TORUS_RING_TEXTURES: { id: string; url: string | null }[] = [
  { id: "off", url: null },
  { id: "sand", url: sandTextureAsset.url },
];
export const TORUS_TEXTURE_LABEL_KEYS: Record<string, string> = {
  off: "options.torusTexture.off",
  sand: "options.torusTexture.sand",
};
