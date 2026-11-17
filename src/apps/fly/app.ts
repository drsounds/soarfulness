import { BuiltInRuntime } from "@/core/apps/lifecycle";
import { defineApp, type AppManifest } from "@/core/apps/types";
import manifest from "./manifest.json";
import { FLY_DEFAULTS, FLY_SETTING_KEYS } from "./settings";

// Built-in app: declaration, switch and lifecycle events only. The feature's
// code lives in the core (routes/index.tsx and the settings panel).
export default defineApp({
  manifest: manifest as AppManifest,
  settings: { defaults: FLY_DEFAULTS, keys: FLY_SETTING_KEYS },
  createRuntime: () => new BuiltInRuntime(manifest.id),
});
