import { defineApp, type AppManifest } from "@/core/apps/types";
import manifest from "./manifest.json";

// LJUSSLINGOR keeps its state in its own store (stringLights.ts,
// localStorage STRING_LIGHTS_KEY), so it has no slice of `Persisted`.
export default defineApp({
  manifest: manifest as AppManifest,
});
