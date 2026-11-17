// Bodyflight settings: this app's slice of the persisted settings snapshot
// (lib/settingsShared.ts `Persisted` is the intersection of every app's
// slice). The defaults are spread into DEFAULTS in routes/index.tsx.

export type BodyflightSettings = {
  // BODYFLIGHT: the updraft's speed at the ground (m/s, thinning out with
  // height), the gravity multiplier, and the hover height the ground cushion
  // holds the body at — see the bodyflight branch of the physics loop in
  // routes/index.tsx.
  bodyflightAirflow: number;
  bodyflightGravity: number;
  bodyflightHoverHeight: number;
};

export const BODYFLIGHT_DEFAULTS: BodyflightSettings = {
  bodyflightAirflow: 120,
  bodyflightGravity: 1,
  bodyflightHoverHeight: 2,
};

/** Every key BodyflightSettings owns, in declaration order (presets, sharing). */
export const BODYFLIGHT_SETTING_KEYS = Object.keys(
  BODYFLIGHT_DEFAULTS,
) as (keyof BodyflightSettings)[];
