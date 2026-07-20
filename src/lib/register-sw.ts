// Guarded service-worker registration for Aquafulness.
// Registers /sw.js only in production browsers outside Lovable preview/iframe/dev
// and supports ?sw=off as a kill switch that unregisters the app SW.
export function registerAppServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

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

  if (disabled) {
    void navigator.serviceWorker
      .getRegistrations()
      .then((regs) =>
        Promise.all(
          regs
            .filter((r) => {
              const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
              return url.endsWith("/sw.js");
            })
            .map((r) => r.unregister()),
        ),
      )
      .catch(() => {});
    return;
  }

  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  });
}
