import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import waterAsset from "@/assets/water.mp3.asset.json";
import vanernBackdrop from "@/assets/vanern-backdrop.png.asset.json";
import sandTextureAsset from "@/assets/sand_cc0_512.jpg.asset.json";

export const Route = createFileRoute("/")({
  component: Aquafulness,
  head: () => ({
    meta: [
      { title: "Aquafulness — Ocean Wave Meditation" },
      {
        name: "description",
        content:
          "A calming WebGL ocean where the camera drifts on the waves. Adjust swell, time of day, and wander across the sea.",
      },
      { property: "og:title", content: "Aquafulness — Ocean Wave Meditation" },
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
  const amount = Math.max(0, p - 1) * 0.16;
  if (amount <= 0) return Math.sin(theta);
  const wrapped = Math.atan2(Math.sin(theta - Math.PI / 2), Math.cos(theta - Math.PI / 2));
  const width = 0.72;
  const crest = Math.exp(-(wrapped * wrapped) / (2 * width * width));
  const mean = 0.29;
  return (Math.sin(theta) + amount * (crest - mean)) / (1 + amount * 0.28);
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
  audioOn: boolean;
  audioVol: number;
  audioSyncSpeed: boolean;
  audioSpatial: boolean;
  waterTintIdx: number;
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
  floorBrightness: number;
  floorTint: number;
  floorHue: number;

  vortexMode: boolean;
  vortexOpening: number;
  vortexRadius: number;
  vortexSpeed: number;
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
  audioOn: true,
  audioVol: 0.8,
  audioSyncSpeed: false,
  audioSpatial: false,
  waterTintIdx: 1,
  bottomIdx: 0,
  leanEnabled: false,
  regularWaves: true,
  regularCross: false,
  regularPeriod: 1,
  wavePeak: 1,
  backdropIdx: 0,
  wakeLock: false,
  camFov: 65,
  camNear: 0.1,
  waveDir: 0,
  floorDepth: 14,
  floorTexture: false,
  floorBrightness: 1,
  floorTint: 1,
  floorHue: 0,

  vortexMode: false,
  vortexOpening: 14,
  vortexRadius: 26,
  vortexSpeed: 1,
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
  // Live joystick vector (visual state) — kept in state so the thumb renders.
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const [audioOn, setAudioOn] = useState(initial.audioOn);
  const [audioVol, setAudioVol] = useState(initial.audioVol);
  const [audioSyncSpeed, setAudioSyncSpeed] = useState(initial.audioSyncSpeed);
  const [audioSpatial, setAudioSpatial] = useState(initial.audioSpatial);
  const [waterTintIdx, setWaterTintIdx] = useState(initial.waterTintIdx);
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
  const [floorBrightness, setFloorBrightness] = useState(initial.floorBrightness);
  const [floorTint, setFloorTint] = useState(initial.floorTint);
  const [floorHue, setFloorHue] = useState(initial.floorHue);

  const [vortexMode, setVortexMode] = useState(initial.vortexMode);
  const [vortexOpening, setVortexOpening] = useState(initial.vortexOpening);
  const [vortexRadius, setVortexRadius] = useState(initial.vortexRadius);
  const [vortexSpeed, setVortexSpeed] = useState(initial.vortexSpeed);
  const [rotStick, setRotStick] = useState({ x: 0, y: 0 });
  const [driftStick, setDriftStick] = useState({ x: 0, y: 0 });
  const [waveDirStick, setWaveDirStick] = useState({ x: 0, y: 0 });
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Persist settings to localStorage whenever they change (SSR-safe, hydration-safe).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const data: Persisted = { waveAmp, timeOfDay, waveSpeed, bobSpeed, buoyAmp, heightOffset, submergeAmp, floatLift, audioOn, audioVol, audioSyncSpeed, audioSpatial, waterTintIdx, bottomIdx, leanEnabled, regularWaves, regularCross, regularPeriod, wavePeak, backdropIdx, wakeLock, camFov, camNear, waveDir, floorDepth, floorTexture, floorBrightness, floorTint, floorHue, vortexMode, vortexOpening, vortexRadius, vortexSpeed };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* quota or privacy mode — ignore */
    }
  }, [waveAmp, timeOfDay, waveSpeed, bobSpeed, buoyAmp, heightOffset, submergeAmp, floatLift, audioOn, audioVol, audioSyncSpeed, audioSpatial, waterTintIdx, bottomIdx, leanEnabled, regularWaves, regularCross, regularPeriod, wavePeak, backdropIdx, wakeLock, camFov, camNear, waveDir, floorDepth, floorTexture, floorBrightness, floorTint, floorHue, vortexMode, vortexOpening, vortexRadius, vortexSpeed]);

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
  const stickRef = useRef({ x: 0, y: 0 });
  const posRef = useRef({ x: 0, z: 0 });
  const camYRef = useRef<number | null>(null);
  const camVYRef = useRef(0);
  const waterTintRef = useRef(waterTintIdx);
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
  const floorBrightnessRef = useRef(floorBrightness);
  const floorTintRef = useRef(floorTint);
  const floorHueRef = useRef(floorHue);

  const vortexModeRef = useRef(vortexMode);
  const vortexOpeningRef = useRef(vortexOpening);
  const vortexRadiusRef = useRef(vortexRadius);
  const vortexSpeedRef = useRef(vortexSpeed);
  const vortexAngleRef = useRef(0);
  useEffect(() => { ampRef.current = waveAmp; }, [waveAmp]);
  useEffect(() => { todRef.current = timeOfDay; }, [timeOfDay]);
  useEffect(() => { speedRef.current = waveSpeed; }, [waveSpeed]);
  useEffect(() => { bobSpeedRef.current = bobSpeed; }, [bobSpeed]);
  useEffect(() => { buoyRef.current = buoyAmp; }, [buoyAmp]);
  useEffect(() => { heightRef.current = heightOffset; }, [heightOffset]);
  useEffect(() => { submergeRef.current = submergeAmp; }, [submergeAmp]);
  useEffect(() => { floatLiftRef.current = floatLift; }, [floatLift]);
  useEffect(() => { stickRef.current = stick; }, [stick]);
  useEffect(() => { rotStickRef.current = rotStick; }, [rotStick]);
  useEffect(() => { driftStickRef.current = driftStick; }, [driftStick]);
  useEffect(() => { waterTintRef.current = waterTintIdx; }, [waterTintIdx]);
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
  useEffect(() => { floorBrightnessRef.current = floorBrightness; }, [floorBrightness]);
  useEffect(() => { floorTintRef.current = floorTint; }, [floorTint]);
  useEffect(() => { floorHueRef.current = floorHue; }, [floorHue]);

  useEffect(() => { vortexModeRef.current = vortexMode; }, [vortexMode]);
  useEffect(() => { vortexOpeningRef.current = vortexOpening; }, [vortexOpening]);
  useEffect(() => { vortexRadiusRef.current = vortexRadius; }, [vortexRadius]);
  useEffect(() => { vortexSpeedRef.current = vortexSpeed; }, [vortexSpeed]);
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
    setAudioOn(DEFAULTS.audioOn);
    setAudioVol(DEFAULTS.audioVol);
    setAudioSyncSpeed(DEFAULTS.audioSyncSpeed);
    setAudioSpatial(DEFAULTS.audioSpatial);
    setWaterTintIdx(DEFAULTS.waterTintIdx);
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
    setFloorBrightness(DEFAULTS.floorBrightness);
    setFloorTint(DEFAULTS.floorTint);
    setFloorHue(DEFAULTS.floorHue);

    setVortexMode(DEFAULTS.vortexMode);
    setVortexOpening(DEFAULTS.vortexOpening);
    setVortexRadius(DEFAULTS.vortexRadius);
    setVortexSpeed(DEFAULTS.vortexSpeed);
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
        float amount = max(0.0, uPeak - 1.0) * 0.16;
        float wrapped = atan(sin(theta - 1.57079632679), cos(theta - 1.57079632679));
        float width = 0.72;
        float crest = exp(-(wrapped * wrapped) / (2.0 * width * width));
        float mean = 0.29;
        return (sin(theta) + amount * (crest - mean)) / (1.0 + amount * 0.28);
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
        float ampFade = 1.0 - smoothstep(40.0, 180.0, distXZ);
        // High-frequency ripples must fade much sooner than the big swell —
        // their wavelength is close to the triangle spacing, so any surviving
        // amplitude at distance produces jaggy grazing-angle artifacts.
        float rippleFade = 1.0 - smoothstep(18.0, 70.0, distXZ);
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
        // proportional. Wave amplitude is damped inside the throat because the
        // water there is "sucked down" and can't crest normally.
        if (uVortex > 0.001) {
          vec2 rvec = wpBase.xz - uVortexCenter;
          float r = length(rvec);
          float op = max(1.0, uVortexOpening);
          float g = exp(-(r*r) / (op*op));
          float pit = -op * 1.6 * g;
          // Damp wave contribution in the throat so the funnel shape is clean.
          p.y = mix(p.y, pit + h * (1.0 - g * 0.85), uVortex);
          // Tilt the surface normal toward the center so shading follows the
          // funnel walls (radial gradient of the Gaussian well).
          float dg = -2.0 * g / (op * op);
          vec3 nv = normalize(vec3(-rvec.x * dg * op * 1.6, 1.0, -rvec.y * dg * op * 1.6));
          n = normalize(mix(n, nv, uVortex * 0.8));
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
      uniform float uUnderwater;
      varying vec3 vWorldPos;
      varying vec3 vNormal;

      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uSunDir);

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
        vec3 deepT = uWaterDeep * uWaterTint;
        vec3 shalT = uWaterShallow * uWaterTint;
        float refrMix = mix(0.15, 0.85, pow(1.0 - NdotV, 1.6));
        vec3 water = mix(deepT, shalT, refrMix);

        // Subsurface scattering — light bleeding through wave crests
        float height = clamp((vWorldPos.y + 1.0) / 3.0, 0.0, 1.0);
        vec3 sss = uSunColor * pow(height, 2.0) * 0.35 * clamp(uSunDir.y + 0.2, 0.0, 1.0);
        water += sss * uWaterTint;

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

        // Translucency — thinner (higher/steeper) crests let more light through
        float alpha = clamp(0.65 + fres * 0.35 - height * 0.35, 0.4, 1.0);
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
      uTime: { value: 0 },
      uSunDir: { value: uniforms.uSunDir.value },
      uFogColor: { value: uniforms.uFogColor.value },
      uSandTex: { value: sandTex },
      uSandScale: { value: 0.35 }, // ~1 tile per 2.9 m så kornen syns
      uBrightness: { value: 1 },
      uTintStrength: { value: 1 },
      uHueShift: { value: 0 },

    };
    const floorMat = new THREE.ShaderMaterial({
      uniforms: floorUniforms,
      fog: true,
      side: THREE.DoubleSide,
      transparent: false,
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

        void main(){
          vec3 base = uColor;
          if (uTextured > 0.001) {
            vec2 uv0 = vWorld.xz * uSandScale;
            // Två oktaver – detaljerat lager + grovare roterat lager för att bryta tile-repetitionen.
            vec3 s1 = texture2D(uSandTex, uv0).rgb;
            mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
            vec3 s2 = texture2D(uSandTex, rot * uv0 * 0.25 + 0.13).rgb;
            // Genomsnitt bevarar sandens naturliga ljushet (undviker mörk multiplikation).
            vec3 sand = (s1 + s2) * 0.5;
            // Mild kontrast så kornen syns utan att gå ner i choklad-toner.
            sand = (sand - 0.5) * 1.15 + 0.55;
            // Tint mot vald bottenfärg: mjuk multiplikation runt neutralton (mean ~0.5 i linjär sRGB).
            sand *= uColor * 1.9;
            // Lyft klarheten en aning så det känns som soligt bottenskikt.
            sand = clamp(sand, 0.0, 1.6);
            // Kaustik-flimmer från vågorna ovanför.
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
    scene.add(floor);

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
      const bot = BOTTOM_OPTIONS[bottomIdxRef.current] ?? BOTTOM_OPTIONS[0];
      if (bot.rgb) {
        floor.visible = true;
        floorUniforms.uColor.value.setRGB(bot.rgb[0], bot.rgb[1], bot.rgb[2]);
        floor.position.y = -floorDepthRef.current;
        floorUniforms.uTime.value = t;
        // Smooth blend av textur på/av så tonen inte snappar.
        const target = floorTextureRef.current ? 1 : 0;
        floorUniforms.uTextured.value += (target - floorUniforms.uTextured.value) * Math.min(1, dt * 4);
      } else {
        floor.visible = false;
      }

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
        const baseOmega = (0.25 + 0.03 * speedRef.current) * vortexSpeedRef.current;
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
      // Funnel dip at the camera's XZ position (matches the shader Gaussian).
      const funnelY = (() => {
        if (!inVortex) return 0;
        const op = Math.max(1, vortexOpeningRef.current);
        const r2 = camX * camX + camZ * camZ;
        return -op * 1.6 * Math.exp(-r2 / (op * op));
      })();
      const waveSurf = waveHeight(camX, camZ, t, ampRef.current, regularRef.current, regularCrossRef.current, regularPeriodRef.current, wavePeakRef.current, dirRad);
      const surfaceY = waveSurf + funnelY;

      // Compute wave vertical velocity first so buoyancy can react to it.
      if (prevSurfaceRef.current === null) prevSurfaceRef.current = surfaceY;
      const surfVel = (surfaceY - prevSurfaceRef.current) / Math.max(dt, 1e-4);
      prevSurfaceRef.current = surfaceY;

      // Anticipatory velocity: peek slightly into the future so buoyancy
      // reacts at the *start* of a wave rise (trough) rather than mid-rise.
      // t is already wave-time (scaled by wave speed).
      const lead = 0.35;
      const futureSurf = waveHeight(camX, camZ, t + lead, ampRef.current, regularRef.current, regularCrossRef.current, regularPeriodRef.current, wavePeakRef.current, dirRad) + funnelY;
      const anticipVel = (futureSurf - surfaceY) / lead;

      // Wave-synced buoyancy: camera is a damped spring pulled toward the
      // surface with gravity. Rising crests push the camera underwater
      // (DYK controls how deep), and gravity makes it fall past equilibrium
      // in the trough and bounce back — like a real float.
      const amp = ampRef.current;
      const b = buoyRef.current;
      const sub = submergeRef.current;
      const lift = floatLiftRef.current;
      // Dynamic dive uses the anticipated velocity so the camera starts
      // sinking as soon as the wave begins to rise (not mid-crest).
      const diveOffset = Math.max(0, anticipVel) * sub * 0.6 * (0.6 + amp * 0.6);
      const liftOffset = anticipVel * lift * 0.35 * (0.6 + amp * 0.6);
      const targetY = surfaceY + heightRef.current - diveOffset + liftOffset;
      if (camYRef.current === null) camYRef.current = targetY;
      const k = 4 + 14 * bobSpeedRef.current; // stiffness (spring tempo)
      const zeta = 0.32; // underdamped → visible bounce
      const c = 2 * zeta * Math.sqrt(k);
      // Steady gravity scales with DYK (pulls down) and is countered by FLYT.
      const gravity = (1.2 + 3 * amp) * b * sub - (1.0 + 2 * amp) * b * lift;
      const ay = k * (targetY - camYRef.current) - c * camVYRef.current - gravity;
      camVYRef.current += ay * dt;
      camYRef.current += camVYRef.current * dt;

      camera.position.set(camX, camYRef.current, camZ);
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
        lookX = camX;
        lookZ = camZ - 20;
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

      {/* Settings toggle replaces the title */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-center px-4 pt-4">
        <button
          onClick={() => setSettingsOpen((s) => !s)}
          className="pointer-events-auto rounded-full border border-white/20 bg-black/40 px-5 py-2 text-[10px] font-light tracking-[0.35em] text-white/90 backdrop-blur-md transition active:scale-95 active:bg-white/15"
          aria-label={settingsOpen ? "Stäng inställningar" : "Öppna inställningar"}
          aria-expanded={settingsOpen}
        >
          {settingsOpen ? "STÄNG" : "SETTINGS"}
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
                max={2}
                step={0.05}
                onDec={() => setWaveAmp((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
                onInc={() => setWaveAmp((v) => Math.min(2, +(v + 0.05).toFixed(2)))}
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
                onSet={(v) => setVortexSpeed(Math.max(-3, Math.min(3, v)))}
                min={-3}
                max={3}
                step={0.1}
                onDec={() => setVortexSpeed((v) => Math.max(-3, +(v - 0.1).toFixed(2)))}
                onInc={() => setVortexSpeed((v) => Math.min(3, +(v + 0.1).toFixed(2)))}
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
