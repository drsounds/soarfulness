import * as THREE from "three";
import { CSS3DObject, CSS3DRenderer } from "three/examples/jsm/renderers/CSS3DRenderer.js";
import { toEmbedUrl } from "./youtubeEmbed";

// The two virtual "smart device" shapes a panel can take — a landscape smart
// TV or a portrait mobile — each with its own native pixel footprint and
// bathOS shell layout (TV: left nav rail; mobile: bottom nav bar).
export type DeviceKind = "tv" | "mobile";

// One bathOS "app": a bookmark to a web page (or, for the built-in "browser"
// icon, no fixed destination — it just resumes whatever address was last
// typed). Apps are the home screen's icon grid; tapping one loads its url
// into the browser screen.
export type BathApp = {
  id: string;
  name: string;
  url: string;
  icon: "browser" | "youtube" | "link";
};

function defaultApps(): BathApp[] {
  return [
    { id: "browser", name: "Browser", url: "", icon: "browser" },
    { id: "youtube", name: "YouTube", url: "https://www.youtube.com", icon: "youtube" },
  ];
}

// Persisted shape of a single "TV apparatus" — now a full bathOS "smart
// device". Position/rotation/scale are plain three.js world-space numbers;
// the DOM panel itself always renders at a fixed native pixel size (per
// `device`, see SIZES) so the embedded page stays crisp — resizing the panel
// only changes `scale`, never the iframe's own resolution.
export type TVState = {
  id: string;
  // The address currently loaded (or last loaded) in the browser app.
  url: string;
  x: number;
  y: number;
  z: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  scale: number;
  device: DeviceKind;
  // Room/device label shown on the lock screen (e.g. "Bathroom Mirror").
  name: string;
  locked: boolean;
  // Which app-level screen to show once unlocked — the lock overlay sits on
  // top of whichever of these was last active, same as a real phone.
  screen: "home" | "browser";
  apps: BathApp[];
};

const STORAGE_KEY = "aquafulness:tvs:v1";
const SIZES: Record<DeviceKind, { w: number; h: number }> = {
  tv: { w: 480, h: 270 },
  mobile: { w: 300, h: 620 },
};
const DEFAULT_SCALE = 0.02;
const MIN_SCALE = 0.006;
// High enough that, dragged far along Z and scaled all the way up, a panel
// can become a gigantic screen looming in the sky (width * MAX_SCALE can
// reach 1440 world units — bigger than the 800-unit sky dome radius).
const MAX_SCALE = 3;
const SPAWN_DISTANCE = 9;

function isLikelyUrl(text: string): boolean {
  const t = text.trim();
  if (!t || /\s/.test(t)) return false;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) return true;
  return /^[^./]+(\.[^./]+)+$/.test(t) || t.startsWith("localhost");
}

// Whatever was typed into a search/address field: a bare domain or full URL
// loads directly, anything else runs as a web search — the same rule a real
// phone's combined search+address bar uses.
function resolveAddress(text: string): string {
  const t = text.trim();
  if (!t) return "";
  if (isLikelyUrl(t)) {
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(t)}`;
}

// Deterministic pastel-ish background for a bookmark tile's fallback
// initial-letter icon, so the same name always gets the same color.
function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(hash) % 360}, 60%, 40%)`;
}

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
      .map((t) => {
        const url = typeof t.url === "string" ? t.url : "";
        const apps = Array.isArray(t.apps)
          ? (t.apps as unknown[])
              .filter((a): a is Record<string, unknown> => !!a && typeof a === "object")
              .map((a): BathApp => ({
                id: typeof a.id === "string" ? a.id : makeId(),
                name: typeof a.name === "string" ? a.name : "App",
                url: typeof a.url === "string" ? a.url : "",
                icon: a.icon === "youtube" || a.icon === "browser" ? a.icon : "link",
              }))
          : defaultApps();
        return {
          id: typeof t.id === "string" ? t.id : makeId(),
          url,
          x: num(t.x, 0),
          y: num(t.y, 2),
          z: num(t.z, 0),
          rotX: num(t.rotX, 0),
          rotY: num(t.rotY, 0),
          rotZ: num(t.rotZ, 0),
          scale: clamp(num(t.scale, DEFAULT_SCALE), MIN_SCALE, MAX_SCALE),
          device: t.device === "mobile" ? "mobile" : "tv",
          name: typeof t.name === "string" ? t.name : "",
          locked: typeof t.locked === "boolean" ? t.locked : false,
          screen: t.screen === "browser" || (t.screen === undefined && url) ? "browser" : "home",
          apps: apps.length ? apps : defaultApps(),
        } satisfies TVState;
      });
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
      display: flex; flex-direction: column;
      background: #0b1620; border-radius: 10px; overflow: hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08);
      font-family: system-ui, -apple-system, sans-serif;
      /* Deliberately no touch-action override here — touch-action
         restrictions cascade to descendants with no way for a child to opt
         back out, so leaving the panel root unrestricted is what lets the
         bathOS view stack (.bos-view, including the browser's .aqf-tv-iframe)
         fall through to its own default (auto), which is required for real
         single-finger touch to reach the embedded page or scroll the app
         grid at all. Every dev-only chrome control that needs its own drag
         gesture (the toolbar's axis/resize handles, bathOS's own tap
         targets) already declares touch-action: none individually below. */
    }
    .aqf-tv-btn {
      flex: 0 0 auto; width: 26px; height: 26px; border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.9); font-size: 13px; line-height: 1; cursor: pointer;
      display: flex; align-items: center; justify-content: center; touch-action: none;
    }
    .aqf-tv-btn:active { background: rgba(255,255,255,0.25); }
    .aqf-tv-iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
    .aqf-tv-placeholder {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      color: rgba(255,255,255,0.35); font-size: 11px; letter-spacing: 0.08em; text-align: center; padding: 0 16px;
    }

    /* --- bathOS shell -------------------------------------------------- */
    .bos-root {
      position: relative; flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column;
      background: #000; color: #fff; overflow: hidden;
    }
    .bos-statusbar {
      flex: 0 0 auto; z-index: 6; display: flex; align-items: center; justify-content: flex-end;
      gap: 5px; padding: 5px 8px; font-size: 10px; font-weight: 600;
      color: rgba(255,255,255,0.92);
    }
    .bos-clock { font-variant-numeric: tabular-nums; }
    .bos-body { position: relative; flex: 1 1 auto; min-height: 0; display: flex; flex-direction: row; }
    .bos-viewstack { position: relative; flex: 1 1 auto; min-width: 0; min-height: 0; }
    .bos-view {
      position: absolute; inset: 0; display: none; flex-direction: column;
    }
    .bos-view-active { display: flex; }

    .bos-lock {
      align-items: center; justify-content: center; text-align: center; gap: 4px;
      background: linear-gradient(180deg, #2c7be5 0%, #0a1e40 75%, #030b1a 100%);
      cursor: pointer; padding: 10px;
    }
    .bos-lock-name { font-size: 11px; opacity: 0.85; }
    .bos-lock-time { font-size: 34px; font-weight: 700; line-height: 1; }
    .bos-lock-date { font-size: 11px; opacity: 0.8; }
    .bos-lock-hint {
      position: absolute; bottom: 10px; left: 0; right: 0; text-align: center;
      font-size: 10px; letter-spacing: 0.06em; opacity: 0.7;
    }

    .bos-home { background: linear-gradient(180deg, #3579db 0%, #081b38 100%); }
    .bos-home-main { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; padding: 8px; gap: 8px; }
    .bos-search {
      flex: 0 0 auto; display: flex; align-items: center; gap: 6px;
      background: rgba(255,255,255,0.55); border-radius: 999px; padding: 6px 10px; color: #262626;
    }
    .bos-search svg { flex: 0 0 auto; opacity: 0.65; }
    .bos-search-input {
      flex: 1 1 auto; min-width: 0; background: transparent; border: 0; outline: none;
      color: #1a1a1a; font-size: 11px;
    }
    .bos-search-input::placeholder { color: rgba(30,30,30,0.55); }
    .bos-apps { flex: 1 1 auto; min-height: 0; display: flex; flex-wrap: wrap; align-content: flex-start; gap: 10px; overflow: auto; }
    .bos-app { width: 54px; display: flex; flex-direction: column; align-items: center; gap: 3px; cursor: pointer; touch-action: none; }
    .bos-app-icon {
      width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 14px; font-weight: 700; overflow: hidden;
    }
    .bos-app-icon svg { width: 20px; height: 20px; }
    .bos-app-name { font-size: 9px; opacity: 0.92; max-width: 54px; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bos-app-add .bos-app-icon { background: rgba(255,255,255,0.12); border: 1px dashed rgba(255,255,255,0.5); }
    .bos-addform {
      flex: 0 0 auto; display: none; flex-direction: column; gap: 5px; padding: 8px;
      background: rgba(0,0,0,0.35); border-radius: 8px;
    }
    .bos-addform.bos-open { display: flex; }
    .bos-addform input {
      background: rgba(255,255,255,0.9); border: 0; border-radius: 6px; padding: 5px 8px; font-size: 10px; color: #111; outline: none;
    }
    .bos-addform-row { display: flex; gap: 6px; justify-content: flex-end; }

    .bos-rail {
      flex: 0 0 auto; width: 72px; background: rgba(0,0,0,0.55);
      display: flex; flex-direction: column; align-items: flex-start; padding: 10px 8px; gap: 10px;
    }
    .bos-rail-logo { font-size: 12px; font-weight: 800; }
    .bos-rail-item { font-size: 10px; opacity: 0.85; cursor: pointer; touch-action: none; }
    .bos-rail-item:active { opacity: 1; }
    .bos-rail-spacer { flex: 1 1 auto; }
    .bos-rail-power { cursor: pointer; touch-action: none; opacity: 0.85; }

    .bos-navbar {
      flex: 0 0 auto; display: flex; align-items: center; justify-content: space-around;
      padding: 8px 0; background: rgba(0,0,0,0.4);
    }
    .bos-navbtn { width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.85); cursor: pointer; touch-action: none; }

    .bos-browser { background: #111; }
    .bos-addressbar { position: relative; flex: 0 0 auto; display: flex; align-items: center; gap: 5px; padding: 5px 6px; background: rgba(255,255,255,0.92); }
    .bos-addr-btn { flex: 0 0 auto; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; color: #333; cursor: pointer; touch-action: none; background: none; }
    .bos-addr-inputwrap { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 4px; background: rgba(0,0,0,0.08); border-radius: 999px; padding: 4px 9px; }
    .bos-addr-input { flex: 1 1 auto; min-width: 0; border: 0; outline: none; background: transparent; font-size: 10px; color: #222; }
    .bos-menu {
      display: none; flex-direction: column; position: absolute; top: 100%; margin-top: 4px; right: 6px; z-index: 8;
      background: #1c1c1c; border-radius: 8px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    }
    .bos-menu.bos-open { display: flex; }
    .bos-menu-item { padding: 8px 12px; font-size: 10px; color: #eee; cursor: pointer; white-space: nowrap; touch-action: none; }
    .bos-menu-item:active { background: rgba(255,255,255,0.12); }

    .bos-settings {
      display: none; position: absolute; inset: 0; z-index: 7; flex-direction: column; gap: 10px;
      padding: 12px; background: rgba(10,14,22,0.97);
    }
    .bos-settings.bos-open { display: flex; }
    .bos-settings label { font-size: 10px; opacity: 0.7; }
    .bos-settings input {
      background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px;
      padding: 6px 8px; font-size: 11px; color: #fff; outline: none;
    }
    .bos-settings-row { display: flex; gap: 8px; }
    .bos-settings-btn {
      flex: 1 1 auto; padding: 7px; font-size: 10px; border-radius: 6px; text-align: center; cursor: pointer;
      background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2); touch-action: none;
    }
    .bos-settings-btn.bos-danger { background: rgba(220,60,60,0.25); border-color: rgba(220,60,60,0.5); }

    /* The dev-only placement chrome (gizmo toolbar, resize corner, pivot dot)
       is hidden by default so a panel is nothing but its bathOS device —
       edge to edge, no tool UI — and only appears while the app's global
       edit mode is active for precise placement. */
    .aqf-tv-resize, .aqf-tv-pivot, .aqf-tv-toolbar { display: none; }
    .aqf-tv-panel.aqf-edit-mode .aqf-tv-resize { display: block; }
    .aqf-tv-panel.aqf-edit-mode .aqf-tv-pivot { display: block; }
    .aqf-tv-panel.aqf-edit-mode .aqf-tv-toolbar { display: flex; }
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
    /* Transform toolbar: device label, axis-constrained move (X/Y/Z,
       Blender-style colors), free (unconstrained) move, and pivot rotate —
       dragging each handle manipulates the panel around its own pivot (its
       position), the same model 3D DCC tools use for their move/rotate gizmos. */
    .aqf-tv-toolbar {
      align-items: center; gap: 5px; padding: 5px 8px;
      background: rgba(0,0,0,0.55); border-bottom: 1px solid rgba(255,255,255,0.08);
      flex: 0 0 auto;
      touch-action: none;
    }
    .aqf-tv-devicelabel {
      flex: 1 1 auto; color: rgba(255,255,255,0.6); font-size: 9px;
      letter-spacing: 0.1em; text-transform: uppercase;
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

// Small inline stroke-icon set for the bathOS shell — kept as plain SVG
// markup (rather than a component library) since every panel is built via
// raw DOM calls, not React.
const ICONS = {
  search:
    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  globe:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18"/></svg>',
  gear: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 13a7.4 7.4 0 000-2l2-1.5-2-3.5-2.4 1a7.6 7.6 0 00-1.7-1L15 3h-4l-.3 2.5a7.6 7.6 0 00-1.7 1l-2.4-1-2 3.5L6.6 11a7.4 7.4 0 000 2l-2 1.5 2 3.5 2.4-1a7.6 7.6 0 001.7 1L11 21h4l.3-2.5a7.6 7.6 0 001.7-1l2.4 1 2-3.5-2-1.5z"/></svg>',
  power:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 3v9"/><path d="M6.5 6.5a8 8 0 1011 0"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  dots: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>',
  heart:
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.4-9.5-9C.7 7.5 2.7 4 6 4c2 0 3.3 1 4 2 .7-1 2-2 4-2 3.3 0 5.3 3.5 3.5 7-2.5 4.6-9.5 9-9.5 9z"/></svg>',
  signal:
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="2" y="14" width="3" height="7" rx="0.5"/><rect x="8" y="10" width="3" height="11" rx="0.5"/><rect x="14" y="6" width="3" height="15" rx="0.5"/><rect x="20" y="2" width="3" height="19" rx="0.5"/></svg>',
  home: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/></svg>',
  menu: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  play: '<svg viewBox="0 0 24 24" width="14" height="14" fill="#fff"><path d="M8 5v14l11-7z"/></svg>',
};

type TVEntry = {
  state: TVState;
  object: CSS3DObject;
  iframe: HTMLIFrameElement;
  placeholder: HTMLDivElement;
  addressInput: HTMLInputElement;
  searchInput: HTMLInputElement;
  heartBtn: HTMLElement;
  homeAppsEl: HTMLElement;
  lockView: HTMLElement;
  homeView: HTMLElement;
  browserView: HTMLElement;
  settingsOverlay: HTMLElement;
  settingsNameInput: HTMLInputElement;
  browserMenu: HTMLElement;
  clockEls: HTMLElement[];
  dateEls: HTMLElement[];
  lockNameEl: HTMLElement;
  settingsOpen: boolean;
  addFormOpen: boolean;
  addFormEl: HTMLElement;
  addFormNameInput: HTMLInputElement;
  addFormUrlInput: HTMLInputElement;
  // Live-queried each pointer event (`[data-bos-hit]` leaves plus the fixed
  // chrome controls) — see setupPointerRedirect for why every interactive
  // element must be discoverable this way. A snapshot array would go stale
  // the moment an app/bookmark tile is added.
  hitTargets: () => HTMLElement[];
  // Invisible WebGL stand-in for the panel — see occluders below.
  occluder: THREE.Mesh;
  // In-scene 3D transform gizmo — see "3D transform gizmo" below.
  gizmoGroup: THREE.Group;
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
// Shared across every panel of a given device kind — colorWrite:false means
// no instance ever needs its own material state (no color, no per-panel
// uniforms), and the geometry only depends on that device's fixed footprint.
const occluderGeometries: Record<DeviceKind, THREE.PlaneGeometry> = {
  tv: new THREE.PlaneGeometry(SIZES.tv.w, SIZES.tv.h),
  mobile: new THREE.PlaneGeometry(SIZES.mobile.w, SIZES.mobile.h),
};
const occluderMaterial = new THREE.MeshBasicMaterial({
  colorWrite: false,
  depthWrite: true,
  depthTest: true,
  fog: false,
});

// --- 3D transform gizmo --------------------------------------------------
// A real in-scene gizmo attached to each panel's pivot while in edit mode —
// three colored arrows for axis-constrained move, a center sphere for free
// move, three rings for axis-constrained rotate, and a cube for uniform
// scale — the same visual language as Blender/Unity/Maya's move/rotate/
// scale handles, raycasted like any other 3D object rather than flat DOM
// icons. Built once at a nominal "1 local unit" size (arrow tip radius ~0.8)
// and shared across every panel; each panel gets its own THREE.Group whose
// position and *uniform* scale are recomputed every frame (see render())
// so the gizmo reads as a constant on-screen size regardless of camera
// distance or how large/small the panel itself is scaled.
// Depth-test is deliberately off and renderOrder deliberately high so the
// gizmo always draws on top, even over an occluded (hidden-behind-geometry)
// panel — while editing, you still need to see and grab the handle.
const GIZMO_AXIS_COLOR = { x: 0xe5484d, y: 0x30a46c, z: 0x3b82f6 } as const;
const GIZMO_NEUTRAL_COLOR = 0xf4f4f5;
const GIZMO_PIXEL_SIZE = 130;
const GIZMO_RENDER_ORDER = 10000;
const GIZMO_AXIS_UNIT_VEC = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
} as const;
// An axis arrow pointing (nearly) straight at/away from the camera
// foreshortens to an invisible dot on screen — and, unlike the X/Y arrows,
// sits *on* the ray from the camera to the free-move sphere behind it
// (the gap in gizmoShaftGeometry only clears a *perpendicular* overlap, not
// one collinear with the view ray). Past this dot-product threshold, hide
// that arrow's meshes each frame so it can't silently steal drags meant for
// the sphere while contributing nothing visible anyway.
const GIZMO_FORESHORTEN_HIDE_DOT = 0.95;

// Shafts start with a gap from the origin (0.15, not 0) rather than
// meeting it exactly — without that gap, a panel that faces the camera
// (the common case; new panels always spawn facing the viewer) puts the Z
// arrow's shaft running straight along the view ray, right through the
// free-move sphere at the center, so a raycast at dead-center can hit the
// shaft instead of the sphere. Real DCC-tool gizmos leave the same gap for
// the same reason.
const gizmoShaftGeometry = new THREE.CylinderGeometry(0.016, 0.016, 0.45, 10);
gizmoShaftGeometry.translate(0, 0.375, 0);
const gizmoHeadGeometry = new THREE.ConeGeometry(0.055, 0.2, 14);
gizmoHeadGeometry.translate(0, 0.7, 0);
const gizmoRingGeometry = new THREE.TorusGeometry(0.55, 0.022, 8, 48);
const gizmoScaleGeometry = new THREE.BoxGeometry(0.11, 0.11, 0.11);
const gizmoFreeGeometry = new THREE.SphereGeometry(0.085, 14, 10);

function makeGizmoMaterial(color: number, opacity = 1): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    depthTest: false,
    depthWrite: false,
    transparent: opacity < 1,
    opacity,
    fog: false,
  });
}

const gizmoMaterials = {
  x: makeGizmoMaterial(GIZMO_AXIS_COLOR.x),
  y: makeGizmoMaterial(GIZMO_AXIS_COLOR.y),
  z: makeGizmoMaterial(GIZMO_AXIS_COLOR.z),
  neutral: makeGizmoMaterial(GIZMO_NEUTRAL_COLOR, 0.85),
};

type GizmoHitKind = "axis" | "ring" | "scale" | "free";
type GizmoHitInfo = { entryId: string; kind: GizmoHitKind; axis?: "x" | "y" | "z" };

// Builds one panel's gizmo group and registers its interactive meshes into
// `hitMap` (keyed by mesh, so a raycast hit resolves straight back to which
// handle was grabbed). Geometries/materials above are shared across every
// panel; only each mesh's position/rotation within the group differs.
function buildGizmo(entryId: string, hitMap: Map<THREE.Object3D, GizmoHitInfo>): THREE.Group {
  const group = new THREE.Group();

  const addMesh = (
    geometry: THREE.BufferGeometry,
    material: THREE.MeshBasicMaterial,
    info: GizmoHitInfo,
  ) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = GIZMO_RENDER_ORDER;
    hitMap.set(mesh, info);
    group.add(mesh);
    return mesh;
  };

  // Axis arrows: geometry points along +Y by default; rotate into +X/+Z.
  const axisRotations: Record<"x" | "y" | "z", THREE.Euler> = {
    x: new THREE.Euler(0, 0, -Math.PI / 2),
    y: new THREE.Euler(0, 0, 0),
    z: new THREE.Euler(Math.PI / 2, 0, 0),
  };
  (["x", "y", "z"] as const).forEach((axis) => {
    const shaft = addMesh(gizmoShaftGeometry, gizmoMaterials[axis], {
      entryId,
      kind: "axis",
      axis,
    });
    const head = addMesh(gizmoHeadGeometry, gizmoMaterials[axis], { entryId, kind: "axis", axis });
    shaft.rotation.copy(axisRotations[axis]);
    head.rotation.copy(axisRotations[axis]);
  });

  // Rotation rings: geometry lies flat in the XY plane (hole along +Z) by
  // default; rotate so the ring's hole points along the axis it rotates.
  const ringRotations: Record<"x" | "y" | "z", THREE.Euler> = {
    x: new THREE.Euler(0, Math.PI / 2, 0),
    y: new THREE.Euler(Math.PI / 2, 0, 0),
    z: new THREE.Euler(0, 0, 0),
  };
  (["x", "y", "z"] as const).forEach((axis) => {
    const ring = addMesh(gizmoRingGeometry, gizmoMaterials[axis], { entryId, kind: "ring", axis });
    ring.rotation.copy(ringRotations[axis]);
  });

  // Uniform scale handle, offset along the diagonal so it doesn't overlap
  // the free-move sphere at the origin.
  const scaleHandle = addMesh(gizmoScaleGeometry, gizmoMaterials.neutral, {
    entryId,
    kind: "scale",
  });
  scaleHandle.position.set(0.24, 0.24, 0.24);

  // Free (unconstrained) move handle at the pivot itself.
  addMesh(gizmoFreeGeometry, gizmoMaterials.neutral, { entryId, kind: "free" });

  return group;
}

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
  // (see occluderGeometries above) and gizmo group (see buildGizmo), never
  // rendered by this class itself.
  private mainScene: THREE.Scene;
  // The element the CSS3D root is actually attached to (the mount container's
  // *parent* — see the constructor for why), kept for cleanup in dispose().
  private mountHost: HTMLElement;
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
  private clockTimer: number | null = null;
  // Whether the app's global edit mode is active — see setEditMode.
  private editMode = false;

  // 3D transform gizmo — only shown/interactive in edit mode (manipulating
  // the frozen wave/camera precisely is the whole point of edit mode; see
  // setEditMode, which toggles both this and the dev-only DOM chrome via the
  // shared `editMode` flag above). gizmoHitMap resolves a raycast hit
  // straight back to which panel and which handle was grabbed.
  private gizmoHitMap = new Map<THREE.Object3D, GizmoHitInfo>();
  private raycaster = new THREE.Raycaster();
  private gizmoDrag: {
    pointerId: number;
    entry: TVEntry;
    kind: GizmoHitKind;
    axis?: "x" | "y" | "z";
    startX: number;
    startY: number;
    startPos: THREE.Vector3;
    startScale: number;
    startRotX: number;
    startRotY: number;
    startRotZ: number;
    unitsPerPixel: number;
    right: THREE.Vector3;
    up: THREE.Vector3;
    screenDir: THREE.Vector2;
  } | null = null;
  private disposeGizmoInteraction: (() => void) | null = null;

  constructor(
    container: HTMLElement,
    camera: THREE.PerspectiveCamera,
    mainScene: THREE.Scene,
    width: number,
    height: number,
  ) {
    ensureStyles();
    this.camera = camera;
    this.mainScene = mainScene;

    this.renderer = new CSS3DRenderer();
    this.renderer.domElement.style.position = "absolute";
    this.renderer.domElement.style.top = "0";
    this.renderer.domElement.style.left = "0";
    this.renderer.domElement.style.pointerEvents = "none";
    this.renderer.setSize(width, height);
    // Attached as a *sibling* of `container` (the WebGL mount div) rather
    // than a child of it. `container` carries `touch-action: none` to block
    // the browser's native pinch-zoom over the 3D view/joysticks, and touch-
    // action restrictions cascade to descendants with no way for a child to
    // opt back out (see the touch-action rules on .aqf-tv-panel below). Left
    // as a descendant, every TV panel's iframe would inherit that same
    // blanket restriction, permanently blocking real single-finger touch
    // (scrolling, tapping links) from ever reaching the embedded page —
    // and disabling default touch handling on a nested cross-origin iframe
    // sitting under a 3D-transformed ancestor is a known crash vector in
    // mobile WebKit. Being a sibling escapes that restriction entirely, so
    // each panel's own CSS controls touch-action precisely instead.
    // Inserted *before* `container` in their shared parent so the WebGL
    // canvas inside `container` still paints over this layer wherever it
    // draws anything opaque (the occluder-mesh technique above), and lets it
    // show through wherever it doesn't.
    const host = container.parentElement ?? container;
    this.mountHost = host;
    host.insertBefore(this.renderer.domElement, container);
    // Registered before setupPointerRedirect so a gizmo-handle hit is seen
    // (and can fully swallow the event) before the DOM hit-test redirect or
    // anything else — same-target capture-phase listeners fire in
    // registration order.
    this.setupGizmoInteraction();
    this.setupPointerRedirect();

    for (const state of loadTVs()) this.createEntry(state);

    // Every clock/date label across every panel is re-rendered on one shared
    // timer rather than a per-entry interval — cheap, and keeps all devices'
    // time in lockstep the way real devices in the same room would be.
    this.updateAllClocks();
    this.clockTimer = window.setInterval(() => this.updateAllClocks(), 15000);
  }

  setSize(width: number, height: number) {
    this.renderer.setSize(width, height);
  }

  private updateAllClocks() {
    const now = new Date();
    const time = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(
      now,
    );
    const date = new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(now);
    for (const entry of this.entries.values()) {
      for (const el of entry.clockEls) el.textContent = time;
      for (const el of entry.dateEls) el.textContent = date;
    }
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
  private fitScaleForViewport(distance: number, fraction: number, kind: DeviceKind): number {
    const fovRad = (this.camera.fov * Math.PI) / 180;
    const size = this.renderer.getSize();
    const unitsPerPixel = (2 * distance * Math.tan(fovRad / 2)) / Math.max(1, size.height);
    const targetPx = Math.min(size.width, size.height) * fraction;
    return clamp((targetPx * unitsPerPixel) / SIZES[kind].w, MIN_SCALE, MAX_SCALE);
  }

  private lastCssRenderTime = 0;
  // CSS3DRenderer writes a fresh `transform: matrix3d(...)` to every panel's
  // DOM element on each render() call, which forces the browser to
  // recomposite — and, for a cross-origin <iframe> that isn't already its
  // own layer, repaint — the *entire embedded page* underneath, including
  // whatever that page's own scripts/video/images are doing. Doing this at a
  // full 60fps was enough to crash the tab's renderer process right as a
  // real webpage finished loading into a panel, before any further touch —
  // capping it to ~30fps roughly halves that repaint cost with no visible
  // difference for panels drifting slowly with the ocean/camera.
  private static readonly CSS_RENDER_MIN_INTERVAL_MS = 1000 / 30;

  // World units per screen pixel at a given distance from the camera —
  // shared by the viewport-fit sizing, the drag handlers' screen-to-world
  // deltas, and the gizmo's constant-on-screen-size scaling below.
  private unitsPerPixelAt(distance: number): number {
    const fovRad = (this.camera.fov * Math.PI) / 180;
    const size = this.renderer.getSize();
    return (2 * distance * Math.tan(fovRad / 2)) / Math.max(1, size.height);
  }

  // Must run before the main WebGLRenderer's own render(scene, camera) call
  // so the occluders' synced transforms are in place when it draws.
  render() {
    // Cheap (WebGL-only, no DOM/repaint cost) — kept at full frame rate so
    // depth occlusion stays accurate every frame regardless of the CSS3D
    // throttle below.
    for (const entry of this.entries.values()) {
      entry.occluder.position.copy(entry.object.position);
      entry.occluder.quaternion.copy(entry.object.quaternion);
      entry.occluder.scale.copy(entry.object.scale);

      if (entry.gizmoGroup.visible) {
        entry.gizmoGroup.position.copy(entry.object.position);
        const dist = Math.max(0.001, entry.object.position.distanceTo(this.camera.position));
        entry.gizmoGroup.scale.setScalar(this.unitsPerPixelAt(dist) * GIZMO_PIXEL_SIZE);

        const viewDir = entry.object.position.clone().sub(this.camera.position).normalize();
        for (const child of entry.gizmoGroup.children) {
          const info = this.gizmoHitMap.get(child);
          if (info?.kind === "axis" && info.axis) {
            child.visible =
              Math.abs(GIZMO_AXIS_UNIT_VEC[info.axis].dot(viewDir)) < GIZMO_FORESHORTEN_HIDE_DOT;
          }
        }
      }
    }

    const now = performance.now();
    if (now - this.lastCssRenderTime < CSS3DTVManager.CSS_RENDER_MIN_INTERVAL_MS) return;
    this.lastCssRenderTime = now;
    this.renderer.render(this.scene, this.camera);
  }

  count(): number {
    return this.entries.size;
  }

  // Toggles the dev-only placement chrome (DOM toolbar, resize corner, pivot
  // dot) and the in-scene 3D transform gizmo (see buildGizmo) on every panel
  // — both normally hidden so a panel is nothing but its bathOS device,
  // revealed only while the caller's edit mode (which also freezes
  // wave/camera physics) is active.
  setEditMode(active: boolean): void {
    this.editMode = active;
    for (const entry of this.entries.values()) {
      entry.object.element.classList.toggle("aqf-edit-mode", active);
      entry.gizmoGroup.visible = active;
    }
  }

  // Spawns a new, locked, blank device (smart TV or mobile) a fixed distance
  // in front of wherever the camera is currently looking, facing back toward it.
  addTV(kind: DeviceKind = "tv"): void {
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
      scale: this.fitScaleForViewport(SPAWN_DISTANCE, 0.6, kind),
      device: kind,
      name: "",
      locked: true,
      screen: "home",
      apps: defaultApps(),
    };
    this.createEntry(state);
    this.persist();
  }

  dispose() {
    if (this.clockTimer != null) {
      window.clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
    if (this.saveTimer != null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.disposePointerRedirect?.();
    this.disposePointerRedirect = null;
    this.disposeGizmoInteraction?.();
    this.disposeGizmoInteraction = null;
    for (const id of Array.from(this.entries.keys())) this.removeEntry(id, false);
    if (this.renderer.domElement.parentNode === this.mountHost) {
      this.mountHost.removeChild(this.renderer.domElement);
    }
  }

  // Raycasts a gizmo handle under a real screen point and drives the
  // matching drag (axis-constrained move, free move, axis-constrained
  // rotate, or uniform scale) — the 3D counterpart of bindAxisDrag/
  // bindFreeDrag/bindRotate/bindResize below, driven by THREE.Raycaster hits
  // against real meshes in the main scene instead of DOM pointerdown targets
  // (a gizmo mesh isn't a DOM element, so it can't receive pointer events or
  // pointer capture the way the toolbar's handles do). Registered before
  // setupPointerRedirect in the constructor and, on a hit, calls
  // stopImmediatePropagation() so the same event can't also be reinterpreted
  // by the DOM hit-test redirect or anything else listening on window.
  private setupGizmoInteraction() {
    const ndcFromClient = (clientX: number, clientY: number) => {
      const size = this.renderer.getSize();
      return new THREE.Vector2(
        (clientX / Math.max(1, size.width)) * 2 - 1,
        -(clientY / Math.max(1, size.height)) * 2 + 1,
      );
    };

    const onDown = (ev: PointerEvent) => {
      if (!this.editMode || this.gizmoDrag) return;
      this.raycaster.setFromCamera(ndcFromClient(ev.clientX, ev.clientY), this.camera);
      const meshes = Array.from(this.gizmoHitMap.keys()).filter((m) => m.visible);
      const hits = this.raycaster.intersectObjects(meshes, false);
      if (hits.length === 0) return;
      // The free-move sphere sits at every panel's exact pivot, which can
      // geometrically coincide with an edge-on rotation ring or a
      // foreshortened axis arrow when the panel roughly faces the camera —
      // prefer the sphere over any other coincidental hit at the same
      // point, since grabbing the exact center should always mean "move
      // freely," not whichever ring or arrow happens to pass through it.
      const freeHit = hits.find((h) => this.gizmoHitMap.get(h.object)?.kind === "free");
      const hit = freeHit ?? hits[0];
      const info = this.gizmoHitMap.get(hit.object);
      const entry = info && this.entries.get(info.entryId);
      if (!info || !entry) return;

      ev.preventDefault();
      ev.stopImmediatePropagation();

      const startPos = entry.object.position.clone();
      const { unitsPerPixel, right, up } = this.cameraPlaneBasis(startPos);

      // Same screen-projection trick as bindAxisDrag: project the axis into
      // screen space so dragging exactly along the arrow's on-screen
      // direction gives 1:1 motion.
      let screenDir = new THREE.Vector2(1, 0);
      if (info.kind === "axis" && info.axis) {
        const axisVec = new THREE.Vector3(
          info.axis === "x" ? 1 : 0,
          info.axis === "y" ? 1 : 0,
          info.axis === "z" ? 1 : 0,
        );
        const size = this.renderer.getSize();
        const p0 = startPos.clone().project(this.camera);
        const p1 = startPos.clone().addScaledVector(axisVec, 0.5).project(this.camera);
        screenDir = new THREE.Vector2(
          (p1.x - p0.x) * (size.width / 2),
          -(p1.y - p0.y) * (size.height / 2),
        );
        if (screenDir.lengthSq() < 1e-6) screenDir.set(1, 0);
        screenDir.normalize();
      }

      this.gizmoDrag = {
        pointerId: ev.pointerId,
        entry,
        kind: info.kind,
        axis: info.axis,
        startX: ev.clientX,
        startY: ev.clientY,
        startPos,
        startScale: entry.object.scale.x,
        startRotX: entry.object.rotation.x,
        startRotY: entry.object.rotation.y,
        startRotZ: entry.object.rotation.z,
        unitsPerPixel,
        right,
        up,
        screenDir,
      };
    };

    const onMove = (ev: PointerEvent) => {
      const drag = this.gizmoDrag;
      if (!drag || drag.pointerId !== ev.pointerId) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();

      const dx = ev.clientX - drag.startX;
      const dy = ev.clientY - drag.startY;
      const { entry } = drag;

      if (drag.kind === "free") {
        const next = drag.startPos
          .clone()
          .addScaledVector(drag.right, dx * drag.unitsPerPixel)
          .addScaledVector(drag.up, -dy * drag.unitsPerPixel);
        entry.object.position.copy(next);
        entry.state.x = next.x;
        entry.state.y = next.y;
        entry.state.z = next.z;
      } else if (drag.kind === "axis" && drag.axis) {
        const axisVec = new THREE.Vector3(
          drag.axis === "x" ? 1 : 0,
          drag.axis === "y" ? 1 : 0,
          drag.axis === "z" ? 1 : 0,
        );
        const along = dx * drag.screenDir.x + dy * drag.screenDir.y;
        const next = drag.startPos.clone().addScaledVector(axisVec, along * drag.unitsPerPixel);
        entry.object.position.copy(next);
        entry.state.x = next.x;
        entry.state.y = next.y;
        entry.state.z = next.z;
      } else if (drag.kind === "ring") {
        // Horizontal drag yaws/rolls, vertical drag tilts — same per-axis
        // feel as the toolbar's rotate handle, just split one axis per ring
        // instead of one handle covering X and Y together.
        if (drag.axis === "x") {
          const rotX = clamp(drag.startRotX - dy * 0.012, -1.2, 1.2);
          entry.object.rotation.x = rotX;
          entry.state.rotX = rotX;
        } else if (drag.axis === "y") {
          const rotY = drag.startRotY + dx * 0.012;
          entry.object.rotation.y = rotY;
          entry.state.rotY = rotY;
        } else if (drag.axis === "z") {
          const rotZ = drag.startRotZ + dx * 0.012;
          entry.object.rotation.z = rotZ;
          entry.state.rotZ = rotZ;
        }
      } else if (drag.kind === "scale") {
        const delta = dx + dy;
        const next = clamp(drag.startScale * (1 + delta * 0.003), MIN_SCALE, MAX_SCALE);
        entry.object.scale.setScalar(next);
        entry.state.scale = next;
      }
      this.schedulePersist();
    };

    const onUp = (ev: PointerEvent) => {
      if (!this.gizmoDrag || this.gizmoDrag.pointerId !== ev.pointerId) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      this.gizmoDrag = null;
      this.persist();
    };

    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);

    this.disposeGizmoInteraction = () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
    };
  }

  // Finds the most specific interactive element under a real screen point by
  // checking actual layout rects (always accurate) instead of relying on the
  // browser's touch hit-test (which isn't, for this content — see
  // pointerTargets above). Checks every panel's hitTargets in their declared
  // most-specific-first order.
  private findPointerTarget(x: number, y: number): HTMLElement | null {
    for (const entry of this.entries.values()) {
      for (const el of entry.hitTargets()) {
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
    for (const mesh of entry.gizmoGroup.children) this.gizmoHitMap.delete(mesh);
    this.mainScene.remove(entry.gizmoGroup);
    this.entries.delete(id);
    if (persist) this.persist();
  }

  // --- bathOS screen/navigation helpers ---------------------------------

  private updateViewVisibility(entry: TVEntry) {
    const current = entry.state.locked ? "lock" : entry.state.screen;
    entry.lockView.classList.toggle("bos-view-active", current === "lock");
    entry.homeView.classList.toggle("bos-view-active", current === "home");
    entry.browserView.classList.toggle("bos-view-active", current === "browser");
  }

  private setSettingsOpen(entry: TVEntry, open: boolean) {
    entry.settingsOpen = open;
    entry.settingsOverlay.classList.toggle("bos-open", open);
    if (open) entry.settingsNameInput.value = entry.state.name;
  }

  private lockNow(entry: TVEntry) {
    entry.state.locked = true;
    this.setSettingsOpen(entry, false);
    entry.browserMenu.classList.remove("bos-open");
    this.updateViewVisibility(entry);
    this.persist();
  }

  private unlock(entry: TVEntry) {
    entry.state.locked = false;
    this.updateViewVisibility(entry);
    this.persist();
  }

  private goHome(entry: TVEntry) {
    entry.state.screen = "home";
    this.updateViewVisibility(entry);
    this.persist();
  }

  // Pushes a fully-resolved address into the iframe/placeholder/address bar
  // without touching which screen is showing — used both by navigate() (a
  // user-triggered load, which does switch to the browser) and by initial
  // hydration from persisted state (which must not).
  private applyAddress(entry: TVEntry, address: string) {
    entry.state.url = address;
    if (entry.addressInput.value !== address) entry.addressInput.value = address;
    if (!address) {
      entry.iframe.style.display = "none";
      entry.iframe.src = "";
      entry.placeholder.style.display = "flex";
    } else {
      const embed = toEmbedUrl(address);
      entry.placeholder.style.display = "none";
      entry.iframe.style.display = "block";
      if (entry.iframe.src !== embed) entry.iframe.src = embed;
    }
    this.updateHeart(entry);
  }

  // Loads `rawInput` (a bare search-bar/address-bar string, a bookmark's
  // saved url, or "" to just resume whatever's already loaded) and switches
  // to the browser screen — the one path every navigation action goes through.
  private navigate(entry: TVEntry, rawInput: string) {
    this.applyAddress(entry, resolveAddress(rawInput));
    entry.state.screen = "browser";
    this.updateViewVisibility(entry);
    this.persist();
  }

  private updateHeart(entry: TVEntry) {
    const url = entry.state.url;
    const active = !!url && entry.state.apps.some((a) => a.url === url);
    entry.heartBtn.style.color = active ? "#e0245e" : "#333";
    const svg = entry.heartBtn.querySelector("svg");
    if (svg) svg.setAttribute("fill", active ? "currentColor" : "none");
  }

  private toggleBookmark(entry: TVEntry) {
    const url = entry.state.url;
    if (!url) return;
    const idx = entry.state.apps.findIndex((a) => a.url === url);
    if (idx >= 0) {
      entry.state.apps.splice(idx, 1);
    } else {
      let name = url;
      try {
        name = new URL(url).hostname.replace(/^www\./, "");
      } catch {
        /* keep raw url as the name */
      }
      entry.state.apps.push({ id: makeId(), name, url, icon: "link" });
    }
    this.renderApps(entry);
    this.updateHeart(entry);
    this.persist();
  }

  private setAddFormOpen(entry: TVEntry, open: boolean) {
    entry.addFormOpen = open;
    entry.addFormEl.classList.toggle("bos-open", open);
    if (!open) {
      entry.addFormNameInput.value = "";
      entry.addFormUrlInput.value = "";
    }
  }

  // (Re)builds the home screen's app grid from entry.state.apps, plus a
  // trailing "+" tile that opens the add-bookmark mini-form.
  private renderApps(entry: TVEntry) {
    const container = entry.homeAppsEl;
    container.innerHTML = "";
    for (const app of entry.state.apps) {
      const tile = document.createElement("div");
      tile.className = "bos-app";
      tile.dataset.bosHit = "1";

      const icon = document.createElement("div");
      icon.className = "bos-app-icon";
      if (app.icon === "browser") {
        icon.style.background = "linear-gradient(135deg,#7c3aed,#fb923c)";
        icon.innerHTML = ICONS.globe;
      } else if (app.icon === "youtube") {
        icon.style.background = "#fff";
        icon.innerHTML = `<div style="width:24px;height:17px;border-radius:4px;background:#ff0000;display:flex;align-items:center;justify-content:center;">${ICONS.play}</div>`;
      } else {
        icon.style.background = colorForName(app.name);
        icon.textContent = (app.name.trim()[0] || "?").toUpperCase();
      }

      const name = document.createElement("div");
      name.className = "bos-app-name";
      name.textContent = app.name;

      tile.append(icon, name);
      tile.addEventListener("click", () => this.navigate(entry, app.url || entry.state.url));
      container.appendChild(tile);
    }

    const addTile = document.createElement("div");
    addTile.className = "bos-app bos-app-add";
    addTile.dataset.bosHit = "1";
    const addIcon = document.createElement("div");
    addIcon.className = "bos-app-icon";
    addIcon.textContent = "+";
    const addName = document.createElement("div");
    addName.className = "bos-app-name";
    addName.textContent = "Add";
    addTile.append(addIcon, addName);
    addTile.addEventListener("click", () => this.setAddFormOpen(entry, !entry.addFormOpen));
    container.appendChild(addTile);
  }

  private createEntry(state: TVState) {
    const size = SIZES[state.device];
    const el = document.createElement("div");
    el.className = this.editMode ? "aqf-tv-panel aqf-edit-mode" : "aqf-tv-panel";
    el.style.position = "relative";
    el.style.width = `${size.w}px`;
    el.style.height = `${size.h}px`;

    // --- dev-only placement chrome: device label, delete, and the
    // move/rotate/scale gizmo toolbar. Unrelated to bathOS itself — this is
    // the tool for placing/sizing the physical panel in the 3D scene — so it
    // stays hidden (see .aqf-tv-toolbar CSS) except while the app's global
    // edit mode is active; otherwise the panel is nothing but its bathOS
    // device, edge to edge. ------------------------------------------------
    const toolbar = document.createElement("div");
    toolbar.className = "aqf-tv-toolbar";

    const deviceLabel = document.createElement("div");
    deviceLabel.className = "aqf-tv-devicelabel";
    deviceLabel.textContent = state.device === "tv" ? "Smart-TV" : "Mobil";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "aqf-tv-btn";
    deleteBtn.type = "button";
    deleteBtn.textContent = "✕";
    deleteBtn.title = "Ta bort";
    deleteBtn.style.width = "22px";
    deleteBtn.style.height = "22px";

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

    toolbar.append(deviceLabel, freeBtn, xBtn, yBtn, zBtn, rotateBtn, deleteBtn);

    // --- bathOS shell ------------------------------------------------------
    const bosRoot = document.createElement("div");
    bosRoot.className = "bos-root";

    const statusbar = document.createElement("div");
    statusbar.className = "bos-statusbar";
    const signalIcon = document.createElement("span");
    signalIcon.innerHTML = ICONS.signal;
    const clockEl = document.createElement("span");
    clockEl.className = "bos-clock";
    statusbar.append(signalIcon, clockEl);

    const body = document.createElement("div");
    body.className = "bos-body";

    const viewstack = document.createElement("div");
    viewstack.className = "bos-viewstack";

    // Lock screen: tap anywhere to unlock.
    const lockView = document.createElement("div");
    lockView.className = "bos-view bos-lock";
    lockView.dataset.bosHit = "1";
    const lockNameEl = document.createElement("div");
    lockNameEl.className = "bos-lock-name";
    lockNameEl.textContent = state.name || "bathOS";
    const lockClockEl = document.createElement("div");
    lockClockEl.className = "bos-lock-time";
    const lockDateEl = document.createElement("div");
    lockDateEl.className = "bos-lock-date";
    const lockHint = document.createElement("div");
    lockHint.className = "bos-lock-hint";
    lockHint.textContent = "Tap to unlock";
    lockView.append(lockNameEl, lockClockEl, lockDateEl, lockHint);
    lockView.addEventListener("click", () => this.unlock(entry));

    // Home screen: search bar + app grid + add-bookmark form.
    const homeView = document.createElement("div");
    homeView.className = "bos-view bos-home";
    const homeMain = document.createElement("div");
    homeMain.className = "bos-home-main";

    const search = document.createElement("div");
    search.className = "bos-search";
    const searchIcon = document.createElement("span");
    searchIcon.innerHTML = ICONS.search;
    const searchInput = document.createElement("input");
    searchInput.className = "bos-search-input";
    searchInput.type = "text";
    searchInput.placeholder = "Search";
    searchInput.autocomplete = "off";
    searchInput.spellcheck = false;
    searchInput.dataset.bosHit = "1";
    search.append(searchIcon, searchInput);

    const homeApps = document.createElement("div");
    homeApps.className = "bos-apps";

    const addForm = document.createElement("div");
    addForm.className = "bos-addform";
    const addNameInput = document.createElement("input");
    addNameInput.type = "text";
    addNameInput.placeholder = "Name";
    addNameInput.dataset.bosHit = "1";
    const addUrlInput = document.createElement("input");
    addUrlInput.type = "text";
    addUrlInput.placeholder = "Web address";
    addUrlInput.dataset.bosHit = "1";
    const addFormRow = document.createElement("div");
    addFormRow.className = "bos-addform-row";
    const addConfirmBtn = document.createElement("button");
    addConfirmBtn.className = "aqf-tv-btn";
    addConfirmBtn.type = "button";
    addConfirmBtn.textContent = "✓";
    addConfirmBtn.dataset.bosHit = "1";
    const addCancelBtn = document.createElement("button");
    addCancelBtn.className = "aqf-tv-btn";
    addCancelBtn.type = "button";
    addCancelBtn.textContent = "✕";
    addCancelBtn.dataset.bosHit = "1";
    addFormRow.append(addConfirmBtn, addCancelBtn);
    addForm.append(addNameInput, addUrlInput, addFormRow);

    homeMain.append(search, homeApps, addForm);
    homeView.append(homeMain);

    // Browser screen: address bar (back / address+search / heart / menu) + content.
    const browserView = document.createElement("div");
    browserView.className = "bos-view bos-browser";
    const addressbar = document.createElement("div");
    addressbar.className = "bos-addressbar";

    const backBtn = document.createElement("div");
    backBtn.className = "bos-addr-btn";
    backBtn.innerHTML = ICONS.back;
    backBtn.dataset.bosHit = "1";

    const addrWrap = document.createElement("div");
    addrWrap.className = "bos-addr-inputwrap";
    const addressInput = document.createElement("input");
    addressInput.className = "bos-addr-input";
    addressInput.type = "text";
    addressInput.placeholder = "Search or enter URL";
    addressInput.autocomplete = "off";
    addressInput.spellcheck = false;
    addressInput.dataset.bosHit = "1";
    const heartBtn = document.createElement("div");
    heartBtn.className = "bos-addr-btn";
    heartBtn.innerHTML = ICONS.heart;
    heartBtn.dataset.bosHit = "1";
    addrWrap.append(addressInput, heartBtn);

    const menuBtn = document.createElement("div");
    menuBtn.className = "bos-addr-btn";
    menuBtn.innerHTML = ICONS.dots;
    menuBtn.dataset.bosHit = "1";

    const browserMenu = document.createElement("div");
    browserMenu.className = "bos-menu";
    const menuLockItem = document.createElement("div");
    menuLockItem.className = "bos-menu-item";
    menuLockItem.textContent = "Lock screen";
    menuLockItem.dataset.bosHit = "1";
    const menuRemoveItem = document.createElement("div");
    menuRemoveItem.className = "bos-menu-item";
    menuRemoveItem.textContent = "Remove device";
    menuRemoveItem.dataset.bosHit = "1";
    browserMenu.append(menuLockItem, menuRemoveItem);

    addressbar.append(backBtn, addrWrap, menuBtn, browserMenu);

    const screenWrap = document.createElement("div");
    screenWrap.className = "aqf-tv-screen";
    const placeholder = document.createElement("div");
    placeholder.className = "aqf-tv-placeholder";
    placeholder.textContent = "SEARCH OR ENTER A WEB ADDRESS";
    const iframe = document.createElement("iframe");
    iframe.className = "aqf-tv-iframe";
    iframe.setAttribute(
      "allow",
      "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture",
    );
    iframe.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
    iframe.style.display = "none";
    screenWrap.append(placeholder, iframe);

    browserView.append(addressbar, screenWrap);

    // Settings overlay (rename device / lock / remove) — opened from the
    // TV's rail gear icon or the mobile nav bar's menu icon.
    const settingsOverlay = document.createElement("div");
    settingsOverlay.className = "bos-settings";
    const settingsLabel = document.createElement("label");
    settingsLabel.textContent = "Device name";
    const settingsNameInput = document.createElement("input");
    settingsNameInput.type = "text";
    settingsNameInput.placeholder = "bathOS";
    settingsNameInput.dataset.bosHit = "1";
    const settingsRow1 = document.createElement("div");
    settingsRow1.className = "bos-settings-row";
    const lockNowBtn = document.createElement("div");
    lockNowBtn.className = "bos-settings-btn";
    lockNowBtn.textContent = "Lock now";
    lockNowBtn.dataset.bosHit = "1";
    const closeSettingsBtn = document.createElement("div");
    closeSettingsBtn.className = "bos-settings-btn";
    closeSettingsBtn.textContent = "Close";
    closeSettingsBtn.dataset.bosHit = "1";
    settingsRow1.append(lockNowBtn, closeSettingsBtn);
    const settingsRow2 = document.createElement("div");
    settingsRow2.className = "bos-settings-row";
    const removeDeviceBtn = document.createElement("div");
    removeDeviceBtn.className = "bos-settings-btn bos-danger";
    removeDeviceBtn.textContent = "Remove device";
    removeDeviceBtn.dataset.bosHit = "1";
    settingsRow2.append(removeDeviceBtn);
    settingsOverlay.append(settingsLabel, settingsNameInput, settingsRow1, settingsRow2);

    viewstack.append(lockView, homeView, browserView, settingsOverlay);

    // TV: persistent left nav rail. Mobile: bottom nav bar instead.
    let railStart: HTMLElement | null = null;
    let railSettings: HTMLElement | null = null;
    let railPower: HTMLElement | null = null;
    let navBack: HTMLElement | null = null;
    let navHome: HTMLElement | null = null;
    let navMenu: HTMLElement | null = null;

    if (state.device === "tv") {
      const rail = document.createElement("div");
      rail.className = "bos-rail";
      const logo = document.createElement("div");
      logo.className = "bos-rail-logo";
      logo.textContent = "bathOS";
      railStart = document.createElement("div");
      railStart.className = "bos-rail-item";
      railStart.textContent = "Start";
      railStart.dataset.bosHit = "1";
      railSettings = document.createElement("div");
      railSettings.className = "bos-rail-item";
      railSettings.textContent = "Settings";
      railSettings.dataset.bosHit = "1";
      const railSpacer = document.createElement("div");
      railSpacer.className = "bos-rail-spacer";
      railPower = document.createElement("div");
      railPower.className = "bos-rail-power";
      railPower.innerHTML = ICONS.power;
      railPower.dataset.bosHit = "1";
      rail.append(logo, railStart, railSettings, railSpacer, railPower);
      body.append(rail, viewstack);
    } else {
      body.append(viewstack);
    }

    bosRoot.append(statusbar, body);

    if (state.device === "mobile") {
      const navbar = document.createElement("div");
      navbar.className = "bos-navbar";
      navBack = document.createElement("div");
      navBack.className = "bos-navbtn";
      navBack.innerHTML = ICONS.back;
      navBack.dataset.bosHit = "1";
      navHome = document.createElement("div");
      navHome.className = "bos-navbtn";
      navHome.innerHTML = ICONS.home;
      navHome.dataset.bosHit = "1";
      navMenu = document.createElement("div");
      navMenu.className = "bos-navbtn";
      navMenu.innerHTML = ICONS.menu;
      navMenu.dataset.bosHit = "1";
      navbar.append(navBack, navHome, navMenu);
      bosRoot.append(navbar);
    }

    const resize = document.createElement("div");
    resize.className = "aqf-tv-resize";

    const pivot = document.createElement("div");
    pivot.className = "aqf-tv-pivot";

    el.append(toolbar, bosRoot, resize, pivot);

    const object = new CSS3DObject(el);
    object.position.set(state.x, state.y, state.z);
    object.rotation.set(state.rotX, state.rotY, state.rotZ);
    object.scale.setScalar(state.scale);
    this.scene.add(object);

    // See occluderGeometries/occluderMaterial above — kept in sync with
    // `object`'s transform every frame in render().
    const occluder = new THREE.Mesh(occluderGeometries[state.device], occluderMaterial);
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

    // See buildGizmo above — position/scale kept in sync with `object` every
    // frame in render(), visibility toggled by setEditMode.
    const gizmoGroup = buildGizmo(state.id, this.gizmoHitMap);
    gizmoGroup.visible = this.editMode;
    this.mainScene.add(gizmoGroup);

    // Most-specific-first: gizmo/chrome controls are listed explicitly, then
    // every bathOS interactive element still visible is queried fresh each
    // pointer event (dynamic — the app grid grows), then broad fallbacks.
    const hitTargets = () => [
      deleteBtn,
      freeBtn,
      xBtn,
      yBtn,
      zBtn,
      rotateBtn,
      resize,
      ...Array.from(el.querySelectorAll<HTMLElement>("[data-bos-hit]")),
      iframe,
      el,
    ];

    const entry: TVEntry = {
      state,
      object,
      iframe,
      placeholder,
      addressInput,
      searchInput,
      heartBtn,
      homeAppsEl: homeApps,
      lockView,
      homeView,
      browserView,
      settingsOverlay,
      settingsNameInput,
      browserMenu,
      clockEls: [clockEl, lockClockEl],
      dateEls: [lockDateEl],
      lockNameEl,
      settingsOpen: false,
      addFormOpen: false,
      addFormEl: addForm,
      addFormNameInput: addNameInput,
      addFormUrlInput: addUrlInput,
      hitTargets,
      occluder,
      gizmoGroup,
    };
    this.entries.set(state.id, entry);

    this.applyAddress(entry, state.url);
    this.renderApps(entry);
    this.updateViewVisibility(entry);

    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.removeEntry(state.id);
    });

    const stopKeys = (input: HTMLInputElement, onEnter: () => void) => {
      input.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          onEnter();
          input.blur();
        }
      });
    };

    stopKeys(searchInput, () => {
      this.navigate(entry, searchInput.value);
      searchInput.value = "";
    });
    stopKeys(addressInput, () => this.navigate(entry, addressInput.value));
    stopKeys(addNameInput, () => addUrlInput.focus());
    stopKeys(addUrlInput, () => addConfirmBtn.click());
    stopKeys(settingsNameInput, () => settingsNameInput.blur());

    heartBtn.addEventListener("click", () => this.toggleBookmark(entry));
    backBtn.addEventListener("click", () => this.goHome(entry));
    menuBtn.addEventListener("click", () => browserMenu.classList.toggle("bos-open"));
    menuLockItem.addEventListener("click", () => this.lockNow(entry));
    menuRemoveItem.addEventListener("click", () => this.removeEntry(state.id));

    addConfirmBtn.addEventListener("click", () => {
      const rawUrl = addUrlInput.value.trim();
      if (!rawUrl) return;
      const url = resolveAddress(rawUrl);
      let name = addNameInput.value.trim();
      if (!name) {
        try {
          name = new URL(url).hostname.replace(/^www\./, "");
        } catch {
          name = url;
        }
      }
      entry.state.apps.push({ id: makeId(), name, url, icon: "link" });
      this.setAddFormOpen(entry, false);
      this.renderApps(entry);
      this.persist();
    });
    addCancelBtn.addEventListener("click", () => this.setAddFormOpen(entry, false));

    settingsNameInput.addEventListener("blur", () => {
      entry.state.name = settingsNameInput.value.trim();
      lockNameEl.textContent = entry.state.name || "bathOS";
      this.persist();
    });
    lockNowBtn.addEventListener("click", () => this.lockNow(entry));
    closeSettingsBtn.addEventListener("click", () => this.setSettingsOpen(entry, false));
    removeDeviceBtn.addEventListener("click", () => this.removeEntry(state.id));

    railStart?.addEventListener("click", () => this.goHome(entry));
    railSettings?.addEventListener("click", () => this.setSettingsOpen(entry, !entry.settingsOpen));
    railPower?.addEventListener("click", () => this.lockNow(entry));
    navBack?.addEventListener("click", () => this.goHome(entry));
    navHome?.addEventListener("click", () => this.goHome(entry));
    navMenu?.addEventListener("click", () => this.setSettingsOpen(entry, !entry.settingsOpen));

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

  // Two-finger touch gesture on the panel itself, combining move + scale +
  // rotate into one natural motion: pan the midpoint to move, pinch to
  // resize, twist to rotate. This is the primary touch interaction for
  // moving/resizing a panel — the small single-pointer handles above are
  // precise but fiddly to hit on a real touchscreen, and a mouse can't
  // produce a second pointer anyway, so both schemes coexist rather than one
  // replacing the other. Bound on the whole panel root and relies on
  // bubbling, so it still sees pointer events that start on
  // .aqf-tv-screen/.aqf-tv-iframe even though that area carries no
  // touch-action restriction of its own — the two-finger case only calls
  // preventDefault() once a second pointer is down, by which point the
  // browser hasn't yet committed to any default single-finger behavior for
  // an untouched first touch, so a real single finger still reaches the
  // embedded page normally (tapping links, scrolling) instead of being
  // captured here.
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
