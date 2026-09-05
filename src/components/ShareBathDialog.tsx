import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BATH_TITLE_MAX_LENGTH, BATH_DESCRIPTION_MAX_LENGTH } from "@/lib/shareState";

// The "share bath" dialog: turns the live state into a shareable
// /bathing/<base62> URL (see src/lib/shareState.ts) — title/description are
// optional and only feed the link's Open Graph preview
// (routes/bathing.$payload.tsx's head()), never applied in-app. Shared
// between the settings panel's "DELA BADLÄNK" button (SettingsPanel.tsx) and
// the HUD's share shortcut icon (routes/index.tsx) — both just own an `open`
// boolean and hand this the same `buildBathLink`.
export function ShareBathDialog({
  open,
  onClose,
  buildBathLink,
}: {
  open: boolean;
  onClose: () => void;
  buildBathLink: (title: string, description: string) => Promise<string>;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"idle" | "generating" | "ready" | "error">("idle");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const btnClass =
    "ui-tint-1 ui-ink-muted ui-press rounded-full border px-2.5 py-0.5 text-[9px] font-light tracking-wider transition active:scale-95 disabled:opacity-30";

  useEffect(() => {
    if (open) {
      setStatus("idle");
      setLink("");
      setCopied(false);
    }
  }, [open]);

  const generate = async () => {
    setStatus("generating");
    try {
      const url = await buildBathLink(title, description);
      setLink(url);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable (older browser/permissions) — the link field
         below is still selectable for a manual copy. */
    }
  };

  const shareNative = async () => {
    try {
      await navigator.share({
        title: title.trim() || undefined,
        text: description.trim() || undefined,
        url: link,
      });
    } catch {
      /* user dismissed the native share sheet, or it's unsupported — the
         Copy button above always works as a fallback. */
    }
  };

  if (!open) return null;

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("presets.shareBathLink")}
        onClick={(e) => e.stopPropagation()}
        className="ui-surface-solid w-full max-w-xs rounded-2xl border p-4 text-center shadow-2xl backdrop-blur-xl"
      >
        <p className="ui-ink mb-3 text-[11px] font-medium tracking-wide">
          {t("presets.shareBathLink")}
        </p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("presets.shareBathTitlePlaceholder")}
          maxLength={BATH_TITLE_MAX_LENGTH}
          className="ui-surface ui-ink ui-placeholder mb-2 w-full rounded-full border px-3 py-1.5 text-center text-[10px] outline-none"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("presets.shareBathDescriptionPlaceholder")}
          maxLength={BATH_DESCRIPTION_MAX_LENGTH}
          rows={2}
          className="ui-surface ui-ink ui-placeholder mb-3 w-full resize-none rounded-2xl border px-3 py-1.5 text-center text-[10px] outline-none"
        />
        {status === "ready" ? (
          <>
            <input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="ui-surface ui-ink-muted mb-2 w-full rounded-full border px-3 py-1.5 text-center text-[9px] outline-none"
            />
            <div className="flex flex-wrap justify-center gap-2">
              <button onClick={copyLink} className={btnClass}>
                {copied ? t("presets.copied") : t("presets.copyLink")}
              </button>
              {typeof navigator !== "undefined" && !!navigator.share && (
                <button onClick={shareNative} className={btnClass}>
                  {t("presets.shareNative")}
                </button>
              )}
              <button onClick={onClose} className={btnClass}>
                {t("common.cancel")}
              </button>
            </div>
          </>
        ) : (
          <div className="flex justify-center gap-2">
            <button onClick={onClose} className={btnClass}>
              {t("common.cancel")}
            </button>
            <button disabled={status === "generating"} onClick={generate} className={btnClass}>
              {status === "generating" ? t("presets.generating") : t("presets.generateLink")}
            </button>
          </div>
        )}
        {status === "error" && (
          <p className="mt-2 text-[9px] text-red-300/80">{t("presets.shareBathError")}</p>
        )}
      </div>
    </div>
  );
}
