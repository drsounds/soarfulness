import { useSyncExternalStore } from "react";

// Selectable "chrome" theme for the app's own glass HUD (SettingsPanel,
// dialogs, joysticks, the virtual phone shell) — distinct from the water/
// scene settings in settingsShared.ts, so it's persisted under its own
// localStorage key and applied straight to <html> as data attributes/CSS
// custom properties (see styles.css's "UI chrome design tokens" section)
// rather than threaded through SettingsPanelProps. Any component can read
// or change it via useUiTheme() below and stay in sync with every other
// instance (SettingsPanel is rendered twice — main HUD + virtual phone).
export type UiThemeId = "aqua" | "scifi" | "spa" | "glass";
export const UI_THEME_IDS: UiThemeId[] = ["aqua", "scifi", "spa", "glass"];

export type UiColorScheme = "dark" | "light";

export type UiThemeSettings = {
  theme: UiThemeId;
  // Accent hue (0-360, HSL) — scifi's diode glow color and spa's gradient
  // base hue are independent so switching between the two (and back) keeps
  // each theme's own last-picked color.
  scifiAccentHue: number;
  spaAccentHue: number;
  // Only meaningfully used by the spa theme (its menus/buttons are solid
  // white or black depending on this) — aqua/scifi keep their own fixed
  // dark-glass look regardless.
  colorScheme: UiColorScheme;
  // Disables backdrop-filter (glass blur) everywhere for performance.
  // Off by default, per product decision — turn on for the frosted-glass
  // look at the cost of some GPU/compositing overhead.
  blurEnabled: boolean;
  // "Liquid Glass" theme (theme === "glass") — every knob is the visitor's
  // own. It always brings its own backdrop blur (glassBlur, 0 = none)
  // regardless of blurEnabled above, since frosted glass is the whole point
  // of picking it; the global blur toggle keeps governing the other themes,
  // so the energy-saving default (no blur anywhere) is untouched until
  // someone opts into this theme.
  glass: LiquidGlassSettings;
};

export type LiquidGlassSettings = {
  blur: number; // backdrop blur radius, px (0-40)
  refraction: number; // SVG displacement strength (0-100); Chromium only
  saturation: number; // backdrop saturate(), % (100-250)
  tintHue: number; // 0-360
  tintStrength: number; // how much of the hue colors the glass, % (0-100)
  opacity: number; // fill opacity of the glass, % (0-80)
  highlight: number; // specular edge/sheen strength, % (0-100)
  radius: number; // panel corner radius, px (0-40)
};

export const DEFAULT_LIQUID_GLASS: LiquidGlassSettings = {
  blur: 14,
  refraction: 30,
  saturation: 170,
  tintHue: 200,
  tintStrength: 25,
  opacity: 22,
  highlight: 65,
  radius: 24,
};

export const LIQUID_GLASS_LIMITS: Record<keyof LiquidGlassSettings, [number, number]> = {
  blur: [0, 40],
  refraction: [0, 100],
  saturation: [100, 250],
  tintHue: [0, 360],
  tintStrength: [0, 100],
  opacity: [0, 80],
  highlight: [0, 100],
  radius: [0, 40],
};

export const DEFAULT_UI_THEME_SETTINGS: UiThemeSettings = {
  theme: "aqua",
  scifiAccentHue: 195, // cyan
  spaAccentHue: 175, // turquoise
  colorScheme: "dark",
  blurEnabled: false,
  glass: DEFAULT_LIQUID_GLASS,
};

const STORAGE_KEY = "aquafulness:ui-theme:v1";

function isUiThemeId(v: unknown): v is UiThemeId {
  return v === "aqua" || v === "scifi" || v === "spa" || v === "glass";
}

function sanitizeGlass(raw: unknown): LiquidGlassSettings {
  const p = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = { ...DEFAULT_LIQUID_GLASS };
  for (const k of Object.keys(LIQUID_GLASS_LIMITS) as (keyof LiquidGlassSettings)[]) {
    const v = p[k];
    const [lo, hi] = LIQUID_GLASS_LIMITS[k];
    if (typeof v === "number" && Number.isFinite(v)) out[k] = Math.min(hi, Math.max(lo, v));
  }
  return out;
}

function sanitize(raw: unknown): UiThemeSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_UI_THEME_SETTINGS;
  const p = raw as Record<string, unknown>;
  const hue = (v: unknown, fb: number) =>
    typeof v === "number" && Number.isFinite(v) ? ((v % 360) + 360) % 360 : fb;
  return {
    theme: isUiThemeId(p.theme) ? p.theme : DEFAULT_UI_THEME_SETTINGS.theme,
    scifiAccentHue: hue(p.scifiAccentHue, DEFAULT_UI_THEME_SETTINGS.scifiAccentHue),
    spaAccentHue: hue(p.spaAccentHue, DEFAULT_UI_THEME_SETTINGS.spaAccentHue),
    colorScheme: p.colorScheme === "light" ? "light" : "dark",
    blurEnabled:
      typeof p.blurEnabled === "boolean" ? p.blurEnabled : DEFAULT_UI_THEME_SETTINGS.blurEnabled,
    glass: sanitizeGlass(p.glass),
  };
}

function loadInitial(): UiThemeSettings {
  if (typeof window === "undefined") return DEFAULT_UI_THEME_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : DEFAULT_UI_THEME_SETTINGS;
  } catch {
    return DEFAULT_UI_THEME_SETTINGS;
  }
}

let state: UiThemeSettings = loadInitial();
const listeners = new Set<() => void>();

// Applies the current settings straight to <html> — every .ui-* class in
// styles.css reads these back out, so this is the only place that needs to
// touch the DOM at all; no component needs the theme as a prop.
export function applyUiThemeToDom(s: UiThemeSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const isGlass = s.theme === "glass";
  root.setAttribute("data-ui-theme", s.theme);
  // "glass" keeps styles.css's blur-off kill switch from matching, so the
  // Liquid Glass theme's own backdrop-filter survives with blurEnabled off.
  root.setAttribute("data-ui-blur", isGlass ? "glass" : s.blurEnabled ? "on" : "off");
  root.classList.toggle("dark", !usesColorScheme(s.theme) || s.colorScheme === "dark");
  root.style.setProperty("--ui-scifi-hue", String(s.scifiAccentHue));
  root.style.setProperty("--ui-spa-hue", String(s.spaAccentHue));
  const refract = isGlass && s.glass.refraction > 0 && supportsBackdropSvgFilter();
  if (refract) ensureRefractionFilter(s.glass.refraction);
  for (const [k, v] of Object.entries(liquidGlassCssVars(s.glass, refract))) {
    root.style.setProperty(k, v);
  }
}

// Spa and Liquid Glass both come in a dark and a light variant; aqua/scifi
// are always dark glass.
export function usesColorScheme(theme: UiThemeId) {
  return theme === "spa" || theme === "glass";
}

// The custom properties the [data-ui-theme="glass"] rules in styles.css read.
// Kept as one pure function so the pre-hydration init script below can share
// the exact same math (it's serialized into that script verbatim).
export function liquidGlassCssVars(g: LiquidGlassSettings, refract: boolean) {
  const parts: string[] = [];
  if (refract) parts.push(`url(#${REFRACTION_FILTER_ID})`);
  if (g.blur > 0) parts.push(`blur(${g.blur}px)`);
  if (g.blur > 0 || refract) parts.push(`saturate(${g.saturation}%)`);
  return {
    "--ui-glass-hue": String(g.tintHue),
    "--ui-glass-tint": `${g.tintStrength}%`,
    "--ui-glass-alpha": `${g.opacity}%`,
    "--ui-glass-hl": String(g.highlight / 100),
    "--ui-glass-radius": `${g.radius}px`,
    "--ui-glass-filter": parts.length ? parts.join(" ") : "none",
  };
}

// Refraction: an SVG displacement filter used as a backdrop-filter, bending
// the scene behind each panel like a thick lens. Only Chromium (desktop
// Chrome/Edge and the Android WebView the app ships in) renders SVG filters
// in backdrop-filter; elsewhere a url() would invalidate the whole
// declaration and drop the blur too, so it's simply left out there.
const REFRACTION_FILTER_ID = "ui-liquid-glass-refraction";

let backdropSvgSupport: boolean | null = null;
function supportsBackdropSvgFilter() {
  if (backdropSvgSupport !== null) return backdropSvgSupport;
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  backdropSvgSupport = /Chrome\/|Chromium\//.test(ua) && !/iPhone|iPad|iPod/.test(ua);
  return backdropSvgSupport;
}

function ensureRefractionFilter(strength: number) {
  let svg: Element | null = document.getElementById(`${REFRACTION_FILTER_ID}-svg`);
  if (!svg) {
    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.id = `${REFRACTION_FILTER_ID}-svg`;
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.setAttribute(
      "style",
      "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none",
    );
    svg.innerHTML =
      `<filter id="${REFRACTION_FILTER_ID}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
      `<feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves="2" seed="11" result="noise"/>` +
      `<feGaussianBlur in="noise" stdDeviation="2" result="soft"/>` +
      `<feDisplacementMap in="SourceGraphic" in2="soft" scale="0" xChannelSelector="R" yChannelSelector="G"/>` +
      `</filter>`;
    document.body.appendChild(svg);
  }
  svg.querySelector("feDisplacementMap")?.setAttribute("scale", String(Math.round(strength * 0.8)));
}

// The pre-hydration init script can't add Liquid Glass refraction (that
// needs the SVG filter element), so finish the job once this module loads.
if (typeof document !== "undefined" && state.theme === "glass") {
  if (document.body) applyUiThemeToDom(state);
  else
    document.addEventListener("DOMContentLoaded", () => applyUiThemeToDom(state), { once: true });
}

function persist(s: UiThemeSettings) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* private browsing / quota — the choice just won't survive reload */
  }
}

export function getUiThemeSettings(): UiThemeSettings {
  return state;
}

export function setUiThemeSettings(
  update: Partial<UiThemeSettings> | ((s: UiThemeSettings) => UiThemeSettings),
) {
  state = typeof update === "function" ? update(state) : { ...state, ...update };
  applyUiThemeToDom(state);
  persist(state);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// The inline blocking script in routes/__root.tsx already applies the
// stored theme before first paint (avoiding a flash of the aqua default);
// this just re-syncs React's view of the world once the module loads,
// which is a no-op unless something raced it.
export function useUiTheme() {
  const settings = useSyncExternalStore(
    subscribe,
    getUiThemeSettings,
    () => DEFAULT_UI_THEME_SETTINGS,
  );
  return [settings, setUiThemeSettings] as const;
}

// Inlined verbatim into <head> by routes/__root.tsx so the saved theme
// applies before React hydrates — otherwise every load would flash the
// aqua default for a frame before a saved scifi/spa preference kicks in.
export const UI_THEME_INIT_SCRIPT = `(function(){try{
  var raw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
  var s = raw ? JSON.parse(raw) : {};
  var theme = (s.theme === "scifi" || s.theme === "spa") ? s.theme : "aqua";
  var scheme = s.colorScheme === "light" ? "light" : "dark";
  var scifiHue = typeof s.scifiAccentHue === "number" ? s.scifiAccentHue : ${DEFAULT_UI_THEME_SETTINGS.scifiAccentHue};
  var spaHue = typeof s.spaAccentHue === "number" ? s.spaAccentHue : ${DEFAULT_UI_THEME_SETTINGS.spaAccentHue};
  if (s.theme === "glass") theme = "glass";
  var blur = s.blurEnabled === true;
  var root = document.documentElement;
  root.setAttribute("data-ui-theme", theme);
  root.setAttribute("data-ui-blur", theme === "glass" ? "glass" : blur ? "on" : "off");
  root.classList.toggle("dark", (theme !== "spa" && theme !== "glass") || scheme === "dark");
  if (theme === "glass") {
    // Refraction needs the SVG filter element, which only exists once the
    // app module loads — the first frame gets blur/tint/highlight, and
    // applyUiThemeToDom adds refraction moments later.
    var g = s.glass || {};
    var d = ${JSON.stringify(DEFAULT_LIQUID_GLASS)};
    for (var k in d) if (typeof g[k] !== "number") g[k] = d[k];
    var vars = (${liquidGlassCssVars.toString()})(g, false);
    for (var v in vars) root.style.setProperty(v, vars[v]);
  }
  root.style.setProperty("--ui-scifi-hue", String(scifiHue));
  root.style.setProperty("--ui-spa-hue", String(spaHue));
}catch(e){}})();`;
