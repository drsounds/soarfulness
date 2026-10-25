import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Forward } from "lucide-react";
import { canShareNatively, shareLink, toPublicUrl } from "@/lib/appLinks";

// Top-right icon button on the bathing preview page (bathing.$payload.index
// .tsx): shares (or, lacking the Web Share API, copies) the *current* page
// URL exactly as the visitor arrived at it (on the public site's origin, so
// it also works when shared from inside the app). Deliberately simpler than DELA
// BADLÄNK in the settings panel — that one re-encodes a fresh link from
// live state; this one just forwards the link already open.
export function ShareIconButton({ title, description }: { title: string; description: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = toPublicUrl(
      `${window.location.pathname}${window.location.search}${window.location.hash}`,
    );
    if (canShareNatively()) {
      try {
        await shareLink({ title, text: description, url });
      } catch {
        /* user dismissed the native share sheet — nothing to do */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable (older browser/permissions) — no further
         fallback on this compact icon button. */
    }
  };

  const label = copied ? t("presets.copied") : t("bathing.shareAria");

  return (
    <button
      type="button"
      onClick={() => void share()}
      aria-label={label}
      title={label}
      className="flex h-10 w-10 items-center justify-center rounded-full text-white/90 transition active:scale-90 active:bg-white/15"
    >
      <Forward className="h-6 w-6" strokeWidth={2} />
    </button>
  );
}
