import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { VoxelWorld, type VoxelBounds } from "./VoxelWorld";
import { SculptCanvas } from "./SculptCanvas";
import { exportWatercraftGlb, importWatercraftGlb, type ImportResult } from "./glbIO";
import type { BuildAction, SculptAction, ToolMode } from "./types";

// Layout constants for the watercraft: a raft with a Minecraft-like block
// grid on one side and a brush-sculptable clay pad on the other, all
// bobbing together on a small animated ocean. Everything below is in the
// raft group's local space (raftGroup itself is what bobs/sways).
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

export interface WatercraftAppOptions {
  onBlockCountChange?: (count: number) => void;
  onImportedStatic?: () => void;
}

export class WatercraftApp {
  mode: ToolMode = "build";
  buildAction: BuildAction = "place";
  sculptAction: SculptAction = "raise";
  blockType = 0;
  brushRadius = 1.1;
  brushStrength = 0.14;

  private container: HTMLDivElement;
  private options: WatercraftAppOptions;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;

  private raftGroup = new THREE.Group();
  private raftMesh: THREE.Mesh;
  private pedestalMesh: THREE.Mesh;
  private oceanMesh: THREE.Mesh;
  private oceanMaterial: THREE.ShaderMaterial;

  private voxelWorld: VoxelWorld;
  private sculptCanvas: SculptCanvas;
  private buildBasePlane: THREE.Mesh;
  private hoverBox: THREE.LineSegments;
  private brushRing: THREE.Mesh;
  private staticImportGroup: THREE.Group | null = null;

  private clock = new THREE.Clock();
  private raycaster = new THREE.Raycaster();
  private pointerNdc = new THREE.Vector2(2, 2);
  private activePointers = new Set<number>();
  private painting = false;
  private raf = 0;
  private disposed = false;
  private scratchTarget = new THREE.Vector3();

  private onPointerDown = (e: PointerEvent) => this.handlePointerDown(e);
  private onPointerMove = (e: PointerEvent) => this.handlePointerMove(e);
  private onPointerUp = (e: PointerEvent) => this.handlePointerUp(e);
  private onResize = () => this.resize();

  constructor(container: HTMLDivElement, options: WatercraftAppOptions = {}) {
    this.container = container;
    this.options = options;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.style.touchAction = "none";
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0xbfe8ef);
    this.scene.fog = new THREE.Fog(0xbfe8ef, 40, 160);

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 400);
    this.camera.position.set(15, 13, 21);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 55;
    this.controls.minPolarAngle = 0.15;
    this.controls.maxPolarAngle = 1.48;
    this.controls.mouseButtons = {
      LEFT: null,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    this.controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
    this.controls.target.set(-2, 1, 0);
    this.controls.update();

    const hemi = new THREE.HemisphereLight(0xeaffff, 0x2b4b52, 1.1);
    const sun = new THREE.DirectionalLight(0xfff6e0, 1.4);
    sun.position.set(12, 22, 10);
    this.scene.add(hemi, sun, new THREE.AmbientLight(0xffffff, 0.15));

    this.oceanMaterial = createOceanMaterial();
    const oceanGeo = new THREE.PlaneGeometry(320, 320, 140, 140);
    oceanGeo.rotateX(-Math.PI / 2);
    this.oceanMesh = new THREE.Mesh(oceanGeo, this.oceanMaterial);
    this.oceanMesh.position.y = -0.55;
    this.scene.add(this.oceanMesh);

    this.raftMesh = new THREE.Mesh(
      new THREE.BoxGeometry(RAFT_WIDTH, RAFT_THICK, RAFT_DEPTH),
      new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.9 }),
    );
    this.raftMesh.position.y = -RAFT_THICK / 2;
    this.raftGroup.add(this.raftMesh);

    this.pedestalMesh = new THREE.Mesh(
      new THREE.BoxGeometry(PEDESTAL_SIZE.width, PEDESTAL_SIZE.thick, PEDESTAL_SIZE.depth),
      new THREE.MeshStandardMaterial({ color: 0x5b6b78, roughness: 0.85 }),
    );
    this.pedestalMesh.position.set(PEDESTAL_CENTER.x, PEDESTAL_SIZE.thick / 2, PEDESTAL_CENTER.z);
    this.raftGroup.add(this.pedestalMesh);

    this.voxelWorld = new VoxelWorld(this.raftGroup, BUILD_BOUNDS);

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
    this.raftGroup.add(this.sculptCanvas.mesh);

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

    this.scene.add(this.raftGroup);

    this.renderer.domElement.addEventListener("pointerdown", this.onPointerDown);
    this.renderer.domElement.addEventListener("pointermove", this.onPointerMove);
    this.renderer.domElement.addEventListener("pointerup", this.onPointerUp);
    this.renderer.domElement.addEventListener("pointercancel", this.onPointerUp);
    this.renderer.domElement.addEventListener("pointerleave", this.onPointerUp);
    this.renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("resize", this.onResize);

    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = () => {
    if (this.disposed) return;
    const t = this.clock.getElapsedTime();

    this.raftGroup.position.y = Math.sin(t * 0.6) * 0.22 + Math.sin(t * 0.37 + 1.3) * 0.08;
    this.raftGroup.rotation.z = Math.sin(t * 0.5 + 0.4) * 0.035;
    this.raftGroup.rotation.x = Math.cos(t * 0.33) * 0.02;
    this.oceanMaterial.uniforms.uTime.value = t;

    this.voxelWorld.syncIfDirty();
    this.updateHoverIndicators();

    if (this.painting && this.mode === "sculpt") this.performSculptStep();

    this.scratchTarget.set(-2, 1, 0);
    this.raftGroup.localToWorld(this.scratchTarget);
    this.controls.target.lerp(this.scratchTarget, 0.15);
    this.controls.update();

    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.tick);
  };

  private updatePointerNdc(e: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private handlePointerDown(e: PointerEvent): void {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    this.updatePointerNdc(e);
    this.activePointers.add(e.pointerId);
    if (this.activePointers.size !== 1) {
      this.painting = false;
      return;
    }
    try {
      this.renderer.domElement.setPointerCapture(e.pointerId);
    } catch {
      // ignore — capture is a nicety, not required for correctness
    }
    if (this.mode === "build") {
      this.performBuildAction();
    } else {
      this.painting = true;
      this.performSculptStep();
    }
  }

  private handlePointerMove(e: PointerEvent): void {
    this.updatePointerNdc(e);
  }

  private handlePointerUp(e: PointerEvent): void {
    this.activePointers.delete(e.pointerId);
    if (this.activePointers.size === 0) this.painting = false;
  }

  private pickBuildCell(): BuildPick | null {
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
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

  private performBuildAction(): void {
    const pick = this.pickBuildCell();
    if (!pick) return;
    const [x, y, z] = pick.cell;
    const changed =
      pick.kind === "place"
        ? this.voxelWorld.place(x, y, z, this.blockType)
        : this.voxelWorld.remove(x, y, z);
    if (changed) this.options.onBlockCountChange?.(this.voxelWorld.count);
  }

  private performSculptStep(): void {
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hits = this.raycaster.intersectObject(this.sculptCanvas.mesh, false);
    if (hits.length === 0) return;
    const local = this.sculptCanvas.mesh.worldToLocal(hits[0].point.clone());
    const direction = this.sculptAction === "raise" ? 1 : -1;
    this.sculptCanvas.applyBrush(local.x, local.z, this.brushRadius, this.brushStrength, direction);
  }

  private updateHoverIndicators(): void {
    if (this.mode === "build") {
      this.brushRing.visible = false;
      const pick = this.pickBuildCell();
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
      this.raycaster.setFromCamera(this.pointerNdc, this.camera);
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

  resize(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
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
      this.raftGroup.remove(this.staticImportGroup);
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
    this.raftGroup.add(scene);
  }

  reset(): void {
    this.voxelWorld.clear();
    this.sculptCanvas.reset();
    if (this.staticImportGroup) {
      this.raftGroup.remove(this.staticImportGroup);
      disposeObject(this.staticImportGroup);
      this.staticImportGroup = null;
    }
    this.options.onBlockCountChange?.(0);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    this.renderer.domElement.removeEventListener("pointerdown", this.onPointerDown);
    this.renderer.domElement.removeEventListener("pointermove", this.onPointerMove);
    this.renderer.domElement.removeEventListener("pointerup", this.onPointerUp);
    this.renderer.domElement.removeEventListener("pointercancel", this.onPointerUp);
    this.renderer.domElement.removeEventListener("pointerleave", this.onPointerUp);
    this.controls.dispose();
    this.voxelWorld.dispose();
    this.sculptCanvas.dispose();
    disposeObject(this.scene);
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
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

function createOceanMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x0d5a72) },
      uShallow: { value: new THREE.Color(0x59c9d6) },
    },
    vertexShader: `
      uniform float uTime;
      varying float vHeight;
      void main() {
        vec3 pos = position;
        float t = uTime;
        float wave = sin(pos.x * 0.18 + t * 0.9) * 0.35
                   + sin(pos.z * 0.23 - t * 0.7) * 0.25
                   + sin((pos.x + pos.z) * 0.11 + t * 1.3) * 0.18;
        pos.y += wave;
        vHeight = wave;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      varying float vHeight;
      void main() {
        float h = clamp(vHeight * 0.7 + 0.5, 0.0, 1.0);
        vec3 color = mix(uDeep, uShallow, h);
        gl_FragColor = vec4(color, 0.94);
      }
    `,
    transparent: true,
  });
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
