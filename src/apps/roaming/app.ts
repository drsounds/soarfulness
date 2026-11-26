import { defineApp, type AppManifest } from "@/core/apps/types";
import { RoamingRuntime } from "./RoamingRuntime";
import manifest from "./manifest.json";
import { ROAMING_DEFAULTS, ROAMING_SETTING_KEYS } from "./settings";

export default defineApp({
  manifest: manifest as AppManifest,
  settings: { defaults: ROAMING_DEFAULTS, keys: ROAMING_SETTING_KEYS },
  createRuntime: () => new RoamingRuntime(),
});
