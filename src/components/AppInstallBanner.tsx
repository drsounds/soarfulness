import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouterState } from "@tanstack/react-router";
import { Capacitor } from "@capacitor/core";
import { X } from "lucide-react";
import { ANDROID_APP_ID, PLAY_STORE_URL, PUBLIC_APP_URL } from "@/lib/appLinks";

// "Get the app" prompt on the website, pointing at the Capacitor app's Play
// Store listing. Never shown inside the app itself, nor on iOS (there's no
// iOS app). On Android its button is an intent:// link for the current page:
// it opens the page straight in the app when that's installed, and the Play
// Store listing when it isn't. Dismissing it hides it on this browser for
// good.
const DISMISSED_KEY = "aquafulness:appBannerDismissed:v1";

function isDismissed() {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function androidIntentUrl(path: string) {
  const host = new URL(PUBLIC_APP_URL).host;
  return (
    `intent://${host}${path}#Intent;scheme=https;package=${ANDROID_APP_ID};` +
    `S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};end`
  );
}

export function AppInstallBanner() {
  const { t } = useTranslation();
  const href = useRouterState({ select: (s) => s.location.href });
  // Decided after mount: the server render can't know the platform, and
  // rendering nothing there keeps hydration consistent.
  const [platform, setPlatform] = useState<"android" | "other" | null>(null);

  useEffect(() => {
    if (Capacitor.isNativePlatform() || isDismissed()) return;
    const ua = navigator.userAgent;
    const iOS =
      /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    if (iOS) return;
    setPlatform(/Android/i.test(ua) ? "android" : "other");
  }, []);

  if (!platform) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      /* privacy mode — the banner comes back next visit */
    }
    setPlatform(null);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[65] flex justify-center p-2 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)]">
      <div className="ui-surface-solid pointer-events-auto flex max-w-sm items-center gap-2 rounded-full border py-1 pl-3 pr-1 shadow-2xl backdrop-blur-xl">
        <img src="/pwa-192.png" alt="" className="h-6 w-6 rounded-md" />
        <span className="ui-ink text-[10px] font-light tracking-wide">{t("appBanner.title")}</span>
        <a
          href={platform === "android" ? androidIntentUrl(href) : PLAY_STORE_URL}
          target={platform === "android" ? undefined : "_blank"}
          rel="noopener noreferrer"
          className="ui-tint-1 ui-ink ui-press rounded-full border px-2.5 py-0.5 text-[9px] font-medium tracking-wider transition active:scale-95"
        >
          {platform === "android" ? t("appBanner.open") : t("appBanner.getOnPlay")}
        </a>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("common.close")}
          className="ui-ink-muted flex h-6 w-6 items-center justify-center rounded-full transition active:scale-90"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
