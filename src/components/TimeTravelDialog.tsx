import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { isFuturisticYear, simulatedDate, toDateTimeLocalValue } from "@/lib/timeTravel";

// Time-travel dialog opened by tapping the clock below the persistent brand
// mark (top right of the HUD). Lets you pin the simulated date/time to any moment
// (it then keeps ticking forward in real time from there — see
// simulatedDate()), toggle whether TIMEOFDAY should follow the real
// northern-hemisphere sunrise/sunset for that date, and jump back to "now".
// Styled to match ConfirmDialog.tsx's dark glassy modal chrome.
export function TimeTravelDialog({
  open,
  onClose,
  timeTravelBaseMs,
  timeTravelSetAtMs,
  onTravel,
  onReturnToNow,
  timeSeasonalSync,
  onSeasonalSyncChange,
}: {
  open: boolean;
  onClose: () => void;
  timeTravelBaseMs: number | null;
  timeTravelSetAtMs: number | null;
  onTravel: (targetMs: number) => void;
  onReturnToNow: () => void;
  timeSeasonalSync: boolean;
  onSeasonalSyncChange: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => simulatedDate(timeTravelBaseMs, timeTravelSetAtMs));
  const [draft, setDraft] = useState(() => toDateTimeLocalValue(now));
  const closeRef = useRef<HTMLButtonElement>(null);

  // While open, keep a live-ticking display of the simulated date/time and
  // re-seed the date picker to match whenever the dialog (re)opens.
  useEffect(() => {
    if (!open) return;
    setNow(simulatedDate(timeTravelBaseMs, timeTravelSetAtMs));
    setDraft(toDateTimeLocalValue(simulatedDate(timeTravelBaseMs, timeTravelSetAtMs)));
    const id = window.setInterval(() => {
      setNow(simulatedDate(timeTravelBaseMs, timeTravelSetAtMs));
    }, 1000);
    return () => window.clearInterval(id);
  }, [open, timeTravelBaseMs, timeTravelSetAtMs]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const traveling = timeTravelBaseMs != null;
  const futuristic = isFuturisticYear(now);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("timeTravel.title")}
        onClick={(e) => e.stopPropagation()}
        className="ui-surface-solid w-full max-w-xs rounded-2xl border p-4 text-center shadow-2xl backdrop-blur-xl"
      >
        <p className="ui-ink mb-1 text-[11px] font-medium tracking-wide">{t("timeTravel.title")}</p>
        <p className="ui-ink-muted mb-3 text-[10px] font-light leading-relaxed">
          {t("timeTravel.description")}
        </p>

        <div className="ui-tint-1 mb-3 rounded-xl border px-3 py-2">
          <p className="ui-ink-faint text-[9px] tracking-wider">
            {traveling ? t("timeTravel.travelingStatus") : t("timeTravel.liveStatus")}
          </p>
          <p className="ui-ink text-sm font-light">
            {now.toLocaleDateString()} ·{" "}
            {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
          {futuristic && (
            <p className="mt-1 text-[9px] font-light text-cyan-300/80">
              {t("timeTravel.futuristicNote")}
            </p>
          )}
        </div>

        <label className="mb-3 block text-left">
          <span className="ui-ink-faint mb-1 block text-[9px] tracking-wider">
            {t("timeTravel.dateLabel")}
          </span>
          <input
            type="datetime-local"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="ui-surface ui-ink w-full rounded-lg border px-2 py-1.5 text-[11px] [color-scheme:dark]"
          />
        </label>

        <label className="mb-4 flex items-center justify-between gap-3 text-left">
          <span className="ui-ink-faint text-[9px] leading-snug tracking-wider">
            {t("timeTravel.seasonalLabel")}
          </span>
          <input
            type="checkbox"
            checked={timeSeasonalSync}
            onChange={(e) => onSeasonalSyncChange(e.target.checked)}
            className="h-4 w-4 shrink-0 accent-[var(--ui-accent)]"
          />
        </label>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              const ms = new Date(draft).getTime();
              if (!Number.isNaN(ms)) onTravel(ms);
            }}
            className="ui-btn rounded-full border px-4 py-1.5 text-[9px] font-medium tracking-wider transition active:scale-95"
          >
            {t("timeTravel.applyButton")}
          </button>
          {traveling && (
            <button
              onClick={onReturnToNow}
              className="ui-tint-1 ui-ink-muted ui-press rounded-full border px-4 py-1.5 text-[9px] font-light tracking-wider transition active:scale-95"
            >
              {t("timeTravel.liveButton")}
            </button>
          )}
          <button
            ref={closeRef}
            onClick={onClose}
            className="ui-line-1 ui-ink-faint ui-press rounded-full border bg-transparent px-4 py-1.5 text-[9px] font-light tracking-wider transition active:scale-95"
          >
            {t("timeTravel.closeButton")}
          </button>
        </div>
      </div>
    </div>
  );
}
