// Fireworks settings: this app's slice of the persisted settings snapshot
// (lib/settingsShared.ts `Persisted` is the intersection of every app's
// slice). The defaults are spread into DEFAULTS in routes/index.tsx.

export type FireworksSettings = {
  // FYRVERKERI (apps/fireworks/Fireworks.ts): intensity = burst size/brightness,
  // rate = rockets per minute, distance = to the launch site (m). The light
  // and synthesized sound each have their own toggle and level.
  fireworksOn: boolean;
  fireworksIntensity: number;
  fireworksRate: number;
  fireworksDistance: number;
  fireworksLightsOn: boolean;
  fireworksLightStrength: number;
  fireworksSoundOn: boolean;
  fireworksVolume: number;
};

export const FIREWORKS_DEFAULTS: FireworksSettings = {
  // FYRVERKERI: rockets launched from the water in front of the camera
  // (apps/fireworks/Fireworks.ts). fireworksIntensity scales burst size, star
  // count and brightness; fireworksRate is rockets per minute and
  // fireworksDistance the typical distance to the launch site (m).
  // FYRVERKERILJUS lights the scene and water in each burst's color by
  // fireworksLightStrength; FYRVERKERILJUD is synthesized (no assets), heard
  // only while LJUD is on, at fireworksVolume.
  fireworksOn: false,
  fireworksIntensity: 1,
  fireworksRate: 12,
  fireworksDistance: 250,
  fireworksLightsOn: true,
  fireworksLightStrength: 1,
  fireworksSoundOn: true,
  fireworksVolume: 0.7,
};

/** Every key FireworksSettings owns, in declaration order (presets, sharing). */
export const FIREWORKS_SETTING_KEYS = Object.keys(
  FIREWORKS_DEFAULTS,
) as (keyof FireworksSettings)[];
