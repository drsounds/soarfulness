// Discovers every scene/environment/surface/audio-track bundled across the
// installed "apps" under public/apps/, and builds the URLs they're loaded
// from. The single source of truth for both the live loader effects
// (routes/index.tsx) and the offline precache walker (offlineAssets.ts),
// which used to each hand-duplicate this same catalog-walk logic against the
// old flat public/scenes, public/environments, public/surfaces layout.
//
// Layout:
//   public/apps/apps.json                      { apps: [{id, name, description?, icon?}] }
//   public/apps/<appId>/manifest.json          { scenes?, environments?, surfaces?, audio? }
//   public/apps/<appId>/scenes/<sceneId>/<sceneId>.(glb|gltf) [+ manifest.json, .bin/textures]
//   public/apps/<appId>/environments/<envId>/<eraId>/<timeId>/{manifest.json, skybox.png}
//   public/apps/<appId>/surfaces/<surfaceId>/{manifest.json, surface.png}
//   public/apps/<appId>/scenary/manifest.json  shipped scenery presets (see sceneryPresets.ts)
//   public/apps/<appId>/audio/*                per-app audio tracks
//
// Apps are a packaging/shipping unit only, not a runtime silo: the flat
// scenes/environments/surfaces/audio lists this module returns are meant to
// be freely mixed regardless of which app an entry came from (each entry is
// just tagged with the appId it shipped with, for grouping/labeling).

export type AppEntry = { id: string; name: string; description?: string; icon?: string };

export type AppEnvEra = { id: string; name: string; times: { id: string; name: string }[] };
export type AppSceneEntry = { id: string; name: string; appId: string };
export type AppEnvironmentEntry = { id: string; name: string; appId: string; eras: AppEnvEra[] };
export type AppSurfaceEntry = { id: string; name: string; appId: string };
export type AppAudioEntry = { id: string; name: string; appId: string; url: string };

export type AppCatalog = {
  apps: AppEntry[];
  scenes: AppSceneEntry[];
  environments: AppEnvironmentEntry[];
  surfaces: AppSurfaceEntry[];
  audio: AppAudioEntry[];
};

type AppContentManifest = {
  scenes?: { id: string; name: string }[];
  environments?: { id: string; name: string; eras?: AppEnvEra[] }[];
  surfaces?: { id: string; name: string }[];
  audio?: { id: string; name: string; url: string }[];
};

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function appDir(appId: string): string {
  return `/apps/${encodeURIComponent(appId)}`;
}
export function sceneDir(appId: string, sceneId: string): string {
  return `${appDir(appId)}/scenes/${encodeURIComponent(sceneId)}`;
}
export function environmentDir(appId: string, envId: string, era: string, time: string): string {
  return `${appDir(appId)}/environments/${[envId, era, time].map(encodeURIComponent).join("/")}`;
}
export function surfaceDir(appId: string, surfaceId: string): string {
  return `${appDir(appId)}/surfaces/${encodeURIComponent(surfaceId)}`;
}
export function scenaryManifestUrl(appId: string): string {
  return `${appDir(appId)}/scenary/manifest.json`;
}

export async function fetchApps(): Promise<AppEntry[]> {
  const data = await fetchJson<{ apps?: AppEntry[] }>("/apps/apps.json");
  return data?.apps ?? [];
}

async function fetchAppManifest(appId: string): Promise<AppContentManifest | null> {
  return fetchJson<AppContentManifest>(`${appDir(appId)}/manifest.json`);
}

const str = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);

// Validates a manifest's loosely-typed "environments" entries the same way
// routes/index.tsx's old parseEnvironments() validated environment.json —
// dropping anything malformed rather than letting a hand-authored typo crash
// the picker — since each app's manifest.json is still hand-authored,
// developer-edited data, not generated output.
function parseAppEnvironments(raw: unknown, appId: string): AppEnvironmentEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((e) => {
      const env = e as { id?: unknown; name?: unknown; eras?: unknown };
      if (typeof env.id !== "string") return null;
      const eras = (Array.isArray(env.eras) ? env.eras : [])
        .map((er) => {
          const era = er as { id?: unknown; name?: unknown; times?: unknown };
          if (typeof era.id !== "string") return null;
          const times = (Array.isArray(era.times) ? era.times : [])
            .map((tm) => {
              const time = tm as { id?: unknown; name?: unknown };
              return typeof time.id === "string"
                ? { id: time.id, name: str(time.name, time.id) }
                : null;
            })
            .filter((t): t is { id: string; name: string } => t !== null);
          return times.length ? { id: era.id, name: str(era.name, era.id), times } : null;
        })
        .filter((er): er is AppEnvEra => er !== null);
      return eras.length ? { id: env.id, name: str(env.name, env.id), appId, eras } : null;
    })
    .filter((e): e is AppEnvironmentEntry => e !== null);
}

// Validates a manifest's "scenes"/"surfaces"/"audio" entries — each just
// needs a string id, defaulting name (and url, for audio) when missing.
function parseIdNameList(
  raw: unknown,
  appId: string,
): { id: string; name: string; appId: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => {
      const e = s as { id?: unknown; name?: unknown };
      return typeof e.id === "string" ? { id: e.id, name: str(e.name, e.id), appId } : null;
    })
    .filter((e): e is { id: string; name: string; appId: string } => e !== null);
}

function parseAppAudio(raw: unknown, appId: string): AppAudioEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a) => {
      const e = a as { id?: unknown; name?: unknown; url?: unknown };
      return typeof e.id === "string" && typeof e.url === "string"
        ? { id: e.id, name: str(e.name, e.id), appId, url: e.url }
        : null;
    })
    .filter((e): e is AppAudioEntry => e !== null);
}

// Fetches apps.json, then every app's own manifest.json in parallel, and
// flattens their scenes/environments/surfaces/audio into single catalogs —
// each entry tagged with the appId it came from.
export async function fetchAppCatalog(): Promise<AppCatalog> {
  const apps = await fetchApps();
  const scenes: AppSceneEntry[] = [];
  const environments: AppEnvironmentEntry[] = [];
  const surfaces: AppSurfaceEntry[] = [];
  const audio: AppAudioEntry[] = [];

  await Promise.all(
    apps.map(async (app) => {
      const manifest = await fetchAppManifest(app.id);
      if (!manifest) return;
      scenes.push(...parseIdNameList(manifest.scenes, app.id));
      environments.push(...parseAppEnvironments(manifest.environments, app.id));
      surfaces.push(...parseIdNameList(manifest.surfaces, app.id));
      audio.push(...parseAppAudio(manifest.audio, app.id));
    }),
  );

  return { apps, scenes, environments, surfaces, audio };
}

// The subset of the glTF JSON schema this module cares about: the external
// files a .gltf references relative to its own directory (a .glb has none of
// these — buffers/images are embedded in the single binary).
type GltfDependencies = { buffers?: { uri?: string }[]; images?: { uri?: string }[] };

// glTF buffer/image "uri" values are relative paths that are already
// percent-encoded per the spec (e.g. "textures%2Ffoo.png" for a subfolder
// entry) — decode fully, then re-encode each path segment to match how the
// rest of this module builds URLs.
function resolveGltfDependencyUrl(dir: string, uri: string): string {
  const decoded = decodeURIComponent(uri);
  return `${dir}/${decoded.split("/").map(encodeURIComponent).join("/")}`;
}

// Resolves every URL a scene's model needs: a .glb is just itself; a .gltf
// also needs its sibling .bin/texture files (declared as relative "uri"s in
// its own JSON) — used by the offline precache walker to know what to fetch
// ahead of time (the live GLTFLoader-based loader resolves these itself).
export async function resolveSceneAssetUrls(appId: string, sceneId: string): Promise<string[]> {
  const dir = sceneDir(appId, sceneId);
  const glbUrl = `${dir}/${encodeURIComponent(sceneId)}.glb`;
  const glbHead = await fetch(glbUrl, { method: "HEAD" }).catch(() => null);
  if (glbHead?.ok) return [glbUrl];

  const gltfUrl = `${dir}/${encodeURIComponent(sceneId)}.gltf`;
  const gltf = await fetchJson<GltfDependencies>(gltfUrl);
  if (!gltf) return [glbUrl];

  const urls = [gltfUrl];
  const uris = [
    ...(gltf.buffers ?? []).map((b) => b.uri),
    ...(gltf.images ?? []).map((i) => i.uri),
  ];
  for (const uri of uris) {
    if (!uri || uri.startsWith("data:")) continue;
    urls.push(resolveGltfDependencyUrl(dir, uri));
  }
  return urls;
}
