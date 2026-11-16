import { defineApp, type AppManifest } from "@/core/apps/types";
import manifest from "./manifest.json";
import { CONFETTI_DEFAULTS, CONFETTI_SETTING_KEYS } from "./settings";

export default defineApp({
  manifest: manifest as AppManifest,
  settings: { defaults: CONFETTI_DEFAULTS, keys: CONFETTI_SETTING_KEYS },
});
