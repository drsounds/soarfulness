import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { completeSpacifySignIn } from "@/lib/spacify";

// Where Spacify's consent page sends the browser back to (the OAuth
// credential's redirect URI): trades the code for tokens, then returns to
// the page the sign-in started from. See src/lib/spacify.ts.
export const Route = createFileRoute("/auth/spacify")({
  component: SpacifyCallback,
  head: () => ({ meta: [{ title: "Signing in — Aquafulness" }] }),
});

function SpacifyCallback() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // The code works once; StrictMode's second effect run mustn't reuse it.
    if (started.current) return;
    started.current = true;
    completeSpacifySignIn(new URLSearchParams(window.location.search))
      .then((returnTo) => navigate({ href: returnTo, replace: true }))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [navigate]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#050b16] p-6 text-center text-white">
      {error ? (
        <>
          <p className="text-sm">{t("spacify.signInFailed")}</p>
          <p className="max-w-sm text-xs text-white/60">{error}</p>
          <Link
            to="/"
            className="mt-2 rounded-full border border-white/20 px-3 py-1 text-xs tracking-wider"
          >
            {t("about.backToApp")}
          </Link>
        </>
      ) : (
        <p className="text-sm tracking-wider text-white/70">{t("spacify.signingIn")}</p>
      )}
    </main>
  );
}
