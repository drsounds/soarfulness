// Roaming settings: this app's slice of the persisted settings snapshot
// (lib/settingsShared.ts `Persisted` is the intersection of every app's
// slice). The defaults are spread into DEFAULTS in routes/index.tsx.

import { DEFAULT_ROAMING_GESTURE_MAP_CODE } from "./gestures";

export type RoamingSettings = {
  // ROAMING: move the bather with the motion broadcasts of the Roaming
  // Android app (apps/roaming/RoamingMotion.ts). Off by default, and inert
  // outside the Android app (no broadcasts reach a browser).
  roamingOn: boolean;
  /** Top speed at full motion intensity, as a share of NAV speed (1 = 100 %). */
  roamingStrength: number;
  /** Seconds to close most of the gap when the motion asks for more speed. */
  roamingAccel: number;
  /** Seconds to close most of the gap when the motion eases off (the glide). */
  roamingGlide: number;
  /** Let leaning / left-right motion move the bather sideways. */
  roamingSideways: boolean;
  /** Walking (and single steps) at full intensity, as a share of ROAMING SPEED. */
  roamingWalkSpeed: number;
  /** Running at full intensity, as a share of ROAMING SPEED. */
  roamingRunSpeed: number;
  /** Leaning sideways at full intensity, as a share of ROAMING SPEED. */
  roamingLeanSpeed: number;
  /** Which gesture does what, see apps/roaming/gestures.ts for the format. Device-local. */
  roamingGestureMap: string;
  /** Seconds between repeats while a one-shot gesture is held (0 = fire once). */
  roamingRepeat: number;
  /** WAVE (waveAmp) change per wave height up / down, m. */
  roamingWaveAmpStep: number;
  /** VÅGRIKTNING (waveDir) change per wave direction left / right, degrees. */
  roamingWaveDirStep: number;
  /** SWAY (swayAmp) change per sway more / less, m. */
  roamingSwayStep: number;
  /** SWAY DIRECTION change per sway direction left / right, degrees. */
  roamingSwayDirStep: number;
  /** Show the floating debug window with every incoming event. */
  roamingDebug: boolean;
};

export const ROAMING_DEFAULTS: RoamingSettings = {
  roamingOn: false,
  roamingStrength: 1,
  roamingAccel: 0.8,
  roamingGlide: 2.5,
  roamingSideways: true,
  roamingWalkSpeed: 1,
  roamingRunSpeed: 1,
  roamingLeanSpeed: 0.5,
  roamingGestureMap: DEFAULT_ROAMING_GESTURE_MAP_CODE,
  roamingRepeat: 0.75,
  roamingWaveAmpStep: 0.25,
  roamingWaveDirStep: 15,
  roamingSwayStep: 0.5,
  roamingSwayDirStep: 15,
  roamingDebug: false,
};

/** Every key RoamingSettings owns, in declaration order (presets, sharing). */
export const ROAMING_SETTING_KEYS = Object.keys(ROAMING_DEFAULTS) as (keyof RoamingSettings)[];

/**
 * Keys that belong to this device rather than to a bath (like the GAMEPAD
 * mapping): left out of presets and share links, and kept when a link seeds
 * the settings (routes/bathing.$payload.bathe.tsx).
 */
export const ROAMING_DEVICE_KEYS: (keyof RoamingSettings)[] = ["roamingGestureMap"];

/** ROAMING_SETTING_KEYS without the device-local ones (presets). */
export const ROAMING_PRESET_KEYS = ROAMING_SETTING_KEYS.filter(
  (k) => !ROAMING_DEVICE_KEYS.includes(k),
);
