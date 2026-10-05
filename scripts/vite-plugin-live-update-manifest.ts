// Writes .output/public/capacitor-live-update.json: the file list the
// Capacitor Android app's live updater (android/.../LiveUpdate*.java, see
// CAPACITOR_APP.md's "Live updates" section) diffs against to pull a newer
// web bundle straight from the deployed site, without a new APK.
//
// It runs on every build, not just `build:capacitor`, because the copy that
// matters is the one the deployed site (the Lovable/Cloudflare build)
// serves at /capacitor-live-update.json — the APK's own bundled copy only
// tells the updater which files it already has and can reuse instead of
// downloading again.
//
// index.html is deliberately not listed: the deployed site has none (every
// route is server-rendered on request), so the updater fetches "/" itself,
// the same way scripts/capacitor-snapshot-shell.mjs does for the APK build.
import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import type { Plugin } from "vite";

export const LIVE_UPDATE_MANIFEST = "capacitor-live-update.json";

type ManifestFile = { path: string; sha256: string; size: number };
type RemoteFile = { path: string; size?: number };

function sha256File(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(path)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });
}

function isExcluded(path: string): boolean {
  return (
    path === "index.html" ||
    path === LIVE_UPDATE_MANIFEST ||
    // capacitor-snapshot-shell.mjs strips these from the APK build; nothing
    // ever loads them, so the updater shouldn't download them either.
    path.toLowerCase().endsWith(".xcf")
  );
}

// The handful of `src/assets/*.asset.json` files point at
// /__l5e/assets-v1/... URLs that only Lovable's hosting proxies (see
// CAPACITOR_APP.md's "Known limitation" section). They aren't build output,
// so they have no hash here — the updater just downloads each one into the
// bundle once (from the deployed site, where the proxy exists), which makes
// them available offline in a live-updated bundle too.
async function collectRemoteAssets(rootDir: string): Promise<RemoteFile[]> {
  const assetsDir = join(rootDir, "src", "assets");
  if (!existsSync(assetsDir)) return [];
  const remote: RemoteFile[] = [];
  for (const name of (await readdir(assetsDir)).sort()) {
    if (!name.endsWith(".asset.json")) continue;
    try {
      const meta = JSON.parse(await readFile(join(assetsDir, name), "utf8"));
      if (typeof meta.url === "string" && meta.url.startsWith("/__l5e/")) {
        remote.push({
          path: meta.url.slice(1),
          ...(typeof meta.size === "number" ? { size: meta.size } : {}),
        });
      }
    } catch {
      // Not a Lovable asset descriptor we understand — skip it.
    }
  }
  return remote;
}

export async function writeLiveUpdateManifest(rootDir: string, publicDir: string) {
  const files: ManifestFile[] = [];
  for (const entry of await readdir(publicDir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const abs = join(entry.parentPath, entry.name);
    const path = relative(publicDir, abs).split(sep).join("/");
    if (isExcluded(path)) continue;
    const { size } = await stat(abs);
    files.push({ path, sha256: await sha256File(abs), size });
  }
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const version = createHash("sha256")
    .update(files.map((f) => `${f.path}\0${f.sha256}\n`).join(""))
    .digest("hex")
    .slice(0, 16);

  const manifest = {
    format: 1,
    version,
    generatedAt: new Date().toISOString(),
    files,
    remote: await collectRemoteAssets(rootDir),
  };
  await writeFile(join(publicDir, LIVE_UPDATE_MANIFEST), JSON.stringify(manifest), "utf8");
  return manifest;
}

export function liveUpdateManifest(): Plugin {
  let rootDir = process.cwd();
  return {
    name: "aquafulness:capacitor-live-update-manifest",
    apply: "build",
    configResolved(config) {
      rootDir = config.root;
    },
    // Nitro's multi-environment build calls closeBundle once per
    // environment; .output/public only holds the full client output (plus
    // everything from public/) by the last one, so just regenerate each
    // time — the final write is the complete, correct one.
    closeBundle: {
      order: "post",
      sequential: true,
      async handler() {
        const publicDir = join(rootDir, ".output", "public");
        if (!existsSync(publicDir)) return;
        const manifest = await writeLiveUpdateManifest(rootDir, publicDir);
        this.environment?.logger?.info(
          `[live-update] ${LIVE_UPDATE_MANIFEST}: ${manifest.files.length} files, version ${manifest.version}`,
        );
      },
    },
  };
}
