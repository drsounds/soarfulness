// DayNight settings: this app's slice of the persisted settings snapshot
// (lib/settingsShared.ts `Persisted` is the intersection of every app's
// slice). The defaults are spread into DEFAULTS in routes/index.tsx.

export type DayNightSettings = {
  // DYGNSTONING: TIMEOFDAY tints the environment skybox (relative to the
  // time the skybox was painted at, per its manifest), instead of the
  // skybox snapping TIMEOFDAY to that time. Strength 0..1.
  envDaylightTintOn: boolean;
  envDaylightTintStrength: number;
  // DYGNSBYTE: an environment with both a day and a night skybox shows the
  // one matching TIMEOFDAY, cross-fading the two at dawn and dusk.
  envDayNightAutoOn: boolean;
  // SOLTONING: sunrise/sunset colors the backdrop (environment skybox, its
  // water reflection and the flat backdrop image) warm around the sun.
  envSunTintOn: boolean;
  dayNightClockSpeed: number;
  dayNightTimelineColor: string;
  dayNightLiveColor: string;
};

export const DAY_NIGHT_DEFAULTS: DayNightSettings = {
  // DYGNSTONING: lets TIMEOFDAY (and the clock's seasonal sync) tint an
  // environment skybox instead of the skybox snapping TIMEOFDAY to its own
  // manifest time.
  envDaylightTintOn: false,
  envDaylightTintStrength: 1,
  // DYGNSBYTE: when the environment's era has both a day and a night
  // skybox, the backdrop follows TIMEOFDAY — night skybox at night, day
  // skybox by day, cross-faded at dawn and dusk (apps/day-night/dayNightBackdrop.ts).
  envDayNightAutoOn: true,
  // SOLTONING: sunrise/sunset tints the backdrop warm toward the sun.
  envSunTintOn: true,
  dayNightClockSpeed: 1,
  dayNightTimelineColor: "#ffffff",
  dayNightLiveColor: "#ef4444",
};

/** Every key DayNightSettings owns, in declaration order (presets, sharing). */
export const DAY_NIGHT_SETTING_KEYS = Object.keys(DAY_NIGHT_DEFAULTS) as (keyof DayNightSettings)[];
