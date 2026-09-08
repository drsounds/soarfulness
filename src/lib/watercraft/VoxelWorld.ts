import * as THREE from "three";
import { BLOCK_PALETTE } from "./palette";
import type { BlockRecord } from "./types";

// A Minecraft-like voxel grid, rendered with one THREE.InstancedMesh per
// block type (see BLOCK_PALETTE) so a few thousand blocks stay cheap to
// draw. The mesh is fully rebuilt from the sparse block map whenever it
// changes — simple, and plenty fast at this world's capped size (bounds
// below cap out at a few thousand cells).
export interface VoxelBounds {
  originX: number;
  originZ: number;
  sizeX: number;
  sizeZ: number;
  maxY: number;
}

const tmpMatrix = new THREE.Matrix4();
const tmpColor = new THREE.Color();

export class VoxelWorld {
  readonly group: THREE.Group;
  readonly bounds: VoxelBounds;

  private blocks = new Map<string, number>();
  private meshes = new Map<number, THREE.InstancedMesh>();
  private geometry = new THREE.BoxGeometry(1, 1, 1);
  private materials = new Map<number, THREE.MeshStandardMaterial>();
  private dirty = true;

  constructor(parent: THREE.Object3D, bounds: VoxelBounds) {
    this.bounds = bounds;
    this.group = new THREE.Group();
    this.group.position.set(bounds.originX, 0, bounds.originZ);
    parent.add(this.group);

    for (const entry of BLOCK_PALETTE) {
      this.materials.set(
        entry.id,
        new THREE.MeshStandardMaterial({
          color: entry.color,
          roughness: entry.roughness,
          metalness: entry.metalness,
        }),
      );
    }
  }

  private key(x: number, y: number, z: number): string {
    return `${x}|${y}|${z}`;
  }

  inBounds(x: number, y: number, z: number): boolean {
    return (
      x >= 0 &&
      x < this.bounds.sizeX &&
      z >= 0 &&
      z < this.bounds.sizeZ &&
      y >= 0 &&
      y < this.bounds.maxY
    );
  }

  has(x: number, y: number, z: number): boolean {
    return this.blocks.has(this.key(x, y, z));
  }

  place(x: number, y: number, z: number, blockType: number): boolean {
    if (!this.inBounds(x, y, z) || this.has(x, y, z)) return false;
    this.blocks.set(this.key(x, y, z), blockType);
    this.dirty = true;
    return true;
  }

  remove(x: number, y: number, z: number): boolean {
    if (!this.blocks.delete(this.key(x, y, z))) return false;
    this.dirty = true;
    return true;
  }

  clear(): void {
    if (this.blocks.size === 0) return;
    this.blocks.clear();
    this.dirty = true;
  }

  get count(): number {
    return this.blocks.size;
  }

  // The InstancedMeshes themselves — pass to a Raycaster to hit-test blocks.
  raycastTargets(): THREE.Object3D[] {
    return [...this.meshes.values()];
  }

  // Reverse-maps a raycast hit's instanceId back to the block's grid coords
  // and type. Returns null if `object` isn't one of ours.
  coordFromHit(object: THREE.Object3D, instanceId: number | undefined): BlockRecord | null {
    if (instanceId === undefined) return null;
    for (const [blockType, mesh] of this.meshes) {
      if (mesh !== object) continue;
      const coords = mesh.userData.coords as [number, number, number][] | undefined;
      const c = coords?.[instanceId];
      if (!c) return null;
      return [c[0], c[1], c[2], blockType];
    }
    return null;
  }

  serialize(): BlockRecord[] {
    const out: BlockRecord[] = [];
    for (const [key, blockType] of this.blocks) {
      const [x, y, z] = key.split("|").map(Number);
      out.push([x, y, z, blockType]);
    }
    return out;
  }

  loadSerialized(blocks: readonly BlockRecord[]): void {
    this.blocks.clear();
    for (const [x, y, z, blockType] of blocks) {
      if (this.inBounds(x, y, z)) this.blocks.set(this.key(x, y, z), blockType);
    }
    this.dirty = true;
  }

  // Called once per frame; no-ops unless place()/remove()/clear() touched
  // the world since the last call.
  syncIfDirty(): void {
    if (!this.dirty) return;
    this.dirty = false;

    const byType = new Map<number, [number, number, number][]>();
    for (const [key, blockType] of this.blocks) {
      const [x, y, z] = key.split("|").map(Number);
      let arr = byType.get(blockType);
      if (!arr) {
        arr = [];
        byType.set(blockType, arr);
      }
      arr.push([x, y, z]);
    }

    for (const entry of BLOCK_PALETTE) {
      const coords = byType.get(entry.id) ?? [];
      let mesh = this.meshes.get(entry.id);
      if (!mesh || mesh.instanceMatrix.count < coords.length) {
        if (mesh) {
          this.group.remove(mesh);
          mesh.dispose();
        }
        const capacity = Math.max(coords.length, 16);
        mesh = new THREE.InstancedMesh(this.geometry, this.materials.get(entry.id), capacity);
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        this.meshes.set(entry.id, mesh);
        this.group.add(mesh);
      }
      mesh.count = coords.length;
      mesh.userData.coords = coords;
      coords.forEach(([x, y, z], i) => {
        tmpMatrix.makeTranslation(x + 0.5, y + 0.5, z + 0.5);
        mesh!.setMatrixAt(i, tmpMatrix);
        mesh!.setColorAt(i, tmpColor.setHex(entry.color));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.visible = coords.length > 0;
    }
  }

  dispose(): void {
    this.geometry.dispose();
    for (const mat of this.materials.values()) mat.dispose();
    for (const mesh of this.meshes.values()) mesh.dispose();
  }
}
