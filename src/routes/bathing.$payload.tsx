import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef } from "react";
import { Aquafulness, STORAGE_KEY, CAMERA_STORAGE_KEY, type CameraPose } from "@/routes/index";
import { decodeStateFromBase62, isValidBathPayload } from "@/lib/shareState";

// A "bathing" link (see the DELA BADLÄNK control in SettingsPanel.tsx and
// src/lib/shareState.ts) fully encodes one visitor's settings + camera pose
// into this route's own URL segment — no server storage at all, decentralized
// by design. Opening the link decodes that payload (server-side in the
// loader below, so title/description are available for the Open Graph
// preview even before any JS runs) and seeds the exact same localStorage
// keys the main "/" route already reads once at mount (loadSettings/
// loadCameraPose in routes/index.tsx), then renders that same route
// component — so a bath link behaves exactly like importing a full state
// file, just carried entirely in the URL instead of a download.
export const Route = createFileRoute("/bathing/$payload")({
  loader: async ({ params }) => {
    try {
      const decoded = await decodeStateFromBase62(params.payload);
      if (!isValidBathPayload(decoded)) return { payload: null };
      return { payload: decoded };
    } catch {
      return { payload: null };
    }
  },
  head: ({ loaderData }) => {
    const payload = loaderData?.payload ?? null;
    const title = payload?.t?.trim() || "A shared bath — Aquafulness";
    const description =
      payload?.d?.trim() ||
      "Someone shared their Aquafulness ocean with you — open it to step straight into their exact waves, camera and settings.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
    };
  },
  component: BathingRoute,
});

function InvalidBathLink() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This bath link couldn't be read
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may be truncated or corrupted. You can still start fresh instead.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function BathingRoute() {
  const { payload } = Route.useLoaderData();
  // Seeds the same localStorage keys the "/" route's own Aquafulness
  // component reads once at mount (see routes/index.tsx's loadSettings/
  // loadCameraPose), so by the time it renders below it boots straight into
  // this shared state — exactly as if the visitor had just imported a full
  // state file. Runs synchronously in the render body (guarded by this ref
  // so it only ever fires once per mount) rather than in an effect, since an
  // effect here would fire *after* the child Aquafulness below has already
  // rendered its own first pass and read the old values.
  const seeded = useRef(false);
  if (!seeded.current && typeof window !== "undefined" && payload) {
    seeded.current = true;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload.s));
      if (payload.c) {
        const pose: CameraPose = payload.c;
        window.localStorage.setItem(CAMERA_STORAGE_KEY, JSON.stringify(pose));
      }
    } catch {
      /* quota or privacy mode — the bath still opens, just with whatever
         settings/pose were already there. */
    }
  }

  if (!payload) return <InvalidBathLink />;
  return <Aquafulness />;
}
