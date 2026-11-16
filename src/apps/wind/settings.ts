// Wind settings: this app's slice of the persisted settings snapshot
// (lib/settingsShared.ts `Persisted` is the intersection of every app's
// slice). The defaults are spread into DEFAULTS in routes/index.tsx.

import type { WindSource } from "./wind";

export type WindSettings = {
  // VIND (apps/wind/wind.ts): any number of winds, each with its own direction,
  // speed and gusts, added from the VIND button in the main view. They can
  // steer the wave direction, add to the sway and push a surface current
  // (each optional), and drive the wind sound. windAltitudeAudioOn
  // (HÖJDLJUD, on by default) fades the water sound into surface noise and
  // then wind as the camera rises above the water.
  winds: WindSource[];
  windWavesOn: boolean;
  windWaveStrength: number;
  windSwayOn: boolean;
  windSwayStrength: number;
  windCurrentOn: boolean;
  windCurrentStrength: number;
  windSoundOn: boolean;
  windSoundVolume: number;
  windAltitudeAudioOn: boolean;
};

export const WIND_DEFAULTS: WindSettings = {
  // VIND (apps/wind/wind.ts): no winds until one is added from the VIND button;
  // its effects and sound are on so a new wind works right away. HÖJDLJUD
  // is on by default.
  winds: [],
  windWavesOn: true,
  windWaveStrength: 1,
  windSwayOn: true,
  windSwayStrength: 1,
  windCurrentOn: true,
  windCurrentStrength: 1,
  windSoundOn: true,
  windSoundVolume: 0.6,
  windAltitudeAudioOn: true,
};

/** Every key WindSettings owns, in declaration order (presets, sharing). */
export const WIND_SETTING_KEYS = Object.keys(WIND_DEFAULTS) as (keyof WindSettings)[];
