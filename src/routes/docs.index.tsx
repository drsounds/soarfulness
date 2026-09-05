import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const Route = createFileRoute("/docs/")({
  component: DocsIndexPage,
  head: () => ({
    meta: [
      { title: "Documentation — Aquafulness" },
      {
        name: "description",
        content:
          "The theory behind Aquafulness: digital bathing, the seeding methodology, the sine-oscillation theory, and the perceptual design of optic flow and kinesthetic movement.",
      },
    ],
  }),
});

function DocsIndexPage() {
  const { t } = useTranslation();

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("docsPhilosophy.index.title")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("docsPhilosophy.index.intro")}
        </p>
      </div>

      <Alert className="border-0 bg-transparent">
        <AlertDescription className="text-muted-foreground">
          <strong className="text-foreground">{t("docsPhilosophy.index.disclaimerLabel")}</strong>{" "}
          {t("docsPhilosophy.index.disclaimerBody")}
        </AlertDescription>
      </Alert>

      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader>
          <CardTitle>
            <Link to="/docs/background" className="hover:underline">
              {t("docsPhilosophy.index.card1.title")}
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed text-muted-foreground">
          <p>
            {t("docsPhilosophy.index.card1.bodyBefore")}{" "}
            <em>{t("docsPhilosophy.index.card1.bodyEmphasis")}</em>{" "}
            {t("docsPhilosophy.index.card1.bodyAfter")}
          </p>
        </CardContent>
      </Card>

      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader>
          <CardTitle>
            <Link to="/docs/optic-flow" className="hover:underline">
              {t("docsPhilosophy.index.card2.title")}
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed text-muted-foreground">
          <p>{t("docsPhilosophy.index.card2.body")}</p>
        </CardContent>
      </Card>

      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader>
          <CardTitle>
            <Link to="/docs/references" className="hover:underline">
              {t("docsPhilosophy.index.card3.title")}
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed text-muted-foreground">
          <p>{t("docsPhilosophy.index.card3.body")}</p>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {t("docsPhilosophy.index.footerBefore")}{" "}
        <a
          href="https://github.com/drsounds/aquafulness-2028"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          {t("docsPhilosophy.index.footerLinkText")}
        </a>
        {t("docsPhilosophy.index.footerAfter")}
      </p>
    </>
  );
}
