import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Progress } from "@/components/ui/progress";
import { useOfflinePrecache } from "@/hooks/use-offline-precache";

// Shows a "downloading for offline use" progress bar the first time the app
// runs as an installed/standalone PWA (see useOfflinePrecache — a regular
// browser tab never triggers this, on purpose, so casual/demo browsing
// doesn't get slowed down by an unasked-for bulk download) — so the player
// can see why there's brief background network activity, and knows once
// it's finished that the game will now work with no connection. Non-
// blocking: dismissing it doesn't cancel the download, it just stops
// showing it, and it never reappears once the precache has completed once.
export function OfflineDownloadOverlay() {
  const { t } = useTranslation();
  const state = useOfflinePrecache();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || state.phase !== "downloading") return null;

  const percent = state.total > 0 ? Math.round((state.done / state.total) * 100) : 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[12pt] z-40 flex justify-center px-4"
    >
      <div className="ui-surface-solid pointer-events-auto w-full max-w-xs rounded-2xl border p-3 shadow-2xl backdrop-blur-xl">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="ui-ink text-[10px] font-medium tracking-wide">
            {t("offline.downloadTitle")}
          </p>
          <button
            onClick={() => setDismissed(true)}
            aria-label={t("offline.downloadDismiss")}
            className="ui-ink-faint text-[14px] leading-none transition hover:opacity-80"
          >
            ×
          </button>
        </div>
        <Progress value={percent} className="mb-1.5 h-1.5" />
        <p className="ui-ink-muted text-[9px] font-light tracking-wide">
          {t("offline.downloadPercent", { percent })}
        </p>
      </div>
    </div>
  );
}
