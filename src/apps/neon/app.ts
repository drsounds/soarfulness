import { defineApp, type AppManifest } from "@/core/apps/types";
import manifest from "./manifest.json";
import { NEON_DEFAULTS, NEON_SETTING_KEYS } from "./settings";

export default defineApp({
  manifest: manifest as AppManifest,
  settings: { defaults: NEON_DEFAULTS, keys: NEON_SETTING_KEYS },
});
