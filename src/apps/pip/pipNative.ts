import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

// The JS side of android/.../PictureInPicturePlugin.java. The activity
// itself goes into Android's Picture-in-Picture: on Android 12+ by itself
// when you swipe or press Home (auto-enter), on Android 8 to 11 from
// MainActivity.onUserLeaveHint. Outside the Android app the plugin doesn't
// exist and nothing here runs.

export type NativePipConfig = {
  enabled: boolean;
  autoEnter: boolean;
  aspectWidth: number;
  aspectHeight: number;
};

interface PictureInPicturePlugin {
  isSupported(): Promise<{ supported: boolean; active: boolean }>;
  configure(config: NativePipConfig): Promise<void>;
  enter(): Promise<{ entered: boolean }>;
  addListener(
    eventName: "change",
    listener: (event: { active: boolean }) => void,
  ): Promise<PluginListenerHandle>;
}

const PictureInPictureNative = registerPlugin<PictureInPicturePlugin>("PictureInPicture");

/** True inside the Android app (with the plugin), whether or not the device allows PiP. */
export function nativePipAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("PictureInPicture");
}

export async function nativePipSupported(): Promise<{ supported: boolean; active: boolean }> {
  if (!nativePipAvailable()) return { supported: false, active: false };
  try {
    return await PictureInPictureNative.isSupported();
  } catch {
    return { supported: false, active: false };
  }
}

export async function configureNativePip(config: NativePipConfig): Promise<void> {
  if (!nativePipAvailable()) return;
  try {
    await PictureInPictureNative.configure(config);
  } catch {
    /* PiP switched off for the app in Android's settings, or not supported */
  }
}

export async function enterNativePip(): Promise<boolean> {
  if (!nativePipAvailable()) return false;
  try {
    return (await PictureInPictureNative.enter()).entered;
  } catch {
    return false;
  }
}

/** Calls back when the activity enters or leaves PiP. */
export function onNativePipChange(fn: (active: boolean) => void): () => void {
  if (!nativePipAvailable()) return () => {};
  let handle: PluginListenerHandle | null = null;
  let closed = false;
  void PictureInPictureNative.addListener("change", (e) => fn(!!e.active)).then((h) => {
    if (closed) void h.remove();
    else handle = h;
  });
  return () => {
    closed = true;
    void handle?.remove();
  };
}
