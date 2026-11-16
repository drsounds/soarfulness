// Aurora settings: this app's slice of the persisted settings snapshot
// (lib/settingsShared.ts `Persisted` is the intersection of every app's
// slice). The defaults are spread into DEFAULTS in routes/index.tsx.

// NORRSKENSFÄRGER: the aurora's (NORRSKEN) color palette. "classic" is the
// usual green with a pink lower fringe and a faint red-violet top, "rainbow"
// runs through the hues along the bands, "custom" uses auroraColorMain /
// auroraColorTop. The actual colors live in apps/aurora/Aurora.ts.
export type AuroraPalette = "classic" | "green" | "red" | "violet" | "blue" | "rainbow" | "custom";
export const AURORA_PALETTES: AuroraPalette[] = [
  "classic",
  "green",
  "red",
  "violet",
  "blue",
  "rainbow",
  "custom",
];

export type AuroraSettings = {
  // NORRSKEN: northern lights in the sky (apps/aurora/Aurora.ts), shown at
  // night (faded with TIMEOFDAY) unless auroraDaylightOn. auroraIntensity =
  // brightness, auroraAmount = how many bands / how much sky they cover
  // (0..1), auroraSpeed = how fast they move, auroraHeight = low on the
  // horizon all around (0) .. a corona overhead (1).
  auroraOn: boolean;
  auroraIntensity: number;
  auroraAmount: number;
  auroraSpeed: number;
  auroraHeight: number;
  auroraPalette: AuroraPalette;
  auroraColorMain: string;
  auroraColorTop: string;
  auroraDaylightOn: boolean;
};

export const AURORA_DEFAULTS: AuroraSettings = {
  // NORRSKEN: northern lights (apps/aurora/Aurora.ts), off by default.
  auroraOn: false,
  auroraIntensity: 1,
  auroraAmount: 0.5,
  auroraSpeed: 1,
  auroraHeight: 0.35,
  auroraPalette: "classic",
  auroraColorMain: "#3dff8c",
  auroraColorTop: "#c23a9e",
  auroraDaylightOn: false,
};

/** Every key AuroraSettings owns, in declaration order (presets, sharing). */
export const AURORA_SETTING_KEYS = Object.keys(AURORA_DEFAULTS) as (keyof AuroraSettings)[];
