// Swimmer settings: this app's slice of the persisted settings snapshot
// (lib/settingsShared.ts `Persisted` is the intersection of every app's
// slice). The defaults are spread into DEFAULTS in routes/index.tsx.

export type SwimmerSettings = {
  floatLift: number;
};

export const SWIMMER_DEFAULTS: SwimmerSettings = {
  floatLift: 0,
};

/** Every key SwimmerSettings owns, in declaration order (presets, sharing). */
export const SWIMMER_SETTING_KEYS = Object.keys(SWIMMER_DEFAULTS) as (keyof SwimmerSettings)[];
