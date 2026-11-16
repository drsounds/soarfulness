// Minimal semver range check for app manifests: "*", "x", exact "1.2.3",
// "^1.2.3" (same major, >=), "~1.2.3" (same major.minor, >=), "1.x" / "1.2.x".
// Enough for apps inside one repo; no prerelease tags.

type V = [number, number, number];

export function parseVersion(v: string): V | null {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function cmp(a: V, b: V): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

export function satisfies(version: string, range: string): boolean {
  const v = parseVersion(version);
  if (!v) return false;
  const r = range.trim();
  if (r === "*" || r === "x" || r === "") return true;
  const wild = /^(\d+)(?:\.(\d+|x))?(?:\.x)?$/.exec(r);
  if (wild && (r.includes("x") || !r.includes("."))) {
    if (v[0] !== Number(wild[1])) return false;
    return wild[2] === undefined || wild[2] === "x" || v[1] === Number(wild[2]);
  }
  const op = r[0] === "^" || r[0] === "~" ? r[0] : "";
  const base = parseVersion(op ? r.slice(1) : r);
  if (!base) return false;
  if (op === "") return cmp(v, base) === 0;
  if (cmp(v, base) < 0) return false;
  if (op === "^") return v[0] === base[0];
  return v[0] === base[0] && v[1] === base[1];
}
