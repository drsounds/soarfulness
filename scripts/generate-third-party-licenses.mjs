#!/usr/bin/env node
// Regenerates src/generated/third-party-licenses.json from package-lock.json.
//
// Walks the lockfile's flattened "packages" map and keeps every entry that
// is NOT dev-only (npm marks a package "dev": true only when every path to
// it goes through devDependencies) — i.e. the packages that actually ship
// as part of the built app, which is what an OSS attribution page needs to
// list. Re-run this after any dependency change: `npm run licenses:generate`.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const lockfile = JSON.parse(
  await readFile(new URL("../package-lock.json", import.meta.url), "utf8"),
);

function compareVersions(a, b) {
  const pa = a.split(/[.-]/).map((n) => (Number.isNaN(Number(n)) ? n : Number(n)));
  const pb = b.split(/[.-]/).map((n) => (Number.isNaN(Number(n)) ? n : Number(n)));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x === y) continue;
    if (typeof x === "number" && typeof y === "number") return x - y;
    return String(x) > String(y) ? 1 : -1;
  }
  return 0;
}

const byName = new Map();

for (const [key, pkg] of Object.entries(lockfile.packages ?? {})) {
  if (key === "" || !key.startsWith("node_modules/")) continue;
  if (pkg.dev) continue;
  if (!pkg.license || !pkg.version) continue;

  const name = key.split("node_modules/").pop();
  const existing = byName.get(name);
  if (!existing || compareVersions(pkg.version, existing.version) > 0) {
    byName.set(name, { name, version: pkg.version, license: pkg.license });
  }
}

const packages = [...byName.values()].sort((a, b) =>
  a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
);

const outPath = new URL("../src/generated/third-party-licenses.json", import.meta.url);
await writeFile(outPath, JSON.stringify(packages, null, 2) + "\n");

console.log(`Wrote ${packages.length} packages to ${fileURLToPath(outPath).replace(rootDir, "")}`);
