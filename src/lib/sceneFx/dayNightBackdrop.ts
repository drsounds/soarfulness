// DYGNSBYTE: lets an environment's skybox follow TIMEOFDAY instead of the
// other way around. When the selected era ships both a "day" and a "night"
// skybox, both are loaded and the backdrop shows the day one in daylight, the
// night one at night, and cross-fades between them around sunrise and sunset.

export type EnvTimeOption = { id: string };

export const DAY_TIME_ID = "day";
export const NIGHT_TIME_ID = "night";

// True when an era has both a day and a night skybox to blend between.
export function hasDayNightPair(times: readonly EnvTimeOption[] | null | undefined): boolean {
  if (!times) return false;
  return times.some((tm) => tm.id === DAY_TIME_ID) && times.some((tm) => tm.id === NIGHT_TIME_ID);
}

// Sun elevation (-1..1) for the app's TIMEOFDAY dial — the same curve as
// palette() in routes/index.tsx: 0 = midnight, 0.25 = sunrise, 0.5 = noon,
// 0.75 = sunset.
export function sunElevationForTimeOfDay(t: number): number {
  return -Math.cos(t * Math.PI * 2);
}

// Where the cross-fade starts and ends, in sun elevation. The night skybox is
// fully shown once the sun is this far below the horizon, the day skybox once
// it's this far above — about two hours either side of sunrise/sunset on the
// TIMEOFDAY dial, so dawn and dusk blend gradually rather than switching.
const NIGHT_FULL_ELEV = -0.25;
const DAY_FULL_ELEV = 0.3;

// 0 = day skybox only, 1 = night skybox only.
export function nightBackdropMix(t: number): number {
  const elev = sunElevationForTimeOfDay(t);
  const x = Math.min(1, Math.max(0, (elev - NIGHT_FULL_ELEV) / (DAY_FULL_ELEV - NIGHT_FULL_ELEV)));
  return 1 - x * x * (3 - 2 * x);
}
