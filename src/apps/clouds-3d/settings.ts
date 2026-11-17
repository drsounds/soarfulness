// 3D clouds settings: this app's slice of the persisted settings snapshot
// (lib/settingsShared.ts `Persisted` is the intersection of every app's
// slice). The defaults are spread into DEFAULTS in routes/index.tsx.

export type Clouds3dSettings = {
  // 3D-MOLN: volumetric puff clouds on top of each flat layer — bottom (only
  // when BOTTEN is MOLN), mid-water and sky. See apps/clouds-3d/clouds3d.ts.
  bottomClouds3d: boolean;
  midClouds3d: boolean;
  skyClouds3d: boolean;
};

export const CLOUDS_3D_DEFAULTS: Clouds3dSettings = {
  bottomClouds3d: false,
  midClouds3d: false,
  skyClouds3d: false,
};

/** Every key Clouds3dSettings owns, in declaration order (presets, sharing). */
export const CLOUDS_3D_SETTING_KEYS = Object.keys(CLOUDS_3D_DEFAULTS) as (keyof Clouds3dSettings)[];
