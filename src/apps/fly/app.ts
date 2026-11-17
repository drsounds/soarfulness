import { BuiltInRuntime } from "@/core/apps/lifecycle";
import { defineApp, type AppManifest } from "@/core/apps/types";
import manifest from "./manifest.json";

// Built-in app: declaration, switch and lifecycle events only. The feature's
// code lives in the core (routes/index.tsx and the settings panel).
export default defineApp({
  manifest: manifest as AppManifest,
  createRuntime: () => new BuiltInRuntime(manifest.id),
});
