import { createFileRoute, Outlet } from "@tanstack/react-router";
import { decodeStateFromBase62, isValidBathPayload } from "@/lib/shareState";

// Shared parent for a "bathing" link's two pages: the preview
// (`/bathing/$payload`, see bathing.$payload.index.tsx) and the actual
// immersive experience (`/bathing/$payload/bathe`, see
// bathing.$payload.bathe.tsx). Decodes the base62 URL segment once here —
// both children read the result back via
// useLoaderData({ from: "/bathing/$payload" }) instead of re-decoding — and
// this route's head() (Open Graph/Twitter meta) applies to both child pages
// automatically, since TanStack Router merges meta across every matched
// route in a request. No server storage at all: the link itself fully
// encodes the shared settings + camera pose (see src/lib/shareState.ts).
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
  component: () => <Outlet />,
});
