import { useEffect, useRef, useState } from "react";
import { isOfflineCachingEligible } from "@/lib/register-sw";
import {
  collectOfflineAssetBuckets,
  OFFLINE_ASSETS_CACHE,
  OFFLINE_CONTENT_CACHE,
} from "@/lib/offlineAssets";

// Bumped whenever the set of assets that must be offline-ready changes
// shape, so a stale "already downloaded" flag from an older build doesn't
// suppress a precache run that would actually add something new.
const READY_STORAGE_KEY = "aquafulness:offline-ready:v1";
const PRECACHE_CONCURRENCY = 5;

export type OfflinePrecacheState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "downloading"; done: number; total: number }
  | { phase: "done" }
  | { phase: "error" };

function readReadyFlag(): boolean {
  try {
    return window.localStorage.getItem(READY_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeReadyFlag() {
  try {
    window.localStorage.setItem(READY_STORAGE_KEY, "1");
  } catch {
    /* privacy mode — precache will just re-run next visit */
  }
}

// Downloads every scene/environment/surface/audio asset the app can use
// into the Cache API, once, so the app is fully playable offline right
// after this finishes rather than only for whatever the player happened to
// visit already (see src/lib/offlineAssets.ts for what gets enumerated, and
// src/sw.ts for the CacheFirst routes that then serve these offline).
// Writes go straight into the Cache API from the page itself — no
// message-passing to the service worker needed, since same-origin cache
// storage is shared between window and SW contexts — using the exact cache
// names the SW's CacheFirst routes read from, so a precached entry is
// actually served offline instead of the route re-fetching it.
export function useOfflinePrecache(): OfflinePrecacheState {
  const [state, setState] = useState<OfflinePrecacheState>({ phase: "idle" });
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    if (typeof window === "undefined" || !("caches" in window)) return;
    if (!isOfflineCachingEligible()) return;
    if (readReadyFlag()) return;
    startedRef.current = true;

    let cancelled = false;
    setState({ phase: "checking" });

    (async () => {
      if ("serviceWorker" in navigator) {
        await navigator.serviceWorker.ready.catch(() => {});
      }
      if (cancelled) return;

      const buckets = await collectOfflineAssetBuckets();
      const entries = [
        ...buckets.content.map((url) => ({ url, cacheName: OFFLINE_CONTENT_CACHE })),
        ...buckets.assets.map((url) => ({ url, cacheName: OFFLINE_ASSETS_CACHE })),
      ];
      if (cancelled) return;

      if (entries.length === 0) {
        writeReadyFlag();
        setState({ phase: "done" });
        return;
      }

      setState({ phase: "downloading", done: 0, total: entries.length });
      let done = 0;
      let hadError = false;
      let nextIndex = 0;

      async function worker() {
        while (!cancelled) {
          const i = nextIndex++;
          if (i >= entries.length) return;
          const { url, cacheName } = entries[i];
          try {
            const cache = await caches.open(cacheName);
            const alreadyCached = await cache.match(url);
            if (!alreadyCached) {
              const res = await fetch(url);
              if (res.ok) {
                await cache.put(url, res);
              } else {
                hadError = true;
              }
            }
          } catch {
            hadError = true;
          }
          done++;
          if (!cancelled) setState({ phase: "downloading", done, total: entries.length });
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(PRECACHE_CONCURRENCY, entries.length) }, worker),
      );
      if (cancelled) return;

      if (hadError) {
        setState({ phase: "error" });
      } else {
        writeReadyFlag();
        setState({ phase: "done" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
