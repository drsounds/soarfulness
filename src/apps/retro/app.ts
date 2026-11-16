import { defineApp, type AppManifest } from "@/core/apps/types";
import manifest from "./manifest.json";
import { RETRO_DEFAULTS, RETRO_SETTING_KEYS } from "./settings";

export default defineApp({
  manifest: manifest as AppManifest,
  settings: { defaults: RETRO_DEFAULTS, keys: RETRO_SETTING_KEYS },
});
