import { defineApp, type AppManifest } from "@/core/apps/types";
import manifest from "./manifest.json";
import { DAY_NIGHT_DEFAULTS, DAY_NIGHT_SETTING_KEYS } from "./settings";

export default defineApp({
  manifest: manifest as AppManifest,
  settings: { defaults: DAY_NIGHT_DEFAULTS, keys: DAY_NIGHT_SETTING_KEYS },
});
