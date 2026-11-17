import { createAppFlags } from "./appFlags";
import { AppRegistry } from "./registry";
import type { AnyAppDefinition } from "./types";

// The installed apps: every src/apps/*/app.ts, picked up by Vite's
// import.meta.glob at build time, so adding an app is adding a folder.
// Manifests and settings are small and loaded eagerly; heavy runtime code
// stays behind each app's createRuntime and can move to dynamic imports
// later without changing this file's API.

const modules = import.meta.glob<{ default: AnyAppDefinition }>("../../apps/*/app.ts", {
  eager: true,
});

export const appRegistry = new AppRegistry(Object.values(modules).map((m) => m.default));

// Which of the installed apps are on: the build's edition (VITE_APP_SKU,
// VITE_APPS_ENABLED, VITE_APPS_DISABLED) minus what the user switched off.
export const appFlags = createAppFlags(
  appRegistry,
  import.meta.env,
  typeof window === "undefined" ? undefined : window.localStorage,
);

if (import.meta.env.DEV) {
  const problems = appRegistry.validate();
  if (problems.length)
    console.error(`[apps] ${problems.length} problem(s):\n${problems.join("\n")}`);
}
