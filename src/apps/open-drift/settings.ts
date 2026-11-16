// OpenDrift settings: this app's slice of the persisted settings snapshot
// (lib/settingsShared.ts `Persisted` is the intersection of every app's
// slice). The defaults are spread into DEFAULTS in routes/index.tsx.

import type { OpenDriftCurve, OpenDriftDirection } from "./OpenDrift";

export type OpenDriftSettings = {
  // HAVSDRIFT: an endless open-water drift that keeps carrying the
  // player around with every stick at rest (apps/open-drift/OpenDrift.ts): a
  // circle of openDriftRadius m (openDriftDirection) or a random
  // wander, openDriftCycleSpeed laps / changes of course per minute,
  // openDriftMagnitude = strength (1 = 100 %). Off by default.
  openDriftOn: boolean;
  openDriftCurve: OpenDriftCurve;
  openDriftRadius: number;
  openDriftCycleSpeed: number;
  openDriftMagnitude: number;
  openDriftDirection: OpenDriftDirection;
};

export const OPEN_DRIFT_DEFAULTS: OpenDriftSettings = {
  // HAVSDRIFT: endless open-water drift (apps/open-drift/OpenDrift.ts), off by default.
  openDriftOn: false,
  openDriftCurve: "circle",
  openDriftRadius: 10,
  openDriftCycleSpeed: 0.5,
  openDriftMagnitude: 1,
  openDriftDirection: "cw",
};

/** Every key OpenDriftSettings owns, in declaration order (presets, sharing). */
export const OPEN_DRIFT_SETTING_KEYS = Object.keys(
  OPEN_DRIFT_DEFAULTS,
) as (keyof OpenDriftSettings)[];
