import { useEffect, useRef, useState } from "react";
import type { DeviceKind } from "@/lib/tv/CSS3DTVManager";
import { resolveAddress } from "@/lib/tv/CSS3DTVManager";
import { toEmbedUrl } from "@/lib/tv/youtubeEmbed";

type BathApp = { id: string; name: string; url: string; icon: "browser" | "youtube" | "link" };
type Orientation = "portrait" | "landscape";
type Screen = "home" | "browser";

type PhoneState = {
  x: number;
  y: number;
  width: number;
  height: number;
  orientation: Orientation;
  locked: boolean;
  screen: Screen;
  url: string;
  apps: BathApp[];
};

const STORAGE_KEY = "aquafulness:phone:v1";
const PORTRAIT_SIZE = { width: 260, height: 540 };
const MIN_DIM = 160;
const MAX_DIM = 900;

function defaultApps(): BathApp[] {
  return [
    { id: "browser", name: "Browser", url: "", icon: "browser" },
    // A specific watch link, not the bare youtube.com homepage — YouTube
    // sends X-Frame-Options: SAMEORIGIN on everything outside /watch and
    // /embed, so the homepage can never load in an iframe at all.
    {
      id: "youtube",
      name: "YouTube",
      url: "https://www.youtube.com/watch?v=JekUNGo-RVk",
      icon: "youtube",
    },
  ];
}

function defaultState(): PhoneState {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  return {
    x: Math.max(16, vw - PORTRAIT_SIZE.width - 32),
    y: Math.max(80, vh / 2 - PORTRAIT_SIZE.height / 2),
    width: PORTRAIT_SIZE.width,
    height: PORTRAIT_SIZE.height,
    orientation: "portrait",
    locked: true,
    screen: "home",
    url: "",
    apps: defaultApps(),
  };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function loadPhoneState(): PhoneState {
  const fallback = defaultState();
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return fallback;
    const p = parsed as Record<string, unknown>;
    const num = (v: unknown, fb: number) => (typeof v === "number" && Number.isFinite(v) ? v : fb);
    const apps = Array.isArray(p.apps)
      ? (p.apps as unknown[])
          .filter((a): a is Record<string, unknown> => !!a && typeof a === "object")
          .map((a): BathApp => ({
            id: typeof a.id === "string" ? a.id : Math.random().toString(36).slice(2),
            name: typeof a.name === "string" ? a.name : "App",
            url: typeof a.url === "string" ? a.url : "",
            icon: a.icon === "youtube" || a.icon === "browser" ? a.icon : "link",
          }))
      : fallback.apps;
    return {
      x: num(p.x, fallback.x),
      y: num(p.y, fallback.y),
      width: clamp(num(p.width, fallback.width), MIN_DIM, MAX_DIM),
      height: clamp(num(p.height, fallback.height), MIN_DIM, MAX_DIM),
      orientation: p.orientation === "landscape" ? "landscape" : "portrait",
      locked: typeof p.locked === "boolean" ? p.locked : fallback.locked,
      screen: p.screen === "browser" ? "browser" : "home",
      url: typeof p.url === "string" ? p.url : "",
      apps: apps.length ? apps : fallback.apps,
    };
  } catch {
    return fallback;
  }
}

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(hash) % 360}, 60%, 40%)`;
}

// Small inline stroke-icon set, matching the app's own HUD icon style.
const Icon = {
  search: (
    <svg
      viewBox="0 0 24 24"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  ),
  globe: (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18" />
    </svg>
  ),
  play: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="#fff">
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  back: (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 5l-7 7 7 7" />
    </svg>
  ),
  home: (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="8" />
    </svg>
  ),
  lock: (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="11" width="14" height="9" rx="1.5" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </svg>
  ),
  cast: (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M2 17a9 9 0 018 8" />
      <path d="M2 12a14 14 0 0113 13" />
      <circle cx="4" cy="20" r="1.6" fill="currentColor" stroke="none" />
      <rect x="10" y="3" width="12" height="9" rx="1.5" />
    </svg>
  ),
  rotate: (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 4v5h5" />
      <path d="M20 20v-5h-5" />
      <path d="M5.5 9A7 7 0 0119 12M18.5 15A7 7 0 015 12" />
    </svg>
  ),
  forward: (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  ),
  // Signal-strength bars — part of the status bar's phone-chrome look (see
  // the status bar rendered above lock/home/browser).
  signal: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <rect x="2" y="14" width="3" height="7" rx="0.5" />
      <rect x="8" y="10" width="3" height="11" rx="0.5" />
      <rect x="14" y="6" width="3" height="15" rx="0.5" />
      <rect x="20" y="2" width="3" height="19" rx="0.5" />
    </svg>
  ),
  // Three parallel diagonal strokes — the classic OS window resize grip, so
  // the corner handle reads as grabbable at a glance instead of decorative.
  resizeGrip: (
    <svg
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="16" y1="22" x2="22" y2="16" />
      <line x1="10" y1="22" x2="22" y2="10" />
      <line x1="4" y1="22" x2="22" y2="4" />
    </svg>
  ),
};

type Props = {
  onClose: () => void;
  listDisplays: () => { id: string; url: string; device: DeviceKind }[];
  onCastNew: (kind: DeviceKind, url: string) => void;
  onCastTo: (id: string, url: string) => void;
  onRemoveAll: () => void;
};

// A floating, draggable, resizable 2D "virtual smartphone" — plain screen-
// space DOM, not part of the 3D world, so none of CSS3DTVManager's hit-
// testing workarounds are needed (a normal DOM tree with no 3D CSS
// transforms hit-tests correctly on its own). Runs the same bathOS-style
// shell (lock screen, home screen with bookmarks, browser) the 3D panels
// used to, but its purpose here is to be your own remote: browse to
// something, then "cast" it to any TV/mobile display in the 3D world.
export function VirtualPhone({ onClose, listDisplays, onCastNew, onCastTo, onRemoveAll }: Props) {
  const [state, setState] = useState<PhoneState>(loadPhoneState);
  const [addressValue, setAddressValue] = useState(state.url);
  const [searchValue, setSearchValue] = useState("");
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addUrl, setAddUrl] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [castMenuOpen, setCastMenuOpen] = useState(false);
  const [castTargets, setCastTargets] = useState<{ id: string; url: string; device: DeviceKind }[]>(
    [],
  );

  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stateRef.current));
    } catch {
      /* quota or privacy mode — ignore */
    }
  }, [state]);

  const applyUrl = (raw: string) => {
    const address = resolveAddress(raw);
    setState((s) => ({ ...s, url: address, screen: "browser" }));
    setAddressValue(address);
  };

  const unlock = () => setState((s) => ({ ...s, locked: false }));
  const lockNow = () => {
    setMenuOpen(false);
    setCastMenuOpen(false);
    setState((s) => ({ ...s, locked: true }));
  };
  const goHome = () => {
    setMenuOpen(false);
    setState((s) => ({ ...s, screen: "home" }));
  };

  const toggleOrientation = () =>
    setState((s) => {
      const width = s.height;
      const height = s.width;
      return {
        ...s,
        orientation: s.orientation === "portrait" ? "landscape" : "portrait",
        width,
        height,
        // Swapping dimensions can push the phone partly off-screen if it was
        // sitting near an edge (e.g. portrait near the right edge becoming
        // wider than tall) — re-clamp the same way dragging does.
        x: clamp(s.x, -width + 60, window.innerWidth - 60),
        y: clamp(s.y, 0, window.innerHeight - 40),
      };
    });

  const toggleBookmark = () => {
    const url = state.url;
    if (!url) return;
    setState((s) => {
      const idx = s.apps.findIndex((a) => a.url === url);
      if (idx >= 0) {
        return { ...s, apps: [...s.apps.slice(0, idx), ...s.apps.slice(idx + 1)] };
      }
      let name = url;
      try {
        name = new URL(url).hostname.replace(/^www\./, "");
      } catch {
        /* keep raw url as the name */
      }
      return {
        ...s,
        apps: [...s.apps, { id: `app-${Date.now()}`, name, url, icon: "link" as const }],
      };
    });
  };
  const isBookmarked = !!state.url && state.apps.some((a) => a.url === state.url);

  // Browser history back/forward — history.back()/forward() (unlike most
  // Window members) are on the spec's cross-origin-accessible allowlist, so
  // these work even though embedded pages are almost always a different
  // origin; same-origin content works too. Wrapped defensively anyway since
  // browsers vary in what they let a parent frame touch on a child window.
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const goBack = () => {
    try {
      iframeRef.current?.contentWindow?.history.back();
    } catch {
      /* ignore */
    }
  };
  const goForward = () => {
    try {
      iframeRef.current?.contentWindow?.history.forward();
    } catch {
      /* ignore */
    }
  };

  const openCastMenu = () => {
    setCastTargets(listDisplays());
    setCastMenuOpen((v) => !v);
    setMenuOpen(false);
  };

  // --- drag (title bar) --------------------------------------------------
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
  } | null>(null);
  const onTitleDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startPosX: state.x,
      startPosY: state.y,
    };
  };
  const onTitleMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setState((s) => ({
      ...s,
      x: clamp(d.startPosX + (e.clientX - d.startX), -s.width + 60, vw - 60),
      y: clamp(d.startPosY + (e.clientY - d.startY), 0, vh - 40),
    }));
  };
  const onTitleUp = () => {
    dragRef.current = null;
  };

  // --- resize (corner handle) ---------------------------------------------
  const resizeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);
  const onResizeDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    resizeRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startW: state.width,
      startH: state.height,
    };
  };
  const onResizeMove = (e: React.PointerEvent) => {
    e.stopPropagation();
    const r = resizeRef.current;
    if (!r || r.pointerId !== e.pointerId) return;
    setState((s) => ({
      ...s,
      width: clamp(r.startW + (e.clientX - r.startX), MIN_DIM, MAX_DIM),
      height: clamp(r.startH + (e.clientY - r.startY), MIN_DIM, MAX_DIM),
    }));
  };
  const onResizeUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    resizeRef.current = null;
  };

  const embed = state.url ? toEmbedUrl(state.url) : "";

  return (
    <div
      className="pointer-events-auto fixed z-30 flex select-none flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0b1620] font-sans shadow-2xl"
      style={{ left: state.x, top: state.y, width: state.width, height: state.height }}
    >
      {/* Title bar: drag handle, orientation toggle, close. */}
      <div
        className="touch-none flex flex-shrink-0 cursor-grab items-center justify-between gap-2 bg-black/50 px-3 py-1.5 active:cursor-grabbing"
        onPointerDown={onTitleDown}
        onPointerMove={onTitleMove}
        onPointerUp={onTitleUp}
        onPointerCancel={onTitleUp}
      >
        <span className="text-[9px] font-light tracking-[0.25em] text-white/50">TELEFON</span>
        <div className="flex items-center gap-1.5 text-white/80">
          <button
            onClick={toggleOrientation}
            onPointerDown={(e) => e.stopPropagation()}
            title="Rotera (stående/liggande)"
            className="flex h-6 w-6 touch-none items-center justify-center rounded-full border border-white/20 bg-white/5 active:scale-95 active:bg-white/20"
          >
            {Icon.rotate}
          </button>
          <button
            onClick={onClose}
            onPointerDown={(e) => e.stopPropagation()}
            title="Stäng"
            className="flex h-6 w-6 touch-none items-center justify-center rounded-full border border-white/20 bg-white/5 text-xs active:scale-95 active:bg-white/20"
          >
            ✕
          </button>
        </div>
      </div>

      {/* bathOS body */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden text-white">
        {/* Status bar — reinstated from the old in-3D-panel bathOS shell,
            shown above every screen (lock/home/browser) rather than baked
            into just one of them: a persistent back-to-home control on the
            left, a signal glyph on the right, phone-chrome style. Disabled
            (still visible, not hidden) wherever "back" has nowhere to go. */}
        <div className="flex flex-shrink-0 items-center justify-between bg-black/30 px-2 py-1">
          <button
            onClick={goHome}
            disabled={state.locked || state.screen === "home"}
            className="flex h-4 w-4 items-center justify-center text-white/85 disabled:opacity-25"
            title="Hem"
          >
            {Icon.back}
          </button>
          <span className="flex items-center text-white/85" title="Signal">
            {Icon.signal}
          </span>
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {state.locked ? (
            <button
              onClick={unlock}
              className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gradient-to-b from-[#2c7be5] via-[#0a1e40] to-[#030b1a] p-3 text-center"
            >
              <div className="text-[11px] opacity-85">bathOS</div>
              <PhoneClock />
              <div className="absolute bottom-3 left-0 right-0 text-center text-[10px] tracking-wider opacity-70">
                Tryck för att låsa upp
              </div>
            </button>
          ) : state.screen === "home" ? (
            <div className="flex h-full flex-col gap-2 bg-gradient-to-b from-[#3579db] to-[#081b38] p-2">
              <div className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-white/55 px-2.5 py-1.5 text-[#262626]">
                <span className="opacity-65">{Icon.search}</span>
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter" && searchValue.trim()) {
                      applyUrl(searchValue);
                      setSearchValue("");
                    }
                  }}
                  placeholder="Sök"
                  autoComplete="off"
                  spellCheck={false}
                  className="min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-black/45"
                />
              </div>
              <div className="flex min-h-0 flex-1 flex-wrap content-start gap-2.5 overflow-auto">
                {state.apps.map((app) => (
                  <button
                    key={app.id}
                    onClick={() => applyUrl(app.url || state.url)}
                    className="flex w-[54px] flex-col items-center gap-1"
                  >
                    <div
                      className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-[10px] text-sm font-bold text-white"
                      style={{
                        background:
                          app.icon === "browser"
                            ? "linear-gradient(135deg,#7c3aed,#fb923c)"
                            : app.icon === "youtube"
                              ? "#fff"
                              : colorForName(app.name),
                      }}
                    >
                      {app.icon === "browser" ? (
                        Icon.globe
                      ) : app.icon === "youtube" ? (
                        <div className="flex h-[17px] w-6 items-center justify-center rounded bg-red-600">
                          {Icon.play}
                        </div>
                      ) : (
                        (app.name.trim()[0] || "?").toUpperCase()
                      )}
                    </div>
                    <div className="w-full truncate text-center text-[9px] opacity-90">
                      {app.name}
                    </div>
                  </button>
                ))}
                <button
                  onClick={() => setAddFormOpen((v) => !v)}
                  className="flex w-[54px] flex-col items-center gap-1"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-dashed border-white/50 bg-white/10 text-lg">
                    +
                  </div>
                  <div className="text-center text-[9px] opacity-90">Lägg till</div>
                </button>
              </div>
              {addFormOpen && (
                <div className="flex flex-shrink-0 flex-col gap-1.5 rounded-lg bg-black/35 p-2">
                  <input
                    type="text"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    placeholder="Namn"
                    className="rounded-md border-0 bg-white/90 px-2 py-1 text-[10px] text-black outline-none"
                  />
                  <input
                    type="text"
                    value={addUrl}
                    onChange={(e) => setAddUrl(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    placeholder="Webbadress"
                    className="rounded-md border-0 bg-white/90 px-2 py-1 text-[10px] text-black outline-none"
                  />
                  <div className="flex justify-end gap-1.5">
                    <button
                      onClick={() => {
                        const raw = addUrl.trim();
                        if (!raw) return;
                        const url = resolveAddress(raw);
                        let name = addName.trim();
                        if (!name) {
                          try {
                            name = new URL(url).hostname.replace(/^www\./, "");
                          } catch {
                            name = url;
                          }
                        }
                        setState((s) => ({
                          ...s,
                          apps: [...s.apps, { id: `app-${Date.now()}`, name, url, icon: "link" }],
                        }));
                        setAddName("");
                        setAddUrl("");
                        setAddFormOpen(false);
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-white/10 text-xs"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => {
                        setAddName("");
                        setAddUrl("");
                        setAddFormOpen(false);
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-white/10 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full flex-col bg-[#111]">
              <div className="relative flex flex-shrink-0 items-center gap-1.5 bg-white/90 px-1.5 py-1.5">
                <button
                  onClick={goBack}
                  className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-[#333]"
                  title="Bakåt"
                >
                  {Icon.back}
                </button>
                <button
                  onClick={goForward}
                  className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-[#333]"
                  title="Framåt"
                >
                  {Icon.forward}
                </button>
                <div className="flex min-w-0 flex-1 items-center gap-1 rounded-full bg-black/10 px-2.5 py-1">
                  <input
                    type="text"
                    value={addressValue}
                    onChange={(e) => setAddressValue(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") applyUrl(addressValue);
                    }}
                    placeholder="Sök eller ange webbadress"
                    autoComplete="off"
                    spellCheck={false}
                    className="min-w-0 flex-1 border-0 bg-transparent text-[10px] text-[#222] outline-none"
                  />
                </div>
                <button
                  onClick={toggleBookmark}
                  className="flex h-5 w-5 flex-shrink-0 items-center justify-center"
                  style={{ color: isBookmarked ? "#e0245e" : "#333" }}
                  title="Bokmärk"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="14"
                    height="14"
                    fill={isBookmarked ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 20s-7-4.4-9.5-9C.7 7.5 2.7 4 6 4c2 0 3.3 1 4 2 .7-1 2-2 4-2 3.3 0 5.3 3.5 3.5 7-2.5 4.6-9.5 9-9.5 9z" />
                  </svg>
                </button>
                <button
                  onClick={openCastMenu}
                  className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-[#333]"
                  title="Cast till skärm"
                >
                  {Icon.cast}
                </button>
                <button
                  onClick={() => {
                    setMenuOpen((v) => !v);
                    setCastMenuOpen(false);
                  }}
                  className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-[#333]"
                  title="Meny"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <circle cx="12" cy="5" r="1.6" />
                    <circle cx="12" cy="12" r="1.6" />
                    <circle cx="12" cy="19" r="1.6" />
                  </svg>
                </button>

                {menuOpen && (
                  <div className="absolute right-1.5 top-full z-10 mt-1 flex flex-col overflow-hidden rounded-lg bg-[#1c1c1c] shadow-xl">
                    <button
                      onClick={lockNow}
                      className="whitespace-nowrap px-3 py-2 text-left text-[10px] text-[#eee] active:bg-white/10"
                    >
                      Lås skärmen
                    </button>
                  </div>
                )}

                {castMenuOpen && (
                  <div className="absolute right-1.5 top-full z-10 mt-1 flex max-h-52 w-48 flex-col overflow-y-auto rounded-lg bg-[#1c1c1c] shadow-xl">
                    <button
                      onClick={() => {
                        onCastNew("tv", state.url);
                        setCastMenuOpen(false);
                      }}
                      className="whitespace-nowrap px-3 py-2 text-left text-[10px] text-[#eee] active:bg-white/10"
                    >
                      Ny smart-TV
                    </button>
                    <button
                      onClick={() => {
                        onCastNew("mobile", state.url);
                        setCastMenuOpen(false);
                      }}
                      className="whitespace-nowrap px-3 py-2 text-left text-[10px] text-[#eee] active:bg-white/10"
                    >
                      Ny mobil
                    </button>
                    {castTargets.length > 0 && <div className="my-1 border-t border-white/10" />}
                    {castTargets.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          onCastTo(t.id, state.url);
                          setCastMenuOpen(false);
                        }}
                        className="truncate whitespace-nowrap px-3 py-2 text-left text-[10px] text-[#eee] active:bg-white/10"
                      >
                        {t.url || "(tom skärm)"}
                      </button>
                    ))}
                    {castTargets.length > 0 && (
                      <>
                        <div className="my-1 border-t border-white/10" />
                        <button
                          onClick={() => {
                            onRemoveAll();
                            setCastTargets([]);
                            setCastMenuOpen(false);
                          }}
                          className="whitespace-nowrap px-3 py-2 text-left text-[10px] text-red-400 active:bg-white/10"
                        >
                          Ta bort alla skärmar
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="relative min-h-0 flex-1 bg-black">
                {state.url ? (
                  <iframe
                    ref={iframeRef}
                    src={embed}
                    className="absolute inset-0 h-full w-full border-0"
                    allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-[11px] tracking-wide text-white/35">
                    SÖK ELLER ANGE EN WEBBADRESS
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Phone-style bottom nav bar. */}
      {!state.locked && (
        <div className="flex flex-shrink-0 items-center justify-around border-t border-white/10 bg-black/40 py-1.5">
          <button
            onClick={goHome}
            className="flex h-6 w-6 items-center justify-center text-white/85"
            title="Hem"
          >
            {Icon.home}
          </button>
          <button
            onClick={lockNow}
            className="flex h-6 w-6 items-center justify-center text-white/85"
            title="Lås"
          >
            {Icon.lock}
          </button>
        </div>
      )}

      {/* Resize handle — deliberately its own dedicated corner grip (not
          reusing the title bar's drag, which only moves the phone) with a
          visible grip icon rather than a bare border, so it reads as
          grabbable instead of decorative. */}
      <div
        className="absolute bottom-0 right-0 flex h-7 w-7 touch-none cursor-nwse-resize items-end justify-end p-1 text-white/45 transition active:text-white/90"
        onPointerDown={onResizeDown}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeUp}
        onPointerCancel={onResizeUp}
        title="Ändra storlek"
      >
        {Icon.resizeGrip}
      </div>
    </div>
  );
}

function PhoneClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(id);
  }, []);
  const time = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(
    now,
  );
  const date = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);
  return (
    <>
      <div className="text-[34px] font-bold leading-none">{time}</div>
      <div className="text-[11px] opacity-80">{date}</div>
    </>
  );
}
