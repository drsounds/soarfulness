// Enumerates every asset the app needs to run fully offline, so it can be
// eagerly downloaded into the Cache API once on first launch (see
// src/hooks/use-offline-precache.ts) instead of only being cached lazily as
// the player happens to visit each scene/environment/surface.
//
// Two asset families, cached under the same two cache names the CacheFirst
// routes in src/sw.ts read from — so a precached entry is actually served
// offline rather than triggering a redundant network fetch the first time a
// route matches it:
//   - "content": the scenes/environments/surfaces catalogs, their per-entry
//     manifest.json files, and the .glb (or .gltf, plus its referenced
//     .bin/texture files)/skybox/reflection assets they name. Discovered by
//     walking the same JSON catalogs the app itself reads
//     (public/scenes/scenes.json, public/environments/environment.json,
//     public/surfaces/surfaces.json) rather than by globbing the public/
//     directory — that directory also holds original .xcf source files for
//     the skyboxes (tens of MB) that the app never fetches and shouldn't be
//     downloaded to every player's device.
//   - "assets": same-origin CDN-hosted binaries referenced via the
//     src/assets/*.asset.json pointer files (fonts, images, the "advanced"
//     water sound) plus the two public/audio/*.m4a tracks — everything
//     loaded through an <img>/<audio> element or TextureLoader rather than
//     GLTFLoader/fetch.
export const OFFLINE_CONTENT_CACHE = "aquafulness-content";
export const OFFLINE_ASSETS_CACHE = "aquafulness-assets";

type SceneCatalog = { scenes?: { id: string }[] };
type EnvTime = { id: string };
type EnvEra = { id: string; times?: EnvTime[] };
type EnvEntry = { id: string; eras?: EnvEra[] };
type EnvironmentCatalog = { environments?: EnvEntry[] };
type SurfaceCatalog = { surfaces?: { id: string }[] };
type EnvManifest = { image?: string };
type SurfaceManifest = { image?: string };
// The subset of the glTF JSON schema this file cares about: the external
// files a .gltf references relative to its own directory (a .glb has none of
// these — buffers/images are embedded in the single binary).
type GltfDependencies = { buffers?: { uri?: string }[]; images?: { uri?: string }[] };

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// glTF buffer/image "uri" values are relative paths that are already
// percent-encoded per the spec (e.g. "textures%2Ffoo.png" for a subfolder
// entry) — decode fully, then re-encode each path segment to match how the
// rest of this file builds URLs (and how the app's static server expects them).
function resolveGltfDependencyUrl(base: string, uri: string): string {
  const decoded = decodeURIComponent(uri);
  return `${base}/${decoded.split("/").map(encodeURIComponent).join("/")}`;
}

// A scene's model file is either <id>.glb (self-contained) or <id>.gltf
// (references sibling .bin/texture files that also need caching for offline
// use) — see the loader fallback in routes/index.tsx for the same .glb-then-
// .gltf precedence.
async function resolveSceneModelUrls(base: string, sceneId: string): Promise<string[]> {
  const glbUrl = `${base}/${encodeURIComponent(sceneId)}.glb`;
  const glbHead = await fetch(glbUrl, { method: "HEAD" }).catch(() => null);
  if (glbHead?.ok) return [glbUrl];

  const gltfUrl = `${base}/${encodeURIComponent(sceneId)}.gltf`;
  const gltf = await fetchJson<GltfDependencies>(gltfUrl);
  if (!gltf) return [glbUrl];

  const urls = [gltfUrl];
  const uris = [
    ...(gltf.buffers ?? []).map((b) => b.uri),
    ...(gltf.images ?? []).map((i) => i.uri),
  ];
  for (const uri of uris) {
    if (!uri || uri.startsWith("data:")) continue;
    urls.push(resolveGltfDependencyUrl(base, uri));
  }
  return urls;
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

// Walks the scenes/environments/surfaces catalogs exactly the way the app's
// own loader effects in routes/index.tsx do, and returns every URL that
// needs to be in the cache for the whole catalog (not just whatever the
// player has picked so far) to work offline.
export async function collectOfflineAssetBuckets(): Promise<OfflineAssetBuckets> {
  const content = new Set<string>();
  const assets = new Set<string>();

  for (const mod of Object.values(STATIC_ASSET_MODULES)) {
    if (mod?.url) assets.add(mod.url);
  }
  for (const url of PUBLIC_AUDIO_URLS) assets.add(url);

  const [sceneCatalog, envCatalog, surfaceCatalog] = await Promise.all([
    fetchJson<SceneCatalog>("/scenes/scenes.json"),
    fetchJson<EnvironmentCatalog>("/environments/environment.json"),
    fetchJson<SurfaceCatalog>("/surfaces/surfaces.json"),
  ]);

  if (sceneCatalog) content.add("/scenes/scenes.json");
  if (envCatalog) content.add("/environments/environment.json");
  if (surfaceCatalog) content.add("/surfaces/surfaces.json");

  await Promise.all(
    (sceneCatalog?.scenes ?? []).map(async (scene) => {
      const base = `/scenes/${encodeURIComponent(scene.id)}`;
      content.add(`${base}/manifest.json`);
      const modelUrls = await resolveSceneModelUrls(base, scene.id);
      for (const url of modelUrls) content.add(url);
    }),
  );

  const envCombos = (envCatalog?.environments ?? []).flatMap((env) =>
    (env.eras ?? []).flatMap((era) =>
      (era.times ?? []).map((time) => ({ envId: env.id, eraId: era.id, timeId: time.id })),
    ),
  );
  await Promise.all(
    envCombos.map(async ({ envId, eraId, timeId }) => {
      const dir = `/environments/${[envId, eraId, timeId].map(encodeURIComponent).join("/")}`;
      const manifest = await fetchJson<EnvManifest>(`${dir}/manifest.json`);
      content.add(`${dir}/manifest.json`);
      const image = manifest?.image ?? "skybox.png";
      content.add(`${dir}/${encodeURIComponent(image)}`);
    }),
  );

  await Promise.all(
    (surfaceCatalog?.surfaces ?? []).map(async (surface) => {
      const dir = `/surfaces/${encodeURIComponent(surface.id)}`;
      const manifest = await fetchJson<SurfaceManifest>(`${dir}/manifest.json`);
      content.add(`${dir}/manifest.json`);
      const image = manifest?.image ?? "surface.png";
      content.add(`${dir}/${encodeURIComponent(image)}`);
    }),
  );

  return { content: Array.from(content), assets: Array.from(assets) };
}
