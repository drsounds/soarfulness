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

if (import.meta.env.DEV) {
  const problems = appRegistry.validate();
  if (problems.length)
    console.error(`[apps] ${problems.length} problem(s):\n${problems.join("\n")}`);
}
