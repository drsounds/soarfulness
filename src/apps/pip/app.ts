import { defineApp, type AppManifest } from "@/core/apps/types";
import manifest from "./manifest.json";
import { PIP_DEFAULTS, PIP_SETTING_KEYS } from "./settings";

// No scene runtime: Picture-in-Picture works on the page (usePictureInPicture
// in routes/index.tsx) and on the render loop's frame source (pipFrames.ts).
export default defineApp({
  manifest: manifest as AppManifest,
  settings: { defaults: PIP_DEFAULTS, keys: PIP_SETTING_KEYS },
});
