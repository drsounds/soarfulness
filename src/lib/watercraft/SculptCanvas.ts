import * as THREE from "three";
import type { ClayData } from "./types";

// A brush-sculptable "clay pad": a flat grid of vertices whose height
// (local Y) a brush pushes up or down, like a simple digital sculpting mat.
// Geometry is authored directly (rather than via THREE.PlaneGeometry +
// rotation) so vertex.y is already the height field, with no axis remap to
// reason about when applying a brush stroke.
export class SculptCanvas {
  readonly mesh: THREE.Mesh;
  readonly width: number;
  readonly depth: number;
  readonly segX: number;
  readonly segZ: number;
  readonly baseY: number;

  private geometry: THREE.BufferGeometry;
  private heights: Float32Array;
  private material: THREE.MeshStandardMaterial;

  static readonly MIN_HEIGHT = -1.4;
  static readonly MAX_HEIGHT = 2.6;

  constructor(opts: { width: number; depth: number; segX: number; segZ: number; baseY: number }) {
    this.width = opts.width;
    this.depth = opts.depth;
    this.segX = opts.segX;
    this.segZ = opts.segZ;
    this.baseY = opts.baseY;
    this.heights = new Float32Array((this.segX + 1) * (this.segZ + 1));
    this.geometry = this.buildGeometry();
    this.material = new THREE.MeshStandardMaterial({
      color: 0xd9c9a8,
      roughness: 0.75,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.set(0, 0, 0);
    this.mesh.receiveShadow = true;
  }

  private vertexIndex(ix: number, iz: number): number {
    return iz * (this.segX + 1) + ix;
  }

  private buildGeometry(): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    const cols = this.segX + 1;
    const rows = this.segZ + 1;
    const positions = new Float32Array(cols * rows * 3);
    const uvs = new Float32Array(cols * rows * 2);

    for (let iz = 0; iz < rows; iz++) {
      for (let ix = 0; ix < cols; ix++) {
        const i = this.vertexIndex(ix, iz);
        const x = (ix / this.segX - 0.5) * this.width;
        const z = (iz / this.segZ - 0.5) * this.depth;
        positions[i * 3] = x;
        positions[i * 3 + 1] = this.baseY + this.heights[i];
        positions[i * 3 + 2] = z;
        uvs[i * 2] = ix / this.segX;
        uvs[i * 2 + 1] = iz / this.segZ;
      }
    }

    const indices: number[] = [];
    for (let iz = 0; iz < this.segZ; iz++) {
      for (let ix = 0; ix < this.segX; ix++) {
        const a = this.vertexIndex(ix, iz);
        const b = this.vertexIndex(ix + 1, iz);
        const c = this.vertexIndex(ix, iz + 1);
        const d = this.vertexIndex(ix + 1, iz + 1);
        indices.push(a, c, b, b, c, d);
      }
    }

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  // World point already converted to this mesh's local space by the caller.
  applyBrush(
    localX: number,
    localZ: number,
    radius: number,
    strength: number,
    direction: 1 | -1,
  ): void {
    const posAttr = this.geometry.attributes.position as THREE.BufferAttribute;
    const cols = this.segX + 1;
    const rows = this.segZ + 1;
    const cellW = this.width / this.segX;
    const cellD = this.depth / this.segZ;
    const cx = (localX / this.width + 0.5) * this.segX;
    const cz = (localZ / this.depth + 0.5) * this.segZ;
    const rx = radius / cellW;
    const rz = radius / cellD;

    const ixMin = Math.max(0, Math.floor(cx - rx));
    const ixMax = Math.min(this.segX, Math.ceil(cx + rx));
    const izMin = Math.max(0, Math.floor(cz - rz));
    const izMax = Math.min(this.segZ, Math.ceil(cz + rz));
    if (ixMin > ixMax || izMin > izMax) return;

    let touched = false;
    for (let iz = izMin; iz <= izMax; iz++) {
      for (let ix = ixMin; ix <= ixMax; ix++) {
        const vx = (ix / this.segX - 0.5) * this.width;
        const vz = (iz / this.segZ - 0.5) * this.depth;
        const dist = Math.hypot(vx - localX, vz - localZ);
        if (dist > radius) continue;
        const falloff = 1 - dist / radius;
        const smooth = falloff * falloff * (3 - 2 * falloff);
        const i = this.vertexIndex(ix, iz);
        const next = THREE.MathUtils.clamp(
          this.heights[i] + strength * smooth * direction,
          SculptCanvas.MIN_HEIGHT,
          SculptCanvas.MAX_HEIGHT,
        );
        if (next !== this.heights[i]) {
          this.heights[i] = next;
          posAttr.setY(i, this.baseY + next);
          touched = true;
        }
      }
    }

    if (touched) {
      posAttr.needsUpdate = true;
      this.geometry.computeVertexNormals();
      (this.geometry.attributes.normal as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  reset(): void {
    this.heights.fill(0);
    const posAttr = this.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < this.heights.length; i++) posAttr.setY(i, this.baseY);
    posAttr.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }

  serialize(): ClayData {
    return {
      width: this.width,
      depth: this.depth,
      segX: this.segX,
      segZ: this.segZ,
      baseY: this.baseY,
      heights: Array.from(this.heights),
    };
  }

  loadSerialized(data: ClayData): void {
    if (
      data.segX !== this.segX ||
      data.segZ !== this.segZ ||
      data.heights.length !== this.heights.length
    ) {
      return;
    }
    this.heights.set(data.heights);
    const posAttr = this.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < this.heights.length; i++) {
      posAttr.setY(i, this.baseY + this.heights[i]);
    }
    posAttr.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
