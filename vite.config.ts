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
        // A hand-written source (src/sw.ts) rather than the declarative
        // `workbox` config generateSW mode takes: its `runtimeCaching` API
        // can't express a graceful fallback for the case where a navigation
        // misses both network and cache (e.g. a client's very first ever
        // offline visit) — that always throws, which standalone/installed
        // PWA shells treat as "not connected" and silently retry, looking
        // like the app endlessly reloading. src/sw.ts adds a
        // setCatchHandler for that instead of just letting it throw.
        strategies: "injectManifest",
        srcDir: "src",
        filename: "sw.ts",
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
      }),
    ],
  },
});
