import { useSyncExternalStore } from "react";

// Selectable "chrome" theme for the app's own glass HUD (SettingsPanel,
// dialogs, joysticks, the virtual phone shell) — distinct from the water/
// scene settings in settingsShared.ts, so it's persisted under its own
// localStorage key and applied straight to <html> as data attributes/CSS
// custom properties (see styles.css's "UI chrome design tokens" section)
// rather than threaded through SettingsPanelProps. Any component can read
// or change it via useUiTheme() below and stay in sync with every other
// instance (SettingsPanel is rendered twice — main HUD + virtual phone).
export type UiThemeId = "aqua" | "scifi" | "spa";
export const UI_THEME_IDS: UiThemeId[] = ["aqua", "scifi", "spa"];

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
};

export const DEFAULT_UI_THEME_SETTINGS: UiThemeSettings = {
  theme: "aqua",
  scifiAccentHue: 195, // cyan
  spaAccentHue: 175, // turquoise
  colorScheme: "dark",
  blurEnabled: false,
};

const STORAGE_KEY = "aquafulness:ui-theme:v1";

function isUiThemeId(v: unknown): v is UiThemeId {
  return v === "aqua" || v === "scifi" || v === "spa";
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
  root.setAttribute("data-ui-theme", s.theme);
  root.setAttribute("data-ui-blur", s.blurEnabled ? "on" : "off");
  root.classList.toggle("dark", s.theme !== "spa" || s.colorScheme === "dark");
  root.style.setProperty("--ui-scifi-hue", String(s.scifiAccentHue));
  root.style.setProperty("--ui-spa-hue", String(s.spaAccentHue));
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
  var blur = s.blurEnabled === true;
  var root = document.documentElement;
  root.setAttribute("data-ui-theme", theme);
  root.setAttribute("data-ui-blur", blur ? "on" : "off");
  root.classList.toggle("dark", theme !== "spa" || scheme === "dark");
  root.style.setProperty("--ui-scifi-hue", String(scifiHue));
  root.style.setProperty("--ui-spa-hue", String(spaHue));
}catch(e){}})();`;
