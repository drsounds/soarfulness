// Swing settings: this app's slice of the persisted settings snapshot
// (lib/settingsShared.ts `Persisted` is the intersection of every app's
// slice). The defaults are spread into DEFAULTS in routes/index.tsx.

import type { SwingPreset, SwingYWaveform } from "@/lib/settingsShared";

export type SwingSettings = {
  swingPositionY: number;
  swingIntensity: number;
  swingSpeed: number;
  swingXFactor: number;
  swingHeight: number;
  swingPreset: SwingPreset;
  swingYWaveform: SwingYWaveform;
  // SWING HOOK: name of a scene object whose name ends in "-hook". While
  // swinging, the pendulum hangs from that object ("" = no hook, the
  // default free swing). The cord below is drawn from the hook down to the
  // camera; thickness is in meters, softness (0..1) is how much it sags
  // and trails behind the motion.
  swingHook: string;
  swingCordColor: string;
  swingCordThickness: number;
  swingCordSoftness: number;
  // GUNGA BEHÅLL TEMPO: when on, the swing's cycle rate is scaled by
  // swingKeepSpeedRefHeight / swingHeight so changing GUNGA HÖJD doesn't
  // also change how fast the camera moves. The reference height is captured
  // when the option is turned on.
  swingKeepSpeed: boolean;
  swingKeepSpeedRefHeight: number;
};

export const SWING_DEFAULTS: SwingSettings = {
  swingPositionY: 78.4,
  swingIntensity: 1.47,
  // GUNGA HASTIGHET: multiplies the pendulum's tempo on top of GUNGA
  // INTENSITET, so it can cross the water surface faster without also
  // widening the arc.
  swingSpeed: 0.22,
  swingXFactor: 0,
  swingHeight: 336.4,
  swingPreset: "water",
  swingYWaveform: "pendulum",
  swingHook: "",
  swingCordColor: "#d8c9a6",
  swingCordThickness: 0.08,
  swingCordSoftness: 0.4,
  swingKeepSpeed: true,
  swingKeepSpeedRefHeight: 291.6,
};

/** Every key SwingSettings owns, in declaration order (presets, sharing). */
export const SWING_SETTING_KEYS = Object.keys(SWING_DEFAULTS) as (keyof SwingSettings)[];
