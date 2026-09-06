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

// Whether this browser/host is eligible to run the app service worker — and
// therefore whether it's worth doing any offline-precaching work at all (see
// src/hooks/use-offline-precache.ts). Kept separate from
// registerAppServiceWorker so both can share the exact same rules.
export function isOfflineCachingEligible(): boolean {
  const { supported, disabled } = computeEligibility();
  return supported && !disabled;
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
