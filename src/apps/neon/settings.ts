// Neon settings: this app's slice of the persisted settings snapshot
// (lib/settingsShared.ts `Persisted` is the intersection of every app's
// slice). The defaults are spread into DEFAULTS in routes/index.tsx.

import { EDGE_FILTER_DEFAULT, cloneEdgeFilter, type EdgeFilter } from "@/lib/edgeSelect";

// NEON color animation:
//  - "solid"     always neonPrimary
//  - "alternate" hard switch between neonPrimary and neonSecondary,
//                neonFrequency times per second
//  - "fade"      smooth back-and-forth blend between the two
//  - "hue"       cycles the full hue wheel starting from neonPrimary's hue,
//                neonFrequency turns per second
export type NeonMode = "solid" | "alternate" | "fade" | "hue";
export const NEON_MODES: NeonMode[] = ["solid", "alternate", "fade", "hue"];

export type NeonSettings = {
  // NEON: glowing lines along the loaded scene's mesh edges. neonMode picks
  // how the color moves over time (see NeonMode); neonFrequency is in
  // cycles per second. neonTint is mixed over the result by neonTintAmount.
  neonOn: boolean;
  neonMode: NeonMode;
  neonPrimary: string;
  neonSecondary: string;
  neonTint: string;
  neonTintAmount: number;
  neonStrength: number;
  neonWidth: number;
  neonFrequency: number;
  // Which edges get lines: by direction (X / Y / Z / other) and an optional
  // world-space x/y/z range (lib/edgeSelect.ts).
  neonEdgeFilter: EdgeFilter;
  // NEONACCENT: tint + emission (intensity 1.00) for every scene material
  // whose name ends in "-neon" — see apps/neon/neonAccent.ts.
  neonAccentColor: string;
};

export const NEON_DEFAULTS: NeonSettings = {
  // NEON: glowing lines along the loaded scene's mesh edges — see
  // apps/neon/NeonEdges.ts for how neonMode/neonFrequency animate color.
  neonOn: false,
  neonMode: "solid",
  neonPrimary: "#ff2bd6",
  neonSecondary: "#22e6ff",
  neonTint: "#ffffff",
  neonTintAmount: 0,
  neonStrength: 1,
  neonWidth: 3,
  neonFrequency: 0.5,
  neonEdgeFilter: cloneEdgeFilter(EDGE_FILTER_DEFAULT),
  // NEONACCENT: color of every "-neon" scene material (tint + emission at
  // 1.00) — see apps/neon/neonAccent.ts.
  neonAccentColor: "#ff2bd6",
};

/** Every key NeonSettings owns, in declaration order (presets, sharing). */
export const NEON_SETTING_KEYS = Object.keys(NEON_DEFAULTS) as (keyof NeonSettings)[];
