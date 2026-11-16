import { defineApp, type AppManifest } from "@/core/apps/types";
import manifest from "./manifest.json";
import { FIREWORKS_DEFAULTS, FIREWORKS_SETTING_KEYS } from "./settings";

export default defineApp({
  manifest: manifest as AppManifest,
  settings: { defaults: FIREWORKS_DEFAULTS, keys: FIREWORKS_SETTING_KEYS },
});
