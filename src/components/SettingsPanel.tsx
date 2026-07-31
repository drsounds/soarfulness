import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { PadDial } from "@/components/PadDial";
import {
  SETTINGS_TABS,
  WATER_TINTS,
  BOTTOM_OPTIONS,
  BACKDROPS,
  TORUS_RING_TEXTURES,
  worldXZBearing,
  type SettingsTab,
  type CameraMode,
  type SwingPreset,
} from "@/lib/settingsShared";

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

  // Vågor
  waveAmp: number;
  setWaveAmp: Dispatch<SetStateAction<number>>;
  waveSpeed: number;
  setWaveSpeed: Dispatch<SetStateAction<number>>;
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
  cycleCameraMode: (dir: number) => void;
  noclipSpeed: number;
  setNoclipSpeed: Dispatch<SetStateAction<number>>;
  swingHeight: number;
  setSwingHeight: Dispatch<SetStateAction<number>>;
  swingIntensity: number;
  setSwingIntensity: Dispatch<SetStateAction<number>>;
  swingXFactor: number;
  setSwingXFactor: Dispatch<SetStateAction<number>>;
  swingYAmplitude: number;
  setSwingYAmplitude: Dispatch<SetStateAction<number>>;
  swingPreset: SwingPreset;
  cycleSwingPreset: (dir: number) => void;
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
  cycleScene: (dir: number) => void;
  environments: EnvOption[];
  curEnv: EnvOption | null;
  cycleEnv: (dir: number) => void;
  curEra: EnvEraOption | null;
  cycleEra: (dir: number) => void;
  curTime: EnvTimeOption | null;
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

export function SettingsPanel(props: SettingsPanelProps) {
  const {
    settingsTab,
    setSettingsTab,
    restoreCameraPosition,
    resetToDefaults,
    waveAmp,
    setWaveAmp,
    waveSpeed,
    setWaveSpeed,
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
    cycleCameraMode,
    noclipSpeed,
    setNoclipSpeed,
    swingHeight,
    setSwingHeight,
    swingIntensity,
    setSwingIntensity,
    swingXFactor,
    setSwingXFactor,
    swingYAmplitude,
    setSwingYAmplitude,
    swingPreset,
    cycleSwingPreset,
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
    cycleScene,
    environments,
    curEnv,
    cycleEnv,
    curEra,
    cycleEra,
    curTime,
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
      <div className="flex flex-wrap justify-center gap-2">
        {settingsTab === "vagor" && (
          <>
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
            <PadDial
              label="KAMERALÄGE"
              value={cameraMode === "float" ? "FRI" : cameraMode === "noclip" ? "NOCLIP" : "GUNGA"}
              onDec={() => cycleCameraMode(-1)}
              onInc={() => cycleCameraMode(1)}
            />
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
                  value={
                    swingPreset === "water"
                      ? "VATTEN"
                      : swingPreset === "clouds"
                        ? "MOLN"
                        : "ANPASSAD"
                  }
                  onDec={() => cycleSwingPreset(-1)}
                  onInc={() => cycleSwingPreset(1)}
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
                  label="GUNGA INTENSITET"
                  mode="number"
                  value={`${swingIntensity.toFixed(2)}x`}
                  rawValue={swingIntensity}
                  onSet={(v) => setSwingIntensity(Math.max(0.01, Math.min(2.5, v)))}
                  min={0.01}
                  max={2.5}
                  step={0.05}
                  onDec={() => setSwingIntensity((v) => Math.max(0.01, +(v - 0.05).toFixed(2)))}
                  onInc={() => setSwingIntensity((v) => Math.min(2.5, +(v + 0.05).toFixed(2)))}
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
                  label="GUNGA AMPLITUD"
                  mode="number"
                  value={`${swingYAmplitude.toFixed(0)}m`}
                  rawValue={swingYAmplitude}
                  onSet={(v) => setSwingYAmplitude(Math.max(0, Math.min(100000, v)))}
                  min={0}
                  max={100000}
                  step={100}
                  onDec={() => setSwingYAmplitude((v) => Math.max(0, +(v - 100).toFixed(0)))}
                  onInc={() => setSwingYAmplitude((v) => Math.min(100000, +(v + 100).toFixed(0)))}
                />
              </>
            )}
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
              onSet={(v) => setCamFar(Math.max(100, Math.min(100000, v)))}
              min={100}
              max={100000}
              step={100}
              onDec={() => setCamFar((v) => Math.max(100, +(v - 100).toFixed(0)))}
              onInc={() => setCamFar((v) => Math.min(100000, +(v + 100).toFixed(0)))}
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
            <PadDial
              label="VATTEN"
              value={WATER_TINTS[waterTintIdx].name}
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
              min={0.1}
              max={1}
              step={0.05}
              onDec={() => setWaterOpacity((v) => Math.max(0.1, +(v - 0.05).toFixed(2)))}
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
              label="YTA"
              value={hideWater ? "DÖLJ" : "SYNLIGT"}
              onDec={() => setHideWater(true)}
              onInc={() => setHideWater(false)}
            />
          </>
        )}
        {settingsTab === "miljo" && (
          <>
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
              label="YTA"
              mode="number"
              value={`${surfaceArea.toFixed(0)}m`}
              rawValue={surfaceArea}
              onSet={(v) => setSurfaceArea(Math.max(200, Math.min(100000, v)))}
              min={200}
              max={100000}
              step={100}
              onDec={() => setSurfaceArea((v) => Math.max(200, +(v - 100).toFixed(0)))}
              onInc={() => setSurfaceArea((v) => Math.min(100000, +(v + 100).toFixed(0)))}
            />
            {scenes.length > 0 && (
              <PadDial
                label="SCEN"
                value={sceneId ? (scenes.find((s) => s.id === sceneId)?.name ?? sceneId) : "AV"}
                onDec={() => cycleScene(-1)}
                onInc={() => cycleScene(1)}
              />
            )}
            {environments.length > 0 && (
              <>
                <PadDial
                  label="MILJÖ"
                  value={curEnv ? curEnv.name : "AV"}
                  onDec={() => cycleEnv(-1)}
                  onInc={() => cycleEnv(1)}
                />
                {curEnv && curEnv.eras.length > 1 && (
                  <PadDial
                    label="EPOK"
                    value={curEra?.name ?? "—"}
                    onDec={() => cycleEra(-1)}
                    onInc={() => cycleEra(1)}
                  />
                )}
                {curEra && curEra.times.length > 1 && (
                  <PadDial
                    label="DYGN"
                    value={curTime?.name ?? "—"}
                    onDec={() => cycleTime(-1)}
                    onInc={() => cycleTime(1)}
                  />
                )}
              </>
            )}
            <PadDial
              label="BAKGRUND"
              value={BACKDROPS[backdropIdx].name}
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
                  onDec={() => setTorusViewDistance((v) => Math.max(torusCellSize, +(v - 2).toFixed(0)))}
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
