import { defineApp, type AppManifest } from "@/core/apps/types";
import manifest from "./manifest.json";
import { HOOD_DEFAULTS, HOOD_SETTING_KEYS } from "./settings";

export default defineApp({
  manifest: manifest as AppManifest,
  settings: { defaults: HOOD_DEFAULTS, keys: HOOD_SETTING_KEYS },
});
