import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

type ReferenceCitation = {
  text: string;
  url: string;
};

type ReferenceGroup = {
  title: string;
  citations: ReferenceCitation[];
  note: string;
};

export const Route = createFileRoute("/docs/references")({
  component: ReferencesDocPage,
  head: () => ({
    meta: [
      { title: "Scientific references — Aquafulness Docs" },
      {
        name: "description",
        content:
          "Real, peer-reviewed studies on optic flow, vection, rocking/vestibular stimulation and watching water, with Harvard citations and PubMed/DOI links.",
      },
    ],
  }),
});

function ReferencesDocPage() {
  const { t } = useTranslation();
  const groups = t("docsPhilosophy.references.groups", { returnObjects: true }) as ReferenceGroup[];

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
          {t("docsPhilosophy.references.title")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("docsPhilosophy.references.intro")}
        </p>
      </div>

      <Alert className="border-0 bg-transparent">
        <AlertDescription className="text-muted-foreground">
          <strong className="text-foreground">
            {t("docsPhilosophy.references.scopeNoteLabel")}
          </strong>{" "}
          {t("docsPhilosophy.references.scopeNoteBody")}
        </AlertDescription>
      </Alert>

      {groups.map((group) => (
        <Card key={group.title} className="border-0 bg-transparent shadow-none">
          <CardHeader>
            <CardTitle>{group.title}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
            <ul className="list-disc space-y-2 pl-5">
              {group.citations.map((citation) => (
                <li key={citation.url}>
                  {citation.text}{" "}
                  <a
                    href={citation.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    {citation.url}
                  </a>
                </li>
              ))}
            </ul>
            <p>{group.note}</p>
          </CardContent>
        </Card>
      ))}

      <p className="text-xs text-muted-foreground">
        {t("docsPhilosophy.references.seeAlsoBefore")}{" "}
        <Link to="/docs/optic-flow" className="underline hover:text-foreground">
          {t("docsPhilosophy.references.seeAlsoLink")}
        </Link>
      </p>
    </>
  );
}
