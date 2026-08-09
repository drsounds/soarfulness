// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null,
        devOptions: { enabled: false },
        filename: "sw.js",
        manifest: {
          name: "Aquafulness",
          short_name: "Aquafulness",
          description: "Meditative WebGL ocean where you drift on the waves.",
          theme_color: "#050b16",
          background_color: "#050b16",
          display: "standalone",
          orientation: "any",
          start_url: "/",
          scope: "/",
          icons: [
            { src: "/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
            { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
          ],
        },
        workbox: {
          // vite-plugin-pwa defaults navigateFallback to "index.html" when
          // it's not set at all, which registers a Workbox NavigationRoute
          // that gets matched (routes match in registration order) before
          // the "aquafulness-html" rule below and serves straight from the
          // precache; but this is an SSR app, so the build's precache
          // manifest never actually contains an entry for "index.html" or
          // "/" (only static files like the manifest/icons do). That made
          // the fallback a dead end offline: cache lookup miss → network
          // fetch → also fails offline → the handler throws and the browser
          // is left to silently retry the failed top-level navigation on
          // its own, which looks like the page repeatedly reloading.
          // Setting this to null suppresses that NavigationRoute so the
          // NetworkFirst rule below — which actually populates and reads
          // its own cache keyed by the navigation request — is the one
          // handling navigations.
          navigateFallback: null,
          runtimeCaching: [
            {
              urlPattern: ({ request, url }) =>
                request.mode === "navigate" &&
                !/^\/~oauth/.test(url.pathname) &&
                !/^\/api\//.test(url.pathname),
              handler: "NetworkFirst",
              options: {
                cacheName: "aquafulness-html",
                networkTimeoutSeconds: 4,
              },
            },
            {
              urlPattern: ({ request, sameOrigin }) =>
                sameOrigin &&
                ["style", "script", "worker", "image", "font"].includes(request.destination),
              handler: "CacheFirst",
              options: {
                cacheName: "aquafulness-assets",
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            // Scene/environment/surface catalogs, manifests, and .glb models are
            // loaded with plain fetch()/GLTFLoader rather than <img>/<script>
            // tags, so the browser reports no `request.destination` for them and
            // they'd otherwise fall through the rule above uncached — breaking
            // offline playback of any scene/environment/surface the user has
            // already visited. Cache them by path instead of destination.
            {
              urlPattern: ({ sameOrigin, url }) =>
                sameOrigin &&
                (url.pathname.startsWith("/scenes/") ||
                  url.pathname.startsWith("/surfaces/") ||
                  url.pathname.startsWith("/environments/")),
              handler: "CacheFirst",
              options: {
                cacheName: "aquafulness-content",
                expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
        },
      }),
    ],
  },
});
