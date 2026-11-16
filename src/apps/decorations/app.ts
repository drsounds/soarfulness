import { defineApp, type AppManifest } from "@/core/apps/types";
import manifest from "./manifest.json";
import { DECORATIONS_DEFAULTS, DECORATIONS_SETTING_KEYS } from "./settings";

export default defineApp({
  manifest: manifest as AppManifest,
  settings: { defaults: DECORATIONS_DEFAULTS, keys: DECORATIONS_SETTING_KEYS },
});
