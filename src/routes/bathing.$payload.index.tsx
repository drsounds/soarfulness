import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Play } from "lucide-react";
import { InvalidBathLink } from "@/components/InvalidBathLink";
import { ShareIconButton } from "@/components/ShareIconButton";

// The index page for a "bathing" link — `/bathing/$payload` itself, as
// opposed to `/bathing/$payload/bathe` (bathing.$payload.bathe.tsx) which is
// the actual immersive experience. Shows what's being shared (title,
// description, a stand-in preview) before committing to loading the full
// WebGL scene, and a share icon to forward the link onward. The decoded
// payload comes from the parent route's loader (bathing.$payload.tsx) —
// this page never re-decodes it.
export const Route = createFileRoute("/bathing/$payload/")({
  component: BathPreview,
});

function BathPreview() {
  const { t } = useTranslation();
  const { payload: bathPayload } = useLoaderData({ from: "/bathing/$payload" });
  const { payload: encodedPayload } = Route.useParams();

  if (!bathPayload) return <InvalidBathLink />;

  const title = bathPayload.t?.trim() || t("bathing.defaultTitle");
  const description = bathPayload.d?.trim() || t("bathing.defaultDescription");

  return (
    <div className="flex min-h-screen flex-col bg-[#0b3d5c]">
      <div
        className="flex items-center justify-end bg-[#3f9aa8] px-2 pt-[env(safe-area-inset-top,0px)]"
        style={{ minHeight: "calc(env(safe-area-inset-top, 0px) + 3.25rem)" }}
      >
        <ShareIconButton title={title} description={description} />
      </div>

      {/* Stand-in preview: reuses the splash screen's animated meshed-
          gradient background (see .aq-splash-blob in styles.css) rather
          than a real scene thumbnail, so this page stays instant to paint
          without ever loading Three.js just to show a preview. */}
      <div className="relative flex-1 overflow-hidden bg-[#eafff2]">
        <div
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-[#eafff2] via-[#d9f5ee] to-[#eaf6ff]" />
          <div className="aq-splash-blob aq-splash-blob--1" />
          <div className="aq-splash-blob aq-splash-blob--2" />
          <div className="aq-splash-blob aq-splash-blob--3" />
          <div className="aq-splash-blob aq-splash-blob--4" />
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-4 bg-gradient-to-b from-[#1c5c86] to-[#0b3d5c] px-6 pt-8 pb-[calc(env(safe-area-inset-bottom,0px)+2.5rem)] text-center">
        <Link
          to="/bathing/$payload/bathe"
          params={{ payload: encodedPayload }}
          className="flex items-center gap-2 rounded-full bg-white px-8 py-3 text-sm font-semibold tracking-[0.08em] text-[#0b3d5c] shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <Play className="h-4 w-4 fill-current" />
          {t("bathing.bathe")}
        </Link>
        <h1 className="text-3xl font-bold text-white">{title}</h1>
        <p className="max-w-sm text-sm text-white/70">{description}</p>
      </div>
    </div>
  );
}
