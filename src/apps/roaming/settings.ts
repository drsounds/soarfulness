// Roaming settings: this app's slice of the persisted settings snapshot
// (lib/settingsShared.ts `Persisted` is the intersection of every app's
// slice). The defaults are spread into DEFAULTS in routes/index.tsx.

export type RoamingSettings = {
  // ROAMING: move the bather with the motion broadcasts of the Roaming
  // Android app (apps/roaming/RoamingMotion.ts). Off by default, and inert
  // outside the Android app (no broadcasts reach a browser).
  roamingOn: boolean;
  /** Top speed at full motion intensity, as a share of NAV speed (1 = 100 %). */
  roamingStrength: number;
  /** Seconds to close most of the gap when the motion asks for more speed. */
  roamingAccel: number;
  /** Seconds to close most of the gap when the motion eases off (the glide). */
  roamingGlide: number;
  /** Let leaning / left-right motion move the bather sideways. */
  roamingSideways: boolean;
  /** Show the floating debug window with every incoming event. */
  roamingDebug: boolean;
};

export const ROAMING_DEFAULTS: RoamingSettings = {
  roamingOn: false,
  roamingStrength: 1,
  roamingAccel: 0.8,
  roamingGlide: 2.5,
  roamingSideways: true,
  roamingDebug: false,
};

/** Every key RoamingSettings owns, in declaration order (presets, sharing). */
export const ROAMING_SETTING_KEYS = Object.keys(ROAMING_DEFAULTS) as (keyof RoamingSettings)[];
