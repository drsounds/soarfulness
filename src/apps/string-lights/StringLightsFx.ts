import * as THREE from "three";
import {
  STRING_LIGHTS_MAX_EMITTERS,
  getStringLights,
  getStringLightsVersion,
  sceneKeyFor,
  setStringLightsSceneKey,
  stringCurvePoints,
  stringLightsView,
  stringsForScene,
  type StringLight,
} from "./stringLights";
import { bulbGeometry } from "./bulbGeometry";
import { EdgeLightsFx, type EdgeLightsFrame } from "./EdgeLightsFx";
import { GlowPoints } from "./GlowPoints";
import { BulbShader } from "./shadeBulbs";
import { setWaterPass } from "@/lib/waterPass";

// LJUSSLINGOR renderer: draws the current scene's strings (see
// apps/string-lights/stringLights.ts for the settings and the store this reads).
//
// Per string:
// - a frame group at anchor A, turned to face anchor B, holding a sway pivot
//   that rocks the whole drape about the anchor line (so nothing is rebuilt
//   per frame);
// - the wire: a thin tube along the hanging curve, plus short drop wires
//   down to each bulb;
// - bulbs: one InstancedMesh (unlit, per-instance color = palette × the
//   animation level) and one for the dark sockets;
// - glow: additive point sprites at each bulb, sized in world units.
// Only colors are written per frame; geometry is rebuilt when a string's
// shape settings change (tracked with a key per string).
//
// Real light (SKAPAR LJUS): a shared pool of PointLights, at most
// `emitters` (LJUSKÄLLOR) across every string. Each emitting string gets a
// share, placed at evenly spaced bulbs and colored by the bulbs around
// them. The pool is created once on first use and only rebuilt when the cap
// changes, so lit materials don't recompile every frame.

const WIRE_RADIUS = 0.009;

type Built = {
  key: string;
  frame: THREE.Group;
  pivot: THREE.Group;
  wire: THREE.Mesh;
  drops: THREE.LineSegments | null;
  bulbs: THREE.InstancedMesh;
  sockets: THREE.InstancedMesh | null;
  glow: GlowPoints;
  /** Bulb centers in the pivot's frame. */
  centers: THREE.Vector3[];
  seeds: number[];
  /** This frame's animation level per bulb. */
  levels: Float32Array;
  axis: THREE.Vector3;
  phase: number;
};

/** Fields that change the built geometry. */
function shapeKey(s: StringLight): string {
  return [
    s.x,
    s.z,
    s.yaw,
    s.span,
    s.heightA,
    s.heightB,
    s.curve,
    s.sag,
    s.drapes,
    s.wireColor,
    s.bulbCount,
    s.bulbSize,
    s.bulbStyle,
    s.bulbDrop,
  ].join("|");
}

export type StringLightsUpdate = {
  sceneId: string | null;
  waterY: number;
  /** 0 = day, 1 = night. */
  night: number;
  /** Drawing-buffer height in CSS px, for sizing glow sprites. */
  viewportHeight: number;
  /** The loaded scene model, and whether it is an imported (EGNA SCENER) .glb. */
  model: THREE.Object3D | null;
  modelImported: boolean;
  /** Other imported .glb roots (DEKORATIONER) the edge lights may follow. */
  extraRoots: THREE.Object3D[];
};

export class StringLightsFx {
  readonly group = new THREE.Group();
  private readonly scene: THREE.Scene;
  private built = new Map<string, Built>();
  private readonly bulbMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  private readonly socketMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a2a,
    roughness: 0.5,
    metalness: 0.4,
  });
  private readonly wireMats = new Map<string, THREE.MeshStandardMaterial>();
  private readonly dropMat = new THREE.LineBasicMaterial({ color: 0x1b1b1b });
  private lights: THREE.PointLight[] = [];
  private lastVersion = -1;
  private lastKey = "";
  private readonly tmpColor = new THREE.Color();
  private readonly shader = new BulbShader();
  readonly edgeLights: EdgeLightsFx;
  private readonly tmpV = new THREE.Vector3();
  private readonly tmpQ = new THREE.Quaternion();
  private readonly dir = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group.name = "stringLights";
    scene.add(this.group);
    this.edgeLights = new EdgeLightsFx(scene);
  }

  private wireMat(color: string) {
    let m = this.wireMats.get(color);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1 });
      this.wireMats.set(color, m);
    }
    return m;
  }

  private build(s: StringLight): Built {
    const frame = new THREE.Group();
    const pivot = new THREE.Group();
    frame.add(pivot);
    frame.rotation.y = (-s.yaw * Math.PI) / 180;
    const segs = Math.min(400, 48 * (s.curve === "festoon" ? s.drapes : 1));
    const pts = stringCurvePoints(s, segs).map(([x, y, z]) => new THREE.Vector3(x, y, z));

    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.1);
    const wire = new THREE.Mesh(
      new THREE.TubeGeometry(curve, segs, WIRE_RADIUS, 5, false),
      this.wireMat(s.wireColor),
    );
    pivot.add(wire);

    // Bulbs evenly spaced by arc length, half a gap in from each anchor.
    const n = s.bulbCount;
    const lengths = [0];
    for (let i = 1; i < pts.length; i++)
      lengths.push(lengths[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const total = lengths[lengths.length - 1] || 1;
    const centers: THREE.Vector3[] = [];
    const wirePts: THREE.Vector3[] = [];
    let seg = 1;
    for (let i = 0; i < n; i++) {
      const d = ((i + 0.5) / n) * total;
      while (seg < lengths.length - 1 && lengths[seg] < d) seg++;
      const f = (d - lengths[seg - 1]) / Math.max(1e-9, lengths[seg] - lengths[seg - 1]);
      const p = pts[seg - 1].clone().lerp(pts[seg], f);
      wirePts.push(p);
      centers.push(new THREE.Vector3(p.x, p.y - s.bulbDrop - s.bulbSize * 0.5, p.z));
    }

    let drops: THREE.LineSegments | null = null;
    if (s.bulbDrop > 0.005) {
      const arr = new Float32Array(n * 6);
      for (let i = 0; i < n; i++) {
        const a = wirePts[i];
        const c = centers[i];
        arr.set([a.x, a.y, a.z, c.x, c.y + s.bulbSize * 0.5, c.z], i * 6);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
      this.dropMat.color.set(s.wireColor);
      drops = new THREE.LineSegments(geo, this.dropMat);
      pivot.add(drops);
    }

    const bulbs = new THREE.InstancedMesh(bulbGeometry(s.bulbStyle), this.bulbMat, n);
    const sockets =
      s.bulbStyle === "fairy"
        ? null
        : new THREE.InstancedMesh(
            new THREE.CylinderGeometry(0.22, 0.2, 0.35, 8),
            this.socketMat,
            n,
          );
    const m = new THREE.Matrix4();
    const scale = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const size = s.bulbStyle === "fairy" ? s.bulbSize * 0.45 : s.bulbSize;
    for (let i = 0; i < n; i++) {
      scale.setScalar(size);
      m.compose(centers[i], q, scale);
      bulbs.setMatrixAt(i, m);
      if (sockets) {
        this.tmpV.copy(centers[i]);
        this.tmpV.y += size * 0.62;
        m.compose(this.tmpV, q, scale);
        sockets.setMatrixAt(i, m);
      }
      bulbs.setColorAt(i, this.tmpColor.set(1, 1, 1));
    }
    bulbs.instanceMatrix.needsUpdate = true;
    bulbs.frustumCulled = false;
    pivot.add(bulbs);
    if (sockets) {
      sockets.instanceMatrix.needsUpdate = true;
      sockets.frustumCulled = false;
      pivot.add(sockets);
    }

    const gpos = new Float32Array(n * 3);
    centers.forEach((c, i) => gpos.set([c.x, c.y, c.z], i * 3));
    const glow = new GlowPoints(gpos);
    glow.addTo(pivot);

    for (const o of [wire, bulbs, ...(sockets ? [sockets] : []), ...(drops ? [drops] : [])]) {
      o.raycast = () => {};
    }

    const seeds = centers.map((_, i) => {
      const h = Math.sin((i + 1) * 78.233 + s.id.length * 3.1) * 43758.5453;
      return h - Math.floor(h);
    });
    const axis = new THREE.Vector3(s.span, s.heightB - s.heightA, 0).normalize();
    let phase = 0;
    for (let i = 0; i < s.id.length; i++) phase += s.id.charCodeAt(i) * 0.37;

    this.group.add(frame);
    return {
      key: shapeKey(s),
      frame,
      pivot,
      wire,
      drops,
      bulbs,
      sockets,
      glow,
      centers,
      seeds,
      levels: new Float32Array(n),
      axis,
      phase,
    };
  }

  private disposeBuilt(b: Built) {
    b.frame.removeFromParent();
    b.wire.geometry.dispose();
    b.drops?.geometry.dispose();
    b.bulbs.geometry.dispose();
    b.bulbs.dispose();
    if (b.sockets) {
      b.sockets.geometry.dispose();
      b.sockets.dispose();
    }
    b.glow.dispose();
  }

  private sync(strings: StringLight[]) {
    const keep = new Set<string>();
    for (const s of strings) {
      if (!s.visible) continue;
      keep.add(s.id);
      const cur = this.built.get(s.id);
      if (cur && cur.key === shapeKey(s)) continue;
      if (cur) this.disposeBuilt(cur);
      this.built.set(s.id, this.build(s));
    }
    for (const [id, b] of this.built) {
      if (!keep.has(id)) {
        this.disposeBuilt(b);
        this.built.delete(id);
      }
    }
  }

  private ensureLights(count: number) {
    if (this.lights.length === count) return;
    for (const l of this.lights) {
      l.removeFromParent();
      l.dispose();
    }
    this.lights = [];
    for (let i = 0; i < count; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 0, 2);
      l.name = "string-light";
      this.scene.add(l);
      this.lights.push(l);
    }
  }

  update(t: number, camera: THREE.PerspectiveCamera, cfg: StringLightsUpdate) {
    // Remember the view for "add in front of me".
    camera.getWorldDirection(this.dir);
    stringLightsView.x = camera.position.x;
    stringLightsView.y = camera.position.y;
    stringLightsView.z = camera.position.z;
    stringLightsView.yaw = Math.atan2(this.dir.z, this.dir.x);
    stringLightsView.waterY = cfg.waterY;

    setWaterPass(cfg.waterY, camera.position.y);
    const key = sceneKeyFor(cfg.sceneId);
    setStringLightsSceneKey(key);
    const state = getStringLights();
    const strings = state.on ? stringsForScene(state, key) : [];
    const version = getStringLightsVersion();
    if (version !== this.lastVersion || key !== this.lastKey) {
      this.sync(strings);
      this.lastVersion = version;
      this.lastKey = key;
    }
    this.group.visible = this.built.size > 0;

    const emitting = strings.filter((s) => s.visible && s.emitLight);
    const cap = Math.min(STRING_LIGHTS_MAX_EMITTERS, state.emitters);
    if (emitting.length && cap > 0) this.ensureLights(cap);
    let lightIdx = 0;

    const night = Math.min(1, Math.max(0, cfg.night));
    const glowMul = state.dayGlow + (1 - state.dayGlow) * night;
    const scale = cfg.viewportHeight / (2 * Math.tan((camera.fov * Math.PI) / 360));

    for (const s of strings) {
      const b = this.built.get(s.id);
      if (!b) continue;
      b.frame.position.set(s.x, cfg.waterY + s.heightA, s.z);
      // Sway: two slow incommensurate swings about the anchor line.
      const sw =
        s.sway *
        0.22 *
        (Math.sin(t * 0.9 + b.phase) * 0.7 + Math.sin(t * 1.73 + b.phase * 1.9) * 0.3);
      b.pivot.quaternion.copy(this.tmpQ.setFromAxisAngle(b.axis, sw));

      const n = b.centers.length;
      this.shader.shade(t, s, n, b.seeds, b.bulbs, b.glow.array, glowMul, b.levels);
      b.glow.commit();
      b.glow.setStyle(
        (s.bulbStyle === "fairy" ? s.bulbSize * 0.6 : s.bulbSize) * 6 * s.glowSize,
        scale,
        s.glow > 0.001,
      );
    }

    // KANTLJUS: bulbs along the scene's (and imported .glb) mesh edges.
    const edge = state.edge;
    let edgeFrame: EdgeLightsFrame | null = null;
    if (state.on && edge.on) {
      const roots: THREE.Object3D[] = [];
      if (cfg.model && (edge.includeImported || !cfg.modelImported)) roots.push(cfg.model);
      if (edge.includeImported) roots.push(...cfg.extraRoots);
      edgeFrame = { edge, roots, glowMul, scale, center: camera.position };
    }
    this.edgeLights.update(t, edgeFrame);

    // Real lights: split the pool over the emitting strings.
    if (this.lights.length) {
      const per = emitting.length
        ? Math.max(1, Math.floor(this.lights.length / emitting.length))
        : 0;
      for (const s of emitting) {
        const b = this.built.get(s.id);
        if (!b) continue;
        const n = b.centers.length;
        const share = Math.min(per, n, this.lights.length - lightIdx);
        b.frame.updateMatrixWorld(true);
        for (let j = 0; j < share; j++) {
          const from = Math.floor((j / share) * n);
          const to = Math.max(from + 1, Math.floor(((j + 1) / share) * n));
          const mid = Math.min(n - 1, Math.floor((from + to) / 2));
          let r = 0;
          let g = 0;
          let bl = 0;
          let lv = 0;
          const arr = b.glow.array;
          for (let i = from; i < to; i++) {
            r += arr[i * 3];
            g += arr[i * 3 + 1];
            bl += arr[i * 3 + 2];
            lv += b.levels[i];
          }
          const light = this.lights[lightIdx++];
          light.position.copy(b.centers[mid]).applyMatrix4(b.pivot.matrixWorld);
          const max = Math.max(r, g, bl, 1e-6);
          light.color.setRGB(r / max, g / max, bl / max);
          // ~1.5 cd per lit bulb it stands in for, so dense strings light
          // the scene more than sparse ones.
          light.intensity = lv * 1.5 * Math.max(0.15, s.brightness);
        }
      }
      for (let i = lightIdx; i < this.lights.length; i++) this.lights[i].intensity = 0;
    }
  }

  /** Hides the strings and silences their lights (APPS: switched off). */
  hide() {
    this.group.visible = false;
    this.edgeLights.update(0, null);
    for (const l of this.lights) l.intensity = 0;
  }

  dispose() {
    for (const b of this.built.values()) this.disposeBuilt(b);
    this.built.clear();
    for (const l of this.lights) {
      l.removeFromParent();
      l.dispose();
    }
    this.lights = [];
    this.edgeLights.dispose();
    this.group.removeFromParent();
    this.bulbMat.dispose();
    this.socketMat.dispose();
    this.dropMat.dispose();
    for (const m of this.wireMats.values()) m.dispose();
  }
}
