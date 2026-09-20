// Enumerates every asset the app needs to run fully offline, so it can be
// eagerly downloaded into the Cache API once on first launch (see
// src/hooks/use-offline-precache.ts) instead of only being cached lazily as
// the player happens to visit each scene/environment/surface.
//
// Two asset families, cached under the same two cache names the CacheFirst
// routes in src/sw.ts read from — so a precached entry is actually served
// offline rather than triggering a redundant network fetch the first time a
// route matches it:
//   - "content": apps.json, every installed app's own manifest.json, and the
//     scenes/environments/surfaces (+ per-scene .glb/.gltf dependencies,
//     +skybox/reflection images) they list — see src/lib/appCatalog.ts for
//     the shared catalog-walk/path-building logic this and the live scene
//     loader (routes/index.tsx) both use, instead of each re-implementing it.
//     Deliberately discovered by walking apps.json -> each app's manifest.json
//     rather than by globbing public/ — that directory also holds original
//     .xcf source files for the skyboxes (tens of MB) that the app never
//     fetches and shouldn't be downloaded to every player's device.
//   - "assets": same-origin CDN-hosted binaries referenced via the
//     src/assets/*.asset.json pointer files (fonts, images, the "advanced"
//     water sound) plus the two public/audio/*.m4a tracks and every
//     installed app's own audio tracks — everything loaded through an
//     <img>/<audio> element or TextureLoader rather than GLTFLoader/fetch.
import {
  appDir,
  environmentDir,
  fetchAppCatalog,
  resolveSceneAssetUrls,
  scenaryManifestUrl,
  surfaceDir,
} from "@/lib/appCatalog";

export const OFFLINE_CONTENT_CACHE = "aquafulness-content";
export const OFFLINE_ASSETS_CACHE = "aquafulness-assets";

type EnvManifest = { image?: string };
type SurfaceManifest = { image?: string };

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// Same-origin CDN pointer files bundled into the JS build (see
// src/lib/settingsShared.ts's `waterAsset` import for the pattern) — every
// *.asset.json under src/assets resolves to `{ url: "/__l5e/assets-v1/..." }`
// at build time, so this glob picks up new ones automatically.
const STATIC_ASSET_MODULES = import.meta.glob("../assets/*.asset.json", {
  eager: true,
  import: "default",
}) as Record<string, { url?: string } | undefined>;

// Recorded water-sound tracks served straight out of public/audio (the
// "advanced" track lives in src/assets instead — see WATER_SOUNDS in
// settingsShared.ts — and is already covered by STATIC_ASSET_MODULES above).
const PUBLIC_AUDIO_URLS = ["/audio/water-simple.m4a", "/audio/ocean.m4a"];

export type OfflineAssetBuckets = {
  content: string[];
  assets: string[];
};

// Walks apps.json -> each installed app's manifest.json exactly the way the
// app's own loader effects in routes/index.tsx do (via src/lib/appCatalog.ts),
// and returns every URL that needs to be in the cache for the whole catalog
// (not just whatever the player has picked so far) to work offline.
export async function collectOfflineAssetBuckets(): Promise<OfflineAssetBuckets> {
  const content = new Set<string>();
  const assets = new Set<string>();

  for (const mod of Object.values(STATIC_ASSET_MODULES)) {
    if (mod?.url) assets.add(mod.url);
  }
  for (const url of PUBLIC_AUDIO_URLS) assets.add(url);

  const catalog = await fetchAppCatalog();
  if (catalog.apps.length > 0) content.add("/apps/apps.json");
  for (const app of catalog.apps) {
    content.add(`${appDir(app.id)}/manifest.json`);
  }

  await Promise.all(
    catalog.scenes.map(async (scene) => {
      const urls = await resolveSceneAssetUrls(scene.appId, scene.id);
      for (const url of urls) content.add(url);
    }),
  );

  await Promise.all(
    catalog.environments.flatMap((env) =>
      env.eras.flatMap((era) =>
        era.times.map(async (time) => {
          const dir = environmentDir(env.appId, env.id, era.id, time.id);
          const manifest = await fetchJson<EnvManifest>(`${dir}/manifest.json`);
          content.add(`${dir}/manifest.json`);
          const image = manifest?.image ?? "skybox.png";
          content.add(`${dir}/${encodeURIComponent(image)}`);
        }),
      ),
    ),
  );

  await Promise.all(
    catalog.surfaces.map(async (surface) => {
      const dir = surfaceDir(surface.appId, surface.id);
      const manifest = await fetchJson<SurfaceManifest>(`${dir}/manifest.json`);
      content.add(`${dir}/manifest.json`);
      const image = manifest?.image ?? "surface.png";
      content.add(`${dir}/${encodeURIComponent(image)}`);
    }),
  );

  for (const track of catalog.audio) assets.add(track.url);

  // Each app's shipped scenery presets (see src/lib/sceneryPresets.ts) — a
  // small JSON file, but still needed offline so the scenery selector
  // dialog's default presets list is available without a network round trip.
  for (const app of catalog.apps) content.add(scenaryManifestUrl(app.id));

  return { content: Array.from(content), assets: Array.from(assets) };
}
