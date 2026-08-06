import { useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { PadDial } from "@/components/PadDial";
import {
  SETTINGS_TABS,
  WATER_TINTS,
  BOTTOM_OPTIONS,
  BACKDROPS,
  TORUS_RING_TEXTURES,
  CAMERA_MODES,
  CAMERA_MODE_LABELS,
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
} from "@/lib/settingsShared";
import { pickJsonFile, type PresetScope, type SavedPreset, type SavedState } from "@/lib/presets";

// Swedish display labels for enum values that don't already carry a
// human-readable "name" (unlike scenes/environments/surfaces, which come
// from data with their own name field).
const INTERVAL_SESSION_TYPE_LABELS: Record<IntervalSessionType, string> = {
  infinite: "OÄNDLIGT",
  fixed: "FASTA INTERVALL",
};
const SWING_PRESET_LABELS: Record<SwingPreset, string> = {
  water: "VATTEN",
  clouds: "MOLN",
  custom: "ANPASSAD",
};
const SWING_Y_WAVEFORM_LABELS: Record<SwingYWaveform, string> = {
  pendulum: "PENDEL",
  sine: "SINUS",
  triangle: "TRIANGEL",
  square: "FYRKANT",
};
const WAVE_PRESET_LABELS: Record<WavePresetName, string> = {
  standard: "STANDARD",
  legacy: "LEGACY",
};

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
  waveHighQuality: boolean;
  setWaveHighQuality: Dispatch<SetStateAction<boolean>>;
  waveDir: number;
  setWaveDir: Dispatch<SetStateAction<number>>;
  vortexMode: boolean;
  setVortexMode: Dispatch<SetStateAction<boolean>>;
  vortexOpening: number;
  setVortexOpening: Dispatch<SetStateAction<number>>;
  vortexRadius: number;
  setVortexRadius: Dispatch<SetStateAction<number>>;
  vortexSpeed: number;
  setVortexSpeed: Dispatch<SetStateAction<number>>;

  // Kamera
  cameraMode: CameraMode;
  setCameraMode: Dispatch<SetStateAction<CameraMode>>;
  cycleCameraMode: (dir: number) => void;
  noclipSpeed: number;
  setNoclipSpeed: Dispatch<SetStateAction<number>>;
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
  // Interval session: automatically alternates FRI/GUNGA every
  // intervalDuration seconds, either forever or for a fixed intervalCount.
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
  wakeLock: boolean;
  setWakeLock: Dispatch<SetStateAction<boolean>>;

  // Vatten
  waterTintIdx: number;
  setWaterTintIdx: Dispatch<SetStateAction<number>>;
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
  const scoped = savedPresets.filter((p) => p.scope === scope);
  const [selected, setSelected] = useState("");
  const activeId = scoped.some((p) => p.id === selected) ? selected : "";
  const btnClass =
    "rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[9px] font-light tracking-wider text-white/70 transition active:scale-95 active:bg-white/15 disabled:opacity-30";

  return (
    <div className="mb-2 flex w-full flex-wrap items-center justify-center gap-1.5">
      <span className="text-[9px] font-light tracking-[0.28em] text-white/40">{label}</span>
      <button
        onClick={() => {
          const name = window.prompt("Spara som:");
          if (name && name.trim()) savePresetAs(scope, name.trim());
        }}
        className={btnClass}
      >
        SPARA
      </button>
      <button onClick={() => exportSettingsFile(scope)} className={btnClass}>
        EXPORTERA
      </button>
      <button
        onClick={() => pickJsonFile((file) => importSettingsFile(scope, file))}
        className={btnClass}
      >
        IMPORTERA
      </button>
      {scoped.length > 0 && (
        <>
          <select
            value={activeId}
            onChange={(e) => setSelected(e.target.value)}
            className="rounded-full border border-white/15 bg-black/40 px-2 py-0.5 text-[9px] text-white/70"
          >
            <option value="" disabled>
              VÄLJ SPARAD…
            </option>
            {scoped.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            disabled={!activeId}
            onClick={() => activeId && loadSavedPreset(activeId)}
            className={btnClass}
          >
            LÄS IN
          </button>
          <button
            disabled={!activeId}
            onClick={() => {
              if (activeId && window.confirm("Ta bort sparad preset?")) {
                deleteSavedPreset(activeId);
                setSelected("");
              }
            }}
            className={btnClass}
          >
            RADERA
          </button>
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
  const [selected, setSelected] = useState("");
  const activeId = savedStates.some((s) => s.id === selected) ? selected : "";
  const btnClass =
    "rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[9px] font-light tracking-wider text-white/70 transition active:scale-95 active:bg-white/15 disabled:opacity-30";

  return (
    <div className="mb-2 flex w-full flex-wrap items-center justify-center gap-1.5">
      <span className="text-[9px] font-light tracking-[0.28em] text-white/40">{label}</span>
      <button
        onClick={() => {
          const name = window.prompt("Spara tillstånd som:");
          if (name && name.trim()) saveStateAs(name.trim());
        }}
        className={btnClass}
      >
        SPARA
      </button>
      <button onClick={() => exportStateFile()} className={btnClass}>
        EXPORTERA
      </button>
      <button onClick={() => pickJsonFile((file) => importStateFile(file))} className={btnClass}>
        IMPORTERA
      </button>
      {savedStates.length > 0 && (
        <>
          <select
            value={activeId}
            onChange={(e) => setSelected(e.target.value)}
            className="rounded-full border border-white/15 bg-black/40 px-2 py-0.5 text-[9px] text-white/70"
          >
            <option value="" disabled>
              VÄLJ SPARAT…
            </option>
            {savedStates.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            disabled={!activeId}
            onClick={() => activeId && loadSavedStateById(activeId)}
            className={btnClass}
          >
            LÄS IN
          </button>
          <button
            disabled={!activeId}
            onClick={() => {
              if (activeId && window.confirm("Ta bort sparat tillstånd?")) {
                deleteSavedState(activeId);
                setSelected("");
              }
            }}
            className={btnClass}
          >
            RADERA
          </button>
        </>
      )}
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
    waveHighQuality,
    setWaveHighQuality,
    waveDir,
    setWaveDir,
    vortexMode,
    setVortexMode,
    vortexOpening,
    setVortexOpening,
    vortexRadius,
    setVortexRadius,
    vortexSpeed,
    setVortexSpeed,
    cameraMode,
    setCameraMode,
    cycleCameraMode,
    noclipSpeed,
    setNoclipSpeed,
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
    wakeLock,
    setWakeLock,
    waterTintIdx,
    setWaterTintIdx,
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
  } = props;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-white/90">
        <span className="text-[10px] font-light tracking-[0.4em] text-white/60">INSTÄLLNINGAR</span>
        <div className="flex gap-2">
          <button
            onClick={restoreCameraPosition}
            className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[9px] font-light tracking-wider text-white/80 transition active:scale-95 active:bg-white/15"
            aria-label="Återgå till senast sparade kameraposition"
            title="Återgå till senast sparade kameraposition och riktning"
          >
            ÅTERGÅ
          </button>
          <button
            onClick={resetToDefaults}
            className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[9px] font-light tracking-wider text-white/80 transition active:scale-95 active:bg-white/15"
            aria-label="Återställ reglage till standardvärden"
            title="Återställ reglage (tid på dygnet påverkas inte)"
          >
            ÅTERSTÄLL
          </button>
        </div>
      </div>
      <div
        className="mb-3 flex flex-wrap justify-center gap-1.5"
        role="tablist"
        aria-label="Inställningsflikar"
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
            {tab.label}
          </button>
        ))}
      </div>
      <PresetControls
        scope="all"
        label="ALLA INSTÄLLNINGAR"
        savedPresets={savedPresets}
        exportSettingsFile={exportSettingsFile}
        importSettingsFile={importSettingsFile}
        savePresetAs={savePresetAs}
        loadSavedPreset={loadSavedPreset}
        deleteSavedPreset={deleteSavedPreset}
      />
      <StateControls
        label="TILLSTÅND (allt + position, blick, ström, svaj)"
        savedStates={savedStates}
        exportStateFile={exportStateFile}
        importStateFile={importStateFile}
        saveStateAs={saveStateAs}
        loadSavedStateById={loadSavedStateById}
        deleteSavedState={deleteSavedState}
      />
      <div className="flex flex-wrap justify-center gap-2">
        {settingsTab === "vagor" && (
          <>
            <PresetControls
              scope="vagor"
              label="VÅGOR-PRESET"
              savedPresets={savedPresets}
              exportSettingsFile={exportSettingsFile}
              importSettingsFile={importSettingsFile}
              savePresetAs={savePresetAs}
              loadSavedPreset={loadSavedPreset}
              deleteSavedPreset={deleteSavedPreset}
            />
            <PadDial
              label="VÅG"
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
              label="TEMPO"
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
              label="FREKVENS"
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
              label="HÖJD"
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
              label="DYK"
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
              label="FLYT"
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
              label="STRÖM RIKTNING"
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
              label="SVAJ"
              mode="number"
              value={`${swayAmp.toFixed(1)}m`}
              rawValue={swayAmp}
              onSet={setSwayAmp}
              min={0}
              max={30}
              step={0.5}
              onDec={() => setSwayAmp((v) => Math.max(0, +(v - 0.5).toFixed(2)))}
              onInc={() => setSwayAmp((v) => Math.min(30, +(v + 0.5).toFixed(2)))}
            />
            <PadDial
              label="SVAJ TEMPO"
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
              label="SVAJ DRIFT"
              mode="number"
              value={
                swayBias === 0
                  ? "NEUTRAL"
                  : swayBias > 0
                    ? `MED ${swayBias.toFixed(2)}`
                    : `MOT ${Math.abs(swayBias).toFixed(2)}`
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
              label="SVAJ RIKTNING"
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
              label="GUPP"
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
              label="GUPP TEMPO"
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
              label="VÅGFORM"
              value={regularWaves ? "REGELBUNDEN" : "SPRIDD"}
              onDec={() => setRegularWaves(false)}
              onInc={() => setRegularWaves(true)}
            />
            <PadDial
              label="REALISTISKA VÅGOR"
              value={realisticWaves ? "FFT-HAV" : "AV"}
              onDec={() => setRealisticWaves(false)}
              onInc={() => setRealisticWaves(true)}
            />
            <PadDial
              label="VÅGPRESET"
              value={WAVE_PRESET_LABELS[wavePreset]}
              onDec={() => applyWavePreset("legacy")}
              onInc={() => applyWavePreset("standard")}
            />
            <PadDial
              label="DÖENDE VÅG"
              value={dyingWave ? "PÅ" : "AV"}
              onDec={() => setDyingWave(false)}
              onInc={() => setDyingWave(true)}
            />
            <PadDial
              label="DÖD VÅG HÖJD"
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
              label="DÖD VÅG TEMPO"
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
              label="SLUMPA VÅGOR"
              value={randomizeWaves ? "PÅ" : "AV"}
              onDec={() => setRandomizeWaves(false)}
              onInc={() => setRandomizeWaves(true)}
            />
            <PadDial
              label="KORSVÅG"
              value={regularCross ? "PÅ" : "AV"}
              onDec={() => setRegularCross(false)}
              onInc={() => setRegularCross(true)}
            />
            <PadDial
              label="VÅGPERIOD"
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
              label="SPETS"
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
              label="TROKOID"
              mode="number"
              value={trochoid <= 0.001 ? "AV" : `${Math.round(trochoid * 100)}%`}
              rawValue={trochoid}
              onSet={(v) => setTrochoid(Math.max(0, Math.min(1, v)))}
              min={0}
              max={1}
              step={0.05}
              onDec={() => setTrochoid((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
              onInc={() => setTrochoid((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
            />
            <PadDial
              label="KVALITET"
              value={waveHighQuality ? "HÖG" : "LÅG"}
              onDec={() => setWaveHighQuality(false)}
              onInc={() => setWaveHighQuality(true)}
            />
            <PadDial
              label="VÅGRIKTNING"
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
            <PadDial
              label="LÄGE"
              value={vortexMode ? "VIRVEL" : "HAV"}
              onDec={() => setVortexMode(false)}
              onInc={() => setVortexMode(true)}
            />
            <PadDial
              label="ÖPPNING"
              mode="number"
              value={`${vortexOpening.toFixed(1)}m`}
              rawValue={vortexOpening}
              onSet={(v) => setVortexOpening(Math.max(3, Math.min(60, v)))}
              min={3}
              max={60}
              step={0.5}
              onDec={() => setVortexOpening((v) => Math.max(3, +(v - 0.5).toFixed(2)))}
              onInc={() => setVortexOpening((v) => Math.min(60, +(v + 0.5).toFixed(2)))}
            />
            <PadDial
              label="AVSTÅND"
              mode="number"
              value={`${vortexRadius.toFixed(1)}m`}
              rawValue={vortexRadius}
              onSet={(v) => setVortexRadius(Math.max(3, Math.min(220, v)))}
              min={3}
              max={220}
              step={1}
              onDec={() => setVortexRadius((v) => Math.max(3, +(v - 1).toFixed(2)))}
              onInc={() => setVortexRadius((v) => Math.min(220, +(v + 1).toFixed(2)))}
            />
            <PadDial
              label="VIRVEL TEMPO"
              mode="number"
              value={`${vortexSpeed.toFixed(2)}x`}
              rawValue={vortexSpeed}
              onSet={(v) => setVortexSpeed(Math.max(-3, Math.min(10, v)))}
              min={-3}
              max={10}
              step={0.1}
              onDec={() => setVortexSpeed((v) => Math.max(-3, +(v - 0.1).toFixed(2)))}
              onInc={() => setVortexSpeed((v) => Math.min(10, +(v + 0.1).toFixed(2)))}
            />
          </>
        )}
        {settingsTab === "kamera" && (
          <>
            <PresetControls
              scope="kamera"
              label="KAMERA-PRESET"
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
                  KAMERALÄGE
                </span>
                <span className="text-xs font-medium tracking-wider text-white/80">
                  {CAMERA_MODE_LABELS[cameraMode]} (AUTO)
                </span>
              </div>
            ) : (
              <PadDial
                label="KAMERALÄGE"
                value={CAMERA_MODE_LABELS[cameraMode]}
                options={CAMERA_MODES.map((m) => CAMERA_MODE_LABELS[m])}
                selectedIndex={CAMERA_MODES.indexOf(cameraMode)}
                onSelectIndex={(i) => setCameraMode(CAMERA_MODES[i])}
                onDec={() => cycleCameraMode(-1)}
                onInc={() => cycleCameraMode(1)}
              />
            )}
            {cameraMode === "noclip" && (
              <PadDial
                label="NOCLIP FART"
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
            {cameraMode === "swing" && (
              <>
                <PadDial
                  label="GUNGA START"
                  value={SWING_PRESET_LABELS[swingPreset]}
                  options={SWING_PRESETS.map((p) => SWING_PRESET_LABELS[p])}
                  selectedIndex={SWING_PRESETS.indexOf(swingPreset)}
                  onSelectIndex={(i) => applySwingPreset(SWING_PRESETS[i])}
                  onDec={() => cycleSwingPreset(-1)}
                  onInc={() => cycleSwingPreset(1)}
                />
                <PadDial
                  label="GUNGA POSITION Y"
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
                  label="GUNGA INTENSITET"
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
                  label="GUNGA X"
                  mode="number"
                  value={swingXFactor <= 0.001 ? "AV" : `${swingXFactor.toFixed(2)}x`}
                  rawValue={swingXFactor}
                  onSet={(v) => setSwingXFactor(Math.max(0, Math.min(2, v)))}
                  min={0}
                  max={2}
                  step={0.1}
                  onDec={() => setSwingXFactor((v) => Math.max(0, +(v - 0.1).toFixed(2)))}
                  onInc={() => setSwingXFactor((v) => Math.min(2, +(v + 0.1).toFixed(2)))}
                />
                <PadDial
                  label="GUNGA HÖJD"
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
                  label="GUNGA Y VÅGFORM"
                  value={SWING_Y_WAVEFORM_LABELS[swingYWaveform]}
                  options={SWING_Y_WAVEFORMS.map((w) => SWING_Y_WAVEFORM_LABELS[w])}
                  selectedIndex={SWING_Y_WAVEFORMS.indexOf(swingYWaveform)}
                  onSelectIndex={(i) => setSwingYWaveform(SWING_Y_WAVEFORMS[i])}
                  onDec={() => cycleSwingYWaveform(-1)}
                  onInc={() => cycleSwingYWaveform(1)}
                />
              </>
            )}
            <PadDial
              label="INTERVALLPASS"
              value={intervalSessionOn ? "PÅ" : "AV"}
              onDec={() => setIntervalSessionOn(false)}
              onInc={() => setIntervalSessionOn(true)}
            />
            <PadDial
              label="INTERVALL"
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
              label="PASSTYP"
              value={INTERVAL_SESSION_TYPE_LABELS[intervalSessionType]}
              options={INTERVAL_SESSION_TYPES.map((t) => INTERVAL_SESSION_TYPE_LABELS[t])}
              selectedIndex={INTERVAL_SESSION_TYPES.indexOf(intervalSessionType)}
              onSelectIndex={(i) => setIntervalSessionType(INTERVAL_SESSION_TYPES[i])}
              onDec={() => setIntervalSessionType((t) => (t === "infinite" ? "fixed" : "infinite"))}
              onInc={() => setIntervalSessionType((t) => (t === "infinite" ? "fixed" : "infinite"))}
            />
            {intervalSessionType === "fixed" && (
              <PadDial
                label="ANTAL INTERVALL"
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
              label="VISA TID"
              value={intervalShowStats ? "PÅ" : "AV"}
              onDec={() => setIntervalShowStats(false)}
              onInc={() => setIntervalShowStats(true)}
            />
            <PadDial
              label="POS X"
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
              label="POS Y"
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
              label="POS Z"
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
              label="FOV"
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
              label="NÄRA"
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
              label="FJÄRRSIKT"
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
              label="ROTERING"
              value={leanEnabled ? "FRAMÅTLUT" : "FIXERAD"}
              onDec={() => setLeanEnabled(false)}
              onInc={() => setLeanEnabled(true)}
            />
            <PadDial
              label="VAKEN"
              value={wakeLock ? "PÅ" : "AV"}
              onDec={() => setWakeLock(false)}
              onInc={() => setWakeLock(true)}
            />
          </>
        )}
        {settingsTab === "vatten" && (
          <>
            <PresetControls
              scope="vatten"
              label="VATTEN-PRESET"
              savedPresets={savedPresets}
              exportSettingsFile={exportSettingsFile}
              importSettingsFile={importSettingsFile}
              savePresetAs={savePresetAs}
              loadSavedPreset={loadSavedPreset}
              deleteSavedPreset={deleteSavedPreset}
            />
            <PadDial
              label="VATTEN"
              value={WATER_TINTS[waterTintIdx].name}
              options={WATER_TINTS.map((w) => w.name)}
              selectedIndex={waterTintIdx}
              onSelectIndex={setWaterTintIdx}
              onDec={() =>
                setWaterTintIdx((i) => (i - 1 + WATER_TINTS.length) % WATER_TINTS.length)
              }
              onInc={() => setWaterTintIdx((i) => (i + 1) % WATER_TINTS.length)}
            />
            {surfaces.length > 0 && (
              <PadDial
                label="SPEGLING"
                value={
                  surfaceId ? (surfaces.find((s) => s.id === surfaceId)?.name ?? surfaceId) : "AV"
                }
                options={["AV", ...surfaces.map((s) => s.name)]}
                selectedIndex={surfaceId ? 1 + surfaces.findIndex((s) => s.id === surfaceId) : 0}
                onSelectIndex={(i) => setSurfaceId(i === 0 ? null : (surfaces[i - 1]?.id ?? null))}
                onDec={() => cycleSurface(-1)}
                onInc={() => cycleSurface(1)}
              />
            )}
            {surfaceId && (
              <PadDial
                label="STYRKA"
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
              label="VÅGMATERIAL"
              value={sphereMaterial ? "SFÄRKARTA" : "STANDARD"}
              onDec={() => setSphereMaterial(false)}
              onInc={() => setSphereMaterial(true)}
            />
            {sphereMaterial && (
              <PadDial
                label="SFÄR-STYRKA"
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
              label="OPACITET"
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
            <PadDial
              label="TON"
              mode="number"
              value={`${Math.round(waterHue)}°`}
              rawValue={waterHue}
              onSet={setWaterHue}
              min={-180}
              max={180}
              step={5}
              onDec={() => setWaterHue((v) => Math.max(-180, +(v - 5).toFixed(0)))}
              onInc={() => setWaterHue((v) => Math.min(180, +(v + 5).toFixed(0)))}
            />
            <PadDial
              label="MÄTTNAD"
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
              label="LJUSSTYRKA"
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
              label="YT-LJUS"
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
              label="YT-MÄTTNAD"
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
              label="GRUMLIGHET"
              mode="number"
              value={turbidity <= 0.001 ? "AV" : `${Math.round(turbidity * 100)}%`}
              rawValue={turbidity}
              onSet={(v) => setTurbidity(Math.max(0, Math.min(1, v)))}
              min={0}
              max={1}
              step={0.05}
              onDec={() => setTurbidity((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
              onInc={() => setTurbidity((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
            />
            <PadDial
              label="BOTTEN"
              value={BOTTOM_OPTIONS[bottomIdx].name}
              options={BOTTOM_OPTIONS.map((b) => b.name)}
              selectedIndex={bottomIdx}
              onSelectIndex={setBottomIdx}
              onDec={() =>
                setBottomIdx((i) => (i - 1 + BOTTOM_OPTIONS.length) % BOTTOM_OPTIONS.length)
              }
              onInc={() => setBottomIdx((i) => (i + 1) % BOTTOM_OPTIONS.length)}
            />
            {BOTTOM_OPTIONS[bottomIdx].name === "Anpassad" && (
              <label className="flex items-center gap-2 rounded-full border border-white/15 bg-black/40 py-1 pl-3 pr-1 backdrop-blur-md">
                <span className="text-[9px] font-light tracking-[0.28em] text-white/60">
                  BOTTENFÄRG
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
              label="DJUP"
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
              label="TEXTUR"
              value={floorTexture ? "PÅ" : "AV"}
              onDec={() => setFloorTexture(false)}
              onInc={() => setFloorTexture(true)}
            />
            <PadDial
              label="DJUP-SINUS"
              value={depthSineOn ? "PÅ" : "AV"}
              onDec={() => setDepthSineOn(false)}
              onInc={() => setDepthSineOn(true)}
            />
            <PadDial
              label="SINUS AMP"
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
              label="SINUS FREK"
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
              label="VATTENYTA"
              value={hideWater ? "DÖLJ" : "SYNLIGT"}
              onDec={() => setHideWater(true)}
              onInc={() => setHideWater(false)}
            />
            <PadDial
              label="ÄKTA KAUSTIK"
              value={causticsOn ? "PÅ" : "AV"}
              onDec={() => setCausticsOn(false)}
              onInc={() => setCausticsOn(true)}
            />
          </>
        )}
        {settingsTab === "miljo" && (
          <>
            <PresetControls
              scope="miljo"
              label="MILJÖ-PRESET"
              savedPresets={savedPresets}
              exportSettingsFile={exportSettingsFile}
              importSettingsFile={importSettingsFile}
              savePresetAs={savePresetAs}
              loadSavedPreset={loadSavedPreset}
              deleteSavedPreset={deleteSavedPreset}
            />
            <PadDial
              label="TID"
              value={todLabel}
              onDec={() => setTimeOfDay((v) => (v - 0.02 + 1) % 1)}
              onInc={() => setTimeOfDay((v) => (v + 0.02) % 1)}
            />
            <PadDial
              label="MELLAN-MOLN"
              value={midCloudsOn ? "PÅ" : "AV"}
              onDec={() => setMidCloudsOn(false)}
              onInc={() => setMidCloudsOn(true)}
            />
            <PadDial
              label="MOLNHÖJD"
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
              label="HIMMEL-MOLN"
              value={skyCloudsOn ? "PÅ" : "AV"}
              onDec={() => setSkyCloudsOn(false)}
              onInc={() => setSkyCloudsOn(true)}
            />
            <PadDial
              label="HIMMEL-MOLNHÖJD"
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
              label="RUMSSTORLEK"
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
                label="SCEN"
                value={sceneId ? (scenes.find((s) => s.id === sceneId)?.name ?? sceneId) : "AV"}
                options={["AV", ...scenes.map((s) => s.name)]}
                selectedIndex={sceneId ? 1 + scenes.findIndex((s) => s.id === sceneId) : 0}
                onSelectIndex={(i) => setSceneId(i === 0 ? null : (scenes[i - 1]?.id ?? null))}
                onDec={() => cycleScene(-1)}
                onInc={() => cycleScene(1)}
              />
            )}
            {environments.length > 0 && (
              <>
                <PadDial
                  label="MILJÖ"
                  value={curEnv ? curEnv.name : "AV"}
                  options={["AV", ...environments.map((e) => e.name)]}
                  selectedIndex={curEnv ? 1 + environments.findIndex((e) => e.id === curEnv.id) : 0}
                  onSelectIndex={(i) =>
                    applyEnv(i === 0 ? null : (environments[i - 1]?.id ?? null))
                  }
                  onDec={() => cycleEnv(-1)}
                  onInc={() => cycleEnv(1)}
                />
                {curEnv && curEnv.eras.length > 1 && (
                  <PadDial
                    label="EPOK"
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
                    label="DYGN"
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
              label="BAKGRUND"
              value={BACKDROPS[backdropIdx].name}
              options={BACKDROPS.map((b) => b.name)}
              selectedIndex={backdropIdx}
              onSelectIndex={setBackdropIdx}
              onDec={() => setBackdropIdx((i) => (i - 1 + BACKDROPS.length) % BACKDROPS.length)}
              onInc={() => setBackdropIdx((i) => (i + 1) % BACKDROPS.length)}
            />
            <PadDial
              label="LIVE"
              value={liveMode ? "PÅ" : "AV"}
              onDec={() => setLiveMode(false)}
              onInc={() => setLiveMode(true)}
            />
            <PadDial
              label="BADRINGAR"
              value={torusRingsOn ? "PÅ" : "AV"}
              onDec={() => setTorusRingsOn(false)}
              onInc={() => setTorusRingsOn(true)}
            />
            {torusRingsOn && (
              <>
                <PadDial
                  label="RADIE"
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
                  label="TJOCKLEK"
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
                  label="STORLEK"
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
                  label="OPACITET"
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
                  label="TEXTUR"
                  value={TORUS_RING_TEXTURES[torusTextureIdx].name}
                  onDec={() =>
                    setTorusTextureIdx(
                      (i) => (i - 1 + TORUS_RING_TEXTURES.length) % TORUS_RING_TEXTURES.length,
                    )
                  }
                  onInc={() => setTorusTextureIdx((i) => (i + 1) % TORUS_RING_TEXTURES.length)}
                />
                <PadDial
                  label="RUTNÄT XZ"
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
                  label="RUTNÄT HÖJD"
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
                  label="RINGAR/KOLONN"
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
                  label="RÄCKVIDD"
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
                  label="TONING"
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
              label="LJUD-PRESET"
              savedPresets={savedPresets}
              exportSettingsFile={exportSettingsFile}
              importSettingsFile={importSettingsFile}
              savePresetAs={savePresetAs}
              loadSavedPreset={loadSavedPreset}
              deleteSavedPreset={deleteSavedPreset}
            />
            <PadDial
              label={audioOn ? "LJUD PÅ" : "LJUD AV"}
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
              label="LJUDSYNK"
              value={audioSyncSpeed ? "PÅ" : "AV"}
              onDec={() => setAudioSyncSpeed(false)}
              onInc={() => setAudioSyncSpeed(true)}
            />
            <PadDial
              label="SPATIAL"
              value={audioSpatial ? "PÅ" : "AV"}
              onDec={() => setAudioSpatial(false)}
              onInc={() => setAudioSpatial(true)}
            />
          </>
        )}
      </div>
    </>
  );
}
