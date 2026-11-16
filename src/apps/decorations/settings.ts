// Decorations settings: this app's slice of the persisted settings snapshot
// (lib/settingsShared.ts `Persisted` is the intersection of every app's
// slice). The defaults are spread into DEFAULTS in routes/index.tsx.

import type { DecorationsByScene } from "./decorations";

export type DecorationsSettings = {
  // DEKORATIONER: scene key → that scene's placed .glb decorations
  // (src/apps/decorations/decorations.ts).
  decorations: DecorationsByScene;
};

export const DECORATIONS_DEFAULTS: DecorationsSettings = {
  // DEKORATIONER: per-scene placed .glb decorations (src/apps/decorations/decorations.ts).
  decorations: {} as DecorationsByScene,
};

/** Every key DecorationsSettings owns, in declaration order (presets, sharing). */
export const DECORATIONS_SETTING_KEYS = Object.keys(
  DECORATIONS_DEFAULTS,
) as (keyof DecorationsSettings)[];
