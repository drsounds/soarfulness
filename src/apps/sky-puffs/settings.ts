// Sky puffs settings: this app's slice of the persisted settings snapshot
// (lib/settingsShared.ts `Persisted` is the intersection of every app's
// slice). The defaults are spread into DEFAULTS in routes/index.tsx.

export type SkyPuffsSettings = {
  // SKY PUFFS: optional individual puffy clouds placed at random around the
  // camera. Count = how many are active (the pool is fixed), Size = width in
  // meters, Freq = how often they come and go, Opacity = peak opacity.
  skyPuffsOn: boolean;
  skyPuffsCount: number;
  skyPuffsSize: number;
  skyPuffsFreq: number;
  skyPuffsOpacity: number;
};

export const SKY_PUFFS_DEFAULTS: SkyPuffsSettings = {
  skyPuffsOn: false,
  skyPuffsCount: 6,
  skyPuffsSize: 600,
  skyPuffsFreq: 1,
  skyPuffsOpacity: 0.85,
};

/** Every key SkyPuffsSettings owns, in declaration order (presets, sharing). */
export const SKY_PUFFS_SETTING_KEYS = Object.keys(SKY_PUFFS_DEFAULTS) as (keyof SkyPuffsSettings)[];
