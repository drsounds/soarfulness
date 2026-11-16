import * as THREE from "three";
import {
  cloneEdgeFilter,
  collectEdgeMeshes,
  edgeFilterKey,
  filterSegmentsWorld,
  getEdgePositions,
  type Vec3Tuple,
} from "@/lib/edgeSelect";
import { bulbGeometry } from "./bulbGeometry";
import { GlowPoints } from "./GlowPoints";
import { BulbShader } from "./shadeBulbs";
import type { EdgeLights } from "./stringLights";

// KANTLJUS renderer: bulbs strung along the mesh edges of the loaded scene
// (and optionally imported .glb files). The edges come from the same
// detection and filter as NEON (lib/edgeSelect.ts), are sampled every
// `spacing` metres (widened to stay under `maxBulbs`) and drawn as one
// instanced bulb mesh plus one set of glow sprites, so the whole thing is a
// handful of draw calls however many bulbs there are. Bulbs are placed in
// world space when built, so the build is redone when the loaded model, the
// filter or the layout settings change; colors are written every frame.

type Built = {
  key: string;
  n: number;
  bulbs: THREE.InstancedMesh;
  glow: GlowPoints;
  seeds: Float32Array;
};

export type EdgeLightsFrame = {
  edge: EdgeLights;
  /** Edge sources: the scene model and, when allowed, imported .glb roots. */
  roots: THREE.Object3D[];
  glowMul: number;
  /** Viewport px per metre at 1 m, for sizing glows. */
  scale: number;
  /** Where the camera is: bulbs are built within `edge.radius` of it. */
  center: THREE.Vector3;
};

export class EdgeLightsFx {
  readonly group = new THREE.Group();
  private built: Built | null = null;
  private builtCenter = new THREE.Vector3(1e9, 0, 0);
  private readonly bulbMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  private readonly shader = new BulbShader();
  private rootIds = new WeakMap<THREE.Object3D, number>();
  private nextId = 1;

  constructor(parent: THREE.Object3D) {
    this.group.name = "edgeLights";
    parent.add(this.group);
  }

  /** How many bulbs the current edges got (for the panel's readout). */
  get count(): number {
    return this.built?.n ?? 0;
  }

  private idOf(o: THREE.Object3D) {
    let id = this.rootIds.get(o);
    if (!id) {
      id = this.nextId++;
      this.rootIds.set(o, id);
    }
    return id;
  }

  private clear() {
    const b = this.built;
    if (!b) return;
    b.bulbs.removeFromParent();
    b.bulbs.geometry.dispose();
    b.bulbs.dispose();
    b.glow.dispose();
    this.built = null;
  }

  private build(frame: EdgeLightsFrame, key: string) {
    const { edge, roots } = frame;
    // The user's filter, narrowed to a box around the camera so a big scene
    // doesn't spread the bulb budget over edges nobody can see.
    const filter = cloneEdgeFilter(edge.filter);
    if (edge.radius > 0) {
      const c = frame.center;
      const lo: Vec3Tuple = [c.x - edge.radius, c.y - edge.radius, c.z - edge.radius];
      const hi: Vec3Tuple = [c.x + edge.radius, c.y + edge.radius, c.z + edge.radius];
      if (filter.rangeOn) {
        for (let i = 0; i < 3; i++) {
          lo[i] = Math.max(lo[i], filter.min[i]);
          hi[i] = Math.max(lo[i], Math.min(hi[i], filter.max[i]));
        }
      }
      filter.rangeOn = true;
      filter.min = lo;
      filter.max = hi;
    }
    this.builtCenter.copy(frame.center);
    // Gather the filtered edges in world space.
    const segs: number[] = [];
    for (const mesh of collectEdgeMeshes(roots)) {
      const all = getEdgePositions(mesh.geometry);
      if (!all || all.length === 0) continue;
      const kept = filterSegmentsWorld(all, mesh.matrixWorld, filter);
      for (let i = 0; i < kept.length; i++) segs.push(kept[i]);
    }
    let total = 0;
    for (let i = 0; i + 5 < segs.length; i += 6) {
      total += Math.hypot(
        segs[i + 3] - segs[i],
        segs[i + 4] - segs[i + 1],
        segs[i + 5] - segs[i + 2],
      );
    }
    // Widen the spacing so the bulb count stays under the cap.
    const step = Math.max(edge.spacing, total / edge.maxBulbs);
    const pts: number[] = [];
    for (let i = 0; i + 5 < segs.length; i += 6) {
      const dx = segs[i + 3] - segs[i];
      const dy = segs[i + 4] - segs[i + 1];
      const dz = segs[i + 5] - segs[i + 2];
      const len = Math.hypot(dx, dy, dz);
      if (len < step * 0.4) continue;
      const k = Math.max(1, Math.round(len / step));
      for (let j = 0; j < k; j++) {
        const u = (j + 0.5) / k;
        pts.push(segs[i] + dx * u, segs[i + 1] + dy * u, segs[i + 2] + dz * u);
      }
    }
    const n = Math.min(pts.length / 3, edge.maxBulbs);
    this.clear();
    if (n === 0) {
      this.lastBuiltEmpty = key;
      return;
    }
    this.lastBuiltEmpty = "";
    const size = edge.bulbStyle === "fairy" ? edge.bulbSize * 0.45 : edge.bulbSize;
    const bulbs = new THREE.InstancedMesh(bulbGeometry(edge.bulbStyle), this.bulbMat, n);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const scale = new THREE.Vector3(size, size, size);
    const pos = new THREE.Vector3();
    const gpos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos.set(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]);
      m.compose(pos, q, scale);
      bulbs.setMatrixAt(i, m);
      gpos.set([pos.x, pos.y, pos.z], i * 3);
    }
    bulbs.instanceMatrix.needsUpdate = true;
    bulbs.setColorAt(0, new THREE.Color(1, 1, 1));
    bulbs.frustumCulled = false;
    bulbs.raycast = () => {};
    this.group.add(bulbs);
    const glow = new GlowPoints(gpos);
    glow.addTo(this.group);
    const seeds = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const h = Math.sin((i + 1) * 78.233) * 43758.5453;
      seeds[i] = h - Math.floor(h);
    }
    this.built = { key, n, bulbs, glow, seeds };
  }

  private lastBuiltEmpty = "";

  /** Builds / recolors for this frame; pass null when edge lights are off. */
  update(t: number, frame: EdgeLightsFrame | null) {
    if (!frame || frame.roots.length === 0) {
      this.clear();
      this.lastBuiltEmpty = "";
      this.group.visible = false;
      return;
    }
    const e = frame.edge;
    const key = [
      frame.roots.map((r) => this.idOf(r)).join(","),
      edgeFilterKey(e.filter),
      e.spacing,
      e.maxBulbs,
      e.radius,
      e.bulbSize,
      e.bulbStyle,
    ].join("|");
    // Rebuild when a setting changed, or the camera has moved far enough
    // from where the bulbs were placed that the lit area no longer covers it.
    const moved =
      e.radius > 0 && frame.center.distanceTo(this.builtCenter) > Math.max(2, e.radius * 0.3);
    const stale = (this.built?.key ?? this.lastBuiltEmpty) !== key;
    if (stale || moved) this.build(frame, key);
    const b = this.built;
    this.group.visible = !!b;
    if (!b) return;
    this.shader.shade(t, e, b.n, b.seeds, b.bulbs, b.glow.array, frame.glowMul);
    b.glow.commit();
    b.glow.setStyle(
      (e.bulbStyle === "fairy" ? e.bulbSize * 0.6 : e.bulbSize) * 6 * e.glowSize,
      frame.scale,
      e.glow > 0.001,
    );
  }

  dispose() {
    this.clear();
    this.group.removeFromParent();
    this.bulbMat.dispose();
  }
}
