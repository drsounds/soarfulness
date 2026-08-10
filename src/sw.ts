/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { registerRoute, setCatchHandler } from "workbox-routing";
import { CacheFirst, NetworkFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
  ({ request, url }) =>
    request.mode === "navigate" &&
    !/^\/~oauth/.test(url.pathname) &&
    !/^\/api\//.test(url.pathname),
  new NetworkFirst({ cacheName: "aquafulness-html", networkTimeoutSeconds: 4 }),
);

registerRoute(
  ({ request, sameOrigin }) =>
    sameOrigin && ["style", "script", "worker", "image", "font"].includes(request.destination),
  new CacheFirst({
    cacheName: "aquafulness-assets",
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  }),
);

// Scene/environment/surface catalogs, manifests, and .glb models are loaded
// with plain fetch()/GLTFLoader rather than <img>/<script> tags, so the
// browser reports no `request.destination` for them and they'd otherwise
// fall through the rule above uncached. Cache them by path instead.
registerRoute(
  ({ sameOrigin, url }) =>
    sameOrigin &&
    (url.pathname.startsWith("/scenes/") ||
      url.pathname.startsWith("/surfaces/") ||
      url.pathname.startsWith("/environments/")),
  new CacheFirst({
    cacheName: "aquafulness-content",
    plugins: [new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  }),
);

// The NetworkFirst navigation rule above already serves the last
// successfully cached "/" once offline — but the very first time a client
// ever goes offline, before any navigation has succeeded and been cached,
// both the network and the cache miss and its strategy throws. Left
// uncaught, that failure surfaces to the browser as a failed top-level
// navigation, which standalone/installed PWA shells treat as "not
// connected": they show their own offline interstitial and silently retry
// the navigation on a timer, which looks like the app repeatedly reloading
// with nothing ever rendering. Returning an actual Response here instead
// means the navigation always resolves to something, so there's nothing
// left for the OS shell to retry.
const OFFLINE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Aquafulness — Offline</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #050b16; color: #e6f0fa; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 24rem; width: 100%; text-align: center; }
      h1 { font-size: 1.1rem; font-weight: 500; margin: 0 0 0.5rem; }
      p { color: #9fb4c9; margin: 0 0 1.5rem; }
      button { padding: 0.6rem 1.25rem; border-radius: 999px; font: inherit; cursor: pointer; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.08); color: inherit; }
      button:active { background: rgba(255,255,255,0.15); }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>You're offline</h1>
      <p>This page hasn't loaded yet, so there's nothing saved to show offline. Connect to the internet once and it'll be available offline afterward.</p>
      <button onclick="location.reload()">Try again</button>
    </div>
  </body>
</html>`;

setCatchHandler(async ({ request }) => {
  if (request.destination === "document") {
    return new Response(OFFLINE_HTML, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  return Response.error();
});
