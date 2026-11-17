import { defineApp, type AppManifest } from "@/core/apps/types";
import manifest from "./manifest.json";
import { TORUS_RINGS_DEFAULTS, TORUS_RINGS_SETTING_KEYS } from "./settings";
import { TorusRingsRuntime } from "./TorusRingsRuntime";

export default defineApp({
  manifest: manifest as AppManifest,
  settings: { defaults: TORUS_RINGS_DEFAULTS, keys: TORUS_RINGS_SETTING_KEYS },
  createRuntime: (ctx) => new TorusRingsRuntime(ctx),
});
