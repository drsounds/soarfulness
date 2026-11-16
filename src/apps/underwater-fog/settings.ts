// UnderwaterFog settings: this app's slice of the persisted settings snapshot
// (lib/settingsShared.ts `Persisted` is the intersection of every app's
// slice). The defaults are spread into DEFAULTS in routes/index.tsx.

// UNDERVATTENDIS: how the underwater fog gradient overlay blends over the 3D
// view (CSS mix-blend-mode). See apps/underwater-fog/underwaterFog.ts.
export type UnderwaterFogBlend = "normal" | "multiply" | "screen" | "overlay" | "soft-light";
export const UNDERWATER_FOG_BLENDS: UnderwaterFogBlend[] = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "soft-light",
];

export type UnderwaterFogSettings = {
  // UNDERVATTENDIS: a screen gradient over the 3D view (below the HUD) from
  // a fog color at the top to the water color, its top edge docked to the
  // on-screen waterline VATTENLINJEAVSTÅND meters ahead (so it sinks as you
  // rise above the water and climbs as you dive). Opacities are 0..1,
  // intensity multiplies both; spread = share of the way down to the screen
  // bottom the fade takes; curve = fade shape; feather = soft top edge as a
  // share of the screen height; offset nudges the edge (share of screen,
  // + = lower). See apps/underwater-fog/underwaterFog.ts.
  underwaterFogOn: boolean;
  underwaterFogColor: string;
  underwaterFogOpacity: number;
  underwaterFogWaterColorAuto: boolean;
  underwaterFogWaterColor: string;
  underwaterFogWaterOpacity: number;
  underwaterFogIntensity: number;
  underwaterFogSpread: number;
  underwaterFogCurve: number;
  underwaterFogFeather: number;
  underwaterFogDistance: number;
  underwaterFogOffset: number;
  underwaterFogSubmergedOnly: boolean;
  underwaterFogBlend: UnderwaterFogBlend;
};

export const UNDERWATER_FOG_DEFAULTS: UnderwaterFogSettings = {
  // UNDERVATTENDIS: underwater fog gradient overlay, off by default.
  underwaterFogOn: false,
  underwaterFogColor: "#a8d8e8",
  underwaterFogOpacity: 0.45,
  underwaterFogWaterColorAuto: true,
  underwaterFogWaterColor: "#0e4a6e",
  underwaterFogWaterOpacity: 0.55,
  underwaterFogIntensity: 1,
  underwaterFogSpread: 0.7,
  underwaterFogCurve: 1,
  underwaterFogFeather: 0.04,
  underwaterFogDistance: 12,
  underwaterFogOffset: 0,
  underwaterFogSubmergedOnly: false,
  underwaterFogBlend: "normal",
};

/** Every key UnderwaterFogSettings owns, in declaration order (presets, sharing). */
export const UNDERWATER_FOG_SETTING_KEYS = Object.keys(
  UNDERWATER_FOG_DEFAULTS,
) as (keyof UnderwaterFogSettings)[];
