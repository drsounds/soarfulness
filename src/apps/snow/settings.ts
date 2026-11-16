// Snow settings: this app's slice of the persisted settings snapshot
// (lib/settingsShared.ts `Persisted` is the intersection of every app's
// slice). The defaults are spread into DEFAULTS in routes/index.tsx.

export type SnowSettings = {
  // SNÖ: falling snow (apps/snow/Snowfall.ts). snowAmount = number of flakes,
  // snowIntensity = how hard it snows. SNÖTÄCKE (snowCoverOn) whitens the
  // loaded scene and environment backdrop by snowCoverStrength 0..1.
  snowOn: boolean;
  snowAmount: number;
  snowIntensity: number;
  snowCoverOn: boolean;
  snowCoverStrength: number;
  // GRÅ BAKGRUND: SNÖTÄCKE also turns the backdrop a cold gray (off by default).
  snowGrayBackdropOn: boolean;
};

export const SNOW_DEFAULTS: SnowSettings = {
  // SNÖ: falling snow around the camera (apps/snow/Snowfall.ts). snowAmount is
  // the number of flakes, snowIntensity how hard it snows (fall speed, flake
  // size, wind). SNÖTÄCKE (snowCoverOn) whitens the loaded scene and the
  // environment backdrop as if snow had settled, by snowCoverStrength 0..1.
  snowOn: false,
  snowAmount: 4000,
  snowIntensity: 0.5,
  snowCoverOn: false,
  snowCoverStrength: 0.8,
  // GRÅ BAKGRUND: with SNÖTÄCKE on, also wash the environment backdrop out to
  // a cold gray (the old overcast look). Off by default; the backdrop keeps
  // its colors and only its ground gets snow.
  snowGrayBackdropOn: false,
};

/** Every key SnowSettings owns, in declaration order (presets, sharing). */
export const SNOW_SETTING_KEYS = Object.keys(SNOW_DEFAULTS) as (keyof SnowSettings)[];
