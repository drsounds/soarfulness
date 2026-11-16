import {
  useState,
  type CSSProperties,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import {
  isSpacifyAvailable,
  requestSpacifySync,
  signInWithSpacify,
  signOutOfSpacify,
  useSpacify,
} from "@/lib/spacify";
import { useTranslation } from "react-i18next";
import {
  type OpenDriftCurve,
  type OpenDriftDirection,
  OPEN_DRIFT_CURVES,
  OPEN_DRIFT_DIRECTIONS,
} from "@/lib/openDrift";
import { Link } from "@tanstack/react-router";
import { SettingRow } from "@/components/SettingRow";
import { Findable, G, SETTINGS_GROUPS, SettingsNavigator } from "@/components/settingsNav";
import { WindSettings, type WindControls } from "@/components/WindPanel";
import { HoodSettings } from "@/components/HoodSettings";
import type { HoodCuffMaterial, HoodLayer, HoodStyle } from "@/lib/hoodLayers";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { hsvToRgb, tintToCss } from "@/lib/waterTint";
import {
  WATER_COLORS,
  WATER_COLOR_LABEL_KEYS,
  BOTTOM_OPTIONS,
  BOTTOM_LABEL_KEYS,
  BACKDROPS,
  BACKDROP_LABEL_KEYS,
  WATER_SOUND_LABEL_KEYS,
  TORUS_RING_TEXTURES,
  TORUS_TEXTURE_LABEL_KEYS,
  CAMERA_MODES,
  CAMERA_MODE_LABEL_KEYS,
  TORNADO_DIRECTIONS,
  TORNADO_DIRECTION_LABEL_KEYS,
  TORNADO_SEQUENCE_EXIT_MODES,
  TORNADO_SEQUENCE_EXIT_MODE_LABEL_KEYS,
  SURGE_ROTATION_MODES,
  SURGE_ROTATION_MODE_LABEL_KEYS,
  SWING_PRESETS,
  SWING_Y_WAVEFORMS,
  FREAK_OUT_AXES,
  DEPTH_SINE_WAVEFORMS,
  INTERVAL_SESSION_TYPES,
  WAVE_FREQ_MIN,
  WAVE_FREQ_MAX,
  worldXZBearing,
  formatClock,
  type CameraMode,
  type SwingPreset,
  type SwingYWaveform,
  type FreakOutAxis,
  type DepthSineWaveform,
  type IntervalSessionType,
  type WavePresetName,
  type TornadoDirection,
  type TornadoSequenceExitMode,
  type SurgeRotationMode,
  type RetroPalette,
  type AuroraPalette,
  type UnderwaterFogBlend,
  type NeonMode,
  type ConfettiPalette,
  RETRO_PALETTES,
  AURORA_PALETTES,
  UNDERWATER_FOG_BLENDS,
  NEON_MODES,
  CONFETTI_PALETTES,
  SKY_CLOUDS_ALTITUDE_MIN,
  SKY_CLOUDS_ALTITUDE_MAX,
  CLOUD_SCALE_MIN,
  CLOUD_SCALE_MAX,
  BODYFLIGHT_AIRFLOW_MAX,
  BODYFLIGHT_GRAVITY_MAX,
  BODYFLIGHT_HOVER_MIN,
  BODYFLIGHT_HOVER_MAX,
} from "@/lib/settingsShared";
import { pickJsonFile, type PresetScope, type SavedPreset, type SavedState } from "@/lib/presets";
import { changeLanguage, SUPPORTED_LANGUAGES, LANGUAGE_NAMES, type LanguageCode } from "@/lib/i18n";
import {
  useUiTheme,
  usesColorScheme,
  UI_THEME_IDS,
  DEFAULT_LIQUID_GLASS,
  LIQUID_GLASS_LIMITS,
  type LiquidGlassSettings,
} from "@/lib/uiTheme";
import { limitMax, useExtremeLimits, type LimitedControl } from "@/lib/extremeLimits";
import { ShareBathDialog } from "@/components/ShareBathDialog";
import { ScenerySelectorButton } from "@/components/ScenerySelectorDialog";
import type { AppSceneryPreset, SavedSceneryPreset, SceneryData } from "@/lib/sceneryPresets";

// The built-in WATER_SOUNDS entries have an i18next label key; per-app audio
// tracks (routes/index.tsx's allWaterSounds) don't, so they fall back to
// their own catalog "name" field, same as scene/environment/surface names.
function waterSoundLabel(t: (key: string) => string, sound?: { id: string; name?: string }) {
  if (!sound) return "";
  const key = WATER_SOUND_LABEL_KEYS[sound.id];
  return key ? t(key) : (sound.name ?? sound.id);
}

// i18next keys for enum values that don't already carry a human-readable
// "name" (unlike scenes/environments/surfaces, which come from data with
// their own name field) — resolved via t() at each usage site below.
const INTERVAL_SESSION_TYPE_LABEL_KEYS: Record<IntervalSessionType, string> = {
  infinite: "interval.type.infinite",
  fixed: "interval.type.fixed",
};
const SWING_PRESET_LABEL_KEYS: Record<SwingPreset, string> = {
  water: "swing.preset.water",
  clouds: "swing.preset.clouds",
  custom: "swing.preset.custom",
};
const SWING_Y_WAVEFORM_LABEL_KEYS: Record<SwingYWaveform, string> = {
  pendulum: "swing.waveform.pendulum",
  sine: "swing.waveform.sine",
  triangle: "swing.waveform.triangle",
  square: "swing.waveform.square",
};
const DEPTH_SINE_WAVEFORM_LABEL_KEYS: Record<DepthSineWaveform, string> = {
  sine: "depthSine.waveform.sine",
  sawtooth: "depthSine.waveform.sawtooth",
};
const WAVE_PRESET_LABEL_KEYS: Record<WavePresetName, string> = {
  standard: "wave.preset.standard",
  legacy: "wave.preset.legacy",
};

// Compact language picker — always visible in the settings header (not
// tab-scoped) since it affects every tab's labels at once. Uses the shared
// i18n instance directly via changeLanguage() (see lib/i18n.ts) rather than
// i18n.changeLanguage(), so the choice is also persisted to localStorage.
function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  return (
    <label className="flex items-center gap-1.5 rounded-full border ui-line-1 ui-surface px-2.5 py-1">
      <span className="text-[9px] font-light tracking-[0.28em] ui-ink-faint">
        {t("language.label")}
      </span>
      <select
        value={i18n.language}
        onChange={(e) => changeLanguage(e.target.value as LanguageCode)}
        className="cursor-pointer appearance-none bg-transparent text-[10px] font-medium tracking-wider ui-ink outline-none"
      >
        {SUPPORTED_LANGUAGES.map((code) => (
          <option key={code} value={code} className="bg-black ui-ink">
            {LANGUAGE_NAMES[code]}
          </option>
        ))}
      </select>
    </label>
  );
}

// Checkerboard backdrop shown behind anything painted with a partial alpha
// (the picker button's swatch, its expanded preview dot, and the alpha
// slider's track) so a faded-out color still reads as "transparent" rather
// than just "darker" against the panel's own near-black background.
const CHECKERBOARD_STYLE: CSSProperties = {
  backgroundImage:
    "conic-gradient(rgba(255,255,255,0.25) 25%, transparent 0 50%, rgba(255,255,255,0.25) 0 75%, transparent 0)",
  backgroundSize: "10px 10px",
};

// Real color picker for the water color overlay — a "pick color" button
// that expands into a genuine HSV picker (a full-saturation rainbow hue
// slider plus a checkerboard alpha slider), replacing the old numeric HUE
// dial. The hue slider picks an actual, vivid RGB color directly
// (lib/waterTint.ts's hsvToRgb) that's painted over the water at COLOR
// STRENGTH's alpha (see uOverlayColor in routes/index.tsx) — independent of
// the WATER preset's own always-on tint (that preset used to be rotated by
// this same dial, but rotating an often near-neutral preset color could
// shift the result by only a barely perceptible amount, which is why the
// old hue and alpha sliders could look like they weren't doing anything).
function WaterColorPicker({
  pickColorLabel,
  hueLabel,
  alphaLabel,
  hue,
  setHue,
  alpha,
  setAlpha,
}: {
  pickColorLabel: string;
  hueLabel: string;
  alphaLabel: string;
  hue: number;
  setHue: (v: number) => void;
  alpha: number;
  setAlpha: (v: number) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const previewRgb = hsvToRgb(hue, 1, 1);
  const swatchStyle = { backgroundColor: tintToCss(previewRgb, alpha) };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full border ui-line-1 ui-surface px-3 py-1.5 backdrop-blur-md transition active:scale-95 ui-press"
      >
        <span
          className="h-5 w-5 shrink-0 overflow-hidden rounded-full border ui-line-3"
          style={CHECKERBOARD_STYLE}
        >
          <span className="block h-full w-full" style={swatchStyle} />
        </span>
        <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">
          {pickColorLabel}
        </span>
      </button>
    );
  }

  const hueTrack = Array.from({ length: 13 }, (_, i) =>
    tintToCss(hsvToRgb((i * 360) / 12, 1, 1), 1),
  ).join(", ");
  const alphaTrack = `${tintToCss(previewRgb, 0)}, ${tintToCss(previewRgb, 1)}`;

  return (
    <div className="flex w-full max-w-xs flex-col gap-2 rounded-2xl border ui-line-1 ui-surface px-3 py-2.5 backdrop-blur-md">
      <div className="flex items-center gap-2.5">
        <span
          className="h-8 w-8 shrink-0 overflow-hidden rounded-full border ui-line-3"
          style={CHECKERBOARD_STYLE}
        >
          <span className="block h-full w-full" style={swatchStyle} />
        </span>
        <span className="flex-1 text-[9px] font-light tracking-[0.28em] ui-ink-muted">
          {pickColorLabel}
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t("common.close")}
          className="h-6 w-6 shrink-0 rounded-full border ui-line-2 ui-tint-1 text-[11px] ui-ink transition active:scale-95 ui-press"
        >
          ✕
        </button>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">{hueLabel}</span>
          <span className="text-[10px] font-medium tabular-nums tracking-wider ui-ink">
            {Math.round(hue)}°
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={360}
          step={1}
          value={hue}
          onChange={(e) => setHue(Number(e.target.value))}
          aria-label={hueLabel}
          className="aqua-color-slider w-full"
          style={{ "--aqua-track": `linear-gradient(to right, ${hueTrack})` } as CSSProperties}
        />
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">{alphaLabel}</span>
          <span className="text-[10px] font-medium tabular-nums tracking-wider ui-ink">
            {Math.round(alpha * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={alpha}
          onChange={(e) => setAlpha(Number(e.target.value))}
          aria-label={alphaLabel}
          className="aqua-color-slider aqua-color-slider--alpha w-full"
          style={{ "--aqua-track": `linear-gradient(to right, ${alphaTrack})` } as CSSProperties}
        />
      </div>
    </div>
  );
}

// TEMA: picks the "chrome" look for buttons/menus/panels drawn over the 3D
// scene (this settings dialog, other dialogs, joysticks, the virtual phone
// shell) — see src/lib/uiTheme.ts and the "UI chrome design tokens" section
// of styles.css. Applies instantly via CSS custom properties on <html>, so
// there's nothing else to wire up here beyond reading/writing the store.
function ThemeSettingsSection() {
  const { t } = useTranslation();
  const [ui, setUi] = useUiTheme();

  const accentHue = ui.theme === "spa" ? ui.spaAccentHue : ui.scifiAccentHue;
  const setAccentHue = (v: number) =>
    setUi(ui.theme === "spa" ? { spaAccentHue: v } : { scifiAccentHue: v });
  const hueTrack = Array.from({ length: 13 }, (_, i) =>
    tintToCss(hsvToRgb((i * 360) / 12, 1, 1), 1),
  ).join(", ");

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-3">
      <div
        className="flex flex-wrap justify-center gap-1.5"
        role="radiogroup"
        aria-label={t("theme.title")}
      >
        {UI_THEME_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={ui.theme === id}
            onClick={() => setUi({ theme: id })}
            className={`rounded-full border px-3 py-1.5 text-[9px] font-light tracking-wider transition active:scale-95 ${
              ui.theme === id
                ? "ui-line-3 ui-tint-2 ui-ink"
                : "ui-line-1 ui-tint-1 ui-ink-muted ui-press"
            }`}
          >
            {t(`theme.${id}`)}
          </button>
        ))}
      </div>
      <p className="ui-ink-faint max-w-xs text-center text-[9px] leading-relaxed">
        {t(`theme.${ui.theme}Description`)}
      </p>

      {(ui.theme === "scifi" || ui.theme === "spa") && (
        <div className="ui-surface flex w-full flex-col gap-1 rounded-2xl border px-3 py-2.5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="ui-ink-muted text-[9px] font-light tracking-[0.28em]">
              {t("theme.accentHue")}
            </span>
            <span className="ui-ink text-[10px] font-medium tabular-nums tracking-wider">
              {Math.round(accentHue)}°
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={accentHue}
            onChange={(e) => setAccentHue(Number(e.target.value))}
            aria-label={t("theme.accentHue")}
            className="aqua-color-slider w-full"
            style={{ "--aqua-track": `linear-gradient(to right, ${hueTrack})` } as CSSProperties}
          />
        </div>
      )}

      {ui.theme === "glass" && <LiquidGlassControls hueTrack={hueTrack} />}

      {usesColorScheme(ui.theme) && (
        <SettingRow
          label={t("theme.colorScheme")}
          value={ui.colorScheme === "dark" ? t("theme.dark") : t("theme.light")}
          onDec={() => setUi({ colorScheme: "dark" })}
          onInc={() => setUi({ colorScheme: "light" })}
        />
      )}

      {ui.theme !== "glass" && (
        <>
          <SettingRow
            label={t("theme.blur")}
            value={ui.blurEnabled ? t("common.on") : t("common.off")}
            onDec={() => setUi({ blurEnabled: false })}
            onInc={() => setUi({ blurEnabled: true })}
          />
          <p className="ui-ink-faint max-w-xs text-center text-[9px] leading-relaxed">
            {t("theme.blurHint")}
          </p>
        </>
      )}
    </div>
  );
}

// LIQUID GLASS: every look-defining knob of the "glass" theme. Values live
// in the same ui-theme store (uiTheme.ts → glass) and are pushed to <html>
// as --ui-glass-* custom properties, so changes apply live to every panel,
// dialog and control without re-rendering anything else.
const LIQUID_GLASS_ROWS: {
  key: keyof LiquidGlassSettings;
  unit: string;
  step: number;
}[] = [
  { key: "blur", unit: "px", step: 1 },
  { key: "refraction", unit: "%", step: 5 },
  { key: "saturation", unit: "%", step: 5 },
  { key: "tintStrength", unit: "%", step: 5 },
  { key: "opacity", unit: "%", step: 2 },
  { key: "highlight", unit: "%", step: 5 },
  { key: "radius", unit: "px", step: 2 },
];

function LiquidGlassControls({ hueTrack }: { hueTrack: string }) {
  const { t } = useTranslation();
  const [ui, setUi] = useUiTheme();
  const g = ui.glass;
  const setGlass = (patch: Partial<LiquidGlassSettings>) =>
    setUi((s) => ({ ...s, glass: { ...s.glass, ...patch } }));

  return (
    <div className="flex w-full flex-col">
      <div className="ui-surface flex w-full flex-col gap-1 rounded-2xl border px-3 py-2.5 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <span className="ui-ink-muted text-[9px] font-light tracking-[0.28em]">
            {t("theme.glass_tintHue")}
          </span>
          <span className="ui-ink text-[10px] font-medium tabular-nums tracking-wider">
            {Math.round(g.tintHue)}°
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={360}
          step={1}
          value={g.tintHue}
          onChange={(e) => setGlass({ tintHue: Number(e.target.value) })}
          aria-label={t("theme.glass_tintHue")}
          className="aqua-color-slider w-full"
          style={{ "--aqua-track": `linear-gradient(to right, ${hueTrack})` } as CSSProperties}
        />
      </div>
      {LIQUID_GLASS_ROWS.map(({ key, unit, step }) => {
        const [min, max] = LIQUID_GLASS_LIMITS[key];
        const v = g[key];
        const clamp = (n: number) => Math.min(max, Math.max(min, n));
        return (
          <SettingRow
            key={key}
            label={t(`theme.glass_${key}`)}
            value={v === 0 && key !== "radius" ? t("common.off") : `${Math.round(v)}${unit}`}
            mode="number"
            rawValue={v}
            min={min}
            max={max}
            step={step}
            onSet={(n) => setGlass({ [key]: clamp(n) })}
            onDec={() => setGlass({ [key]: clamp(v - step) })}
            onInc={() => setGlass({ [key]: clamp(v + step) })}
          />
        );
      })}
      <button
        type="button"
        onClick={() => setGlass(DEFAULT_LIQUID_GLASS)}
        className="ui-btn mt-3 self-center rounded-full border px-4 py-1.5 text-[9px] font-medium tracking-wider transition active:scale-95"
      >
        {t("theme.glass_reset")}
      </button>
      <p className="ui-ink-faint mt-2 max-w-xs self-center text-center text-[9px] leading-relaxed">
        {t("theme.glass_hint")}
      </p>
    </div>
  );
}

type NamedOption = { id: string; name: string; appId?: string };
type EnvTimeOption = NamedOption;
type EnvEraOption = NamedOption & { times: EnvTimeOption[] };
type EnvOption = NamedOption & { eras: EnvEraOption[] };

// The full wave/camera/water/environment/audio control panel — shared
// verbatim between the main HUD's settings dialog (routes/index.tsx, which
// wraps this in its floating overlay chrome) and its clone rendered as the
// "Inställningar" app inside the virtual phone's bathOS shell
// (VirtualPhone.tsx, which wraps this in a plain scrollable screen instead).
// Every value/setter below is exactly the corresponding piece of index.tsx's
// own local state — this component owns none of it, so both hosts always
// stay in sync (there is only one wave simulation, one camera, etc).
export type SettingsPanelProps = {
  // VIND: the wind list, its effects and sound (components/WindPanel.tsx).
  wind: WindControls;
  restoreCameraPosition: () => void;
  resetToDefaults: () => void;

  // Save/load/export/import presets (see src/lib/presets.ts) — offered both
  // for the settings dialog as a whole ("all") and for each individual tab.
  savedPresets: SavedPreset[];
  exportSettingsFile: (scope: PresetScope) => void;
  importSettingsFile: (scope: PresetScope, file: File) => void;
  savePresetAs: (scope: PresetScope, name: string) => void;
  loadSavedPreset: (id: string) => void;
  deleteSavedPreset: (id: string) => void;

  // Save/load/export/import full state — like the presets above, but every
  // settings field at once (unscoped) plus the player's live position/look
  // and STRÖM/SVAJ current direction (see routes/index.tsx's
  // buildFullStateSnapshot/applyFullState).
  savedStates: SavedState[];
  exportStateFile: () => void;
  importStateFile: (file: File) => void;
  saveStateAs: (name: string) => void;
  loadSavedStateById: (id: string) => void;
  deleteSavedState: (id: string) => void;

  // Every named preset/state saved on this device, exported to (and merged
  // back in from) one combined file — see routes/index.tsx's
  // exportLibraryFile/importLibraryFile.
  exportLibraryFile: () => void;
  importLibraryFile: (file: File) => void;

  // DELA BADLÄNK: encodes the full live state (settings + camera pose) plus
  // an optional title/description into a self-contained /bathing/<base62>
  // URL — no server storage, see src/lib/shareState.ts and
  // routes/bathing.$payload.tsx.
  buildBathLink: (title: string, description: string) => Promise<string>;

  // Vågor
  waveAmp: number;
  setWaveAmp: Dispatch<SetStateAction<number>>;
  waveSpeed: number;
  setWaveSpeed: Dispatch<SetStateAction<number>>;
  // FREKVENS: multiplies the spatial wavenumbers of every waveform at once
  // (SPRIDD/REGELBUNDEN/FFT-HAV/DÖENDE VÅG/VIRVEL) — higher packs more,
  // shorter crests into the same water without changing TEMPO. Stacks on top
  // of VÅGPERIOD, which only ever applied to REGELBUNDEN/VIRVEL.
  waveFreq: number;
  setWaveFreq: Dispatch<SetStateAction<number>>;
  heightOffset: number;
  setHeightOffset: Dispatch<SetStateAction<number>>;
  submergeAmp: number;
  setSubmergeAmp: Dispatch<SetStateAction<number>>;
  floatLift: number;
  setFloatLift: Dispatch<SetStateAction<number>>;
  waveAnticipation: number;
  setWaveAnticipation: Dispatch<SetStateAction<number>>;
  driftWorldRef: MutableRefObject<{ x: number; z: number }>;
  driftDisplayRef: MutableRefObject<{ x: number; y: number }>;
  setDriftStick: (v: { x: number; y: number }) => void;
  swayWorldRef: MutableRefObject<{ x: number; z: number }>;
  swayDisplayRef: MutableRefObject<{ x: number; y: number }>;
  setSwayStick: (v: { x: number; y: number }) => void;
  setStickBearing: (
    worldRef: MutableRefObject<{ x: number; z: number }>,
    displayRef: MutableRefObject<{ x: number; y: number }>,
    setDisplay: (v: { x: number; y: number }) => void,
    deg: number,
  ) => void;
  swayAmp: number;
  setSwayAmp: Dispatch<SetStateAction<number>>;
  swaySpeed: number;
  setSwaySpeed: Dispatch<SetStateAction<number>>;
  swayBias: number;
  setSwayBias: Dispatch<SetStateAction<number>>;
  // SURGE: an independent, slow back-and-forth current, decoupled from the
  // HEAVE-locked SVAJ above — see routes/index.tsx's surge physics.
  // surgeWorldRef is the fixed-in-world direction (recomputed live from
  // surgeRotationMode when that's cw/ccw/random); setSurgeBearing is its
  // dedicated setter (distinct from setStickBearing since surgeWorldRef also
  // gets rewritten every frame by the rotation, not just by user input).
  surgeWorldRef: MutableRefObject<{ x: number; z: number }>;
  setSurgeBearing: (deg: number) => void;
  surgeAmp: number;
  setSurgeAmp: Dispatch<SetStateAction<number>>;
  surgeSpeed: number;
  setSurgeSpeed: Dispatch<SetStateAction<number>>;
  surgeRotationMode: SurgeRotationMode;
  setSurgeRotationMode: Dispatch<SetStateAction<SurgeRotationMode>>;
  surgeRotationSpeed: number;
  setSurgeRotationSpeed: Dispatch<SetStateAction<number>>;
  openDriftOn: boolean;
  setOpenDriftOn: Dispatch<SetStateAction<boolean>>;
  openDriftCurve: OpenDriftCurve;
  setOpenDriftCurve: Dispatch<SetStateAction<OpenDriftCurve>>;
  openDriftRadius: number;
  setOpenDriftRadius: Dispatch<SetStateAction<number>>;
  openDriftCycleSpeed: number;
  setOpenDriftCycleSpeed: Dispatch<SetStateAction<number>>;
  openDriftMagnitude: number;
  setOpenDriftMagnitude: Dispatch<SetStateAction<number>>;
  openDriftDirection: OpenDriftDirection;
  setOpenDriftDirection: Dispatch<SetStateAction<OpenDriftDirection>>;
  buoyAmp: number;
  setBuoyAmp: Dispatch<SetStateAction<number>>;
  bobSpeed: number;
  setBobSpeed: Dispatch<SetStateAction<number>>;
  regularWaves: boolean;
  setRegularWaves: Dispatch<SetStateAction<boolean>>;
  // Realistic (JONSWAP/FFT-ocean) waveform, ported from
  // https://github.com/drsounds/OceanDemo (MIT, Popov / evpopov.com) — see
  // src/lib/ocean/fftOceanSpectrum.ts.
  realisticWaves: boolean;
  setRealisticWaves: Dispatch<SetStateAction<boolean>>;
  // DÖENDE VÅG (dying wave): a long, decaying-swell overlay with its own
  // height/speed dials, blended on top of whichever base waveform is active
  // the same way REALISTISKA VÅGOR blends over VÅGFORM.
  dyingWave: boolean;
  setDyingWave: Dispatch<SetStateAction<boolean>>;
  dyingWaveAmp: number;
  setDyingWaveAmp: Dispatch<SetStateAction<number>>;
  dyingWaveSpeed: number;
  setDyingWaveSpeed: Dispatch<SetStateAction<number>>;
  // SLUMPA VÅGOR: off (default) generates REALISTISKA VÅGOR/DÖENDE VÅG from
  // a fixed seed each load — same wave shape and heave rhythm every time; on
  // draws real randomness for a fresh shape each load. Only read once at
  // mount (the component sets are only ever generated once per mount), so
  // toggling it takes effect on the next reload, not live.
  randomizeWaves: boolean;
  setRandomizeWaves: Dispatch<SetStateAction<boolean>>;
  // VÅGPRESET: applies a bundle of wave-only settings in one step — see
  // WAVE_PRESETS in routes/index.tsx.
  wavePreset: WavePresetName;
  applyWavePreset: (preset: WavePresetName) => void;
  regularCross: boolean;
  setRegularCross: Dispatch<SetStateAction<boolean>>;
  // VÅGFORM's third step, STÅENDE: the regular waveform as a standing wave
  // (alternate crests rise while their neighbours sink). Only meaningful
  // with regularWaves on — VÅGFORM steps SPRIDD → REGELBUNDEN → STÅENDE.
  standingWaves: boolean;
  setStandingWaves: Dispatch<SetStateAction<boolean>>;
  // VÅGFORM's fourth step, SKVALPANDE: rolling crests that slosh back and
  // forth while the water level rises and falls, camera on lagging buoyancy.
  sloshWaves: boolean;
  setSloshWaves: Dispatch<SetStateAction<boolean>>;
  regularPeriod: number;
  setRegularPeriod: Dispatch<SetStateAction<number>>;
  wavePeak: number;
  setWavePeak: Dispatch<SetStateAction<number>>;
  trochoid: number;
  setTrochoid: Dispatch<SetStateAction<number>>;
  heaveSkew: number;
  setHeaveSkew: Dispatch<SetStateAction<number>>;
  waveHighQuality: boolean;
  setWaveHighQuality: Dispatch<SetStateAction<boolean>>;
  waveDir: number;
  setWaveDir: Dispatch<SetStateAction<number>>;

  // Kamera
  cameraMode: CameraMode;
  setCameraMode: Dispatch<SetStateAction<CameraMode>>;
  cycleCameraMode: (dir: number) => void;
  noclipSpeed: number;
  setNoclipSpeed: Dispatch<SetStateAction<number>>;
  noclipFallRiseSpeed: number;
  setNoclipFallRiseSpeed: Dispatch<SetStateAction<number>>;
  noclipVertEaseTime: number;
  setNoclipVertEaseTime: Dispatch<SetStateAction<number>>;
  bodyflightAirflow: number;
  setBodyflightAirflow: Dispatch<SetStateAction<number>>;
  bodyflightGravity: number;
  setBodyflightGravity: Dispatch<SetStateAction<number>>;
  bodyflightHoverHeight: number;
  setBodyflightHoverHeight: Dispatch<SetStateAction<number>>;
  noclipAutoAlternateOn: boolean;
  setNoclipAutoAlternateOn: Dispatch<SetStateAction<boolean>>;
  noclipAutoAlternateInterval: number;
  setNoclipAutoAlternateInterval: Dispatch<SetStateAction<number>>;
  // Resting altitude the swing hangs from (formerly named "swingHeight",
  // renamed to avoid confusion with the vertical-excursion swingHeight below).
  swingPositionY: number;
  setSwingPositionY: Dispatch<SetStateAction<number>>;
  swingIntensity: number;
  setSwingIntensity: Dispatch<SetStateAction<number>>;
  swingSpeed: number;
  setSwingSpeed: Dispatch<SetStateAction<number>>;
  swingXFactor: number;
  setSwingXFactor: Dispatch<SetStateAction<number>>;
  // Vertical excursion of the swing (formerly "swingYAmplitude").
  swingHeight: number;
  setSwingHeight: Dispatch<SetStateAction<number>>;
  // Holds the swing's actual speed when GUNGA HÖJD changes (see index.tsx).
  swingKeepSpeed: boolean;
  setSwingKeepSpeedOn: (on: boolean) => void;
  swingPreset: SwingPreset;
  applySwingPreset: (preset: SwingPreset) => void;
  cycleSwingPreset: (dir: number) => void;
  swingYWaveform: SwingYWaveform;
  setSwingYWaveform: Dispatch<SetStateAction<SwingYWaveform>>;
  cycleSwingYWaveform: (dir: number) => void;
  // SWING HOOK + CORD — see settingsShared.ts.
  swingHook: string;
  setSwingHook: Dispatch<SetStateAction<string>>;
  sceneHooks: string[];
  swingCordColor: string;
  setSwingCordColor: Dispatch<SetStateAction<string>>;
  swingCordThickness: number;
  setSwingCordThickness: Dispatch<SetStateAction<number>>;
  swingCordSoftness: number;
  setSwingCordSoftness: Dispatch<SetStateAction<number>>;
  // FREAK OUT carousel layered on GUNGA — see settingsShared.ts.
  freakOutOn: boolean;
  setFreakOutOn: Dispatch<SetStateAction<boolean>>;
  freakOutSwingAxis: number;
  setFreakOutSwingAxis: Dispatch<SetStateAction<number>>;
  freakOutSwingAngle: number;
  setFreakOutSwingAngle: Dispatch<SetStateAction<number>>;
  freakOutSwingSpeed: number;
  setFreakOutSwingSpeed: Dispatch<SetStateAction<number>>;
  freakOutSwingLength: number;
  setFreakOutSwingLength: Dispatch<SetStateAction<number>>;
  freakOutRingRadius: number;
  setFreakOutRingRadius: Dispatch<SetStateAction<number>>;
  freakOutRotationOn: boolean;
  setFreakOutRotationOn: Dispatch<SetStateAction<boolean>>;
  freakOutRotationAxis: FreakOutAxis;
  setFreakOutRotationAxis: Dispatch<SetStateAction<FreakOutAxis>>;
  freakOutRotationSpeed: number;
  setFreakOutRotationSpeed: Dispatch<SetStateAction<number>>;
  freakOutRotationPeakSpeed: number;
  setFreakOutRotationPeakSpeed: Dispatch<SetStateAction<number>>;
  freakOutRotationRecovery: number;
  setFreakOutRotationRecovery: Dispatch<SetStateAction<number>>;
  freakOutRotationOscillate: boolean;
  setFreakOutRotationOscillate: Dispatch<SetStateAction<boolean>>;
  freakOutRotationOscillateSpeed: number;
  setFreakOutRotationOscillateSpeed: Dispatch<SetStateAction<number>>;
  freakOutRotationOscillateEveryOther: boolean;
  setFreakOutRotationOscillateEveryOther: Dispatch<SetStateAction<boolean>>;
  freakOutRotationKickOn: boolean;
  setFreakOutRotationKickOn: Dispatch<SetStateAction<boolean>>;
  freakOutRotationKick: number;
  setFreakOutRotationKick: Dispatch<SetStateAction<number>>;
  freakOutFloatYOffset: number;
  setFreakOutFloatYOffset: Dispatch<SetStateAction<number>>;
  freakOutOverlayOn: boolean;
  setFreakOutOverlayOn: Dispatch<SetStateAction<boolean>>;
  freakOutRotationDirection: TornadoDirection;
  freakOutViewFixedHeading: boolean;
  setFreakOutViewFixedHeading: Dispatch<SetStateAction<boolean>>;
  freakOutShowArm: boolean;
  setFreakOutShowArm: Dispatch<SetStateAction<boolean>>;
  freakOutShowFrame: boolean;
  setFreakOutShowFrame: Dispatch<SetStateAction<boolean>>;
  freakOutShowTopRing: boolean;
  setFreakOutShowTopRing: Dispatch<SetStateAction<boolean>>;
  freakOutShowHub: boolean;
  setFreakOutShowHub: Dispatch<SetStateAction<boolean>>;
  freakOutRingLevel: boolean;
  setFreakOutRingLevel: Dispatch<SetStateAction<boolean>>;
  freakOutSeatsOn: boolean;
  setFreakOutSeatsOn: Dispatch<SetStateAction<boolean>>;
  freakOutSeatCount: number;
  setFreakOutSeatCount: Dispatch<SetStateAction<number>>;
  freakOutCameraSeat: number;
  setFreakOutCameraSeat: Dispatch<SetStateAction<number>>;
  freakOutSeatPostLength: number;
  setFreakOutSeatPostLength: Dispatch<SetStateAction<number>>;
  freakOutSeatColor: string;
  setFreakOutSeatColor: Dispatch<SetStateAction<string>>;
  freakOutRingColor: string;
  setFreakOutRingColor: Dispatch<SetStateAction<string>>;
  freakOutPostColor: string;
  setFreakOutPostColor: Dispatch<SetStateAction<string>>;
  freakOutArmColor: string;
  setFreakOutArmColor: Dispatch<SetStateAction<string>>;
  freakOutFrameColor: string;
  setFreakOutFrameColor: Dispatch<SetStateAction<string>>;
  setFreakOutRotationDirection: Dispatch<SetStateAction<TornadoDirection>>;
  // TORNADO: one unified toggle shared by GUNGA (swing) and flying (noclip/
  // watercraft) alike — a circular orbit instead of GUNGA's default
  // back-and-forth pendulum arc / NOCLIP's plain free flight. While
  // swinging, also opens a real water whirlpool at the same xz spot (see
  // tornadoOpening); flying never shows that water effect. Activating/
  // deactivating eases in/out rather than snapping instantly.
  tornadoOn: boolean;
  setTornadoOn: Dispatch<SetStateAction<boolean>>;
  tornadoRadius: number;
  setTornadoRadius: Dispatch<SetStateAction<number>>;
  tornadoSpeed: number;
  setTornadoSpeed: Dispatch<SetStateAction<number>>;
  tornadoDirection: TornadoDirection;
  setTornadoDirection: Dispatch<SetStateAction<TornadoDirection>>;
  // Width of the water whirlpool's throat while swinging.
  tornadoOpening: number;
  setTornadoOpening: Dispatch<SetStateAction<number>>;
  // Whether the camera's look direction eases toward facing the tornado/
  // whirlpool's center instead of keeping whatever direction it's facing.
  tornadoFollowCenter: boolean;
  setTornadoFollowCenter: Dispatch<SetStateAction<boolean>>;
  // TORNADO CLOUD: optional visible funnel-shaped cloud wrapping the active
  // tornado orbit.
  tornadoCloudOn: boolean;
  setTornadoCloudOn: Dispatch<SetStateAction<boolean>>;
  // Meters above the real water surface (at the tornado's own xz spot) the
  // TORNADO CLOUD's tip sits while swinging or flying — has no effect while
  // floating, where the cloud just follows the camera's own height.
  tornadoCloudYOffset: number;
  setTornadoCloudYOffset: Dispatch<SetStateAction<number>>;
  // TORNADO SEQUENCE: an optional automatic drag-in/stay/exit loop layered on
  // top of the always-available manual NAV+current radial control (see
  // TornadoSequenceExitMode's comment in settingsShared.ts for the full
  // drag/stay/exit phase design).
  tornadoSequenceOn: boolean;
  setTornadoSequenceOn: Dispatch<SetStateAction<boolean>>;
  tornadoSequenceDragSpeed: number;
  setTornadoSequenceDragSpeed: Dispatch<SetStateAction<number>>;
  tornadoSequenceDragDuration: number;
  setTornadoSequenceDragDuration: Dispatch<SetStateAction<number>>;
  tornadoSequenceStayDuration: number;
  setTornadoSequenceStayDuration: Dispatch<SetStateAction<number>>;
  tornadoSequenceExitMode: TornadoSequenceExitMode;
  setTornadoSequenceExitMode: Dispatch<SetStateAction<TornadoSequenceExitMode>>;
  tornadoSequenceExitSpeed: number;
  setTornadoSequenceExitSpeed: Dispatch<SetStateAction<number>>;
  tornadoSequenceLiftHeight: number;
  setTornadoSequenceLiftHeight: Dispatch<SetStateAction<number>>;
  tornadoSequencePauseDuration: number;
  setTornadoSequencePauseDuration: Dispatch<SetStateAction<number>>;
  // Interval session: automatically cycles cameraMode through whichever of
  // FRI/GUNGA are enabled below, every intervalDuration seconds, either
  // forever or for a fixed intervalCount.
  intervalSessionOn: boolean;
  setIntervalSessionOn: Dispatch<SetStateAction<boolean>>;
  intervalDuration: number;
  setIntervalDuration: Dispatch<SetStateAction<number>>;
  intervalSessionType: IntervalSessionType;
  setIntervalSessionType: Dispatch<SetStateAction<IntervalSessionType>>;
  intervalCount: number;
  setIntervalCount: Dispatch<SetStateAction<number>>;
  intervalShowStats: boolean;
  setIntervalShowStats: Dispatch<SetStateAction<boolean>>;
  intervalIncludeFloat: boolean;
  setIntervalIncludeFloat: Dispatch<SetStateAction<boolean>>;
  intervalIncludeSwing: boolean;
  setIntervalIncludeSwing: Dispatch<SetStateAction<boolean>>;
  camOffX: number;
  setCamOffX: Dispatch<SetStateAction<number>>;
  camOffY: number;
  setCamOffY: Dispatch<SetStateAction<number>>;
  camOffZ: number;
  setCamOffZ: Dispatch<SetStateAction<number>>;
  camFov: number;
  setCamFov: Dispatch<SetStateAction<number>>;
  camNear: number;
  setCamNear: Dispatch<SetStateAction<number>>;
  camFar: number;
  setCamFar: Dispatch<SetStateAction<number>>;
  leanEnabled: boolean;
  setLeanEnabled: Dispatch<SetStateAction<boolean>>;
  gogglesOn: boolean;
  setGogglesOn: Dispatch<SetStateAction<boolean>>;
  gogglesBlur: number;
  setGogglesBlur: Dispatch<SetStateAction<number>>;
  gogglesLoop: boolean;
  setGogglesLoop: Dispatch<SetStateAction<boolean>>;
  gogglesIntensity: number;
  setGogglesIntensity: Dispatch<SetStateAction<number>>;
  gogglesFpsCap: number;
  setGogglesFpsCap: Dispatch<SetStateAction<number>>;
  // HUVA (lib/sceneFx/hood.ts).
  hoodOn: boolean;
  setHoodOn: Dispatch<SetStateAction<boolean>>;
  hoodHeight: number;
  setHoodHeight: Dispatch<SetStateAction<number>>;
  hoodOpening: number;
  setHoodOpening: Dispatch<SetStateAction<number>>;
  hoodColor: string;
  setHoodColor: Dispatch<SetStateAction<string>>;
  hoodMetallic: number;
  setHoodMetallic: Dispatch<SetStateAction<number>>;
  hoodMotion: number;
  setHoodMotion: Dispatch<SetStateAction<number>>;
  hoodLowerOn: boolean;
  setHoodLowerOn: Dispatch<SetStateAction<boolean>>;
  hoodLowerHeight: number;
  setHoodLowerHeight: Dispatch<SetStateAction<number>>;
  hoodZipperOn: boolean;
  setHoodZipperOn: Dispatch<SetStateAction<boolean>>;
  hoodWaterOn: boolean;
  setHoodWaterOn: Dispatch<SetStateAction<boolean>>;
  hoodWaterLevel: number;
  setHoodWaterLevel: Dispatch<SetStateAction<number>>;
  hoodOpeningWidth: number;
  setHoodOpeningWidth: Dispatch<SetStateAction<number>>;
  hoodDrop: number;
  setHoodDrop: Dispatch<SetStateAction<number>>;
  hoodWeight: number;
  setHoodWeight: Dispatch<SetStateAction<number>>;
  hoodWrinkles: number;
  setHoodWrinkles: Dispatch<SetStateAction<number>>;
  hoodDarkness: number;
  setHoodDarkness: Dispatch<SetStateAction<number>>;
  hoodRoundness: number;
  setHoodRoundness: Dispatch<SetStateAction<number>>;
  hoodStyle: HoodStyle;
  setHoodStyle: Dispatch<SetStateAction<HoodStyle>>;
  hoodPuffSize: number;
  setHoodPuffSize: Dispatch<SetStateAction<number>>;
  hoodPuffHeight: number;
  setHoodPuffHeight: Dispatch<SetStateAction<number>>;
  hoodCuffOn: boolean;
  setHoodCuffOn: Dispatch<SetStateAction<boolean>>;
  hoodCuffHeight: number;
  setHoodCuffHeight: Dispatch<SetStateAction<number>>;
  hoodCuffSize: number;
  hoodCuffCustom: boolean;
  hoodCuffColor: string;
  hoodCuffMetallic: number;
  hoodCuffMaterial: HoodCuffMaterial;
  hoodHanging: boolean;
  hoodWaterCalm: number;
  hoodCuffTop: boolean;
  hoodZipperFixed: boolean;
  hoodZipperPullOut: boolean;
  hoodReflectLight: boolean;
  hoodPuffThickness: number;
  hoodPuffInflate: number;
  setHoodCuffSize: Dispatch<SetStateAction<number>>;
  setHoodCuffCustom: Dispatch<SetStateAction<boolean>>;
  setHoodCuffColor: Dispatch<SetStateAction<string>>;
  setHoodCuffMetallic: Dispatch<SetStateAction<number>>;
  setHoodCuffMaterial: Dispatch<SetStateAction<HoodCuffMaterial>>;
  setHoodHanging: Dispatch<SetStateAction<boolean>>;
  setHoodWaterCalm: Dispatch<SetStateAction<number>>;
  setHoodCuffTop: Dispatch<SetStateAction<boolean>>;
  setHoodZipperFixed: Dispatch<SetStateAction<boolean>>;
  setHoodZipperPullOut: Dispatch<SetStateAction<boolean>>;
  setHoodReflectLight: Dispatch<SetStateAction<boolean>>;
  setHoodPuffThickness: Dispatch<SetStateAction<number>>;
  setHoodPuffInflate: Dispatch<SetStateAction<number>>;
  hoodExtraLayers: HoodLayer[];
  setHoodExtraLayers: Dispatch<SetStateAction<HoodLayer[]>>;
  // General performance controls (independent of SIMGLASÖGON): caps the
  // main render loop's fps and scales the renderer's internal resolution.
  targetFps: number;
  setTargetFps: Dispatch<SetStateAction<number>>;
  resolutionScale: number;
  setResolutionScale: Dispatch<SetStateAction<number>>;
  // LOW GRAPHICS MODE: one switch that forces off every optional texture
  // and live-noise/extra-shading effect (see its doc comment in
  // settingsShared.ts) without touching those settings' own values.
  lowGraphicsMode: boolean;
  setLowGraphicsMode: Dispatch<SetStateAction<boolean>>;
  // KROMATISK ABERRATION: a full-screen lens post-process (red/blue channels
  // sampled offset radially from center). chromaticAberrationAmount is the
  // dial's 0..1 strength, independent of whether the effect is on.
  chromaticAberrationOn: boolean;
  setChromaticAberrationOn: Dispatch<SetStateAction<boolean>>;
  chromaticAberrationAmount: number;
  setChromaticAberrationAmount: Dispatch<SetStateAction<number>>;
  betterLightingOn: boolean;
  setBetterLightingOn: Dispatch<SetStateAction<boolean>>;
  lightingReflStrength: number;
  setLightingReflStrength: Dispatch<SetStateAction<number>>;
  shadowsOn: boolean;
  setShadowsOn: Dispatch<SetStateAction<boolean>>;
  retroOn: boolean;
  setRetroOn: Dispatch<SetStateAction<boolean>>;
  retroPalette: RetroPalette;
  setRetroPalette: Dispatch<SetStateAction<RetroPalette>>;
  retroPixelSize: number;
  setRetroPixelSize: Dispatch<SetStateAction<number>>;
  retroDither: number;
  setRetroDither: Dispatch<SetStateAction<number>>;
  retroScanlines: number;
  setRetroScanlines: Dispatch<SetStateAction<number>>;
  waterGlowOn: boolean;
  setWaterGlowOn: Dispatch<SetStateAction<boolean>>;
  waterGlowColor: string;
  setWaterGlowColor: Dispatch<SetStateAction<string>>;
  waterGlowStrength: number;
  setWaterGlowStrength: Dispatch<SetStateAction<number>>;
  waterGlowEveningOnly: boolean;
  setWaterGlowEveningOnly: Dispatch<SetStateAction<boolean>>;
  envDaylightTintOn: boolean;
  setEnvDaylightTintOn: Dispatch<SetStateAction<boolean>>;
  envDaylightTintStrength: number;
  setEnvDaylightTintStrength: Dispatch<SetStateAction<number>>;
  envDayNightAutoOn: boolean;
  setEnvDayNightAutoOn: Dispatch<SetStateAction<boolean>>;
  envSunTintOn: boolean;
  setEnvSunTintOn: Dispatch<SetStateAction<boolean>>;
  snowOn: boolean;
  setSnowOn: Dispatch<SetStateAction<boolean>>;
  snowAmount: number;
  setSnowAmount: Dispatch<SetStateAction<number>>;
  snowIntensity: number;
  setSnowIntensity: Dispatch<SetStateAction<number>>;
  snowCoverOn: boolean;
  setSnowCoverOn: Dispatch<SetStateAction<boolean>>;
  snowCoverStrength: number;
  setSnowCoverStrength: Dispatch<SetStateAction<number>>;
  fireworksOn: boolean;
  setFireworksOn: Dispatch<SetStateAction<boolean>>;
  fireworksIntensity: number;
  setFireworksIntensity: Dispatch<SetStateAction<number>>;
  fireworksRate: number;
  setFireworksRate: Dispatch<SetStateAction<number>>;
  fireworksDistance: number;
  setFireworksDistance: Dispatch<SetStateAction<number>>;
  fireworksLightsOn: boolean;
  setFireworksLightsOn: Dispatch<SetStateAction<boolean>>;
  fireworksLightStrength: number;
  setFireworksLightStrength: Dispatch<SetStateAction<number>>;
  fireworksSoundOn: boolean;
  setFireworksSoundOn: Dispatch<SetStateAction<boolean>>;
  fireworksVolume: number;
  setFireworksVolume: Dispatch<SetStateAction<number>>;
  snowGrayBackdropOn: boolean;
  setSnowGrayBackdropOn: Dispatch<SetStateAction<boolean>>;
  confettiOn: boolean;
  setConfettiOn: Dispatch<SetStateAction<boolean>>;
  confettiAmount: number;
  setConfettiAmount: Dispatch<SetStateAction<number>>;
  confettiIntensity: number;
  setConfettiIntensity: Dispatch<SetStateAction<number>>;
  confettiPalette: ConfettiPalette;
  setConfettiPalette: Dispatch<SetStateAction<ConfettiPalette>>;
  confettiFlutter: number;
  setConfettiFlutter: Dispatch<SetStateAction<number>>;
  neonOn: boolean;
  setNeonOn: Dispatch<SetStateAction<boolean>>;
  neonMode: NeonMode;
  setNeonMode: Dispatch<SetStateAction<NeonMode>>;
  neonPrimary: string;
  setNeonPrimary: Dispatch<SetStateAction<string>>;
  neonSecondary: string;
  setNeonSecondary: Dispatch<SetStateAction<string>>;
  neonTint: string;
  setNeonTint: Dispatch<SetStateAction<string>>;
  neonTintAmount: number;
  setNeonTintAmount: Dispatch<SetStateAction<number>>;
  neonStrength: number;
  setNeonStrength: Dispatch<SetStateAction<number>>;
  neonWidth: number;
  setNeonWidth: Dispatch<SetStateAction<number>>;
  neonFrequency: number;
  setNeonFrequency: Dispatch<SetStateAction<number>>;
  neonAccentColor: string;
  setNeonAccentColor: Dispatch<SetStateAction<string>>;
  auroraOn: boolean;
  setAuroraOn: Dispatch<SetStateAction<boolean>>;
  auroraIntensity: number;
  setAuroraIntensity: Dispatch<SetStateAction<number>>;
  auroraAmount: number;
  setAuroraAmount: Dispatch<SetStateAction<number>>;
  auroraSpeed: number;
  setAuroraSpeed: Dispatch<SetStateAction<number>>;
  auroraHeight: number;
  setAuroraHeight: Dispatch<SetStateAction<number>>;
  auroraPalette: AuroraPalette;
  setAuroraPalette: Dispatch<SetStateAction<AuroraPalette>>;
  auroraColorMain: string;
  setAuroraColorMain: Dispatch<SetStateAction<string>>;
  auroraColorTop: string;
  setAuroraColorTop: Dispatch<SetStateAction<string>>;
  auroraDaylightOn: boolean;
  setAuroraDaylightOn: Dispatch<SetStateAction<boolean>>;
  underwaterFogOn: boolean;
  setUnderwaterFogOn: Dispatch<SetStateAction<boolean>>;
  underwaterFogColor: string;
  setUnderwaterFogColor: Dispatch<SetStateAction<string>>;
  underwaterFogOpacity: number;
  setUnderwaterFogOpacity: Dispatch<SetStateAction<number>>;
  underwaterFogWaterColorAuto: boolean;
  setUnderwaterFogWaterColorAuto: Dispatch<SetStateAction<boolean>>;
  underwaterFogWaterColor: string;
  setUnderwaterFogWaterColor: Dispatch<SetStateAction<string>>;
  underwaterFogWaterOpacity: number;
  setUnderwaterFogWaterOpacity: Dispatch<SetStateAction<number>>;
  underwaterFogIntensity: number;
  setUnderwaterFogIntensity: Dispatch<SetStateAction<number>>;
  underwaterFogSpread: number;
  setUnderwaterFogSpread: Dispatch<SetStateAction<number>>;
  underwaterFogCurve: number;
  setUnderwaterFogCurve: Dispatch<SetStateAction<number>>;
  underwaterFogFeather: number;
  setUnderwaterFogFeather: Dispatch<SetStateAction<number>>;
  underwaterFogDistance: number;
  setUnderwaterFogDistance: Dispatch<SetStateAction<number>>;
  underwaterFogOffset: number;
  setUnderwaterFogOffset: Dispatch<SetStateAction<number>>;
  underwaterFogSubmergedOnly: boolean;
  setUnderwaterFogSubmergedOnly: Dispatch<SetStateAction<boolean>>;
  underwaterFogBlend: UnderwaterFogBlend;
  setUnderwaterFogBlend: Dispatch<SetStateAction<UnderwaterFogBlend>>;
  wakeLock: boolean;
  setWakeLock: Dispatch<SetStateAction<boolean>>;

  // Vatten
  waterColorIdx: number;
  setWaterColorIdx: Dispatch<SetStateAction<number>>;
  surfaces: NamedOption[];
  surfaceId: string | null;
  setSurfaceId: Dispatch<SetStateAction<string | null>>;
  cycleSurface: (dir: number) => void;
  reflStrength: number;
  setReflStrength: Dispatch<SetStateAction<number>>;
  sphereMaterial: boolean;
  setSphereMaterial: Dispatch<SetStateAction<boolean>>;
  waterCloudsOn: boolean;
  setWaterCloudsOn: Dispatch<SetStateAction<boolean>>;
  sphereStrength: number;
  setSphereStrength: Dispatch<SetStateAction<number>>;
  raytracedMaterial: boolean;
  setRaytracedMaterial: Dispatch<SetStateAction<boolean>>;
  raytracedStrength: number;
  setRaytracedStrength: Dispatch<SetStateAction<number>>;
  waterOpacity: number;
  setWaterOpacity: Dispatch<SetStateAction<number>>;
  waterColorAlpha: number;
  setWaterColorAlpha: Dispatch<SetStateAction<number>>;
  waveBgCustomColor: string;
  setWaveBgCustomColor: Dispatch<SetStateAction<string>>;
  waveBgOpacity: number;
  setWaveBgOpacity: Dispatch<SetStateAction<number>>;
  foamAmount: number;
  setFoamAmount: Dispatch<SetStateAction<number>>;
  foamCoverage: number;
  setFoamCoverage: Dispatch<SetStateAction<number>>;
  foamScale: number;
  setFoamScale: Dispatch<SetStateAction<number>>;
  foamColor: string;
  setFoamColor: Dispatch<SetStateAction<string>>;
  detailWaves: number;
  setDetailWaves: Dispatch<SetStateAction<number>>;
  detailScale: number;
  setDetailScale: Dispatch<SetStateAction<number>>;
  waterHue: number;
  setWaterHue: Dispatch<SetStateAction<number>>;
  waterSat: number;
  setWaterSat: Dispatch<SetStateAction<number>>;
  waterBright: number;
  setWaterBright: Dispatch<SetStateAction<number>>;
  surfBright: number;
  setSurfBright: Dispatch<SetStateAction<number>>;
  surfSat: number;
  setSurfSat: Dispatch<SetStateAction<number>>;
  turbidity: number;
  setTurbidity: Dispatch<SetStateAction<number>>;
  bottomIdx: number;
  setBottomIdx: Dispatch<SetStateAction<number>>;
  bottomColor: string;
  setBottomColor: Dispatch<SetStateAction<string>>;
  floorDepth: number;
  setFloorDepth: Dispatch<SetStateAction<number>>;
  floorTexture: boolean;
  setFloorTexture: Dispatch<SetStateAction<boolean>>;
  floorCloudsAnimated: boolean;
  setFloorCloudsAnimated: Dispatch<SetStateAction<boolean>>;
  depthSineOn: boolean;
  setDepthSineOn: Dispatch<SetStateAction<boolean>>;
  depthSineAmp: number;
  setDepthSineAmp: Dispatch<SetStateAction<number>>;
  depthSineFreq: number;
  setDepthSineFreq: Dispatch<SetStateAction<number>>;
  depthSineSpeed: number;
  setDepthSineSpeed: Dispatch<SetStateAction<number>>;
  depthSineInterval: number;
  setDepthSineInterval: Dispatch<SetStateAction<number>>;
  depthSinePeak: number;
  setDepthSinePeak: Dispatch<SetStateAction<number>>;
  depthSineWaveform: DepthSineWaveform;
  setDepthSineWaveform: Dispatch<SetStateAction<DepthSineWaveform>>;
  cycleDepthSineWaveform: (dir: number) => void;
  depthDriftSpeed: number;
  setDepthDriftSpeed: Dispatch<SetStateAction<number>>;
  depthDriftSineOn: boolean;
  setDepthDriftSineOn: Dispatch<SetStateAction<boolean>>;
  depthDriftSineAmp: number;
  setDepthDriftSineAmp: Dispatch<SetStateAction<number>>;
  depthDriftSineSpeed: number;
  setDepthDriftSineSpeed: Dispatch<SetStateAction<number>>;
  depthDriftSinePhase: number;
  setDepthDriftSinePhase: Dispatch<SetStateAction<number>>;
  hideWater: boolean;
  setHideWater: Dispatch<SetStateAction<boolean>>;
  causticsOn: boolean;
  setCausticsOn: Dispatch<SetStateAction<boolean>>;

  // Miljö
  todLabel: string;
  setTimeOfDay: Dispatch<SetStateAction<number>>;
  clockOn: boolean;
  setClockOn: Dispatch<SetStateAction<boolean>>;
  midCloudsOn: boolean;
  setMidCloudsOn: Dispatch<SetStateAction<boolean>>;
  midCloudsHeight: number;
  setMidCloudsHeight: Dispatch<SetStateAction<number>>;
  skyCloudsOn: boolean;
  setSkyCloudsOn: Dispatch<SetStateAction<boolean>>;
  skyCloudsAltitude: number;
  setSkyCloudsAltitude: Dispatch<SetStateAction<number>>;
  bottomClouds3d: boolean;
  setBottomClouds3d: Dispatch<SetStateAction<boolean>>;
  midClouds3d: boolean;
  setMidClouds3d: Dispatch<SetStateAction<boolean>>;
  skyClouds3d: boolean;
  setSkyClouds3d: Dispatch<SetStateAction<boolean>>;
  bottomCloudsScale: number;
  setBottomCloudsScale: Dispatch<SetStateAction<number>>;
  skyCloudsScale: number;
  setSkyCloudsScale: Dispatch<SetStateAction<number>>;
  cloudFadeSpeed: number;
  setCloudFadeSpeed: Dispatch<SetStateAction<number>>;
  skyPuffsOn: boolean;
  setSkyPuffsOn: Dispatch<SetStateAction<boolean>>;
  skyPuffsCount: number;
  setSkyPuffsCount: Dispatch<SetStateAction<number>>;
  skyPuffsSize: number;
  setSkyPuffsSize: Dispatch<SetStateAction<number>>;
  skyPuffsFreq: number;
  setSkyPuffsFreq: Dispatch<SetStateAction<number>>;
  skyPuffsOpacity: number;
  setSkyPuffsOpacity: Dispatch<SetStateAction<number>>;
  worldBoundaryOn: boolean;
  setWorldBoundaryOn: Dispatch<SetStateAction<boolean>>;
  worldBoundarySize: number;
  setWorldBoundarySize: Dispatch<SetStateAction<number>>;
  worldBoundaryHeight: number;
  setWorldBoundaryHeight: Dispatch<SetStateAction<number>>;
  worldBoundaryYExtend: boolean;
  setWorldBoundaryYExtend: Dispatch<SetStateAction<boolean>>;
  waterFullWorld: boolean;
  setWaterFullWorld: Dispatch<SetStateAction<boolean>>;
  surfaceArea: number;
  setSurfaceArea: Dispatch<SetStateAction<number>>;
  torusRingsOn: boolean;
  setTorusRingsOn: Dispatch<SetStateAction<boolean>>;
  torusRadius: number;
  setTorusRadius: Dispatch<SetStateAction<number>>;
  torusTube: number;
  setTorusTube: Dispatch<SetStateAction<number>>;
  torusScale: number;
  setTorusScale: Dispatch<SetStateAction<number>>;
  torusOpacity: number;
  setTorusOpacity: Dispatch<SetStateAction<number>>;
  torusTextureIdx: number;
  setTorusTextureIdx: Dispatch<SetStateAction<number>>;
  torusCellSize: number;
  setTorusCellSize: Dispatch<SetStateAction<number>>;
  torusVerticalSpacing: number;
  setTorusVerticalSpacing: Dispatch<SetStateAction<number>>;
  torusVerticalCount: number;
  setTorusVerticalCount: Dispatch<SetStateAction<number>>;
  torusViewDistance: number;
  setTorusViewDistance: Dispatch<SetStateAction<number>>;
  torusFadeDistance: number;
  setTorusFadeDistance: Dispatch<SetStateAction<number>>;
  // Every installed app's own metadata (public/apps/apps.json) — used only
  // to label scenes/environments/surfaces by which app they shipped with in
  // the ScenerySelectorDialog; apps never restrict which options are
  // selectable elsewhere in this panel.
  apps: { id: string; name: string }[];
  scenes: NamedOption[];
  sceneId: string | null;
  setSceneId: Dispatch<SetStateAction<string | null>>;
  cycleScene: (dir: number) => void;
  // EGNA SCENER (src/lib/userScenes.ts): ids of the scenes in `scenes` that
  // the player imported from their own device, plus import/remove actions.
  userSceneIds: string[];
  userSceneBusy: boolean;
  pickUserSceneFile: () => void;
  deleteUserScene: (id: string) => void;
  spawnLocations: NamedOption[];
  spawnLocationId: string | null;
  setSpawnLocationId: Dispatch<SetStateAction<string | null>>;
  cycleSpawnLocation: (dir: number) => void;
  environments: EnvOption[];
  curEnv: EnvOption | null;
  applyEnv: (id: string | null) => void;
  cycleEnv: (dir: number) => void;
  curEra: EnvEraOption | null;
  applyEra: (id: string) => void;
  cycleEra: (dir: number) => void;
  curTime: EnvTimeOption | null;
  setEnvTime: Dispatch<SetStateAction<string | null>>;
  cycleTime: (dir: number) => void;
  backdropIdx: number;
  setBackdropIdx: Dispatch<SetStateAction<number>>;
  liveMode: boolean;
  setLiveMode: Dispatch<SetStateAction<boolean>>;

  // Ljud
  audioOn: boolean;
  setAudioOn: Dispatch<SetStateAction<boolean>>;
  audioVol: number;
  setAudioVol: Dispatch<SetStateAction<number>>;
  audioSyncSpeed: boolean;
  setAudioSyncSpeed: Dispatch<SetStateAction<boolean>>;
  audioSpatial: boolean;
  setAudioSpatial: Dispatch<SetStateAction<boolean>>;
  waterSoundIdx: number;
  setWaterSoundIdx: Dispatch<SetStateAction<number>>;
  // Built-in WATER_SOUNDS entries plus every installed app's own audio
  // tracks appended after them — see routes/index.tsx's allWaterSounds.
  waterSounds: { id: string; url: string; name?: string }[];

  // Scenery presets (scene + environment/era/time + surface only — see
  // src/lib/sceneryPresets.ts) backing the ScenerySelectorDialog trigger
  // rendered in the header below, alongside SaveLoadMenu.
  savedSceneryPresets: SavedSceneryPreset[];
  appSceneryPresets: AppSceneryPreset[];
  saveSceneryPresetAs: (name: string) => void;
  loadSceneryPreset: (data: SceneryData) => void;
  deleteSceneryPreset: (id: string) => void;
};

// Compact save/load/export/import row for one preset scope ("all", or a
// single settings tab) — rendered once for the whole dialog and once inside
// each tab's own content, each time scoped to just that tab's fields.
function PresetControls({
  scope,
  label,
  savedPresets,
  exportSettingsFile,
  importSettingsFile,
  savePresetAs,
  loadSavedPreset,
  deleteSavedPreset,
}: {
  scope: PresetScope;
  label: string;
  savedPresets: SavedPreset[];
  exportSettingsFile: (scope: PresetScope) => void;
  importSettingsFile: (scope: PresetScope, file: File) => void;
  savePresetAs: (scope: PresetScope, name: string) => void;
  loadSavedPreset: (id: string) => void;
  deleteSavedPreset: (id: string) => void;
}) {
  const { t } = useTranslation();
  const scoped = savedPresets.filter((p) => p.scope === scope);
  const [selected, setSelected] = useState("");
  const [confirmLoadOpen, setConfirmLoadOpen] = useState(false);
  const activeId = scoped.some((p) => p.id === selected) ? selected : "";
  const btnClass =
    "rounded-full border ui-line-1 ui-tint-1 px-2.5 py-0.5 text-[9px] font-light tracking-wider ui-ink-muted transition active:scale-95 ui-press disabled:opacity-30";

  return (
    <div className="mb-2 flex w-full flex-wrap items-center justify-center gap-1.5">
      <span className="text-[9px] font-light tracking-[0.28em] ui-ink-faint">{label}</span>
      <button
        onClick={() => {
          const name = window.prompt(t("presets.savePromptTitle"));
          if (name && name.trim()) savePresetAs(scope, name.trim());
        }}
        className={btnClass}
      >
        {t("presets.save")}
      </button>
      <button onClick={() => exportSettingsFile(scope)} className={btnClass}>
        {t("presets.export")}
      </button>
      <button
        onClick={() => pickJsonFile((file) => importSettingsFile(scope, file))}
        className={btnClass}
      >
        {t("presets.import")}
      </button>
      {scoped.length > 0 && (
        <>
          <select
            value={activeId}
            onChange={(e) => setSelected(e.target.value)}
            className="rounded-full border ui-line-1 ui-surface px-2 py-0.5 text-[9px] ui-ink-muted"
          >
            <option value="" disabled>
              {t("presets.choosePreset")}
            </option>
            {scoped.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            disabled={!activeId}
            onClick={() => activeId && setConfirmLoadOpen(true)}
            className={btnClass}
          >
            {t("presets.load")}
          </button>
          <button
            disabled={!activeId}
            onClick={() => {
              if (activeId && window.confirm(t("presets.deleteConfirm"))) {
                deleteSavedPreset(activeId);
                setSelected("");
              }
            }}
            className={btnClass}
          >
            {t("presets.delete")}
          </button>
          <ConfirmDialog
            open={confirmLoadOpen}
            title={t("presets.loadConfirmTitle")}
            message={t("presets.loadConfirm")}
            confirmLabel={t("presets.load")}
            cancelLabel={t("common.cancel")}
            onCancel={() => setConfirmLoadOpen(false)}
            onConfirm={() => {
              setConfirmLoadOpen(false);
              if (activeId) loadSavedPreset(activeId);
            }}
          />
        </>
      )}
    </div>
  );
}

// Save/load/export/import row for the full live state (settings + player
// position/look + STRÖM/SVAJ direction) — always unscoped, unlike
// PresetControls above, since position/look/current aren't tied to any one
// tab.
function StateControls({
  label,
  savedStates,
  exportStateFile,
  importStateFile,
  saveStateAs,
  loadSavedStateById,
  deleteSavedState,
}: {
  label: string;
  savedStates: SavedState[];
  exportStateFile: () => void;
  importStateFile: (file: File) => void;
  saveStateAs: (name: string) => void;
  loadSavedStateById: (id: string) => void;
  deleteSavedState: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState("");
  const [confirmLoadOpen, setConfirmLoadOpen] = useState(false);
  const activeId = savedStates.some((s) => s.id === selected) ? selected : "";
  const btnClass =
    "rounded-full border ui-line-1 ui-tint-1 px-2.5 py-0.5 text-[9px] font-light tracking-wider ui-ink-muted transition active:scale-95 ui-press disabled:opacity-30";

  return (
    <div className="mb-2 flex w-full flex-wrap items-center justify-center gap-1.5">
      <span className="text-[9px] font-light tracking-[0.28em] ui-ink-faint">{label}</span>
      <button
        onClick={() => {
          const name = window.prompt(t("presets.saveStatePromptTitle"));
          if (name && name.trim()) saveStateAs(name.trim());
        }}
        className={btnClass}
      >
        {t("presets.save")}
      </button>
      <button onClick={() => exportStateFile()} className={btnClass}>
        {t("presets.export")}
      </button>
      <button onClick={() => pickJsonFile((file) => importStateFile(file))} className={btnClass}>
        {t("presets.import")}
      </button>
      {savedStates.length > 0 && (
        <>
          <select
            value={activeId}
            onChange={(e) => setSelected(e.target.value)}
            className="rounded-full border ui-line-1 ui-surface px-2 py-0.5 text-[9px] ui-ink-muted"
          >
            <option value="" disabled>
              {t("presets.chooseState")}
            </option>
            {savedStates.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            disabled={!activeId}
            onClick={() => activeId && setConfirmLoadOpen(true)}
            className={btnClass}
          >
            {t("presets.load")}
          </button>
          <button
            disabled={!activeId}
            onClick={() => {
              if (activeId && window.confirm(t("presets.deleteStateConfirm"))) {
                deleteSavedState(activeId);
                setSelected("");
              }
            }}
            className={btnClass}
          >
            {t("presets.delete")}
          </button>
          <ConfirmDialog
            open={confirmLoadOpen}
            title={t("presets.loadStateConfirmTitle")}
            message={t("presets.loadStateConfirm")}
            confirmLabel={t("presets.load")}
            cancelLabel={t("common.cancel")}
            onCancel={() => setConfirmLoadOpen(false)}
            onConfirm={() => {
              setConfirmLoadOpen(false);
              if (activeId) loadSavedStateById(activeId);
            }}
          />
        </>
      )}
    </div>
  );
}

// Export/import row for everything saved above at once (every named preset
// of every scope, every named state, every scenery preset) as one file.
function LibraryControls({
  exportLibraryFile,
  importLibraryFile,
}: {
  exportLibraryFile: () => void;
  importLibraryFile: (file: File) => void;
}) {
  const { t } = useTranslation();
  const btnClass =
    "rounded-full border ui-line-1 ui-tint-1 px-2.5 py-0.5 text-[9px] font-light tracking-wider ui-ink-muted transition active:scale-95 ui-press disabled:opacity-30";

  return (
    <div className="mb-2 flex w-full flex-wrap items-center justify-center gap-1.5">
      <span className="text-[9px] font-light tracking-[0.28em] ui-ink-faint">
        {t("presets.library")}
      </span>
      <button onClick={() => exportLibraryFile()} className={btnClass}>
        {t("presets.exportAll")}
      </button>
      <button onClick={() => pickJsonFile((file) => importLibraryFile(file))} className={btnClass}>
        {t("presets.import")}
      </button>
    </div>
  );
}

// Optional "Sign in with Spacify" (src/lib/spacify.ts): once signed in, the
// saved presets, states and scenery presets sync to the user's Spacify
// account (use-spacify-sync.ts). Hidden when no OAuth client is configured
// and in the Capacitor app.
function SpacifyControls() {
  const { t } = useTranslation();
  const { session, status, error } = useSpacify();
  const [busy, setBusy] = useState(false);
  if (!isSpacifyAvailable()) return null;
  const btnClass =
    "rounded-full border ui-line-1 ui-tint-1 px-2.5 py-0.5 text-[9px] font-light tracking-wider ui-ink-muted transition active:scale-95 ui-press disabled:opacity-30";

  return (
    <div className="mb-2 flex w-full flex-col items-center gap-1">
      <div className="flex w-full flex-wrap items-center justify-center gap-1.5">
        <span className="text-[9px] font-light tracking-[0.28em] ui-ink-faint">
          {t("spacify.label")}
        </span>
        {session ? (
          <>
            <span
              className="text-[9px] font-light tracking-wider ui-ink-muted"
              title={error ?? undefined}
            >
              {status === "syncing"
                ? t("spacify.syncing")
                : status === "error"
                  ? t("spacify.syncFailed")
                  : status === "synced"
                    ? t("spacify.synced")
                    : t("spacify.signedIn")}
            </span>
            <button
              onClick={() => requestSpacifySync()}
              disabled={status === "syncing"}
              className={btnClass}
            >
              {t("spacify.syncNow")}
            </button>
            <button
              onClick={() => {
                if (window.confirm(t("spacify.signOutConfirm"))) void signOutOfSpacify();
              }}
              className={btnClass}
            >
              {t("spacify.signOut")}
            </button>
          </>
        ) : (
          <button
            onClick={() => {
              setBusy(true);
              signInWithSpacify().catch(() => setBusy(false));
            }}
            disabled={busy}
            className={btnClass}
          >
            {t("spacify.signIn")}
          </button>
        )}
      </div>
      {!session && (
        <p className="max-w-[16rem] text-[9px] font-light leading-snug ui-ink-faint">
          {t("spacify.hint")}
        </p>
      )}
    </div>
  );
}

// DELA BADLÄNK: trigger button for ShareBathDialog (src/components/
// ShareBathDialog.tsx), which turns the live state into a shareable
// /bathing/<base62> URL. The HUD's share shortcut icon (routes/index.tsx)
// opens the same dialog from its own button.
function ShareBathLink({
  buildBathLink,
}: {
  buildBathLink: (title: string, description: string) => Promise<string>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const btnClass =
    "rounded-full border ui-line-1 ui-tint-1 px-2.5 py-0.5 text-[9px] font-light tracking-wider ui-ink-muted transition active:scale-95 ui-press disabled:opacity-30";

  return (
    <div className="mb-2 flex w-full flex-wrap items-center justify-center gap-1.5">
      <button onClick={() => setOpen(true)} className={btnClass}>
        {t("presets.shareBathLink")}
      </button>
      <ShareBathDialog open={open} onClose={() => setOpen(false)} buildBathLink={buildBathLink} />
    </div>
  );
}

export function SettingsPanel(props: SettingsPanelProps) {
  const {
    restoreCameraPosition,
    resetToDefaults,
    savedPresets,
    exportSettingsFile,
    importSettingsFile,
    savePresetAs,
    loadSavedPreset,
    deleteSavedPreset,
    savedStates,
    exportStateFile,
    importStateFile,
    saveStateAs,
    loadSavedStateById,
    deleteSavedState,
    exportLibraryFile,
    importLibraryFile,
    apps,
    savedSceneryPresets,
    appSceneryPresets,
    saveSceneryPresetAs,
    loadSceneryPreset,
    deleteSceneryPreset,
    buildBathLink,
    waveAmp,
    setWaveAmp,
    waveSpeed,
    setWaveSpeed,
    waveFreq,
    setWaveFreq,
    heightOffset,
    setHeightOffset,
    submergeAmp,
    setSubmergeAmp,
    floatLift,
    setFloatLift,
    waveAnticipation,
    setWaveAnticipation,
    driftWorldRef,
    driftDisplayRef,
    setDriftStick,
    swayWorldRef,
    swayDisplayRef,
    setSwayStick,
    setStickBearing,
    swayAmp,
    setSwayAmp,
    swaySpeed,
    setSwaySpeed,
    swayBias,
    setSwayBias,
    surgeWorldRef,
    setSurgeBearing,
    surgeAmp,
    setSurgeAmp,
    surgeSpeed,
    setSurgeSpeed,
    surgeRotationMode,
    setSurgeRotationMode,
    surgeRotationSpeed,
    setSurgeRotationSpeed,
    openDriftOn,
    setOpenDriftOn,
    openDriftCurve,
    setOpenDriftCurve,
    openDriftRadius,
    setOpenDriftRadius,
    openDriftCycleSpeed,
    setOpenDriftCycleSpeed,
    openDriftMagnitude,
    setOpenDriftMagnitude,
    openDriftDirection,
    setOpenDriftDirection,
    buoyAmp,
    setBuoyAmp,
    bobSpeed,
    setBobSpeed,
    regularWaves,
    setRegularWaves,
    realisticWaves,
    setRealisticWaves,
    dyingWave,
    setDyingWave,
    dyingWaveAmp,
    setDyingWaveAmp,
    dyingWaveSpeed,
    setDyingWaveSpeed,
    randomizeWaves,
    setRandomizeWaves,
    wavePreset,
    applyWavePreset,
    regularCross,
    setRegularCross,
    standingWaves,
    setStandingWaves,
    sloshWaves,
    setSloshWaves,
    regularPeriod,
    setRegularPeriod,
    wavePeak,
    setWavePeak,
    trochoid,
    setTrochoid,
    heaveSkew,
    setHeaveSkew,
    waveHighQuality,
    setWaveHighQuality,
    waveDir,
    setWaveDir,
    cameraMode,
    setCameraMode,
    cycleCameraMode,
    noclipSpeed,
    setNoclipSpeed,
    noclipFallRiseSpeed,
    setNoclipFallRiseSpeed,
    noclipVertEaseTime,
    setNoclipVertEaseTime,
    bodyflightAirflow,
    setBodyflightAirflow,
    bodyflightGravity,
    setBodyflightGravity,
    bodyflightHoverHeight,
    setBodyflightHoverHeight,
    noclipAutoAlternateOn,
    setNoclipAutoAlternateOn,
    noclipAutoAlternateInterval,
    setNoclipAutoAlternateInterval,
    swingPositionY,
    setSwingPositionY,
    swingIntensity,
    setSwingIntensity,
    swingSpeed,
    setSwingSpeed,
    swingXFactor,
    setSwingXFactor,
    swingHeight,
    setSwingHeight,
    swingKeepSpeed,
    setSwingKeepSpeedOn,
    swingPreset,
    applySwingPreset,
    cycleSwingPreset,
    swingYWaveform,
    setSwingYWaveform,
    cycleSwingYWaveform,
    swingHook,
    setSwingHook,
    sceneHooks,
    swingCordColor,
    setSwingCordColor,
    swingCordThickness,
    setSwingCordThickness,
    swingCordSoftness,
    setSwingCordSoftness,
    freakOutOn,
    setFreakOutOn,
    freakOutSwingAxis,
    setFreakOutSwingAxis,
    freakOutSwingAngle,
    setFreakOutSwingAngle,
    freakOutSwingSpeed,
    setFreakOutSwingSpeed,
    freakOutSwingLength,
    setFreakOutSwingLength,
    freakOutRingRadius,
    setFreakOutRingRadius,
    freakOutRotationOn,
    setFreakOutRotationOn,
    freakOutRotationAxis,
    setFreakOutRotationAxis,
    freakOutRotationSpeed,
    setFreakOutRotationSpeed,
    freakOutRotationPeakSpeed,
    setFreakOutRotationPeakSpeed,
    freakOutRotationRecovery,
    setFreakOutRotationRecovery,
    freakOutRotationOscillate,
    setFreakOutRotationOscillate,
    freakOutRotationOscillateSpeed,
    setFreakOutRotationOscillateSpeed,
    freakOutRotationOscillateEveryOther,
    setFreakOutRotationOscillateEveryOther,
    freakOutRotationKickOn,
    setFreakOutRotationKickOn,
    freakOutRotationKick,
    setFreakOutRotationKick,
    freakOutFloatYOffset,
    setFreakOutFloatYOffset,
    freakOutOverlayOn,
    setFreakOutOverlayOn,
    freakOutRotationDirection,
    setFreakOutRotationDirection,
    freakOutViewFixedHeading,
    setFreakOutViewFixedHeading,
    freakOutShowArm,
    setFreakOutShowArm,
    freakOutShowFrame,
    setFreakOutShowFrame,
    freakOutShowTopRing,
    setFreakOutShowTopRing,
    freakOutShowHub,
    setFreakOutShowHub,
    freakOutRingLevel,
    setFreakOutRingLevel,
    freakOutSeatsOn,
    setFreakOutSeatsOn,
    freakOutSeatCount,
    setFreakOutSeatCount,
    freakOutCameraSeat,
    setFreakOutCameraSeat,
    freakOutSeatPostLength,
    setFreakOutSeatPostLength,
    freakOutSeatColor,
    setFreakOutSeatColor,
    freakOutRingColor,
    setFreakOutRingColor,
    freakOutPostColor,
    setFreakOutPostColor,
    freakOutArmColor,
    setFreakOutArmColor,
    freakOutFrameColor,
    setFreakOutFrameColor,
    tornadoOn,
    setTornadoOn,
    tornadoRadius,
    setTornadoRadius,
    tornadoSpeed,
    setTornadoSpeed,
    tornadoDirection,
    setTornadoDirection,
    tornadoOpening,
    setTornadoOpening,
    tornadoFollowCenter,
    setTornadoFollowCenter,
    tornadoCloudOn,
    setTornadoCloudOn,
    tornadoCloudYOffset,
    setTornadoCloudYOffset,
    tornadoSequenceOn,
    setTornadoSequenceOn,
    tornadoSequenceDragSpeed,
    setTornadoSequenceDragSpeed,
    tornadoSequenceDragDuration,
    setTornadoSequenceDragDuration,
    tornadoSequenceStayDuration,
    setTornadoSequenceStayDuration,
    tornadoSequenceExitMode,
    setTornadoSequenceExitMode,
    tornadoSequenceExitSpeed,
    setTornadoSequenceExitSpeed,
    tornadoSequenceLiftHeight,
    setTornadoSequenceLiftHeight,
    tornadoSequencePauseDuration,
    setTornadoSequencePauseDuration,
    intervalSessionOn,
    setIntervalSessionOn,
    intervalDuration,
    setIntervalDuration,
    intervalSessionType,
    setIntervalSessionType,
    intervalCount,
    setIntervalCount,
    intervalShowStats,
    setIntervalShowStats,
    intervalIncludeFloat,
    setIntervalIncludeFloat,
    intervalIncludeSwing,
    setIntervalIncludeSwing,
    camOffX,
    setCamOffX,
    camOffY,
    setCamOffY,
    camOffZ,
    setCamOffZ,
    camFov,
    setCamFov,
    camNear,
    setCamNear,
    camFar,
    setCamFar,
    leanEnabled,
    setLeanEnabled,
    gogglesOn,
    setGogglesOn,
    gogglesBlur,
    setGogglesBlur,
    gogglesLoop,
    setGogglesLoop,
    gogglesIntensity,
    setGogglesIntensity,
    gogglesFpsCap,
    setGogglesFpsCap,
    hoodOn,
    setHoodOn,
    hoodHeight,
    setHoodHeight,
    hoodOpening,
    setHoodOpening,
    hoodColor,
    setHoodColor,
    hoodMetallic,
    setHoodMetallic,
    hoodMotion,
    setHoodMotion,
    hoodLowerOn,
    setHoodLowerOn,
    hoodLowerHeight,
    setHoodLowerHeight,
    hoodZipperOn,
    setHoodZipperOn,
    hoodWaterOn,
    setHoodWaterOn,
    hoodWaterLevel,
    setHoodWaterLevel,
    hoodOpeningWidth,
    setHoodOpeningWidth,
    hoodDrop,
    setHoodDrop,
    hoodWeight,
    setHoodWeight,
    hoodWrinkles,
    setHoodWrinkles,
    hoodDarkness,
    setHoodDarkness,
    hoodRoundness,
    setHoodRoundness,
    hoodStyle,
    setHoodStyle,
    hoodPuffSize,
    setHoodPuffSize,
    hoodPuffHeight,
    setHoodPuffHeight,
    hoodCuffOn,
    setHoodCuffOn,
    hoodCuffHeight,
    setHoodCuffHeight,
    hoodCuffSize,
    hoodCuffCustom,
    hoodCuffColor,
    hoodCuffMetallic,
    hoodCuffMaterial,
    hoodHanging,
    hoodWaterCalm,
    hoodCuffTop,
    hoodZipperFixed,
    hoodZipperPullOut,
    hoodReflectLight,
    hoodPuffThickness,
    hoodPuffInflate,
    setHoodCuffSize,
    setHoodCuffCustom,
    setHoodCuffColor,
    setHoodCuffMetallic,
    setHoodCuffMaterial,
    setHoodHanging,
    setHoodWaterCalm,
    setHoodCuffTop,
    setHoodZipperFixed,
    setHoodZipperPullOut,
    setHoodReflectLight,
    setHoodPuffThickness,
    setHoodPuffInflate,
    hoodExtraLayers,
    setHoodExtraLayers,
    targetFps,
    setTargetFps,
    resolutionScale,
    setResolutionScale,
    lowGraphicsMode,
    setLowGraphicsMode,
    chromaticAberrationOn,
    setChromaticAberrationOn,
    chromaticAberrationAmount,
    setChromaticAberrationAmount,
    betterLightingOn,
    setBetterLightingOn,
    lightingReflStrength,
    setLightingReflStrength,
    shadowsOn,
    setShadowsOn,
    retroOn,
    setRetroOn,
    retroPalette,
    setRetroPalette,
    retroPixelSize,
    setRetroPixelSize,
    retroDither,
    setRetroDither,
    retroScanlines,
    setRetroScanlines,
    waterGlowOn,
    setWaterGlowOn,
    waterGlowColor,
    setWaterGlowColor,
    waterGlowStrength,
    setWaterGlowStrength,
    waterGlowEveningOnly,
    setWaterGlowEveningOnly,
    envDaylightTintOn,
    setEnvDaylightTintOn,
    envDaylightTintStrength,
    setEnvDaylightTintStrength,
    envDayNightAutoOn,
    setEnvDayNightAutoOn,
    envSunTintOn,
    setEnvSunTintOn,
    snowOn,
    setSnowOn,
    snowAmount,
    setSnowAmount,
    snowIntensity,
    setSnowIntensity,
    snowCoverOn,
    setSnowCoverOn,
    snowCoverStrength,
    setSnowCoverStrength,
    fireworksOn,
    setFireworksOn,
    fireworksIntensity,
    setFireworksIntensity,
    fireworksRate,
    setFireworksRate,
    fireworksDistance,
    setFireworksDistance,
    fireworksLightsOn,
    setFireworksLightsOn,
    fireworksLightStrength,
    setFireworksLightStrength,
    fireworksSoundOn,
    setFireworksSoundOn,
    fireworksVolume,
    setFireworksVolume,
    snowGrayBackdropOn,
    setSnowGrayBackdropOn,
    confettiOn,
    setConfettiOn,
    confettiAmount,
    setConfettiAmount,
    confettiIntensity,
    setConfettiIntensity,
    confettiPalette,
    setConfettiPalette,
    confettiFlutter,
    setConfettiFlutter,
    neonOn,
    setNeonOn,
    neonMode,
    setNeonMode,
    neonPrimary,
    setNeonPrimary,
    neonSecondary,
    setNeonSecondary,
    neonTint,
    setNeonTint,
    neonTintAmount,
    setNeonTintAmount,
    neonStrength,
    setNeonStrength,
    neonWidth,
    setNeonWidth,
    neonFrequency,
    setNeonFrequency,
    neonAccentColor,
    setNeonAccentColor,
    auroraOn,
    setAuroraOn,
    auroraIntensity,
    setAuroraIntensity,
    auroraAmount,
    setAuroraAmount,
    auroraSpeed,
    setAuroraSpeed,
    auroraHeight,
    setAuroraHeight,
    auroraPalette,
    setAuroraPalette,
    auroraColorMain,
    setAuroraColorMain,
    auroraColorTop,
    setAuroraColorTop,
    auroraDaylightOn,
    setAuroraDaylightOn,
    underwaterFogOn,
    setUnderwaterFogOn,
    underwaterFogColor,
    setUnderwaterFogColor,
    underwaterFogOpacity,
    setUnderwaterFogOpacity,
    underwaterFogWaterColorAuto,
    setUnderwaterFogWaterColorAuto,
    underwaterFogWaterColor,
    setUnderwaterFogWaterColor,
    underwaterFogWaterOpacity,
    setUnderwaterFogWaterOpacity,
    underwaterFogIntensity,
    setUnderwaterFogIntensity,
    underwaterFogSpread,
    setUnderwaterFogSpread,
    underwaterFogCurve,
    setUnderwaterFogCurve,
    underwaterFogFeather,
    setUnderwaterFogFeather,
    underwaterFogDistance,
    setUnderwaterFogDistance,
    underwaterFogOffset,
    setUnderwaterFogOffset,
    underwaterFogSubmergedOnly,
    setUnderwaterFogSubmergedOnly,
    underwaterFogBlend,
    setUnderwaterFogBlend,
    wakeLock,
    setWakeLock,
    waterColorIdx,
    setWaterColorIdx,
    waterColorAlpha,
    setWaterColorAlpha,
    waveBgCustomColor,
    setWaveBgCustomColor,
    waveBgOpacity,
    setWaveBgOpacity,
    foamAmount,
    setFoamAmount,
    foamCoverage,
    setFoamCoverage,
    foamScale,
    setFoamScale,
    foamColor,
    setFoamColor,
    detailWaves,
    setDetailWaves,
    detailScale,
    setDetailScale,
    surfaces,
    surfaceId,
    setSurfaceId,
    cycleSurface,
    reflStrength,
    setReflStrength,
    sphereMaterial,
    setSphereMaterial,
    waterCloudsOn,
    setWaterCloudsOn,
    sphereStrength,
    setSphereStrength,
    raytracedMaterial,
    setRaytracedMaterial,
    raytracedStrength,
    setRaytracedStrength,
    waterOpacity,
    setWaterOpacity,
    waterHue,
    setWaterHue,
    waterSat,
    setWaterSat,
    waterBright,
    setWaterBright,
    surfBright,
    setSurfBright,
    surfSat,
    setSurfSat,
    turbidity,
    setTurbidity,
    bottomIdx,
    setBottomIdx,
    bottomColor,
    setBottomColor,
    floorDepth,
    setFloorDepth,
    floorTexture,
    setFloorTexture,
    floorCloudsAnimated,
    setFloorCloudsAnimated,
    depthSineOn,
    setDepthSineOn,
    depthSineAmp,
    setDepthSineAmp,
    depthSineFreq,
    setDepthSineFreq,
    depthSineSpeed,
    setDepthSineSpeed,
    depthSineInterval,
    setDepthSineInterval,
    depthSinePeak,
    setDepthSinePeak,
    depthSineWaveform,
    setDepthSineWaveform,
    cycleDepthSineWaveform,
    depthDriftSpeed,
    setDepthDriftSpeed,
    depthDriftSineOn,
    setDepthDriftSineOn,
    depthDriftSineAmp,
    setDepthDriftSineAmp,
    depthDriftSineSpeed,
    setDepthDriftSineSpeed,
    depthDriftSinePhase,
    setDepthDriftSinePhase,
    hideWater,
    setHideWater,
    causticsOn,
    setCausticsOn,
    todLabel,
    setTimeOfDay,
    clockOn,
    setClockOn,
    midCloudsOn,
    setMidCloudsOn,
    midCloudsHeight,
    setMidCloudsHeight,
    skyCloudsOn,
    setSkyCloudsOn,
    skyCloudsAltitude,
    setSkyCloudsAltitude,
    bottomClouds3d,
    setBottomClouds3d,
    midClouds3d,
    setMidClouds3d,
    skyClouds3d,
    setSkyClouds3d,
    bottomCloudsScale,
    setBottomCloudsScale,
    skyCloudsScale,
    setSkyCloudsScale,
    cloudFadeSpeed,
    setCloudFadeSpeed,
    skyPuffsOn,
    setSkyPuffsOn,
    skyPuffsCount,
    setSkyPuffsCount,
    skyPuffsSize,
    setSkyPuffsSize,
    skyPuffsFreq,
    setSkyPuffsFreq,
    skyPuffsOpacity,
    setSkyPuffsOpacity,
    worldBoundaryOn,
    setWorldBoundaryOn,
    worldBoundarySize,
    setWorldBoundarySize,
    worldBoundaryHeight,
    setWorldBoundaryHeight,
    worldBoundaryYExtend,
    setWorldBoundaryYExtend,
    waterFullWorld,
    setWaterFullWorld,
    surfaceArea,
    setSurfaceArea,
    torusRingsOn,
    setTorusRingsOn,
    torusRadius,
    setTorusRadius,
    torusTube,
    setTorusTube,
    torusScale,
    setTorusScale,
    torusOpacity,
    setTorusOpacity,
    torusTextureIdx,
    setTorusTextureIdx,
    torusCellSize,
    setTorusCellSize,
    torusVerticalSpacing,
    setTorusVerticalSpacing,
    torusVerticalCount,
    setTorusVerticalCount,
    torusViewDistance,
    setTorusViewDistance,
    torusFadeDistance,
    setTorusFadeDistance,
    scenes,
    sceneId,
    setSceneId,
    cycleScene,
    userSceneIds,
    userSceneBusy,
    pickUserSceneFile,
    deleteUserScene,
    spawnLocations,
    spawnLocationId,
    setSpawnLocationId,
    cycleSpawnLocation,
    environments,
    curEnv,
    applyEnv,
    cycleEnv,
    curEra,
    applyEra,
    cycleEra,
    curTime,
    setEnvTime,
    cycleTime,
    backdropIdx,
    setBackdropIdx,
    liveMode,
    setLiveMode,
    audioOn,
    setAudioOn,
    audioVol,
    setAudioVol,
    audioSyncSpeed,
    setAudioSyncSpeed,
    audioSpatial,
    setAudioSpatial,
    waterSoundIdx,
    setWaterSoundIdx,
    waterSounds,
  } = props;

  const { t } = useTranslation();
  const onOff = (v: boolean) => (v ? t("common.on") : t("common.off"));
  // EXTREME (src/lib/extremeLimits.ts): while it's off the strength/size
  // dials top out at ~25 % of their extreme max.
  const [extremeLimits, setExtremeLimits] = useExtremeLimits();
  const mx = (control: LimitedControl) => limitMax(control, extremeLimits);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  // GRUPPERADE INSTÄLLNINGAR (components/settingsNav.tsx): every dial below
  // sits in a <G id="…"> naming its settings group. SettingsNavigator renders
  // this one tree per visible scope — a group's sub view from the home list,
  // a page of the tabs carousel, or one section of the search results — and
  // each <G> only shows its dials in its own group's scope. What used to be
  // the bar above the tabs (save/load, scenery, share, restore, reset) is the
  // "state" group now; language and about moved to "app".
  const sectionTitle = (text: string) => (
    <div className="pt-4 pb-1 text-[10px] font-light tracking-[0.28em] ui-ink-muted">{text}</div>
  );
  const pillClass =
    "rounded-full border ui-line-2 ui-tint-1 px-3 py-1 text-[9px] font-light tracking-wider ui-ink transition active:scale-95 ui-press";
  const body = (
    <>
      <G id="state">
        <Findable
          label={`${t("settings.saveMenuTitle")} ${t("presets.all")} ${t("presets.state")}`}
        >
          {sectionTitle(t("settings.saveMenuTitle"))}
          <PresetControls
            scope="all"
            label={t("presets.all")}
            savedPresets={savedPresets}
            exportSettingsFile={exportSettingsFile}
            importSettingsFile={importSettingsFile}
            savePresetAs={savePresetAs}
            loadSavedPreset={loadSavedPreset}
            deleteSavedPreset={deleteSavedPreset}
          />
          <StateControls
            label={t("presets.state")}
            savedStates={savedStates}
            exportStateFile={exportStateFile}
            importStateFile={importStateFile}
            saveStateAs={saveStateAs}
            loadSavedStateById={loadSavedStateById}
            deleteSavedState={deleteSavedState}
          />
          <LibraryControls
            exportLibraryFile={exportLibraryFile}
            importLibraryFile={importLibraryFile}
          />
          <SpacifyControls />
        </Findable>
        <Findable label={`${t("settings.sceneryTitle")} ${t("sceneryPresets.buttonTitle")}`}>
          {sectionTitle(t("settings.sceneryTitle"))}
          <div className="mb-2 flex w-full items-center justify-center gap-2">
            <ScenerySelectorButton
              apps={apps}
              scenes={scenes}
              sceneId={sceneId}
              setSceneId={setSceneId}
              cycleScene={cycleScene}
              environments={environments}
              curEnv={curEnv}
              curEra={curEra}
              curTime={curTime}
              applyEnv={applyEnv}
              applyEra={applyEra}
              setEnvTime={setEnvTime}
              cycleEnv={cycleEnv}
              cycleEra={cycleEra}
              cycleTime={cycleTime}
              surfaces={surfaces}
              surfaceId={surfaceId}
              setSurfaceId={setSurfaceId}
              cycleSurface={cycleSurface}
              savedSceneryPresets={savedSceneryPresets}
              appSceneryPresets={appSceneryPresets}
              saveSceneryPresetAs={saveSceneryPresetAs}
              loadSceneryPreset={loadSceneryPreset}
              deleteSceneryPreset={deleteSceneryPreset}
            />
            <span className="text-[9px] font-light tracking-[0.28em] ui-ink-faint">
              {t("sceneryPresets.buttonTitle")}
            </span>
          </div>
        </Findable>
        <Findable
          label={`${t("presets.shareBathLink")} ${t("settings.restore")} ${t("settings.reset")}`}
        >
          {sectionTitle(t("settings.shareAndResetTitle"))}
          <ShareBathLink buildBathLink={buildBathLink} />
          <div className="mb-2 flex w-full flex-wrap items-center justify-center gap-1.5">
            <button
              onClick={restoreCameraPosition}
              className={pillClass}
              aria-label={t("settings.restoreAriaLabel")}
              title={t("settings.restoreTitle")}
            >
              {t("settings.restore")}
            </button>
            <button
              onClick={() => setConfirmResetOpen(true)}
              className={pillClass}
              aria-label={t("settings.resetAriaLabel")}
              title={t("settings.resetTitle")}
            >
              {t("settings.reset")}
            </button>
            <ConfirmDialog
              open={confirmResetOpen}
              title={t("settings.resetConfirmTitle")}
              message={t("settings.resetConfirm")}
              confirmLabel={t("settings.reset")}
              cancelLabel={t("common.cancel")}
              onCancel={() => setConfirmResetOpen(false)}
              onConfirm={() => {
                setConfirmResetOpen(false);
                resetToDefaults();
              }}
            />
          </div>
        </Findable>
        {sectionTitle(t("settings.presetsPerGroupTitle"))}
      </G>
      <G id="app">
        <Findable label={`${t("settings.languageTitle")} ${t("about.navLabel")}`}>
          <div className="flex w-full flex-wrap items-center justify-center gap-2 py-3">
            <LanguageSwitcher />
            <Link to="/about" className={pillClass}>
              {t("about.navLabel")}
            </Link>
          </div>
        </Findable>
      </G>
      {/* ── vagor ── */}
      <G id="state">
        <PresetControls
          scope="vagor"
          label={t("presets.scope.vagor")}
          savedPresets={savedPresets}
          exportSettingsFile={exportSettingsFile}
          importSettingsFile={importSettingsFile}
          savePresetAs={savePresetAs}
          loadSavedPreset={loadSavedPreset}
          deleteSavedPreset={deleteSavedPreset}
        />
      </G>
      <G id="waves">
        <SettingRow
          label={t("dial.wave.amp")}
          mode="number"
          value={`${waveAmp.toFixed(2)}m`}
          rawValue={waveAmp}
          onSet={setWaveAmp}
          min={0}
          max={mx("waveAmp")}
          step={0.5}
          onDec={() => setWaveAmp((v) => Math.max(0, +(v - 0.5).toFixed(2)))}
          onInc={() => setWaveAmp((v) => Math.min(mx("waveAmp"), +(v + 0.5).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.wave.speed")}
          mode="number"
          value={`${waveSpeed.toFixed(2)}×`}
          rawValue={waveSpeed}
          onSet={setWaveSpeed}
          min={0}
          max={10}
          step={0.1}
          onDec={() => setWaveSpeed((v) => Math.max(0, +(v - 0.1).toFixed(2)))}
          onInc={() => setWaveSpeed((v) => Math.min(10, +(v + 0.1).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.wave.freq")}
          mode="number"
          value={`${waveFreq.toFixed(2)}×`}
          rawValue={waveFreq}
          onSet={(v) => setWaveFreq(v)}
          min={WAVE_FREQ_MIN}
          max={WAVE_FREQ_MAX}
          step={0.05}
          onDec={() => setWaveFreq((v) => Math.max(WAVE_FREQ_MIN, +(v - 0.05).toFixed(2)))}
          onInc={() => setWaveFreq((v) => Math.min(WAVE_FREQ_MAX, +(v + 0.05).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.wave.height")}
          mode="number"
          value={`${heightOffset >= 0 ? "+" : ""}${heightOffset.toFixed(2)}m`}
          rawValue={heightOffset}
          onSet={setHeightOffset}
          min={-5}
          max={5}
          step={0.2}
          onDec={() => setHeightOffset((v) => Math.max(-5, +(v - 0.2).toFixed(2)))}
          onInc={() => setHeightOffset((v) => Math.min(5, +(v + 0.2).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.wave.dive")}
          mode="number"
          value={`${submergeAmp.toFixed(2)}×`}
          rawValue={submergeAmp}
          onSet={setSubmergeAmp}
          min={0}
          max={4}
          step={0.1}
          onDec={() => setSubmergeAmp((v) => Math.max(0, +(v - 0.1).toFixed(2)))}
          onInc={() => setSubmergeAmp((v) => Math.min(4, +(v + 0.1).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.wave.floatLift")}
          mode="number"
          value={`${floatLift.toFixed(2)}×`}
          rawValue={floatLift}
          onSet={setFloatLift}
          min={0}
          max={4}
          step={0.1}
          onDec={() => setFloatLift((v) => Math.max(0, +(v - 0.1).toFixed(2)))}
          onInc={() => setFloatLift((v) => Math.min(4, +(v + 0.1).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.wave.anticipation")}
          mode="number"
          value={`${waveAnticipation.toFixed(2)}×`}
          rawValue={waveAnticipation}
          onSet={setWaveAnticipation}
          min={0}
          max={2}
          step={0.1}
          onDec={() => setWaveAnticipation((v) => Math.max(0, +(v - 0.1).toFixed(2)))}
          onInc={() => setWaveAnticipation((v) => Math.min(2, +(v + 0.1).toFixed(2)))}
        />
      </G>
      <G id="drift">
        <SettingRow
          label={t("dial.wave.currentDirection")}
          mode="number"
          value={`${Math.round(worldXZBearing(driftWorldRef.current.x, driftWorldRef.current.z))}°`}
          rawValue={worldXZBearing(driftWorldRef.current.x, driftWorldRef.current.z)}
          onSet={(v) => setStickBearing(driftWorldRef, driftDisplayRef, setDriftStick, v)}
          min={0}
          max={360}
          step={5}
          onDec={() =>
            setStickBearing(
              driftWorldRef,
              driftDisplayRef,
              setDriftStick,
              worldXZBearing(driftWorldRef.current.x, driftWorldRef.current.z) - 15,
            )
          }
          onInc={() =>
            setStickBearing(
              driftWorldRef,
              driftDisplayRef,
              setDriftStick,
              worldXZBearing(driftWorldRef.current.x, driftWorldRef.current.z) + 15,
            )
          }
        />
        <SettingRow
          label={t("dial.wave.sway")}
          mode="number"
          value={`${swayAmp.toFixed(1)}m`}
          rawValue={swayAmp}
          onSet={setSwayAmp}
          min={0}
          max={mx("swayAmp")}
          step={0.5}
          onDec={() => setSwayAmp((v) => Math.max(0, +(v - 0.5).toFixed(2)))}
          onInc={() => setSwayAmp((v) => Math.min(mx("swayAmp"), +(v + 0.5).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.wave.swaySpeed")}
          mode="number"
          value={`${swaySpeed.toFixed(2)}×`}
          rawValue={swaySpeed}
          onSet={setSwaySpeed}
          min={0.01}
          max={10}
          step={0.01}
          onDec={() => setSwaySpeed((v) => Math.max(0.01, +(v - 0.01).toFixed(2)))}
          onInc={() => setSwaySpeed((v) => Math.min(1, +(v + 0.01).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.wave.swayDrift")}
          mode="number"
          value={
            swayBias === 0
              ? t("common.neutral")
              : swayBias > 0
                ? `${t("common.with")} ${swayBias.toFixed(2)}`
                : `${t("common.against")} ${Math.abs(swayBias).toFixed(2)}`
          }
          rawValue={swayBias}
          onSet={setSwayBias}
          min={-10}
          max={10}
          step={0.05}
          onDec={() => setSwayBias((v) => Math.max(-1, +(v - 0.05).toFixed(2)))}
          onInc={() => setSwayBias((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.wave.swayDirection")}
          mode="number"
          value={`${Math.round(worldXZBearing(swayWorldRef.current.x, swayWorldRef.current.z))}°`}
          rawValue={worldXZBearing(swayWorldRef.current.x, swayWorldRef.current.z)}
          onSet={(v) => setStickBearing(swayWorldRef, swayDisplayRef, setSwayStick, v)}
          min={0}
          max={360}
          step={5}
          onDec={() =>
            setStickBearing(
              swayWorldRef,
              swayDisplayRef,
              setSwayStick,
              worldXZBearing(swayWorldRef.current.x, swayWorldRef.current.z) - 15,
            )
          }
          onInc={() =>
            setStickBearing(
              swayWorldRef,
              swayDisplayRef,
              setSwayStick,
              worldXZBearing(swayWorldRef.current.x, swayWorldRef.current.z) + 15,
            )
          }
        />
        <SettingRow
          label={t("dial.wave.surge")}
          mode="number"
          value={`${surgeAmp.toFixed(1)}m`}
          rawValue={surgeAmp}
          onSet={setSurgeAmp}
          min={0}
          max={mx("surgeAmp")}
          step={0.5}
          onDec={() => setSurgeAmp((v) => Math.max(0, +(v - 0.5).toFixed(2)))}
          onInc={() => setSurgeAmp((v) => Math.min(mx("surgeAmp"), +(v + 0.5).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.wave.surgeSpeed")}
          mode="number"
          value={`${surgeSpeed.toFixed(2)}×`}
          rawValue={surgeSpeed}
          onSet={setSurgeSpeed}
          min={0.01}
          max={10}
          step={0.01}
          onDec={() => setSurgeSpeed((v) => Math.max(0.01, +(v - 0.01).toFixed(2)))}
          onInc={() => setSurgeSpeed((v) => Math.min(1, +(v + 0.01).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.wave.surgeDirection")}
          mode="number"
          value={`${Math.round(worldXZBearing(surgeWorldRef.current.x, surgeWorldRef.current.z))}°`}
          rawValue={worldXZBearing(surgeWorldRef.current.x, surgeWorldRef.current.z)}
          onSet={setSurgeBearing}
          min={0}
          max={360}
          step={5}
          onDec={() =>
            setSurgeBearing(worldXZBearing(surgeWorldRef.current.x, surgeWorldRef.current.z) - 15)
          }
          onInc={() =>
            setSurgeBearing(worldXZBearing(surgeWorldRef.current.x, surgeWorldRef.current.z) + 15)
          }
        />
        <SettingRow
          label={t("dial.wave.surgeRotationMode")}
          value={t(SURGE_ROTATION_MODE_LABEL_KEYS[surgeRotationMode])}
          options={SURGE_ROTATION_MODES.map((m) => t(SURGE_ROTATION_MODE_LABEL_KEYS[m]))}
          selectedIndex={SURGE_ROTATION_MODES.indexOf(surgeRotationMode)}
          onSelectIndex={(i) => setSurgeRotationMode(SURGE_ROTATION_MODES[i])}
          onDec={() =>
            setSurgeRotationMode(
              SURGE_ROTATION_MODES[
                (SURGE_ROTATION_MODES.indexOf(surgeRotationMode) -
                  1 +
                  SURGE_ROTATION_MODES.length) %
                  SURGE_ROTATION_MODES.length
              ],
            )
          }
          onInc={() =>
            setSurgeRotationMode(
              SURGE_ROTATION_MODES[
                (SURGE_ROTATION_MODES.indexOf(surgeRotationMode) + 1) % SURGE_ROTATION_MODES.length
              ],
            )
          }
        />
        <SettingRow
          label={t("dial.wave.surgeRotationSpeed")}
          mode="number"
          value={`${surgeRotationSpeed.toFixed(1)}°/s`}
          rawValue={surgeRotationSpeed}
          onSet={setSurgeRotationSpeed}
          min={0}
          max={30}
          step={0.5}
          onDec={() => setSurgeRotationSpeed((v) => Math.max(0, +(v - 0.5).toFixed(2)))}
          onInc={() => setSurgeRotationSpeed((v) => Math.min(30, +(v + 0.5).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.wave.openDrift")}
          value={onOff(openDriftOn)}
          onDec={() => setOpenDriftOn(false)}
          onInc={() => setOpenDriftOn(true)}
        />
        {openDriftOn && (
          <>
            <SettingRow
              label={t("dial.wave.openDriftCurve")}
              value={t(`dial.wave.openDriftCurveValue.${openDriftCurve}`)}
              options={OPEN_DRIFT_CURVES.map((c) => t(`dial.wave.openDriftCurveValue.${c}`))}
              selectedIndex={Math.max(0, OPEN_DRIFT_CURVES.indexOf(openDriftCurve))}
              onSelectIndex={(i) => setOpenDriftCurve(OPEN_DRIFT_CURVES[i])}
              onDec={() => setOpenDriftCurve((c) => (c === "circle" ? "wander" : "circle"))}
              onInc={() => setOpenDriftCurve((c) => (c === "circle" ? "wander" : "circle"))}
            />
            {openDriftCurve === "circle" && (
              <>
                <SettingRow
                  label={t("dial.wave.openDriftRadius")}
                  mode="number"
                  value={`${openDriftRadius.toFixed(openDriftRadius < 10 ? 1 : 0)}m`}
                  rawValue={openDriftRadius}
                  onSet={(v) => setOpenDriftRadius(v)}
                  min={1}
                  max={mx("openDriftRadius")}
                  step={1}
                  onDec={() =>
                    setOpenDriftRadius((v) => Math.max(1, +(v - (v > 50 ? 10 : 1)).toFixed(1)))
                  }
                  onInc={() =>
                    setOpenDriftRadius((v) =>
                      Math.min(mx("openDriftRadius"), +(v + (v >= 50 ? 10 : 1)).toFixed(1)),
                    )
                  }
                />
                <SettingRow
                  label={t("dial.wave.openDriftDirection")}
                  value={t(`dial.wave.openDriftDirectionValue.${openDriftDirection}`)}
                  options={OPEN_DRIFT_DIRECTIONS.map((d) =>
                    t(`dial.wave.openDriftDirectionValue.${d}`),
                  )}
                  selectedIndex={Math.max(0, OPEN_DRIFT_DIRECTIONS.indexOf(openDriftDirection))}
                  onSelectIndex={(i) => setOpenDriftDirection(OPEN_DRIFT_DIRECTIONS[i])}
                  onDec={() => setOpenDriftDirection((d) => (d === "cw" ? "ccw" : "cw"))}
                  onInc={() => setOpenDriftDirection((d) => (d === "cw" ? "ccw" : "cw"))}
                />
              </>
            )}
            <SettingRow
              label={t("dial.wave.openDriftCycleSpeed")}
              mode="number"
              value={`${openDriftCycleSpeed.toFixed(2)}/min`}
              rawValue={openDriftCycleSpeed}
              onSet={(v) => setOpenDriftCycleSpeed(v)}
              min={0}
              max={10}
              step={0.05}
              onDec={() => setOpenDriftCycleSpeed((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
              onInc={() => setOpenDriftCycleSpeed((v) => Math.min(10, +(v + 0.05).toFixed(2)))}
            />
            <SettingRow
              label={t("dial.wave.openDriftMagnitude")}
              mode="number"
              value={`${Math.round(openDriftMagnitude * 100)}%`}
              rawValue={openDriftMagnitude}
              onSet={(v) => setOpenDriftMagnitude(v)}
              min={0}
              max={mx("openDriftMagnitude")}
              step={0.05}
              onDec={() => setOpenDriftMagnitude((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
              onInc={() =>
                setOpenDriftMagnitude((v) =>
                  Math.min(mx("openDriftMagnitude"), +(v + 0.05).toFixed(2)),
                )
              }
            />
          </>
        )}
      </G>
      <G id="waves">
        <SettingRow
          label={t("dial.wave.bob")}
          mode="number"
          value={`${buoyAmp.toFixed(2)}×`}
          rawValue={buoyAmp}
          onSet={setBuoyAmp}
          min={0}
          max={4}
          step={0.1}
          onDec={() => setBuoyAmp((v) => Math.max(0, +(v - 0.1).toFixed(2)))}
          onInc={() => setBuoyAmp((v) => Math.min(4, +(v + 0.1).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.wave.bobSpeed")}
          mode="number"
          value={`${bobSpeed.toFixed(2)}×`}
          rawValue={bobSpeed}
          onSet={setBobSpeed}
          min={0}
          max={5}
          step={0.1}
          onDec={() => setBobSpeed((v) => Math.max(0, +(v - 0.1).toFixed(2)))}
          onInc={() => setBobSpeed((v) => Math.min(5, +(v + 0.1).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.wave.waveform")}
          value={
            !regularWaves
              ? t("dial.wave.waveformValue.spread")
              : standingWaves
                ? t("dial.wave.waveformValue.standing")
                : sloshWaves
                  ? t("dial.wave.waveformValue.slosh")
                  : t("dial.wave.waveformValue.regular")
          }
          // SPRIDD → REGELBUNDEN → STÅENDE → SKVALPANDE
          onDec={() => {
            if (regularWaves && sloshWaves && !standingWaves) {
              setSloshWaves(false);
              setStandingWaves(true);
            } else if (regularWaves && (standingWaves || sloshWaves)) {
              setStandingWaves(false);
              setSloshWaves(false);
            } else {
              setRegularWaves(false);
              setStandingWaves(false);
              setSloshWaves(false);
            }
          }}
          onInc={() => {
            if (!regularWaves) setRegularWaves(true);
            else if (standingWaves) {
              setStandingWaves(false);
              setSloshWaves(true);
            } else if (!sloshWaves) setStandingWaves(true);
          }}
        />
        <SettingRow
          label={t("dial.wave.realistic")}
          value={realisticWaves ? t("dial.wave.realisticValue.on") : t("common.off")}
          onDec={() => setRealisticWaves(false)}
          onInc={() => setRealisticWaves(true)}
        />
        <SettingRow
          label={t("dial.wave.preset")}
          value={t(WAVE_PRESET_LABEL_KEYS[wavePreset])}
          onDec={() => applyWavePreset("legacy")}
          onInc={() => applyWavePreset("standard")}
        />
        <SettingRow
          label={t("dial.wave.dyingWave")}
          value={onOff(dyingWave)}
          onDec={() => setDyingWave(false)}
          onInc={() => setDyingWave(true)}
        />
        <SettingRow
          label={t("dial.wave.dyingWaveHeight")}
          mode="number"
          value={`${dyingWaveAmp.toFixed(2)}m`}
          rawValue={dyingWaveAmp}
          onSet={setDyingWaveAmp}
          min={0}
          max={20}
          step={0.1}
          onDec={() => setDyingWaveAmp((v) => Math.max(0, +(v - 0.1).toFixed(2)))}
          onInc={() => setDyingWaveAmp((v) => Math.min(20, +(v + 0.1).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.wave.dyingWaveSpeed")}
          mode="number"
          value={`${dyingWaveSpeed.toFixed(2)}×`}
          rawValue={dyingWaveSpeed}
          onSet={setDyingWaveSpeed}
          min={0}
          max={5}
          step={0.05}
          onDec={() => setDyingWaveSpeed((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
          onInc={() => setDyingWaveSpeed((v) => Math.min(5, +(v + 0.05).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.wave.randomize")}
          value={onOff(randomizeWaves)}
          onDec={() => setRandomizeWaves(false)}
          onInc={() => setRandomizeWaves(true)}
        />
        <SettingRow
          label={t("dial.wave.crossWave")}
          value={onOff(regularCross)}
          onDec={() => setRegularCross(false)}
          onInc={() => setRegularCross(true)}
        />
        <SettingRow
          label={t("dial.wave.wavePeriod")}
          mode="number"
          value={`${regularPeriod.toFixed(2)}x`}
          rawValue={regularPeriod}
          onSet={setRegularPeriod}
          min={0.3}
          max={4}
          step={0.1}
          onDec={() => setRegularPeriod((v) => Math.max(0.3, +(v - 0.1).toFixed(2)))}
          onInc={() => setRegularPeriod((v) => Math.min(4, +(v + 0.1).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.wave.peak")}
          mode="number"
          value={`${wavePeak.toFixed(2)}`}
          rawValue={wavePeak}
          onSet={setWavePeak}
          min={1}
          max={6}
          step={0.25}
          onDec={() => setWavePeak((v) => Math.max(1, +(v - 0.25).toFixed(2)))}
          onInc={() => setWavePeak((v) => Math.min(6, +(v + 0.25).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.wave.trochoid")}
          mode="number"
          value={trochoid <= 0.001 ? t("common.off") : `${Math.round(trochoid * 100)}%`}
          rawValue={trochoid}
          onSet={(v) => setTrochoid(v)}
          min={0}
          max={1}
          step={0.05}
          onDec={() => setTrochoid((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
          onInc={() => setTrochoid((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.wave.heaveSkew")}
          mode="number"
          value={heaveSkew <= 0.001 ? t("common.off") : `${Math.round(heaveSkew * 100)}%`}
          rawValue={heaveSkew}
          onSet={(v) => setHeaveSkew(v)}
          min={0}
          max={0.9}
          step={0.05}
          onDec={() => setHeaveSkew((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
          onInc={() => setHeaveSkew((v) => Math.min(0.9, +(v + 0.05).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.wave.quality")}
          value={waveHighQuality ? t("common.high") : t("common.low")}
          onDec={() => setWaveHighQuality(false)}
          onInc={() => setWaveHighQuality(true)}
        />
        <SettingRow
          label={t("dial.wave.waveDirection")}
          mode="number"
          value={`${Math.round(((waveDir % 360) + 360) % 360)}°`}
          rawValue={waveDir}
          onSet={(v) => setWaveDir(((v % 360) + 360) % 360)}
          min={0}
          max={360}
          step={5}
          onDec={() => setWaveDir((v) => (((v - 15) % 360) + 360) % 360)}
          onInc={() => setWaveDir((v) => (((v + 15) % 360) + 360) % 360)}
        />
      </G>
      {/* ── kamera ── */}
      <G id="state">
        <PresetControls
          scope="kamera"
          label={t("presets.scope.kamera")}
          savedPresets={savedPresets}
          exportSettingsFile={exportSettingsFile}
          importSettingsFile={importSettingsFile}
          savePresetAs={savePresetAs}
          loadSavedPreset={loadSavedPreset}
          deleteSavedPreset={deleteSavedPreset}
        />
      </G>
      <G id="app">
        <SettingRow
          label={t("dial.camera.extremeLimits")}
          value={onOff(extremeLimits)}
          onDec={() => setExtremeLimits(false)}
          onInc={() => setExtremeLimits(true)}
        />
        <Findable label={t("dial.camera.extremeLimitsHint")}>
          <div className="w-full px-2 text-center text-[10px] leading-relaxed ui-ink-faint">
            {t("dial.camera.extremeLimitsHint")}
          </div>
        </Findable>
      </G>
      <G id="mode">
        {intervalSessionOn ? (
          <div className="flex min-w-[86px] flex-col items-start justify-center gap-0.5 rounded-full border ui-line-1 ui-surface px-3 py-2 leading-tight">
            <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">
              {t("dial.camera.mode")}
            </span>
            <span className="text-xs font-medium tracking-wider ui-ink">
              {t(CAMERA_MODE_LABEL_KEYS[cameraMode])} {t("camera.mode.autoSuffix")}
            </span>
          </div>
        ) : (
          <SettingRow
            label={t("dial.camera.mode")}
            value={t(CAMERA_MODE_LABEL_KEYS[cameraMode])}
            options={CAMERA_MODES.map((m) => t(CAMERA_MODE_LABEL_KEYS[m]))}
            selectedIndex={CAMERA_MODES.indexOf(cameraMode)}
            onSelectIndex={(i) => setCameraMode(CAMERA_MODES[i])}
            onDec={() => cycleCameraMode(-1)}
            onInc={() => cycleCameraMode(1)}
          />
        )}
        {cameraMode === "noclip" && (
          <SettingRow
            label={t("dial.camera.noclipSpeed")}
            mode="number"
            value={`${noclipSpeed.toFixed(1)}x`}
            rawValue={noclipSpeed}
            onSet={(v) => setNoclipSpeed(v)}
            min={0.2}
            max={6}
            step={0.1}
            onDec={() => setNoclipSpeed((v) => Math.max(0.2, +(v - 0.1).toFixed(2)))}
            onInc={() => setNoclipSpeed((v) => Math.min(6, +(v + 0.1).toFixed(2)))}
          />
        )}
        {cameraMode === "bodyflight" && (
          <>
            <SettingRow
              label={t("dial.camera.bodyflightAirflow")}
              mode="number"
              value={`${bodyflightAirflow.toFixed(0)}m/s`}
              rawValue={bodyflightAirflow}
              onSet={(v) => setBodyflightAirflow(v)}
              min={0}
              max={BODYFLIGHT_AIRFLOW_MAX}
              step={1}
              onDec={() => setBodyflightAirflow((v) => Math.max(0, Math.round(v - 1)))}
              onInc={() =>
                setBodyflightAirflow((v) => Math.min(BODYFLIGHT_AIRFLOW_MAX, Math.round(v + 1)))
              }
            />
            <SettingRow
              label={t("dial.camera.bodyflightGravity")}
              mode="number"
              value={`${bodyflightGravity.toFixed(2)}g`}
              rawValue={bodyflightGravity}
              onSet={(v) => setBodyflightGravity(v)}
              min={0}
              max={BODYFLIGHT_GRAVITY_MAX}
              step={0.05}
              onDec={() => setBodyflightGravity((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
              onInc={() =>
                setBodyflightGravity((v) =>
                  Math.min(BODYFLIGHT_GRAVITY_MAX, +(v + 0.05).toFixed(2)),
                )
              }
            />
            <SettingRow
              label={t("dial.camera.bodyflightHoverHeight")}
              mode="number"
              value={`${bodyflightHoverHeight.toFixed(1)}m`}
              rawValue={bodyflightHoverHeight}
              onSet={(v) => setBodyflightHoverHeight(v)}
              min={BODYFLIGHT_HOVER_MIN}
              max={BODYFLIGHT_HOVER_MAX}
              step={0.5}
              onDec={() =>
                setBodyflightHoverHeight((v) =>
                  Math.max(BODYFLIGHT_HOVER_MIN, +(v - 0.5).toFixed(1)),
                )
              }
              onInc={() =>
                setBodyflightHoverHeight((v) =>
                  Math.min(BODYFLIGHT_HOVER_MAX, +(v + 0.5).toFixed(1)),
                )
              }
            />
          </>
        )}
        {cameraMode === "noclip" && (
          <SettingRow
            label={t("dial.camera.noclipFallRiseSpeed")}
            mode="number"
            value={`${noclipFallRiseSpeed.toFixed(0)}m/s`}
            rawValue={noclipFallRiseSpeed}
            onSet={(v) => setNoclipFallRiseSpeed(v)}
            min={2}
            max={300}
            step={2}
            onDec={() => setNoclipFallRiseSpeed((v) => Math.max(2, +(v - 2).toFixed(0)))}
            onInc={() => setNoclipFallRiseSpeed((v) => Math.min(300, +(v + 2).toFixed(0)))}
          />
        )}
        {cameraMode === "noclip" && (
          <SettingRow
            label={t("dial.camera.noclipVertEaseTime")}
            mode="number"
            value={`${noclipVertEaseTime.toFixed(2)}s`}
            rawValue={noclipVertEaseTime}
            onSet={(v) => setNoclipVertEaseTime(v)}
            min={0.05}
            max={3}
            step={0.05}
            onDec={() => setNoclipVertEaseTime((v) => Math.max(0.05, +(v - 0.05).toFixed(2)))}
            onInc={() => setNoclipVertEaseTime((v) => Math.min(3, +(v + 0.05).toFixed(2)))}
          />
        )}
        {cameraMode === "noclip" && (
          <SettingRow
            label={t("dial.camera.noclipAutoAlternate")}
            value={onOff(noclipAutoAlternateOn)}
            onDec={() => setNoclipAutoAlternateOn(false)}
            onInc={() => setNoclipAutoAlternateOn(true)}
          />
        )}
        {cameraMode === "noclip" && noclipAutoAlternateOn && (
          <SettingRow
            label={t("dial.camera.noclipAutoAlternateInterval")}
            mode="number"
            value={`${noclipAutoAlternateInterval.toFixed(0)}s`}
            rawValue={noclipAutoAlternateInterval}
            onSet={(v) => setNoclipAutoAlternateInterval(v)}
            min={1}
            max={120}
            step={1}
            onDec={() => setNoclipAutoAlternateInterval((v) => Math.max(1, +(v - 1).toFixed(0)))}
            onInc={() => setNoclipAutoAlternateInterval((v) => Math.min(120, +(v + 1).toFixed(0)))}
          />
        )}
        {/* FREAK OUT: the carousel ride, its own toggle like TORNADO —
                    runs on top of every camera mode (with GUNGA both swings
                    combine). */}
        <SettingRow
          label={t("dial.camera.freakOutOn")}
          value={onOff(freakOutOn)}
          onDec={() => setFreakOutOn(false)}
          onInc={() => setFreakOutOn(true)}
        />
        {freakOutOn && (
          <>
            <SettingRow
              label={t("dial.camera.freakOutSwingAxis")}
              mode="number"
              value={`${freakOutSwingAxis.toFixed(0)}°`}
              rawValue={freakOutSwingAxis}
              onSet={(v) => setFreakOutSwingAxis(v)}
              min={0}
              max={180}
              step={5}
              onDec={() => setFreakOutSwingAxis((v) => Math.max(0, +(v - 5).toFixed(0)))}
              onInc={() => setFreakOutSwingAxis((v) => Math.min(180, +(v + 5).toFixed(0)))}
            />
            <SettingRow
              label={t("dial.camera.freakOutSwingAngle")}
              mode="number"
              value={`${freakOutSwingAngle.toFixed(0)}°`}
              rawValue={freakOutSwingAngle}
              onSet={(v) => setFreakOutSwingAngle(v)}
              min={0}
              max={180}
              step={5}
              onDec={() => setFreakOutSwingAngle((v) => Math.max(0, +(v - 5).toFixed(0)))}
              onInc={() => setFreakOutSwingAngle((v) => Math.min(180, +(v + 5).toFixed(0)))}
            />
            <SettingRow
              label={t("dial.camera.freakOutSwingSpeed")}
              mode="number"
              value={`${freakOutSwingSpeed.toFixed(2)}x`}
              rawValue={freakOutSwingSpeed}
              onSet={(v) => setFreakOutSwingSpeed(v)}
              min={0}
              max={mx("freakOutSwingSpeed")}
              step={0.05}
              onDec={() => setFreakOutSwingSpeed((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
              onInc={() =>
                setFreakOutSwingSpeed((v) =>
                  Math.min(mx("freakOutSwingSpeed"), +(v + 0.05).toFixed(2)),
                )
              }
            />
            <SettingRow
              label={t("dial.camera.freakOutSwingLength")}
              mode="number"
              value={`${freakOutSwingLength.toFixed(1)}m`}
              rawValue={freakOutSwingLength}
              onSet={(v) => setFreakOutSwingLength(v)}
              min={0}
              max={mx("freakOutSwingLength")}
              step={0.5}
              onDec={() => setFreakOutSwingLength((v) => Math.max(0, +(v - 0.5).toFixed(1)))}
              onInc={() =>
                setFreakOutSwingLength((v) =>
                  Math.min(mx("freakOutSwingLength"), +(v + 0.5).toFixed(1)),
                )
              }
            />
            <SettingRow
              label={t("dial.camera.freakOutFloatYOffset")}
              mode="number"
              value={`${freakOutFloatYOffset.toFixed(1)}m`}
              rawValue={freakOutFloatYOffset}
              onSet={(v) => setFreakOutFloatYOffset(v)}
              min={0}
              max={mx("freakOutFloatYOffset")}
              step={0.5}
              onDec={() => setFreakOutFloatYOffset((v) => Math.max(0, +(v - 0.5).toFixed(1)))}
              onInc={() =>
                setFreakOutFloatYOffset((v) =>
                  Math.min(mx("freakOutFloatYOffset"), +(v + 0.5).toFixed(1)),
                )
              }
            />
            <SettingRow
              label={t("dial.camera.freakOutOverlayOn")}
              value={onOff(freakOutOverlayOn)}
              onDec={() => setFreakOutOverlayOn(false)}
              onInc={() => setFreakOutOverlayOn(true)}
            />
            <SettingRow
              label={t("dial.camera.freakOutRingRadius")}
              mode="number"
              value={`${freakOutRingRadius.toFixed(1)}m`}
              rawValue={freakOutRingRadius}
              onSet={(v) => setFreakOutRingRadius(v)}
              min={0}
              max={mx("freakOutRingRadius")}
              step={0.5}
              onDec={() => setFreakOutRingRadius((v) => Math.max(0, +(v - 0.5).toFixed(1)))}
              onInc={() =>
                setFreakOutRingRadius((v) =>
                  Math.min(mx("freakOutRingRadius"), +(v + 0.5).toFixed(1)),
                )
              }
            />
            <SettingRow
              label={t("dial.camera.freakOutRingLevel")}
              value={onOff(freakOutRingLevel)}
              onDec={() => setFreakOutRingLevel(false)}
              onInc={() => setFreakOutRingLevel(true)}
            />
            <SettingRow
              label={t("dial.camera.freakOutRotationOn")}
              value={onOff(freakOutRotationOn)}
              onDec={() => setFreakOutRotationOn(false)}
              onInc={() => setFreakOutRotationOn(true)}
            />
            {freakOutRotationOn && (
              <>
                <SettingRow
                  label={t("dial.camera.freakOutRotationAxis")}
                  value={freakOutRotationAxis.toUpperCase()}
                  options={FREAK_OUT_AXES.map((a) => a.toUpperCase())}
                  selectedIndex={FREAK_OUT_AXES.indexOf(freakOutRotationAxis)}
                  onSelectIndex={(i) => setFreakOutRotationAxis(FREAK_OUT_AXES[i])}
                  onDec={() =>
                    setFreakOutRotationAxis(
                      (a) => FREAK_OUT_AXES[(FREAK_OUT_AXES.indexOf(a) + 2) % 3],
                    )
                  }
                  onInc={() =>
                    setFreakOutRotationAxis(
                      (a) => FREAK_OUT_AXES[(FREAK_OUT_AXES.indexOf(a) + 1) % 3],
                    )
                  }
                />
                <SettingRow
                  label={t("dial.camera.freakOutRotationSpeed")}
                  mode="number"
                  value={`${freakOutRotationSpeed.toFixed(2)}x`}
                  rawValue={freakOutRotationSpeed}
                  onSet={(v) => setFreakOutRotationSpeed(v)}
                  min={0}
                  max={mx("freakOutRotationSpeed")}
                  step={0.05}
                  onDec={() => setFreakOutRotationSpeed((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
                  onInc={() =>
                    setFreakOutRotationSpeed((v) =>
                      Math.min(mx("freakOutRotationSpeed"), +(v + 0.05).toFixed(2)),
                    )
                  }
                />
                <SettingRow
                  label={t("dial.camera.freakOutRotationPeakSpeed")}
                  mode="number"
                  value={`${Math.round(freakOutRotationPeakSpeed * 100)}%`}
                  rawValue={freakOutRotationPeakSpeed}
                  onSet={(v) => setFreakOutRotationPeakSpeed(v / 100)}
                  min={0}
                  max={1}
                  step={0.05}
                  onDec={() =>
                    setFreakOutRotationPeakSpeed((v) => Math.max(0, +(v - 0.05).toFixed(2)))
                  }
                  onInc={() =>
                    setFreakOutRotationPeakSpeed((v) => Math.min(1, +(v + 0.05).toFixed(2)))
                  }
                />
                <SettingRow
                  label={t("dial.camera.freakOutRotationRecovery")}
                  mode="number"
                  value={`${freakOutRotationRecovery.toFixed(2)}×`}
                  rawValue={freakOutRotationRecovery}
                  onSet={(v) => setFreakOutRotationRecovery(v)}
                  min={0.25}
                  max={4}
                  step={0.05}
                  onDec={() =>
                    setFreakOutRotationRecovery((v) => Math.max(0.25, +(v - 0.05).toFixed(2)))
                  }
                  onInc={() =>
                    setFreakOutRotationRecovery((v) => Math.min(4, +(v + 0.05).toFixed(2)))
                  }
                />
                <SettingRow
                  label={t("dial.camera.freakOutRotationKickOn")}
                  value={onOff(freakOutRotationKickOn)}
                  onDec={() => setFreakOutRotationKickOn(false)}
                  onInc={() => setFreakOutRotationKickOn(true)}
                />
                {freakOutRotationKickOn && (
                  <SettingRow
                    label={t("dial.camera.freakOutRotationKick")}
                    mode="number"
                    value={`${freakOutRotationKick.toFixed(2)}×`}
                    rawValue={freakOutRotationKick}
                    onSet={(v) => setFreakOutRotationKick(v)}
                    min={0}
                    max={mx("freakOutRotationKick")}
                    step={0.05}
                    onDec={() =>
                      setFreakOutRotationKick((v) => Math.max(0, +(v - 0.05).toFixed(2)))
                    }
                    onInc={() =>
                      setFreakOutRotationKick((v) =>
                        Math.min(mx("freakOutRotationKick"), +(v + 0.05).toFixed(2)),
                      )
                    }
                  />
                )}
                <SettingRow
                  label={t("dial.camera.freakOutRotationDirection")}
                  value={t(TORNADO_DIRECTION_LABEL_KEYS[freakOutRotationDirection])}
                  options={TORNADO_DIRECTIONS.map((d) => t(TORNADO_DIRECTION_LABEL_KEYS[d]))}
                  selectedIndex={TORNADO_DIRECTIONS.indexOf(freakOutRotationDirection)}
                  onSelectIndex={(i) => setFreakOutRotationDirection(TORNADO_DIRECTIONS[i])}
                  onDec={() => setFreakOutRotationDirection("cw")}
                  onInc={() => setFreakOutRotationDirection("ccw")}
                />
                <SettingRow
                  label={t("dial.camera.freakOutViewFixedHeading")}
                  value={onOff(freakOutViewFixedHeading)}
                  onDec={() => setFreakOutViewFixedHeading(false)}
                  onInc={() => setFreakOutViewFixedHeading(true)}
                />
                <SettingRow
                  label={t("dial.camera.freakOutRotationOscillate")}
                  value={onOff(freakOutRotationOscillate)}
                  onDec={() => setFreakOutRotationOscillate(false)}
                  onInc={() => setFreakOutRotationOscillate(true)}
                />
                {freakOutRotationOscillate && (
                  <SettingRow
                    label={t("dial.camera.freakOutRotationOscillateSpeed")}
                    mode="number"
                    value={`${freakOutRotationOscillateSpeed.toFixed(2)}x`}
                    rawValue={freakOutRotationOscillateSpeed}
                    onSet={(v) => setFreakOutRotationOscillateSpeed(v)}
                    min={0.05}
                    max={5}
                    step={0.05}
                    onDec={() =>
                      setFreakOutRotationOscillateSpeed((v) =>
                        Math.max(0.05, +(v - 0.05).toFixed(2)),
                      )
                    }
                    onInc={() =>
                      setFreakOutRotationOscillateSpeed((v) => Math.min(5, +(v + 0.05).toFixed(2)))
                    }
                  />
                )}
                {freakOutRotationOscillate && (
                  <SettingRow
                    label={t("dial.camera.freakOutRotationOscillateEveryOther")}
                    value={onOff(freakOutRotationOscillateEveryOther)}
                    onDec={() => setFreakOutRotationOscillateEveryOther(false)}
                    onInc={() => setFreakOutRotationOscillateEveryOther(true)}
                  />
                )}
              </>
            )}
            <SettingRow
              label={t("dial.camera.freakOutShowArm")}
              value={onOff(freakOutShowArm)}
              onDec={() => setFreakOutShowArm(false)}
              onInc={() => setFreakOutShowArm(true)}
            />
            <SettingRow
              label={t("dial.camera.freakOutShowFrame")}
              value={onOff(freakOutShowFrame)}
              onDec={() => setFreakOutShowFrame(false)}
              onInc={() => setFreakOutShowFrame(true)}
            />
            {freakOutShowFrame && (
              <label className="flex items-center gap-2 rounded-full border ui-line-1 ui-surface py-1 pl-3 pr-1 backdrop-blur-md">
                <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">
                  {t("dial.camera.freakOutFrameColor")}
                </span>
                <input
                  type="color"
                  value={freakOutFrameColor}
                  onChange={(e) => setFreakOutFrameColor(e.target.value)}
                  className="h-7 w-9 cursor-pointer rounded-full border ui-line-2 bg-transparent p-0"
                />
              </label>
            )}
            <SettingRow
              label={t("dial.camera.freakOutShowTopRing")}
              value={onOff(freakOutShowTopRing)}
              onDec={() => setFreakOutShowTopRing(false)}
              onInc={() => setFreakOutShowTopRing(true)}
            />
            <SettingRow
              label={t("dial.camera.freakOutShowHub")}
              value={onOff(freakOutShowHub)}
              onDec={() => setFreakOutShowHub(false)}
              onInc={() => setFreakOutShowHub(true)}
            />
            <SettingRow
              label={t("dial.camera.freakOutSeatsOn")}
              value={onOff(freakOutSeatsOn)}
              onDec={() => setFreakOutSeatsOn(false)}
              onInc={() => setFreakOutSeatsOn(true)}
            />
            {freakOutSeatsOn && (
              <>
                <SettingRow
                  label={t("dial.camera.freakOutSeatCount")}
                  mode="number"
                  value={`${freakOutSeatCount}`}
                  rawValue={freakOutSeatCount}
                  onSet={(v) => setFreakOutSeatCount(Math.max(1, Math.round(v)))}
                  min={1}
                  max={32}
                  step={1}
                  onDec={() => setFreakOutSeatCount((v) => Math.max(1, v - 1))}
                  onInc={() => setFreakOutSeatCount((v) => Math.min(32, v + 1))}
                />
                <SettingRow
                  label={t("dial.camera.freakOutCameraSeat")}
                  mode="number"
                  value={`${Math.min(freakOutCameraSeat, freakOutSeatCount)} / ${freakOutSeatCount}`}
                  rawValue={Math.min(freakOutCameraSeat, freakOutSeatCount)}
                  onSet={(v) =>
                    setFreakOutCameraSeat(Math.max(1, Math.min(freakOutSeatCount, Math.round(v))))
                  }
                  min={1}
                  max={freakOutSeatCount}
                  step={1}
                  onDec={() =>
                    setFreakOutCameraSeat((v) => Math.max(1, Math.min(freakOutSeatCount, v) - 1))
                  }
                  onInc={() =>
                    setFreakOutCameraSeat((v) =>
                      Math.min(freakOutSeatCount, Math.min(freakOutSeatCount, v) + 1),
                    )
                  }
                />
                <SettingRow
                  label={t("dial.camera.freakOutSeatPostLength")}
                  mode="number"
                  value={`${freakOutSeatPostLength.toFixed(1)}m`}
                  rawValue={freakOutSeatPostLength}
                  onSet={(v) => setFreakOutSeatPostLength(v)}
                  min={0.5}
                  max={30}
                  step={0.1}
                  onDec={() =>
                    setFreakOutSeatPostLength((v) => Math.max(0.5, +(v - 0.1).toFixed(1)))
                  }
                  onInc={() =>
                    setFreakOutSeatPostLength((v) => Math.min(30, +(v + 0.1).toFixed(1)))
                  }
                />
                <label className="flex items-center gap-2 rounded-full border ui-line-1 ui-surface py-1 pl-3 pr-1 backdrop-blur-md">
                  <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">
                    {t("dial.camera.freakOutSeatColor")}
                  </span>
                  <input
                    type="color"
                    value={freakOutSeatColor}
                    onChange={(e) => setFreakOutSeatColor(e.target.value)}
                    className="h-7 w-9 cursor-pointer rounded-full border ui-line-2 bg-transparent p-0"
                  />
                </label>
                <label className="flex items-center gap-2 rounded-full border ui-line-1 ui-surface py-1 pl-3 pr-1 backdrop-blur-md">
                  <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">
                    {t("dial.camera.freakOutRingColor")}
                  </span>
                  <input
                    type="color"
                    value={freakOutRingColor}
                    onChange={(e) => setFreakOutRingColor(e.target.value)}
                    className="h-7 w-9 cursor-pointer rounded-full border ui-line-2 bg-transparent p-0"
                  />
                </label>
                <label className="flex items-center gap-2 rounded-full border ui-line-1 ui-surface py-1 pl-3 pr-1 backdrop-blur-md">
                  <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">
                    {t("dial.camera.freakOutPostColor")}
                  </span>
                  <input
                    type="color"
                    value={freakOutPostColor}
                    onChange={(e) => setFreakOutPostColor(e.target.value)}
                    className="h-7 w-9 cursor-pointer rounded-full border ui-line-2 bg-transparent p-0"
                  />
                </label>
                <label className="flex items-center gap-2 rounded-full border ui-line-1 ui-surface py-1 pl-3 pr-1 backdrop-blur-md">
                  <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">
                    {t("dial.camera.freakOutArmColor")}
                  </span>
                  <input
                    type="color"
                    value={freakOutArmColor}
                    onChange={(e) => setFreakOutArmColor(e.target.value)}
                    className="h-7 w-9 cursor-pointer rounded-full border ui-line-2 bg-transparent p-0"
                  />
                </label>
              </>
            )}
          </>
        )}
        {/* TORNADO: one unified toggle+dial block for FRI (float/
                    swimming), GUNGA (swing) and flying (noclip/watercraft)
                    alike — same settings drive the camera's orbit in every
                    applicable mode; the water whirlpool visual (TORNADO
                    OPENING) only applies while floating or swinging. */}
        {(cameraMode === "float" ||
          cameraMode === "noclip" ||
          cameraMode === "watercraft" ||
          cameraMode === "swing" ||
          cameraMode === "bodyflight") && (
          <SettingRow
            label={t("dial.camera.tornado")}
            value={onOff(tornadoOn)}
            onDec={() => setTornadoOn(false)}
            onInc={() => setTornadoOn(true)}
          />
        )}
        {(cameraMode === "float" ||
          cameraMode === "noclip" ||
          cameraMode === "watercraft" ||
          cameraMode === "swing" ||
          cameraMode === "bodyflight") &&
          tornadoOn && (
            <>
              <SettingRow
                label={t("dial.camera.tornadoRadius")}
                mode="number"
                value={`${tornadoRadius.toFixed(0)}m`}
                rawValue={tornadoRadius}
                onSet={(v) => setTornadoRadius(v)}
                min={0}
                max={mx("tornadoRadius")}
                step={5}
                onDec={() => setTornadoRadius((v) => Math.max(0, +(v - 5).toFixed(0)))}
                onInc={() =>
                  setTornadoRadius((v) => Math.min(mx("tornadoRadius"), +(v + 5).toFixed(0)))
                }
              />
              <SettingRow
                label={t("dial.camera.tornadoSpeed")}
                mode="number"
                value={`${tornadoSpeed.toFixed(2)}x`}
                rawValue={tornadoSpeed}
                onSet={(v) => setTornadoSpeed(v)}
                min={0}
                max={mx("tornadoSpeed")}
                step={0.1}
                onDec={() => setTornadoSpeed((v) => Math.max(0, +(v - 0.1).toFixed(2)))}
                onInc={() =>
                  setTornadoSpeed((v) => Math.min(mx("tornadoSpeed"), +(v + 0.1).toFixed(2)))
                }
              />
              <SettingRow
                label={t("dial.camera.tornadoDirection")}
                value={t(TORNADO_DIRECTION_LABEL_KEYS[tornadoDirection])}
                options={TORNADO_DIRECTIONS.map((d) => t(TORNADO_DIRECTION_LABEL_KEYS[d]))}
                selectedIndex={TORNADO_DIRECTIONS.indexOf(tornadoDirection)}
                onSelectIndex={(i) => setTornadoDirection(TORNADO_DIRECTIONS[i])}
                onDec={() => setTornadoDirection("cw")}
                onInc={() => setTornadoDirection("ccw")}
              />
              {(cameraMode === "float" ||
                cameraMode === "swing" ||
                cameraMode === "bodyflight") && (
                <SettingRow
                  label={t("dial.camera.tornadoOpening")}
                  mode="number"
                  value={`${tornadoOpening.toFixed(1)}m`}
                  rawValue={tornadoOpening}
                  onSet={(v) => setTornadoOpening(v)}
                  min={3}
                  max={60}
                  step={0.5}
                  onDec={() => setTornadoOpening((v) => Math.max(3, +(v - 0.5).toFixed(2)))}
                  onInc={() => setTornadoOpening((v) => Math.min(60, +(v + 0.5).toFixed(2)))}
                />
              )}
              <SettingRow
                label={t("dial.camera.tornadoFollowCenter")}
                value={onOff(tornadoFollowCenter)}
                onDec={() => setTornadoFollowCenter(false)}
                onInc={() => setTornadoFollowCenter(true)}
              />
              <SettingRow
                label={t("dial.camera.tornadoCloud")}
                value={onOff(tornadoCloudOn)}
                onDec={() => setTornadoCloudOn(false)}
                onInc={() => setTornadoCloudOn(true)}
              />
              {tornadoCloudOn && cameraMode !== "float" && (
                <SettingRow
                  label={t("dial.camera.tornadoCloudYOffset")}
                  mode="number"
                  value={`${tornadoCloudYOffset.toFixed(0)}m`}
                  rawValue={tornadoCloudYOffset}
                  onSet={(v) => setTornadoCloudYOffset(v)}
                  min={-200}
                  max={200}
                  step={5}
                  onDec={() => setTornadoCloudYOffset((v) => Math.max(-200, +(v - 5).toFixed(0)))}
                  onInc={() => setTornadoCloudYOffset((v) => Math.min(200, +(v + 5).toFixed(0)))}
                />
              )}
              <SettingRow
                label={t("dial.camera.tornadoSequence")}
                value={onOff(tornadoSequenceOn)}
                onDec={() => setTornadoSequenceOn(false)}
                onInc={() => setTornadoSequenceOn(true)}
              />
              {tornadoSequenceOn && (
                <>
                  <SettingRow
                    label={t("dial.camera.tornadoSequenceDragSpeed")}
                    mode="number"
                    value={`${tornadoSequenceDragSpeed.toFixed(0)}m/s`}
                    rawValue={tornadoSequenceDragSpeed}
                    onSet={(v) => setTornadoSequenceDragSpeed(v)}
                    min={1}
                    max={100}
                    step={1}
                    onDec={() =>
                      setTornadoSequenceDragSpeed((v) => Math.max(1, +(v - 1).toFixed(0)))
                    }
                    onInc={() =>
                      setTornadoSequenceDragSpeed((v) => Math.min(100, +(v + 1).toFixed(0)))
                    }
                  />
                  <SettingRow
                    label={t("dial.camera.tornadoSequenceDragDuration")}
                    mode="number"
                    value={`${tornadoSequenceDragDuration.toFixed(1)}s`}
                    rawValue={tornadoSequenceDragDuration}
                    onSet={(v) => setTornadoSequenceDragDuration(v)}
                    min={0.5}
                    max={30}
                    step={0.5}
                    onDec={() =>
                      setTornadoSequenceDragDuration((v) => Math.max(0.5, +(v - 0.5).toFixed(1)))
                    }
                    onInc={() =>
                      setTornadoSequenceDragDuration((v) => Math.min(30, +(v + 0.5).toFixed(1)))
                    }
                  />
                  <SettingRow
                    label={t("dial.camera.tornadoSequenceStayDuration")}
                    mode="number"
                    value={`${tornadoSequenceStayDuration.toFixed(1)}s`}
                    rawValue={tornadoSequenceStayDuration}
                    onSet={(v) => setTornadoSequenceStayDuration(v)}
                    min={0}
                    max={60}
                    step={0.5}
                    onDec={() =>
                      setTornadoSequenceStayDuration((v) => Math.max(0, +(v - 0.5).toFixed(1)))
                    }
                    onInc={() =>
                      setTornadoSequenceStayDuration((v) => Math.min(60, +(v + 0.5).toFixed(1)))
                    }
                  />
                  <SettingRow
                    label={t("dial.camera.tornadoSequenceExitMode")}
                    value={t(TORNADO_SEQUENCE_EXIT_MODE_LABEL_KEYS[tornadoSequenceExitMode])}
                    options={TORNADO_SEQUENCE_EXIT_MODES.map((m) =>
                      t(TORNADO_SEQUENCE_EXIT_MODE_LABEL_KEYS[m]),
                    )}
                    selectedIndex={TORNADO_SEQUENCE_EXIT_MODES.indexOf(tornadoSequenceExitMode)}
                    onSelectIndex={(i) =>
                      setTornadoSequenceExitMode(TORNADO_SEQUENCE_EXIT_MODES[i])
                    }
                    onDec={() => setTornadoSequenceExitMode("outer")}
                    onInc={() => setTornadoSequenceExitMode("lift")}
                  />
                  <SettingRow
                    label={t("dial.camera.tornadoSequenceExitSpeed")}
                    mode="number"
                    value={`${tornadoSequenceExitSpeed.toFixed(0)}m/s`}
                    rawValue={tornadoSequenceExitSpeed}
                    onSet={(v) => setTornadoSequenceExitSpeed(v)}
                    min={1}
                    max={100}
                    step={1}
                    onDec={() =>
                      setTornadoSequenceExitSpeed((v) => Math.max(1, +(v - 1).toFixed(0)))
                    }
                    onInc={() =>
                      setTornadoSequenceExitSpeed((v) => Math.min(100, +(v + 1).toFixed(0)))
                    }
                  />
                  {tornadoSequenceExitMode === "lift" && (
                    <>
                      <SettingRow
                        label={t("dial.camera.tornadoSequenceLiftHeight")}
                        mode="number"
                        value={`${tornadoSequenceLiftHeight.toFixed(0)}m`}
                        rawValue={tornadoSequenceLiftHeight}
                        onSet={(v) => setTornadoSequenceLiftHeight(v)}
                        min={5}
                        max={500}
                        step={5}
                        onDec={() =>
                          setTornadoSequenceLiftHeight((v) => Math.max(5, +(v - 5).toFixed(0)))
                        }
                        onInc={() =>
                          setTornadoSequenceLiftHeight((v) => Math.min(500, +(v + 5).toFixed(0)))
                        }
                      />
                      <SettingRow
                        label={t("dial.camera.tornadoSequencePauseDuration")}
                        mode="number"
                        value={`${tornadoSequencePauseDuration.toFixed(1)}s`}
                        rawValue={tornadoSequencePauseDuration}
                        onSet={(v) => setTornadoSequencePauseDuration(v)}
                        min={0}
                        max={30}
                        step={0.5}
                        onDec={() =>
                          setTornadoSequencePauseDuration((v) => Math.max(0, +(v - 0.5).toFixed(1)))
                        }
                        onInc={() =>
                          setTornadoSequencePauseDuration((v) =>
                            Math.min(30, +(v + 0.5).toFixed(1)),
                          )
                        }
                      />
                    </>
                  )}
                </>
              )}
            </>
          )}
        {cameraMode === "swing" && (
          <>
            <SettingRow
              label={t("dial.camera.swingStart")}
              value={t(SWING_PRESET_LABEL_KEYS[swingPreset])}
              options={SWING_PRESETS.map((p) => t(SWING_PRESET_LABEL_KEYS[p]))}
              selectedIndex={SWING_PRESETS.indexOf(swingPreset)}
              onSelectIndex={(i) => applySwingPreset(SWING_PRESETS[i])}
              onDec={() => cycleSwingPreset(-1)}
              onInc={() => cycleSwingPreset(1)}
            />
            <SettingRow
              label={t("dial.camera.swingPositionY")}
              mode="number"
              value={`${swingPositionY.toFixed(0)}m`}
              rawValue={swingPositionY}
              onSet={(v) => setSwingPositionY(v)}
              min={0}
              max={100000}
              step={100}
              onDec={() => setSwingPositionY((v) => Math.max(0, +(v - 100).toFixed(0)))}
              onInc={() => setSwingPositionY((v) => Math.min(100000, +(v + 100).toFixed(0)))}
            />
            <SettingRow
              label={t("dial.camera.swingIntensity")}
              mode="number"
              value={`${swingIntensity.toFixed(4)}x`}
              rawValue={swingIntensity}
              onSet={(v) => setSwingIntensity(v)}
              min={0.0001}
              max={mx("swingIntensity")}
              step={0.05}
              onDec={() => setSwingIntensity((v) => Math.max(0.0001, +(v - 0.05).toFixed(4)))}
              onInc={() =>
                setSwingIntensity((v) => Math.min(mx("swingIntensity"), +(v + 0.05).toFixed(4)))
              }
            />
            <SettingRow
              label={t("dial.camera.swingSpeed")}
              mode="number"
              value={`${swingSpeed.toFixed(2)}x`}
              rawValue={swingSpeed}
              onSet={(v) => setSwingSpeed(v)}
              min={0.1}
              max={mx("swingSpeed")}
              step={0.1}
              onDec={() => setSwingSpeed((v) => Math.max(0.1, +(v - 0.1).toFixed(2)))}
              onInc={() => setSwingSpeed((v) => Math.min(mx("swingSpeed"), +(v + 0.1).toFixed(2)))}
            />
            <SettingRow
              label={t("dial.camera.swingXFactor")}
              mode="number"
              value={swingXFactor <= 0.001 ? t("common.off") : `${swingXFactor.toFixed(2)}x`}
              rawValue={swingXFactor}
              onSet={(v) => setSwingXFactor(v)}
              min={0}
              max={2}
              step={0.1}
              onDec={() => setSwingXFactor((v) => Math.max(0, +(v - 0.1).toFixed(2)))}
              onInc={() => setSwingXFactor((v) => Math.min(2, +(v + 0.1).toFixed(2)))}
            />
            <SettingRow
              label={t("dial.camera.swingHeight")}
              mode="number"
              value={`${swingHeight.toFixed(0)}m`}
              rawValue={swingHeight}
              onSet={(v) => setSwingHeight(v)}
              min={0}
              max={mx("swingHeight")}
              step={100}
              onDec={() => setSwingHeight((v) => Math.max(0, +(v - 100).toFixed(0)))}
              onInc={() =>
                setSwingHeight((v) => Math.min(mx("swingHeight"), +(v + 100).toFixed(0)))
              }
            />
            <SettingRow
              label={t("dial.camera.swingKeepSpeed")}
              value={onOff(swingKeepSpeed)}
              onDec={() => setSwingKeepSpeedOn(false)}
              onInc={() => setSwingKeepSpeedOn(true)}
            />
            <SettingRow
              label={t("dial.camera.swingYWaveform")}
              value={t(SWING_Y_WAVEFORM_LABEL_KEYS[swingYWaveform])}
              options={SWING_Y_WAVEFORMS.map((w) => t(SWING_Y_WAVEFORM_LABEL_KEYS[w]))}
              selectedIndex={SWING_Y_WAVEFORMS.indexOf(swingYWaveform)}
              onSelectIndex={(i) => setSwingYWaveform(SWING_Y_WAVEFORMS[i])}
              onDec={() => cycleSwingYWaveform(-1)}
              onInc={() => cycleSwingYWaveform(1)}
            />
            {(() => {
              // SWING HOOK: scene objects named "...-hook".
              const hookOptions = ["", ...sceneHooks];
              const hookIdx = Math.max(0, hookOptions.indexOf(swingHook));
              const stepHook = (dir: number) =>
                setSwingHook(
                  hookOptions[(hookIdx + dir + hookOptions.length) % hookOptions.length],
                );
              return (
                <SettingRow
                  label={t("dial.camera.swingHook")}
                  value={swingHook && hookIdx > 0 ? swingHook : t("dial.camera.swingHookNone")}
                  options={hookOptions.map((h) => h || t("dial.camera.swingHookNone"))}
                  selectedIndex={hookIdx}
                  onSelectIndex={(i) => setSwingHook(hookOptions[i])}
                  onDec={() => stepHook(-1)}
                  onInc={() => stepHook(1)}
                />
              );
            })()}
            {swingHook && sceneHooks.includes(swingHook) && (
              <>
                <label className="flex items-center gap-2 rounded-full border ui-line-1 ui-surface py-1 pl-3 pr-1 backdrop-blur-md">
                  <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">
                    {t("dial.camera.swingCordColor")}
                  </span>
                  <input
                    type="color"
                    value={swingCordColor}
                    onChange={(e) => setSwingCordColor(e.target.value)}
                    className="h-7 w-9 cursor-pointer rounded-full border ui-line-2 bg-transparent p-0"
                  />
                </label>
                <SettingRow
                  label={t("dial.camera.swingCordThickness")}
                  mode="number"
                  value={`${swingCordThickness.toFixed(2)}m`}
                  rawValue={swingCordThickness}
                  onSet={(v) => setSwingCordThickness(v)}
                  min={0}
                  max={2}
                  step={0.02}
                  onDec={() => setSwingCordThickness((v) => Math.max(0, +(v - 0.02).toFixed(2)))}
                  onInc={() => setSwingCordThickness((v) => Math.min(2, +(v + 0.02).toFixed(2)))}
                />
                <SettingRow
                  label={t("dial.camera.swingCordSoftness")}
                  mode="number"
                  value={`${Math.round(swingCordSoftness * 100)}%`}
                  rawValue={swingCordSoftness}
                  onSet={(v) => setSwingCordSoftness(v)}
                  min={0}
                  max={1}
                  step={0.05}
                  onDec={() => setSwingCordSoftness((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
                  onInc={() => setSwingCordSoftness((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
                />
              </>
            )}
          </>
        )}
      </G>
      <G id="interval">
        <SettingRow
          label={t("dial.camera.intervalSession")}
          value={onOff(intervalSessionOn)}
          onDec={() => setIntervalSessionOn(false)}
          onInc={() => setIntervalSessionOn(true)}
        />
        <SettingRow
          label={t("dial.camera.intervalDuration")}
          mode="number"
          value={formatClock(intervalDuration)}
          rawValue={intervalDuration}
          onSet={(v) => setIntervalDuration(Math.max(1, Math.round(v)))}
          min={5}
          max={3600}
          step={5}
          onDec={() => setIntervalDuration((v) => Math.max(5, v - 5))}
          onInc={() => setIntervalDuration((v) => Math.min(3600, v + 5))}
        />
        <SettingRow
          label={t("dial.camera.sessionType")}
          value={t(INTERVAL_SESSION_TYPE_LABEL_KEYS[intervalSessionType])}
          options={INTERVAL_SESSION_TYPES.map((it) => t(INTERVAL_SESSION_TYPE_LABEL_KEYS[it]))}
          selectedIndex={INTERVAL_SESSION_TYPES.indexOf(intervalSessionType)}
          onSelectIndex={(i) => setIntervalSessionType(INTERVAL_SESSION_TYPES[i])}
          onDec={() => setIntervalSessionType((t) => (t === "infinite" ? "fixed" : "infinite"))}
          onInc={() => setIntervalSessionType((t) => (t === "infinite" ? "fixed" : "infinite"))}
        />
        {intervalSessionType === "fixed" && (
          <SettingRow
            label={t("dial.camera.intervalCount")}
            mode="number"
            value={`${intervalCount}`}
            rawValue={intervalCount}
            onSet={(v) => setIntervalCount(Math.max(1, Math.round(v)))}
            min={1}
            max={50}
            step={1}
            onDec={() => setIntervalCount((v) => Math.max(1, v - 1))}
            onInc={() => setIntervalCount((v) => Math.min(50, v + 1))}
          />
        )}
        <SettingRow
          label={t("dial.camera.showStats")}
          value={onOff(intervalShowStats)}
          onDec={() => setIntervalShowStats(false)}
          onInc={() => setIntervalShowStats(true)}
        />
        <SettingRow
          label={t("dial.camera.intervalIncludeFloat")}
          value={onOff(intervalIncludeFloat)}
          onDec={() => setIntervalIncludeFloat(false)}
          onInc={() => setIntervalIncludeFloat(true)}
        />
        <SettingRow
          label={t("dial.camera.intervalIncludeSwing")}
          value={onOff(intervalIncludeSwing)}
          onDec={() => setIntervalIncludeSwing(false)}
          onInc={() => setIntervalIncludeSwing(true)}
        />
      </G>
      <G id="camera">
        <SettingRow
          label={t("dial.camera.posX")}
          mode="number"
          value={`${camOffX.toFixed(2)}m`}
          rawValue={camOffX}
          onSet={setCamOffX}
          min={-10}
          max={10}
          step={0.1}
          onDec={() => setCamOffX((v) => Math.max(-10, +(v - 0.1).toFixed(2)))}
          onInc={() => setCamOffX((v) => Math.min(10, +(v + 0.1).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.camera.posY")}
          mode="number"
          value={`${camOffY.toFixed(2)}m`}
          rawValue={camOffY}
          onSet={setCamOffY}
          min={-10}
          max={10}
          step={0.1}
          onDec={() => setCamOffY((v) => Math.max(-10, +(v - 0.1).toFixed(2)))}
          onInc={() => setCamOffY((v) => Math.min(10, +(v + 0.1).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.camera.posZ")}
          mode="number"
          value={`${camOffZ.toFixed(2)}m`}
          rawValue={camOffZ}
          onSet={setCamOffZ}
          min={-10}
          max={10}
          step={0.1}
          onDec={() => setCamOffZ((v) => Math.max(-10, +(v - 0.1).toFixed(2)))}
          onInc={() => setCamOffZ((v) => Math.min(10, +(v + 0.1).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.camera.fov")}
          mode="number"
          value={`${camFov.toFixed(0)}°`}
          rawValue={camFov}
          onSet={(v) => setCamFov(v)}
          min={20}
          max={140}
          step={1}
          onDec={() => setCamFov((v) => Math.max(20, +(v - 1).toFixed(0)))}
          onInc={() => setCamFov((v) => Math.min(140, +(v + 1).toFixed(0)))}
        />
        <SettingRow
          label={t("dial.camera.near")}
          mode="number"
          value={`${camNear.toFixed(3)}`}
          rawValue={camNear}
          onSet={(v) => setCamNear(Math.max(0.0001, v))}
          min={0.001}
          max={10}
          step={0.01}
          onDec={() => setCamNear((v) => Math.max(0.001, +(v - 0.01).toFixed(3)))}
          onInc={() => setCamNear((v) => Math.min(10, +(v + 0.01).toFixed(3)))}
        />
        <SettingRow
          label={t("dial.camera.far")}
          mode="number"
          value={`${camFar.toFixed(0)}`}
          rawValue={camFar}
          onSet={(v) => setCamFar(Math.max(1, v))}
          min={100}
          max={300000}
          step={100}
          onDec={() => setCamFar((v) => Math.max(100, +(v - 100).toFixed(0)))}
          onInc={() => setCamFar((v) => Math.min(300000, +(v + 100).toFixed(0)))}
        />
        <SettingRow
          label={t("dial.camera.rotation")}
          value={
            leanEnabled ? t("camera.rotationValue.leanForward") : t("camera.rotationValue.fixed")
          }
          onDec={() => setLeanEnabled(false)}
          onInc={() => setLeanEnabled(true)}
        />
        <SettingRow
          label={t("dial.camera.wakeLock")}
          value={onOff(wakeLock)}
          onDec={() => setWakeLock(false)}
          onInc={() => setWakeLock(true)}
        />
      </G>
      <G id="bather">
        <SettingRow
          label={t("dial.camera.goggles")}
          value={onOff(gogglesOn)}
          onDec={() => setGogglesOn(false)}
          onInc={() => setGogglesOn(true)}
        />
        <SettingRow
          label={t("dial.camera.gogglesBlur")}
          mode="number"
          value={`${Math.round(gogglesBlur * 100)}%`}
          rawValue={gogglesBlur}
          onSet={(v) => setGogglesBlur(v)}
          min={0}
          max={1}
          step={0.05}
          onDec={() => setGogglesBlur((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
          onInc={() => setGogglesBlur((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.camera.gogglesLoop")}
          value={onOff(gogglesLoop)}
          onDec={() => setGogglesLoop(false)}
          onInc={() => setGogglesLoop(true)}
        />
        <SettingRow
          label={t("dial.camera.gogglesIntensity")}
          mode="number"
          value={`${Math.round(gogglesIntensity * 100)}%`}
          rawValue={gogglesIntensity}
          onSet={(v) => setGogglesIntensity(v)}
          min={0}
          max={1}
          step={0.05}
          onDec={() => setGogglesIntensity((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
          onInc={() => setGogglesIntensity((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.camera.gogglesFpsCap")}
          mode="number"
          value={`${gogglesFpsCap} fps`}
          rawValue={gogglesFpsCap}
          onSet={(v) => setGogglesFpsCap(Math.max(1, Math.round(v)))}
          min={10}
          max={60}
          step={5}
          onDec={() => setGogglesFpsCap((v) => Math.max(10, v - 5))}
          onInc={() => setGogglesFpsCap((v) => Math.min(60, v + 5))}
        />
        <HoodSettings
          hoodOn={hoodOn}
          setHoodOn={setHoodOn}
          layer1={{
            on: true,
            height: hoodHeight,
            opening: hoodOpening,
            openingWidth: hoodOpeningWidth,
            color: hoodColor,
            metallic: hoodMetallic,
            motion: hoodMotion,
            lowerOn: hoodLowerOn,
            lowerHeight: hoodLowerHeight,
            zipperOn: hoodZipperOn,
            waterOn: hoodWaterOn,
            waterLevel: hoodWaterLevel,
            drop: hoodDrop,
            weight: hoodWeight,
            wrinkles: hoodWrinkles,
            darkness: hoodDarkness,
            roundness: hoodRoundness,
            style: hoodStyle,
            puffSize: hoodPuffSize,
            puffHeight: hoodPuffHeight,
            cuff: hoodCuffOn,
            cuffHeight: hoodCuffHeight,
            cuffSize: hoodCuffSize,
            cuffCustom: hoodCuffCustom,
            cuffColor: hoodCuffColor,
            cuffMetallic: hoodCuffMetallic,
            cuffMaterial: hoodCuffMaterial,
            hanging: hoodHanging,
            waterCalm: hoodWaterCalm,
            cuffTop: hoodCuffTop,
            zipperFixed: hoodZipperFixed,
            zipperPullOut: hoodZipperPullOut,
            reflectLight: hoodReflectLight,
            puffThickness: hoodPuffThickness,
            puffInflate: hoodPuffInflate,
          }}
          setLayer1={(p) => {
            if (p.height !== undefined) setHoodHeight(p.height);
            if (p.opening !== undefined) setHoodOpening(p.opening);
            if (p.openingWidth !== undefined) setHoodOpeningWidth(p.openingWidth);
            if (p.color !== undefined) setHoodColor(p.color);
            if (p.metallic !== undefined) setHoodMetallic(p.metallic);
            if (p.motion !== undefined) setHoodMotion(p.motion);
            if (p.lowerOn !== undefined) setHoodLowerOn(p.lowerOn);
            if (p.lowerHeight !== undefined) setHoodLowerHeight(p.lowerHeight);
            if (p.zipperOn !== undefined) setHoodZipperOn(p.zipperOn);
            if (p.waterOn !== undefined) setHoodWaterOn(p.waterOn);
            if (p.waterLevel !== undefined) setHoodWaterLevel(p.waterLevel);
            if (p.drop !== undefined) setHoodDrop(p.drop);
            if (p.weight !== undefined) setHoodWeight(p.weight);
            if (p.wrinkles !== undefined) setHoodWrinkles(p.wrinkles);
            if (p.darkness !== undefined) setHoodDarkness(p.darkness);
            if (p.roundness !== undefined) setHoodRoundness(p.roundness);
            if (p.style !== undefined) setHoodStyle(p.style);
            if (p.puffSize !== undefined) setHoodPuffSize(p.puffSize);
            if (p.puffHeight !== undefined) setHoodPuffHeight(p.puffHeight);
            if (p.cuff !== undefined) setHoodCuffOn(p.cuff);
            if (p.cuffHeight !== undefined) setHoodCuffHeight(p.cuffHeight);
            if (p.cuffSize !== undefined) setHoodCuffSize(p.cuffSize);
            if (p.cuffCustom !== undefined) setHoodCuffCustom(p.cuffCustom);
            if (p.cuffColor !== undefined) setHoodCuffColor(p.cuffColor);
            if (p.cuffMetallic !== undefined) setHoodCuffMetallic(p.cuffMetallic);
            if (p.cuffMaterial !== undefined) setHoodCuffMaterial(p.cuffMaterial);
            if (p.hanging !== undefined) setHoodHanging(p.hanging);
            if (p.waterCalm !== undefined) setHoodWaterCalm(p.waterCalm);
            if (p.cuffTop !== undefined) setHoodCuffTop(p.cuffTop);
            if (p.zipperFixed !== undefined) setHoodZipperFixed(p.zipperFixed);
            if (p.zipperPullOut !== undefined) setHoodZipperPullOut(p.zipperPullOut);
            if (p.reflectLight !== undefined) setHoodReflectLight(p.reflectLight);
            if (p.puffThickness !== undefined) setHoodPuffThickness(p.puffThickness);
            if (p.puffInflate !== undefined) setHoodPuffInflate(p.puffInflate);
          }}
          extraLayers={hoodExtraLayers}
          setExtraLayers={setHoodExtraLayers}
        />
      </G>
      <G id="graphics">
        <SettingRow
          label={t("dial.camera.lowGraphicsMode")}
          value={onOff(lowGraphicsMode)}
          onDec={() => setLowGraphicsMode(false)}
          onInc={() => setLowGraphicsMode(true)}
        />
        <SettingRow
          label={t("dial.camera.targetFps")}
          mode="number"
          value={`${targetFps} fps`}
          rawValue={targetFps}
          onSet={(v) => setTargetFps(Math.max(1, Math.round(v)))}
          min={10}
          max={120}
          step={5}
          onDec={() => setTargetFps((v) => Math.max(10, v - 5))}
          onInc={() => setTargetFps((v) => Math.min(120, v + 5))}
        />
        <SettingRow
          label={t("dial.camera.resolutionScale")}
          mode="number"
          value={`${Math.round(resolutionScale * 100)}%`}
          rawValue={resolutionScale}
          onSet={(v) => setResolutionScale(Math.max(0.05, v))}
          min={0.25}
          max={1.5}
          step={0.05}
          onDec={() => setResolutionScale((v) => Math.max(0.25, +(v - 0.05).toFixed(2)))}
          onInc={() => setResolutionScale((v) => Math.min(1.5, +(v + 0.05).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.camera.chromaticAberration")}
          value={onOff(chromaticAberrationOn)}
          onDec={() => setChromaticAberrationOn(false)}
          onInc={() => setChromaticAberrationOn(true)}
        />
        <SettingRow
          label={t("dial.camera.chromaticAberrationAmount")}
          mode="number"
          value={`${Math.round(chromaticAberrationAmount * 100)}%`}
          rawValue={chromaticAberrationAmount}
          onSet={(v) => setChromaticAberrationAmount(v)}
          min={0}
          max={1}
          step={0.05}
          onDec={() => setChromaticAberrationAmount((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
          onInc={() => setChromaticAberrationAmount((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.camera.betterLighting")}
          value={onOff(betterLightingOn)}
          onDec={() => setBetterLightingOn(false)}
          onInc={() => setBetterLightingOn(true)}
        />
        {betterLightingOn && (
          <>
            <SettingRow
              label={t("dial.camera.lightingReflStrength")}
              mode="number"
              value={`${Math.round(lightingReflStrength * 100)}%`}
              rawValue={lightingReflStrength}
              onSet={(v) => setLightingReflStrength(v)}
              min={0}
              max={2}
              step={0.1}
              onDec={() => setLightingReflStrength((v) => Math.max(0, +(v - 0.1).toFixed(2)))}
              onInc={() => setLightingReflStrength((v) => Math.min(2, +(v + 0.1).toFixed(2)))}
            />
          </>
        )}
        <SettingRow
          label={t("dial.camera.shadows")}
          value={onOff(shadowsOn)}
          onDec={() => setShadowsOn(false)}
          onInc={() => setShadowsOn(true)}
        />
        <SettingRow
          label={t("dial.camera.retro")}
          value={onOff(retroOn)}
          onDec={() => setRetroOn(false)}
          onInc={() => setRetroOn(true)}
        />
        {retroOn && (
          <>
            <SettingRow
              label={t("dial.camera.retroPalette")}
              value={t(`dial.camera.retroPaletteValue.${retroPalette}`)}
              options={RETRO_PALETTES.map((m) => t(`dial.camera.retroPaletteValue.${m}`))}
              selectedIndex={Math.max(0, RETRO_PALETTES.indexOf(retroPalette))}
              onSelectIndex={(i) => setRetroPalette(RETRO_PALETTES[i] as RetroPalette)}
              onDec={() =>
                setRetroPalette(
                  (m) =>
                    RETRO_PALETTES[
                      (RETRO_PALETTES.indexOf(m) - 1 + RETRO_PALETTES.length) %
                        RETRO_PALETTES.length
                    ],
                )
              }
              onInc={() =>
                setRetroPalette(
                  (m) => RETRO_PALETTES[(RETRO_PALETTES.indexOf(m) + 1) % RETRO_PALETTES.length],
                )
              }
            />
            <SettingRow
              label={t("dial.camera.retroPixelSize")}
              mode="number"
              value={`${retroPixelSize}px`}
              rawValue={retroPixelSize}
              onSet={(v) => setRetroPixelSize(Math.max(1, v))}
              min={1}
              max={8}
              step={1}
              onDec={() => setRetroPixelSize((v) => Math.max(1, +(v - 1).toFixed(0)))}
              onInc={() => setRetroPixelSize((v) => Math.min(8, +(v + 1).toFixed(0)))}
            />
            <SettingRow
              label={t("dial.camera.retroDither")}
              mode="number"
              value={`${Math.round(retroDither * 100)}%`}
              rawValue={retroDither}
              onSet={(v) => setRetroDither(v)}
              min={0}
              max={1}
              step={0.05}
              onDec={() => setRetroDither((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
              onInc={() => setRetroDither((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
            />
            <SettingRow
              label={t("dial.camera.retroScanlines")}
              mode="number"
              value={`${Math.round(retroScanlines * 100)}%`}
              rawValue={retroScanlines}
              onSet={(v) => setRetroScanlines(v)}
              min={0}
              max={1}
              step={0.05}
              onDec={() => setRetroScanlines((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
              onInc={() => setRetroScanlines((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
            />
          </>
        )}
      </G>
      {/* ── vatten ── */}
      <G id="state">
        <PresetControls
          scope="vatten"
          label={t("presets.scope.vatten")}
          savedPresets={savedPresets}
          exportSettingsFile={exportSettingsFile}
          importSettingsFile={importSettingsFile}
          savePresetAs={savePresetAs}
          loadSavedPreset={loadSavedPreset}
          deleteSavedPreset={deleteSavedPreset}
        />
      </G>
      <G id="water">
        <SettingRow
          label={t("dial.water.color")}
          value={t(WATER_COLOR_LABEL_KEYS[WATER_COLORS[waterColorIdx].id])}
          options={WATER_COLORS.map((w) => t(WATER_COLOR_LABEL_KEYS[w.id]))}
          selectedIndex={waterColorIdx}
          onSelectIndex={setWaterColorIdx}
          onDec={() => setWaterColorIdx((i) => (i - 1 + WATER_COLORS.length) % WATER_COLORS.length)}
          onInc={() => setWaterColorIdx((i) => (i + 1) % WATER_COLORS.length)}
        />
        {surfaces.length > 0 && (
          <SettingRow
            label={t("dial.water.reflection")}
            value={
              surfaceId
                ? (surfaces.find((s) => s.id === surfaceId)?.name ?? surfaceId)
                : t("common.off")
            }
            options={[t("common.off"), ...surfaces.map((s) => s.name)]}
            selectedIndex={surfaceId ? 1 + surfaces.findIndex((s) => s.id === surfaceId) : 0}
            onSelectIndex={(i) => setSurfaceId(i === 0 ? null : (surfaces[i - 1]?.id ?? null))}
            onDec={() => cycleSurface(-1)}
            onInc={() => cycleSurface(1)}
          />
        )}
        {surfaceId && (
          <SettingRow
            label={t("dial.water.reflStrength")}
            mode="number"
            value={`${Math.round(reflStrength * 100)}%`}
            rawValue={reflStrength}
            onSet={(v) => setReflStrength(v)}
            min={0}
            max={3}
            step={0.05}
            onDec={() => setReflStrength((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
            onInc={() => setReflStrength((v) => Math.min(3, +(v + 0.05).toFixed(2)))}
          />
        )}
        <SettingRow
          label={t("dial.water.waveMaterial")}
          value={
            raytracedMaterial
              ? t("dial.water.waveMaterialValue.raytraced")
              : sphereMaterial
                ? t("dial.water.waveMaterialValue.sphereMap")
                : t("dial.water.waveMaterialValue.standard")
          }
          // STANDARD -> SPHERE MAP -> RAYTRACED; the two non-standard
          // materials are exclusive, so one index drives both flags.
          onDec={() => {
            const i = raytracedMaterial ? 2 : sphereMaterial ? 1 : 0;
            const next = Math.max(0, i - 1);
            setSphereMaterial(next === 1);
            setRaytracedMaterial(next === 2);
          }}
          onInc={() => {
            const i = raytracedMaterial ? 2 : sphereMaterial ? 1 : 0;
            const next = Math.min(2, i + 1);
            setSphereMaterial(next === 1);
            setRaytracedMaterial(next === 2);
          }}
        />
        <SettingRow
          label={t("dial.water.cloudSurface")}
          value={onOff(waterCloudsOn)}
          onDec={() => setWaterCloudsOn(false)}
          onInc={() => setWaterCloudsOn(true)}
        />
        {raytracedMaterial && (
          <SettingRow
            label={t("dial.water.raytracedStrength")}
            mode="number"
            value={`${Math.round(raytracedStrength * 100)}%`}
            rawValue={raytracedStrength}
            onSet={(v) => setRaytracedStrength(v)}
            min={0}
            max={1}
            step={0.05}
            onDec={() => setRaytracedStrength((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
            onInc={() => setRaytracedStrength((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
          />
        )}
        {sphereMaterial && (
          <SettingRow
            label={t("dial.water.sphereStrength")}
            mode="number"
            value={`${Math.round(sphereStrength * 100)}%`}
            rawValue={sphereStrength}
            onSet={(v) => setSphereStrength(v)}
            min={0}
            max={1}
            step={0.05}
            onDec={() => setSphereStrength((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
            onInc={() => setSphereStrength((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
          />
        )}
        <SettingRow
          label={t("common.opacity")}
          mode="number"
          value={`${Math.round(waterOpacity * 100)}%`}
          rawValue={waterOpacity}
          onSet={setWaterOpacity}
          min={0}
          max={1}
          step={0.05}
          onDec={() => setWaterOpacity((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
          onInc={() => setWaterOpacity((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
        />
        <Findable label={t("dial.water.waveBgCustomColor")}>
          <div className="flex items-center gap-2 rounded-full border ui-line-1 ui-surface py-1 pl-3 pr-1 backdrop-blur-md">
            <label className="flex items-center gap-2">
              <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">
                {t("dial.water.waveBgCustomColor")}
              </span>
              {waveBgCustomColor === "" && (
                <span className="text-[9px] font-light tracking-[0.2em] ui-ink-faint">
                  {t("dial.water.waveBgNatural")}
                </span>
              )}
              <input
                type="color"
                value={waveBgCustomColor || "#0b3a4a"}
                onChange={(e) => setWaveBgCustomColor(e.target.value)}
                className="h-7 w-9 cursor-pointer rounded-full border ui-line-2 bg-transparent p-0"
              />
            </label>
            {waveBgCustomColor !== "" && (
              <button
                type="button"
                onClick={() => setWaveBgCustomColor("")}
                className="h-7 rounded-full border ui-line-2 ui-tint-1 px-2 text-[9px] tracking-[0.2em] ui-ink transition active:scale-95 ui-press"
              >
                {t("dial.water.waveBgNatural")}
              </button>
            )}
          </div>
        </Findable>
        <SettingRow
          label={t("dial.water.waveBgOpacity")}
          mode="number"
          value={`${Math.round(waveBgOpacity * 100)}%`}
          rawValue={waveBgOpacity}
          onSet={(v) => setWaveBgOpacity(v)}
          min={0}
          max={1}
          step={0.05}
          onDec={() => setWaveBgOpacity((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
          onInc={() => setWaveBgOpacity((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.water.foam")}
          mode="number"
          value={`${Math.round(foamAmount * 100)}%`}
          rawValue={foamAmount}
          onSet={(v) => setFoamAmount(v)}
          min={0}
          max={2}
          step={0.05}
          onDec={() => setFoamAmount((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
          onInc={() => setFoamAmount((v) => Math.min(2, +(v + 0.05).toFixed(2)))}
        />
        {foamAmount > 0 && (
          <>
            <SettingRow
              label={t("dial.water.foamCoverage")}
              mode="number"
              value={`${Math.round(foamCoverage * 100)}%`}
              rawValue={foamCoverage}
              onSet={(v) => setFoamCoverage(v)}
              min={0}
              max={1}
              step={0.05}
              onDec={() => setFoamCoverage((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
              onInc={() => setFoamCoverage((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
            />
            <SettingRow
              label={t("dial.water.foamSize")}
              mode="number"
              value={`${foamScale.toFixed(2)}x`}
              rawValue={foamScale}
              onSet={(v) => setFoamScale(v)}
              min={0.25}
              max={4}
              step={0.05}
              onDec={() => setFoamScale((v) => Math.max(0.25, +(v - 0.05).toFixed(2)))}
              onInc={() => setFoamScale((v) => Math.min(4, +(v + 0.05).toFixed(2)))}
            />
            <label className="flex items-center gap-2 rounded-full border ui-line-1 ui-surface py-1 pl-3 pr-1 backdrop-blur-md">
              <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">
                {t("dial.water.foamColor")}
              </span>
              <input
                type="color"
                value={foamColor}
                onChange={(e) => setFoamColor(e.target.value)}
                className="h-7 w-9 cursor-pointer rounded-full border ui-line-2 bg-transparent p-0"
              />
            </label>
          </>
        )}
        <SettingRow
          label={t("dial.water.detailWaves")}
          mode="number"
          value={`${Math.round(detailWaves * 100)}%`}
          rawValue={detailWaves}
          onSet={(v) => setDetailWaves(v)}
          min={0}
          max={1.5}
          step={0.05}
          onDec={() => setDetailWaves((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
          onInc={() => setDetailWaves((v) => Math.min(1.5, +(v + 0.05).toFixed(2)))}
        />
        {detailWaves > 0 && (
          <SettingRow
            label={t("dial.water.detailSize")}
            mode="number"
            value={`${detailScale.toFixed(2)}x`}
            rawValue={detailScale}
            onSet={(v) => setDetailScale(v)}
            min={0.25}
            max={4}
            step={0.05}
            onDec={() => setDetailScale((v) => Math.max(0.25, +(v - 0.05).toFixed(2)))}
            onInc={() => setDetailScale((v) => Math.min(4, +(v + 0.05).toFixed(2)))}
          />
        )}
        <Findable label={t("dial.water.pickColor")}>
          <WaterColorPicker
            pickColorLabel={t("dial.water.pickColor")}
            hueLabel={t("dial.water.hue")}
            alphaLabel={t("dial.water.colorAlpha")}
            hue={waterHue}
            setHue={setWaterHue}
            alpha={waterColorAlpha}
            setAlpha={setWaterColorAlpha}
          />
        </Findable>
        <SettingRow
          label={t("dial.water.saturation")}
          mode="number"
          value={`${waterSat.toFixed(2)}x`}
          rawValue={waterSat}
          onSet={setWaterSat}
          min={0}
          max={2}
          step={0.05}
          onDec={() => setWaterSat((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
          onInc={() => setWaterSat((v) => Math.min(2, +(v + 0.05).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.water.brightness")}
          mode="number"
          value={`${waterBright.toFixed(2)}x`}
          rawValue={waterBright}
          onSet={setWaterBright}
          min={0.1}
          max={2.5}
          step={0.05}
          onDec={() => setWaterBright((v) => Math.max(0.1, +(v - 0.05).toFixed(2)))}
          onInc={() => setWaterBright((v) => Math.min(2.5, +(v + 0.05).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.water.surfBright")}
          mode="number"
          value={`${surfBright.toFixed(2)}x`}
          rawValue={surfBright}
          onSet={(v) => setSurfBright(v)}
          min={0.1}
          max={3}
          step={0.05}
          onDec={() => setSurfBright((v) => Math.max(0.1, +(v - 0.05).toFixed(2)))}
          onInc={() => setSurfBright((v) => Math.min(3, +(v + 0.05).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.water.surfSat")}
          mode="number"
          value={`${surfSat.toFixed(2)}x`}
          rawValue={surfSat}
          onSet={(v) => setSurfSat(v)}
          min={0}
          max={2}
          step={0.05}
          onDec={() => setSurfSat((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
          onInc={() => setSurfSat((v) => Math.min(2, +(v + 0.05).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.water.turbidity")}
          mode="number"
          value={turbidity <= 0.001 ? t("common.off") : `${Math.round(turbidity * 100)}%`}
          rawValue={turbidity}
          onSet={(v) => setTurbidity(v)}
          min={0}
          max={1}
          step={0.05}
          onDec={() => setTurbidity((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
          onInc={() => setTurbidity((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
        />
      </G>
      <G id="bottom">
        <SettingRow
          label={t("dial.water.bottom")}
          value={t(BOTTOM_LABEL_KEYS[BOTTOM_OPTIONS[bottomIdx].id])}
          options={BOTTOM_OPTIONS.map((b) => t(BOTTOM_LABEL_KEYS[b.id]))}
          selectedIndex={bottomIdx}
          onSelectIndex={setBottomIdx}
          onDec={() => setBottomIdx((i) => (i - 1 + BOTTOM_OPTIONS.length) % BOTTOM_OPTIONS.length)}
          onInc={() => setBottomIdx((i) => (i + 1) % BOTTOM_OPTIONS.length)}
        />
        {BOTTOM_OPTIONS[bottomIdx].id === "custom" && (
          <label className="flex items-center gap-2 rounded-full border ui-line-1 ui-surface py-1 pl-3 pr-1 backdrop-blur-md">
            <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">
              {t("dial.water.bottomColor")}
            </span>
            <input
              type="color"
              value={bottomColor}
              onChange={(e) => setBottomColor(e.target.value)}
              className="h-7 w-9 cursor-pointer rounded-full border ui-line-2 bg-transparent p-0"
            />
          </label>
        )}
        {BOTTOM_OPTIONS[bottomIdx].id === "clouds" && (
          <SettingRow
            label={t("dial.water.floorCloudsAnimate")}
            value={onOff(floorCloudsAnimated)}
            onDec={() => setFloorCloudsAnimated(false)}
            onInc={() => setFloorCloudsAnimated(true)}
          />
        )}
        <SettingRow
          label={t("dial.water.depth")}
          mode="number"
          value={`${floorDepth.toFixed(1)}m`}
          rawValue={floorDepth}
          onSet={(v) => setFloorDepth(v)}
          min={1}
          max={60}
          step={0.5}
          onDec={() => setFloorDepth((v) => Math.max(1, +(v - 0.5).toFixed(2)))}
          onInc={() => setFloorDepth((v) => Math.min(60, +(v + 0.5).toFixed(2)))}
        />
        <SettingRow
          label={t("common.texture")}
          value={onOff(floorTexture)}
          onDec={() => setFloorTexture(false)}
          onInc={() => setFloorTexture(true)}
        />
        <SettingRow
          label={t("dial.water.depthSine")}
          value={onOff(depthSineOn)}
          onDec={() => setDepthSineOn(false)}
          onInc={() => setDepthSineOn(true)}
        />
        <SettingRow
          label={t("dial.water.sineWaveform")}
          value={t(DEPTH_SINE_WAVEFORM_LABEL_KEYS[depthSineWaveform])}
          options={DEPTH_SINE_WAVEFORMS.map((w) => t(DEPTH_SINE_WAVEFORM_LABEL_KEYS[w]))}
          selectedIndex={DEPTH_SINE_WAVEFORMS.indexOf(depthSineWaveform)}
          onSelectIndex={(i) => setDepthSineWaveform(DEPTH_SINE_WAVEFORMS[i])}
          onDec={() => cycleDepthSineWaveform(-1)}
          onInc={() => cycleDepthSineWaveform(1)}
        />
        <SettingRow
          label={t("dial.water.sineAmp")}
          mode="number"
          value={`${depthSineAmp.toFixed(2)}m`}
          rawValue={depthSineAmp}
          onSet={(v) => setDepthSineAmp(v)}
          min={0}
          max={90}
          step={0.25}
          onDec={() => setDepthSineAmp((v) => Math.max(0, +(v - 0.25).toFixed(2)))}
          onInc={() => setDepthSineAmp((v) => Math.min(90, +(v + 0.25).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.water.sineFreq")}
          mode="number"
          value={`${depthSineFreq.toFixed(2)}Hz`}
          rawValue={depthSineFreq}
          onSet={(v) => setDepthSineFreq(v)}
          min={0.001}
          max={2}
          step={0.01}
          onDec={() => setDepthSineFreq((v) => Math.max(0.001, +(v - 0.01).toFixed(3)))}
          onInc={() => setDepthSineFreq((v) => Math.min(2, +(v + 0.01).toFixed(3)))}
        />
        <SettingRow
          label={t("dial.water.sineSpeed")}
          mode="number"
          value={`${depthSineSpeed.toFixed(2)}x`}
          rawValue={depthSineSpeed}
          onSet={(v) => setDepthSineSpeed(v)}
          min={0.1}
          max={5}
          step={0.05}
          onDec={() => setDepthSineSpeed((v) => Math.max(0.1, +(v - 0.05).toFixed(2)))}
          onInc={() => setDepthSineSpeed((v) => Math.min(5, +(v + 0.05).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.water.sineInterval")}
          mode="number"
          value={`${depthSineInterval.toFixed(1)}s`}
          rawValue={depthSineInterval}
          onSet={(v) => setDepthSineInterval(v)}
          min={0.2}
          max={20}
          step={0.1}
          onDec={() => setDepthSineInterval((v) => Math.max(0.2, +(v - 0.1).toFixed(2)))}
          onInc={() => setDepthSineInterval((v) => Math.min(20, +(v + 0.1).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.water.sinePeak")}
          mode="number"
          value={depthSinePeak.toFixed(2)}
          rawValue={depthSinePeak}
          onSet={(v) => setDepthSinePeak(v)}
          min={1}
          max={6}
          step={0.1}
          onDec={() => setDepthSinePeak((v) => Math.max(1, +(v - 0.1).toFixed(2)))}
          onInc={() => setDepthSinePeak((v) => Math.min(6, +(v + 0.1).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.water.driftSpeed")}
          mode="number"
          value={`${depthDriftSpeed.toFixed(2)}m/s`}
          rawValue={depthDriftSpeed}
          onSet={(v) => setDepthDriftSpeed(v)}
          min={-20}
          max={20}
          step={0.1}
          onDec={() => setDepthDriftSpeed((v) => Math.max(-20, +(v - 0.1).toFixed(2)))}
          onInc={() => setDepthDriftSpeed((v) => Math.min(20, +(v + 0.1).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.water.driftSine")}
          value={onOff(depthDriftSineOn)}
          onDec={() => setDepthDriftSineOn(false)}
          onInc={() => setDepthDriftSineOn(true)}
        />
        {depthDriftSineOn && (
          <>
            <SettingRow
              label={t("dial.water.driftSineAmp")}
              mode="number"
              value={`${depthDriftSineAmp.toFixed(2)}m/s`}
              rawValue={depthDriftSineAmp}
              onSet={(v) => setDepthDriftSineAmp(v)}
              min={0}
              max={20}
              step={0.1}
              onDec={() => setDepthDriftSineAmp((v) => Math.max(0, +(v - 0.1).toFixed(2)))}
              onInc={() => setDepthDriftSineAmp((v) => Math.min(20, +(v + 0.1).toFixed(2)))}
            />
            <SettingRow
              label={t("dial.water.driftSineSpeed")}
              mode="number"
              value={`${depthDriftSineSpeed.toFixed(2)}Hz`}
              rawValue={depthDriftSineSpeed}
              onSet={(v) => setDepthDriftSineSpeed(v)}
              min={0.01}
              max={2}
              step={0.01}
              onDec={() => setDepthDriftSineSpeed((v) => Math.max(0.01, +(v - 0.01).toFixed(2)))}
              onInc={() => setDepthDriftSineSpeed((v) => Math.min(2, +(v + 0.01).toFixed(2)))}
            />
            <SettingRow
              label={t("dial.water.driftSinePhase")}
              mode="number"
              value={`${Math.round(depthDriftSinePhase)}°`}
              rawValue={depthDriftSinePhase}
              onSet={(v) => setDepthDriftSinePhase(((v % 360) + 360) % 360)}
              min={0}
              max={359}
              step={1}
              onDec={() => setDepthDriftSinePhase((v) => (v + 345) % 360)}
              onInc={() => setDepthDriftSinePhase((v) => (v + 15) % 360)}
            />
          </>
        )}
      </G>
      <G id="water">
        <SettingRow
          label={t("dial.water.surface")}
          value={
            hideWater ? t("dial.water.surfaceValue.hide") : t("dial.water.surfaceValue.visible")
          }
          onDec={() => setHideWater(true)}
          onInc={() => setHideWater(false)}
        />
        <SettingRow
          label={t("dial.water.caustics")}
          value={onOff(causticsOn)}
          onDec={() => setCausticsOn(false)}
          onInc={() => setCausticsOn(true)}
        />
        <SettingRow
          label={t("dial.water.glow")}
          value={onOff(waterGlowOn)}
          onDec={() => setWaterGlowOn(false)}
          onInc={() => setWaterGlowOn(true)}
        />
        {waterGlowOn && (
          <>
            <label className="flex items-center gap-2 rounded-full border ui-line-1 ui-surface py-1 pl-3 pr-1 backdrop-blur-md">
              <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">
                {t("dial.water.glowColor")}
              </span>
              <input
                type="color"
                value={waterGlowColor}
                onChange={(e) => setWaterGlowColor(e.target.value)}
                className="h-7 w-9 cursor-pointer rounded-full border ui-line-2 bg-transparent p-0"
              />
            </label>
            <SettingRow
              label={t("dial.water.glowStrength")}
              mode="number"
              value={`${Math.round(waterGlowStrength * 100)}%`}
              rawValue={waterGlowStrength}
              onSet={(v) => setWaterGlowStrength(v)}
              min={0}
              max={2}
              step={0.05}
              onDec={() => setWaterGlowStrength((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
              onInc={() => setWaterGlowStrength((v) => Math.min(2, +(v + 0.05).toFixed(2)))}
            />
            <SettingRow
              label={t("dial.water.glowEveningOnly")}
              value={onOff(waterGlowEveningOnly)}
              onDec={() => setWaterGlowEveningOnly(false)}
              onInc={() => setWaterGlowEveningOnly(true)}
            />
          </>
        )}
      </G>
      {/* ── miljo ── */}
      <G id="state">
        <PresetControls
          scope="miljo"
          label={t("presets.scope.miljo")}
          savedPresets={savedPresets}
          exportSettingsFile={exportSettingsFile}
          importSettingsFile={importSettingsFile}
          savePresetAs={savePresetAs}
          loadSavedPreset={loadSavedPreset}
          deleteSavedPreset={deleteSavedPreset}
        />
      </G>
      <G id="time">
        <SettingRow
          label={t("dial.env.time")}
          value={todLabel}
          onDec={() => setTimeOfDay((v) => (v - 0.02 + 1) % 1)}
          onInc={() => setTimeOfDay((v) => (v + 0.02) % 1)}
        />
        <SettingRow
          label={t("dial.env.clock")}
          value={onOff(clockOn)}
          onDec={() => setClockOn(false)}
          onInc={() => setClockOn(true)}
        />
      </G>
      <G id="clouds">
        <SettingRow
          label={t("dial.env.midClouds")}
          value={onOff(midCloudsOn)}
          onDec={() => setMidCloudsOn(false)}
          onInc={() => setMidCloudsOn(true)}
        />
        <SettingRow
          label={t("dial.env.midCloudsHeight")}
          mode="number"
          value={`${Math.round(midCloudsHeight * 100)}%`}
          rawValue={midCloudsHeight}
          onSet={(v) => setMidCloudsHeight(v)}
          min={0.05}
          max={0.95}
          step={0.05}
          onDec={() => setMidCloudsHeight((v) => Math.max(0.05, +(v - 0.05).toFixed(2)))}
          onInc={() => setMidCloudsHeight((v) => Math.min(0.95, +(v + 0.05).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.env.skyClouds")}
          value={onOff(skyCloudsOn)}
          onDec={() => setSkyCloudsOn(false)}
          onInc={() => setSkyCloudsOn(true)}
        />
        <SettingRow
          label={t("dial.env.skyCloudsAltitude")}
          mode="number"
          value={`${Math.round(skyCloudsAltitude)} m`}
          rawValue={skyCloudsAltitude}
          onSet={(v) => setSkyCloudsAltitude(Math.round(v))}
          min={SKY_CLOUDS_ALTITUDE_MIN}
          max={SKY_CLOUDS_ALTITUDE_MAX}
          step={50}
          onDec={() => setSkyCloudsAltitude((v) => Math.max(SKY_CLOUDS_ALTITUDE_MIN, v - 50))}
          onInc={() => setSkyCloudsAltitude((v) => Math.min(SKY_CLOUDS_ALTITUDE_MAX, v + 50))}
        />
        <SettingRow
          label={t("dial.env.bottomClouds3d")}
          value={onOff(bottomClouds3d)}
          onDec={() => setBottomClouds3d(false)}
          onInc={() => setBottomClouds3d(true)}
        />
        <SettingRow
          label={t("dial.env.midClouds3d")}
          value={onOff(midClouds3d)}
          onDec={() => setMidClouds3d(false)}
          onInc={() => setMidClouds3d(true)}
        />
        <SettingRow
          label={t("dial.env.skyClouds3d")}
          value={onOff(skyClouds3d)}
          onDec={() => setSkyClouds3d(false)}
          onInc={() => setSkyClouds3d(true)}
        />
        <SettingRow
          label={t("dial.env.bottomCloudsScale")}
          mode="number"
          value={`${bottomCloudsScale.toFixed(2)}x`}
          rawValue={bottomCloudsScale}
          onSet={(v) => setBottomCloudsScale(v)}
          min={CLOUD_SCALE_MIN}
          max={CLOUD_SCALE_MAX}
          step={0.25}
          onDec={() =>
            setBottomCloudsScale((v) => Math.max(CLOUD_SCALE_MIN, +(v - 0.25).toFixed(2)))
          }
          onInc={() =>
            setBottomCloudsScale((v) => Math.min(CLOUD_SCALE_MAX, +(v + 0.25).toFixed(2)))
          }
        />
        <SettingRow
          label={t("dial.env.skyCloudsScale")}
          mode="number"
          value={`${skyCloudsScale.toFixed(2)}x`}
          rawValue={skyCloudsScale}
          onSet={(v) => setSkyCloudsScale(v)}
          min={CLOUD_SCALE_MIN}
          max={CLOUD_SCALE_MAX}
          step={0.25}
          onDec={() => setSkyCloudsScale((v) => Math.max(CLOUD_SCALE_MIN, +(v - 0.25).toFixed(2)))}
          onInc={() => setSkyCloudsScale((v) => Math.min(CLOUD_SCALE_MAX, +(v + 0.25).toFixed(2)))}
        />
        <SettingRow
          label={t("dial.env.cloudFadeSpeed")}
          mode="number"
          value={`${cloudFadeSpeed.toFixed(1)}x`}
          rawValue={cloudFadeSpeed}
          onSet={(v) => setCloudFadeSpeed(v)}
          min={0.2}
          max={12}
          step={0.2}
          onDec={() => setCloudFadeSpeed((v) => Math.max(0.2, +(v - 0.2).toFixed(1)))}
          onInc={() => setCloudFadeSpeed((v) => Math.min(12, +(v + 0.2).toFixed(1)))}
        />
        <SettingRow
          label={t("dial.env.skyPuffs")}
          value={onOff(skyPuffsOn)}
          onDec={() => setSkyPuffsOn(false)}
          onInc={() => setSkyPuffsOn(true)}
        />
        {skyPuffsOn && (
          <>
            <SettingRow
              label={t("dial.env.skyPuffsCount")}
              mode="number"
              value={`${skyPuffsCount}`}
              rawValue={skyPuffsCount}
              onSet={(v) => setSkyPuffsCount(Math.max(1, Math.round(v)))}
              min={1}
              max={20}
              step={1}
              onDec={() => setSkyPuffsCount((v) => Math.max(1, v - 1))}
              onInc={() => setSkyPuffsCount((v) => Math.min(20, v + 1))}
            />
            <SettingRow
              label={t("dial.env.skyPuffsSize")}
              mode="number"
              value={`${skyPuffsSize.toFixed(0)}m`}
              rawValue={skyPuffsSize}
              onSet={(v) => setSkyPuffsSize(v)}
              min={100}
              max={3000}
              step={50}
              onDec={() => setSkyPuffsSize((v) => Math.max(100, v - 50))}
              onInc={() => setSkyPuffsSize((v) => Math.min(3000, v + 50))}
            />
            <SettingRow
              label={t("dial.env.skyPuffsFreq")}
              mode="number"
              value={`${skyPuffsFreq.toFixed(2)}x`}
              rawValue={skyPuffsFreq}
              onSet={(v) => setSkyPuffsFreq(v)}
              min={0.2}
              max={5}
              step={0.1}
              onDec={() => setSkyPuffsFreq((v) => Math.max(0.2, +(v - 0.1).toFixed(2)))}
              onInc={() => setSkyPuffsFreq((v) => Math.min(5, +(v + 0.1).toFixed(2)))}
            />
            <SettingRow
              label={t("dial.env.skyPuffsOpacity")}
              mode="number"
              value={`${Math.round(skyPuffsOpacity * 100)}%`}
              rawValue={skyPuffsOpacity}
              onSet={(v) => setSkyPuffsOpacity(v)}
              min={0.05}
              max={1}
              step={0.05}
              onDec={() => setSkyPuffsOpacity((v) => Math.max(0.05, +(v - 0.05).toFixed(2)))}
              onInc={() => setSkyPuffsOpacity((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
            />
          </>
        )}
      </G>
      <G id="place">
        <SettingRow
          label={t("dial.env.worldBoundary")}
          value={onOff(worldBoundaryOn)}
          onDec={() => setWorldBoundaryOn(false)}
          onInc={() => setWorldBoundaryOn(true)}
        />
        {worldBoundaryOn && (
          <>
            <SettingRow
              label={t("dial.env.worldBoundarySize")}
              mode="number"
              value={`${worldBoundarySize.toFixed(0)}m`}
              rawValue={worldBoundarySize}
              onSet={(v) => setWorldBoundarySize(v)}
              min={200}
              max={500000}
              step={500}
              onDec={() => setWorldBoundarySize((v) => Math.max(200, +(v - 500).toFixed(0)))}
              onInc={() => setWorldBoundarySize((v) => Math.min(500000, +(v + 500).toFixed(0)))}
            />
            <SettingRow
              label={t("dial.env.worldBoundaryHeight")}
              mode="number"
              value={`${worldBoundaryHeight.toFixed(0)}m`}
              rawValue={worldBoundaryHeight}
              onSet={(v) => setWorldBoundaryHeight(v)}
              min={200}
              max={500000}
              step={200}
              onDec={() => setWorldBoundaryHeight((v) => Math.max(200, +(v - 200).toFixed(0)))}
              onInc={() => setWorldBoundaryHeight((v) => Math.min(500000, +(v + 200).toFixed(0)))}
            />
            <SettingRow
              label={t("dial.env.worldBoundaryYExtend")}
              value={onOff(worldBoundaryYExtend)}
              onDec={() => setWorldBoundaryYExtend(false)}
              onInc={() => setWorldBoundaryYExtend(true)}
            />
          </>
        )}
        <SettingRow
          label={t("dial.env.waterFullWorld")}
          value={onOff(waterFullWorld)}
          onDec={() => setWaterFullWorld(false)}
          onInc={() => setWaterFullWorld(true)}
        />
        <SettingRow
          label={t("dial.env.roomSize")}
          mode="number"
          value={`${surfaceArea.toFixed(0)}m`}
          rawValue={surfaceArea}
          onSet={(v) => setSurfaceArea(v)}
          min={200}
          max={700000}
          step={1000}
          onDec={() => setSurfaceArea((v) => Math.max(200, +(v - 1000).toFixed(0)))}
          onInc={() => setSurfaceArea((v) => Math.min(700000, +(v + 1000).toFixed(0)))}
        />
        {scenes.length > 0 && (
          <SettingRow
            label={t("dial.env.scene")}
            value={
              sceneId ? (scenes.find((s) => s.id === sceneId)?.name ?? sceneId) : t("common.off")
            }
            options={[t("common.off"), ...scenes.map((s) => s.name)]}
            selectedIndex={sceneId ? 1 + scenes.findIndex((s) => s.id === sceneId) : 0}
            onSelectIndex={(i) => setSceneId(i === 0 ? null : (scenes[i - 1]?.id ?? null))}
            onDec={() => cycleScene(-1)}
            onInc={() => cycleScene(1)}
          />
        )}
        <Findable label={t("userScenes.title")}>
          <div className="flex w-full flex-wrap items-center justify-center gap-1.5 py-1">
            <span className="text-[9px] font-light tracking-[0.28em] ui-ink-faint">
              {t("userScenes.title")}
            </span>
            <button
              onClick={pickUserSceneFile}
              disabled={userSceneBusy}
              title={t("userScenes.importHint")}
              className="rounded-full border ui-line-1 ui-tint-1 px-2.5 py-0.5 text-[9px] font-light tracking-wider ui-ink-muted transition active:scale-95 ui-press disabled:opacity-30"
            >
              {userSceneBusy ? t("userScenes.importing") : t("userScenes.import")}
            </button>
            {sceneId && userSceneIds.includes(sceneId) && (
              <button
                onClick={() => deleteUserScene(sceneId)}
                disabled={userSceneBusy}
                className="rounded-full border ui-line-1 ui-tint-1 px-2.5 py-0.5 text-[9px] font-light tracking-wider ui-ink-muted transition active:scale-95 ui-press disabled:opacity-30"
              >
                {t("userScenes.remove")}
              </button>
            )}
          </div>
        </Findable>
        {spawnLocations.length > 1 && (
          <SettingRow
            label={t("dial.env.spawnLocation")}
            value={
              spawnLocations.find((l) => l.id === spawnLocationId)?.name ?? spawnLocations[0].name
            }
            options={spawnLocations.map((l) => l.name)}
            selectedIndex={Math.max(
              0,
              spawnLocations.findIndex((l) => l.id === spawnLocationId),
            )}
            onSelectIndex={(i) => setSpawnLocationId(spawnLocations[i]?.id ?? null)}
            onDec={() => cycleSpawnLocation(-1)}
            onInc={() => cycleSpawnLocation(1)}
          />
        )}
      </G>
      <G id="time">
        {environments.length > 0 && (
          <>
            <SettingRow
              label={t("dial.env.environment")}
              value={curEnv ? curEnv.name : t("common.off")}
              options={[t("common.off"), ...environments.map((e) => e.name)]}
              selectedIndex={curEnv ? 1 + environments.findIndex((e) => e.id === curEnv.id) : 0}
              onSelectIndex={(i) => applyEnv(i === 0 ? null : (environments[i - 1]?.id ?? null))}
              onDec={() => cycleEnv(-1)}
              onInc={() => cycleEnv(1)}
            />
            {curEnv && curEnv.eras.length > 1 && (
              <SettingRow
                label={t("dial.env.era")}
                value={curEra?.name ?? "—"}
                options={curEnv.eras.map((e) => e.name)}
                selectedIndex={Math.max(
                  0,
                  curEnv.eras.findIndex((e) => e.id === curEra?.id),
                )}
                onSelectIndex={(i) => applyEra(curEnv.eras[i].id)}
                onDec={() => cycleEra(-1)}
                onInc={() => cycleEra(1)}
              />
            )}
            {curEra && curEra.times.length > 1 && (
              <SettingRow
                label={t("dial.env.dayTime")}
                value={curTime?.name ?? "—"}
                options={curEra.times.map((tm) => tm.name)}
                selectedIndex={Math.max(
                  0,
                  curEra.times.findIndex((tm) => tm.id === curTime?.id),
                )}
                onSelectIndex={(i) => setEnvTime(curEra.times[i].id)}
                onDec={() => cycleTime(-1)}
                onInc={() => cycleTime(1)}
              />
            )}
            <SettingRow
              label={t("dial.env.sunTint")}
              value={onOff(envSunTintOn)}
              onDec={() => setEnvSunTintOn(false)}
              onInc={() => setEnvSunTintOn(true)}
            />
            <SettingRow
              label={t("dial.env.dayNightAuto")}
              value={onOff(envDayNightAutoOn)}
              onDec={() => setEnvDayNightAutoOn(false)}
              onInc={() => setEnvDayNightAutoOn(true)}
            />
            <SettingRow
              label={t("dial.env.daylightTint")}
              value={onOff(envDaylightTintOn)}
              onDec={() => setEnvDaylightTintOn(false)}
              onInc={() => setEnvDaylightTintOn(true)}
            />
            {envDaylightTintOn && (
              <>
                <SettingRow
                  label={t("dial.env.daylightTintStrength")}
                  mode="number"
                  value={`${Math.round(envDaylightTintStrength * 100)}%`}
                  rawValue={envDaylightTintStrength}
                  onSet={(v) => setEnvDaylightTintStrength(v)}
                  min={0}
                  max={1}
                  step={0.05}
                  onDec={() =>
                    setEnvDaylightTintStrength((v) => Math.max(0, +(v - 0.05).toFixed(2)))
                  }
                  onInc={() =>
                    setEnvDaylightTintStrength((v) => Math.min(1, +(v + 0.05).toFixed(2)))
                  }
                />
              </>
            )}
          </>
        )}
      </G>
      <G id="weather">
        <SettingRow
          label={t("dial.env.aurora")}
          value={onOff(auroraOn)}
          onDec={() => setAuroraOn(false)}
          onInc={() => setAuroraOn(true)}
        />
        {auroraOn && (
          <>
            <SettingRow
              label={t("dial.env.auroraIntensity")}
              mode="number"
              value={`${Math.round(auroraIntensity * 100)}%`}
              rawValue={auroraIntensity}
              onSet={(v) => setAuroraIntensity(v)}
              min={0}
              max={mx("auroraIntensity")}
              step={0.05}
              onDec={() => setAuroraIntensity((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
              onInc={() =>
                setAuroraIntensity((v) => Math.min(mx("auroraIntensity"), +(v + 0.05).toFixed(2)))
              }
            />
            <SettingRow
              label={t("dial.env.auroraAmount")}
              mode="number"
              value={`${Math.round(auroraAmount * 100)}%`}
              rawValue={auroraAmount}
              onSet={(v) => setAuroraAmount(v)}
              min={0}
              max={1}
              step={0.05}
              onDec={() => setAuroraAmount((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
              onInc={() => setAuroraAmount((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
            />
            <SettingRow
              label={t("dial.env.auroraSpeed")}
              mode="number"
              value={`${Math.round(auroraSpeed * 100)}%`}
              rawValue={auroraSpeed}
              onSet={(v) => setAuroraSpeed(v)}
              min={0}
              max={3}
              step={0.05}
              onDec={() => setAuroraSpeed((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
              onInc={() => setAuroraSpeed((v) => Math.min(3, +(v + 0.05).toFixed(2)))}
            />
            <SettingRow
              label={t("dial.env.auroraHeight")}
              mode="number"
              value={`${Math.round(auroraHeight * 100)}%`}
              rawValue={auroraHeight}
              onSet={(v) => setAuroraHeight(v)}
              min={0}
              max={1}
              step={0.05}
              onDec={() => setAuroraHeight((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
              onInc={() => setAuroraHeight((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
            />
            <SettingRow
              label={t("dial.env.auroraPalette")}
              value={t(`dial.env.auroraPaletteValue.${auroraPalette}`)}
              options={AURORA_PALETTES.map((p) => t(`dial.env.auroraPaletteValue.${p}`))}
              selectedIndex={Math.max(0, AURORA_PALETTES.indexOf(auroraPalette))}
              onSelectIndex={(i) => setAuroraPalette(AURORA_PALETTES[i])}
              onDec={() =>
                setAuroraPalette(
                  (p) =>
                    AURORA_PALETTES[
                      (Math.max(0, AURORA_PALETTES.indexOf(p)) - 1 + AURORA_PALETTES.length) %
                        AURORA_PALETTES.length
                    ],
                )
              }
              onInc={() =>
                setAuroraPalette(
                  (p) =>
                    AURORA_PALETTES[
                      (Math.max(0, AURORA_PALETTES.indexOf(p)) + 1) % AURORA_PALETTES.length
                    ],
                )
              }
            />
            {auroraPalette === "custom" && (
              <>
                <label className="flex items-center gap-2 rounded-full border ui-line-1 ui-surface py-1 pl-3 pr-1 backdrop-blur-md">
                  <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">
                    {t("dial.env.auroraColorMain")}
                  </span>
                  <input
                    type="color"
                    value={auroraColorMain}
                    onChange={(e) => setAuroraColorMain(e.target.value)}
                    className="h-7 w-9 cursor-pointer rounded-full border ui-line-2 bg-transparent p-0"
                  />
                </label>
                <label className="flex items-center gap-2 rounded-full border ui-line-1 ui-surface py-1 pl-3 pr-1 backdrop-blur-md">
                  <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">
                    {t("dial.env.auroraColorTop")}
                  </span>
                  <input
                    type="color"
                    value={auroraColorTop}
                    onChange={(e) => setAuroraColorTop(e.target.value)}
                    className="h-7 w-9 cursor-pointer rounded-full border ui-line-2 bg-transparent p-0"
                  />
                </label>
              </>
            )}
            <SettingRow
              label={t("dial.env.auroraDaylight")}
              value={onOff(auroraDaylightOn)}
              onDec={() => setAuroraDaylightOn(false)}
              onInc={() => setAuroraDaylightOn(true)}
            />
          </>
        )}
        <SettingRow
          label={t("dial.env.underwaterFog")}
          value={onOff(underwaterFogOn)}
          onDec={() => setUnderwaterFogOn(false)}
          onInc={() => setUnderwaterFogOn(true)}
        />
        {underwaterFogOn && (
          <>
            <label className="flex items-center gap-2 rounded-full border ui-line-1 ui-surface py-1 pl-3 pr-1 backdrop-blur-md">
              <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">
                {t("dial.env.underwaterFogColor")}
              </span>
              <input
                type="color"
                value={underwaterFogColor}
                onChange={(e) => setUnderwaterFogColor(e.target.value)}
                className="h-7 w-9 cursor-pointer rounded-full border ui-line-2 bg-transparent p-0"
              />
            </label>
            <SettingRow
              label={t("dial.env.underwaterFogOpacity")}
              mode="number"
              value={`${Math.round(underwaterFogOpacity * 100)}%`}
              rawValue={underwaterFogOpacity}
              onSet={(v) => setUnderwaterFogOpacity(v)}
              min={0}
              max={1}
              step={0.05}
              onDec={() => setUnderwaterFogOpacity((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
              onInc={() => setUnderwaterFogOpacity((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
            />
            <SettingRow
              label={t("dial.env.underwaterFogWaterColorMode")}
              value={t(
                `dial.env.underwaterFogWaterColorValue.${underwaterFogWaterColorAuto ? "auto" : "custom"}`,
              )}
              onDec={() => setUnderwaterFogWaterColorAuto((v) => !v)}
              onInc={() => setUnderwaterFogWaterColorAuto((v) => !v)}
            />
            {!underwaterFogWaterColorAuto && (
              <>
                <label className="flex items-center gap-2 rounded-full border ui-line-1 ui-surface py-1 pl-3 pr-1 backdrop-blur-md">
                  <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">
                    {t("dial.env.underwaterFogWaterColorPick")}
                  </span>
                  <input
                    type="color"
                    value={underwaterFogWaterColor}
                    onChange={(e) => setUnderwaterFogWaterColor(e.target.value)}
                    className="h-7 w-9 cursor-pointer rounded-full border ui-line-2 bg-transparent p-0"
                  />
                </label>
              </>
            )}
            <SettingRow
              label={t("dial.env.underwaterFogWaterOpacity")}
              mode="number"
              value={`${Math.round(underwaterFogWaterOpacity * 100)}%`}
              rawValue={underwaterFogWaterOpacity}
              onSet={(v) => setUnderwaterFogWaterOpacity(v)}
              min={0}
              max={1}
              step={0.05}
              onDec={() => setUnderwaterFogWaterOpacity((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
              onInc={() => setUnderwaterFogWaterOpacity((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
            />
            <SettingRow
              label={t("dial.env.underwaterFogIntensity")}
              mode="number"
              value={`${Math.round(underwaterFogIntensity * 100)}%`}
              rawValue={underwaterFogIntensity}
              onSet={(v) => setUnderwaterFogIntensity(v)}
              min={0}
              max={1}
              step={0.05}
              onDec={() => setUnderwaterFogIntensity((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
              onInc={() => setUnderwaterFogIntensity((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
            />
            <SettingRow
              label={t("dial.env.underwaterFogSpread")}
              mode="number"
              value={`${Math.round(underwaterFogSpread * 100)}%`}
              rawValue={underwaterFogSpread}
              onSet={(v) => setUnderwaterFogSpread(v)}
              min={0.05}
              max={1}
              step={0.05}
              onDec={() => setUnderwaterFogSpread((v) => Math.max(0.05, +(v - 0.05).toFixed(2)))}
              onInc={() => setUnderwaterFogSpread((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
            />
            <SettingRow
              label={t("dial.env.underwaterFogCurve")}
              mode="number"
              value={underwaterFogCurve.toFixed(1)}
              rawValue={underwaterFogCurve}
              onSet={(v) => setUnderwaterFogCurve(v)}
              min={0.2}
              max={4}
              step={0.1}
              onDec={() => setUnderwaterFogCurve((v) => Math.max(0.2, +(v - 0.1).toFixed(2)))}
              onInc={() => setUnderwaterFogCurve((v) => Math.min(4, +(v + 0.1).toFixed(2)))}
            />
            <SettingRow
              label={t("dial.env.underwaterFogFeather")}
              mode="number"
              value={`${Math.round(underwaterFogFeather * 100)}%`}
              rawValue={underwaterFogFeather}
              onSet={(v) => setUnderwaterFogFeather(v)}
              min={0}
              max={0.3}
              step={0.01}
              onDec={() => setUnderwaterFogFeather((v) => Math.max(0, +(v - 0.01).toFixed(2)))}
              onInc={() => setUnderwaterFogFeather((v) => Math.min(0.3, +(v + 0.01).toFixed(2)))}
            />
            <SettingRow
              label={t("dial.env.underwaterFogDistance")}
              mode="number"
              value={`${Math.round(underwaterFogDistance)} m`}
              rawValue={underwaterFogDistance}
              onSet={(v) => setUnderwaterFogDistance(v)}
              min={2}
              max={500}
              step={1}
              onDec={() => setUnderwaterFogDistance((v) => Math.max(2, +(v - 1).toFixed(2)))}
              onInc={() => setUnderwaterFogDistance((v) => Math.min(500, +(v + 1).toFixed(2)))}
            />
            <SettingRow
              label={t("dial.env.underwaterFogOffset")}
              mode="number"
              value={`${Math.round(underwaterFogOffset * 100)}%`}
              rawValue={underwaterFogOffset}
              onSet={(v) => setUnderwaterFogOffset(v)}
              min={-0.5}
              max={0.5}
              step={0.01}
              onDec={() => setUnderwaterFogOffset((v) => Math.max(-0.5, +(v - 0.01).toFixed(2)))}
              onInc={() => setUnderwaterFogOffset((v) => Math.min(0.5, +(v + 0.01).toFixed(2)))}
            />
            <SettingRow
              label={t("dial.env.underwaterFogSubmergedOnly")}
              value={onOff(underwaterFogSubmergedOnly)}
              onDec={() => setUnderwaterFogSubmergedOnly(false)}
              onInc={() => setUnderwaterFogSubmergedOnly(true)}
            />
            <SettingRow
              label={t("dial.env.underwaterFogBlend")}
              value={t(`dial.env.underwaterFogBlendValue.${underwaterFogBlend}`)}
              options={UNDERWATER_FOG_BLENDS.map((b) => t(`dial.env.underwaterFogBlendValue.${b}`))}
              selectedIndex={Math.max(0, UNDERWATER_FOG_BLENDS.indexOf(underwaterFogBlend))}
              onSelectIndex={(i) => setUnderwaterFogBlend(UNDERWATER_FOG_BLENDS[i])}
              onDec={() =>
                setUnderwaterFogBlend(
                  (b) =>
                    UNDERWATER_FOG_BLENDS[
                      (Math.max(0, UNDERWATER_FOG_BLENDS.indexOf(b)) -
                        1 +
                        UNDERWATER_FOG_BLENDS.length) %
                        UNDERWATER_FOG_BLENDS.length
                    ],
                )
              }
              onInc={() =>
                setUnderwaterFogBlend(
                  (b) =>
                    UNDERWATER_FOG_BLENDS[
                      (Math.max(0, UNDERWATER_FOG_BLENDS.indexOf(b)) + 1) %
                        UNDERWATER_FOG_BLENDS.length
                    ],
                )
              }
            />
          </>
        )}
        <Findable label={t("wind.title")}>
          <div className="pt-4 pb-1 text-[10px] font-light tracking-[0.28em] ui-ink-muted">
            {t("wind.title")}
          </div>
        </Findable>
        <WindSettings c={props.wind} />
        <SettingRow
          label={t("dial.env.snow")}
          value={onOff(snowOn)}
          onDec={() => setSnowOn(false)}
          onInc={() => setSnowOn(true)}
        />
        {snowOn && (
          <>
            <SettingRow
              label={t("dial.env.snowAmount")}
              mode="number"
              value={`${Math.round(snowAmount)}`}
              rawValue={snowAmount}
              onSet={(v) => setSnowAmount(Math.max(0, Math.round(v)))}
              min={0}
              max={mx("snowAmount")}
              step={500}
              onDec={() => setSnowAmount((v) => Math.max(0, Math.round(v - 500)))}
              onInc={() => setSnowAmount((v) => Math.min(mx("snowAmount"), Math.round(v + 500)))}
            />
            <SettingRow
              label={t("dial.env.snowIntensity")}
              mode="number"
              value={`${Math.round(snowIntensity * 100)}%`}
              rawValue={snowIntensity}
              onSet={(v) => setSnowIntensity(v)}
              min={0}
              max={mx("snowIntensity")}
              step={0.05}
              onDec={() => setSnowIntensity((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
              onInc={() =>
                setSnowIntensity((v) => Math.min(mx("snowIntensity"), +(v + 0.05).toFixed(2)))
              }
            />
          </>
        )}
        <SettingRow
          label={t("dial.env.snowCover")}
          value={onOff(snowCoverOn)}
          onDec={() => setSnowCoverOn(false)}
          onInc={() => setSnowCoverOn(true)}
        />
        {snowCoverOn && (
          <SettingRow
            label={t("dial.env.snowGrayBackdrop")}
            value={onOff(snowGrayBackdropOn)}
            onDec={() => setSnowGrayBackdropOn(false)}
            onInc={() => setSnowGrayBackdropOn(true)}
          />
        )}
        {snowCoverOn && (
          <SettingRow
            label={t("dial.env.snowCoverStrength")}
            mode="number"
            value={`${Math.round(snowCoverStrength * 100)}%`}
            rawValue={snowCoverStrength}
            onSet={(v) => setSnowCoverStrength(v)}
            min={0}
            max={1}
            step={0.05}
            onDec={() => setSnowCoverStrength((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
            onInc={() => setSnowCoverStrength((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
          />
        )}
      </G>
      <G id="events">
        <SettingRow
          label={t("dial.env.confetti")}
          value={onOff(confettiOn)}
          onDec={() => setConfettiOn(false)}
          onInc={() => setConfettiOn(true)}
        />
        {confettiOn && (
          <>
            <SettingRow
              label={t("dial.env.confettiAmount")}
              mode="number"
              value={`${Math.round(confettiAmount)}`}
              rawValue={confettiAmount}
              onSet={(v) => setConfettiAmount(Math.round(v))}
              min={0}
              max={mx("confettiAmount")}
              step={500}
              onDec={() => setConfettiAmount((v) => Math.max(0, Math.round(v - 500)))}
              onInc={() =>
                setConfettiAmount((v) => Math.min(mx("confettiAmount"), Math.round(v + 500)))
              }
            />
            <SettingRow
              label={t("dial.env.confettiIntensity")}
              mode="number"
              value={`${Math.round(confettiIntensity * 100)}%`}
              rawValue={confettiIntensity}
              onSet={(v) => setConfettiIntensity(v)}
              min={0}
              max={mx("confettiIntensity")}
              step={0.05}
              onDec={() => setConfettiIntensity((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
              onInc={() =>
                setConfettiIntensity((v) =>
                  Math.min(mx("confettiIntensity"), +(v + 0.05).toFixed(2)),
                )
              }
            />
            <SettingRow
              label={t("dial.env.confettiPalette")}
              value={t(`dial.env.confettiPaletteValue.${confettiPalette}`)}
              options={CONFETTI_PALETTES.map((p) => t(`dial.env.confettiPaletteValue.${p}`))}
              selectedIndex={Math.max(0, CONFETTI_PALETTES.indexOf(confettiPalette))}
              onSelectIndex={(i) => setConfettiPalette(CONFETTI_PALETTES[i])}
              onDec={() =>
                setConfettiPalette(
                  (p) =>
                    CONFETTI_PALETTES[
                      (Math.max(0, CONFETTI_PALETTES.indexOf(p)) - 1 + CONFETTI_PALETTES.length) %
                        CONFETTI_PALETTES.length
                    ],
                )
              }
              onInc={() =>
                setConfettiPalette(
                  (p) =>
                    CONFETTI_PALETTES[
                      (Math.max(0, CONFETTI_PALETTES.indexOf(p)) + 1) % CONFETTI_PALETTES.length
                    ],
                )
              }
            />
            <SettingRow
              label={t("dial.env.confettiFlutter")}
              mode="number"
              value={`${Math.round(confettiFlutter * 100)}%`}
              rawValue={confettiFlutter}
              onSet={(v) => setConfettiFlutter(v)}
              min={0}
              max={2}
              step={0.05}
              onDec={() => setConfettiFlutter((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
              onInc={() => setConfettiFlutter((v) => Math.min(2, +(v + 0.05).toFixed(2)))}
            />
          </>
        )}
        <SettingRow
          label={t("dial.env.fireworks")}
          value={onOff(fireworksOn)}
          onDec={() => setFireworksOn(false)}
          onInc={() => setFireworksOn(true)}
        />
        {fireworksOn && (
          <>
            <SettingRow
              label={t("dial.env.fireworksIntensity")}
              mode="number"
              value={`${Math.round(fireworksIntensity * 100)}%`}
              rawValue={fireworksIntensity}
              onSet={(v) => setFireworksIntensity(v)}
              min={0}
              max={mx("fireworksIntensity")}
              step={0.05}
              onDec={() => setFireworksIntensity((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
              onInc={() =>
                setFireworksIntensity((v) =>
                  Math.min(mx("fireworksIntensity"), +(v + 0.05).toFixed(2)),
                )
              }
            />
            <SettingRow
              label={t("dial.env.fireworksRate")}
              mode="number"
              value={`${Math.round(fireworksRate)}`}
              rawValue={fireworksRate}
              onSet={(v) => setFireworksRate(Math.round(v))}
              min={1}
              max={mx("fireworksRate")}
              step={1}
              onDec={() => setFireworksRate((v) => Math.max(1, Math.round(v - 2)))}
              onInc={() =>
                setFireworksRate((v) => Math.min(mx("fireworksRate"), Math.round(v + 2)))
              }
            />
            <SettingRow
              label={t("dial.env.fireworksDistance")}
              mode="number"
              value={`${Math.round(fireworksDistance)} m`}
              rawValue={fireworksDistance}
              onSet={(v) => setFireworksDistance(Math.round(v))}
              min={50}
              max={1500}
              step={25}
              onDec={() => setFireworksDistance((v) => Math.max(50, Math.round(v - 25)))}
              onInc={() => setFireworksDistance((v) => Math.min(1500, Math.round(v + 25)))}
            />
            <SettingRow
              label={t("dial.env.fireworksLights")}
              value={onOff(fireworksLightsOn)}
              onDec={() => setFireworksLightsOn(false)}
              onInc={() => setFireworksLightsOn(true)}
            />
            {fireworksLightsOn && (
              <SettingRow
                label={t("dial.env.fireworksLightStrength")}
                mode="number"
                value={`${Math.round(fireworksLightStrength * 100)}%`}
                rawValue={fireworksLightStrength}
                onSet={(v) => setFireworksLightStrength(v)}
                min={0}
                max={3}
                step={0.1}
                onDec={() => setFireworksLightStrength((v) => Math.max(0, +(v - 0.1).toFixed(2)))}
                onInc={() => setFireworksLightStrength((v) => Math.min(3, +(v + 0.1).toFixed(2)))}
              />
            )}
            <SettingRow
              label={t("dial.env.fireworksSound")}
              value={onOff(fireworksSoundOn)}
              onDec={() => setFireworksSoundOn(false)}
              onInc={() => setFireworksSoundOn(true)}
            />
            {fireworksSoundOn && (
              <SettingRow
                label={t("dial.env.fireworksVolume")}
                mode="number"
                value={`${Math.round(fireworksVolume * 100)}%`}
                rawValue={fireworksVolume}
                onSet={(v) => setFireworksVolume(v)}
                min={0}
                max={1}
                step={0.05}
                onDec={() => setFireworksVolume((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
                onInc={() => setFireworksVolume((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
              />
            )}
          </>
        )}
      </G>
      <G id="time">
        <SettingRow
          label={t("dial.env.backdrop")}
          value={t(BACKDROP_LABEL_KEYS[BACKDROPS[backdropIdx].id])}
          options={BACKDROPS.map((b) => t(BACKDROP_LABEL_KEYS[b.id]))}
          selectedIndex={backdropIdx}
          onSelectIndex={setBackdropIdx}
          onDec={() => setBackdropIdx((i) => (i - 1 + BACKDROPS.length) % BACKDROPS.length)}
          onInc={() => setBackdropIdx((i) => (i + 1) % BACKDROPS.length)}
        />
        <SettingRow
          label={t("dial.env.live")}
          value={onOff(liveMode)}
          onDec={() => setLiveMode(false)}
          onInc={() => setLiveMode(true)}
        />
      </G>
      <G id="effects">
        <SettingRow
          label={t("dial.env.torusRings")}
          value={onOff(torusRingsOn)}
          onDec={() => setTorusRingsOn(false)}
          onInc={() => setTorusRingsOn(true)}
        />
        {torusRingsOn && (
          <>
            <SettingRow
              label={t("dial.env.torusRadius")}
              mode="number"
              value={`${torusRadius.toFixed(2)}m`}
              rawValue={torusRadius}
              onSet={(v) => setTorusRadius(v)}
              min={0.1}
              max={5}
              step={0.05}
              onDec={() => setTorusRadius((v) => Math.max(0.1, +(v - 0.05).toFixed(2)))}
              onInc={() => setTorusRadius((v) => Math.min(5, +(v + 0.05).toFixed(2)))}
            />
            <SettingRow
              label={t("dial.env.torusTube")}
              mode="number"
              value={`${torusTube.toFixed(2)}m`}
              rawValue={torusTube}
              onSet={(v) => setTorusTube(v)}
              min={0.01}
              max={1}
              step={0.01}
              onDec={() => setTorusTube((v) => Math.max(0.01, +(v - 0.01).toFixed(2)))}
              onInc={() => setTorusTube((v) => Math.min(1, +(v + 0.01).toFixed(2)))}
            />
            <SettingRow
              label={t("dial.env.torusScale")}
              mode="number"
              value={`${torusScale.toFixed(2)}x`}
              rawValue={torusScale}
              onSet={(v) => setTorusScale(v)}
              min={0.1}
              max={20}
              step={0.1}
              onDec={() => setTorusScale((v) => Math.max(0.1, +(v - 0.1).toFixed(2)))}
              onInc={() => setTorusScale((v) => Math.min(20, +(v + 0.1).toFixed(2)))}
            />
            <SettingRow
              label={t("common.opacity")}
              mode="number"
              value={`${Math.round(torusOpacity * 100)}%`}
              rawValue={torusOpacity}
              onSet={(v) => setTorusOpacity(v)}
              min={0}
              max={1}
              step={0.05}
              onDec={() => setTorusOpacity((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
              onInc={() => setTorusOpacity((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
            />
            <SettingRow
              label={t("common.texture")}
              value={t(TORUS_TEXTURE_LABEL_KEYS[TORUS_RING_TEXTURES[torusTextureIdx].id])}
              onDec={() =>
                setTorusTextureIdx(
                  (i) => (i - 1 + TORUS_RING_TEXTURES.length) % TORUS_RING_TEXTURES.length,
                )
              }
              onInc={() => setTorusTextureIdx((i) => (i + 1) % TORUS_RING_TEXTURES.length)}
            />
            <SettingRow
              label={t("dial.env.torusCellSize")}
              mode="number"
              value={`${torusCellSize.toFixed(1)}m`}
              rawValue={torusCellSize}
              onSet={(v) => setTorusCellSize(v)}
              min={0}
              max={60}
              step={0.5}
              onDec={() => setTorusCellSize((v) => Math.max(0, +(v - 0.5).toFixed(1)))}
              onInc={() => setTorusCellSize((v) => Math.min(60, +(v + 0.5).toFixed(1)))}
            />
            <SettingRow
              label={t("dial.env.torusVerticalSpacing")}
              mode="number"
              value={`${torusVerticalSpacing.toFixed(1)}m`}
              rawValue={torusVerticalSpacing}
              onSet={(v) => setTorusVerticalSpacing(v)}
              min={0}
              max={20}
              step={0.1}
              onDec={() => setTorusVerticalSpacing((v) => Math.max(0, +(v - 0.1).toFixed(2)))}
              onInc={() => setTorusVerticalSpacing((v) => Math.min(20, +(v + 0.1).toFixed(2)))}
            />
            <SettingRow
              label={t("dial.env.torusVerticalCount")}
              mode="number"
              value={`${torusVerticalCount}`}
              rawValue={torusVerticalCount}
              onSet={(v) => setTorusVerticalCount(Math.max(1, Math.round(v)))}
              min={1}
              max={21}
              step={2}
              onDec={() => setTorusVerticalCount((v) => Math.max(1, v - 2))}
              onInc={() => setTorusVerticalCount((v) => Math.min(21, v + 2))}
            />
            <SettingRow
              label={t("dial.env.torusViewDistance")}
              mode="number"
              value={`${torusViewDistance.toFixed(0)}m`}
              rawValue={torusViewDistance}
              onSet={(v) => setTorusViewDistance(v)}
              min={4}
              max={400}
              step={2}
              onDec={() => setTorusViewDistance((v) => Math.max(4, +(v - 2).toFixed(0)))}
              onInc={() => setTorusViewDistance((v) => Math.min(400, +(v + 2).toFixed(0)))}
            />
            <SettingRow
              label={t("dial.env.torusFadeDistance")}
              mode="number"
              value={`${torusFadeDistance.toFixed(1)}m`}
              rawValue={torusFadeDistance}
              onSet={(v) => setTorusFadeDistance(v)}
              min={0.5}
              max={100}
              step={0.5}
              onDec={() => setTorusFadeDistance((v) => Math.max(0.5, +(v - 0.5).toFixed(1)))}
              onInc={() => setTorusFadeDistance((v) => Math.min(100, +(v + 0.5).toFixed(1)))}
            />
          </>
        )}
        <SettingRow
          label={t("dial.env.neon")}
          value={onOff(neonOn)}
          onDec={() => setNeonOn(false)}
          onInc={() => setNeonOn(true)}
        />
        {neonOn && (
          <>
            <SettingRow
              label={t("dial.env.neonMode")}
              value={t(`dial.env.neonModeValue.${neonMode}`)}
              options={NEON_MODES.map((m) => t(`dial.env.neonModeValue.${m}`))}
              selectedIndex={Math.max(0, NEON_MODES.indexOf(neonMode))}
              onSelectIndex={(i) => setNeonMode(NEON_MODES[i] as NeonMode)}
              onDec={() =>
                setNeonMode(
                  (m) =>
                    NEON_MODES[(NEON_MODES.indexOf(m) - 1 + NEON_MODES.length) % NEON_MODES.length],
                )
              }
              onInc={() =>
                setNeonMode((m) => NEON_MODES[(NEON_MODES.indexOf(m) + 1) % NEON_MODES.length])
              }
            />
            <label className="flex items-center gap-2 rounded-full border ui-line-1 ui-surface py-1 pl-3 pr-1 backdrop-blur-md">
              <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">
                {t("dial.env.neonPrimary")}
              </span>
              <input
                type="color"
                value={neonPrimary}
                onChange={(e) => setNeonPrimary(e.target.value)}
                className="h-7 w-9 cursor-pointer rounded-full border ui-line-2 bg-transparent p-0"
              />
            </label>
            {(neonMode === "alternate" || neonMode === "fade") && (
              <>
                <label className="flex items-center gap-2 rounded-full border ui-line-1 ui-surface py-1 pl-3 pr-1 backdrop-blur-md">
                  <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">
                    {t("dial.env.neonSecondary")}
                  </span>
                  <input
                    type="color"
                    value={neonSecondary}
                    onChange={(e) => setNeonSecondary(e.target.value)}
                    className="h-7 w-9 cursor-pointer rounded-full border ui-line-2 bg-transparent p-0"
                  />
                </label>
              </>
            )}
            {neonMode !== "solid" && (
              <>
                <SettingRow
                  label={t("dial.env.neonFrequency")}
                  mode="number"
                  value={`${neonFrequency.toFixed(2)} Hz`}
                  rawValue={neonFrequency}
                  onSet={(v) => setNeonFrequency(v)}
                  min={0.05}
                  max={10}
                  step={0.05}
                  onDec={() => setNeonFrequency((v) => Math.max(0.05, +(v - 0.05).toFixed(2)))}
                  onInc={() => setNeonFrequency((v) => Math.min(10, +(v + 0.05).toFixed(2)))}
                />
              </>
            )}
            <SettingRow
              label={t("dial.env.neonStrength")}
              mode="number"
              value={`${Math.round(neonStrength * 100)}%`}
              rawValue={neonStrength}
              onSet={(v) => setNeonStrength(v)}
              min={0}
              max={3}
              step={0.1}
              onDec={() => setNeonStrength((v) => Math.max(0, +(v - 0.1).toFixed(2)))}
              onInc={() => setNeonStrength((v) => Math.min(3, +(v + 0.1).toFixed(2)))}
            />
            <SettingRow
              label={t("dial.env.neonWidth")}
              mode="number"
              value={`${neonWidth.toFixed(1)}px`}
              rawValue={neonWidth}
              onSet={(v) => setNeonWidth(v)}
              min={0.5}
              max={12}
              step={0.5}
              onDec={() => setNeonWidth((v) => Math.max(0.5, +(v - 0.5).toFixed(1)))}
              onInc={() => setNeonWidth((v) => Math.min(12, +(v + 0.5).toFixed(1)))}
            />
            <label className="flex items-center gap-2 rounded-full border ui-line-1 ui-surface py-1 pl-3 pr-1 backdrop-blur-md">
              <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">
                {t("dial.env.neonTint")}
              </span>
              <input
                type="color"
                value={neonTint}
                onChange={(e) => setNeonTint(e.target.value)}
                className="h-7 w-9 cursor-pointer rounded-full border ui-line-2 bg-transparent p-0"
              />
            </label>
            <SettingRow
              label={t("dial.env.neonTintAmount")}
              mode="number"
              value={`${Math.round(neonTintAmount * 100)}%`}
              rawValue={neonTintAmount}
              onSet={(v) => setNeonTintAmount(v)}
              min={0}
              max={1}
              step={0.05}
              onDec={() => setNeonTintAmount((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
              onInc={() => setNeonTintAmount((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
            />
          </>
        )}
        <Findable label={t("dial.env.neonAccent")}>
          <label className="flex items-center gap-2 rounded-full border ui-line-1 ui-surface py-1 pl-3 pr-1 backdrop-blur-md">
            <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">
              {t("dial.env.neonAccent")}
            </span>
            <input
              type="color"
              value={neonAccentColor}
              onChange={(e) => setNeonAccentColor(e.target.value)}
              className="h-7 w-9 cursor-pointer rounded-full border ui-line-2 bg-transparent p-0"
            />
          </label>
        </Findable>
      </G>
      {/* ── ljud ── */}
      <G id="state">
        <PresetControls
          scope="ljud"
          label={t("presets.scope.ljud")}
          savedPresets={savedPresets}
          exportSettingsFile={exportSettingsFile}
          importSettingsFile={importSettingsFile}
          savePresetAs={savePresetAs}
          loadSavedPreset={loadSavedPreset}
          deleteSavedPreset={deleteSavedPreset}
        />
      </G>
      <G id="sound">
        <SettingRow
          label={audioOn ? t("dial.audio.on") : t("dial.audio.off")}
          value={audioOn ? `${Math.round(audioVol * 100)}%` : "—"}
          onDec={() => {
            if (!audioOn) {
              setAudioOn(true);
              return;
            }
            setAudioVol((v) => {
              const next = +(v - 0.1).toFixed(2);
              if (next <= 0) {
                setAudioOn(false);
                return 0;
              }
              return next;
            });
          }}
          onInc={() => {
            if (!audioOn) {
              setAudioOn(true);
              return;
            }
            setAudioVol((v) => Math.min(1, +(v + 0.1).toFixed(2)));
          }}
        />
        <SettingRow
          label={t("dial.audio.sound")}
          value={waterSoundLabel(t, waterSounds[waterSoundIdx] ?? waterSounds[0])}
          options={waterSounds.map((s) => waterSoundLabel(t, s))}
          selectedIndex={waterSoundIdx}
          onSelectIndex={setWaterSoundIdx}
          onDec={() => setWaterSoundIdx((i) => (i - 1 + waterSounds.length) % waterSounds.length)}
          onInc={() => setWaterSoundIdx((i) => (i + 1) % waterSounds.length)}
        />
        <SettingRow
          label={t("dial.audio.syncSpeed")}
          value={onOff(audioSyncSpeed)}
          onDec={() => setAudioSyncSpeed(false)}
          onInc={() => setAudioSyncSpeed(true)}
        />
        <SettingRow
          label={t("dial.audio.spatial")}
          value={onOff(audioSpatial)}
          onDec={() => setAudioSpatial(false)}
          onInc={() => setAudioSpatial(true)}
        />
      </G>
      <G id="app">
        <ThemeSettingsSection />
      </G>
    </>
  );

  return <SettingsNavigator groups={SETTINGS_GROUPS} body={body} />;
}
