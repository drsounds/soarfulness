import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { loadDecorationModel, type Decoration, type Vec3 } from "@/lib/decorations";

// DEKORATIONER in the three.js scene: one group per decoration (its
// position/rotation/scale), holding the repeated copies of its model, plus a
// TransformControls gizmo (move / rotate / scale) for the picked decoration
// while placement is on. The layout itself lives in React state/settings
// (src/lib/decorations.ts); this layer only mirrors it and reports gizmo
// edits back through onTransform.

export type DecorationGizmoMode = "translate" | "rotate" | "scale";

export type DecorationTransform = Pick<Decoration, "position" | "rotation" | "scale">;

type Callbacks = {
  // A gizmo drag finished: the decoration's new transform.
  onTransform: (id: string, t: DecorationTransform) => void;
  // A tap on a decoration (or on empty space → null) while placing.
  onPick: (id: string | null) => void;
  // A decoration's model is missing on this device or failed to parse.
  onModelError: (id: string, reason: "missing" | "failed") => void;
};

type Entry = {
  decoration: Decoration;
  group: THREE.Group;
  builtSrc: string | null;
  builtRepeat: string;
  token: number;
};

const DEG = Math.PI / 180;

function disposeTemplate(obj: THREE.Object3D) {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    mesh.geometry?.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (!mat) return;
    for (const m of Array.isArray(mat) ? mat : [mat]) {
      for (const val of Object.values(m)) if (val instanceof THREE.Texture) val.dispose();
      m.dispose();
    }
  });
}

function round(v: number, digits = 3) {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

export class DecorationLayer {
  readonly root = new THREE.Group();
  private readonly controls: TransformControls;
  private readonly helper: THREE.Object3D;
  private readonly entries = new Map<string, Entry>();
  private readonly templates = new Map<string, Promise<THREE.Object3D | null>>();
  private readonly loader = new GLTFLoader();
  private selectedId: string | null = null;
  private editing = false;
  private nextToken = 1;
  private downAt: { x: number; y: number } | null = null;
  private readonly raycaster = new THREE.Raycaster();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    private readonly dom: HTMLElement,
    private readonly cb: Callbacks,
  ) {
    this.root.name = "decorations";
    scene.add(this.root);

    this.controls = new TransformControls(camera, dom);
    this.controls.setSize(1.1);
    this.helper = this.controls.getHelper();
    this.helper.visible = false;
    scene.add(this.helper);
    this.controls.enabled = false;
    this.controls.addEventListener("mouseUp", this.onGizmoUp);

    dom.addEventListener("pointerdown", this.onPointerDown);
    dom.addEventListener("pointerup", this.onPointerUp);
  }

  // Mirrors the current scene's decoration list into the scene graph.
  setDecorations(list: Decoration[]) {
    const seen = new Set<string>();
    for (const d of list) {
      seen.add(d.id);
      let e = this.entries.get(d.id);
      if (!e) {
        const group = new THREE.Group();
        group.userData.decorationId = d.id;
        this.root.add(group);
        e = { decoration: d, group, builtSrc: null, builtRepeat: "", token: 0 };
        this.entries.set(d.id, e);
      }
      e.decoration = d;
      // Don't fight the gizmo while it is being dragged.
      if (!(this.controls.dragging && this.selectedId === d.id)) this.applyTransform(e);
      e.group.visible = d.visible;
      const repeatKey = JSON.stringify(d.repeat);
      if (e.builtSrc !== d.src || e.builtRepeat !== repeatKey) {
        e.builtSrc = d.src;
        e.builtRepeat = repeatKey;
        void this.build(e);
      }
    }
    for (const [id, e] of this.entries) {
      if (seen.has(id)) continue;
      this.root.remove(e.group);
      this.entries.delete(id);
    }
    if (this.selectedId && !this.entries.has(this.selectedId)) this.select(null);
    this.pruneTemplates();
    this.syncGizmo();
  }

  select(id: string | null) {
    this.selectedId = id;
    this.syncGizmo();
  }

  setEditing(on: boolean) {
    this.editing = on;
    this.syncGizmo();
  }

  setMode(mode: DecorationGizmoMode) {
    this.controls.setMode(mode);
  }

  setSpace(space: "local" | "world") {
    this.controls.setSpace(space);
  }

  // The size of a model's largest bounding-box side, in meters (null if it
  // can't be loaded). Used to fit a freshly imported model to a sane size.
  async measure(src: string): Promise<number | null> {
    const tpl = await this.template(src);
    if (!tpl) return null;
    const size = new THREE.Box3().setFromObject(tpl).getSize(new THREE.Vector3());
    const max = Math.max(size.x, size.y, size.z);
    return Number.isFinite(max) && max > 0 ? max : null;
  }

  dispose() {
    this.dom.removeEventListener("pointerdown", this.onPointerDown);
    this.dom.removeEventListener("pointerup", this.onPointerUp);
    this.controls.removeEventListener("mouseUp", this.onGizmoUp);
    this.controls.detach();
    this.controls.dispose();
    this.scene.remove(this.helper);
    this.scene.remove(this.root);
    for (const p of this.templates.values()) {
      void p.then((t) => t && disposeTemplate(t)).catch(() => undefined);
    }
    this.templates.clear();
    this.entries.clear();
  }

  // ---- internals ----------------------------------------------------------

  private applyTransform(e: Entry) {
    const { position, rotation, scale } = e.decoration;
    e.group.position.set(...position);
    e.group.rotation.set(rotation[0] * DEG, rotation[1] * DEG, rotation[2] * DEG, "XYZ");
    e.group.scale.set(...scale);
  }

  private syncGizmo() {
    const e = this.selectedId ? this.entries.get(this.selectedId) : undefined;
    const on = this.editing && !!e && e.decoration.visible;
    if (on && e) {
      if (this.controls.object !== e.group) this.controls.attach(e.group);
    } else if (this.controls.object) {
      this.controls.detach();
    }
    this.controls.enabled = on;
    this.helper.visible = on;
  }

  private template(src: string): Promise<THREE.Object3D | null> {
    let p = this.templates.get(src);
    if (!p) {
      p = loadDecorationModel(src)
        .then((data) => (data ? this.loader.parseAsync(data, "") : null))
        .then((gltf) => {
          if (!gltf) return null;
          const model = gltf.scene;
          // Same look as loaded scenes: every mesh casts and receives the
          // sun's shadow.
          model.traverse((o) => {
            if ((o as THREE.Mesh).isMesh) {
              o.castShadow = true;
              o.receiveShadow = true;
            }
          });
          return model as THREE.Object3D;
        });
      // A failed parse is cached as a rejection so the same broken file
      // isn't parsed again on every settings change.
      this.templates.set(src, p);
    }
    return p;
  }

  private pruneTemplates() {
    const used = new Set<string>();
    for (const e of this.entries.values()) used.add(e.decoration.src);
    for (const [src, p] of this.templates) {
      if (used.has(src)) continue;
      this.templates.delete(src);
      void p.then((t) => t && disposeTemplate(t)).catch(() => undefined);
    }
  }

  private async build(e: Entry) {
    const token = (e.token = this.nextToken++);
    const { src, repeat, id } = e.decoration;
    let tpl: THREE.Object3D | null;
    try {
      tpl = await this.template(src);
    } catch (err) {
      console.error(`Failed to load decoration "${e.decoration.name}"`, err);
      if (e.token === token) this.cb.onModelError(id, "failed");
      return;
    }
    if (e.token !== token || this.entries.get(id) !== e) return;
    // Old copies share geometry/materials with the cached template, so they
    // are only detached here — the template owns the GPU resources.
    e.group.clear();
    if (!tpl) {
      this.cb.onModelError(id, "missing");
      return;
    }
    const [nx, ny, nz] = repeat.count;
    let k = 0;
    for (let iy = 0; iy < ny; iy++) {
      for (let iz = 0; iz < nz; iz++) {
        for (let ix = 0; ix < nx; ix++) {
          const copy = tpl.clone(true);
          copy.position.set(ix * repeat.spacing[0], iy * repeat.spacing[1], iz * repeat.spacing[2]);
          copy.rotation.y = k * repeat.stepRotY * DEG;
          copy.scale.setScalar(repeat.stepScale ** k);
          copy.userData.decorationId = id;
          e.group.add(copy);
          k++;
        }
      }
    }
    this.syncGizmo();
  }

  private onGizmoUp = () => {
    const obj = this.controls.object;
    const id = obj?.userData.decorationId as string | undefined;
    if (!obj || !id) return;
    const pos: Vec3 = [round(obj.position.x), round(obj.position.y), round(obj.position.z)];
    const rot: Vec3 = [
      round(obj.rotation.x / DEG, 2),
      round(obj.rotation.y / DEG, 2),
      round(obj.rotation.z / DEG, 2),
    ];
    const scl: Vec3 = [
      round(Math.max(0.001, obj.scale.x)),
      round(Math.max(0.001, obj.scale.y)),
      round(Math.max(0.001, obj.scale.z)),
    ];
    this.cb.onTransform(id, { position: pos, rotation: rot, scale: scl });
  };

  // A tap (not a drag, not on the gizmo) picks the decoration under it.
  private onPointerDown = (ev: PointerEvent) => {
    this.downAt = this.editing && ev.button === 0 ? { x: ev.clientX, y: ev.clientY } : null;
    // The gizmo's own handle is under the pointer: leave the tap to it.
    if (this.controls.axis !== null) this.downAt = null;
  };

  private onPointerUp = (ev: PointerEvent) => {
    const down = this.downAt;
    this.downAt = null;
    if (!down || !this.editing || this.controls.dragging) return;
    if (Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 6) return;
    const rect = this.dom.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObject(this.root, true)[0];
    let o: THREE.Object3D | null = hit?.object ?? null;
    while (o && !o.userData.decorationId) o = o.parent;
    // Walk up to the decoration's own group (copies carry the id too).
    const id = (o?.userData.decorationId as string | undefined) ?? null;
    this.cb.onPick(id);
  };
}
