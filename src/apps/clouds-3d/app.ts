import { defineApp, type AppManifest } from "@/core/apps/types";
import { Clouds3dRuntime } from "./Clouds3dRuntime";
import manifest from "./manifest.json";
import { CLOUDS_3D_DEFAULTS, CLOUDS_3D_SETTING_KEYS } from "./settings";

export default defineApp({
  manifest: manifest as AppManifest,
  settings: { defaults: CLOUDS_3D_DEFAULTS, keys: CLOUDS_3D_SETTING_KEYS },
  createRuntime: (ctx) => new Clouds3dRuntime(ctx),
});
