import { defineApp, type AppManifest } from "@/core/apps/types";
import manifest from "./manifest.json";
import { OPEN_DRIFT_DEFAULTS, OPEN_DRIFT_SETTING_KEYS } from "./settings";

export default defineApp({
  manifest: manifest as AppManifest,
  settings: { defaults: OPEN_DRIFT_DEFAULTS, keys: OPEN_DRIFT_SETTING_KEYS },
});
