import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import waterAsset from "@/assets/water.mp3.asset.json";
import vanernBackdrop from "@/assets/vanern-backdrop.png.asset.json";

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

// Gerstner-like sum of sines. Keep in sync with vertex shader.
function waveHeight(x: number, z: number, t: number, amp: number, regular: boolean, cross: boolean, period: number = 1) {
  if (regular) {
    const kx = 0.12 / period;
    const kz = 0.09 / period;
    const rx = Math.sin(x * kx + t * 0.9) * 2.6 * amp;
    const rz = cross ? Math.sin(z * kz + t * 0.7 + 1.1) * 1.4 * amp : 0;
    return rx + rz;
  }
  const w1 = Math.sin(x * 0.12 + t * 0.9) * 1.0;
  const w2 = Math.sin(z * 0.17 + t * 0.7 + 1.3) * 0.75;
  const w3 = Math.sin((x * 0.22 + z * 0.19) + t * 1.4 + 2.1) * 0.5;
  const w4 = Math.sin((x * 0.31 - z * 0.11) + t * 1.8 + 0.4) * 0.35;
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
  audioOn: boolean;
  audioVol: number;
  waterTintIdx: number;
  bottomIdx: number;
  leanEnabled: boolean;
  regularWaves: boolean;
  regularCross: boolean;
  regularPeriod: number;
  backdropIdx: number;
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
  waveAmp: 1.25,
  timeOfDay: 0.35,
  waveSpeed: 3,
  bobSpeed: 1.9,
  buoyAmp: 2.9,
  heightOffset: 0.4,
  audioOn: true,
  audioVol: 0.8,
  waterTintIdx: 1,
  bottomIdx: 2,
  leanEnabled: false,
  regularWaves: false,
  regularCross: true,
  regularPeriod: 1,
  backdropIdx: 0,
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
  // Live joystick vector (visual state) — kept in state so the thumb renders.
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const [audioOn, setAudioOn] = useState(initial.audioOn);
  const [audioVol, setAudioVol] = useState(initial.audioVol);
  const [waterTintIdx, setWaterTintIdx] = useState(initial.waterTintIdx);
  const [bottomIdx, setBottomIdx] = useState(initial.bottomIdx);
  const [leanEnabled, setLeanEnabled] = useState(initial.leanEnabled);
  const [regularWaves, setRegularWaves] = useState(initial.regularWaves);
  const [regularCross, setRegularCross] = useState(initial.regularCross);
  const [regularPeriod, setRegularPeriod] = useState(initial.regularPeriod);
  const [backdropIdx, setBackdropIdx] = useState(initial.backdropIdx);
  // Rotation stick (yaw / pitch look) and wave-follow stick.
  const [rotStick, setRotStick] = useState({ x: 0, y: 0 });
  const [followStick, setFollowStick] = useState({ x: 0, y: 0 });
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Persist settings to localStorage whenever they change (SSR-safe, hydration-safe).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const data: Persisted = { waveAmp, timeOfDay, waveSpeed, bobSpeed, buoyAmp, heightOffset, audioOn, audioVol, waterTintIdx, bottomIdx, leanEnabled, regularWaves, regularCross, regularPeriod, backdropIdx };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* quota or privacy mode — ignore */
    }
  }, [waveAmp, timeOfDay, waveSpeed, bobSpeed, buoyAmp, heightOffset, audioOn, audioVol, waterTintIdx, bottomIdx, leanEnabled, regularWaves, regularCross, regularPeriod, backdropIdx]);
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
  const backdropRef = useRef(backdropIdx);
  const rotStickRef = useRef({ x: 0, y: 0 });
  const followStickRef = useRef({ x: 0, y: 0 });
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const prevSurfaceRef = useRef<number | null>(null);
  useEffect(() => { ampRef.current = waveAmp; }, [waveAmp]);
  useEffect(() => { todRef.current = timeOfDay; }, [timeOfDay]);
  useEffect(() => { speedRef.current = waveSpeed; }, [waveSpeed]);
  useEffect(() => { bobSpeedRef.current = bobSpeed; }, [bobSpeed]);
  useEffect(() => { buoyRef.current = buoyAmp; }, [buoyAmp]);
  useEffect(() => { heightRef.current = heightOffset; }, [heightOffset]);
  useEffect(() => { stickRef.current = stick; }, [stick]);
  useEffect(() => { rotStickRef.current = rotStick; }, [rotStick]);
  useEffect(() => { followStickRef.current = followStick; }, [followStick]);
  useEffect(() => { waterTintRef.current = waterTintIdx; }, [waterTintIdx]);
  useEffect(() => { bottomIdxRef.current = bottomIdx; }, [bottomIdx]);
  useEffect(() => { leanRef.current = leanEnabled; }, [leanEnabled]);
  useEffect(() => { regularRef.current = regularWaves; }, [regularWaves]);
  useEffect(() => { regularCrossRef.current = regularCross; }, [regularCross]);
  useEffect(() => { regularPeriodRef.current = regularPeriod; }, [regularPeriod]);
  useEffect(() => { backdropRef.current = backdropIdx; }, [backdropIdx]);

  const resetToDefaults = () => {
    setWaveAmp(DEFAULTS.waveAmp);
    setWaveSpeed(DEFAULTS.waveSpeed);
    setBobSpeed(DEFAULTS.bobSpeed);
    setBuoyAmp(DEFAULTS.buoyAmp);
    setHeightOffset(DEFAULTS.heightOffset);
    setAudioOn(DEFAULTS.audioOn);
    setAudioVol(DEFAULTS.audioVol);
    setWaterTintIdx(DEFAULTS.waterTintIdx);
    setBottomIdx(DEFAULTS.bottomIdx);
    setLeanEnabled(DEFAULTS.leanEnabled);
    setRegularWaves(DEFAULTS.regularWaves);
    setRegularCross(DEFAULTS.regularCross);
    setRegularPeriod(DEFAULTS.regularPeriod);
    setBackdropIdx(DEFAULTS.backdropIdx);
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
      65,
      mount.clientWidth / mount.clientHeight,
      0.1,
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
    };

    const vertexShader = /* glsl */ `
      uniform float uTime;
      uniform float uAmp;
      uniform float uRegular;
      uniform float uCross;
      uniform float uPeriod;
      varying vec3 vWorldPos;
      varying vec3 vNormal;

      float wave(vec3 p, float t, float amp) {
        // Regular sine along x, with optional cross-axis sine so it doesn't
        // look like a flat carpet when uRegular = 1. uPeriod scales the
        // spatial wavelength (higher = longer, calmer swells).
        float regX = sin(p.x * (0.12 / uPeriod) + t * 0.9) * 2.6 * amp;
        float regZ = sin(p.z * (0.09 / uPeriod) + t * 0.7 + 1.1) * 1.4 * amp * uCross;
        float reg = regX + regZ;

        // Large primary swell (chaotic sum of sines)
        float w1 = sin(p.x * 0.12 + t * 0.9) * 1.0;
        float w2 = sin(p.z * 0.17 + t * 0.7 + 1.3) * 0.75;
        float w3 = sin((p.x * 0.22 + p.z * 0.19) + t * 1.4 + 2.1) * 0.5;
        float w4 = sin((p.x * 0.31 - p.z * 0.11) + t * 1.8 + 0.4) * 0.35;
        float big = (w1 + w2 + w3 + w4) * amp;

        // Small ripples on top of the swell — independent of amp so they
        // stay as fine surface texture rather than growing with the waves.
        float r1 = sin(p.x * 0.85 + p.z * 0.42 + t * 2.6) * 0.06;
        float r2 = sin(p.x * 0.55 - p.z * 0.95 + t * 3.1 + 1.7) * 0.05;
        float r3 = sin((p.x * 1.35 + p.z * 1.15) + t * 3.8 + 0.6) * 0.035;
        float r4 = sin((p.x * 1.9 - p.z * 1.6) + t * 4.7 + 2.3) * 0.022;
        float ripples = (r1 + r2 + r3 + r4) * (1.0 - uRegular);

        return mix(big + ripples, reg, uRegular);
      }

      void main() {
        vec3 p = position;
        vec4 wpBase = modelMatrix * vec4(p, 1.0);
        float h = wave(wpBase.xyz, uTime, uAmp);
        p.y += h;

        // approximate normal via finite differences — small epsilon so
        // the ripples contribute crisp shading.
        float e = 0.22;
        float hx = wave(wpBase.xyz + vec3(e, 0.0, 0.0), uTime, uAmp);
        float hz = wave(wpBase.xyz + vec3(0.0, 0.0, e), uTime, uAmp);
        vec3 n = normalize(vec3(h - hx, e, h - hz));

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
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ocean = new THREE.Mesh(geo, mat);
    scene.add(ocean);

    // Optional seafloor beneath the ocean plane.
    const floorGeo = new THREE.PlaneGeometry(600, 600);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshBasicMaterial({
      color: 0xd8c078,
      fog: true,
      side: THREE.DoubleSide,
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
        floorMat.color.setRGB(bot.rgb[0], bot.rgb[1], bot.rgb[2]);
      } else {
        floor.visible = false;
      }

      // Apply joystick velocity (game-pad style): stick.y up = forward (-z), x = strafe
      const walkSpeed = 8; // m/s at full deflection
      posRef.current.x += stickRef.current.x * walkSpeed * dt;
      posRef.current.z -= stickRef.current.y * walkSpeed * dt;

      const camX = posRef.current.x;
      const camZ = posRef.current.z;
      const surfaceY = waveHeight(camX, camZ, t, ampRef.current, regularRef.current, regularCrossRef.current, regularPeriodRef.current);
      // Wave-synced buoyancy: camera is a damped spring pulled toward the
      // surface with gravity. Rising crests outrun the camera so it dips
      // below the surface ("pushed up through"); in the trough gravity
      // makes it fall past equilibrium and bounce back — like a real float.
      const amp = ampRef.current;
      const b = buoyRef.current;
      const targetY = surfaceY + heightRef.current;
      if (camYRef.current === null) camYRef.current = targetY;
      const k = 4 + 14 * bobSpeedRef.current; // stiffness (spring tempo)
      const zeta = 0.32; // underdamped → visible bounce
      const c = 2 * zeta * Math.sqrt(k);
      const gravity = 1.6 * b * (0.6 + amp * 0.5); // pulls camera below crest
      const ay = k * (targetY - camYRef.current) - c * camVYRef.current - gravity;
      camVYRef.current += ay * dt;
      camYRef.current += camVYRef.current * dt;

      // Wave-follow stick: feedforward on wave vertical velocity.
      // y > 0 → rise above crests, sink below troughs (surf on top).
      // y < 0 → counter-drag: lag under crests, lift over troughs.
      // x adds a lateral coupling to the wave slope.
      if (prevSurfaceRef.current === null) prevSurfaceRef.current = surfaceY;
      const surfVel = (surfaceY - prevSurfaceRef.current) / Math.max(dt, 1e-4);
      prevSurfaceRef.current = surfaceY;
      const followY = followStickRef.current.y * surfVel * 0.35;
      const eps = 0.4;
      const slopeX = (waveHeight(camX + eps, camZ, t, amp, regularRef.current, regularCrossRef.current, regularPeriodRef.current) - surfaceY) / eps;
      const followX = followStickRef.current.x * slopeX * 1.2;

      camera.position.set(camX + followX, camYRef.current + followY, camZ);
      const lookZ = camZ - 20;
      const lookY = waveHeight(camX, lookZ, t, amp, regularRef.current, regularCrossRef.current, regularPeriodRef.current) + 0.4;
      camera.lookAt(camX + followX, lookY, lookZ);

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

      // Sync audio intensity with depth below surface.
      const depth = surfaceY - camYRef.current; // positive when underwater
      const a = audioRef.current;
      if (a) {
        const now = a.ctx.currentTime;
        // deeper -> louder (up to ~2.5x), faster ramp
        const depthMult = depth > 0 ? Math.min(1 + 0.35 * depth, 2.5) : 1;
        a.depthGain.gain.setTargetAtTime(depthMult, now, 0.12);
        // deeper -> more muffled (lowpass closes)
        const lpFreq = depth > 0 ? Math.max(18000 - 4000 * depth, 500) : 18000;
        a.lp.frequency.setTargetAtTime(lpFreq, now, 0.15);
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
                value={`${waveAmp.toFixed(2)}m`}
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
                value={`${waveSpeed.toFixed(2)}×`}
                onDec={() => setWaveSpeed((v) => Math.max(0, +(v - 0.1).toFixed(2)))}
                onInc={() => setWaveSpeed((v) => Math.min(3, +(v + 0.1).toFixed(2)))}
              />
              <PadDial
                label="HÖJD"
                value={`${heightOffset >= 0 ? "+" : ""}${heightOffset.toFixed(2)}m`}
                onDec={() => setHeightOffset((v) => Math.max(-5, +(v - 0.2).toFixed(2)))}
                onInc={() => setHeightOffset((v) => Math.min(5, +(v + 0.2).toFixed(2)))}
              />
              <PadDial
                label="GUPP"
                value={`${buoyAmp.toFixed(2)}×`}
                onDec={() => setBuoyAmp((v) => Math.max(0, +(v - 0.1).toFixed(2)))}
                onInc={() => setBuoyAmp((v) => Math.min(4, +(v + 0.1).toFixed(2)))}
              />
              <PadDial
                label="GUPP TEMPO"
                value={`${bobSpeed.toFixed(2)}×`}
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
                value={`${regularPeriod.toFixed(2)}x`}
                onDec={() => setRegularPeriod((v) => Math.max(0.3, +(v - 0.1).toFixed(2)))}
                onInc={() => setRegularPeriod((v) => Math.min(4, +(v + 0.1).toFixed(2)))}
              />
            </div>
          </div>
        </div>
      )}

      {/* Movement joystick (left) */}
      <Joystick
        onChange={setStick}
        value={stick}
        label="NAV"
        positionClass="bottom-6 left-6"
      />

      {/* Look / rotation joystick (right of movement) */}
      <Joystick
        onChange={setRotStick}
        value={rotStick}
        label="LOOK"
        positionClass="bottom-6 left-44"
      />

      {/* Wave-follow joystick (far right) */}
      <Joystick
        onChange={setFollowStick}
        value={followStick}
        label="VÅG-FÖLJ"
        positionClass="bottom-6 right-6"
      />
    </main>
  );
}

function PadDial({
  label,
  value,
  onDec,
  onInc,
}: {
  label: string;
  value: string;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-white/15 bg-black/40 p-1 pl-3 backdrop-blur-md">
      <div className="flex min-w-[86px] flex-col items-start leading-tight text-white">
        <span className="text-[9px] font-light tracking-[0.28em] text-white/60">
          {label}
        </span>
        <span className="text-xs font-medium tracking-wider">{value}</span>
      </div>
      <button
        onClick={onDec}
        className="h-7 w-7 rounded-full border border-white/20 bg-white/5 text-white/90 transition active:scale-95 active:bg-white/15"
        aria-label={`${label} minska`}
      >
        −
      </button>
      <button
        onClick={onInc}
        className="h-7 w-7 rounded-full border border-white/20 bg-white/5 text-white/90 transition active:scale-95 active:bg-white/15"
        aria-label={`${label} öka`}
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
}: {
  onChange: (v: { x: number; y: number }) => void;
  value: { x: number; y: number };
  label?: string;
  positionClass?: string;
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
          onChange({ x: 0, y: 0 });
        }}
        onPointerCancel={() => {
          activeId.current = null;
          onChange({ x: 0, y: 0 });
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
