import { useSyncExternalStore } from "react";

// EXTREME: the very high maximums on the strength/size controls (VÅG, SVAJ,
// SVALL, STRÖM, NAV, TORNADO, GUNGA, FREAK OUT…) are only offered while
// EXTREME is on. Otherwise every one of those controls tops out at
// NORMAL_FRACTION (~25 %) of its extreme max, and any value above that is
// clamped down (see the clamp effect in src/routes/index.tsx).
//
// It's the visitor's own choice, kept in its own localStorage key like the UI
// theme, so loading a preset or opening a badlänk never flips it.
export const EXTREME_LIMITS_KEY = "aquafulness:extremeLimits:v1";

export const NORMAL_FRACTION = 0.25;

// The full (EXTREME) maximum of each limited control. The everyday max is
// NORMAL_FRACTION of these (limitMax below).
export const EXTREME_MAX = {
  waveAmp: 100, // VÅG (m)
  swayAmp: 60, // SVAJ (m)
  surgeAmp: 60, // SVALL (m)
  navSpeed: 16, // NAV, full stick deflection (m/s)
  currentSpeed: 132, // STRÖM / DRIFT XZ, full stick deflection (m/s)
  tornadoRadius: 2000, // TORNADO RADIE (m)
  tornadoSpeed: 20, // TORNADO TEMPO
  swingIntensity: 2.5, // GUNGA INTENSITET
  swingSpeed: 5, // GUNGA HASTIGHET
  swingHeight: 100000, // GUNGA HÖJD
  freakOutSwingSpeed: 5, // FREAK OUT GUNGHASTIGHET
  freakOutSwingLength: 800, // FREAK OUT ARMLÄNGD
  freakOutRingRadius: 200, // FREAK OUT RINGRADIE
  freakOutRotationSpeed: 10, // FREAK OUT ROTATIONSHASTIGHET (navet)
} as const;

export type LimitedControl = keyof typeof EXTREME_MAX;

export function limitMax(control: LimitedControl, extreme: boolean): number {
  const max = EXTREME_MAX[control];
  return extreme ? max : max * NORMAL_FRACTION;
}

const listeners = new Set<() => void>();

function read(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(EXTREME_LIMITS_KEY) === "1";
  } catch {
    return false;
  }
}

let current = read();

export function getExtremeLimits(): boolean {
  return current;
}

export function setExtremeLimits(on: boolean) {
  current = on;
  try {
    if (on) window.localStorage.setItem(EXTREME_LIMITS_KEY, "1");
    else window.localStorage.removeItem(EXTREME_LIMITS_KEY);
  } catch {
    /* storage unavailable: still applies for this session */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== EXTREME_LIMITS_KEY) return;
    current = read();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useExtremeLimits(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, getExtremeLimits, () => false);
  return [on, setExtremeLimits];
}
