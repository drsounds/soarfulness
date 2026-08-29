import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

// Cookie consent gate for the Google Analytics connector. The choice is
// stored in localStorage; GA is only injected after "accept" (see
// loadAnalytics below). "Decline" stores a flag so the banner never nags
// again and no analytics script ever loads.
export const CONSENT_STORAGE_KEY = "aquafulness:cookie-consent:v1";

type Consent = "accepted" | "declined";

export function getStoredConsent(): Consent | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return v === "accepted" || v === "declined" ? v : null;
  } catch {
    return null;
  }
}

function storeConsent(v: Consent) {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, v);
  } catch {
    /* privacy mode — banner will reappear next visit */
  }
}

// Injects the gtag.js script + config exactly once, only on acceptance.
export function loadAnalytics(measurementId: string) {
  if (typeof document === "undefined") return;
  if (document.getElementById("ga-gtag-script")) return; // already loaded
  const s = document.createElement("script");
  s.id = "ga-gtag-script";
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(s);
  const w = window as unknown as { dataLayer: unknown[]; gtag?: (...a: unknown[]) => void };
  w.dataLayer = w.dataLayer || [];
  w.gtag = (...args: unknown[]) => {
    w.dataLayer.push(args);
  };
  w.gtag("js", new Date());
  w.gtag("config", measurementId);
}

export function CookieConsent({ measurementId }: { measurementId?: string }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // If the measurement ID is missing there is nothing to consent to.
    if (!measurementId) return;
    const stored = getStoredConsent();
    if (stored === "accepted") {
      loadAnalytics(measurementId);
    } else if (!stored) {
      setVisible(true);
    }
  }, [measurementId]);

  const decide = useCallback(
    (v: Consent) => {
      storeConsent(v);
      if (v === "accepted" && measurementId) loadAnalytics(measurementId);
      setVisible(false);
    },
    [measurementId],
  );

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={t("consent.title")}
      className="fixed inset-x-0 bottom-0 z-[70] flex justify-center p-4"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-black/80 p-4 shadow-2xl backdrop-blur-xl">
        <p className="mb-1 text-[11px] font-medium tracking-wide text-white/90">
          {t("consent.title")}
        </p>
        <p className="mb-4 text-[10px] font-light leading-relaxed text-white/60">
          {t("consent.body")}
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => decide("declined")}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-[9px] font-light tracking-wider text-white/70 transition active:scale-95 active:bg-white/15"
          >
            {t("consent.decline")}
          </button>
          <button
            autoFocus
            onClick={() => decide("accepted")}
            className="rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-[9px] font-medium tracking-wider text-white transition active:scale-95 active:bg-white/20"
          >
            {t("consent.accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
