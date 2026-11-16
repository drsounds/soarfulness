import { defineApp, type AppManifest } from "@/core/apps/types";
import { RainRuntime } from "./RainRuntime";
import manifest from "./manifest.json";
import { RAIN_DEFAULTS, RAIN_SETTING_KEYS } from "./settings";

export default defineApp({
  manifest: manifest as AppManifest,
  settings: { defaults: RAIN_DEFAULTS, keys: RAIN_SETTING_KEYS },
  createRuntime: (ctx) => new RainRuntime(ctx),
});
