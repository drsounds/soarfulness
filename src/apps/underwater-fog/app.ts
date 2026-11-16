import { defineApp, type AppManifest } from "@/core/apps/types";
import manifest from "./manifest.json";
import { UNDERWATER_FOG_DEFAULTS, UNDERWATER_FOG_SETTING_KEYS } from "./settings";

export default defineApp({
  manifest: manifest as AppManifest,
  settings: { defaults: UNDERWATER_FOG_DEFAULTS, keys: UNDERWATER_FOG_SETTING_KEYS },
});
