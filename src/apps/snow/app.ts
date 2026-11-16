import { defineApp, type AppManifest } from "@/core/apps/types";
import { SnowRuntime } from "./SnowRuntime";
import manifest from "./manifest.json";
import { SNOW_DEFAULTS, SNOW_SETTING_KEYS } from "./settings";

export default defineApp({
  manifest: manifest as AppManifest,
  settings: { defaults: SNOW_DEFAULTS, keys: SNOW_SETTING_KEYS },
  createRuntime: (ctx) => new SnowRuntime(ctx),
});
