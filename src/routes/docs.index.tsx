import { createFileRoute, Link } from "@tanstack/react-router";
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
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Documentation</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          This is the theory behind Aquafulness: where the idea comes from, and the perceptual
          principles — optic flow and kinesthetic movement — that the design leans on.
        </p>
      </div>

      <Alert>
        <AlertDescription className="text-muted-foreground">
          <strong className="text-foreground">Disclaimer:</strong> everything below describes
          design intent grounded in the personal experience of the project's creator, together
          with generally known perceptual concepts used as design inspiration. No medical claims
          are made. Aquafulness is not a medical device or therapy, and no statement here about
          calm, relaxation or well-being should be read as a clinically validated outcome.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>
            <Link to="/docs/background" className="hover:underline">
              1. Background and purpose
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed text-muted-foreground">
          <p>
            The concept of digital bathing, the case study behind the project, the{" "}
            <em>seeding</em> methodology, the sine-oscillation theory, and the "aquaful" state the
            app tries to induce.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <Link to="/docs/optic-flow" className="hover:underline">
              2. Optic flow and kinesthetic movement
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed text-muted-foreground">
          <p>
            How the visualization is designed around visual self-motion: slow coherent optic
            flow, rocking of the whole visual field, and the goal of recreating the felt
            experience of floating in warm water.
          </p>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        This app ("Aquafulness Core") shares its underlying theory with the original Godot-based{" "}
        <a
          href="https://github.com/drsounds/aquafulness-2028"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          Aquafulness
        </a>
        , where this documentation originates.
      </p>
    </>
  );
}
