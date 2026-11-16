// Rain settings: this app's slice of the persisted settings snapshot
// (lib/settingsShared.ts `Persisted` is the intersection of every app's
// slice). The defaults are spread into DEFAULTS in routes/index.tsx.

// REGNFÄRG: the tint of the falling rain (REGN, apps/rain/Rainfall.ts).
//  - "silver" cool gray-blue, like rain against a bright sky
//  - "white"  bright, very visible streaks
//  - "blue"   bluish water
//  - "gray"   dull, dark rain
export type RainColor = "silver" | "white" | "blue" | "gray";
export const RAIN_COLORS: RainColor[] = ["silver", "white", "blue", "gray"];

export type RainSettings = {
  // REGN: falling rain (apps/rain/Rainfall.ts). rainAmount = number of drops,
  // rainIntensity = how hard it rains (fall speed, its own wind, sound),
  // rainDropLength/rainDropSize scale the streaks, rainOpacity 0..1,
  // rainSplashesOn = splash rings on the water (STÄNK), rainSoundOn plays
  // synthesized rain (only while LJUD is on) at rainVolume.
  rainOn: boolean;
  rainAmount: number;
  rainIntensity: number;
  rainDropLength: number;
  rainDropSize: number;
  rainOpacity: number;
  rainColor: RainColor;
  rainSplashesOn: boolean;
  rainSoundOn: boolean;
  rainVolume: number;
};

export const RAIN_DEFAULTS: RainSettings = {
  // REGN: falling rain around the camera, off by default. rainAmount is the
  // number of drops, rainIntensity how hard it rains; the streak look,
  // splashes and sound have their own settings.
  rainOn: false,
  rainAmount: 8000,
  rainIntensity: 0.6,
  rainDropLength: 1,
  rainDropSize: 1,
  rainOpacity: 0.5,
  rainColor: "silver",
  rainSplashesOn: true,
  rainSoundOn: true,
  rainVolume: 0.6,
};

/** Every key RainSettings owns, in declaration order (presets, sharing). */
export const RAIN_SETTING_KEYS = Object.keys(RAIN_DEFAULTS) as (keyof RainSettings)[];
