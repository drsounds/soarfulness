import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import thirdPartyPackages from "@/generated/third-party-licenses.json";

export const Route = createFileRoute("/licenses")({
  component: LicensesPage,
  head: () => ({
    meta: [
      { title: "Third-Party Licenses — Aquafulness" },
      {
        name: "description",
        content:
          "The free and open source software packages that Aquafulness is built with, and their licenses.",
      },
    ],
  }),
});

function LicensesPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/about"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            ← {t("licenses.backToAbout")}
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("licenses.backToApp")} →
          </Link>
        </div>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("licenses.title")}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t("licenses.intro")}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("licenses.count", { count: thirdPartyPackages.length })}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("licenses.tableHeading")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("licenses.columns.package")}</TableHead>
                  <TableHead>{t("licenses.columns.version")}</TableHead>
                  <TableHead>{t("licenses.columns.license")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {thirdPartyPackages.map((pkg) => (
                  <TableRow key={pkg.name}>
                    <TableCell className="font-medium">
                      <a
                        href={`https://www.npmjs.com/package/${pkg.name}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="hover:text-foreground hover:underline"
                      >
                        {pkg.name}
                      </a>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{pkg.version}</TableCell>
                    <TableCell className="text-muted-foreground">{pkg.license}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
