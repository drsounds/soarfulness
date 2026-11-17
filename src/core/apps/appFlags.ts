import { AppFlags, type AppFlagConfig } from "./flags";
import type { AppRegistry } from "./registry";
import { DEFAULT_SKU, SKUS } from "./skus";

/** localStorage key holding the ids of apps the user switched off. */
export const APP_FLAGS_STORAGE_KEY = "aquafulness:apps:disabled";

/** "a, b,c" → ["a", "b", "c"]; empty or missing → []. */
export function parseIdList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * The build-time config: VITE_APP_SKU picks an edition, VITE_APPS_ENABLED is
 * an allow list and VITE_APPS_DISABLED a deny list (comma separated app ids).
 */
export function readAppFlagConfig(env: Record<string, string | undefined>): AppFlagConfig {
  const enabled = parseIdList(env.VITE_APPS_ENABLED);
  return {
    sku: env.VITE_APP_SKU || DEFAULT_SKU,
    enabled: enabled.length ? enabled : undefined,
    disabled: parseIdList(env.VITE_APPS_DISABLED),
  };
}

type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;

function readUserDisabled(storage: Storage | undefined): string[] {
  try {
    const raw = storage?.getItem(APP_FLAGS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * The app flag store for this build: the edition from the environment,
 * minus whatever the user switched off earlier (kept in `storage`).
 */
export function createAppFlags(
  registry: AppRegistry,
  env: Record<string, string | undefined>,
  storage?: Storage,
): AppFlags {
  return new AppFlags(registry, readAppFlagConfig(env), {
    skus: SKUS,
    userDisabled: readUserDisabled(storage),
    persist: (ids) => {
      try {
        storage?.setItem(APP_FLAGS_STORAGE_KEY, JSON.stringify(ids));
      } catch {
        // Storage may be unavailable (private mode); the choice then lasts
        // for this session only.
      }
    },
  });
}
