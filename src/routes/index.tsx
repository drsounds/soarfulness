import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import waterAsset from "@/assets/water.mp3.asset.json";
import vanernBackdrop from "@/assets/vanern-backdrop.png.asset.json";
import sandTextureAsset from "@/assets/sand_cc0_512.jpg.asset.json";
import appIconAsset from "@/assets/AppIconBlack.png.asset.json";

export const Route = createFileRoute("/")({
  component: Aquafulness,
  head: () => ({
    meta: [
      { title: "Ocean Wave Meditation" },
      {
        name: "description",
        content:
          "A calming WebGL ocean where the camera drifts on the waves. Adjust swell, time of day, and wander across the sea.",
      },
      { property: "og:title", content: "Ocean Wave Meditation" },
      {
        property: "og:description",
        content: "A calming WebGL ocean where the camera drifts on the waves. Adjust swell, time of day, and wander across the sea.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

// Rounded Gaussian crest boost: p=1 → pure sine, p>1 → a fuller, pointier
// crest on the wave top only. Unlike the previous phase warp this does not
// bunch the horizontal phase into near-vertical faces, which caused jagged
// side-view artifacts at grazing camera angles.
function shapedWave(theta: number, p: number) {
  if (p <= 1) return Math.sin(theta);
  const k = Math.min(1, Math.max(0, (p - 1) / 5));
  const amount = (p - 1) * 0.28;
  const wrapped = Math.atan2(Math.sin(theta - Math.PI / 2), Math.cos(theta - Math.PI / 2));
  const width = 0.72 * (1 - k) + 0.34 * k;
  const crest = Math.exp(-(wrapped * wrapped) / (2 * width * width));
  const mean = width * 0.3989;
  const base = Math.sin(theta);
  const peakBoost = Math.pow(Math.max(base, 0), 1 + 3 * k) - 0.3183 * k;
  return (base + amount * (crest - mean) + k * 0.55 * peakBoost) / (1 + amount * 0.28 + k * 0.35);
}


// Gerstner-like sum of sines. Keep in sync with vertex shader.
function waveHeight(x: number, z: number, t: number, amp: number, regular: boolean, cross: boolean, period: number = 1, peak: number = 1, dir: number = 0) {
  const c = Math.cos(dir), s = Math.sin(dir);
  const xr = c * x + s * z;
  const zr = -s * x + c * z;
  if (regular) {
    const kx = 0.12 / period;
    const kz = 0.09 / period;
    const rx = shapedWave(xr * kx + t * 0.9, peak) * 2.6 * amp;
    const rz = cross ? shapedWave(zr * kz + t * 0.7 + 1.1, peak) * 1.4 * amp : 0;
    return rx + rz;
  }
  const w1 = shapedWave(xr * 0.12 + t * 0.9, peak) * 1.0;
  const w2 = shapedWave(zr * 0.17 + t * 0.7 + 1.3, peak) * 0.75;
  const w3 = shapedWave((xr * 0.22 + zr * 0.19) + t * 1.4 + 2.1, peak) * 0.5;
  const w4 = shapedWave((xr * 0.31 - zr * 0.11) + t * 1.8 + 0.4, peak) * 0.35;
  return (w1 + w2 + w3 + w4) * amp;
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const v = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return v * v * (3 - 2 * v);
}

// Pure radial sine surface used in vortex mode. Keep in sync with the shader's
// vortex block so the camera rides the same even wave that is rendered.
function vortexSurfaceHeight(x: number, z: number, t: number, amp: number, period: number, opening: number) {
  const op = Math.max(1, opening);
  const r = Math.hypot(x, z);
  const g = Math.exp(-(r * r) / (op * op));
  const pit = -op * 1.6 * g;
  const stableFade = 1 - smoothstep(220, 520, r);
  const kR = 0.12 / period;
  const phase = r * kR - t * 0.9;
  const ring = Math.sin(phase) * 2.6 * amp * stableFade * (1 - g * 0.85);
  return pit + ring;
}

const STORAGE_KEY = "aquafulness:settings:v1";
type Persisted = {
  waveAmp: number;
  timeOfDay: number;
  waveSpeed: number;
  bobSpeed: number;
  buoyAmp: number;
  heightOffset: number;
  submergeAmp: number;
  floatLift: number;
  camOffX: number;
  camOffY: number;
  camOffZ: number;
  audioOn: boolean;
  audioVol: number;
  audioSyncSpeed: boolean;
  audioSpatial: boolean;
  waterTintIdx: number;
  waterOpacity: number;
  waterHue: number;
  waterSat: number;
  waterBright: number;
  surfBright: number;
  surfSat: number;
  bottomIdx: number;
  leanEnabled: boolean;
  regularWaves: boolean;
  regularCross: boolean;
  regularPeriod: number;
  wavePeak: number;
  backdropIdx: number;
  wakeLock: boolean;
  camFov: number;
  camNear: number;
  waveDir: number;
  floorDepth: number;
  floorTexture: boolean;
  vortexMode: boolean;
  vortexOpening: number;
  vortexRadius: number;
  vortexSpeed: number;
  depthSineOn: boolean;
  depthSineAmp: number;
  depthSineFreq: number;
  hideWater: boolean;
  midCloudsOn: boolean;
  midCloudsHeight: number;
  swayAmp: number;
  swaySpeed: number;
  swayBias: number;
};
const WATER_TINTS: { name: string; rgb: [number, number, number] }[] = [
  { name: "Nordhav", rgb: [1, 1, 1] },
  { name: "Tropisk", rgb: [0.55, 1.15, 1.25] },
  { name: "Karibisk", rgb: [0.6, 1.35, 1.1] },
  { name: "Medelhav", rgb: [0.8, 1.15, 1.3] },
  { name: "Skärgård", rgb: [0.85, 1.0, 0.75] },
  { name: "Djuphav", rgb: [0.55, 0.7, 1.15] },
];
const BOTTOM_OPTIONS: { name: string; rgb: [number, number, number] | null }[] = [
  { name: "AV", rgb: null },
  { name: "Sand", rgb: [0.85, 0.75, 0.5] },
  { name: "Ljus sand", rgb: [0.95, 0.9, 0.72] },
  { name: "Sten", rgb: [0.35, 0.32, 0.28] },
  { name: "Korall", rgb: [0.9, 0.5, 0.45] },
  { name: "Mörk botten", rgb: [0.08, 0.1, 0.12] },
  { name: "Moln", rgb: [1, 1, 1] },
];
const BACKDROPS: { name: string; url: string | null }[] = [
  { name: "AV", url: null },
  { name: "Vänern", url: vanernBackdrop.url },
];
const DEFAULTS: Persisted = {
  waveAmp: 2.0,
  timeOfDay: 0.5,
  waveSpeed: 5,
  bobSpeed: 2.8,
  buoyAmp: 2.8,
  heightOffset: 0,
  submergeAmp: 0,
  floatLift: 0,
  camOffX: 0,
  camOffY: 0,
  camOffZ: 0,
  audioOn: false,
  audioVol: 0.8,
  audioSyncSpeed: false,
  audioSpatial: false,
  waterTintIdx: 1,
  waterOpacity: 1,
  waterHue: 0,
  waterSat: 1,
  waterBright: 1,
  surfBright: 1,
  surfSat: 1,
  bottomIdx: 2,
  leanEnabled: false,
  regularWaves: true,
  regularCross: false,
  regularPeriod: 1,
  wavePeak: 1,
  backdropIdx: 0,
  wakeLock: true,
  camFov: 65,
  camNear: 0.1,
  waveDir: 0,
  floorDepth: 28,
  floorTexture: true,
  vortexMode: false,
  vortexOpening: 14,
  vortexRadius: 26,
  vortexSpeed: 1,
  depthSineOn: false,
  depthSineAmp: 2,
  depthSineFreq: 0.2,
  hideWater: false,
  midCloudsOn: false,
  midCloudsHeight: 0.5,
  swayAmp: 0,
  swaySpeed: 0.15,
  swayBias: 0,
};
function loadSettings(): Persisted {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

function Aquafulness() {
  const mountRef = useRef<HTMLDivElement>(null);
  const initial = useRef<Persisted>(loadSettings()).current;
  const [waveAmp, setWaveAmp] = useState(initial.waveAmp);
  const [timeOfDay, setTimeOfDay] = useState(initial.timeOfDay);
  const [waveSpeed, setWaveSpeed] = useState(initial.waveSpeed);
  const [bobSpeed, setBobSpeed] = useState(initial.bobSpeed);
  const [buoyAmp, setBuoyAmp] = useState(initial.buoyAmp);
  const [heightOffset, setHeightOffset] = useState(initial.heightOffset);
  const [submergeAmp, setSubmergeAmp] = useState(initial.submergeAmp);
  const [floatLift, setFloatLift] = useState(initial.floatLift);
  const [camOffX, setCamOffX] = useState(initial.camOffX);
  const [camOffY, setCamOffY] = useState(initial.camOffY);
  const [camOffZ, setCamOffZ] = useState(initial.camOffZ);
  // Live joystick vector (visual state) — kept in state so the thumb renders.
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const [audioOn, setAudioOn] = useState(initial.audioOn);
  const [audioVol, setAudioVol] = useState(initial.audioVol);
  const [audioSyncSpeed, setAudioSyncSpeed] = useState(initial.audioSyncSpeed);
  const [audioSpatial, setAudioSpatial] = useState(initial.audioSpatial);
  const [waterTintIdx, setWaterTintIdx] = useState(initial.waterTintIdx);
  const [waterOpacity, setWaterOpacity] = useState(initial.waterOpacity);
  const [waterHue, setWaterHue] = useState(initial.waterHue);
  const [waterSat, setWaterSat] = useState(initial.waterSat);
  const [waterBright, setWaterBright] = useState(initial.waterBright);
  const [surfBright, setSurfBright] = useState(initial.surfBright);
  const [surfSat, setSurfSat] = useState(initial.surfSat);
  const [bottomIdx, setBottomIdx] = useState(initial.bottomIdx);
  const [leanEnabled, setLeanEnabled] = useState(initial.leanEnabled);
  const [regularWaves, setRegularWaves] = useState(initial.regularWaves);
  const [regularCross, setRegularCross] = useState(initial.regularCross);
  const [regularPeriod, setRegularPeriod] = useState(initial.regularPeriod);
  const [wavePeak, setWavePeak] = useState(initial.wavePeak);
  const [backdropIdx, setBackdropIdx] = useState(initial.backdropIdx);
  const [wakeLock, setWakeLock] = useState(initial.wakeLock);
  // Rotation stick (yaw / pitch look) and wave-follow stick.
  const [camFov, setCamFov] = useState(initial.camFov);
  const [camNear, setCamNear] = useState(initial.camNear);
  const [waveDir, setWaveDir] = useState(initial.waveDir);
  const [floorDepth, setFloorDepth] = useState(initial.floorDepth);
  const [floorTexture, setFloorTexture] = useState(initial.floorTexture);
  const [vortexMode, setVortexMode] = useState(initial.vortexMode);
  const [vortexOpening, setVortexOpening] = useState(initial.vortexOpening);
  const [vortexRadius, setVortexRadius] = useState(initial.vortexRadius);
  const [vortexSpeed, setVortexSpeed] = useState(initial.vortexSpeed);
  const [depthSineOn, setDepthSineOn] = useState(initial.depthSineOn);
  const [depthSineAmp, setDepthSineAmp] = useState(initial.depthSineAmp);
  const [depthSineFreq, setDepthSineFreq] = useState(initial.depthSineFreq);
  const [hideWater, setHideWater] = useState(initial.hideWater);
  const [midCloudsOn, setMidCloudsOn] = useState(initial.midCloudsOn);
  const [midCloudsHeight, setMidCloudsHeight] = useState(initial.midCloudsHeight);
  const [swayAmp, setSwayAmp] = useState(initial.swayAmp);
  const [swaySpeed, setSwaySpeed] = useState(initial.swaySpeed);
  const [swayBias, setSwayBias] = useState(initial.swayBias);
  const [rotStick, setRotStick] = useState({ x: 0, y: 0 });
  const [driftStick, setDriftStick] = useState({ x: 0, y: 0 });
  const [waveDirStick, setWaveDirStick] = useState({ x: 0, y: 0 });
  const [swayStick, setSwayStick] = useState({ x: 0, y: 0 });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const idleTimerRef = useRef<number | null>(null);

  // Persist settings to localStorage whenever they change (SSR-safe, hydration-safe).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const data: Persisted = { waveAmp, timeOfDay, waveSpeed, bobSpeed, buoyAmp, heightOffset, submergeAmp, floatLift, camOffX, camOffY, camOffZ, audioOn, audioVol, audioSyncSpeed, audioSpatial, waterTintIdx, waterOpacity, waterHue, waterSat, waterBright, surfBright, surfSat, bottomIdx, leanEnabled, regularWaves, regularCross, regularPeriod, wavePeak, backdropIdx, wakeLock, camFov, camNear, waveDir, floorDepth, floorTexture, vortexMode, vortexOpening, vortexRadius, vortexSpeed, depthSineOn, depthSineAmp, depthSineFreq, hideWater, midCloudsOn, midCloudsHeight, swayAmp, swaySpeed, swayBias };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* quota or privacy mode — ignore */
    }
  }, [waveAmp, timeOfDay, waveSpeed, bobSpeed, buoyAmp, heightOffset, submergeAmp, floatLift, camOffX, camOffY, camOffZ, audioOn, audioVol, audioSyncSpeed, audioSpatial, waterTintIdx, waterOpacity, waterHue, waterSat, waterBright, surfBright, surfSat, bottomIdx, leanEnabled, regularWaves, regularCross, regularPeriod, wavePeak, backdropIdx, wakeLock, camFov, camNear, waveDir, floorDepth, floorTexture, vortexMode, vortexOpening, vortexRadius, vortexSpeed, depthSineOn, depthSineAmp, depthSineFreq, hideWater, midCloudsOn, midCloudsHeight, swayAmp, swaySpeed, swayBias]);
  const audioRef = useRef<{
    ctx: AudioContext;
    el: HTMLAudioElement;
    master: GainNode;
    depthGain: GainNode;
    lp: BiquadFilterNode;
  } | null>(null);

  // Live values consumed inside the RAF loop.
  const ampRef = useRef(waveAmp);
  const todRef = useRef(timeOfDay);
  const speedRef = useRef(waveSpeed);
  const bobSpeedRef = useRef(bobSpeed);
  const buoyRef = useRef(buoyAmp);
  const heightRef = useRef(heightOffset);
  const submergeRef = useRef(submergeAmp);
  const floatLiftRef = useRef(floatLift);
  const camOffXRef = useRef(camOffX);
  const camOffYRef = useRef(camOffY);
  const camOffZRef = useRef(camOffZ);
  const stickRef = useRef({ x: 0, y: 0 });
  const posRef = useRef({ x: 0, z: 0 });
  const camYRef = useRef<number | null>(null);
  const camVYRef = useRef(0);
  const waterTintRef = useRef(waterTintIdx);
  const waterOpacityRef = useRef(waterOpacity);
  const waterHueRef = useRef(waterHue);
  const waterSatRef = useRef(waterSat);
  const waterBrightRef = useRef(waterBright);
  const surfBrightRef = useRef(surfBright);
  const surfSatRef = useRef(surfSat);
  const bottomIdxRef = useRef(bottomIdx);
  const leanRef = useRef(leanEnabled);
  const regularRef = useRef(regularWaves);
  const regularCrossRef = useRef(regularCross);
  const regularPeriodRef = useRef(regularPeriod);
  const wavePeakRef = useRef(wavePeak);
  const backdropRef = useRef(backdropIdx);
  const wakeLockRef = useRef(wakeLock);
  const audioSpatialRef = useRef(audioSpatial);
  const rotStickRef = useRef({ x: 0, y: 0 });
  const driftStickRef = useRef({ x: 0, y: 0 });
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const prevSurfaceRef = useRef<number | null>(null);
  const camFovRef = useRef(camFov);
  const camNearRef = useRef(camNear);
  const waveDirRef = useRef(waveDir);
  const floorDepthRef = useRef(floorDepth);
  const floorTextureRef = useRef(floorTexture);
  const vortexModeRef = useRef(vortexMode);
  const vortexOpeningRef = useRef(vortexOpening);
  const vortexRadiusRef = useRef(vortexRadius);
  const vortexSpeedRef = useRef(vortexSpeed);
  const vortexAngleRef = useRef(0);
  const depthSineOnRef = useRef(depthSineOn);
  const depthSineAmpRef = useRef(depthSineAmp);
  const depthSineFreqRef = useRef(depthSineFreq);
  const hideWaterRef = useRef(hideWater);
  const midCloudsOnRef = useRef(midCloudsOn);
  const midCloudsHeightRef = useRef(midCloudsHeight);
  const swayAmpRef = useRef(swayAmp);
  const swaySpeedRef = useRef(swaySpeed);
  const swayBiasRef = useRef(swayBias);
  useEffect(() => { ampRef.current = waveAmp; }, [waveAmp]);
  useEffect(() => { todRef.current = timeOfDay; }, [timeOfDay]);
  useEffect(() => { speedRef.current = waveSpeed; }, [waveSpeed]);
  useEffect(() => { bobSpeedRef.current = bobSpeed; }, [bobSpeed]);
  useEffect(() => { buoyRef.current = buoyAmp; }, [buoyAmp]);
  useEffect(() => { heightRef.current = heightOffset; }, [heightOffset]);
  useEffect(() => { submergeRef.current = submergeAmp; }, [submergeAmp]);
  useEffect(() => { floatLiftRef.current = floatLift; }, [floatLift]);
  useEffect(() => { camOffXRef.current = camOffX; }, [camOffX]);
  useEffect(() => { camOffYRef.current = camOffY; }, [camOffY]);
  useEffect(() => { camOffZRef.current = camOffZ; }, [camOffZ]);
  useEffect(() => { stickRef.current = stick; }, [stick]);
  useEffect(() => { rotStickRef.current = rotStick; }, [rotStick]);
  useEffect(() => { driftStickRef.current = driftStick; }, [driftStick]);
  useEffect(() => { waterTintRef.current = waterTintIdx; }, [waterTintIdx]);
  useEffect(() => { waterOpacityRef.current = waterOpacity; }, [waterOpacity]);
  useEffect(() => { waterHueRef.current = waterHue; }, [waterHue]);
  useEffect(() => { waterSatRef.current = waterSat; }, [waterSat]);
  useEffect(() => { waterBrightRef.current = waterBright; }, [waterBright]);
  useEffect(() => { surfBrightRef.current = surfBright; }, [surfBright]);
  useEffect(() => { surfSatRef.current = surfSat; }, [surfSat]);
  useEffect(() => { bottomIdxRef.current = bottomIdx; }, [bottomIdx]);
  useEffect(() => { leanRef.current = leanEnabled; }, [leanEnabled]);
  useEffect(() => { regularRef.current = regularWaves; }, [regularWaves]);
  useEffect(() => { regularCrossRef.current = regularCross; }, [regularCross]);
  useEffect(() => { regularPeriodRef.current = regularPeriod; }, [regularPeriod]);
  useEffect(() => { wavePeakRef.current = wavePeak; }, [wavePeak]);
  useEffect(() => { backdropRef.current = backdropIdx; }, [backdropIdx]);
  useEffect(() => { wakeLockRef.current = wakeLock; }, [wakeLock]);
  useEffect(() => { audioSpatialRef.current = audioSpatial; }, [audioSpatial]);
  useEffect(() => { camFovRef.current = camFov; }, [camFov]);
  useEffect(() => { camNearRef.current = camNear; }, [camNear]);
  useEffect(() => { waveDirRef.current = waveDir; }, [waveDir]);
  useEffect(() => { floorDepthRef.current = floorDepth; }, [floorDepth]);
  useEffect(() => { floorTextureRef.current = floorTexture; }, [floorTexture]);
  useEffect(() => { vortexModeRef.current = vortexMode; }, [vortexMode]);
  useEffect(() => { vortexOpeningRef.current = vortexOpening; }, [vortexOpening]);
  useEffect(() => { vortexRadiusRef.current = vortexRadius; }, [vortexRadius]);
  useEffect(() => { vortexSpeedRef.current = vortexSpeed; }, [vortexSpeed]);
  useEffect(() => { depthSineOnRef.current = depthSineOn; }, [depthSineOn]);
  useEffect(() => { depthSineAmpRef.current = depthSineAmp; }, [depthSineAmp]);
  useEffect(() => { depthSineFreqRef.current = depthSineFreq; }, [depthSineFreq]);
  useEffect(() => { hideWaterRef.current = hideWater; }, [hideWater]);
  useEffect(() => { midCloudsOnRef.current = midCloudsOn; }, [midCloudsOn]);
  useEffect(() => { midCloudsHeightRef.current = midCloudsHeight; }, [midCloudsHeight]);
  useEffect(() => { swayAmpRef.current = swayAmp; }, [swayAmp]);
  useEffect(() => { swaySpeedRef.current = swaySpeed; }, [swaySpeed]);
  useEffect(() => { swayBiasRef.current = swayBias; }, [swayBias]);
  const swayStickRef = useRef(swayStick);
  useEffect(() => { swayStickRef.current = swayStick; }, [swayStick]);
  // Håll VÅGRIKT-spakens visuella läge synkat med waveDir (t.ex. när dialen ändras
  // eller vid uppstart), men bara när spaken själv står i vila.
  useEffect(() => {
    setWaveDirStick((s) => {
      if (Math.hypot(s.x, s.y) > 0.15) return s;
      const rad = (waveDir * Math.PI) / 180;
      return { x: Math.sin(rad), y: Math.cos(rad) };
    });
  }, [waveDir]);

  const resetToDefaults = () => {
    setWaveAmp(DEFAULTS.waveAmp);
    setWaveSpeed(DEFAULTS.waveSpeed);
    setBobSpeed(DEFAULTS.bobSpeed);
    setBuoyAmp(DEFAULTS.buoyAmp);
    setHeightOffset(DEFAULTS.heightOffset);
    setSubmergeAmp(DEFAULTS.submergeAmp);
    setFloatLift(DEFAULTS.floatLift);
    setCamOffX(DEFAULTS.camOffX);
    setCamOffY(DEFAULTS.camOffY);
    setCamOffZ(DEFAULTS.camOffZ);
    setAudioOn(DEFAULTS.audioOn);
    setAudioVol(DEFAULTS.audioVol);
    setAudioSyncSpeed(DEFAULTS.audioSyncSpeed);
    setAudioSpatial(DEFAULTS.audioSpatial);
    setWaterTintIdx(DEFAULTS.waterTintIdx);
    setWaterOpacity(DEFAULTS.waterOpacity);
    setWaterHue(DEFAULTS.waterHue);
    setWaterSat(DEFAULTS.waterSat);
    setWaterBright(DEFAULTS.waterBright);
    setSurfBright(DEFAULTS.surfBright);
    setSurfSat(DEFAULTS.surfSat);
    setBottomIdx(DEFAULTS.bottomIdx);
    setLeanEnabled(DEFAULTS.leanEnabled);
    setRegularWaves(DEFAULTS.regularWaves);
    setRegularCross(DEFAULTS.regularCross);
    setRegularPeriod(DEFAULTS.regularPeriod);
    setWavePeak(DEFAULTS.wavePeak);
    setBackdropIdx(DEFAULTS.backdropIdx);
    setWakeLock(DEFAULTS.wakeLock);
    setCamFov(DEFAULTS.camFov);
    setCamNear(DEFAULTS.camNear);
    setWaveDir(DEFAULTS.waveDir);
    setFloorDepth(DEFAULTS.floorDepth);
    setFloorTexture(DEFAULTS.floorTexture);
    setVortexMode(DEFAULTS.vortexMode);
    setVortexOpening(DEFAULTS.vortexOpening);
    setVortexRadius(DEFAULTS.vortexRadius);
    setVortexSpeed(DEFAULTS.vortexSpeed);
    setDepthSineOn(DEFAULTS.depthSineOn);
    setDepthSineAmp(DEFAULTS.depthSineAmp);
    setDepthSineFreq(DEFAULTS.depthSineFreq);
    setHideWater(DEFAULTS.hideWater);
    setMidCloudsOn(DEFAULTS.midCloudsOn);
    setMidCloudsHeight(DEFAULTS.midCloudsHeight);
    setSwayAmp(DEFAULTS.swayAmp);
    setSwaySpeed(DEFAULTS.swaySpeed);
    setSwayBias(DEFAULTS.swayBias);
    // timeOfDay is intentionally left untouched.
  };

  // Ocean sound: loop the recorded water track through a lowpass + depth gain
  // so we can still muffle & boost it based on how deep the camera is.
  useEffect(() => {
    if (!audioOn) {
      if (audioRef.current) {
        const a = audioRef.current;
        a.master.gain.cancelScheduledValues(a.ctx.currentTime);
        a.master.gain.setTargetAtTime(0, a.ctx.currentTime, 0.4);
        const dying = a;
        setTimeout(() => {
          try { dying.el.pause(); } catch { /* noop */ }
          try { dying.ctx.close(); } catch { /* noop */ }
        }, 600);
        audioRef.current = null;
      }
      return;
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();

    const el = new Audio(waterAsset.url);
    el.loop = true;
    el.crossOrigin = "anonymous";
    el.preload = "auto";
    // By default the recorded water sound keeps its original speed regardless
    // of wave tempo. The user can opt-in to sync it below.
    el.playbackRate = audioSyncSpeed ? Math.max(0.2, Math.min(5, waveSpeed)) : 1;
    el.preservesPitch = true;

    const src = ctx.createMediaElementSource(el);

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 18000;
    lp.Q.value = 0.6;

    const master = ctx.createGain();
    master.gain.value = 0;

    const depthGain = ctx.createGain();
    depthGain.gain.value = 1;

    src.connect(lp).connect(master).connect(depthGain).connect(ctx.destination);

    el.play().catch(() => { /* user gesture required — will retry on next toggle */ });
    master.gain.setTargetAtTime(audioVol, ctx.currentTime, 0.6);

    audioRef.current = { ctx, el, master, depthGain, lp };
  }, [audioOn]);

  // React to volume changes
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.master.gain.setTargetAtTime(audioVol, a.ctx.currentTime, 0.2);
  }, [audioVol]);

  // React to tempo-sync option: only change audio speed when explicitly enabled.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.el.playbackRate = audioSyncSpeed ? Math.max(0.2, Math.min(5, waveSpeed)) : 1;
    a.el.preservesPitch = true;
  }, [audioSyncSpeed, waveSpeed]);

  // Screen Wake Lock: keep the display awake while the app is active.
  // The lock is automatically released when the page is hidden, so we
  // re-request it when the tab becomes visible again.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> } };
    if (!nav.wakeLock) return;

    let sentinel: WakeLockSentinel | null = null;
    let active = true;

    const request = async () => {
      if (!wakeLock || document.hidden) return;
      try {
        const s = await nav.wakeLock!.request("screen");
        if (!active) {
          s.release().catch(() => { /* noop */ });
          return;
        }
        sentinel = s;
        s.addEventListener("release", () => {
          sentinel = null;
        });
      } catch {
        // User gesture or permission may be missing — silently fail.
      }
    };

    const release = () => {
      if (sentinel) {
        sentinel.release().catch(() => { /* noop */ });
        sentinel = null;
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        release();
      } else {
        request();
      }
    };

    request();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", handleVisibility);
      release();
    };
  }, [wakeLock]);

  // Idle UI fade: hide overlays after inactivity, restore on any pointer input.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const IDLE_MS = 3500;
    const bump = () => {
      setUiVisible(true);
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(() => setUiVisible(false), IDLE_MS);
    };
    bump();
    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener("pointerdown", bump, opts);
    window.addEventListener("pointermove", bump, opts);
    window.addEventListener("touchstart", bump, opts);
    window.addEventListener("keydown", bump);
    return () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("pointermove", bump);
      window.removeEventListener("touchstart", bump);
      window.removeEventListener("keydown", bump);
    };
  }, []);

  // While settings panel is open, keep UI visible.
  useEffect(() => {
    if (settingsOpen) setUiVisible(true);
  }, [settingsOpen]);

  // Fullscreen state tracking.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const sync = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const toggleFullscreen = () => {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => { /* noop */ });
    } else {
      document.exitFullscreen?.().catch(() => { /* noop */ });
    }
  };




  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x032033, 1);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x88aacc, 0.008);

    const camera = new THREE.PerspectiveCamera(
      camFovRef.current,
      mount.clientWidth / mount.clientHeight,
      camNearRef.current,
      2000,
    );

    // Ocean plane
    const geo = new THREE.PlaneGeometry(600, 600, 320, 320);
    geo.rotateX(-Math.PI / 2);

    const uniforms = {
      uTime: { value: 0 },
      uAmp: { value: waveAmp },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSkyColor: { value: new THREE.Color(0x88aacc) },
      uHorizonColor: { value: new THREE.Color(0xffddaa) },
      uWaterDeep: { value: new THREE.Color(0x022244) },
      uWaterShallow: { value: new THREE.Color(0x2a89b8) },
      uSunColor: { value: new THREE.Color(0xffe6b0) },
      uFogColor: { value: new THREE.Color(0x88aacc) },
      uWaterTint: { value: new THREE.Vector3(1, 1, 1) },
      uOpacity: { value: 1 },
      uTintHue: { value: 0 },
      uTintSat: { value: 1 },
      uTintBright: { value: 1 },
      uSurfBright: { value: 1 },
      uSurfSat: { value: 1 },
      uUnderwater: { value: 0 },
      uRegular: { value: 0 },
      uCross: { value: 1 },
      uPeriod: { value: 1 },
      uPeak: { value: 1 },
      uDir: { value: 0 },
      uVortex: { value: 0 },
      uVortexOpening: { value: 14 },
      uVortexCenter: { value: new THREE.Vector2(0, 0) },
    };

    const vertexShader = /* glsl */ `
      uniform float uTime;
      uniform float uAmp;
      uniform float uRegular;
      uniform float uCross;
      uniform float uPeriod;
      uniform float uPeak;
      uniform float uDir;
      uniform float uVortex;
      uniform float uVortexOpening;
      uniform vec2 uVortexCenter;
      varying vec3 vWorldPos;
      varying vec3 vNormal;

      // Rounded Gaussian crest boost — sharpens the wave top without creating
      // near-vertical phase-bunched faces that alias when viewed from the side.
      float shp(float theta) {
        float k = clamp((uPeak - 1.0) / 5.0, 0.0, 1.0);
        float amount = max(0.0, uPeak - 1.0) * 0.28;
        float wrapped = atan(sin(theta - 1.57079632679), cos(theta - 1.57079632679));
        // Narrower Gaussian at high SPETS → sharper, pointier crests.
        float width = mix(0.72, 0.34, k);
        float crest = exp(-(wrapped * wrapped) / (2.0 * width * width));
        // Analytic mean of the Gaussian pulse over one period, so raising
        // SPETS keeps the mean surface level and only sharpens the top.
        float mean = width * 0.3989;
        // Extra pow-based crest boost purely on the positive lobe — adds a
        // realistic near-cusp peak without steepening the wave face.
        float base = sin(theta);
        float peakBoost = pow(max(base, 0.0), mix(1.0, 4.0, k)) - 0.3183 * mix(0.0, 1.0, k);
        return (base + amount * (crest - mean) + k * 0.55 * peakBoost) / (1.0 + amount * 0.28 + k * 0.35);
      }


      float wave(vec3 pIn, float t, float amp, float rippleFade) {
        // Rotate horizontal coords by uDir so wave crests advance in the
        // chosen direction. Small ripples stay in world space so they still
        // sparkle from every angle.
        float cd = cos(uDir), sd = sin(uDir);
        vec3 p = vec3(cd * pIn.x + sd * pIn.z, pIn.y, -sd * pIn.x + cd * pIn.z);
        // Regular sine along x, with optional cross-axis sine so it doesn't
        // look like a flat carpet when uRegular = 1. uPeriod scales the
        // spatial wavelength (higher = longer, calmer swells).
        float regX = shp(p.x * (0.12 / uPeriod) + t * 0.9) * 2.6 * amp;
        float regZ = shp(p.z * (0.09 / uPeriod) + t * 0.7 + 1.1) * 1.4 * amp * uCross;
        float reg = regX + regZ;

        // Large primary swell (chaotic sum of sines)
        float w1 = shp(p.x * 0.12 + t * 0.9) * 1.0;
        float w2 = shp(p.z * 0.17 + t * 0.7 + 1.3) * 0.75;
        float w3 = shp((p.x * 0.22 + p.z * 0.19) + t * 1.4 + 2.1) * 0.5;
        float w4 = shp((p.x * 0.31 - p.z * 0.11) + t * 1.8 + 0.4) * 0.35;
        float big = (w1 + w2 + w3 + w4) * amp;

        // Small ripples on top of the swell — high frequency, so they must
        // fade with distance well before the mesh becomes under-sampled or
        // they alias into jagged spikes at grazing angles.
        float r1 = sin(p.x * 0.85 + p.z * 0.42 + t * 2.6) * 0.06;
        float r2 = sin(p.x * 0.55 - p.z * 0.95 + t * 3.1 + 1.7) * 0.05;
        float r3 = sin((p.x * 1.35 + p.z * 1.15) + t * 3.8 + 0.6) * 0.035;
        float r4 = sin((p.x * 1.9 - p.z * 1.6) + t * 4.7 + 2.3) * 0.022;
        float ripples = (r1 + r2 + r3 + r4) * (1.0 - uRegular) * rippleFade;

        return mix(big + ripples, reg, uRegular);
      }

      void main() {
        vec3 p = position;
        vec4 wpBase = modelMatrix * vec4(p, 1.0);

        // Distance-based amplitude falloff — far triangles get very thin at
        // grazing angles and alias into jagged spikes on the horizon. Fade
        // waves smoothly to flat well before they hit the plane edge.
        float distXZ = length(wpBase.xz - cameraPosition.xz);
        // In vortex mode the camera orbits near the throat, so far water is
        // in view around the funnel. Push the fade out much further so the
        // surrounding sea stays alive instead of looking like a lone tornado
        // on a mirror-flat plane.
        float fadeNear = mix(40.0, 180.0, uVortex);
        float fadeFar  = mix(180.0, 500.0, uVortex);
        float ampFade = 1.0 - smoothstep(fadeNear, fadeFar, distXZ);
        float rippleNear = mix(18.0, 60.0, uVortex);
        float rippleFar  = mix(70.0, 220.0, uVortex);
        float rippleFade = 1.0 - smoothstep(rippleNear, rippleFar, distXZ);
        float ampF = uAmp * ampFade;

        float h = wave(wpBase.xyz, uTime, ampF, rippleFade);
        p.y += h;


        // approximate normal via finite differences — small epsilon so
        // the ripples contribute crisp shading.
        float e = 0.22;
        float hx = wave(wpBase.xyz + vec3(e, 0.0, 0.0), uTime, ampF, rippleFade);
        float hz = wave(wpBase.xyz + vec3(0.0, 0.0, e), uTime, ampF, rippleFade);
        vec3 n = normalize(vec3(h - hx, e, h - hz));

        // Vortex funnel: sink the mesh toward the center with a Gaussian well.
        // Depth of the pit scales with the opening so the walls stay steep but
        // proportional. Inside the vortex we swap the directional swell for a
        // concentric radial wave — from an orbiting camera that reads as even,
        // uniform ripples rolling around the funnel instead of a directional
        // chop that appears to change direction as you circle.
        if (uVortex > 0.001) {
          vec2 rvec = wpBase.xz - uVortexCenter;
          float r = length(rvec);
          float op = max(1.0, uVortexOpening);
          float g = exp(-(r*r) / (op*op));
          float pit = -op * 1.6 * g;
          // Radial wave — analytic so the normal stays clean.
          float kR = 0.12 / uPeriod;
          float phase = r * kR - uTime * 0.9;
          // Vortex waves must be an even sine wave: ignore SPETS/chaos/cross-wave
          // shaping here so the orbit never produces uneven jumps.
          float hR = sin(phase) * 2.6 * ampF;
          // dHr/dr for the radial normal
          float dHr = cos(phase) * kR * 2.6 * ampF;
          float pyRad = pit + hR * (1.0 - g * 0.85);
          p.y = mix(p.y, pyRad, uVortex);
          // Combined normal: funnel wall + radial ripple slope along rvec.
          float dg = -2.0 * g / (op * op);
          vec2 rn = r > 0.0001 ? rvec / r : vec2(0.0);
          float slopeR = dHr * (1.0 - g * 0.85) + (-op * 1.6) * dg * r; // d(pyRad)/dr
          vec3 nv = normalize(vec3(-rn.x * slopeR, 1.0, -rn.y * slopeR));
          n = normalize(mix(n, nv, uVortex));
        }

        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        vNormal = n;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }

    `;

    const fragmentShader = /* glsl */ `
      uniform vec3 uSunDir;
      uniform vec3 uSkyColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uWaterDeep;
      uniform vec3 uWaterShallow;
      uniform vec3 uSunColor;
      uniform vec3 uFogColor;
      uniform vec3 uWaterTint;
      uniform float uOpacity;
      uniform float uTintHue;
      uniform float uTintSat;
      uniform float uTintBright;
      uniform float uSurfBright;
      uniform float uSurfSat;
      uniform float uUnderwater;
      varying vec3 vWorldPos;
      varying vec3 vNormal;

      // Hue rotation in RGB space (angle in radians).
      mat3 hueRotate(float angle) {
        float c = cos(angle), s = sin(angle);
        float oneThird = 1.0 / 3.0;
        float root3inv = 0.57735026919;
        return mat3(
          c + oneThird * (1.0 - c),         -root3inv * s + oneThird * (1.0 - c),  root3inv * s + oneThird * (1.0 - c),
          root3inv * s + oneThird * (1.0 - c), c + oneThird * (1.0 - c),          -root3inv * s + oneThird * (1.0 - c),
          -root3inv * s + oneThird * (1.0 - c), root3inv * s + oneThird * (1.0 - c), c + oneThird * (1.0 - c)
        );
      }

      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uSunDir);

        // Apply user color adjustments on top of the water-tint preset.
        vec3 tint = uWaterTint * uTintBright;
        tint = hueRotate(uTintHue) * tint;
        vec3 gray = vec3(dot(tint, vec3(0.299, 0.587, 0.114)));
        tint = mix(gray, tint, uTintSat);

        float NdotV = clamp(dot(N, V), 0.0, 1.0);

        // Schlick Fresnel with water's real F0 (~0.02) — grazing angles push
        // reflectance to 1.0 for natural rim shimmer, straight-down stays dim.
        float F0 = 0.02;
        float fres = F0 + (1.0 - F0) * pow(1.0 - NdotV, 5.0);

        // Micro-shimmer: high-frequency normal perturbation for scale-fine
        // sparkle that only shows up near the Fresnel rim / sun highlight.
        float shim = sin(vWorldPos.x * 3.7 + vWorldPos.z * 4.3) *
                     sin(vWorldPos.x * 5.1 - vWorldPos.z * 6.2);
        vec3 Nshim = normalize(N + vec3(shim * 0.06, 0.0, shim * 0.05));

        // Sky reflection — sample along the reflection vector so different
        // camera angles pick different sky bands (horizon vs zenith).
        vec3 R = reflect(-V, Nshim);
        float rUp = clamp(R.y, 0.0, 1.0);
        vec3 skyRef = mix(uHorizonColor, uSkyColor, pow(rUp, 0.65));

        // Refraction tint — view-dependent transmitted color. Straight down
        // we see into the deep hue; at grazing angles the shallow tint takes
        // over just before Fresnel flips everything to reflection.
        vec3 deepT = uWaterDeep * tint;
        vec3 shalT = uWaterShallow * tint;
        float refrMix = mix(0.15, 0.85, pow(1.0 - NdotV, 1.6));
        vec3 water = mix(deepT, shalT, refrMix);

        // Subsurface scattering — light bleeding through wave crests
        float height = clamp((vWorldPos.y + 1.0) / 3.0, 0.0, 1.0);
        vec3 sss = uSunColor * pow(height, 2.0) * 0.35 * clamp(uSunDir.y + 0.2, 0.0, 1.0);
        water += sss * tint;

        // Specular sun glint — Blinn-Phong with shimmer-perturbed normal so
        // sparkle scatters realistically. Sharpen when sun is low (long glitter
        // path across the surface), soften at noon.
        vec3 H = normalize(L + V);
        float sunElev = clamp(uSunDir.y, 0.0, 1.0);
        float shin = mix(220.0, 80.0, sunElev);
        float spec = pow(max(dot(Nshim, H), 0.0), shin);
        float grazeBoost = 1.0 + (1.0 - NdotV) * 1.5;
        vec3 sun = uSunColor * spec * clamp(uSunDir.y + 0.2, 0.0, 1.0)
                   * 2.8 * grazeBoost * (1.0 - uUnderwater);

        vec3 col = mix(water, skyRef, fres * (1.0 - uUnderwater * 0.85)) + sun;

        // Final surface color adjustment (independent of internal tint).
        col *= uSurfBright;
        float sg = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(vec3(sg), col, uSurfSat);

        // Fog to horizon
        float dist = length(cameraPosition - vWorldPos);
        float fogF = 1.0 - exp(-dist * 0.008);
        col = mix(col, uFogColor, clamp(fogF, 0.0, 1.0));

        // Underwater tone-down: desaturate + darken, pulled toward tinted deep hue.
        if (uUnderwater > 0.0) {
          float g = dot(col, vec3(0.299, 0.587, 0.114));
          vec3 muted = mix(vec3(g), deepT * 1.1, 0.55) * (1.0 - 0.35 * uUnderwater);
          col = mix(col, muted, clamp(uUnderwater, 0.0, 1.0));
        }

        // Translucency — thinner (higher/steeper) crests let more light through.
        // uOpacity scales the final water transparency independently.
        float alpha = clamp(0.65 + fres * 0.35 - height * 0.35, 0.4, 1.0) * uOpacity;
        gl_FragColor = vec4(col, alpha);
      }
    `;


    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
    mat.forceSinglePass = true;
    const ocean = new THREE.Mesh(geo, mat);
    scene.add(ocean);

    // Optional seafloor beneath the ocean plane. ShaderMaterial gör den
    // procedurellt strukturerad (sandbankar, småsten, kaustik) när uTextured=1.
    const floorGeo = new THREE.PlaneGeometry(600, 600, 32, 32);
    floorGeo.rotateX(-Math.PI / 2);
    // Real CC0 sand photo (ambientCG Ground054, 512px) – loaded lazily so the
    // scene renders even if the CDN request is slow.
    const sandTex = new THREE.TextureLoader().load(sandTextureAsset.url);
    sandTex.wrapS = THREE.RepeatWrapping;
    sandTex.wrapT = THREE.RepeatWrapping;
    sandTex.anisotropy = renderer.capabilities.getMaxAnisotropy?.() ?? 4;
    sandTex.colorSpace = THREE.SRGBColorSpace;

    const floorUniforms = {
      fogColor: { value: new THREE.Color(0x000000) },
      fogDensity: { value: 0 },
      fogNear: { value: 1 },
      fogFar: { value: 1000 },
      uColor: { value: new THREE.Color(0xd8c078) },
      uTextured: { value: 0 },
      uClouds: { value: 0 },
      uCloudScroll: { value: new THREE.Vector2(0, 0) },
      uTime: { value: 0 },
      uSunDir: { value: uniforms.uSunDir.value },
      uFogColor: { value: uniforms.uFogColor.value },
      uSandTex: { value: sandTex },
      uSandScale: { value: 0.35 }, // ~1 tile per 2.9 m så kornen syns
    };
    const floorMat = new THREE.ShaderMaterial({
      uniforms: floorUniforms,
      fog: true,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: true,
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorld;
        #include <fog_pars_vertex>
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        varying vec3 vWorld;
        uniform vec3 uColor;
        uniform float uTextured;
        uniform float uClouds;
        uniform vec2 uCloudScroll;
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform sampler2D uSandTex;
        uniform float uSandScale;
        #include <fog_pars_fragment>

        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
        float vnoise(vec2 p){
          vec2 i = floor(p); vec2 f = fract(p);
          float a = hash(i);
          float b = hash(i + vec2(1.0,0.0));
          float c = hash(i + vec2(0.0,1.0));
          float d = hash(i + vec2(1.0,1.0));
          vec2 u = f*f*(3.0-2.0*f);
          return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
        }
        float fbm(vec2 p){
          float v = 0.0; float a = 0.5;
          for (int i = 0; i < 5; i++) {
            v += a * vnoise(p);
            p *= 2.02; a *= 0.5;
          }
          return v;
        }

        void main(){
          if (uClouds > 0.5) {
            vec2 p = vWorld.xz * 0.025 + uCloudScroll;
            float n = fbm(p);
            float cloud = smoothstep(0.45, 0.78, n);
            if (cloud < 0.01) discard;
            // Mild ljus/skugga för volym.
            float shade = 0.85 + 0.25 * fbm(p * 2.3 + 5.0);
            vec3 col = uColor * shade;
            gl_FragColor = vec4(col, cloud);
            #include <fog_fragment>
            return;
          }
          vec3 base = uColor;
          if (uTextured > 0.001) {
            vec2 uv0 = vWorld.xz * uSandScale;
            vec3 s1 = texture2D(uSandTex, uv0).rgb;
            mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
            vec3 s2 = texture2D(uSandTex, rot * uv0 * 0.25 + 0.13).rgb;
            vec3 sand = (s1 + s2) * 0.5;
            sand = (sand - 0.5) * 1.15 + 0.55;
            sand *= uColor * 1.9;
            sand = clamp(sand, 0.0, 1.6);
            vec2 p = vWorld.xz;
            float caustic = 0.0;
            caustic += sin(p.x*0.9 + uTime*0.7 + vnoise(p*0.4)*4.0);
            caustic += sin(p.y*0.85 - uTime*0.55 + vnoise(p*0.35 + 3.1)*4.0);
            caustic = pow(max(0.0, caustic*0.5 + 0.5), 3.0);
            sand += vec3(0.95, 0.88, 0.7) * caustic * 0.22;
            base = mix(uColor, sand, clamp(uTextured, 0.0, 1.0));
          }
          gl_FragColor = vec4(base, 1.0);
          #include <fog_fragment>
        }
      `,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -14;
    floor.visible = false;
    // Rendera botten före vattenytan så att ocean's transparens alltid
    // blandar mot botten – även när floor själv är alpha-blend (moln-läget).
    floor.renderOrder = -2;
    scene.add(floor);

    // Mid-water drifting cloud layer (separate mesh, reuses cloud shader path).
    const midCloudGeo = new THREE.PlaneGeometry(600, 600, 8, 8);
    midCloudGeo.rotateX(-Math.PI / 2);
    const midCloudUniforms = {
      fogColor: { value: new THREE.Color(0x000000) },
      fogDensity: { value: 0 },
      fogNear: { value: 1 },
      fogFar: { value: 1000 },
      uColor: { value: new THREE.Color(0xffffff) },
      uTextured: { value: 0 },
      uClouds: { value: 1 },
      uCloudScroll: { value: new THREE.Vector2(0, 0) },
      uTime: { value: 0 },
      uSunDir: { value: uniforms.uSunDir.value },
      uFogColor: { value: uniforms.uFogColor.value },
      uSandTex: { value: sandTex },
      uSandScale: { value: 0.35 },
    };
    const midCloudMat = new THREE.ShaderMaterial({
      uniforms: midCloudUniforms,
      fog: true,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      vertexShader: floorMat.vertexShader,
      fragmentShader: floorMat.fragmentShader,
    });
    const midClouds = new THREE.Mesh(midCloudGeo, midCloudMat);
    midClouds.position.y = -7;
    midClouds.visible = false;
    midClouds.renderOrder = -1;
    scene.add(midClouds);

    // Sky dome
    const skyGeo = new THREE.SphereGeometry(800, 32, 32);
    const skyUniforms = {
      uTop: { value: new THREE.Color(0x88aacc) },
      uBottom: { value: new THREE.Color(0xffddaa) },
      uSunDir: { value: uniforms.uSunDir.value },
      uSunColor: { value: new THREE.Color(0xffe6b0) },
    };
    const skyMat = new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      side: THREE.BackSide,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uBottom;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        varying vec3 vDir;
        void main() {
          float t = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 col = mix(uBottom, uTop, smoothstep(0.35, 0.75, t));
          float sd = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
          col += uSunColor * pow(sd, 180.0) * 3.0;
          col += uSunColor * pow(sd, 8.0) * 0.15;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);

    // Handle resize
    const handleResize = () => {
      if (!mount) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", handleResize);

    // Palette for time of day (t: 0..1, 0=night, 0.25=sunrise, 0.5=noon, 0.75=sunset, 1=night)
    const palette = (t: number) => {
      // sun elevation
      const sunElev = Math.sin(t * Math.PI * 2 - Math.PI / 2); // -1..1..-1
      const sunAz = t * Math.PI * 2;
      const sunDir = new THREE.Vector3(
        Math.cos(sunAz),
        Math.max(sunElev, -0.2),
        Math.sin(sunAz) * 0.5,
      ).normalize();

      // Color stops
      const night = { top: [0.02, 0.03, 0.1], bot: [0.05, 0.08, 0.2], sun: [0.5, 0.6, 0.9] };
      const dawn = { top: [0.35, 0.45, 0.7], bot: [1.0, 0.55, 0.35], sun: [1.0, 0.75, 0.5] };
      const day = { top: [0.4, 0.65, 0.95], bot: [0.75, 0.88, 1.0], sun: [1.0, 0.95, 0.85] };
      const dusk = { top: [0.25, 0.15, 0.4], bot: [1.0, 0.45, 0.3], sun: [1.0, 0.55, 0.35] };

      let a: typeof night, b: typeof night, k: number;
      if (t < 0.25) {
        a = night; b = dawn; k = t / 0.25;
      } else if (t < 0.5) {
        a = dawn; b = day; k = (t - 0.25) / 0.25;
      } else if (t < 0.75) {
        a = day; b = dusk; k = (t - 0.5) / 0.25;
      } else {
        a = dusk; b = night; k = (t - 0.75) / 0.25;
      }
      const lerp = (x: number[], y: number[], k: number) =>
        [x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k];
      const top = lerp(a.top, b.top, k);
      const bot = lerp(a.bot, b.bot, k);
      const sun = lerp(a.sun, b.sun, k);

      // water tint
      const waterShallow = [top[0] * 0.4 + 0.1, top[1] * 0.5 + 0.15, top[2] * 0.6 + 0.2];
      const waterDeep = [waterShallow[0] * 0.15, waterShallow[1] * 0.2, waterShallow[2] * 0.35];

      return { top, bot, sun, sunDir, waterShallow, waterDeep };
    };

    let raf = 0;
    let lastMs = performance.now();
    let waveT = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      // Sync camera lens (FOV / near clip) with live settings.
      if (camera.fov !== camFovRef.current || camera.near !== camNearRef.current) {
        camera.fov = camFovRef.current;
        camera.near = camNearRef.current;
        camera.updateProjectionMatrix();
      }
      const now = performance.now();
      const dt = Math.min((now - lastMs) / 1000, 0.1);
      lastMs = now;
      waveT += dt * speedRef.current;
      const t = waveT;
      uniforms.uTime.value = t;
      uniforms.uAmp.value = ampRef.current;
      uniforms.uRegular.value += ((regularRef.current ? 1 : 0) - uniforms.uRegular.value) * Math.min(1, dt * 4);
      uniforms.uCross.value += ((regularCrossRef.current ? 1 : 0) - uniforms.uCross.value) * Math.min(1, dt * 4);
      uniforms.uPeriod.value += (regularPeriodRef.current - uniforms.uPeriod.value) * Math.min(1, dt * 4);
      uniforms.uPeak.value += (wavePeakRef.current - uniforms.uPeak.value) * Math.min(1, dt * 4);
      // Wave direction stored in degrees; smoothly interpolate the shortest
      // angular path so wrapping around 360° doesn't spin the ocean.
      {
        const targetRad = (waveDirRef.current * Math.PI) / 180;
        let delta = targetRad - uniforms.uDir.value;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        uniforms.uDir.value += delta * Math.min(1, dt * 4);
      }

      // Smoothly blend the vortex funnel in/out (also drives camera behaviour).
      const vortexTarget = vortexModeRef.current ? 1 : 0;
      uniforms.uVortex.value += (vortexTarget - uniforms.uVortex.value) * Math.min(1, dt * 3);
      uniforms.uVortexOpening.value += (vortexOpeningRef.current - uniforms.uVortexOpening.value) * Math.min(1, dt * 4);

      const p = palette(todRef.current);
      uniforms.uSunDir.value.copy(p.sunDir);
      uniforms.uSkyColor.value.setRGB(p.top[0], p.top[1], p.top[2]);
      uniforms.uHorizonColor.value.setRGB(p.bot[0], p.bot[1], p.bot[2]);
      uniforms.uSunColor.value.setRGB(p.sun[0], p.sun[1], p.sun[2]);
      uniforms.uWaterShallow.value.setRGB(
        p.waterShallow[0],
        p.waterShallow[1],
        p.waterShallow[2],
      );
      uniforms.uWaterDeep.value.setRGB(p.waterDeep[0], p.waterDeep[1], p.waterDeep[2]);
      uniforms.uFogColor.value.setRGB(p.bot[0], p.bot[1], p.bot[2]);
      skyUniforms.uTop.value.copy(uniforms.uSkyColor.value);
      skyUniforms.uBottom.value.copy(uniforms.uHorizonColor.value);
      skyUniforms.uSunColor.value.copy(uniforms.uSunColor.value);
      (scene.fog as THREE.FogExp2).color.copy(uniforms.uFogColor.value);

      // Water tint + optional seafloor
      const tint = WATER_TINTS[waterTintRef.current] ?? WATER_TINTS[0];
      uniforms.uWaterTint.value.set(tint.rgb[0], tint.rgb[1], tint.rgb[2]);
      uniforms.uOpacity.value += (waterOpacityRef.current - uniforms.uOpacity.value) * Math.min(1, dt * 6);
      uniforms.uTintHue.value += (waterHueRef.current * 0.01745329252 - uniforms.uTintHue.value) * Math.min(1, dt * 6);
      uniforms.uTintSat.value += (waterSatRef.current - uniforms.uTintSat.value) * Math.min(1, dt * 6);
      uniforms.uTintBright.value += (waterBrightRef.current - uniforms.uTintBright.value) * Math.min(1, dt * 6);
      uniforms.uSurfBright.value += (surfBrightRef.current - uniforms.uSurfBright.value) * Math.min(1, dt * 6);
      uniforms.uSurfSat.value += (surfSatRef.current - uniforms.uSurfSat.value) * Math.min(1, dt * 6);
      const bot = BOTTOM_OPTIONS[bottomIdxRef.current] ?? BOTTOM_OPTIONS[0];
      // Sinus-modulerat "havsnivå"-offset. Vi flyttar hela scenen (yta, botten,
      // mellan-moln, kamera) rigidt i Y istället för att modulera bottendjupet
      // eller vågshaderns tid — det håller vågens rytm och form helt orörd.
      const depthMod = depthSineOnRef.current
        ? Math.sin(t * depthSineFreqRef.current * Math.PI * 2) * depthSineAmpRef.current
        : 0;
      const effectiveDepth = Math.max(0.5, floorDepthRef.current);
      const levelY = depthMod;
      ocean.position.y = levelY;
      if (bot.rgb) {
        floor.visible = true;
        floorUniforms.uColor.value.setRGB(bot.rgb[0], bot.rgb[1], bot.rgb[2]);
        floor.position.y = -effectiveDepth + levelY;
        floorUniforms.uTime.value = t;
        const isClouds = bot.name === "Moln";
        // Cloud mode blends independently of the sand-texture toggle.
        const cloudTarget = isClouds ? 1 : 0;
        floorUniforms.uClouds.value += (cloudTarget - floorUniforms.uClouds.value) * Math.min(1, dt * 4);
        const target = isClouds ? 0 : floorTextureRef.current ? 1 : 0;
        floorUniforms.uTextured.value += (target - floorUniforms.uTextured.value) * Math.min(1, dt * 4);
        // Drift moln-lagret långsamt över tid.
        floorUniforms.uCloudScroll.value.x = t * 0.015;
        floorUniforms.uCloudScroll.value.y = t * 0.01;
        // Bara moln-läget behöver alfa-blandning; annars kör floor opakt så att
        // vattenytans egen transparens fungerar som tidigare.
        const wantTransparent = floorUniforms.uClouds.value > 0.5;
        if (floorMat.transparent !== wantTransparent) {
          floorMat.transparent = wantTransparent;
          floorMat.needsUpdate = true;
        }
        floorMat.depthWrite = !wantTransparent;
      } else {
        floor.visible = false;
      }

      // Mellan-moln (drivande lager mellan botten och yta).
      if (midCloudsOnRef.current) {
        midClouds.visible = true;
        const frac = Math.max(0.05, Math.min(0.95, midCloudsHeightRef.current));
        // frac=0 → precis över botten, frac=1 → nära ytan.
        midClouds.position.y = -effectiveDepth + effectiveDepth * frac + levelY;
        midCloudUniforms.uTime.value = t;
        midCloudUniforms.uCloudScroll.value.x = t * 0.04;
        midCloudUniforms.uCloudScroll.value.y = t * 0.025;
      } else {
        midClouds.visible = false;
      }

      // Dölj/visa vattenytan.
      ocean.visible = !hideWaterRef.current;

      // Apply joystick velocity (game-pad style): stick.y up = forward (-z), x = strafe.
      // STRÖM-spaken lägger till en konstant drivkraft (drift) så kameran bärs
      // med strömmen även när NAV är i vila.
      // I VIRVEL-läge tolkas NAV om: stick.y = närmare/längre bort från
      // virvelns centrum, stick.x = vridriktning kring virveln.
      const inVortex = vortexModeRef.current;
      const walkSpeed = 8; // m/s at full deflection
      const driftSpeed = 2.2; // m/s at full deflection — mjukare än aktiv rörelse
      let camX: number, camZ: number;
      if (inVortex) {
        // Orbit around origin. NAV.y in/ut, NAV.x tangent.
        const op = vortexOpeningRef.current;
        // Base angular speed scales with the dedicated vortex speed dial
        // (plus a gentle touch of wave tempo) so the swirl is independently
        // adjustable. Negative values reverse the orbit direction.
        // Purely driven by the vortex-tempo dial so wave speed stays independent.
        const baseOmega = 0.35 * vortexSpeedRef.current;
        const stickOmega = stickRef.current.x * 1.4; // extra swirl from NAV.x
        vortexAngleRef.current += (baseOmega + stickOmega) * dt;
        // Move in/out along the radius (STRÖM.y also nudges drift in/out).
        const radialVel = -stickRef.current.y * walkSpeed - driftStickRef.current.y * driftSpeed;
        const minR = Math.max(op * 0.55, 3); // don't dive into the throat
        const maxR = 220;
        vortexRadiusRef.current = Math.max(minR, Math.min(maxR, vortexRadiusRef.current + radialVel * dt));
        setVortexRadius(vortexRadiusRef.current);
        const ang = vortexAngleRef.current;
        camX = Math.cos(ang) * vortexRadiusRef.current;
        camZ = Math.sin(ang) * vortexRadiusRef.current;
      } else {
        posRef.current.x += (stickRef.current.x * walkSpeed + driftStickRef.current.x * driftSpeed) * dt;
        posRef.current.z -= (stickRef.current.y * walkSpeed + driftStickRef.current.y * driftSpeed) * dt;
        camX = posRef.current.x;
        camZ = posRef.current.z;
      }
      const dirRad = (waveDirRef.current * Math.PI) / 180;
      const surfaceY = inVortex
        ? vortexSurfaceHeight(camX, camZ, t, ampRef.current, regularPeriodRef.current, vortexOpeningRef.current)
        : waveHeight(camX, camZ, t, ampRef.current, regularRef.current, regularCrossRef.current, regularPeriodRef.current, wavePeakRef.current, dirRad);

      // Compute wave vertical velocity first so buoyancy can react to it.
      if (prevSurfaceRef.current === null) prevSurfaceRef.current = surfaceY;
      const surfVel = (surfaceY - prevSurfaceRef.current) / Math.max(dt, 1e-4);
      prevSurfaceRef.current = surfaceY;

      // Anticipatory velocity: peek slightly into the future so buoyancy
      // reacts at the *start* of a wave rise (trough) rather than mid-rise.
      // Sharper crests (higher SPETS) have very brief peaks — a fixed lead
      // would overshoot and desync the bob. Shorten the lookahead and clamp
      // the derived velocity so the anticipation stays phase-locked with
      // whatever crest shape is currently rendered.
      const peakK = Math.min(1, Math.max(0, (wavePeakRef.current - 1) / 5));
      // Larger base lead → buoyancy reacts as soon as the wave begins to
      // rise, not after it has already lifted the surface past the camera.
      const lead = 0.7 / (1 + peakK * 1.0);
      const futureSurf = inVortex
        ? vortexSurfaceHeight(camX, camZ, t + lead, ampRef.current, regularPeriodRef.current, vortexOpeningRef.current)
        : waveHeight(camX, camZ, t + lead, ampRef.current, regularRef.current, regularCrossRef.current, regularPeriodRef.current, wavePeakRef.current, dirRad);
      const rawAnticip = (futureSurf - surfaceY) / lead;
      const blend = 1 - peakK * 0.55;
      const anticipVel = rawAnticip * blend + surfVel * (1 - blend);

      const amp = ampRef.current;
      const b = buoyRef.current;
      const sub = submergeRef.current;
      const lift = floatLiftRef.current;
      // Feed-forward the future surface height into the target so the camera
      // starts moving in sync with the incoming wave instead of chasing it.
      const futureBias = 0.55;
      const anticipSurf = surfaceY * (1 - futureBias) + futureSurf * futureBias;
      const cap = amp * 1.4;
      const rawDive = Math.max(0, anticipVel) * sub * 0.6 * (0.6 + amp * 0.6);
      const rawLift = anticipVel * lift * 0.35 * (0.6 + amp * 0.6);
      const diveOffset = Math.min(cap, rawDive);
      const liftOffset = Math.max(-cap, Math.min(cap, rawLift));
      const targetY = anticipSurf + heightRef.current - diveOffset + liftOffset;

      if (camYRef.current === null) camYRef.current = targetY;
      // Stiffer spring → less phase lag between wave and camera.
      const k = (10 + 26 * bobSpeedRef.current) * (1 + peakK * 0.6);
      const zeta = 0.32;
      const c = 2 * zeta * Math.sqrt(k);
      const gravity = (1.2 + 3 * amp) * b * sub - (1.0 + 2 * amp) * b * lift;
      const ay = k * (targetY - camYRef.current) - c * camVYRef.current - gravity;
      camVYRef.current += ay * dt;
      camYRef.current += camVYRef.current * dt;

      // Slow "sway" drift — organic low-frequency wandering to give the
      // sense that the body is being carried by open water. Two detuned
      // sines per axis create a lissajous-like path that never repeats
      // exactly. swayBias biases the drift along/against the wave-direction
      // vector (+1 = med vågorna, -1 = baksug/motström).
      const swAmp = swayAmpRef.current;
      let swayX = 0, swayZ = 0;
      if (swAmp > 0.001) {
        const ws = swaySpeedRef.current; // 0..1
        const st = t * ws;
        // Base wander (isotropic).
        const wx = Math.sin(st * 0.31) * 0.7 + Math.sin(st * 0.13 + 1.7) * 0.3;
        const wz = Math.cos(st * 0.27 + 0.5) * 0.7 + Math.sin(st * 0.11 + 2.3) * 0.3;
        // Directional bias along wave direction (very slow triangle-ish
        // envelope so it doesn't feel like a constant push).
        const bias = swayBiasRef.current;
        const biasEnv = Math.sin(st * 0.09) * 0.5 + 0.5; // 0..1
        const dirRadS = (waveDirRef.current * Math.PI) / 180;
        const dx = Math.sin(dirRadS);
        const dz = -Math.cos(dirRadS);
        swayX = swAmp * (wx + bias * dx * biasEnv * 1.2);
        swayZ = swAmp * (wz + bias * dz * biasEnv * 1.2);
      }

      // Directional sinus sway from the sticky SVAJ pad — the pad's
      // displacement sets amplitude in each axis (x = left/right, y up =
      // forward/-z). Motion is a pure sinus so the camera glides back and
      // forth along the chosen direction. Independent of the organic wander
      // above; distance from pad center = how far in that direction.
      const sxStick = swayStickRef.current.x;
      const syStick = swayStickRef.current.y;
      if (Math.abs(sxStick) + Math.abs(syStick) > 0.001) {
        const wsPad = Math.max(0.02, swaySpeedRef.current);
        // Base amplitude scale in meters — reuse SVAJ dial if set, otherwise
        // give the pad its own reasonable range so it works standalone.
        const padAmp = swAmp > 0.001 ? swAmp : 6;
        // Pure back-and-forth on each axis independently (no rotation/orbit).
        // Both axes share the same phase so motion is a straight-line sinus
        // along the pad's direction vector: -amp → +amp → -amp.
        const s = Math.sin(t * wsPad * 0.6);
        swayX += padAmp * sxStick * s;
        swayZ += padAmp * (-syStick) * s;
      }


      // Manual XYZ camera offset (POS X/Y/Z dials) — applied after physics so
      // the user can nudge the viewpoint without disturbing the buoyancy loop.
      camera.position.set(
        camX + camOffXRef.current + swayX,
        camYRef.current + camOffYRef.current + levelY,
        camZ + camOffZRef.current + swayZ,
      );
      // Look direction: HAV = level forward; VIRVEL = mot centrum (så kameran
      // följer med runt virveln och naturligt tittar ner mot öppningen).
      const lookY = camera.position.y;
      let lookX: number, lookZ: number;
      if (inVortex) {
        // Aim at the vortex center, slightly below the camera so the throat
        // is visible without the horizon tilting.
        lookX = 0;
        lookZ = 0;
      } else {
        // Include the same horizontal offsets as camera.position (SVAJ sway
        // + manual POS X/Z dial) so the look target pans with the camera
        // instead of staying fixed — otherwise lookAt swivels the camera to
        // compensate, which reads as unwanted yaw rotation.
        lookX = camX + camOffXRef.current + swayX;
        lookZ = camZ + camOffZRef.current + swayZ - 20;
      }
      camera.lookAt(lookX, lookY, lookZ);

      // Rotation stick: yaw (x) + pitch (y). Integrate stick as angular velocity.
      const rotSpeed = 1.6; // rad/s at full deflection
      yawRef.current -= rotStickRef.current.x * rotSpeed * dt;
      pitchRef.current += rotStickRef.current.y * rotSpeed * dt;
      const maxPitch = 1.2;
      if (pitchRef.current > maxPitch) pitchRef.current = maxPitch;
      if (pitchRef.current < -maxPitch) pitchRef.current = -maxPitch;
      camera.rotateY(yawRef.current);
      camera.rotateX(pitchRef.current);

      // Optional forward-leaning rotation: pitch into the direction of travel.
      // Default is a fixed forward horizon (no lean).
      if (leanRef.current) {
        const leanPitch = stickRef.current.y * 0.12;
        camera.rotateX(leanPitch);
      }

      // Sync audio intensity with depth below surface — only when spatial
      // audio is enabled. Default: constant volume with no filtering.
      const depth = surfaceY - camYRef.current; // positive when underwater
      const a = audioRef.current;
      if (a) {
        const now = a.ctx.currentTime;
        if (audioSpatialRef.current) {
          // deeper -> louder (up to ~2.5x), faster ramp
          const depthMult = depth > 0 ? Math.min(1 + 0.35 * depth, 2.5) : 1;
          a.depthGain.gain.setTargetAtTime(depthMult, now, 0.12);
          // deeper -> more muffled (lowpass closes)
          const lpFreq = depth > 0 ? Math.max(18000 - 4000 * depth, 500) : 18000;
          a.lp.frequency.setTargetAtTime(lpFreq, now, 0.15);
        } else {
          a.depthGain.gain.setTargetAtTime(1, now, 0.2);
          a.lp.frequency.setTargetAtTime(18000, now, 0.2);
        }
      }

      // Underwater tone-down factor: fades color/contrast as camera dips below surface.
      const uw = depth > 0 ? Math.min(depth / 2.5, 1) : 0;
      uniforms.uUnderwater.value += (uw - uniforms.uUnderwater.value) * Math.min(1, dt * 6);

      // Keep horizon level: no extra pitch/roll from buoyancy.

      sky.position.copy(camera.position);

      // Optional backdrop: hide sky dome & clear alpha so a DOM image
      // shows through behind the WebGL scene.
      const useBackdrop = backdropRef.current > 0;
      sky.visible = !useBackdrop;
      renderer.setClearColor(0x032033, useBackdrop ? 0 : 1);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
      clock.getDelta();
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      geo.dispose();
      mat.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      midCloudGeo.dispose();
      midCloudMat.dispose();
      sandTex.dispose();
      skyGeo.dispose();
      skyMat.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Time-of-day label
  const todLabel = (() => {
    const t = timeOfDay;
    if (t < 0.15 || t > 0.9) return "Natt";
    if (t < 0.3) return "Gryning";
    if (t < 0.45) return "Morgon";
    if (t < 0.6) return "Middag";
    if (t < 0.75) return "Eftermiddag";
    return "Skymning";
  })();

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black">
      {BACKDROPS[backdropIdx]?.url && (
        <img
          src={BACKDROPS[backdropIdx].url!}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div ref={mountRef} className="absolute inset-0" />

      {/* Persistent brand mark — inverted (white), semi-transparent, 24pt, 5pt margin */}
      <img
        src={appIconAsset.url}
        alt="Aquafulness"
        aria-hidden="true"
        className="pointer-events-none absolute z-30"
        style={{
          top: "5pt",
          right: "5pt",
          width: "24pt",
          height: "24pt",
          filter: "invert(1)",
          opacity: 0.5,
        }}
      />

      {/* HUD overlay — fades out on inactivity, back in on any touch. */}
      <div
        className={`absolute inset-0 z-10 transition-opacity duration-700 ${uiVisible ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        {/* Top bar: settings + speaker toggle + fullscreen */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between px-4 pt-4">
          <button
            onClick={() => setAudioOn((v) => !v)}
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white/90 backdrop-blur-md transition active:scale-95 active:bg-white/15"
            aria-label={audioOn ? "Stäng av ljud" : "Slå på ljud"}
            aria-pressed={audioOn}
            title={audioOn ? "Ljud på" : "Ljud av"}
          >
            {audioOn ? (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 10v4h3l5 4V6L7 10H4z" />
                <path d="M16 8.5a4 4 0 010 7" />
                <path d="M18.5 6a7 7 0 010 12" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 10v4h3l5 4V6L7 10H4z" />
                <path d="M22 9l-6 6M16 9l6 6" />
              </svg>
            )}
          </button>

          <button
            onClick={() => setSettingsOpen((s) => !s)}
            className="pointer-events-auto rounded-full border border-white/20 bg-black/40 px-5 py-2 text-[10px] font-light tracking-[0.35em] text-white/90 backdrop-blur-md transition active:scale-95 active:bg-white/15"
            aria-label={settingsOpen ? "Stäng inställningar" : "Öppna inställningar"}
            aria-expanded={settingsOpen}
          >
            {settingsOpen ? "STÄNG" : "SETTINGS"}
          </button>

          <button
            onClick={toggleFullscreen}
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white/90 backdrop-blur-md transition active:scale-95 active:bg-white/15"
            aria-label={isFullscreen ? "Avsluta helskärm" : "Helskärm"}
            aria-pressed={isFullscreen}
            title={isFullscreen ? "Avsluta helskärm" : "Helskärm"}
          >
            {isFullscreen ? (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 4v4H5M15 4v4h4M9 20v-4H5M15 20v-4h4" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
              </svg>
            )}
          </button>
        </div>


      {/* Collapsible settings panel */}
      {settingsOpen && (
        <div className="pointer-events-auto absolute inset-x-0 top-14 z-20 mx-auto max-w-2xl px-4">
          <div className="max-h-[70vh] overflow-y-auto rounded-3xl border border-white/15 bg-black/60 p-4 shadow-2xl backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between text-white/90">
              <span className="text-[10px] font-light tracking-[0.4em] text-white/60">INSTÄLLNINGAR</span>
              <button
                onClick={resetToDefaults}
                className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[9px] font-light tracking-wider text-white/80 transition active:scale-95 active:bg-white/15"
                aria-label="Återställ reglage till standardvärden"
                title="Återställ reglage (tid på dygnet påverkas inte)"
              >
                ÅTERSTÄLL
              </button>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
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
                label="TID"
                value={todLabel}
                onDec={() => setTimeOfDay((v) => (v - 0.02 + 1) % 1)}
                onInc={() => setTimeOfDay((v) => (v + 0.02) % 1)}
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
                max={1}
                step={0.01}
                onDec={() => setSwaySpeed((v) => Math.max(0.01, +(v - 0.01).toFixed(2)))}
                onInc={() => setSwaySpeed((v) => Math.min(1, +(v + 0.01).toFixed(2)))}
              />
              <PadDial
                label="SVAJ DRIFT"
                mode="number"
                value={swayBias === 0 ? "NEUTRAL" : swayBias > 0 ? `MED ${swayBias.toFixed(2)}` : `MOT ${Math.abs(swayBias).toFixed(2)}`}
                rawValue={swayBias}
                onSet={setSwayBias}
                min={-1}
                max={1}
                step={0.05}
                onDec={() => setSwayBias((v) => Math.max(-1, +(v - 0.05).toFixed(2)))}
                onInc={() => setSwayBias((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
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
                label={audioOn ? "LJUD PÅ" : "LJUD AV"}
                value={audioOn ? `${Math.round(audioVol * 100)}%` : "—"}
                onDec={() => {
                  if (!audioOn) { setAudioOn(true); return; }
                  setAudioVol((v) => {
                    const next = +(v - 0.1).toFixed(2);
                    if (next <= 0) { setAudioOn(false); return 0; }
                    return next;
                  });
                }}
                onInc={() => {
                  if (!audioOn) { setAudioOn(true); return; }
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
              <PadDial
                label="VATTEN"
                value={WATER_TINTS[waterTintIdx].name}
                onDec={() => setWaterTintIdx((i) => (i - 1 + WATER_TINTS.length) % WATER_TINTS.length)}
                onInc={() => setWaterTintIdx((i) => (i + 1) % WATER_TINTS.length)}
              />
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
                label="BOTTEN"
                value={BOTTOM_OPTIONS[bottomIdx].name}
                onDec={() => setBottomIdx((i) => (i - 1 + BOTTOM_OPTIONS.length) % BOTTOM_OPTIONS.length)}
                onInc={() => setBottomIdx((i) => (i + 1) % BOTTOM_OPTIONS.length)}
              />
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
                label="ROTERING"
                value={leanEnabled ? "FRAMÅTLUT" : "FIXERAD"}
                onDec={() => setLeanEnabled(false)}
                onInc={() => setLeanEnabled(true)}
              />
              <PadDial
                label="VÅGFORM"
                value={regularWaves ? "REGELBUNDEN" : "SPRIDD"}
                onDec={() => setRegularWaves(false)}
                onInc={() => setRegularWaves(true)}
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
              <PadDial
                label="BAKGRUND"
                value={BACKDROPS[backdropIdx].name}
                onDec={() => setBackdropIdx((i) => (i - 1 + BACKDROPS.length) % BACKDROPS.length)}
                onInc={() => setBackdropIdx((i) => (i + 1) % BACKDROPS.length)}
              />
              <PadDial
                label="VAKEN"
                value={wakeLock ? "PÅ" : "AV"}
                onDec={() => setWakeLock(false)}
                onInc={() => setWakeLock(true)}
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
                onSet={(v) => setCamNear(Math.max(0.001, Math.min(2, v)))}
                min={0.001}
                max={2}
                step={0.01}
                onDec={() => setCamNear((v) => Math.max(0.001, +(v - 0.01).toFixed(3)))}
                onInc={() => setCamNear((v) => Math.min(2, +(v + 0.01).toFixed(3)))}
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
            </div>
          </div>
        </div>
      )}

      {/* PS-liknande layout:
          Vänster sida: NAV (rörelse, momentan) längst ned, STRÖM (drift, sticky) ovanför.
          Höger sida: LOOK (rotation, momentan) längst ned, VÅGRIKT (sticky) ovanför.
          Dubbelklicka en sticky-spak för att nolla den. */}
      <Joystick
        onChange={setStick}
        value={stick}
        label="NAV"
        positionClass="bottom-6 left-6"
      />
      <Joystick
        onChange={setDriftStick}
        value={driftStick}
        label="STRÖM"
        positionClass="bottom-36 left-6"
        sticky
      />
      <Joystick
        onChange={setSwayStick}
        value={swayStick}
        label="SVAJ"
        positionClass="bottom-64 left-6"
        sticky
      />
      <Joystick
        onChange={setRotStick}
        value={rotStick}
        label="LOOK"
        positionClass="bottom-6 right-6"
      />
      <Joystick
        onChange={(v) => {
          setWaveDirStick(v);
          const m = Math.hypot(v.x, v.y);
          if (m > 0.15) {
            const deg = (Math.atan2(v.x, v.y) * 180) / Math.PI;
            setWaveDir(((deg % 360) + 360) % 360);
          }
        }}
        value={waveDirStick}
        label="VÅGRIKT"
        positionClass="bottom-36 right-6"
        sticky
      />
      </div>
    </main>
  );
}

type PadDialMode = "number" | "cycle";

function clampStep(v: number, min: number, max: number, step: number) {
  const rounded = Math.round(v / step) * step;
  return Math.max(min, Math.min(max, +rounded.toFixed(10)));
}

function PadDial({
  label,
  value,
  rawValue,
  onDec,
  onInc,
  onSet,
  mode = "cycle",
  min,
  max,
  step,
}: {
  label: string;
  value: string;
  rawValue?: number;
  onDec: () => void;
  onInc: () => void;
  onSet?: (v: number) => void;
  mode?: PadDialMode;
  min?: number;
  max?: number;
  step?: number;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const input = inputRef.current;
    if (!input || min === undefined || max === undefined || step === undefined || !onSet) {
      setEditing(false);
      return;
    }
    const parsed = parseFloat(input.value.replace(/,/g, "."));
    if (!Number.isNaN(parsed)) {
      onSet(clampStep(parsed, min, max, step));
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editing) {
      if (e.key === "Enter") commit();
      if (e.key === "Escape") setEditing(false);
      return;
    }
    if (e.key === "ArrowUp" || e.key === "ArrowRight" || e.key === "+") {
      e.preventDefault();
      onInc();
    } else if (e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "-") {
      e.preventDefault();
      onDec();
    }
  };

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="flex items-center gap-1 rounded-full border border-white/15 bg-black/40 p-1 pl-3 backdrop-blur-md outline-none focus:border-white/40 focus:bg-black/50"
    >
      <div className="flex min-w-[86px] flex-col items-start leading-tight text-white">
        <span className="text-[9px] font-light tracking-[0.28em] text-white/60">
          {label}
        </span>
        {mode === "number" && editing ? (
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            defaultValue={rawValue ?? value}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            autoFocus
            className="w-20 bg-transparent text-xs font-medium tracking-wider text-white outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => mode === "number" && setEditing(true)}
            className={`text-xs font-medium tracking-wider ${mode === "number" ? "cursor-text underline decoration-white/30 underline-offset-2" : "cursor-default"}`}
            tabIndex={-1}
          >
            {value}
          </button>
        )}
      </div>
      <button
        onClick={onDec}
        className="h-7 w-7 rounded-full border border-white/20 bg-white/5 text-white/90 transition active:scale-95 active:bg-white/15"
        aria-label={`${label} minska`}
        tabIndex={-1}
      >
        −
      </button>
      <button
        onClick={onInc}
        className="h-7 w-7 rounded-full border border-white/20 bg-white/5 text-white/90 transition active:scale-95 active:bg-white/15"
        aria-label={`${label} öka`}
        tabIndex={-1}
      >
        +
      </button>
    </div>
  );
}

function Joystick({
  onChange,
  value,
  label = "NAV",
  positionClass = "bottom-6 left-6",
  sticky = false,
}: {
  onChange: (v: { x: number; y: number }) => void;
  value: { x: number; y: number };
  label?: string;
  positionClass?: string;
  sticky?: boolean;
}) {
  const baseRef = useRef<HTMLDivElement>(null);
  const activeId = useRef<number | null>(null);
  const radius = 42;

  const setFromPointer = (clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > radius) {
      dx = (dx / dist) * radius;
      dy = (dy / dist) * radius;
    }
    onChange({ x: dx / radius, y: -dy / radius });
  };

  return (
    <div className={`pointer-events-none absolute z-10 select-none ${positionClass}`}>
      <div
        ref={baseRef}
        onDoubleClick={() => {
          if (sticky) onChange({ x: 0, y: 0 });
        }}
        onPointerDown={(e) => {
          if (activeId.current !== null) return;
          activeId.current = e.pointerId;
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          setFromPointer(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (activeId.current !== e.pointerId) return;
          setFromPointer(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (activeId.current !== e.pointerId) return;
          activeId.current = null;
          if (!sticky) onChange({ x: 0, y: 0 });
        }}
        onPointerCancel={() => {
          activeId.current = null;
          if (!sticky) onChange({ x: 0, y: 0 });
        }}
        className="pointer-events-auto relative h-24 w-24 touch-none rounded-full border border-white/20 bg-black/35 backdrop-blur-md"
        style={{ boxShadow: "inset 0 0 40px rgba(255,255,255,0.05)" }}
      >
        <div className="pointer-events-none absolute inset-3 rounded-full border border-white/10" />
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-9 w-9 rounded-full border border-white/30 bg-white/80 shadow-[0_0_24px_rgba(255,255,255,0.35)]"
          style={{
            transform: `translate(calc(-50% + ${value.x * radius}px), calc(-50% + ${-value.y * radius}px))`,
          }}
        />
        <span className="pointer-events-none absolute inset-x-0 top-1 text-center text-[8px] font-light tracking-[0.28em] text-white/60">
          {label}
        </span>
      </div>
    </div>
  );
}
