import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const Route = createFileRoute("/docs/optic-flow")({
  component: OpticFlowDocPage,
  head: () => ({
    meta: [
      { title: "Optic flow and kinesthetic movement — Aquafulness Docs" },
      {
        name: "description",
        content:
          "The perceptual design of Aquafulness: optic flow, vection and kinesthetic movement, and why watching sine-driven waves is designed to feel calming.",
      },
    ],
  }),
});

function OpticFlowDocPage() {
  const { t } = useTranslation();

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
          {t("docsPhilosophy.opticFlow.title")}
        </h1>
      </div>

      <Alert>
        <AlertDescription className="text-muted-foreground">
          <strong className="text-foreground">{t("docsPhilosophy.opticFlow.disclaimerLabel")}</strong>{" "}
          {t("docsPhilosophy.opticFlow.disclaimerBody")}
        </AlertDescription>
      </Alert>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>{t("docsPhilosophy.opticFlow.section1.title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            {t("docsPhilosophy.opticFlow.section1.p1Before")}{" "}
            <em>{t("docsPhilosophy.opticFlow.section1.p1Emphasis")}</em>{" "}
            {t("docsPhilosophy.opticFlow.section1.p1After")}
          </p>
          <p>{t("docsPhilosophy.opticFlow.section1.p2")}</p>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>{t("docsPhilosophy.opticFlow.section2.title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            <strong className="text-foreground">
              {t("docsPhilosophy.opticFlow.section2.p1Term")}
            </strong>{" "}
            {t("docsPhilosophy.opticFlow.section2.p1Body")}
          </p>
          <p>{t("docsPhilosophy.opticFlow.section2.p2")}</p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong className="text-foreground">
                {t("docsPhilosophy.opticFlow.section2.layer1.term")}
              </strong>{" "}
              {t("docsPhilosophy.opticFlow.section2.layer1.body")}
            </li>
            <li>
              <strong className="text-foreground">
                {t("docsPhilosophy.opticFlow.section2.layer2.term")}
              </strong>{" "}
              {t("docsPhilosophy.opticFlow.section2.layer2.body")}
            </li>
            <li>
              <strong className="text-foreground">
                {t("docsPhilosophy.opticFlow.section2.layer3.term")}
              </strong>{" "}
              {t("docsPhilosophy.opticFlow.section2.layer3.body")}
            </li>
          </ol>
          <p>
            {t("docsPhilosophy.opticFlow.section2.p3Before")}{" "}
            <strong className="text-foreground">
              {t("docsPhilosophy.opticFlow.section2.p3Emphasis")}
            </strong>
            {t("docsPhilosophy.opticFlow.section2.p3After")}
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>{t("docsPhilosophy.opticFlow.section3.title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            {t("docsPhilosophy.opticFlow.section3.p1Before")}{" "}
            <strong className="text-foreground">
              {t("docsPhilosophy.opticFlow.section3.p1Emphasis")}
            </strong>{" "}
            {t("docsPhilosophy.opticFlow.section3.p1After")}
          </p>
          <p>{t("docsPhilosophy.opticFlow.section3.p2")}</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              {t("docsPhilosophy.opticFlow.section3.bullet1Before")}{" "}
              <strong className="text-foreground">
                {t("docsPhilosophy.opticFlow.section3.bullet1Emphasis")}
              </strong>
              {t("docsPhilosophy.opticFlow.section3.bullet1After")}
            </li>
            <li>{t("docsPhilosophy.opticFlow.section3.bullet2")}</li>
            <li>{t("docsPhilosophy.opticFlow.section3.bullet3")}</li>
          </ul>
          <p>
            {t("docsPhilosophy.opticFlow.section3.p3Before")}{" "}
            <strong className="text-foreground">
              {t("docsPhilosophy.opticFlow.section3.p3Term")}
            </strong>{" "}
            {t("docsPhilosophy.opticFlow.section3.p3After")}
          </p>
          <p>{t("docsPhilosophy.opticFlow.section3.p4")}</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground">
                {t("docsPhilosophy.opticFlow.section3.predictability.term")}
              </strong>{" "}
              {t("docsPhilosophy.opticFlow.section3.predictability.body")}
            </li>
            <li>
              <strong className="text-foreground">
                {t("docsPhilosophy.opticFlow.section3.stableFrame.term")}
              </strong>{" "}
              {t("docsPhilosophy.opticFlow.section3.stableFrame.body")}
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>{t("docsPhilosophy.opticFlow.section4.title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
          <p>{t("docsPhilosophy.opticFlow.section4.p1")}</p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong className="text-foreground">
                {t("docsPhilosophy.opticFlow.section4.reason1.term")}
              </strong>{" "}
              {t("docsPhilosophy.opticFlow.section4.reason1.body")}
            </li>
            <li>
              <strong className="text-foreground">
                {t("docsPhilosophy.opticFlow.section4.reason2.term")}
              </strong>{" "}
              {t("docsPhilosophy.opticFlow.section4.reason2.body")}
            </li>
            <li>
              <strong className="text-foreground">
                {t("docsPhilosophy.opticFlow.section4.reason3.term")}
              </strong>{" "}
              {t("docsPhilosophy.opticFlow.section4.reason3.body")}
            </li>
          </ol>
          <p>
            {t("docsPhilosophy.opticFlow.section4.p2Before")}{" "}
            <strong className="text-foreground">
              {t("docsPhilosophy.opticFlow.section4.p2Emphasis")}
            </strong>{" "}
            {t("docsPhilosophy.opticFlow.section4.p2After")}
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>{t("docsPhilosophy.opticFlow.section5.title")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed text-muted-foreground">
          <p>{t("docsPhilosophy.opticFlow.section5.p1")}</p>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {t("docsPhilosophy.opticFlow.seeAlsoBefore")}{" "}
        <Link to="/docs/background" className="underline hover:text-foreground">
          {t("docsPhilosophy.opticFlow.seeAlsoLink")}
        </Link>
      </p>

      <p className="text-xs text-muted-foreground">
        {t("docsPhilosophy.opticFlow.furtherReading.before")}{" "}
        <Link to="/docs/references" className="underline hover:text-foreground">
          {t("docsPhilosophy.opticFlow.furtherReading.link")}
        </Link>{" "}
        {t("docsPhilosophy.opticFlow.furtherReading.after")}
      </p>
    </>
  );
}
