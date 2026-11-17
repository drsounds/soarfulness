import { defineApp, type AppManifest } from "@/core/apps/types";
import manifest from "./manifest.json";
import { SkyPuffsRuntime } from "./SkyPuffsRuntime";
import { SKY_PUFFS_DEFAULTS, SKY_PUFFS_SETTING_KEYS } from "./settings";

export default defineApp({
  manifest: manifest as AppManifest,
  settings: { defaults: SKY_PUFFS_DEFAULTS, keys: SKY_PUFFS_SETTING_KEYS },
  createRuntime: (ctx) => new SkyPuffsRuntime(ctx),
});
