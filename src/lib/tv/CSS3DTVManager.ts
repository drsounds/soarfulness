import * as THREE from "three";
import { CSS3DObject, CSS3DRenderer } from "three/examples/jsm/renderers/CSS3DRenderer.js";
import { toEmbedUrl } from "./youtubeEmbed";

// Persisted shape of a single "TV apparatus". Position/rotation/scale are
// plain three.js world-space numbers; the DOM panel itself always renders at
// a fixed native pixel size (NATIVE_W x NATIVE_H) so the embedded page stays
// crisp — resizing the TV only changes `scale`, never the iframe's own
// resolution.
export type TVState = {
  id: string;
  url: string;
  x: number;
  y: number;
  z: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  scale: number;
};

const STORAGE_KEY = "aquafulness:tvs:v1";
const NATIVE_W = 480;
const NATIVE_H = 270;
const DEFAULT_SCALE = 0.02;
const MIN_SCALE = 0.006;
const MAX_SCALE = 0.08;
const SPAWN_DISTANCE = 9;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function makeId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `tv-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadTVs(): TVState[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const num = (v: unknown, fallback: number) =>
      typeof v === "number" && Number.isFinite(v) ? v : fallback;
    return parsed
      .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
      .map((t) => ({
        id: typeof t.id === "string" ? t.id : makeId(),
        url: typeof t.url === "string" ? t.url : "",
        x: num(t.x, 0),
        y: num(t.y, 2),
        z: num(t.z, 0),
        rotX: num(t.rotX, 0),
        rotY: num(t.rotY, 0),
        rotZ: num(t.rotZ, 0),
        scale: clamp(num(t.scale, DEFAULT_SCALE), MIN_SCALE, MAX_SCALE),
      }));
  } catch {
    return [];
  }
}

let stylesInjected = false;
function ensureStyles() {
  if (stylesInjected || typeof document === "undefined") return;
  if (document.getElementById("aqf-tv-styles")) {
    stylesInjected = true;
    return;
  }
  const style = document.createElement("style");
  style.id = "aqf-tv-styles";
  style.textContent = `
    .aqf-tv-panel {
      width: ${NATIVE_W}px; height: ${NATIVE_H}px; display: flex; flex-direction: column;
      background: #0b1620; border-radius: 10px; overflow: hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08);
      font-family: system-ui, -apple-system, sans-serif;
    }
    .aqf-tv-titlebar {
      display: flex; align-items: center; gap: 6px; padding: 6px 8px;
      background: rgba(255,255,255,0.06); border-bottom: 1px solid rgba(255,255,255,0.08);
      flex: 0 0 auto;
    }
    .aqf-tv-url {
      flex: 1 1 auto; min-width: 0; background: rgba(0,0,0,0.35);
      border: 1px solid rgba(255,255,255,0.15); border-radius: 999px;
      color: #fff; font-size: 12px; padding: 5px 10px; outline: none;
    }
    .aqf-tv-url::placeholder { color: rgba(255,255,255,0.4); }
    .aqf-tv-btn {
      flex: 0 0 auto; width: 26px; height: 26px; border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.9); font-size: 13px; line-height: 1; cursor: pointer;
      display: flex; align-items: center; justify-content: center; touch-action: none;
    }
    .aqf-tv-btn:active { background: rgba(255,255,255,0.25); }
    .aqf-tv-screen { position: relative; flex: 1 1 auto; background: #000; min-height: 0; }
    .aqf-tv-iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
    .aqf-tv-placeholder {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      color: rgba(255,255,255,0.35); font-size: 11px; letter-spacing: 0.08em; text-align: center; padding: 0 16px;
    }
    .aqf-tv-resize {
      position: absolute; right: 2px; bottom: 2px; width: 18px; height: 18px; cursor: nwse-resize;
      touch-action: none; border-right: 2px solid rgba(255,255,255,0.5); border-bottom: 2px solid rgba(255,255,255,0.5);
      border-bottom-right-radius: 4px;
    }
    .aqf-tv-pivot {
      position: absolute; left: 50%; bottom: -4px; width: 8px; height: 8px; margin-left: -4px;
      border-radius: 999px; background: #fff; box-shadow: 0 0 0 2px rgba(0,0,0,0.6);
      pointer-events: none;
    }
    /* Transform toolbar: axis-constrained move (X/Y/Z, Blender-style colors),
       free (unconstrained) move, and pivot rotate — dragging each handle
       manipulates the panel around its own pivot (its position), the same
       model 3D DCC tools use for their move/rotate gizmos. */
    .aqf-tv-toolbar {
      display: flex; align-items: center; gap: 5px; padding: 5px 8px;
      background: rgba(0,0,0,0.25); border-bottom: 1px solid rgba(255,255,255,0.06);
      flex: 0 0 auto;
    }
    .aqf-tv-axis {
      flex: 0 0 auto; width: 24px; height: 22px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 600; color: #fff; cursor: grab; touch-action: none;
      border: 1px solid rgba(255,255,255,0.25);
    }
    .aqf-tv-axis:active { cursor: grabbing; filter: brightness(1.3); }
    .aqf-tv-axis-free { background: rgba(255,255,255,0.14); font-size: 13px; }
    .aqf-tv-axis-x { background: rgba(229,72,77,0.75); }
    .aqf-tv-axis-y { background: rgba(48,164,108,0.75); }
    .aqf-tv-axis-z { background: rgba(59,130,246,0.75); }
    .aqf-tv-axis-rot { background: rgba(255,255,255,0.14); margin-left: auto; }
  `;
  document.head.appendChild(style);
  stylesInjected = true;
}

type TVEntry = {
  state: TVState;
  object: CSS3DObject;
  urlInput: HTMLInputElement;
  iframe: HTMLIFrameElement;
  placeholder: HTMLDivElement;
};

// Manages an arbitrary number of "TV apparatus" panels rendered via
// CSS3DRenderer alongside the main WebGLRenderer/scene, sharing the same
// camera. Each panel is a plain DOM element wrapped in a CSS3DObject, with a
// small transform toolbar (free move, X/Y/Z axis-constrained move, pivot
// rotate, corner resize) that manipulates the object's position/rotation/
// scale the same way a 3D DCC tool's move/rotate/scale gizmo would — all
// driven by pointer events, so mouse and touch work identically. State is
// persisted to localStorage on every change so panels survive a reload.
export class CSS3DTVManager {
  private renderer: CSS3DRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private container: HTMLElement;
  private entries = new Map<string, TVEntry>();
  private saveTimer: number | null = null;

  constructor(
    container: HTMLElement,
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number,
  ) {
    ensureStyles();
    this.container = container;
    this.camera = camera;

    this.renderer = new CSS3DRenderer();
    this.renderer.domElement.style.position = "absolute";
    this.renderer.domElement.style.top = "0";
    this.renderer.domElement.style.left = "0";
    this.renderer.domElement.style.pointerEvents = "none";
    this.renderer.setSize(width, height);
    container.appendChild(this.renderer.domElement);

    for (const state of loadTVs()) this.createEntry(state);
  }

  setSize(width: number, height: number) {
    this.renderer.setSize(width, height);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  count(): number {
    return this.entries.size;
  }

  // Spawns a new, blank TV a fixed distance in front of wherever the camera
  // is currently looking, facing back toward it.
  addTV(): void {
    // Use the camera's full 3D look direction (including pitch) so the panel
    // lands exactly in the center of the current view, not just level with
    // eye height — otherwise looking down at the water places new panels
    // above where the user is actually looking.
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.normalize();

    const pos = this.camera.position.clone().addScaledVector(dir, SPAWN_DISTANCE);

    // The panel's facing only follows the camera's horizontal yaw, so it
    // stays upright (not tilted to match pitch) while still facing the viewer.
    const flatDir = new THREE.Vector3(dir.x, 0, dir.z);
    if (flatDir.lengthSq() < 1e-6) flatDir.set(0, 0, -1);
    flatDir.normalize();
    const rotY = Math.atan2(-flatDir.x, -flatDir.z);

    const state: TVState = {
      id: makeId(),
      url: "",
      x: pos.x,
      y: Math.max(1.5, pos.y),
      z: pos.z,
      rotX: 0,
      rotY,
      rotZ: 0,
      scale: DEFAULT_SCALE,
    };
    this.createEntry(state);
    this.persist();
  }

  dispose() {
    if (this.saveTimer != null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    for (const id of Array.from(this.entries.keys())) this.removeEntry(id, false);
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  private persist() {
    if (typeof window === "undefined") return;
    try {
      const data = Array.from(this.entries.values()).map((e) => e.state);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* quota or privacy mode — ignore */
    }
  }

  private schedulePersist() {
    if (this.saveTimer != null) return;
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      this.persist();
    }, 250);
  }

  private removeEntry(id: string, persist = true) {
    const entry = this.entries.get(id);
    if (!entry) return;
    this.scene.remove(entry.object);
    this.entries.delete(id);
    if (persist) this.persist();
  }

  private applyUrl(entry: TVEntry, rawUrl: string, persistNow: boolean) {
    const trimmed = rawUrl.trim();
    entry.state.url = trimmed;
    if (entry.urlInput.value !== trimmed) entry.urlInput.value = trimmed;
    if (!trimmed) {
      entry.iframe.style.display = "none";
      entry.iframe.src = "";
      entry.placeholder.style.display = "flex";
    } else {
      const embed = toEmbedUrl(trimmed);
      entry.placeholder.style.display = "none";
      entry.iframe.style.display = "block";
      if (entry.iframe.src !== embed) entry.iframe.src = embed;
    }
    if (persistNow) this.persist();
  }

  private createEntry(state: TVState) {
    const el = document.createElement("div");
    el.className = "aqf-tv-panel";
    el.style.position = "relative";

    const titlebar = document.createElement("div");
    titlebar.className = "aqf-tv-titlebar";

    const urlInput = document.createElement("input");
    urlInput.className = "aqf-tv-url";
    urlInput.type = "text";
    urlInput.placeholder = "youtube.com/watch?v=... eller webbadress";
    urlInput.value = state.url;
    urlInput.autocomplete = "off";
    urlInput.spellcheck = false;

    const goBtn = document.createElement("button");
    goBtn.className = "aqf-tv-btn";
    goBtn.type = "button";
    goBtn.textContent = "↵";
    goBtn.title = "Ladda adress";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "aqf-tv-btn";
    deleteBtn.type = "button";
    deleteBtn.textContent = "✕";
    deleteBtn.title = "Ta bort";

    titlebar.append(urlInput, goBtn, deleteBtn);

    // Transform toolbar: free move, X/Y/Z axis-constrained move (dragging
    // constrains motion to that single world axis, the same interaction
    // model as a 3D move gizmo), and pivot rotate.
    const toolbar = document.createElement("div");
    toolbar.className = "aqf-tv-toolbar";

    const freeBtn = document.createElement("div");
    freeBtn.className = "aqf-tv-axis aqf-tv-axis-free";
    freeBtn.textContent = "✥";
    freeBtn.title = "Dra för att flytta fritt";

    const xBtn = document.createElement("div");
    xBtn.className = "aqf-tv-axis aqf-tv-axis-x";
    xBtn.textContent = "X";
    xBtn.title = "Dra för att flytta längs X-axeln";

    const yBtn = document.createElement("div");
    yBtn.className = "aqf-tv-axis aqf-tv-axis-y";
    yBtn.textContent = "Y";
    yBtn.title = "Dra för att flytta längs Y-axeln (höjd)";

    const zBtn = document.createElement("div");
    zBtn.className = "aqf-tv-axis aqf-tv-axis-z";
    zBtn.textContent = "Z";
    zBtn.title = "Dra för att flytta längs Z-axeln (djup)";

    const rotateBtn = document.createElement("div");
    rotateBtn.className = "aqf-tv-axis aqf-tv-axis-rot";
    rotateBtn.textContent = "⟳";
    rotateBtn.title = "Dra för att rotera kring pivot";

    toolbar.append(freeBtn, xBtn, yBtn, zBtn, rotateBtn);

    const screen = document.createElement("div");
    screen.className = "aqf-tv-screen";

    const placeholder = document.createElement("div");
    placeholder.className = "aqf-tv-placeholder";
    placeholder.textContent = "ANGE EN WEBBADRESS ELLER YOUTUBE-LÄNK";

    const iframe = document.createElement("iframe");
    iframe.className = "aqf-tv-iframe";
    iframe.setAttribute(
      "allow",
      "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture",
    );
    iframe.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
    iframe.style.display = "none";

    screen.append(placeholder, iframe);

    const resize = document.createElement("div");
    resize.className = "aqf-tv-resize";

    const pivot = document.createElement("div");
    pivot.className = "aqf-tv-pivot";

    el.append(titlebar, toolbar, screen, resize, pivot);

    const object = new CSS3DObject(el);
    object.position.set(state.x, state.y, state.z);
    object.rotation.set(state.rotX, state.rotY, state.rotZ);
    object.scale.setScalar(state.scale);
    this.scene.add(object);

    const entry: TVEntry = { state, object, urlInput, iframe, placeholder };
    this.entries.set(state.id, entry);
    this.applyUrl(entry, state.url, false);

    const applyFromInput = () => this.applyUrl(entry, urlInput.value, true);
    goBtn.addEventListener("click", applyFromInput);
    urlInput.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        applyFromInput();
        urlInput.blur();
      }
    });
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.removeEntry(state.id);
    });

    this.bindFreeDrag(freeBtn, entry);
    this.bindAxisDrag(xBtn, entry, new THREE.Vector3(1, 0, 0));
    this.bindAxisDrag(yBtn, entry, new THREE.Vector3(0, 1, 0));
    this.bindAxisDrag(zBtn, entry, new THREE.Vector3(0, 0, 1));
    this.bindRotate(rotateBtn, entry);
    this.bindResize(resize, entry);
  }

  // Single-pointer drag: translates the panel within the camera-facing plane
  // through its current position — unconstrained, "grab and move anywhere".
  private bindFreeDrag(handle: HTMLElement, entry: TVEntry) {
    handle.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      try {
        handle.setPointerCapture(ev.pointerId);
      } catch {
        /* pointer not eligible for capture (e.g. synthetic events) — the
           listeners below are bound to this same element, so the drag still
           works as long as move/up events keep targeting it. */
      }

      const startX = ev.clientX;
      const startY = ev.clientY;
      const startPos = entry.object.position.clone();
      const dist = Math.max(0.001, startPos.distanceTo(this.camera.position));
      const fovRad = (this.camera.fov * Math.PI) / 180;
      const size = this.renderer.getSize();
      const unitsPerPixel = (2 * dist * Math.tan(fovRad / 2)) / Math.max(1, size.height);

      const right = new THREE.Vector3();
      const up = new THREE.Vector3();
      const back = new THREE.Vector3();
      this.camera.matrixWorld.extractBasis(right, up, back);

      const onMove = (mv: PointerEvent) => {
        const dx = mv.clientX - startX;
        const dy = mv.clientY - startY;
        const next = startPos
          .clone()
          .addScaledVector(right, dx * unitsPerPixel)
          .addScaledVector(up, -dy * unitsPerPixel);
        entry.object.position.copy(next);
        entry.state.x = next.x;
        entry.state.y = next.y;
        entry.state.z = next.z;
        this.schedulePersist();
      };
      const onUp = () => {
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onUp);
        this.persist();
      };
      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onUp);
    });
  }

  // Drag constrained to a single world axis — the same interaction a 3D
  // move-gizmo arrow gives you: the axis is projected into screen space, and
  // only the component of the pointer's motion along that projected
  // direction moves the object, so dragging exactly along the arrow's
  // on-screen direction gives 1:1 motion and dragging perpendicular to it
  // does nothing.
  private bindAxisDrag(handle: HTMLElement, entry: TVEntry, axis: THREE.Vector3) {
    handle.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      try {
        handle.setPointerCapture(ev.pointerId);
      } catch {
        /* pointer not eligible for capture (e.g. synthetic events) — the
           listeners below are bound to this same element, so the drag still
           works as long as move/up events keep targeting it. */
      }

      const startX = ev.clientX;
      const startY = ev.clientY;
      const startPos = entry.object.position.clone();
      const dist = Math.max(0.001, startPos.distanceTo(this.camera.position));
      const fovRad = (this.camera.fov * Math.PI) / 180;
      const size = this.renderer.getSize();
      const unitsPerPixel = (2 * dist * Math.tan(fovRad / 2)) / Math.max(1, size.height);

      const p0 = startPos.clone().project(this.camera);
      const p1 = startPos.clone().addScaledVector(axis, 0.5).project(this.camera);
      const screenDir = new THREE.Vector2(
        (p1.x - p0.x) * (size.width / 2),
        -(p1.y - p0.y) * (size.height / 2),
      );
      if (screenDir.lengthSq() < 1e-6) screenDir.set(1, 0);
      screenDir.normalize();

      const onMove = (mv: PointerEvent) => {
        const dx = mv.clientX - startX;
        const dy = mv.clientY - startY;
        const along = dx * screenDir.x + dy * screenDir.y;
        const next = startPos.clone().addScaledVector(axis, along * unitsPerPixel);
        entry.object.position.copy(next);
        entry.state.x = next.x;
        entry.state.y = next.y;
        entry.state.z = next.z;
        this.schedulePersist();
      };
      const onUp = () => {
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onUp);
        this.persist();
      };
      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onUp);
    });
  }

  // Drag on the rotate handle: horizontal motion yaws the panel, vertical
  // motion tilts it — a single touch point covers both rotation axes.
  private bindRotate(handle: HTMLElement, entry: TVEntry) {
    handle.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      try {
        handle.setPointerCapture(ev.pointerId);
      } catch {
        /* pointer not eligible for capture (e.g. synthetic events) — the
           listeners below are bound to this same element, so the drag still
           works as long as move/up events keep targeting it. */
      }

      const startX = ev.clientX;
      const startY = ev.clientY;
      const startRotY = entry.object.rotation.y;
      const startRotX = entry.object.rotation.x;

      const onMove = (mv: PointerEvent) => {
        const dx = mv.clientX - startX;
        const dy = mv.clientY - startY;
        const rotY = startRotY + dx * 0.012;
        const rotX = clamp(startRotX - dy * 0.012, -1.2, 1.2);
        entry.object.rotation.y = rotY;
        entry.object.rotation.x = rotX;
        entry.state.rotY = rotY;
        entry.state.rotX = rotX;
        this.schedulePersist();
      };
      const onUp = () => {
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onUp);
        this.persist();
      };
      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onUp);
    });
  }

  // Drag on the corner handle scales the panel uniformly (the DOM/iframe
  // itself stays at native resolution — only the CSS3DObject's scale changes).
  private bindResize(handle: HTMLElement, entry: TVEntry) {
    handle.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      try {
        handle.setPointerCapture(ev.pointerId);
      } catch {
        /* pointer not eligible for capture (e.g. synthetic events) — the
           listeners below are bound to this same element, so the drag still
           works as long as move/up events keep targeting it. */
      }

      const startX = ev.clientX;
      const startY = ev.clientY;
      const startScale = entry.object.scale.x;

      const onMove = (mv: PointerEvent) => {
        const delta = mv.clientX - startX + (mv.clientY - startY);
        const next = clamp(startScale * (1 + delta * 0.003), MIN_SCALE, MAX_SCALE);
        entry.object.scale.setScalar(next);
        entry.state.scale = next;
        this.schedulePersist();
      };
      const onUp = () => {
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onUp);
        this.persist();
      };
      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onUp);
    });
  }
}
