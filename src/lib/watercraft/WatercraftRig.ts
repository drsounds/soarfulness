import * as THREE from "three";
import { VoxelWorld, type VoxelBounds } from "./VoxelWorld";
import { SculptCanvas } from "./SculptCanvas";
import { exportWatercraftGlb, importWatercraftGlb, type ImportResult } from "./glbIO";
import type { BuildAction, SculptAction, ToolMode } from "./types";

// Layout constants for the watercraft: a raft with a Minecraft-like block
// grid on one side and a brush-sculptable clay pad on the other. Everything
// below is in the raft group's local space (`root`, which the host scene
// positions/bobs — see setBob()).
const BUILD_BOUNDS: VoxelBounds = { originX: -12, originZ: -7, sizeX: 14, sizeZ: 14, maxY: 10 };
const RAFT_WIDTH = 24;
const RAFT_DEPTH = 16;
const RAFT_THICK = 1;
const PEDESTAL_CENTER = { x: 8, z: 0 };
const PEDESTAL_SIZE = { width: 8, depth: 14, thick: 1 };
// baseY sits a hair above the pedestal's top face (rather than exactly on
// it) to avoid z-fighting between the two coplanar flat surfaces.
const CLAY = { width: 7, depth: 13, segX: 44, segZ: 82, baseY: PEDESTAL_SIZE.thick + 0.01 };

type BuildPick = { cell: [number, number, number]; kind: "place" | "remove" };

export interface WatercraftRigOptions {
  onBlockCountChange?: (count: number) => void;
  onImportedStatic?: () => void;
}

// Unlike the original standalone-page version (WatercraftApp), this rig owns
// no renderer/camera/render-loop of its own — it's a set of Object3Ds added
// into the *main bath's* existing THREE.Scene, driven every frame by that
// scene's own animate loop (see the cameraMode === "watercraft" wiring in
// routes/index.tsx): the host calls setBob() with the real ocean's wave
// height at the raft's world position, and tick()/pointer*() using the
// host's own camera and pointer events. This is what lets the raft float on
// the actual rendered ocean (JONSWAP/FFT swell and all) instead of a
// separate decorative one, and lets building/sculpting share the bath's
// existing NAV/LOOK joystick camera controls instead of needing its own.
export class WatercraftRig {
  mode: ToolMode = "build";
  buildAction: BuildAction = "place";
  sculptAction: SculptAction = "raise";
  blockType = 0;
  brushRadius = 1.1;
  brushStrength = 0.14;

  readonly root = new THREE.Group();
  private raftMesh: THREE.Mesh;
  private pedestalMesh: THREE.Mesh;

  private voxelWorld: VoxelWorld;
  private sculptCanvas: SculptCanvas;
  private buildBasePlane: THREE.Mesh;
  private hoverBox: THREE.LineSegments;
  private brushRing: THREE.Mesh;
  private staticImportGroup: THREE.Group | null = null;

  private raycaster = new THREE.Raycaster();
  private pointerNdc = new THREE.Vector2(2, 2);
  private painting = false;
  private options: WatercraftRigOptions;

  constructor(
    scene: THREE.Scene,
    worldX: number,
    worldZ: number,
    options: WatercraftRigOptions = {},
  ) {
    this.options = options;
    this.root.position.set(worldX, 0, worldZ);
    this.root.visible = false;

    this.raftMesh = new THREE.Mesh(
      new THREE.BoxGeometry(RAFT_WIDTH, RAFT_THICK, RAFT_DEPTH),
      new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.9 }),
    );
    this.raftMesh.position.y = -RAFT_THICK / 2;
    this.root.add(this.raftMesh);

    this.pedestalMesh = new THREE.Mesh(
      new THREE.BoxGeometry(PEDESTAL_SIZE.width, PEDESTAL_SIZE.thick, PEDESTAL_SIZE.depth),
      new THREE.MeshStandardMaterial({ color: 0x5b6b78, roughness: 0.85 }),
    );
    this.pedestalMesh.position.set(PEDESTAL_CENTER.x, PEDESTAL_SIZE.thick / 2, PEDESTAL_CENTER.z);
    this.root.add(this.pedestalMesh);

    this.voxelWorld = new VoxelWorld(this.root, BUILD_BOUNDS);

    this.buildBasePlane = new THREE.Mesh(
      new THREE.PlaneGeometry(BUILD_BOUNDS.sizeX, BUILD_BOUNDS.sizeZ),
      new THREE.MeshBasicMaterial({
        color: 0x2aa7b0,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.buildBasePlane.rotateX(-Math.PI / 2);
    this.buildBasePlane.position.set(BUILD_BOUNDS.sizeX / 2, 0.004, BUILD_BOUNDS.sizeZ / 2);
    this.voxelWorld.group.add(this.buildBasePlane);
    this.voxelWorld.group.add(buildGridLines(BUILD_BOUNDS.sizeX, BUILD_BOUNDS.sizeZ));

    this.hoverBox = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, 1.02)),
      new THREE.LineBasicMaterial({ color: 0xffffff }),
    );
    this.hoverBox.visible = false;
    this.voxelWorld.group.add(this.hoverBox);

    this.sculptCanvas = new SculptCanvas(CLAY);
    this.sculptCanvas.mesh.position.set(PEDESTAL_CENTER.x, 0, PEDESTAL_CENTER.z);
    this.root.add(this.sculptCanvas.mesh);

    this.brushRing = new THREE.Mesh(
      new THREE.RingGeometry(0.82, 1, 40),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      }),
    );
    this.brushRing.rotateX(-Math.PI / 2);
    this.brushRing.visible = false;
    this.sculptCanvas.mesh.add(this.brushRing);

    scene.add(this.root);
  }

  setVisible(visible: boolean): void {
    this.root.visible = visible;
    if (!visible) this.painting = false;
  }

  get visible(): boolean {
    return this.root.visible;
  }

  // Called every frame by the host with the real ocean's wave height (and a
  // touch of roll) sampled at this raft's world position, so it bobs on the
  // actual rendered surface rather than a made-up motion of its own.
  setBob(y: number, rotX: number, rotZ: number): void {
    this.root.position.y = y;
    this.root.rotation.x = rotX;
    this.root.rotation.z = rotZ;
  }

  // Per-frame upkeep while visible: syncs the voxel mesh, advances any
  // in-progress sculpt paint stroke, and refreshes the hover indicator —
  // called by the host's own render loop with its live camera.
  tick(camera: THREE.Camera): void {
    if (!this.root.visible) return;
    this.voxelWorld.syncIfDirty();
    if (this.painting && this.mode === "sculpt") this.performSculptStep(camera);
    this.updateHoverIndicators(camera);
  }

  setPointerFromEvent(canvas: HTMLElement, clientX: number, clientY: number): void {
    const rect = canvas.getBoundingClientRect();
    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  pointerDown(camera: THREE.Camera): void {
    if (this.mode === "build") {
      this.performBuildAction(camera);
    } else {
      this.painting = true;
      this.performSculptStep(camera);
    }
  }

  pointerUp(): void {
    this.painting = false;
  }

  private pickBuildCell(camera: THREE.Camera): BuildPick | null {
    this.raycaster.setFromCamera(this.pointerNdc, camera);
    const targets: THREE.Object3D[] = [...this.voxelWorld.raycastTargets(), this.buildBasePlane];
    const hits = this.raycaster.intersectObjects(targets, false);
    if (hits.length === 0) return null;
    const hit = hits[0];

    if (hit.object === this.buildBasePlane) {
      if (this.buildAction === "remove") return null;
      const local = this.voxelWorld.group.worldToLocal(hit.point.clone());
      const cell: [number, number, number] = [Math.floor(local.x), 0, Math.floor(local.z)];
      return this.voxelWorld.inBounds(...cell) ? { cell, kind: "place" } : null;
    }

    const rec = this.voxelWorld.coordFromHit(hit.object, hit.instanceId);
    if (!rec) return null;
    const [bx, by, bz] = rec;
    if (this.buildAction === "remove") return { cell: [bx, by, bz], kind: "remove" };
    if (!hit.face) return null;
    const cell: [number, number, number] = [
      bx + Math.round(hit.face.normal.x),
      by + Math.round(hit.face.normal.y),
      bz + Math.round(hit.face.normal.z),
    ];
    return this.voxelWorld.inBounds(...cell) ? { cell, kind: "place" } : null;
  }

  private performBuildAction(camera: THREE.Camera): void {
    const pick = this.pickBuildCell(camera);
    if (!pick) return;
    const [x, y, z] = pick.cell;
    const changed =
      pick.kind === "place"
        ? this.voxelWorld.place(x, y, z, this.blockType)
        : this.voxelWorld.remove(x, y, z);
    if (changed) this.options.onBlockCountChange?.(this.voxelWorld.count);
  }

  private performSculptStep(camera: THREE.Camera): void {
    this.raycaster.setFromCamera(this.pointerNdc, camera);
    const hits = this.raycaster.intersectObject(this.sculptCanvas.mesh, false);
    if (hits.length === 0) return;
    const local = this.sculptCanvas.mesh.worldToLocal(hits[0].point.clone());
    const direction = this.sculptAction === "raise" ? 1 : -1;
    this.sculptCanvas.applyBrush(local.x, local.z, this.brushRadius, this.brushStrength, direction);
  }

  private updateHoverIndicators(camera: THREE.Camera): void {
    if (this.mode === "build") {
      this.brushRing.visible = false;
      const pick = this.pickBuildCell(camera);
      if (pick) {
        this.hoverBox.visible = true;
        const [x, y, z] = pick.cell;
        this.hoverBox.position.set(x + 0.5, y + 0.5, z + 0.5);
        (this.hoverBox.material as THREE.LineBasicMaterial).color.set(
          pick.kind === "remove" ? 0xff6b5e : 0xffffff,
        );
      } else {
        this.hoverBox.visible = false;
      }
    } else {
      this.hoverBox.visible = false;
      this.raycaster.setFromCamera(this.pointerNdc, camera);
      const hits = this.raycaster.intersectObject(this.sculptCanvas.mesh, false);
      if (hits.length > 0) {
        const local = this.sculptCanvas.mesh.worldToLocal(hits[0].point.clone());
        this.brushRing.visible = true;
        this.brushRing.position.set(local.x, local.y + 0.03, local.z);
        this.brushRing.scale.setScalar(Math.max(this.brushRadius, 0.1));
      } else {
        this.brushRing.visible = false;
      }
    }
  }

  get blockCount(): number {
    return this.voxelWorld.count;
  }

  async exportGlb(): Promise<Blob> {
    return exportWatercraftGlb({
      blocks: this.voxelWorld.serialize(),
      blockOrigin: { x: BUILD_BOUNDS.originX, z: BUILD_BOUNDS.originZ },
      clay: this.sculptCanvas.serialize(),
      clayCenter: PEDESTAL_CENTER,
      raftMesh: this.raftMesh,
      pedestalMesh: this.pedestalMesh,
    });
  }

  async importGlb(file: File): Promise<ImportResult> {
    const result = await importWatercraftGlb(file);
    if (result.kind === "restored") {
      this.voxelWorld.loadSerialized(result.data.blocks);
      this.sculptCanvas.loadSerialized(result.data.clay);
      this.options.onBlockCountChange?.(this.voxelWorld.count);
    } else {
      this.placeStaticImport(result.scene);
      this.options.onImportedStatic?.();
    }
    return result;
  }

  private placeStaticImport(scene: THREE.Group): void {
    if (this.staticImportGroup) {
      this.root.remove(this.staticImportGroup);
      disposeObject(this.staticImportGroup);
    }
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const scale = 6 / maxDim;
    scene.scale.setScalar(scale);

    const scaledBox = new THREE.Box3().setFromObject(scene);
    const center = scaledBox.getCenter(new THREE.Vector3());
    scene.position.x += PEDESTAL_CENTER.x - center.x;
    scene.position.z += PEDESTAL_CENTER.z - center.z;
    scene.position.y += PEDESTAL_SIZE.thick - scaledBox.min.y;

    this.staticImportGroup = scene;
    this.root.add(scene);
  }

  reset(): void {
    this.voxelWorld.clear();
    this.sculptCanvas.reset();
    if (this.staticImportGroup) {
      this.root.remove(this.staticImportGroup);
      disposeObject(this.staticImportGroup);
      this.staticImportGroup = null;
    }
    this.options.onBlockCountChange?.(0);
  }

  dispose(): void {
    this.voxelWorld.dispose();
    this.sculptCanvas.dispose();
    disposeObject(this.root);
    this.root.removeFromParent();
  }
}

function buildGridLines(sizeX: number, sizeZ: number): THREE.LineSegments {
  const points: number[] = [];
  for (let x = 0; x <= sizeX; x++) {
    points.push(x, 0.005, 0, x, 0.005, sizeZ);
  }
  for (let z = 0; z <= sizeZ; z++) {
    points.push(0, 0.005, z, sizeX, 0.005, z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  return new THREE.LineSegments(
    geo,
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 }),
  );
}

function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (!mat) return;
    const mats = Array.isArray(mat) ? mat : [mat];
    for (const m of mats) {
      for (const key of Object.keys(m) as (keyof THREE.Material)[]) {
        const val = (m as unknown as Record<string, unknown>)[key];
        if (val instanceof THREE.Texture) val.dispose();
      }
      m.dispose();
    }
  });
}
