import {
  useState,
  type CSSProperties,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { PadDial } from "@/components/PadDial";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { hsvToRgb, tintToCss } from "@/lib/waterTint";
import {
  SETTINGS_TABS,
  WATER_COLORS,
  WATER_COLOR_LABEL_KEYS,
  BOTTOM_OPTIONS,
  BOTTOM_LABEL_KEYS,
  BACKDROPS,
  BACKDROP_LABEL_KEYS,
  WATER_SOUNDS,
  WATER_SOUND_LABEL_KEYS,
  TORUS_RING_TEXTURES,
  TORUS_TEXTURE_LABEL_KEYS,
  CAMERA_MODES,
  CAMERA_MODE_LABEL_KEYS,
  WHIRLPOOL_DIRECTIONS,
  WHIRLPOOL_DIRECTION_LABEL_KEYS,
  WHIRLPOOL_EXIT_MODES,
  WHIRLPOOL_EXIT_MODE_LABEL_KEYS,
  SWING_PRESETS,
  SWING_Y_WAVEFORMS,
  INTERVAL_SESSION_TYPES,
  WAVE_FREQ_MIN,
  WAVE_FREQ_MAX,
  worldXZBearing,
  formatClock,
  type SettingsTab,
  type CameraMode,
  type SwingPreset,
  type SwingYWaveform,
  type IntervalSessionType,
  type WavePresetName,
  type WhirlpoolDirection,
  type WhirlpoolExitMode,
} from "@/lib/settingsShared";
import { pickJsonFile, type PresetScope, type SavedPreset, type SavedState } from "@/lib/presets";
import { changeLanguage, SUPPORTED_LANGUAGES, LANGUAGE_NAMES, type LanguageCode } from "@/lib/i18n";
import { ShareBathDialog } from "@/components/ShareBathDialog";

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
    <label className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-2.5 py-1">
      <span className="text-[9px] font-light tracking-[0.28em] text-white/50">
        {t("language.label")}
      </span>
      <select
        value={i18n.language}
        onChange={(e) => changeLanguage(e.target.value as LanguageCode)}
        className="cursor-pointer appearance-none bg-transparent text-[10px] font-medium tracking-wider text-white outline-none"
      >
        {SUPPORTED_LANGUAGES.map((code) => (
          <option key={code} value={code} className="bg-black text-white">
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
        className="flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 backdrop-blur-md transition active:scale-95 active:bg-white/10"
      >
        <span
          className="h-5 w-5 shrink-0 overflow-hidden rounded-full border border-white/30"
          style={CHECKERBOARD_STYLE}
        >
          <span className="block h-full w-full" style={swatchStyle} />
        </span>
        <span className="text-[9px] font-light tracking-[0.28em] text-white/70">
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
    <div className="flex w-full max-w-xs flex-col gap-2 rounded-2xl border border-white/15 bg-black/40 px-3 py-2.5 backdrop-blur-md">
      <div className="flex items-center gap-2.5">
        <span
          className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/30"
          style={CHECKERBOARD_STYLE}
        >
          <span className="block h-full w-full" style={swatchStyle} />
        </span>
        <span className="flex-1 text-[9px] font-light tracking-[0.28em] text-white/70">
          {pickColorLabel}
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t("common.close")}
          className="h-6 w-6 shrink-0 rounded-full border border-white/20 bg-white/5 text-[11px] text-white/80 transition active:scale-95 active:bg-white/15"
        >
          ✕
        </button>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-light tracking-[0.28em] text-white/60">{hueLabel}</span>
          <span className="text-[10px] font-medium tabular-nums tracking-wider text-white/80">
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
          <span className="text-[9px] font-light tracking-[0.28em] text-white/60">
            {alphaLabel}
          </span>
          <span className="text-[10px] font-medium tabular-nums tracking-wider text-white/80">
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

type NamedOption = { id: string; name: string };
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
  settingsTab: SettingsTab;
  setSettingsTab: (tab: SettingsTab) => void;
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
  // VIRVEL (whirlpool camera mode) — shown here in place of the wave dials
  // above whenever cameraMode === "whirlpool" (see the vagor tab render
  // below). whirlpoolOpening/Radius/Speed/Direction drive the steady orbit;
  // the rest only matter while whirlpoolSequenceOn loops the camera through
  // drag-in / stay inside / thrown-back-or-reverse-spin automatically.
  whirlpoolOpening: number;
  setWhirlpoolOpening: Dispatch<SetStateAction<number>>;
  whirlpoolRadius: number;
  setWhirlpoolRadius: Dispatch<SetStateAction<number>>;
  whirlpoolSpeed: number;
  setWhirlpoolSpeed: Dispatch<SetStateAction<number>>;
  whirlpoolDirection: WhirlpoolDirection;
  setWhirlpoolDirection: Dispatch<SetStateAction<WhirlpoolDirection>>;
  whirlpoolSequenceOn: boolean;
  setWhirlpoolSequenceOn: Dispatch<SetStateAction<boolean>>;
  whirlpoolDragSpeed: number;
  setWhirlpoolDragSpeed: Dispatch<SetStateAction<number>>;
  whirlpoolDragDuration: number;
  setWhirlpoolDragDuration: Dispatch<SetStateAction<number>>;
  whirlpoolStayDuration: number;
  setWhirlpoolStayDuration: Dispatch<SetStateAction<number>>;
  whirlpoolExitMode: WhirlpoolExitMode;
  setWhirlpoolExitMode: Dispatch<SetStateAction<WhirlpoolExitMode>>;
  whirlpoolExitSpeed: number;
  setWhirlpoolExitSpeed: Dispatch<SetStateAction<number>>;

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
  swingXFactor: number;
  setSwingXFactor: Dispatch<SetStateAction<number>>;
  // Vertical excursion of the swing (formerly "swingYAmplitude").
  swingHeight: number;
  setSwingHeight: Dispatch<SetStateAction<number>>;
  swingPreset: SwingPreset;
  applySwingPreset: (preset: SwingPreset) => void;
  cycleSwingPreset: (dir: number) => void;
  swingYWaveform: SwingYWaveform;
  setSwingYWaveform: Dispatch<SetStateAction<SwingYWaveform>>;
  cycleSwingYWaveform: (dir: number) => void;
  // TORNADO: optional whirlpool-style circular orbit for GUNGA, instead of
  // its default back-and-forth pendulum arc — a whirlpool in the sky.
  swingTornadoOn: boolean;
  setSwingTornadoOn: Dispatch<SetStateAction<boolean>>;
  swingTornadoRadius: number;
  setSwingTornadoRadius: Dispatch<SetStateAction<number>>;
  swingTornadoSpeed: number;
  setSwingTornadoSpeed: Dispatch<SetStateAction<number>>;
  swingTornadoDirection: WhirlpoolDirection;
  setSwingTornadoDirection: Dispatch<SetStateAction<WhirlpoolDirection>>;
  // Interval session: automatically cycles cameraMode through whichever of
  // FRI/VIRVEL/GUNGA are enabled below, every intervalDuration seconds,
  // either forever or for a fixed intervalCount.
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
  intervalIncludeWhirlpool: boolean;
  setIntervalIncludeWhirlpool: Dispatch<SetStateAction<boolean>>;
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
  // General performance controls (independent of SIMGLASÖGON): caps the
  // main render loop's fps and scales the renderer's internal resolution.
  targetFps: number;
  setTargetFps: Dispatch<SetStateAction<number>>;
  resolutionScale: number;
  setResolutionScale: Dispatch<SetStateAction<number>>;
  // KROMATISK ABERRATION: a full-screen lens post-process (red/blue channels
  // sampled offset radially from center). chromaticAberrationAmount is the
  // dial's 0..1 strength, independent of whether the effect is on.
  chromaticAberrationOn: boolean;
  setChromaticAberrationOn: Dispatch<SetStateAction<boolean>>;
  chromaticAberrationAmount: number;
  setChromaticAberrationAmount: Dispatch<SetStateAction<number>>;
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
  sphereStrength: number;
  setSphereStrength: Dispatch<SetStateAction<number>>;
  waterOpacity: number;
  setWaterOpacity: Dispatch<SetStateAction<number>>;
  waterColorAlpha: number;
  setWaterColorAlpha: Dispatch<SetStateAction<number>>;
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
  depthSineOn: boolean;
  setDepthSineOn: Dispatch<SetStateAction<boolean>>;
  depthSineAmp: number;
  setDepthSineAmp: Dispatch<SetStateAction<number>>;
  depthSineFreq: number;
  setDepthSineFreq: Dispatch<SetStateAction<number>>;
  hideWater: boolean;
  setHideWater: Dispatch<SetStateAction<boolean>>;
  causticsOn: boolean;
  setCausticsOn: Dispatch<SetStateAction<boolean>>;

  // Miljö
  todLabel: string;
  setTimeOfDay: Dispatch<SetStateAction<number>>;
  midCloudsOn: boolean;
  setMidCloudsOn: Dispatch<SetStateAction<boolean>>;
  midCloudsHeight: number;
  setMidCloudsHeight: Dispatch<SetStateAction<number>>;
  skyCloudsOn: boolean;
  setSkyCloudsOn: Dispatch<SetStateAction<boolean>>;
  skyCloudsHeight: number;
  setSkyCloudsHeight: Dispatch<SetStateAction<number>>;
  cloudFadeSpeed: number;
  setCloudFadeSpeed: Dispatch<SetStateAction<number>>;
  worldBoundaryOn: boolean;
  setWorldBoundaryOn: Dispatch<SetStateAction<boolean>>;
  worldBoundarySize: number;
  setWorldBoundarySize: Dispatch<SetStateAction<number>>;
  worldBoundaryHeight: number;
  setWorldBoundaryHeight: Dispatch<SetStateAction<number>>;
  worldBoundaryYExtend: boolean;
  setWorldBoundaryYExtend: Dispatch<SetStateAction<boolean>>;
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
  scenes: NamedOption[];
  sceneId: string | null;
  setSceneId: Dispatch<SetStateAction<string | null>>;
  cycleScene: (dir: number) => void;
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
    "rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[9px] font-light tracking-wider text-white/70 transition active:scale-95 active:bg-white/15 disabled:opacity-30";

  return (
    <div className="mb-2 flex w-full flex-wrap items-center justify-center gap-1.5">
      <span className="text-[9px] font-light tracking-[0.28em] text-white/40">{label}</span>
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
            className="rounded-full border border-white/15 bg-black/40 px-2 py-0.5 text-[9px] text-white/70"
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
    "rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[9px] font-light tracking-wider text-white/70 transition active:scale-95 active:bg-white/15 disabled:opacity-30";

  return (
    <div className="mb-2 flex w-full flex-wrap items-center justify-center gap-1.5">
      <span className="text-[9px] font-light tracking-[0.28em] text-white/40">{label}</span>
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
            className="rounded-full border border-white/15 bg-black/40 px-2 py-0.5 text-[9px] text-white/70"
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
    "rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[9px] font-light tracking-wider text-white/70 transition active:scale-95 active:bg-white/15 disabled:opacity-30";

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
    settingsTab,
    setSettingsTab,
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
    whirlpoolOpening,
    setWhirlpoolOpening,
    whirlpoolRadius,
    setWhirlpoolRadius,
    whirlpoolSpeed,
    setWhirlpoolSpeed,
    whirlpoolDirection,
    setWhirlpoolDirection,
    whirlpoolSequenceOn,
    setWhirlpoolSequenceOn,
    whirlpoolDragSpeed,
    setWhirlpoolDragSpeed,
    whirlpoolDragDuration,
    setWhirlpoolDragDuration,
    whirlpoolStayDuration,
    setWhirlpoolStayDuration,
    whirlpoolExitMode,
    setWhirlpoolExitMode,
    whirlpoolExitSpeed,
    setWhirlpoolExitSpeed,
    cameraMode,
    setCameraMode,
    cycleCameraMode,
    noclipSpeed,
    setNoclipSpeed,
    noclipFallRiseSpeed,
    setNoclipFallRiseSpeed,
    noclipVertEaseTime,
    setNoclipVertEaseTime,
    noclipAutoAlternateOn,
    setNoclipAutoAlternateOn,
    noclipAutoAlternateInterval,
    setNoclipAutoAlternateInterval,
    swingPositionY,
    setSwingPositionY,
    swingIntensity,
    setSwingIntensity,
    swingXFactor,
    setSwingXFactor,
    swingHeight,
    setSwingHeight,
    swingPreset,
    applySwingPreset,
    cycleSwingPreset,
    swingYWaveform,
    setSwingYWaveform,
    cycleSwingYWaveform,
    swingTornadoOn,
    setSwingTornadoOn,
    swingTornadoRadius,
    setSwingTornadoRadius,
    swingTornadoSpeed,
    setSwingTornadoSpeed,
    swingTornadoDirection,
    setSwingTornadoDirection,
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
    intervalIncludeWhirlpool,
    setIntervalIncludeWhirlpool,
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
    targetFps,
    setTargetFps,
    resolutionScale,
    setResolutionScale,
    chromaticAberrationOn,
    setChromaticAberrationOn,
    chromaticAberrationAmount,
    setChromaticAberrationAmount,
    wakeLock,
    setWakeLock,
    waterColorIdx,
    setWaterColorIdx,
    waterColorAlpha,
    setWaterColorAlpha,
    surfaces,
    surfaceId,
    setSurfaceId,
    cycleSurface,
    reflStrength,
    setReflStrength,
    sphereMaterial,
    setSphereMaterial,
    sphereStrength,
    setSphereStrength,
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
    depthSineOn,
    setDepthSineOn,
    depthSineAmp,
    setDepthSineAmp,
    depthSineFreq,
    setDepthSineFreq,
    hideWater,
    setHideWater,
    causticsOn,
    setCausticsOn,
    todLabel,
    setTimeOfDay,
    midCloudsOn,
    setMidCloudsOn,
    midCloudsHeight,
    setMidCloudsHeight,
    skyCloudsOn,
    setSkyCloudsOn,
    skyCloudsHeight,
    setSkyCloudsHeight,
    cloudFadeSpeed,
    setCloudFadeSpeed,
    worldBoundaryOn,
    setWorldBoundaryOn,
    worldBoundarySize,
    setWorldBoundarySize,
    worldBoundaryHeight,
    setWorldBoundaryHeight,
    worldBoundaryYExtend,
    setWorldBoundaryYExtend,
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
  } = props;

  const { t } = useTranslation();
  const onOff = (v: boolean) => (v ? t("common.on") : t("common.off"));
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-white/90">
        <span className="text-[10px] font-light tracking-[0.4em] text-white/60">
          {t("settings.title")}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <LanguageSwitcher />
          <Link
            to="/about"
            className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[9px] font-light tracking-wider text-white/80 transition active:scale-95 active:bg-white/15"
          >
            {t("about.navLabel")}
          </Link>
          <button
            onClick={restoreCameraPosition}
            className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[9px] font-light tracking-wider text-white/80 transition active:scale-95 active:bg-white/15"
            aria-label={t("settings.restoreAriaLabel")}
            title={t("settings.restoreTitle")}
          >
            {t("settings.restore")}
          </button>
          <button
            onClick={() => setConfirmResetOpen(true)}
            className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[9px] font-light tracking-wider text-white/80 transition active:scale-95 active:bg-white/15"
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
      </div>
      <div
        className="mb-3 flex flex-wrap justify-center gap-1.5"
        role="tablist"
        aria-label={t("settings.tabsAriaLabel")}
      >
        {SETTINGS_TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={settingsTab === tab.id}
            onClick={() => setSettingsTab(tab.id)}
            className={`rounded-full border px-3 py-1 text-[9px] font-light tracking-wider transition active:scale-95 ${
              settingsTab === tab.id
                ? "border-white/40 bg-white/20 text-white"
                : "border-white/10 bg-white/5 text-white/60 active:bg-white/15"
            }`}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>
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
      <ShareBathLink buildBathLink={buildBathLink} />
      <div className="flex flex-wrap justify-center gap-2">
        {settingsTab === "vagor" && (
          <>
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
            {cameraMode === "whirlpool" ? (
              <>
                <PadDial
                  label={t("dial.wave.whirlpoolSpeed")}
                  mode="number"
                  value={`${whirlpoolSpeed.toFixed(2)}x`}
                  rawValue={whirlpoolSpeed}
                  onSet={(v) => setWhirlpoolSpeed(Math.max(0, Math.min(10, v)))}
                  min={0}
                  max={10}
                  step={0.1}
                  onDec={() => setWhirlpoolSpeed((v) => Math.max(0, +(v - 0.1).toFixed(2)))}
                  onInc={() => setWhirlpoolSpeed((v) => Math.min(10, +(v + 0.1).toFixed(2)))}
                />
                <PadDial
                  label={t("dial.wave.whirlpoolDirection")}
                  value={t(WHIRLPOOL_DIRECTION_LABEL_KEYS[whirlpoolDirection])}
                  options={WHIRLPOOL_DIRECTIONS.map((d) => t(WHIRLPOOL_DIRECTION_LABEL_KEYS[d]))}
                  selectedIndex={WHIRLPOOL_DIRECTIONS.indexOf(whirlpoolDirection)}
                  onSelectIndex={(i) => setWhirlpoolDirection(WHIRLPOOL_DIRECTIONS[i])}
                  onDec={() => setWhirlpoolDirection("cw")}
                  onInc={() => setWhirlpoolDirection("ccw")}
                />
                <PadDial
                  label={t("dial.wave.whirlpoolDistance")}
                  mode="number"
                  value={`${whirlpoolRadius.toFixed(1)}m`}
                  rawValue={whirlpoolRadius}
                  onSet={(v) => setWhirlpoolRadius(Math.max(3, Math.min(220, v)))}
                  min={3}
                  max={220}
                  step={1}
                  onDec={() => setWhirlpoolRadius((v) => Math.max(3, +(v - 1).toFixed(2)))}
                  onInc={() => setWhirlpoolRadius((v) => Math.min(220, +(v + 1).toFixed(2)))}
                />
                <PadDial
                  label={t("dial.wave.whirlpoolOpening")}
                  mode="number"
                  value={`${whirlpoolOpening.toFixed(1)}m`}
                  rawValue={whirlpoolOpening}
                  onSet={(v) => setWhirlpoolOpening(Math.max(3, Math.min(60, v)))}
                  min={3}
                  max={60}
                  step={0.5}
                  onDec={() => setWhirlpoolOpening((v) => Math.max(3, +(v - 0.5).toFixed(2)))}
                  onInc={() => setWhirlpoolOpening((v) => Math.min(60, +(v + 0.5).toFixed(2)))}
                />
                <PadDial
                  label={t("dial.wave.whirlpoolSequence")}
                  value={onOff(whirlpoolSequenceOn)}
                  onDec={() => setWhirlpoolSequenceOn(false)}
                  onInc={() => setWhirlpoolSequenceOn(true)}
                />
                {whirlpoolSequenceOn && (
                  <>
                    <PadDial
                      label={t("dial.wave.whirlpoolDragSpeed")}
                      mode="number"
                      value={`${whirlpoolDragSpeed.toFixed(1)}m/s`}
                      rawValue={whirlpoolDragSpeed}
                      onSet={(v) => setWhirlpoolDragSpeed(Math.max(0.5, Math.min(60, v)))}
                      min={0.5}
                      max={60}
                      step={0.5}
                      onDec={() =>
                        setWhirlpoolDragSpeed((v) => Math.max(0.5, +(v - 0.5).toFixed(2)))
                      }
                      onInc={() =>
                        setWhirlpoolDragSpeed((v) => Math.min(60, +(v + 0.5).toFixed(2)))
                      }
                    />
                    <PadDial
                      label={t("dial.wave.whirlpoolDragDuration")}
                      mode="number"
                      value={formatClock(whirlpoolDragDuration)}
                      rawValue={whirlpoolDragDuration}
                      onSet={(v) => setWhirlpoolDragDuration(Math.max(0.5, Math.min(120, v)))}
                      min={0.5}
                      max={120}
                      step={0.5}
                      onDec={() =>
                        setWhirlpoolDragDuration((v) => Math.max(0.5, +(v - 0.5).toFixed(2)))
                      }
                      onInc={() =>
                        setWhirlpoolDragDuration((v) => Math.min(120, +(v + 0.5).toFixed(2)))
                      }
                    />
                    <PadDial
                      label={t("dial.wave.whirlpoolStayDuration")}
                      mode="number"
                      value={formatClock(whirlpoolStayDuration)}
                      rawValue={whirlpoolStayDuration}
                      onSet={(v) => setWhirlpoolStayDuration(Math.max(0, Math.min(120, v)))}
                      min={0}
                      max={120}
                      step={0.5}
                      onDec={() =>
                        setWhirlpoolStayDuration((v) => Math.max(0, +(v - 0.5).toFixed(2)))
                      }
                      onInc={() =>
                        setWhirlpoolStayDuration((v) => Math.min(120, +(v + 0.5).toFixed(2)))
                      }
                    />
                    <PadDial
                      label={t("dial.wave.whirlpoolExitMode")}
                      value={t(WHIRLPOOL_EXIT_MODE_LABEL_KEYS[whirlpoolExitMode])}
                      options={WHIRLPOOL_EXIT_MODES.map((m) =>
                        t(WHIRLPOOL_EXIT_MODE_LABEL_KEYS[m]),
                      )}
                      selectedIndex={WHIRLPOOL_EXIT_MODES.indexOf(whirlpoolExitMode)}
                      onSelectIndex={(i) => setWhirlpoolExitMode(WHIRLPOOL_EXIT_MODES[i])}
                      onDec={() => setWhirlpoolExitMode("throwBack")}
                      onInc={() => setWhirlpoolExitMode("reverseSpin")}
                    />
                    <PadDial
                      label={t("dial.wave.whirlpoolExitSpeed")}
                      mode="number"
                      value={`${whirlpoolExitSpeed.toFixed(1)}m/s`}
                      rawValue={whirlpoolExitSpeed}
                      onSet={(v) => setWhirlpoolExitSpeed(Math.max(0.5, Math.min(60, v)))}
                      min={0.5}
                      max={60}
                      step={0.5}
                      onDec={() =>
                        setWhirlpoolExitSpeed((v) => Math.max(0.5, +(v - 0.5).toFixed(2)))
                      }
                      onInc={() =>
                        setWhirlpoolExitSpeed((v) => Math.min(60, +(v + 0.5).toFixed(2)))
                      }
                    />
                  </>
                )}
              </>
            ) : (
              <>
                <PadDial
                  label={t("dial.wave.amp")}
                  mode="number"
                  value={`${waveAmp.toFixed(2)}m`}
                  rawValue={waveAmp}
                  onSet={setWaveAmp}
                  min={0}
                  max={100}
                  step={0.5}
                  onDec={() => setWaveAmp((v) => Math.max(0, +(v - 0.5).toFixed(2)))}
                  onInc={() => setWaveAmp((v) => Math.min(100, +(v + 0.5).toFixed(2)))}
                />
                <PadDial
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
                <PadDial
                  label={t("dial.wave.freq")}
                  mode="number"
                  value={`${waveFreq.toFixed(2)}×`}
                  rawValue={waveFreq}
                  onSet={(v) => setWaveFreq(Math.max(WAVE_FREQ_MIN, Math.min(WAVE_FREQ_MAX, v)))}
                  min={WAVE_FREQ_MIN}
                  max={WAVE_FREQ_MAX}
                  step={0.05}
                  onDec={() => setWaveFreq((v) => Math.max(WAVE_FREQ_MIN, +(v - 0.05).toFixed(2)))}
                  onInc={() => setWaveFreq((v) => Math.min(WAVE_FREQ_MAX, +(v + 0.05).toFixed(2)))}
                />
                <PadDial
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
                <PadDial
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
                <PadDial
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
                <PadDial
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
                <PadDial
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
                <PadDial
                  label={t("dial.wave.sway")}
                  mode="number"
                  value={`${swayAmp.toFixed(1)}m`}
                  rawValue={swayAmp}
                  onSet={setSwayAmp}
                  min={0}
                  max={60}
                  step={0.5}
                  onDec={() => setSwayAmp((v) => Math.max(0, +(v - 0.5).toFixed(2)))}
                  onInc={() => setSwayAmp((v) => Math.min(60, +(v + 0.5).toFixed(2)))}
                />
                <PadDial
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
                <PadDial
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
                <PadDial
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
                <PadDial
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
                <PadDial
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
                <PadDial
                  label={t("dial.wave.waveform")}
                  value={
                    regularWaves
                      ? t("dial.wave.waveformValue.regular")
                      : t("dial.wave.waveformValue.spread")
                  }
                  onDec={() => setRegularWaves(false)}
                  onInc={() => setRegularWaves(true)}
                />
                <PadDial
                  label={t("dial.wave.realistic")}
                  value={realisticWaves ? t("dial.wave.realisticValue.on") : t("common.off")}
                  onDec={() => setRealisticWaves(false)}
                  onInc={() => setRealisticWaves(true)}
                />
                <PadDial
                  label={t("dial.wave.preset")}
                  value={t(WAVE_PRESET_LABEL_KEYS[wavePreset])}
                  onDec={() => applyWavePreset("legacy")}
                  onInc={() => applyWavePreset("standard")}
                />
                <PadDial
                  label={t("dial.wave.dyingWave")}
                  value={onOff(dyingWave)}
                  onDec={() => setDyingWave(false)}
                  onInc={() => setDyingWave(true)}
                />
                <PadDial
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
                <PadDial
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
                <PadDial
                  label={t("dial.wave.randomize")}
                  value={onOff(randomizeWaves)}
                  onDec={() => setRandomizeWaves(false)}
                  onInc={() => setRandomizeWaves(true)}
                />
                <PadDial
                  label={t("dial.wave.crossWave")}
                  value={onOff(regularCross)}
                  onDec={() => setRegularCross(false)}
                  onInc={() => setRegularCross(true)}
                />
                <PadDial
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
                <PadDial
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
                <PadDial
                  label={t("dial.wave.trochoid")}
                  mode="number"
                  value={trochoid <= 0.001 ? t("common.off") : `${Math.round(trochoid * 100)}%`}
                  rawValue={trochoid}
                  onSet={(v) => setTrochoid(Math.max(0, Math.min(1, v)))}
                  min={0}
                  max={1}
                  step={0.05}
                  onDec={() => setTrochoid((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
                  onInc={() => setTrochoid((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
                />
                <PadDial
                  label={t("dial.wave.heaveSkew")}
                  mode="number"
                  value={heaveSkew <= 0.001 ? t("common.off") : `${Math.round(heaveSkew * 100)}%`}
                  rawValue={heaveSkew}
                  onSet={(v) => setHeaveSkew(Math.max(0, Math.min(0.9, v)))}
                  min={0}
                  max={0.9}
                  step={0.05}
                  onDec={() => setHeaveSkew((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
                  onInc={() => setHeaveSkew((v) => Math.min(0.9, +(v + 0.05).toFixed(2)))}
                />
                <PadDial
                  label={t("dial.wave.quality")}
                  value={waveHighQuality ? t("common.high") : t("common.low")}
                  onDec={() => setWaveHighQuality(false)}
                  onInc={() => setWaveHighQuality(true)}
                />
                <PadDial
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
              </>
            )}
          </>
        )}
        {settingsTab === "kamera" && (
          <>
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
            {intervalSessionOn ? (
              <div className="flex min-w-[86px] flex-col items-start justify-center gap-0.5 rounded-full border border-white/15 bg-black/40 px-3 py-2 leading-tight">
                <span className="text-[9px] font-light tracking-[0.28em] text-white/60">
                  {t("dial.camera.mode")}
                </span>
                <span className="text-xs font-medium tracking-wider text-white/80">
                  {t(CAMERA_MODE_LABEL_KEYS[cameraMode])} {t("camera.mode.autoSuffix")}
                </span>
              </div>
            ) : (
              <PadDial
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
              <PadDial
                label={t("dial.camera.noclipSpeed")}
                mode="number"
                value={`${noclipSpeed.toFixed(1)}x`}
                rawValue={noclipSpeed}
                onSet={(v) => setNoclipSpeed(Math.max(0.2, Math.min(6, v)))}
                min={0.2}
                max={6}
                step={0.1}
                onDec={() => setNoclipSpeed((v) => Math.max(0.2, +(v - 0.1).toFixed(2)))}
                onInc={() => setNoclipSpeed((v) => Math.min(6, +(v + 0.1).toFixed(2)))}
              />
            )}
            {cameraMode === "noclip" && (
              <PadDial
                label={t("dial.camera.noclipFallRiseSpeed")}
                mode="number"
                value={`${noclipFallRiseSpeed.toFixed(0)}m/s`}
                rawValue={noclipFallRiseSpeed}
                onSet={(v) => setNoclipFallRiseSpeed(Math.max(2, Math.min(300, v)))}
                min={2}
                max={300}
                step={2}
                onDec={() => setNoclipFallRiseSpeed((v) => Math.max(2, +(v - 2).toFixed(0)))}
                onInc={() => setNoclipFallRiseSpeed((v) => Math.min(300, +(v + 2).toFixed(0)))}
              />
            )}
            {cameraMode === "noclip" && (
              <PadDial
                label={t("dial.camera.noclipVertEaseTime")}
                mode="number"
                value={`${noclipVertEaseTime.toFixed(2)}s`}
                rawValue={noclipVertEaseTime}
                onSet={(v) => setNoclipVertEaseTime(Math.max(0.05, Math.min(3, v)))}
                min={0.05}
                max={3}
                step={0.05}
                onDec={() => setNoclipVertEaseTime((v) => Math.max(0.05, +(v - 0.05).toFixed(2)))}
                onInc={() => setNoclipVertEaseTime((v) => Math.min(3, +(v + 0.05).toFixed(2)))}
              />
            )}
            {cameraMode === "noclip" && (
              <PadDial
                label={t("dial.camera.noclipAutoAlternate")}
                value={onOff(noclipAutoAlternateOn)}
                onDec={() => setNoclipAutoAlternateOn(false)}
                onInc={() => setNoclipAutoAlternateOn(true)}
              />
            )}
            {cameraMode === "noclip" && noclipAutoAlternateOn && (
              <PadDial
                label={t("dial.camera.noclipAutoAlternateInterval")}
                mode="number"
                value={`${noclipAutoAlternateInterval.toFixed(0)}s`}
                rawValue={noclipAutoAlternateInterval}
                onSet={(v) => setNoclipAutoAlternateInterval(Math.max(1, Math.min(120, v)))}
                min={1}
                max={120}
                step={1}
                onDec={() =>
                  setNoclipAutoAlternateInterval((v) => Math.max(1, +(v - 1).toFixed(0)))
                }
                onInc={() =>
                  setNoclipAutoAlternateInterval((v) => Math.min(120, +(v + 1).toFixed(0)))
                }
              />
            )}
            {cameraMode === "swing" && (
              <>
                <PadDial
                  label={t("dial.camera.swingStart")}
                  value={t(SWING_PRESET_LABEL_KEYS[swingPreset])}
                  options={SWING_PRESETS.map((p) => t(SWING_PRESET_LABEL_KEYS[p]))}
                  selectedIndex={SWING_PRESETS.indexOf(swingPreset)}
                  onSelectIndex={(i) => applySwingPreset(SWING_PRESETS[i])}
                  onDec={() => cycleSwingPreset(-1)}
                  onInc={() => cycleSwingPreset(1)}
                />
                <PadDial
                  label={t("dial.camera.swingPositionY")}
                  mode="number"
                  value={`${swingPositionY.toFixed(0)}m`}
                  rawValue={swingPositionY}
                  onSet={(v) => setSwingPositionY(Math.max(0, Math.min(100000, v)))}
                  min={0}
                  max={100000}
                  step={100}
                  onDec={() => setSwingPositionY((v) => Math.max(0, +(v - 100).toFixed(0)))}
                  onInc={() => setSwingPositionY((v) => Math.min(100000, +(v + 100).toFixed(0)))}
                />
                <PadDial
                  label={t("dial.camera.swingIntensity")}
                  mode="number"
                  value={`${swingIntensity.toFixed(4)}x`}
                  rawValue={swingIntensity}
                  onSet={(v) => setSwingIntensity(Math.max(0.0001, Math.min(2.5, v)))}
                  min={0.0001}
                  max={2.5}
                  step={0.05}
                  onDec={() => setSwingIntensity((v) => Math.max(0.0001, +(v - 0.05).toFixed(4)))}
                  onInc={() => setSwingIntensity((v) => Math.min(2.5, +(v + 0.05).toFixed(4)))}
                />
                <PadDial
                  label={t("dial.camera.swingXFactor")}
                  mode="number"
                  value={swingXFactor <= 0.001 ? t("common.off") : `${swingXFactor.toFixed(2)}x`}
                  rawValue={swingXFactor}
                  onSet={(v) => setSwingXFactor(Math.max(0, Math.min(2, v)))}
                  min={0}
                  max={2}
                  step={0.1}
                  onDec={() => setSwingXFactor((v) => Math.max(0, +(v - 0.1).toFixed(2)))}
                  onInc={() => setSwingXFactor((v) => Math.min(2, +(v + 0.1).toFixed(2)))}
                />
                <PadDial
                  label={t("dial.camera.swingHeight")}
                  mode="number"
                  value={`${swingHeight.toFixed(0)}m`}
                  rawValue={swingHeight}
                  onSet={(v) => setSwingHeight(Math.max(0, Math.min(100000, v)))}
                  min={0}
                  max={100000}
                  step={100}
                  onDec={() => setSwingHeight((v) => Math.max(0, +(v - 100).toFixed(0)))}
                  onInc={() => setSwingHeight((v) => Math.min(100000, +(v + 100).toFixed(0)))}
                />
                <PadDial
                  label={t("dial.camera.swingYWaveform")}
                  value={t(SWING_Y_WAVEFORM_LABEL_KEYS[swingYWaveform])}
                  options={SWING_Y_WAVEFORMS.map((w) => t(SWING_Y_WAVEFORM_LABEL_KEYS[w]))}
                  selectedIndex={SWING_Y_WAVEFORMS.indexOf(swingYWaveform)}
                  onSelectIndex={(i) => setSwingYWaveform(SWING_Y_WAVEFORMS[i])}
                  onDec={() => cycleSwingYWaveform(-1)}
                  onInc={() => cycleSwingYWaveform(1)}
                />
                <PadDial
                  label={t("dial.camera.swingTornado")}
                  value={onOff(swingTornadoOn)}
                  onDec={() => setSwingTornadoOn(false)}
                  onInc={() => setSwingTornadoOn(true)}
                />
                {swingTornadoOn && (
                  <>
                    <PadDial
                      label={t("dial.camera.swingTornadoRadius")}
                      mode="number"
                      value={`${swingTornadoRadius.toFixed(0)}m`}
                      rawValue={swingTornadoRadius}
                      onSet={(v) => setSwingTornadoRadius(Math.max(0, Math.min(2000, v)))}
                      min={0}
                      max={2000}
                      step={5}
                      onDec={() => setSwingTornadoRadius((v) => Math.max(0, +(v - 5).toFixed(0)))}
                      onInc={() =>
                        setSwingTornadoRadius((v) => Math.min(2000, +(v + 5).toFixed(0)))
                      }
                    />
                    <PadDial
                      label={t("dial.camera.swingTornadoSpeed")}
                      mode="number"
                      value={`${swingTornadoSpeed.toFixed(2)}x`}
                      rawValue={swingTornadoSpeed}
                      onSet={(v) => setSwingTornadoSpeed(Math.max(0, Math.min(10, v)))}
                      min={0}
                      max={10}
                      step={0.1}
                      onDec={() => setSwingTornadoSpeed((v) => Math.max(0, +(v - 0.1).toFixed(2)))}
                      onInc={() => setSwingTornadoSpeed((v) => Math.min(10, +(v + 0.1).toFixed(2)))}
                    />
                    <PadDial
                      label={t("dial.camera.swingTornadoDirection")}
                      value={t(WHIRLPOOL_DIRECTION_LABEL_KEYS[swingTornadoDirection])}
                      options={WHIRLPOOL_DIRECTIONS.map((d) =>
                        t(WHIRLPOOL_DIRECTION_LABEL_KEYS[d]),
                      )}
                      selectedIndex={WHIRLPOOL_DIRECTIONS.indexOf(swingTornadoDirection)}
                      onSelectIndex={(i) => setSwingTornadoDirection(WHIRLPOOL_DIRECTIONS[i])}
                      onDec={() => setSwingTornadoDirection("cw")}
                      onInc={() => setSwingTornadoDirection("ccw")}
                    />
                  </>
                )}
              </>
            )}
            <PadDial
              label={t("dial.camera.intervalSession")}
              value={onOff(intervalSessionOn)}
              onDec={() => setIntervalSessionOn(false)}
              onInc={() => setIntervalSessionOn(true)}
            />
            <PadDial
              label={t("dial.camera.intervalDuration")}
              mode="number"
              value={formatClock(intervalDuration)}
              rawValue={intervalDuration}
              onSet={(v) => setIntervalDuration(Math.max(5, Math.min(3600, Math.round(v))))}
              min={5}
              max={3600}
              step={5}
              onDec={() => setIntervalDuration((v) => Math.max(5, v - 5))}
              onInc={() => setIntervalDuration((v) => Math.min(3600, v + 5))}
            />
            <PadDial
              label={t("dial.camera.sessionType")}
              value={t(INTERVAL_SESSION_TYPE_LABEL_KEYS[intervalSessionType])}
              options={INTERVAL_SESSION_TYPES.map((it) => t(INTERVAL_SESSION_TYPE_LABEL_KEYS[it]))}
              selectedIndex={INTERVAL_SESSION_TYPES.indexOf(intervalSessionType)}
              onSelectIndex={(i) => setIntervalSessionType(INTERVAL_SESSION_TYPES[i])}
              onDec={() => setIntervalSessionType((t) => (t === "infinite" ? "fixed" : "infinite"))}
              onInc={() => setIntervalSessionType((t) => (t === "infinite" ? "fixed" : "infinite"))}
            />
            {intervalSessionType === "fixed" && (
              <PadDial
                label={t("dial.camera.intervalCount")}
                mode="number"
                value={`${intervalCount}`}
                rawValue={intervalCount}
                onSet={(v) => setIntervalCount(Math.max(1, Math.min(50, Math.round(v))))}
                min={1}
                max={50}
                step={1}
                onDec={() => setIntervalCount((v) => Math.max(1, v - 1))}
                onInc={() => setIntervalCount((v) => Math.min(50, v + 1))}
              />
            )}
            <PadDial
              label={t("dial.camera.showStats")}
              value={onOff(intervalShowStats)}
              onDec={() => setIntervalShowStats(false)}
              onInc={() => setIntervalShowStats(true)}
            />
            <PadDial
              label={t("dial.camera.intervalIncludeFloat")}
              value={onOff(intervalIncludeFloat)}
              onDec={() => setIntervalIncludeFloat(false)}
              onInc={() => setIntervalIncludeFloat(true)}
            />
            <PadDial
              label={t("dial.camera.intervalIncludeWhirlpool")}
              value={onOff(intervalIncludeWhirlpool)}
              onDec={() => setIntervalIncludeWhirlpool(false)}
              onInc={() => setIntervalIncludeWhirlpool(true)}
            />
            <PadDial
              label={t("dial.camera.intervalIncludeSwing")}
              value={onOff(intervalIncludeSwing)}
              onDec={() => setIntervalIncludeSwing(false)}
              onInc={() => setIntervalIncludeSwing(true)}
            />
            <PadDial
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
            <PadDial
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
            <PadDial
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
            <PadDial
              label={t("dial.camera.fov")}
              mode="number"
              value={`${camFov.toFixed(0)}°`}
              rawValue={camFov}
              onSet={(v) => setCamFov(Math.max(20, Math.min(140, v)))}
              min={20}
              max={140}
              step={1}
              onDec={() => setCamFov((v) => Math.max(20, +(v - 1).toFixed(0)))}
              onInc={() => setCamFov((v) => Math.min(140, +(v + 1).toFixed(0)))}
            />
            <PadDial
              label={t("dial.camera.near")}
              mode="number"
              value={`${camNear.toFixed(3)}`}
              rawValue={camNear}
              onSet={(v) => setCamNear(Math.max(0.001, Math.min(10, v)))}
              min={0.001}
              max={10}
              step={0.01}
              onDec={() => setCamNear((v) => Math.max(0.001, +(v - 0.01).toFixed(3)))}
              onInc={() => setCamNear((v) => Math.min(10, +(v + 0.01).toFixed(3)))}
            />
            <PadDial
              label={t("dial.camera.far")}
              mode="number"
              value={`${camFar.toFixed(0)}`}
              rawValue={camFar}
              onSet={(v) => setCamFar(Math.max(100, Math.min(300000, v)))}
              min={100}
              max={300000}
              step={100}
              onDec={() => setCamFar((v) => Math.max(100, +(v - 100).toFixed(0)))}
              onInc={() => setCamFar((v) => Math.min(300000, +(v + 100).toFixed(0)))}
            />
            <PadDial
              label={t("dial.camera.rotation")}
              value={
                leanEnabled
                  ? t("camera.rotationValue.leanForward")
                  : t("camera.rotationValue.fixed")
              }
              onDec={() => setLeanEnabled(false)}
              onInc={() => setLeanEnabled(true)}
            />
            <PadDial
              label={t("dial.camera.wakeLock")}
              value={onOff(wakeLock)}
              onDec={() => setWakeLock(false)}
              onInc={() => setWakeLock(true)}
            />
            <PadDial
              label={t("dial.camera.goggles")}
              value={onOff(gogglesOn)}
              onDec={() => setGogglesOn(false)}
              onInc={() => setGogglesOn(true)}
            />
            <PadDial
              label={t("dial.camera.gogglesBlur")}
              mode="number"
              value={`${Math.round(gogglesBlur * 100)}%`}
              rawValue={gogglesBlur}
              onSet={(v) => setGogglesBlur(Math.max(0, Math.min(1, v)))}
              min={0}
              max={1}
              step={0.05}
              onDec={() => setGogglesBlur((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
              onInc={() => setGogglesBlur((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
            />
            <PadDial
              label={t("dial.camera.gogglesLoop")}
              value={onOff(gogglesLoop)}
              onDec={() => setGogglesLoop(false)}
              onInc={() => setGogglesLoop(true)}
            />
            <PadDial
              label={t("dial.camera.gogglesIntensity")}
              mode="number"
              value={`${Math.round(gogglesIntensity * 100)}%`}
              rawValue={gogglesIntensity}
              onSet={(v) => setGogglesIntensity(Math.max(0, Math.min(1, v)))}
              min={0}
              max={1}
              step={0.05}
              onDec={() => setGogglesIntensity((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
              onInc={() => setGogglesIntensity((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
            />
            <PadDial
              label={t("dial.camera.gogglesFpsCap")}
              mode="number"
              value={`${gogglesFpsCap} fps`}
              rawValue={gogglesFpsCap}
              onSet={(v) => setGogglesFpsCap(Math.max(10, Math.min(60, Math.round(v))))}
              min={10}
              max={60}
              step={5}
              onDec={() => setGogglesFpsCap((v) => Math.max(10, v - 5))}
              onInc={() => setGogglesFpsCap((v) => Math.min(60, v + 5))}
            />
            <PadDial
              label={t("dial.camera.targetFps")}
              mode="number"
              value={`${targetFps} fps`}
              rawValue={targetFps}
              onSet={(v) => setTargetFps(Math.max(10, Math.min(120, Math.round(v))))}
              min={10}
              max={120}
              step={5}
              onDec={() => setTargetFps((v) => Math.max(10, v - 5))}
              onInc={() => setTargetFps((v) => Math.min(120, v + 5))}
            />
            <PadDial
              label={t("dial.camera.resolutionScale")}
              mode="number"
              value={`${Math.round(resolutionScale * 100)}%`}
              rawValue={resolutionScale}
              onSet={(v) => setResolutionScale(Math.max(0.25, Math.min(1.5, v)))}
              min={0.25}
              max={1.5}
              step={0.05}
              onDec={() => setResolutionScale((v) => Math.max(0.25, +(v - 0.05).toFixed(2)))}
              onInc={() => setResolutionScale((v) => Math.min(1.5, +(v + 0.05).toFixed(2)))}
            />
            <PadDial
              label={t("dial.camera.chromaticAberration")}
              value={onOff(chromaticAberrationOn)}
              onDec={() => setChromaticAberrationOn(false)}
              onInc={() => setChromaticAberrationOn(true)}
            />
            <PadDial
              label={t("dial.camera.chromaticAberrationAmount")}
              mode="number"
              value={`${Math.round(chromaticAberrationAmount * 100)}%`}
              rawValue={chromaticAberrationAmount}
              onSet={(v) => setChromaticAberrationAmount(Math.max(0, Math.min(1, v)))}
              min={0}
              max={1}
              step={0.05}
              onDec={() => setChromaticAberrationAmount((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
              onInc={() => setChromaticAberrationAmount((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
            />
          </>
        )}
        {settingsTab === "vatten" && (
          <>
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
            <PadDial
              label={t("dial.water.color")}
              value={t(WATER_COLOR_LABEL_KEYS[WATER_COLORS[waterColorIdx].id])}
              options={WATER_COLORS.map((w) => t(WATER_COLOR_LABEL_KEYS[w.id]))}
              selectedIndex={waterColorIdx}
              onSelectIndex={setWaterColorIdx}
              onDec={() =>
                setWaterColorIdx((i) => (i - 1 + WATER_COLORS.length) % WATER_COLORS.length)
              }
              onInc={() => setWaterColorIdx((i) => (i + 1) % WATER_COLORS.length)}
            />
            {surfaces.length > 0 && (
              <PadDial
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
              <PadDial
                label={t("dial.water.reflStrength")}
                mode="number"
                value={`${Math.round(reflStrength * 100)}%`}
                rawValue={reflStrength}
                onSet={(v) => setReflStrength(Math.max(0, Math.min(3, v)))}
                min={0}
                max={3}
                step={0.05}
                onDec={() => setReflStrength((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
                onInc={() => setReflStrength((v) => Math.min(3, +(v + 0.05).toFixed(2)))}
              />
            )}
            <PadDial
              label={t("dial.water.waveMaterial")}
              value={
                sphereMaterial
                  ? t("dial.water.waveMaterialValue.sphereMap")
                  : t("dial.water.waveMaterialValue.standard")
              }
              onDec={() => setSphereMaterial(false)}
              onInc={() => setSphereMaterial(true)}
            />
            {sphereMaterial && (
              <PadDial
                label={t("dial.water.sphereStrength")}
                mode="number"
                value={`${Math.round(sphereStrength * 100)}%`}
                rawValue={sphereStrength}
                onSet={(v) => setSphereStrength(Math.max(0, Math.min(1, v)))}
                min={0}
                max={1}
                step={0.05}
                onDec={() => setSphereStrength((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
                onInc={() => setSphereStrength((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
              />
            )}
            <PadDial
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
            <WaterColorPicker
              pickColorLabel={t("dial.water.pickColor")}
              hueLabel={t("dial.water.hue")}
              alphaLabel={t("dial.water.colorAlpha")}
              hue={waterHue}
              setHue={setWaterHue}
              alpha={waterColorAlpha}
              setAlpha={setWaterColorAlpha}
            />
            <PadDial
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
            <PadDial
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
            <PadDial
              label={t("dial.water.surfBright")}
              mode="number"
              value={`${surfBright.toFixed(2)}x`}
              rawValue={surfBright}
              onSet={(v) => setSurfBright(Math.max(0.1, Math.min(3, v)))}
              min={0.1}
              max={3}
              step={0.05}
              onDec={() => setSurfBright((v) => Math.max(0.1, +(v - 0.05).toFixed(2)))}
              onInc={() => setSurfBright((v) => Math.min(3, +(v + 0.05).toFixed(2)))}
            />
            <PadDial
              label={t("dial.water.surfSat")}
              mode="number"
              value={`${surfSat.toFixed(2)}x`}
              rawValue={surfSat}
              onSet={(v) => setSurfSat(Math.max(0, Math.min(2, v)))}
              min={0}
              max={2}
              step={0.05}
              onDec={() => setSurfSat((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
              onInc={() => setSurfSat((v) => Math.min(2, +(v + 0.05).toFixed(2)))}
            />
            <PadDial
              label={t("dial.water.turbidity")}
              mode="number"
              value={turbidity <= 0.001 ? t("common.off") : `${Math.round(turbidity * 100)}%`}
              rawValue={turbidity}
              onSet={(v) => setTurbidity(Math.max(0, Math.min(1, v)))}
              min={0}
              max={1}
              step={0.05}
              onDec={() => setTurbidity((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
              onInc={() => setTurbidity((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
            />
            <PadDial
              label={t("dial.water.bottom")}
              value={t(BOTTOM_LABEL_KEYS[BOTTOM_OPTIONS[bottomIdx].id])}
              options={BOTTOM_OPTIONS.map((b) => t(BOTTOM_LABEL_KEYS[b.id]))}
              selectedIndex={bottomIdx}
              onSelectIndex={setBottomIdx}
              onDec={() =>
                setBottomIdx((i) => (i - 1 + BOTTOM_OPTIONS.length) % BOTTOM_OPTIONS.length)
              }
              onInc={() => setBottomIdx((i) => (i + 1) % BOTTOM_OPTIONS.length)}
            />
            {BOTTOM_OPTIONS[bottomIdx].id === "custom" && (
              <label className="flex items-center gap-2 rounded-full border border-white/15 bg-black/40 py-1 pl-3 pr-1 backdrop-blur-md">
                <span className="text-[9px] font-light tracking-[0.28em] text-white/60">
                  {t("dial.water.bottomColor")}
                </span>
                <input
                  type="color"
                  value={bottomColor}
                  onChange={(e) => setBottomColor(e.target.value)}
                  className="h-7 w-9 cursor-pointer rounded-full border border-white/20 bg-transparent p-0"
                />
              </label>
            )}
            <PadDial
              label={t("dial.water.depth")}
              mode="number"
              value={`${floorDepth.toFixed(1)}m`}
              rawValue={floorDepth}
              onSet={(v) => setFloorDepth(Math.max(1, Math.min(60, v)))}
              min={1}
              max={60}
              step={0.5}
              onDec={() => setFloorDepth((v) => Math.max(1, +(v - 0.5).toFixed(2)))}
              onInc={() => setFloorDepth((v) => Math.min(60, +(v + 0.5).toFixed(2)))}
            />
            <PadDial
              label={t("common.texture")}
              value={onOff(floorTexture)}
              onDec={() => setFloorTexture(false)}
              onInc={() => setFloorTexture(true)}
            />
            <PadDial
              label={t("dial.water.depthSine")}
              value={onOff(depthSineOn)}
              onDec={() => setDepthSineOn(false)}
              onInc={() => setDepthSineOn(true)}
            />
            <PadDial
              label={t("dial.water.sineAmp")}
              mode="number"
              value={`${depthSineAmp.toFixed(2)}m`}
              rawValue={depthSineAmp}
              onSet={(v) => setDepthSineAmp(Math.max(0, Math.min(30, v)))}
              min={0}
              max={30}
              step={0.25}
              onDec={() => setDepthSineAmp((v) => Math.max(0, +(v - 0.25).toFixed(2)))}
              onInc={() => setDepthSineAmp((v) => Math.min(30, +(v + 0.25).toFixed(2)))}
            />
            <PadDial
              label={t("dial.water.sineFreq")}
              mode="number"
              value={`${depthSineFreq.toFixed(2)}Hz`}
              rawValue={depthSineFreq}
              onSet={(v) => setDepthSineFreq(Math.max(0.001, Math.min(2, v)))}
              min={0.001}
              max={2}
              step={0.01}
              onDec={() => setDepthSineFreq((v) => Math.max(0.001, +(v - 0.01).toFixed(3)))}
              onInc={() => setDepthSineFreq((v) => Math.min(2, +(v + 0.01).toFixed(3)))}
            />
            <PadDial
              label={t("dial.water.surface")}
              value={
                hideWater ? t("dial.water.surfaceValue.hide") : t("dial.water.surfaceValue.visible")
              }
              onDec={() => setHideWater(true)}
              onInc={() => setHideWater(false)}
            />
            <PadDial
              label={t("dial.water.caustics")}
              value={onOff(causticsOn)}
              onDec={() => setCausticsOn(false)}
              onInc={() => setCausticsOn(true)}
            />
          </>
        )}
        {settingsTab === "miljo" && (
          <>
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
            <PadDial
              label={t("dial.env.time")}
              value={todLabel}
              onDec={() => setTimeOfDay((v) => (v - 0.02 + 1) % 1)}
              onInc={() => setTimeOfDay((v) => (v + 0.02) % 1)}
            />
            <PadDial
              label={t("dial.env.midClouds")}
              value={onOff(midCloudsOn)}
              onDec={() => setMidCloudsOn(false)}
              onInc={() => setMidCloudsOn(true)}
            />
            <PadDial
              label={t("dial.env.midCloudsHeight")}
              mode="number"
              value={`${Math.round(midCloudsHeight * 100)}%`}
              rawValue={midCloudsHeight}
              onSet={(v) => setMidCloudsHeight(Math.max(0.05, Math.min(0.95, v)))}
              min={0.05}
              max={0.95}
              step={0.05}
              onDec={() => setMidCloudsHeight((v) => Math.max(0.05, +(v - 0.05).toFixed(2)))}
              onInc={() => setMidCloudsHeight((v) => Math.min(0.95, +(v + 0.05).toFixed(2)))}
            />
            <PadDial
              label={t("dial.env.skyClouds")}
              value={onOff(skyCloudsOn)}
              onDec={() => setSkyCloudsOn(false)}
              onInc={() => setSkyCloudsOn(true)}
            />
            <PadDial
              label={t("dial.env.skyCloudsHeight")}
              mode="number"
              value={`${Math.round(skyCloudsHeight * 100)}%`}
              rawValue={skyCloudsHeight}
              onSet={(v) => setSkyCloudsHeight(Math.max(0, Math.min(1, v)))}
              min={0}
              max={1}
              step={0.05}
              onDec={() => setSkyCloudsHeight((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
              onInc={() => setSkyCloudsHeight((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
            />
            <PadDial
              label={t("dial.env.cloudFadeSpeed")}
              mode="number"
              value={`${cloudFadeSpeed.toFixed(1)}x`}
              rawValue={cloudFadeSpeed}
              onSet={(v) => setCloudFadeSpeed(Math.max(0.2, Math.min(12, v)))}
              min={0.2}
              max={12}
              step={0.2}
              onDec={() => setCloudFadeSpeed((v) => Math.max(0.2, +(v - 0.2).toFixed(1)))}
              onInc={() => setCloudFadeSpeed((v) => Math.min(12, +(v + 0.2).toFixed(1)))}
            />
            <PadDial
              label={t("dial.env.worldBoundary")}
              value={onOff(worldBoundaryOn)}
              onDec={() => setWorldBoundaryOn(false)}
              onInc={() => setWorldBoundaryOn(true)}
            />
            {worldBoundaryOn && (
              <>
                <PadDial
                  label={t("dial.env.worldBoundarySize")}
                  mode="number"
                  value={`${worldBoundarySize.toFixed(0)}m`}
                  rawValue={worldBoundarySize}
                  onSet={(v) => setWorldBoundarySize(Math.max(200, Math.min(500000, v)))}
                  min={200}
                  max={500000}
                  step={500}
                  onDec={() => setWorldBoundarySize((v) => Math.max(200, +(v - 500).toFixed(0)))}
                  onInc={() => setWorldBoundarySize((v) => Math.min(500000, +(v + 500).toFixed(0)))}
                />
                <PadDial
                  label={t("dial.env.worldBoundaryHeight")}
                  mode="number"
                  value={`${worldBoundaryHeight.toFixed(0)}m`}
                  rawValue={worldBoundaryHeight}
                  onSet={(v) => setWorldBoundaryHeight(Math.max(200, Math.min(500000, v)))}
                  min={200}
                  max={500000}
                  step={200}
                  onDec={() => setWorldBoundaryHeight((v) => Math.max(200, +(v - 200).toFixed(0)))}
                  onInc={() =>
                    setWorldBoundaryHeight((v) => Math.min(500000, +(v + 200).toFixed(0)))
                  }
                />
                <PadDial
                  label={t("dial.env.worldBoundaryYExtend")}
                  value={onOff(worldBoundaryYExtend)}
                  onDec={() => setWorldBoundaryYExtend(false)}
                  onInc={() => setWorldBoundaryYExtend(true)}
                />
              </>
            )}
            <PadDial
              label={t("dial.env.roomSize")}
              mode="number"
              value={`${surfaceArea.toFixed(0)}m`}
              rawValue={surfaceArea}
              onSet={(v) => setSurfaceArea(Math.max(200, Math.min(700000, v)))}
              min={200}
              max={700000}
              step={1000}
              onDec={() => setSurfaceArea((v) => Math.max(200, +(v - 1000).toFixed(0)))}
              onInc={() => setSurfaceArea((v) => Math.min(700000, +(v + 1000).toFixed(0)))}
            />
            {scenes.length > 0 && (
              <PadDial
                label={t("dial.env.scene")}
                value={
                  sceneId
                    ? (scenes.find((s) => s.id === sceneId)?.name ?? sceneId)
                    : t("common.off")
                }
                options={[t("common.off"), ...scenes.map((s) => s.name)]}
                selectedIndex={sceneId ? 1 + scenes.findIndex((s) => s.id === sceneId) : 0}
                onSelectIndex={(i) => setSceneId(i === 0 ? null : (scenes[i - 1]?.id ?? null))}
                onDec={() => cycleScene(-1)}
                onInc={() => cycleScene(1)}
              />
            )}
            {environments.length > 0 && (
              <>
                <PadDial
                  label={t("dial.env.environment")}
                  value={curEnv ? curEnv.name : t("common.off")}
                  options={[t("common.off"), ...environments.map((e) => e.name)]}
                  selectedIndex={curEnv ? 1 + environments.findIndex((e) => e.id === curEnv.id) : 0}
                  onSelectIndex={(i) =>
                    applyEnv(i === 0 ? null : (environments[i - 1]?.id ?? null))
                  }
                  onDec={() => cycleEnv(-1)}
                  onInc={() => cycleEnv(1)}
                />
                {curEnv && curEnv.eras.length > 1 && (
                  <PadDial
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
                  <PadDial
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
              </>
            )}
            <PadDial
              label={t("dial.env.backdrop")}
              value={t(BACKDROP_LABEL_KEYS[BACKDROPS[backdropIdx].id])}
              options={BACKDROPS.map((b) => t(BACKDROP_LABEL_KEYS[b.id]))}
              selectedIndex={backdropIdx}
              onSelectIndex={setBackdropIdx}
              onDec={() => setBackdropIdx((i) => (i - 1 + BACKDROPS.length) % BACKDROPS.length)}
              onInc={() => setBackdropIdx((i) => (i + 1) % BACKDROPS.length)}
            />
            <PadDial
              label={t("dial.env.live")}
              value={onOff(liveMode)}
              onDec={() => setLiveMode(false)}
              onInc={() => setLiveMode(true)}
            />
            <PadDial
              label={t("dial.env.torusRings")}
              value={onOff(torusRingsOn)}
              onDec={() => setTorusRingsOn(false)}
              onInc={() => setTorusRingsOn(true)}
            />
            {torusRingsOn && (
              <>
                <PadDial
                  label={t("dial.env.torusRadius")}
                  mode="number"
                  value={`${torusRadius.toFixed(2)}m`}
                  rawValue={torusRadius}
                  onSet={(v) => setTorusRadius(Math.max(0.1, Math.min(5, v)))}
                  min={0.1}
                  max={5}
                  step={0.05}
                  onDec={() => setTorusRadius((v) => Math.max(0.1, +(v - 0.05).toFixed(2)))}
                  onInc={() => setTorusRadius((v) => Math.min(5, +(v + 0.05).toFixed(2)))}
                />
                <PadDial
                  label={t("dial.env.torusTube")}
                  mode="number"
                  value={`${torusTube.toFixed(2)}m`}
                  rawValue={torusTube}
                  onSet={(v) => setTorusTube(Math.max(0.01, Math.min(1, v)))}
                  min={0.01}
                  max={1}
                  step={0.01}
                  onDec={() => setTorusTube((v) => Math.max(0.01, +(v - 0.01).toFixed(2)))}
                  onInc={() => setTorusTube((v) => Math.min(1, +(v + 0.01).toFixed(2)))}
                />
                <PadDial
                  label={t("dial.env.torusScale")}
                  mode="number"
                  value={`${torusScale.toFixed(2)}x`}
                  rawValue={torusScale}
                  onSet={(v) => setTorusScale(Math.max(0.1, Math.min(10, v)))}
                  min={0.1}
                  max={10}
                  step={0.1}
                  onDec={() => setTorusScale((v) => Math.max(0.1, +(v - 0.1).toFixed(2)))}
                  onInc={() => setTorusScale((v) => Math.min(10, +(v + 0.1).toFixed(2)))}
                />
                <PadDial
                  label={t("common.opacity")}
                  mode="number"
                  value={`${Math.round(torusOpacity * 100)}%`}
                  rawValue={torusOpacity}
                  onSet={(v) => setTorusOpacity(Math.max(0, Math.min(1, v)))}
                  min={0}
                  max={1}
                  step={0.05}
                  onDec={() => setTorusOpacity((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
                  onInc={() => setTorusOpacity((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
                />
                <PadDial
                  label={t("common.texture")}
                  value={t(TORUS_TEXTURE_LABEL_KEYS[TORUS_RING_TEXTURES[torusTextureIdx].id])}
                  onDec={() =>
                    setTorusTextureIdx(
                      (i) => (i - 1 + TORUS_RING_TEXTURES.length) % TORUS_RING_TEXTURES.length,
                    )
                  }
                  onInc={() => setTorusTextureIdx((i) => (i + 1) % TORUS_RING_TEXTURES.length)}
                />
                <PadDial
                  label={t("dial.env.torusCellSize")}
                  mode="number"
                  value={`${torusCellSize.toFixed(0)}m`}
                  rawValue={torusCellSize}
                  onSet={(v) => setTorusCellSize(Math.max(1, Math.min(60, v)))}
                  min={1}
                  max={60}
                  step={1}
                  onDec={() => setTorusCellSize((v) => Math.max(1, +(v - 1).toFixed(0)))}
                  onInc={() => setTorusCellSize((v) => Math.min(60, +(v + 1).toFixed(0)))}
                />
                <PadDial
                  label={t("dial.env.torusVerticalSpacing")}
                  mode="number"
                  value={`${torusVerticalSpacing.toFixed(1)}m`}
                  rawValue={torusVerticalSpacing}
                  onSet={(v) => setTorusVerticalSpacing(Math.max(0.2, Math.min(20, v)))}
                  min={0.2}
                  max={20}
                  step={0.1}
                  onDec={() => setTorusVerticalSpacing((v) => Math.max(0.2, +(v - 0.1).toFixed(2)))}
                  onInc={() => setTorusVerticalSpacing((v) => Math.min(20, +(v + 0.1).toFixed(2)))}
                />
                <PadDial
                  label={t("dial.env.torusVerticalCount")}
                  mode="number"
                  value={`${torusVerticalCount}`}
                  rawValue={torusVerticalCount}
                  onSet={(v) => setTorusVerticalCount(Math.max(1, Math.min(21, Math.round(v))))}
                  min={1}
                  max={21}
                  step={2}
                  onDec={() => setTorusVerticalCount((v) => Math.max(1, v - 2))}
                  onInc={() => setTorusVerticalCount((v) => Math.min(21, v + 2))}
                />
                <PadDial
                  label={t("dial.env.torusViewDistance")}
                  mode="number"
                  value={`${torusViewDistance.toFixed(0)}m`}
                  rawValue={torusViewDistance}
                  onSet={(v) => setTorusViewDistance(Math.max(torusCellSize, Math.min(400, v)))}
                  min={torusCellSize}
                  max={400}
                  step={2}
                  onDec={() =>
                    setTorusViewDistance((v) => Math.max(torusCellSize, +(v - 2).toFixed(0)))
                  }
                  onInc={() => setTorusViewDistance((v) => Math.min(400, +(v + 2).toFixed(0)))}
                />
                <PadDial
                  label={t("dial.env.torusFadeDistance")}
                  mode="number"
                  value={`${torusFadeDistance.toFixed(1)}m`}
                  rawValue={torusFadeDistance}
                  onSet={(v) => setTorusFadeDistance(Math.max(0.5, Math.min(100, v)))}
                  min={0.5}
                  max={100}
                  step={0.5}
                  onDec={() => setTorusFadeDistance((v) => Math.max(0.5, +(v - 0.5).toFixed(1)))}
                  onInc={() => setTorusFadeDistance((v) => Math.min(100, +(v + 0.5).toFixed(1)))}
                />
              </>
            )}
          </>
        )}
        {settingsTab === "ljud" && (
          <>
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
            <PadDial
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
            <PadDial
              label={t("dial.audio.sound")}
              value={t(WATER_SOUND_LABEL_KEYS[WATER_SOUNDS[waterSoundIdx].id])}
              options={WATER_SOUNDS.map((s) => t(WATER_SOUND_LABEL_KEYS[s.id]))}
              selectedIndex={waterSoundIdx}
              onSelectIndex={setWaterSoundIdx}
              onDec={() =>
                setWaterSoundIdx((i) => (i - 1 + WATER_SOUNDS.length) % WATER_SOUNDS.length)
              }
              onInc={() => setWaterSoundIdx((i) => (i + 1) % WATER_SOUNDS.length)}
            />
            <PadDial
              label={t("dial.audio.syncSpeed")}
              value={onOff(audioSyncSpeed)}
              onDec={() => setAudioSyncSpeed(false)}
              onInc={() => setAudioSyncSpeed(true)}
            />
            <PadDial
              label={t("dial.audio.spatial")}
              value={onOff(audioSpatial)}
              onDec={() => setAudioSpatial(false)}
              onInc={() => setAudioSpatial(true)}
            />
          </>
        )}
      </div>
    </>
  );
}
