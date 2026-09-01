import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const Route = createFileRoute("/docs/background")({
  component: BackgroundDocPage,
  head: () => ({
    meta: [
      { title: "Background and purpose — Aquafulness Docs" },
      {
        name: "description",
        content:
          "Digital bathing, the Aquafulness case study, the seeding methodology, the sine-oscillation theory, and the 'aquaful' state.",
      },
    ],
  }),
});

function BackgroundDocPage() {
  const { t } = useTranslation();
  const steps = t("docsPhilosophy.background.section4.steps", { returnObjects: true }) as string[];

  return (
    <>
      <div>
        <Link
          to="/docs"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          ← {t("docsPhilosophy.nav.backToDocs")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {t("docsPhilosophy.background.title")}
        </h1>
      </div>

      <Alert className="border-0 bg-transparent">
        <AlertDescription className="text-muted-foreground">
          <strong className="text-foreground">{t("docsPhilosophy.background.disclaimer.label")}</strong>{" "}
          {t("docsPhilosophy.background.disclaimer.bodyBefore")}{" "}
          <em>{t("docsPhilosophy.background.disclaimer.emphasis")}</em>{" "}
          {t("docsPhilosophy.background.disclaimer.bodyAfter")}
        </AlertDescription>
      </Alert>

      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader>
          <CardTitle>{t("docsPhilosophy.background.section1.title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
          <p>{t("docsPhilosophy.background.section1.p1")}</p>
          <p>{t("docsPhilosophy.background.section1.p2")}</p>

          <div>
            <h3 className="font-medium text-foreground">
              {t("docsPhilosophy.background.section1.safety.title")}
            </h3>
            <p>{t("docsPhilosophy.background.section1.safety.body")}</p>
          </div>

          <div>
            <h3 className="font-medium text-foreground">
              {t("docsPhilosophy.background.section1.hygiene.title")}
            </h3>
            <p>{t("docsPhilosophy.background.section1.hygiene.body")}</p>
          </div>

          <div>
            <h3 className="font-medium text-foreground">
              {t("docsPhilosophy.background.section1.dressCodes.title")}
            </h3>
            <p>{t("docsPhilosophy.background.section1.dressCodes.body")}</p>
          </div>

          <div>
            <h3 className="font-medium text-foreground">
              {t("docsPhilosophy.background.section1.availability.title")}
            </h3>
            <p>{t("docsPhilosophy.background.section1.availability.body")}</p>
          </div>

          <div>
            <h3 className="font-medium text-foreground">
              {t("docsPhilosophy.background.section1.cost.title")}
            </h3>
            <p>{t("docsPhilosophy.background.section1.cost.body")}</p>
          </div>

          <div>
            <h3 className="font-medium text-foreground">
              {t("docsPhilosophy.background.section1.overcrowding.title")}
            </h3>
            <p>{t("docsPhilosophy.background.section1.overcrowding.body")}</p>
          </div>

          <div>
            <h3 className="font-medium text-foreground">
              {t("docsPhilosophy.background.section1.travel.title")}
            </h3>
            <p>{t("docsPhilosophy.background.section1.travel.body")}</p>
          </div>

          <p>
            <strong className="text-foreground">
              {t("docsPhilosophy.background.section1.conclusionLabel")}
            </strong>{" "}
            {t("docsPhilosophy.background.section1.conclusionBody")}
          </p>
        </CardContent>
      </Card>

      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader>
          <CardTitle>{t("docsPhilosophy.background.section2.title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            {t("docsPhilosophy.background.section2.p1Before")}{" "}
            <strong className="text-foreground">
              {t("docsPhilosophy.background.section2.p1Emphasis")}
            </strong>
            {t("docsPhilosophy.background.section2.p1After")}
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground">
                {t("docsPhilosophy.background.section2.imagination.term")}
              </strong>{" "}
              — {t("docsPhilosophy.background.section2.imagination.body")}
            </li>
            <li>
              <strong className="text-foreground">
                {t("docsPhilosophy.background.section2.auditory.term")}
              </strong>{" "}
              — {t("docsPhilosophy.background.section2.auditory.body")}
            </li>
            <li>
              <strong className="text-foreground">
                {t("docsPhilosophy.background.section2.visual.term")}
              </strong>{" "}
              — {t("docsPhilosophy.background.section2.visual.body")}
            </li>
            <li>
              <strong className="text-foreground">
                {t("docsPhilosophy.background.section2.audiovisual.term")}
              </strong>{" "}
              — {t("docsPhilosophy.background.section2.audiovisual.body")}
            </li>
          </ul>
          <p>{t("docsPhilosophy.background.section2.conclusion")}</p>
        </CardContent>
      </Card>

      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader>
          <CardTitle>{t("docsPhilosophy.background.section3.title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
          <p>{t("docsPhilosophy.background.section3.p1")}</p>
          <p>
            {t("docsPhilosophy.background.section3.p2Before")}{" "}
            <strong className="text-foreground">
              {t("docsPhilosophy.background.section3.p2Emphasis")}
            </strong>
            {t("docsPhilosophy.background.section3.p2After")}
          </p>
          <p>
            {t("docsPhilosophy.background.section3.p3Before")}{" "}
            <strong className="text-foreground">
              {t("docsPhilosophy.background.section3.p3Emphasis")}
            </strong>{" "}
            {t("docsPhilosophy.background.section3.p3After")}
          </p>
        </CardContent>
      </Card>

      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader>
          <CardTitle>{t("docsPhilosophy.background.section4.title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
          <p>{t("docsPhilosophy.background.section4.p1")}</p>
          <blockquote className="pl-4 italic">
            {t("docsPhilosophy.background.section4.quote")}
            <br />
            <br />
            <strong className="text-foreground not-italic">
              {t("docsPhilosophy.background.section4.quoteEmphasis")}
            </strong>
          </blockquote>
          <p>{t("docsPhilosophy.background.section4.p2")}</p>
          <ol className="list-decimal space-y-2 pl-5">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p>
            {t("docsPhilosophy.background.section4.footerBefore")}{" "}
            <a
              href="https://github.com/drsounds/aquafulness-2028"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              {t("docsPhilosophy.background.section4.footerLinkText")}
            </a>{" "}
            {t("docsPhilosophy.background.section4.footerMiddle")}{" "}
            <Link to="/docs/optic-flow" className="underline hover:text-foreground">
              {t("docsPhilosophy.background.section4.footerPageLink")}
            </Link>
            {t("docsPhilosophy.background.section4.footerAfter")}
          </p>
        </CardContent>
      </Card>
    </>
  );
}
