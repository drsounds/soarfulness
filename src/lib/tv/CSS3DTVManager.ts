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
// High enough that, dragged far along Z and scaled all the way up, a panel
// can become a gigantic screen looming in the sky (NATIVE_W * MAX_SCALE =
// 1440 world units wide — bigger than the 800-unit sky dome radius).
const MAX_SCALE = 3;
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
      /* Lets the two-finger move/scale/rotate gesture take over instead of
         the browser's native pinch-zoom/pan; doesn't affect scrolling inside
         the embedded iframe, which is governed by its own document. */
      touch-action: none;
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
  // Ordered most-specific-first; see setupPointerRedirect for why this exists.
  hitTargets: HTMLElement[];
  // Invisible WebGL stand-in for the panel — see occluders below.
  occluder: THREE.Mesh;
};

// A CSS3DRenderer layer is just a DOM overlay — it always paints in front of
// (or behind) the WebGL canvas as a whole, with no per-pixel awareness of the
// WebGL scene's depth. To let a TV panel sit "inside" the 3D world — hidden
// behind a wave crest, a loaded model, anything nearer the camera, and
// revealed again once nothing is in front of it — each panel gets an
// invisible stand-in mesh in the *main* WebGL scene, matching its transform
// every frame. The stand-in writes depth but never color (colorWrite:
// false), so it doesn't paint anything itself, but it does win or lose the
// depth test against every other WebGL object at that position. Where nearer
// WebGL geometry exists, it draws over the stand-in normally, opaquely
// hiding the CSS3D panel beneath (the CSS3D layer is composited behind the
// WebGL canvas, whose alpha=0 clear lets it show through only where nothing
// opaque was drawn). Where nothing is nearer, the stand-in "claims" that
// depth so nothing farther gets drawn there either, leaving that patch of
// the canvas transparent and revealing the panel.
// Shared by every panel — colorWrite:false means no instance ever needs its
// own material state (no color, no per-panel uniforms).
const occluderGeometry = new THREE.PlaneGeometry(NATIVE_W, NATIVE_H);
const occluderMaterial = new THREE.MeshBasicMaterial({
  colorWrite: false,
  depthWrite: true,
  depthTest: true,
  fog: false,
});

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
  // The main WebGL scene — only used to hold each panel's occluder mesh
  // (see occluderGeometry above), never rendered by this class itself.
  private mainScene: THREE.Scene;
  private container: HTMLElement;
  private entries = new Map<string, TVEntry>();
  private saveTimer: number | null = null;
  // Real pointer input (confirmed via CDP-level touch dispatch and real
  // mouse events, not just synthetic PointerEvents) resolves its target to
  // the WebGL canvas instead of the CSS3D panel actually rendered on top of
  // it — a browser hit-testing gap for content behind nested 3D CSS
  // transforms, for every pointer type. setupPointerRedirect works around it
  // by finding the intended element ourselves via getBoundingClientRect()
  // (always accurate — it's only the hit-test that isn't) and re-dispatching
  // the event there. Keyed by pointerId so a drag or multi-touch gesture
  // keeps hitting the same element for its duration.
  private pointerTargets = new Map<number, { el: HTMLElement; downX: number; downY: number }>();
  private disposePointerRedirect: (() => void) | null = null;

  constructor(
    container: HTMLElement,
    camera: THREE.PerspectiveCamera,
    mainScene: THREE.Scene,
    width: number,
    height: number,
  ) {
    ensureStyles();
    this.container = container;
    this.camera = camera;
    this.mainScene = mainScene;

    this.renderer = new CSS3DRenderer();
    this.renderer.domElement.style.position = "absolute";
    this.renderer.domElement.style.top = "0";
    this.renderer.domElement.style.left = "0";
    this.renderer.domElement.style.pointerEvents = "none";
    this.renderer.setSize(width, height);
    // Inserted *behind* the WebGL canvas (which must already be in
    // `container` at this point) so the occluder-mesh technique above can
    // work: the canvas paints over this layer wherever it draws anything
    // opaque, and lets it show through wherever it doesn't.
    container.insertBefore(this.renderer.domElement, container.firstChild);
    this.setupPointerRedirect();

    for (const state of loadTVs()) this.createEntry(state);
  }

  setSize(width: number, height: number) {
    this.renderer.setSize(width, height);
  }

  // A CSS3DObject's on-screen pixel size depends only on the renderer's
  // *height* and the camera's vertical FOV — never its width, since that's
  // how perspective projection works. That means a fixed world-space size
  // that looks reasonable on a wide desktop screen renders at the *same*
  // pixel size on a narrow portrait phone, easily overflowing the screen's
  // width entirely (pushing the title bar, toolbar, and buttons off both
  // edges — unreachable, not just small). This computes the scale that
  // makes the panel's width equal to `fraction` of the *smaller* viewport
  // dimension, so it always fits regardless of aspect ratio.
  private fitScaleForViewport(distance: number, fraction: number): number {
    const fovRad = (this.camera.fov * Math.PI) / 180;
    const size = this.renderer.getSize();
    const unitsPerPixel = (2 * distance * Math.tan(fovRad / 2)) / Math.max(1, size.height);
    const targetPx = Math.min(size.width, size.height) * fraction;
    return clamp((targetPx * unitsPerPixel) / NATIVE_W, MIN_SCALE, MAX_SCALE);
  }


  // Must run before the main WebGLRenderer's own render(scene, camera) call
  // so the occluders' synced transforms are in place when it draws.
  render() {
    for (const entry of this.entries.values()) {
      entry.occluder.position.copy(entry.object.position);
      entry.occluder.quaternion.copy(entry.object.quaternion);
      entry.occluder.scale.copy(entry.object.scale);
    }
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
      // No floor on y: pos already lies exactly along the camera's view
      // direction (including pitch), matching x/z — clamping only this axis
      // would shift the panel away from view center whenever the camera
      // looks down enough that the natural y comes out below the floor,
      // which is routine in this app (the default view leans toward the
      // water) and was pushing new panels above the visible frame.
      y: pos.y,
      z: pos.z,
      rotX: 0,
      rotY,
      rotZ: 0,
      scale: this.fitScaleForViewport(SPAWN_DISTANCE, 0.6),
    };
    this.createEntry(state);
    this.persist();
  }

  dispose() {
    if (this.saveTimer != null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.disposePointerRedirect?.();
    this.disposePointerRedirect = null;
    for (const id of Array.from(this.entries.keys())) this.removeEntry(id, false);
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  // Finds the most specific interactive element under a real screen point by
  // checking actual layout rects (always accurate) instead of relying on the
  // browser's touch hit-test (which isn't, for this content — see
  // pointerTargets above). Checks every panel's hitTargets in their declared
  // most-specific-first order.
  private findPointerTarget(x: number, y: number): HTMLElement | null {
    for (const entry of this.entries.values()) {
      for (const el of entry.hitTargets) {
        const rect = el.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          return el;
        }
      }
    }
    return null;
  }

  private setupPointerRedirect() {
    // The re-dispatched event bubbles (needed so ancestor listeners, like the
    // two-finger gesture on the panel root, still see it) all the way back up
    // to these same capture-phase window listeners — without this guard
    // they'd reprocess their own dispatch and recurse forever.
    const dispatchedByUs = new WeakSet<Event>();
    const TAP_SLOP_PX = 8;

    const dispatchPointer = (target: HTMLElement, ev: PointerEvent, type: string) => {
      const synthetic = new PointerEvent(type, {
        pointerId: ev.pointerId,
        pointerType: ev.pointerType,
        clientX: ev.clientX,
        clientY: ev.clientY,
        screenX: ev.screenX,
        screenY: ev.screenY,
        button: ev.button,
        buttons: ev.buttons,
        bubbles: true,
        cancelable: true,
      });
      dispatchedByUs.add(synthetic);
      target.dispatchEvent(synthetic);
    };

    const onDown = (ev: PointerEvent) => {
      if (dispatchedByUs.has(ev)) return;
      const target = this.findPointerTarget(ev.clientX, ev.clientY);
      if (!target) return;
      this.pointerTargets.set(ev.pointerId, { el: target, downX: ev.clientX, downY: ev.clientY });
      dispatchPointer(target, ev, "pointerdown");
    };
    const onMove = (ev: PointerEvent) => {
      if (dispatchedByUs.has(ev)) return;
      const tracked = this.pointerTargets.get(ev.pointerId);
      if (!tracked) return;
      dispatchPointer(tracked.el, ev, "pointermove");
    };
    const onUp = (ev: PointerEvent) => {
      if (dispatchedByUs.has(ev)) return;
      const tracked = this.pointerTargets.get(ev.pointerId);
      if (!tracked) return;
      dispatchPointer(tracked.el, ev, ev.type);
      // A real trusted tap gets an automatic touch-to-click synthesis from
      // the browser; a JS-dispatched pointerup does not, so buttons wired up
      // with onClick (delete, go) need it synthesized explicitly here —
      // only for a tap-like gesture (little movement), not after a drag.
      if (ev.type === "pointerup") {
        const dx = ev.clientX - tracked.downX;
        const dy = ev.clientY - tracked.downY;
        if (Math.hypot(dx, dy) <= TAP_SLOP_PX) {
          const clickEvent = new MouseEvent("click", {
            clientX: ev.clientX,
            clientY: ev.clientY,
            button: 0,
            bubbles: true,
            cancelable: true,
          });
          dispatchedByUs.add(clickEvent);
          tracked.el.dispatchEvent(clickEvent);

          // The browser's own touch gesture handling resets focus around
          // pointerup/click for a real touch, which stomps a focus() called
          // synchronously here — deferring one tick lets it happen after
          // that reset instead of before it.
          if (tracked.el instanceof HTMLInputElement) {
            const input = tracked.el;
            setTimeout(() => input.focus(), 0);
          }
        }
      }
      this.pointerTargets.delete(ev.pointerId);
    };

    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);

    this.disposePointerRedirect = () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
    };
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
    this.mainScene.remove(entry.occluder);
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

    // See occluderGeometry/occluderMaterial above — kept in sync with
    // `object`'s transform every frame in render().
    const occluder = new THREE.Mesh(occluderGeometry, occluderMaterial);
    occluder.position.copy(object.position);
    occluder.quaternion.copy(object.quaternion);
    occluder.scale.copy(object.scale);
    // colorWrite:false only *withholds* new color — it can't erase color
    // something else already painted there. So the occluder must claim its
    // depth before the sky/ocean/floor/other objects (default renderOrder 0)
    // ever get a chance to draw, or their color stays regardless of the
    // depth test outcome. Negative renderOrder draws first.
    occluder.renderOrder = -1000;
    this.mainScene.add(occluder);

    // Most-specific-first: findPointerTarget returns the first rect match, so
    // small controls must be checked before the panel's own background.
    const hitTargets = [
      urlInput,
      goBtn,
      deleteBtn,
      freeBtn,
      xBtn,
      yBtn,
      zBtn,
      rotateBtn,
      resize,
      iframe,
      placeholder,
      el,
    ];

    const entry: TVEntry = { state, object, urlInput, iframe, placeholder, hitTargets, occluder };
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
    this.bindTwoFingerTransform(el, entry);
  }

  // Computes the camera-facing basis (screen right/up in world units per
  // pixel, at the object's current distance) used to translate a panel by a
  // 2D screen delta. Shared by the free-move drag and the two-finger gesture.
  private cameraPlaneBasis(objectPos: THREE.Vector3) {
    const dist = Math.max(0.001, objectPos.distanceTo(this.camera.position));
    const fovRad = (this.camera.fov * Math.PI) / 180;
    const size = this.renderer.getSize();
    const unitsPerPixel = (2 * dist * Math.tan(fovRad / 2)) / Math.max(1, size.height);
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    const back = new THREE.Vector3();
    this.camera.matrixWorld.extractBasis(right, up, back);
    return { unitsPerPixel, right, up };
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
      const { unitsPerPixel, right, up } = this.cameraPlaneBasis(startPos);

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

  // Two-finger touch gesture on the panel itself (anywhere — the title bar,
  // the screen/iframe area, the padding), combining move + scale + rotate
  // into one natural motion: pan the midpoint to move, pinch to resize,
  // twist to rotate. This is the primary touch interaction — the small
  // single-pointer handles above are precise but fiddly to hit on a real
  // touchscreen, and a mouse can't produce a second pointer anyway, so both
  // schemes coexist rather than one replacing the other. A single finger is
  // left untouched so it still reaches the embedded page normally (tapping
  // play, scrolling, clicking links).
  private bindTwoFingerTransform(el: HTMLElement, entry: TVEntry) {
    const pointers = new Map<number, { x: number; y: number }>();
    let gesture: {
      startMid: { x: number; y: number };
      startDist: number;
      startAngle: number;
      startPos: THREE.Vector3;
      startScale: number;
      startRotY: number;
      unitsPerPixel: number;
      right: THREE.Vector3;
      up: THREE.Vector3;
    } | null = null;

    const metrics = () => {
      const [a, b] = Array.from(pointers.values());
      return {
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        dist: Math.hypot(b.x - a.x, b.y - a.y),
        angle: Math.atan2(b.y - a.y, b.x - a.x),
      };
    };

    const startGesture = () => {
      const { mid, dist, angle } = metrics();
      const startPos = entry.object.position.clone();
      const { unitsPerPixel, right, up } = this.cameraPlaneBasis(startPos);
      gesture = {
        startMid: mid,
        startDist: dist,
        startAngle: angle,
        startPos,
        startScale: entry.object.scale.x,
        startRotY: entry.object.rotation.y,
        unitsPerPixel,
        right,
        up,
      };
    };

    const endGesture = () => {
      if (gesture) this.persist();
      gesture = null;
    };

    el.addEventListener("pointerdown", (ev) => {
      if (ev.pointerType !== "touch" && ev.pointerType !== "pen") return;
      pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pointers.size === 2) {
        ev.preventDefault();
        startGesture();
      } else if (pointers.size > 2) {
        // A third touch (e.g. resting a palm) shouldn't restart the gesture
        // mid-drag with a new, arbitrary pair — just ignore it.
        pointers.delete(ev.pointerId);
      }
    });

    el.addEventListener("pointermove", (ev) => {
      if (!pointers.has(ev.pointerId)) return;
      pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pointers.size !== 2 || !gesture) return;
      ev.preventDefault();

      const { mid, dist, angle } = metrics();
      const dx = mid.x - gesture.startMid.x;
      const dy = mid.y - gesture.startMid.y;
      const nextPos = gesture.startPos
        .clone()
        .addScaledVector(gesture.right, dx * gesture.unitsPerPixel)
        .addScaledVector(gesture.up, -dy * gesture.unitsPerPixel);
      entry.object.position.copy(nextPos);
      entry.state.x = nextPos.x;
      entry.state.y = nextPos.y;
      entry.state.z = nextPos.z;

      const scaleRatio = gesture.startDist > 1 ? dist / gesture.startDist : 1;
      const nextScale = clamp(gesture.startScale * scaleRatio, MIN_SCALE, MAX_SCALE);
      entry.object.scale.setScalar(nextScale);
      entry.state.scale = nextScale;

      const nextRotY = gesture.startRotY + (angle - gesture.startAngle);
      entry.object.rotation.y = nextRotY;
      entry.state.rotY = nextRotY;

      this.schedulePersist();
    });

    const onPointerEnd = (ev: PointerEvent) => {
      if (!pointers.has(ev.pointerId)) return;
      pointers.delete(ev.pointerId);
      if (pointers.size < 2) endGesture();
    };
    el.addEventListener("pointerup", onPointerEnd);
    el.addEventListener("pointercancel", onPointerEnd);
  }
}
