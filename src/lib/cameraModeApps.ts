import { appFlags } from "@/core/apps/catalog";
import type { AppFlags } from "@/core/apps/flags";
import { useAppEnabled, useAppFlags } from "@/core/apps/useAppFlags";
import { CAMERA_MODES, type CameraMode } from "./settingsShared";

// The camera modes and the TORNADO / RIDE features are built-in apps
// (src/apps/{swimmer,fly,swing,bodyflight,watercraft,tornado,ride}): their
// code stays in the core, the apps declare them and switch them. This maps a
// mode to its app and tells the UI which ones are on.

export const MODE_APP_ID: Record<CameraMode, string> = {
  float: "swimmer",
  noclip: "fly",
  swing: "swing",
  watercraft: "watercraft",
  bodyflight: "bodyflight",
};
export const TORNADO_APP_ID = "tornado";
export const RIDE_APP_ID = "ride";

export function isModeEnabled(m: CameraMode, flags: AppFlags = appFlags): boolean {
  return flags.isEnabled(MODE_APP_ID[m]);
}

/** The camera modes that are on, in CAMERA_MODES order (SIMMARE always is). */
export function enabledModes(flags: AppFlags = appFlags): CameraMode[] {
  return CAMERA_MODES.filter((m) => m === "float" || isModeEnabled(m, flags));
}

/** Re-renders when a mode is switched on or off. */
export function useEnabledModes(): CameraMode[] {
  useAppFlags(appFlags);
  return enabledModes();
}

export const useTornadoAppOn = () => useAppEnabled(appFlags, TORNADO_APP_ID);
export const useRideAppOn = () => useAppEnabled(appFlags, RIDE_APP_ID);
