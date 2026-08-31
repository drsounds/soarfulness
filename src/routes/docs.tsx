import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

// Shared shell for the /docs section — the in-app rendering of docs/*.md
// (the Aquafulness theory: the case study, seeding, the sine-oscillation
// theory, and optic flow/kinesthetics). See docs.index.tsx, docs.background.tsx
// and docs.optic-flow.tsx for the pages themselves.
export const Route = createFileRoute("/docs")({
  component: DocsLayout,
});

function DocsLayout() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/about"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            ← {t("docsPhilosophy.nav.backToAbout")}
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("docsPhilosophy.nav.backToApp")} →
          </Link>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
