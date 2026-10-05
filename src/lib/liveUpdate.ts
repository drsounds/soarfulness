import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

// JS side of the native LiveUpdatePlugin (android/.../LiveUpdatePlugin.java):
// the Android app keeps its bundled copy of this web app up to date with the
// deployed site, downloading new versions in the background and switching to
// them on the next launch — see CAPACITOR_APP.md's "Live updates". Nothing
// here does anything in a browser/PWA build.
export interface LiveUpdateState {
  url: string | null;
  /** Downloaded bundle being served; "" when it's the APK's own. */
  current: string;
  /** Downloaded and waiting for the next launch (or apply()); "" if none. */
  pending: string;
  /** Version of the bundle shipped inside the APK. */
  bundled: string;
  /** The served bundle hasn't confirmed it boots yet (see notifyLiveUpdateReady). */
  trial: boolean;
}

export interface LiveUpdatePlugin {
  notifyReady(): Promise<void>;
  getState(): Promise<LiveUpdateState>;
  /** Checks the site now; resolves once any download has finished. */
  check(): Promise<{ status: "up-to-date" | "ready" | "busy" | "skipped"; version: string | null }>;
  /** Switches to a downloaded bundle immediately (reloads the app). */
  apply(): Promise<{ applied: boolean }>;
  /** Drops downloaded bundles and goes back to the APK's own (reloads the app). */
  reset(): Promise<void>;
  addListener(
    eventName: "updateReady",
    listener: (event: { version: string }) => void,
  ): Promise<PluginListenerHandle>;
}

export const LiveUpdate = registerPlugin<LiveUpdatePlugin>("LiveUpdate");

// Tells the native side this bundle booted fine. A freshly downloaded bundle
// that never calls this is assumed broken and rolled back to the previous
// one, so it must stay early in startup and free of anything that could
// keep it from running.
export function notifyLiveUpdateReady() {
  if (!Capacitor.isNativePlatform()) return;
  LiveUpdate.notifyReady().catch(() => {});
}
