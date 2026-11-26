import { defineApp, type AppManifest } from "@/core/apps/types";
import { GamepadRuntime } from "./GamepadRuntime";
import manifest from "./manifest.json";
import { GAMEPAD_DEFAULTS, GAMEPAD_SETTING_KEYS } from "./settings";

export default defineApp({
  manifest: manifest as AppManifest,
  settings: { defaults: GAMEPAD_DEFAULTS, keys: GAMEPAD_SETTING_KEYS },
  createRuntime: () => new GamepadRuntime(),
});
