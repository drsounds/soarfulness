// Picture-in-Picture settings: this app's slice of the persisted settings
// snapshot (lib/settingsShared.ts `Persisted` is the intersection of every
// app's slice). The defaults are spread into DEFAULTS in routes/index.tsx.

export type PipAspect = "screen" | "16:9" | "9:16" | "4:3" | "3:4" | "1:1";

export const PIP_ASPECTS: readonly PipAspect[] = ["screen", "16:9", "9:16", "4:3", "3:4", "1:1"];

export type PipSettings = {
  // PIP: show the bath in a small floating window when leaving the app.
  pipOn: boolean;
  /** Enter Picture-in-Picture by itself when you press Home / switch tab (like a video). */
  pipAuto: boolean;
  /** Shape of the floating window; "screen" follows the screen's own shape. */
  pipAspect: PipAspect;
  /** Frame rate cap while in Picture-in-Picture, to save battery (0 = no extra cap). */
  pipFps: number;
};

export const PIP_DEFAULTS: PipSettings = {
  pipOn: true,
  pipAuto: true,
  pipAspect: "screen",
  pipFps: 30,
};

/** Every key PipSettings owns, in declaration order. */
export const PIP_SETTING_KEYS = Object.keys(PIP_DEFAULTS) as (keyof PipSettings)[];

/**
 * Like GAMEPAD these belong to the device rather than to a bath: they are left
 * out of presets and share links, and kept when a link seeds the settings
 * (routes/bathing.$payload.bathe.tsx).
 */
export const PIP_DEVICE_KEYS: (keyof PipSettings)[] = PIP_SETTING_KEYS;

/** Width / height of the floating window for an aspect setting. */
export function pipAspectRatio(aspect: PipAspect, screenW: number, screenH: number): number {
  if (aspect === "screen") return screenW > 0 && screenH > 0 ? screenW / screenH : 9 / 16;
  const [w, h] = aspect.split(":").map(Number);
  return w / h;
}

/** Android only accepts ratios between 1:2.39 and 2.39:1. */
export function clampPipRatio(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return 9 / 16;
  return Math.min(2.39, Math.max(1 / 2.39, ratio));
}

/** Width x height (whole numbers) of a ratio, for the native API and window sizes. */
export function pipRatioParts(ratio: number): { width: number; height: number } {
  const r = clampPipRatio(ratio);
  return { width: Math.round(r * 1000), height: 1000 };
}

/** A pip frame rate cap applied over the scene's own cap (both 0 = uncapped). */
export function capFpsForPip(sceneCap: number, pipCap: number): number {
  if (pipCap <= 0) return sceneCap;
  if (sceneCap <= 0) return pipCap;
  return Math.min(sceneCap, pipCap);
}
