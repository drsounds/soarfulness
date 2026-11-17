import { useSyncExternalStore } from "react";
import type { AppFlags } from "./flags";

/** Re-renders when any app is turned on or off; returns the store. */
export function useAppFlags(flags: AppFlags): AppFlags {
  useSyncExternalStore(
    (onChange) => flags.subscribe(onChange),
    () => flags.getVersion(),
    () => 0,
  );
  return flags;
}

/** Whether one app is on, re-rendering when that changes. */
export function useAppEnabled(flags: AppFlags, id: string): boolean {
  return useSyncExternalStore(
    (onChange) => flags.subscribe(onChange),
    () => flags.isEnabled(id),
    () => true,
  );
}
