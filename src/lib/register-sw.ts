// Guarded service-worker registration for Aquafulness.
// Registers /sw.js only in production browsers outside Lovable preview/iframe/dev
// and supports ?sw=off as a kill switch that unregisters the app SW.

function computeEligibility(): { supported: boolean; disabled: boolean } {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return { supported: false, disabled: true };
  }

  const host = window.location.hostname;
  const isPreviewHost =
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev");

  const inIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  const killSwitch = new URLSearchParams(window.location.search).get("sw") === "off";
  const disabled = !import.meta.env.PROD || inIframe || isPreviewHost || killSwitch;

  return { supported: true, disabled };
}

// Whether this browser/host is eligible to run the app service worker at
// all. Kept separate from registerAppServiceWorker so both this and
// isRunningAsInstalledPwa can share the exact same rules.
export function isOfflineCachingEligible(): boolean {
  const { supported, disabled } = computeEligibility();
  return supported && !disabled;
}

// True only when the app is actually running as an installed/standalone
// PWA (launched from a home-screen icon, an installed shortcut, etc.) —
// false for an ordinary browser tab, even on the same origin. Used to gate
// the eager bulk precache in use-offline-precache.ts: downloading the
// entire scenes/environments/surfaces/audio catalog (tens of MB) the
// instant anyone opens a link in a normal tab would make casual browsing —
// demos in particular — feel slow for no benefit, since a browser tab is
// closed and forgotten rather than relied on to work offline later. An
// installed PWA is the opposite: that's specifically the "I want this app
// on my device" signal, so front-loading the download there is the point.
export function isRunningAsInstalledPwa(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  if (window.matchMedia?.("(display-mode: fullscreen)").matches) return true;
  if (window.matchMedia?.("(display-mode: minimal-ui)").matches) return true;
  // iOS Safari predates the display-mode media query and never added it.
  if ((window.navigator as { standalone?: boolean }).standalone === true) return true;
  return false;
}

export function registerAppServiceWorker() {
  const { supported, disabled } = computeEligibility();
  if (!supported) return;

  if (disabled) {
    void navigator.serviceWorker
      .getRegistrations()
      .then((regs) =>
        Promise.all(
          regs
            .filter((r) => {
              const url =
                r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
              return url.endsWith("/sw.js");
            })
            .map((r) => r.unregister()),
        ),
      )
      .catch(() => {});
    return;
  }

  const register = () => {
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  };

  // This is called from a React effect (see __root.tsx), which for an app
  // this size routinely doesn't run until well after the window's own
  // "load" event has already fired (large JS bundle + assets finish
  // downloading, but hydration is still catching up) — `addEventListener`
  // on an event that already happened never calls back, so registration
  // would silently never happen. document.readyState stays "complete"
  // forever once load has fired, so checking it first covers both orders.
  if (document.readyState === "complete") {
    register();
  } else {
    window.addEventListener("load", register, { once: true });
  }
}
