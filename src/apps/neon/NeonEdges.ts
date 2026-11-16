import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import type { NeonMode } from "./settings";
import {
  EDGE_FILTER_DEFAULT,
  cloneEdgeFilter,
  collectEdgeMeshes,
  edgeFilterKey,
  filterSegmentsLocal,
  getEdgePositions,
  type EdgeFilter,
} from "@/lib/edgeSelect";
import { WATER_PASS_BEHIND_ORDER, applyWaterPass } from "@/lib/waterPass";

// NEON: glowing tubes along the hard edges of every mesh in a loaded scene.
// Edges come from THREE.EdgesGeometry (only creases sharper than
// the edge threshold in lib/edgeSelect.ts, so smooth surfaces don't turn into a wireframe) and are
// drawn as screen-space-wide LineSegments2 with one shared additive
// material, so the whole effect recolors with a single uniform write.
//
// The lines live in their own group added straight to the scene (not as
// children of the model's meshes) and copy each source mesh's world matrix
// every frame: the scene loader's disposeObject() walks the model subtree,
// and must never free these lines' geometry or the shared material.

export type NeonConfig = {
  mode: NeonMode;
  primary: string;
  secondary: string;
  tint: string;
  tintAmount: number;
  strength: number;
  width: number;
  frequency: number;
};

export class NeonEdges {
  readonly group = new THREE.Group();
  // Two materials, one per water pass (see lib/waterPass.ts): fragments
  // behind the water surface draw before the ocean, the rest after it.
  private readonly material: LineMaterial;
  private readonly materialBehind: LineMaterial;
  private root: THREE.Object3D | null = null;
  private filter: EdgeFilter = cloneEdgeFilter(EDGE_FILTER_DEFAULT);
  private filterKey = edgeFilterKey(EDGE_FILTER_DEFAULT);
  private pairs: { src: THREE.Mesh; lines: LineSegments2[] }[] = [];
  private readonly cPrimary = new THREE.Color();
  private readonly cSecondary = new THREE.Color();
  private readonly cTint = new THREE.Color();
  private readonly hsl = { h: 0, s: 0, l: 0 };

  constructor(scene: THREE.Scene) {
    const make = (behind: boolean) => {
      const m = new LineMaterial({
        color: 0xffffff,
        linewidth: 3,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: true,
      });
      applyWaterPass(
        m,
        behind,
        "((position.y < 0.5) ? (modelMatrix * vec4(instanceStart, 1.0)).y : (modelMatrix * vec4(instanceEnd, 1.0)).y)",
        "float aspect = resolution.x / resolution.y;",
        "void main() {",
      );
      return m;
    };
    this.material = make(false);
    this.materialBehind = make(true);
    this.group.name = "neonEdges";
    scene.add(this.group);
  }

  get attachedTo(): THREE.Object3D | null {
    return this.root;
  }

  /** Which edges get lines (direction + x/y/z range); rebuilds when it changes. */
  setFilter(f: EdgeFilter) {
    const key = edgeFilterKey(f);
    if (key === this.filterKey) return;
    this.filter = cloneEdgeFilter(f);
    this.filterKey = key;
    const root = this.root;
    if (root) this.attach(root);
  }

  /** Builds edge lines for every mesh under `root`, replacing any previous. */
  attach(root: THREE.Object3D) {
    this.detach();
    this.root = root;
    for (const src of collectEdgeMeshes([root])) {
      const all = getEdgePositions(src.geometry);
      if (!all || all.length === 0) continue;
      const kept = filterSegmentsLocal(all, src.matrixWorld, this.filter);
      if (kept.length === 0) continue;
      const geo = new LineSegmentsGeometry();
      geo.setPositions(kept);
      const lines = [this.material, this.materialBehind].map((mat, i) => {
        const line = new LineSegments2(geo, mat);
        line.matrixAutoUpdate = false;
        line.matrix.copy(src.matrixWorld);
        line.renderOrder = i === 0 ? 10 : WATER_PASS_BEHIND_ORDER;
        // Purely decorative — never pickable by the watercraft/TV raycasts.
        line.raycast = () => {};
        this.group.add(line);
        return line;
      });
      this.pairs.push({ src, lines });
    }
  }

  detach() {
    for (const { lines } of this.pairs) {
      for (const line of lines) this.group.remove(line);
      lines[0].geometry.dispose();
    }
    this.pairs = [];
    this.root = null;
  }

  setResolution(w: number, h: number) {
    this.material.resolution.set(w, h);
    this.materialBehind.resolution.set(w, h);
  }

  /** Recolors the shared material for time `t` (seconds) and re-syncs every
   *  line to its source mesh's current world transform. */
  update(t: number, cfg: NeonConfig) {
    const c = this.material.color;
    this.cPrimary.set(cfg.primary);
    this.cSecondary.set(cfg.secondary);
    const f = Math.max(0, cfg.frequency);
    switch (cfg.mode) {
      case "alternate":
        c.copy((t * f) % 1 < 0.5 ? this.cPrimary : this.cSecondary);
        break;
      case "fade":
        c.copy(this.cPrimary).lerp(this.cSecondary, 0.5 - 0.5 * Math.cos(t * f * Math.PI * 2));
        break;
      case "hue": {
        this.cPrimary.getHSL(this.hsl);
        // A gray primary has no hue to rotate; give it full saturation so
        // cycling still shows something.
        const s = this.hsl.s < 0.05 ? 1 : this.hsl.s;
        const l = this.hsl.l < 0.05 || this.hsl.l > 0.95 ? 0.5 : this.hsl.l;
        c.setHSL((((this.hsl.h + t * f) % 1) + 1) % 1, s, l);
        break;
      }
      default:
        c.copy(this.cPrimary);
    }
    if (cfg.tintAmount > 0) c.lerp(this.cTint.set(cfg.tint), Math.min(1, cfg.tintAmount));
    // Additive blending: strength past 1 keeps brightening toward white
    // instead of saturating at the base color.
    c.multiplyScalar(Math.max(0, cfg.strength));
    this.materialBehind.color.copy(c);
    for (const m of [this.material, this.materialBehind]) {
      m.opacity = Math.min(1, Math.max(0, cfg.strength));
      m.linewidth = Math.max(0.5, cfg.width);
    }
    for (const { src, lines } of this.pairs) {
      for (const line of lines) {
        line.matrix.copy(src.matrixWorld);
        line.visible = src.visible;
      }
    }
  }

  dispose() {
    this.detach();
    this.group.removeFromParent();
    this.material.dispose();
    this.materialBehind.dispose();
  }
}
