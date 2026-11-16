import { defineApp, type AppManifest } from "@/core/apps/types";
import { AuroraRuntime } from "./AuroraRuntime";
import manifest from "./manifest.json";
import { AURORA_DEFAULTS, AURORA_SETTING_KEYS } from "./settings";

export default defineApp({
  manifest: manifest as AppManifest,
  settings: { defaults: AURORA_DEFAULTS, keys: AURORA_SETTING_KEYS },
  createRuntime: (ctx) => new AuroraRuntime(ctx),
});
