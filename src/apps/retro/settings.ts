// Retro settings: this app's slice of the persisted settings snapshot
// (lib/settingsShared.ts `Persisted` is the intersection of every app's
// slice). The defaults are spread into DEFAULTS in routes/index.tsx.

// RETRO palettes: "rgb332" is the classic 256-color 3-3-2 bit cube (8 red ×
// 8 green × 4 blue levels), "websafe" the 216-color 6×6×6 cube, "ega" the
// 16-color EGA/VGA default palette, "gray" 16 shades of gray.
export type RetroPalette = "rgb332" | "websafe" | "ega" | "gray";
export const RETRO_PALETTES: RetroPalette[] = ["rgb332", "websafe", "ega", "gray"];

export type RetroSettings = {
  // RETRO: full-screen 1990s look — the frame is pixelated by
  // retroPixelSize, quantized to retroPalette with a 4x4 Bayer dither of
  // strength retroDither (0..1), with optional CRT scanlines (0..1).
  retroOn: boolean;
  retroPalette: RetroPalette;
  retroPixelSize: number;
  retroDither: number;
  retroScanlines: number;
};

export const RETRO_DEFAULTS: RetroSettings = {
  // RETRO: an opt-in full-screen post-process that quantizes the frame to a
  // 1990s-style palette with ordered dithering — see RETRO_SHADER in
  // apps/retro/retroShader.ts.
  retroOn: false,
  retroPalette: "rgb332",
  retroPixelSize: 2,
  retroDither: 1,
  retroScanlines: 0.2,
};

/** Every key RetroSettings owns, in declaration order (presets, sharing). */
export const RETRO_SETTING_KEYS = Object.keys(RETRO_DEFAULTS) as (keyof RetroSettings)[];
