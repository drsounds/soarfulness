import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { registerAppServiceWorker } from "../lib/register-sw";
import { loadStoredLanguage, detectBrowserLanguage, changeLanguage } from "../lib/i18n";
import { UI_THEME_INIT_SCRIPT } from "../lib/uiTheme";
import { CookieConsent } from "../components/CookieConsent";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
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

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
      },
      { name: "theme-color", content: "#050b16" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Aquafulness" },
      { title: "Aquafulness — Ocean Wave Meditation" },
      {
        name: "description",
        content:
          "A calming WebGL ocean where the camera drifts on the waves. Adjust swell, time of day, and wander across the sea.",
      },
      { name: "author", content: "Lovable" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "googlebot", content: "noindex, nofollow" },
      { property: "og:title", content: "Aquafulness — Ocean Wave Meditation" },
      {
        property: "og:description",
        content:
          "A calming WebGL ocean where the camera drifts on the waves. Adjust swell, time of day, and wander across the sea.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Aquafulness — Ocean Wave Meditation" },
      {
        name: "twitter:description",
        content:
          "A calming WebGL ocean where the camera drifts on the waves. Adjust swell, time of day, and wander across the sea.",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/pwa-192.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/pwa-192.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

// Measurement ID comes from the Lovable Google Analytics connector.
const GA_MEASUREMENT_ID = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY"] as
  string | undefined;

function RootShell({ children }: { children: ReactNode }) {
  // suppressHydrationWarning below: the inline theme script sets
  // data-ui-theme/data-ui-blur/class/style on <html> before React hydrates
  // (so a saved scifi/spa preference doesn't flash the aqua default) —
  // those attributes intentionally differ from the server-rendered markup,
  // the same tradeoff next-themes and shadcn's own docs make for dark-mode
  // scripts.
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Applies the saved UI chrome theme (aqua/scifi/spa, see
            src/lib/uiTheme.ts) before first paint, so a saved scifi/spa
            preference doesn't flash the aqua default for a frame. */}
        <script dangerouslySetInnerHTML={{ __html: UI_THEME_INIT_SCRIPT }} />
        {/* Google Analytics is injected client-side by CookieConsent only after
            the user accepts — no tracking script ships in the SSR HTML. */}
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    registerAppServiceWorker();
  }, []);

  // Server and the first client render always use Swedish (see lib/i18n.ts)
  // so hydration never mismatches — but TanStack Router code-splits each
  // route component behind React.lazy, so a route's own hydration can still
  // be pending (its chunk still in flight) right after this (non-lazy,
  // root-level) effect's mount. Switching the language immediately here
  // used to race that pending hydration: this effect's setState could land
  // before the lazy route's own hydration pass had finished comparing
  // itself against its Swedish SSR markup, so React found English where the
  // server had rendered Swedish, declared a hydration mismatch, and
  // discarded + rebuilt the entire route subtree — visible as a glitch/flash
  // right as the page should have become interactive. requestIdleCallback
  // waits for a genuine gap in the browser's work (not just "next tick"),
  // which in practice gives any in-flight chunk fetch/hydration time to
  // finish first; the timeout is a bound for browsers that are never idle
  // (or don't support it, e.g. Safari) so the language switch still always
  // happens promptly.
  useEffect(() => {
    const ric: typeof requestIdleCallback =
      typeof requestIdleCallback === "function"
        ? requestIdleCallback
        : (cb) => window.setTimeout(() => cb(null as unknown as IdleDeadline), 300);
    const cic: typeof cancelIdleCallback =
      typeof cancelIdleCallback === "function" ? cancelIdleCallback : window.clearTimeout;
    const id = ric(() => changeLanguage(loadStoredLanguage() ?? detectBrowserLanguage()), {
      timeout: 2000,
    });
    return () => cic(id);
  }, []);

  // iOS Safari fires these non-standard gesture events for a pinch and
  // performs its own page-zoom regardless of the viewport meta tag's
  // maximum-scale/user-scalable (Safari has ignored that for zoom since iOS
  // 10, for accessibility reasons) — preventDefault here is the documented
  // way to stop it so two-finger touches reach the app's own gesture
  // handling instead of zooming the whole page.
  useEffect(() => {
    const preventGesture = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", preventGesture);
    document.addEventListener("gesturechange", preventGesture);
    document.addEventListener("gestureend", preventGesture);
    return () => {
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("gestureend", preventGesture);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <CookieConsent measurementId={GA_MEASUREMENT_ID} />
    </QueryClientProvider>
  );
}
