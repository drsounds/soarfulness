// Fly settings: this app's slice of the persisted settings snapshot
// (lib/settingsShared.ts `Persisted` is the intersection of every app's
// slice). The defaults are spread into DEFAULTS in routes/index.tsx.

export type FlySettings = {
  noclipSpeed: number;
  // FRITT FALL/OMVÄND STIGNING's terminal vertical speed in m/s (at
  // noclipSpeed 1x — still scaled by NOCLIP SPEED on top of this) and the
  // exponential ease-in/out time constant ("grace") that ramps the actual
  // applied rate toward it — see the noclip branch of the physics loop in
  // routes/index.tsx for the exact math.
  noclipFallRiseSpeed: number;
  noclipVertEaseTime: number;
};

export const FLY_DEFAULTS: FlySettings = {
  noclipSpeed: 1,
  noclipFallRiseSpeed: 48,
  noclipVertEaseTime: 0.7,
};

/** Every key FlySettings owns, in declaration order (presets, sharing). */
export const FLY_SETTING_KEYS = Object.keys(FLY_DEFAULTS) as (keyof FlySettings)[];
