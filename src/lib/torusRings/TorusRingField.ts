import * as THREE from "three";

// A field of floating torus "bath rings" arrayed around the camera on an
// invisible horizontal grid: the XZ plane is divided into `cellSize` square
// cells, and every cell within `viewDistance` of the camera's current XZ
// position holds a vertical stack (`verticalCount` rings, `verticalSpacing`
// apart) of static toruses. Each ring's height snaps to a world-space
// vertical grid line (multiples of `verticalSpacing`), and every frame each
// stack is re-centred on the grid line nearest the camera's *current* height
// — so rings always surround the camera vertically too, even after it has
// risen or sunk since the column spawned, while a ring that stays inside the
// stack keeps its exact world height (only the ring falling off one end of
// the stack moves, to the other end). This is "the invisible grid" the
// camera's position is checked against every frame.
//
// A cell the camera is near fades in; one it has left behind fades out over
// FADE_OUT_SECONDS and is then disposed, so a fresh region of the grid ahead
// of the camera always fills in with a brand new ring set rather than the
// old set sliding along with you. On top of that per-cell fade-in/out, each
// active cell's opacity also ramps down continuously the closer its distance
// gets to `viewDistance`, so leaving a ring set behind reads as a smooth
// fade with distance rather than a hard pop at the edge.
export type TorusRingFieldConfig = {
  enabled: boolean;
  // TorusGeometry's own major/minor radius (world units), before `scale`.
  radius: number;
  tube: number;
  // Uniform scale multiplier layered on top of radius/tube — lets overall
  // ring size be dialed independently of its radius/thickness proportions.
  scale: number;
  opacity: number;
  color: number;
  // Optional texture URL for the ring surface; null renders a flat emissive
  // color instead.
  textureUrl: string | null;
  // The invisible grid: XZ spacing between ring-stack columns, and the
  // vertical spacing/count of rings within a column.
  cellSize: number;
  verticalSpacing: number;
  verticalCount: number;
  // How far a column may exist from the camera (world units, XZ-only), and
  // the trailing distance over which its opacity ramps down to 0 before that.
  viewDistance: number;
  fadeDistance: number;
};

const RADIAL_SEGMENTS = 12;
const TUBULAR_SEGMENTS = 32;
const FADE_IN_SECONDS = 0.6;
const FADE_OUT_SECONDS = 0.6;

type Cell = {
  group: THREE.Group;
  meshes: THREE.Mesh[];
  material: THREE.MeshStandardMaterial;
  // 0..1 temporal fade-in/out progress, independent of the distance-based
  // spatial fade applied in update() — see the class comment above.
  life: number;
  activeThisFrame: boolean;
};

function cellKey(ix: number, iz: number): string {
  return `${ix},${iz}`;
}

export class TorusRingField {
  private scene: THREE.Scene;
  private config: TorusRingFieldConfig;
  private geometry: THREE.TorusGeometry;
  private texture: THREE.Texture | null;
  private textureLoader = new THREE.TextureLoader();
  private cells = new Map<string, Cell>();
  private disposed = false;

  constructor(scene: THREE.Scene, config: TorusRingFieldConfig) {
    this.scene = scene;
    this.config = { ...config };
    this.geometry = this.buildGeometry();
    this.texture = this.loadTexture(config.textureUrl);
  }

  private buildGeometry(): THREE.TorusGeometry {
    return new THREE.TorusGeometry(
      Math.max(0.01, this.config.radius),
      Math.max(0.001, this.config.tube),
      RADIAL_SEGMENTS,
      TUBULAR_SEGMENTS,
    );
  }

  private loadTexture(url: string | null): THREE.Texture | null {
    if (!url) return null;
    const tex = this.textureLoader.load(url);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // Applies a partial config change. Anything that affects per-cell geometry
  // or material construction (radius/tube/textureUrl) or the grid layout
  // itself (cellSize/verticalSpacing/verticalCount) clears every existing
  // column so update() lazily rebuilds them fresh — with a normal fade-in —
  // on the next frame, rather than trying to mutate live meshes in place.
  // Everything else (opacity/color/scale/viewDistance/fadeDistance/enabled)
  // is read live off `this.config` every frame in update(), so it applies
  // immediately with no rebuild.
  setConfig(next: Partial<TorusRingFieldConfig>) {
    const prev = this.config;
    const merged = { ...prev, ...next };
    const needsRebuild =
      merged.radius !== prev.radius ||
      merged.tube !== prev.tube ||
      merged.textureUrl !== prev.textureUrl ||
      merged.color !== prev.color ||
      merged.cellSize !== prev.cellSize ||
      merged.verticalSpacing !== prev.verticalSpacing ||
      merged.verticalCount !== prev.verticalCount;
    this.config = merged;
    if (!needsRebuild) return;

    if (merged.radius !== prev.radius || merged.tube !== prev.tube) {
      this.geometry.dispose();
      this.geometry = this.buildGeometry();
    }
    if (merged.textureUrl !== prev.textureUrl) {
      this.texture?.dispose();
      this.texture = this.loadTexture(merged.textureUrl);
    }
    this.clearAllCells();
  }

  private clearAllCells() {
    for (const cell of this.cells.values()) this.disposeCell(cell);
    this.cells.clear();
  }

  private disposeCell(cell: Cell) {
    this.scene.remove(cell.group);
    cell.material.dispose();
  }

  // Builds one XZ column: a vertical stack of `verticalCount` rings sharing
  // one material (their opacity always fades together — see the class
  // comment above, fading is per-XZ-cell, not per ring), snapped to the
  // world's absolute vertical grid — update() positions the rings around the
  // camera's current height every frame (see placeRings).
  private createCell(ix: number, iz: number): Cell {
    const cfg = this.config;
    const material = new THREE.MeshStandardMaterial({
      color: cfg.color,
      emissive: cfg.color,
      emissiveIntensity: 0.7,
      map: this.texture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      roughness: 0.6,
      metalness: 0,
    });

    const group = new THREE.Group();
    group.position.set(ix * cfg.cellSize, 0, iz * cfg.cellSize);

    const meshes: THREE.Mesh[] = [];
    const count = Math.max(1, Math.round(cfg.verticalCount));
    for (let k = 0; k < count; k++) {
      const mesh = new THREE.Mesh(this.geometry, material);
      // TorusGeometry lies flat in the XY plane by default (hole along Z);
      // rotate it to lie flat in XZ instead, like a ring floating on/in air.
      mesh.rotation.x = Math.PI / 2;
      group.add(mesh);
      meshes.push(mesh);
    }
    this.scene.add(group);
    return { group, meshes, material, life: 0, activeThisFrame: true };
  }

  // Puts a column's rings on the `meshes.length` vertical grid lines centred
  // on the one nearest the camera's height. Each ring is keyed to its
  // absolute level modulo the stack size, so as the camera climbs past a grid
  // line only the bottom ring jumps to the new top slot (and vice versa) —
  // every other ring stays at its world height instead of the whole stack
  // sliding along with the camera.
  private placeRings(cell: Cell, cameraY: number, spacing: number, scale: number) {
    const n = cell.meshes.length;
    const centerLevel = Math.round(cameraY / spacing);
    const lowest = centerLevel - Math.floor((n - 1) / 2);
    for (let i = 0; i < n; i++) {
      const level = lowest + i;
      const mesh = cell.meshes[((level % n) + n) % n];
      mesh.position.y = level * spacing;
      // Scale each ring about its own centre. (Scaling the whole column group
      // instead would also scale the rings' heights about y=0 — throwing them
      // far above/below the camera whenever scale != 1.)
      mesh.scale.setScalar(scale);
    }
  }

  // Call once per frame with the camera's current world position and the
  // frame's delta time (seconds).
  update(cameraPos: THREE.Vector3, dt: number) {
    if (this.disposed) return;
    const cfg = this.config;
    if (!cfg.enabled) {
      if (this.cells.size) this.clearAllCells();
      return;
    }

    for (const cell of this.cells.values()) cell.activeThisFrame = false;

    const cellSize = Math.max(0.5, cfg.cellSize);
    const viewDistance = Math.max(cellSize, cfg.viewDistance);
    const fadeDistance = Math.max(0.01, cfg.fadeDistance);
    const verticalSpacing = Math.max(0.01, cfg.verticalSpacing);
    const camIx = Math.round(cameraPos.x / cellSize);
    const camIz = Math.round(cameraPos.z / cellSize);
    // How many grid steps out a cell could still fall within viewDistance —
    // the loop below only bothers spawning cells inside this square, then
    // filters to the actual circle by distance.
    const reach = Math.ceil(viewDistance / cellSize) + 1;

    for (let dx = -reach; dx <= reach; dx++) {
      for (let dz = -reach; dz <= reach; dz++) {
        const ix = camIx + dx;
        const iz = camIz + dz;
        const cx = ix * cellSize;
        const cz = iz * cellSize;
        const dist = Math.hypot(cx - cameraPos.x, cz - cameraPos.z);
        if (dist > viewDistance) continue;
        const key = cellKey(ix, iz);
        let cell = this.cells.get(key);
        if (!cell) {
          cell = this.createCell(ix, iz);
          this.cells.set(key, cell);
        }
        cell.activeThisFrame = true;
      }
    }

    for (const [key, cell] of this.cells) {
      const rate = dt / (cell.activeThisFrame ? FADE_IN_SECONDS : FADE_OUT_SECONDS);
      cell.life = cell.activeThisFrame
        ? Math.min(1, cell.life + rate)
        : Math.max(0, cell.life - rate);

      if (!cell.activeThisFrame && cell.life <= 0) {
        this.disposeCell(cell);
        this.cells.delete(key);
        continue;
      }

      const dist = Math.hypot(cell.group.position.x - cameraPos.x, cell.group.position.z - cameraPos.z);
      const spatialFade = Math.max(0, Math.min(1, (viewDistance - dist) / fadeDistance));
      const eased = cell.life * cell.life * (3 - 2 * cell.life); // smoothstep
      cell.material.opacity = cfg.opacity * spatialFade * eased;
      this.placeRings(cell, cameraPos.y, verticalSpacing, cfg.scale);
      cell.group.visible = cell.material.opacity > 0.002;
    }
  }

  dispose() {
    this.clearAllCells();
    this.geometry.dispose();
    this.texture?.dispose();
    this.texture = null;
    this.disposed = true;
  }
}
