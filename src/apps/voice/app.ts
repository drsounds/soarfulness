import { defineApp, type AppManifest } from "@/core/apps/types";
import manifest from "./manifest.json";
import { VOICE_DEFAULTS, VOICE_SETTING_KEYS } from "./settings";
import { VoiceRuntime } from "./VoiceRuntime";

export default defineApp({
  manifest: manifest as AppManifest,
  settings: { defaults: VOICE_DEFAULTS, keys: VOICE_SETTING_KEYS },
  createRuntime: () => new VoiceRuntime(),
});
