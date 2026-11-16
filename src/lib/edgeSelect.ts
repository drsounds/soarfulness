import * as THREE from "three";

// Which mesh edges the lights follow. Both NEON (apps/neon) and the
// decorative lights' edge mode (apps/string-lights) pick their edges here:
//  - by direction: an edge belongs to the X, Y or Z group when it runs along
//    that world axis (within EDGE_AXIS_COS of it), otherwise to OTHER
//    (diagonals, slopes, curves);
//  - by region: with a range on, edges are clipped to a world-space box, so
//    only the part of an edge inside min..max (metres, per axis) is lit.
// The detection itself (THREE.EdgesGeometry, creases sharper than
// EDGE_THRESHOLD_DEG) is cached per geometry and shared by both users.

export const EDGE_THRESHOLD_DEG = 30;
/** cos of the largest angle between an edge and an axis for it to count as along it (≈20°). */
export const EDGE_AXIS_COS = 0.94;

export type Vec3Tuple = [number, number, number];

export type EdgeFilter = {
  /** Edges running along world X / Y (vertical) / Z, and all others. */
  x: boolean;
  y: boolean;
  z: boolean;
  other: boolean;
  /** Clip to the box below. */
  rangeOn: boolean;
  min: Vec3Tuple;
  max: Vec3Tuple;
};

export const EDGE_RANGE_LIMIT = 5000;

export const EDGE_FILTER_DEFAULT: EdgeFilter = {
  x: true,
  y: true,
  z: true,
  other: true,
  rangeOn: false,
  min: [-50, -5, -50],
  max: [50, 30, 50],
};

export function cloneEdgeFilter(f: EdgeFilter): EdgeFilter {
  return { ...f, min: [...f.min], max: [...f.max] };
}

const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const coord = (v: unknown, d: number) =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.min(EDGE_RANGE_LIMIT, Math.max(-EDGE_RANGE_LIMIT, v))
    : d;
function triple(v: unknown, d: Vec3Tuple): Vec3Tuple {
  const a = Array.isArray(v) ? v : [];
  return [coord(a[0], d[0]), coord(a[1], d[1]), coord(a[2], d[2])];
}

/** Untrusted input (localStorage, presets, links) → a valid filter. */
export function sanitizeEdgeFilter(
  raw: unknown,
  base: EdgeFilter = EDGE_FILTER_DEFAULT,
): EdgeFilter {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const min = triple(r.min, base.min);
  const max = triple(r.max, base.max);
  // Keep min <= max per axis.
  for (let i = 0; i < 3; i++) {
    if (min[i] > max[i]) [min[i], max[i]] = [max[i], min[i]];
  }
  return {
    x: bool(r.x, base.x),
    y: bool(r.y, base.y),
    z: bool(r.z, base.z),
    other: bool(r.other, base.other),
    rangeOn: bool(r.rangeOn, base.rangeOn),
    min,
    max,
  };
}

export function edgeFilterKey(f: EdgeFilter): string {
  return [
    +f.x,
    +f.y,
    +f.z,
    +f.other,
    f.rangeOn ? `${f.min.join(",")}:${f.max.join(",")}` : "-",
  ].join("|");
}

/** True when the filter keeps every edge whole. */
export const edgeFilterIsOpen = (f: EdgeFilter) => f.x && f.y && f.z && f.other && !f.rangeOn;

export type EdgeAxis = "x" | "y" | "z" | "other";

export function classifyEdge(dx: number, dy: number, dz: number): EdgeAxis {
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-9) return "other";
  if (Math.abs(dx) / len >= EDGE_AXIS_COS) return "x";
  if (Math.abs(dy) / len >= EDGE_AXIS_COS) return "y";
  if (Math.abs(dz) / len >= EDGE_AXIS_COS) return "z";
  return "other";
}

/**
 * Clips the segment a→b to the box (Liang–Barsky). Returns [t0, t1] along
 * a→b, or null when nothing is inside.
 */
export function clipSegmentToBox(
  a: Vec3Tuple,
  b: Vec3Tuple,
  min: Vec3Tuple,
  max: Vec3Tuple,
): [number, number] | null {
  let t0 = 0;
  let t1 = 1;
  for (let i = 0; i < 3; i++) {
    const d = b[i] - a[i];
    if (Math.abs(d) < 1e-12) {
      if (a[i] < min[i] || a[i] > max[i]) return null;
      continue;
    }
    let ta = (min[i] - a[i]) / d;
    let tb = (max[i] - a[i]) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (t0 > t1) return null;
  }
  return [t0, t1];
}

const edgeCache = new WeakMap<THREE.BufferGeometry, Float32Array>();

/** Crease edges of a geometry as flat local-space segment pairs (cached). */
export function getEdgePositions(geometry: THREE.BufferGeometry): Float32Array | null {
  const hit = edgeCache.get(geometry);
  if (hit) return hit;
  if (!geometry.attributes.position) return null;
  const edges = new THREE.EdgesGeometry(geometry, EDGE_THRESHOLD_DEG);
  const arr = edges.attributes.position.array;
  const out = new Float32Array(arr.length);
  out.set(arr);
  edges.dispose();
  edgeCache.set(geometry, out);
  return out;
}

/** The plain meshes under the roots (instanced meshes are skipped). */
export function collectEdgeMeshes(roots: THREE.Object3D[]): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  const seen = new Set<THREE.Object3D>();
  for (const root of roots) {
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (seen.has(o)) return;
      seen.add(o);
      const mesh = o as THREE.Mesh;
      if (
        mesh.isMesh &&
        !(mesh as THREE.InstancedMesh).isInstancedMesh &&
        mesh.geometry?.attributes.position
      ) {
        meshes.push(mesh);
      }
    });
  }
  return meshes;
}

/**
 * Filters local-space segment pairs by the filter, judged in world space via
 * `matrixWorld`. Returns kept (and range-clipped) segments as flat world-space
 * xyz pairs.
 */
export function filterSegmentsWorld(
  local: ArrayLike<number>,
  matrixWorld: THREE.Matrix4,
  f: EdgeFilter,
): number[] {
  const out: number[] = [];
  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const a: Vec3Tuple = [0, 0, 0];
  const b: Vec3Tuple = [0, 0, 0];
  for (let i = 0; i + 5 < local.length; i += 6) {
    va.set(local[i], local[i + 1], local[i + 2]).applyMatrix4(matrixWorld);
    vb.set(local[i + 3], local[i + 4], local[i + 5]).applyMatrix4(matrixWorld);
    const axis = classifyEdge(vb.x - va.x, vb.y - va.y, vb.z - va.z);
    if (!f[axis]) continue;
    a[0] = va.x;
    a[1] = va.y;
    a[2] = va.z;
    b[0] = vb.x;
    b[1] = vb.y;
    b[2] = vb.z;
    if (f.rangeOn) {
      const t = clipSegmentToBox(a, b, f.min, f.max);
      if (!t) continue;
      if (t[1] - t[0] < 1e-6) continue;
      out.push(
        a[0] + (b[0] - a[0]) * t[0],
        a[1] + (b[1] - a[1]) * t[0],
        a[2] + (b[2] - a[2]) * t[0],
        a[0] + (b[0] - a[0]) * t[1],
        a[1] + (b[1] - a[1]) * t[1],
        a[2] + (b[2] - a[2]) * t[1],
      );
    } else {
      out.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    }
  }
  return out;
}

/** Same as filterSegmentsWorld, but returned in the mesh's local space. */
export function filterSegmentsLocal(
  local: Float32Array,
  matrixWorld: THREE.Matrix4,
  f: EdgeFilter,
): Float32Array {
  if (edgeFilterIsOpen(f)) return local;
  const world = filterSegmentsWorld(local, matrixWorld, f);
  const inv = matrixWorld.clone().invert();
  const v = new THREE.Vector3();
  const out = new Float32Array(world.length);
  for (let i = 0; i < world.length; i += 3) {
    v.set(world[i], world[i + 1], world[i + 2]).applyMatrix4(inv);
    out[i] = v.x;
    out[i + 1] = v.y;
    out[i + 2] = v.z;
  }
  return out;
}
