import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { useRef } from "react";
import {
  Aquafulness,
  STORAGE_KEY,
  CAMERA_STORAGE_KEY,
  SEEDED_PAYLOAD_KEY,
  type CameraPose,
} from "@/routes/index";
import { InvalidBathLink } from "@/components/InvalidBathLink";

// The actual immersive experience behind a "bathing" link — as opposed to
// `/bathing/$payload` (bathing.$payload.index.tsx), which only shows a
// preview. The decoded payload comes from the parent route's loader
// (bathing.$payload.tsx); this route never re-decodes it.
export const Route = createFileRoute("/bathing/$payload/bathe")({
  component: BatheRoute,
});

function BatheRoute() {
  const { payload } = useLoaderData({ from: "/bathing/$payload" });
  const { payload: encoded } = Route.useParams();
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
      let alreadySeeded = false;
      try {
        alreadySeeded = window.sessionStorage.getItem(SEEDED_PAYLOAD_KEY) === encoded;
      } catch {
        /* sessionStorage unavailable — seed as before */
      }
      if (!alreadySeeded) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload.s));
        if (payload.c) {
          const pose: CameraPose = payload.c;
          window.localStorage.setItem(CAMERA_STORAGE_KEY, JSON.stringify(pose));
        }
        try {
          window.sessionStorage.setItem(SEEDED_PAYLOAD_KEY, encoded);
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* quota or privacy mode — the bath still opens, just with whatever
         settings/pose were already there. */
    }
  }

  if (!payload) return <InvalidBathLink />;
  return <Aquafulness />;
}
