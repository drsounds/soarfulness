import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { changeLanguage, SUPPORTED_LANGUAGES, LANGUAGE_NAMES, type LanguageCode } from "@/lib/i18n";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "About & Privacy Policy — Aquafulness" },
      {
        name: "description",
        content:
          "Operator contact details, EU consumer protection information, entertainment-only disclaimer, and the privacy policy for Aquafulness.",
      },
    ],
  }),
});

function InlineLanguageSwitcher() {
  const { i18n, t } = useTranslation();
  return (
    <label className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1">
      <span className="text-[10px] font-light tracking-[0.28em] text-muted-foreground">
        {t("language.label")}
      </span>
      <select
        value={i18n.language}
        onChange={(e) => changeLanguage(e.target.value as LanguageCode)}
        className="cursor-pointer appearance-none bg-transparent text-xs font-medium tracking-wide text-foreground outline-none"
      >
        {SUPPORTED_LANGUAGES.map((code) => (
          <option key={code} value={code} className="bg-background text-foreground">
            {LANGUAGE_NAMES[code]}
          </option>
        ))}
      </select>
    </label>
  );
}

function AboutPage() {
  const { t } = useTranslation();
  const aiTransparencyPoints = t("about.sections.aiTransparency.points", {
    returnObjects: true,
  }) as string[];
  const disclaimerPoints = t("about.sections.disclaimer.points", {
    returnObjects: true,
  }) as string[];
  const trackingPoints = t("privacy.sections.tracking.points", { returnObjects: true }) as string[];

  return (
    <div className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            ← {t("about.backToApp")}
          </Link>
          <InlineLanguageSwitcher />
        </div>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("about.title")}</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("about.sections.intro.heading")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-muted-foreground">
            <p>{t("about.sections.intro.body")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("about.sections.trader.heading")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm leading-relaxed">
            <p className="text-muted-foreground">{t("about.sections.trader.note")}</p>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-[auto_1fr]">
              <dt className="font-medium text-foreground sm:text-right">
                {t("about.sections.trader.addressLabel")}
              </dt>
              <dd className="text-muted-foreground">
                {t("about.sections.trader.name")}
                <br />
                {t("about.sections.trader.address")}
              </dd>
              <dt className="font-medium text-foreground sm:text-right">
                {t("about.sections.trader.phoneLabel")}
              </dt>
              <dd className="text-muted-foreground">
                <a
                  href={`tel:${t("about.sections.trader.phone").replace(/[^+\d]/g, "")}`}
                  className="hover:text-foreground hover:underline"
                >
                  {t("about.sections.trader.phone")}
                </a>
              </dd>
              <dt className="font-medium text-foreground sm:text-right">
                {t("about.sections.trader.emailLabel")}
              </dt>
              <dd className="text-muted-foreground">
                <a
                  href={`mailto:${t("about.sections.trader.email")}`}
                  className="hover:text-foreground hover:underline"
                >
                  {t("about.sections.trader.email")}
                </a>
              </dd>
            </dl>
            <p className="text-xs text-muted-foreground">{t("about.sections.trader.capacity")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("about.sections.product.heading")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-muted-foreground">
            <p>{t("about.sections.product.body")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("about.sections.documentation.heading")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm leading-relaxed">
            <p className="text-muted-foreground">{t("about.sections.documentation.body")}</p>
            <Link
              to="/docs"
              className="text-sm font-medium text-foreground underline underline-offset-4 hover:no-underline"
            >
              {t("about.sections.documentation.linkLabel")} →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("about.sections.openSource.heading")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm leading-relaxed">
            <p className="text-muted-foreground">{t("about.sections.openSource.body")}</p>
            <Link
              to="/licenses"
              className="text-sm font-medium text-foreground underline underline-offset-4 hover:no-underline"
            >
              {t("about.sections.openSource.linkLabel")} →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("about.sections.aiTransparency.heading")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm leading-relaxed">
            <p className="text-muted-foreground">{t("about.sections.aiTransparency.body")}</p>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
              {aiTransparencyPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("about.sections.disclaimer.heading")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
              {disclaimerPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">{t("about.lastUpdated")}</p>

        <Separator className="my-2" />

        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{t("privacy.title")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("privacy.intro")}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("privacy.sections.tracking.heading")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
              {trackingPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("privacy.sections.localStorage.heading")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-muted-foreground">
            <p>{t("privacy.sections.localStorage.body")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("privacy.sections.thirdParty.heading")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-muted-foreground">
            <p>{t("privacy.sections.thirdParty.body")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("privacy.sections.contact.heading")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-muted-foreground">
            <p>{t("privacy.sections.contact.body")}</p>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">{t("privacy.lastUpdated")}</p>
      </div>
    </div>
  );
}
