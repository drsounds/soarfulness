import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

// Shown by both bathing.$payload.index.tsx (the preview) and
// bathing.$payload.bathe.tsx (the actual experience) when the base62 URL
// segment couldn't be decoded back into a valid BathPayload — truncated in
// transit, hand-edited, or just garbage.
export function InvalidBathLink() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t("bathing.invalidTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("bathing.invalidMessage")}</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("bathing.goHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
