import { defineApp, type AppManifest } from "@/core/apps/types";
import manifest from "./manifest.json";
import { WIND_DEFAULTS, WIND_SETTING_KEYS } from "./settings";

export default defineApp({
  manifest: manifest as AppManifest,
  settings: { defaults: WIND_DEFAULTS, keys: WIND_SETTING_KEYS },
});
