import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

// This app's public identity: the deployed site every shared link points at,
// and the Play Store listing of its Capacitor app (capacitor.config.ts's
// appId). Inside the app window.location.origin is the WebView's own
// https://localhost, so anything handed to other people (DELA BADLÄNK, the
// bathing page's share icon) must be built from PUBLIC_APP_URL instead.
export const PUBLIC_APP_URL = "https://soarfulness.lovable.app";
export const ANDROID_APP_ID = "se.soarfulness.app.gen7";
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_APP_ID}`;

// JS side of the native AppLinksPlugin (android/.../AppLinksPlugin.java):
// Android App Links for PUBLIC_APP_URL (AndroidManifest.xml's autoVerify
// intent filter + public/.well-known/assetlinks.json) open the app instead
// of the browser, and the plugin hands the tapped URL over here. Also wraps
// Android's share sheet, since the WebView has no navigator.share.
export interface AppLinksPlugin {
  /** The link the app was cold-started from, if any (consumed on first read). */
  getLaunchUrl(): Promise<{ url: string | null }>;
  share(options: { title?: string; text?: string; url: string }): Promise<void>;
  addListener(
    eventName: "appUrlOpen",
    listener: (event: { url: string }) => void,
  ): Promise<PluginListenerHandle>;
}

export const AppLinks = registerPlugin<AppLinksPlugin>("AppLinks");

// Older APKs (still running this web code via live updates) don't have the
// plugin, so every native call checks for it first.
function hasAppLinks() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("AppLinks");
}

// The public URL for an in-app path, e.g. the current page's when sharing it.
export function toPublicUrl(pathAndQuery: string): string {
  return `${PUBLIC_APP_URL}${pathAndQuery.startsWith("/") ? "" : "/"}${pathAndQuery}`;
}

// The in-app path (with query and hash) for a link to PUBLIC_APP_URL, or
// null for anything else.
export function toInAppPath(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.host !== new URL(PUBLIC_APP_URL).host) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

// Routes deep links into the app: the one it was launched from, and any
// tapped while it's already running. `navigate` gets the in-app path.
export function listenForDeepLinks(navigate: (path: string) => void): () => void {
  if (!hasAppLinks()) return () => {};
  const go = (url: string | null | undefined) => {
    const path = url ? toInAppPath(url) : null;
    if (!path) return;
    const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (path !== here) navigate(path);
  };
  let handle: PluginListenerHandle | null = null;
  let cancelled = false;
  AppLinks.addListener("appUrlOpen", (e) => go(e.url))
    .then((h) => {
      if (cancelled) void h.remove();
      else handle = h;
    })
    .catch(() => {});
  AppLinks.getLaunchUrl()
    .then((r) => go(r.url))
    .catch(() => {});
  return () => {
    cancelled = true;
    void handle?.remove();
  };
}

export function canShareNatively(): boolean {
  if (hasAppLinks()) return true;
  return typeof navigator !== "undefined" && !!navigator.share;
}

// Opens the system share sheet: Android's own inside the app, the Web Share
// API in a browser. Rejects when neither is available or the user cancels.
export async function shareLink(options: { title?: string; text?: string; url: string }) {
  if (hasAppLinks()) {
    await AppLinks.share(options);
    return;
  }
  await navigator.share(options);
}
