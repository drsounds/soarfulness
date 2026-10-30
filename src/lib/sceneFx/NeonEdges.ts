import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import type { NeonMode } from "@/lib/settingsShared";

// NEON: glowing tubes along the hard edges of every mesh in a loaded scene.
// Edges come from THREE.EdgesGeometry (only creases sharper than
// EDGE_THRESHOLD_DEG, so smooth surfaces don't turn into a wireframe) and are
// drawn as screen-space-wide LineSegments2 with one shared additive
// material, so the whole effect recolors with a single uniform write.
//
// The lines live in their own group added straight to the scene (not as
// children of the model's meshes) and copy each source mesh's world matrix
// every frame: the scene loader's disposeObject() walks the model subtree,
// and must never free these lines' geometry or the shared material.

const EDGE_THRESHOLD_DEG = 30;

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
  private readonly material: LineMaterial;
  private root: THREE.Object3D | null = null;
  private pairs: { src: THREE.Mesh; line: LineSegments2 }[] = [];
  private readonly cPrimary = new THREE.Color();
  private readonly cSecondary = new THREE.Color();
  private readonly cTint = new THREE.Color();
  private readonly hsl = { h: 0, s: 0, l: 0 };

  constructor(scene: THREE.Scene) {
    this.material = new LineMaterial({
      color: 0xffffff,
      linewidth: 3,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: true,
    });
    this.group.name = "neonEdges";
    scene.add(this.group);
  }

  get attachedTo(): THREE.Object3D | null {
    return this.root;
  }

  /** Builds edge lines for every mesh under `root`, replacing any previous. */
  attach(root: THREE.Object3D) {
    this.detach();
    this.root = root;
    root.updateMatrixWorld(true);
    const meshes: THREE.Mesh[] = [];
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      const instanced = (mesh as THREE.InstancedMesh).isInstancedMesh;
      if (mesh.isMesh && !instanced && mesh.geometry?.attributes.position) {
        meshes.push(mesh);
      }
    });
    for (const src of meshes) {
      const edges = new THREE.EdgesGeometry(src.geometry, EDGE_THRESHOLD_DEG);
      if (edges.attributes.position.count === 0) {
        edges.dispose();
        continue;
      }
      const geo = new LineSegmentsGeometry().fromEdgesGeometry(edges);
      edges.dispose();
      const line = new LineSegments2(geo, this.material);
      line.matrixAutoUpdate = false;
      line.matrix.copy(src.matrixWorld);
      line.renderOrder = 10;
      // Purely decorative — never pickable by the watercraft/TV raycasts.
      line.raycast = () => {};
      this.group.add(line);
      this.pairs.push({ src, line });
    }
  }

  detach() {
    for (const { line } of this.pairs) {
      this.group.remove(line);
      line.geometry.dispose();
    }
    this.pairs = [];
    this.root = null;
  }

  setResolution(w: number, h: number) {
    this.material.resolution.set(w, h);
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
    this.material.opacity = Math.min(1, Math.max(0, cfg.strength));
    this.material.linewidth = Math.max(0.5, cfg.width);
    for (const { src, line } of this.pairs) {
      line.matrix.copy(src.matrixWorld);
      line.visible = src.visible;
    }
  }

  dispose() {
    this.detach();
    this.group.removeFromParent();
    this.material.dispose();
  }
}
