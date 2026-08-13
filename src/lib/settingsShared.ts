import vanernBackdrop from "@/assets/vanern-backdrop.png.asset.json";
import sandTextureAsset from "@/assets/sand_cc0_512.jpg.asset.json";

// Shared between the main HUD's settings dialog (routes/index.tsx) and its
// clone rendered as the "Inställningar" app inside the virtual phone's bathOS
// shell (components/VirtualPhone.tsx / SettingsPanel.tsx) — kept in its own
// module (rather than declared in index.tsx and imported from there) so
// neither of those two files needs to import from the other.

// STRÖM/SVAJ are set by dragging a small on-screen pad, but the pad's own
// x/y only means anything relative to the camera's *current* look angle —
// camera looks elsewhere afterwards. padToWorldXZ captures that real,
// world-space vector at set-time; worldXZToPad is its inverse, used every
// frame to re-derive what the pad should visually show relative to the
// *current* look angle so the knob rotates in place to keep pointing at that
// same real direction. Both share the camera's forward/right basis for yaw.
export function padToWorldXZ(px: number, py: number, yaw: number) {
  const fwdX = -Math.sin(yaw),
    fwdZ = -Math.cos(yaw);
  const rightX = Math.cos(yaw),
    rightZ = -Math.sin(yaw);
  return { x: px * rightX + py * fwdX, z: px * rightZ + py * fwdZ };
}
export function worldXZToPad(wx: number, wz: number, yaw: number) {
  const fwdX = -Math.sin(yaw),
    fwdZ = -Math.cos(yaw);
  const rightX = Math.cos(yaw),
    rightZ = -Math.sin(yaw);
  return { x: wx * rightX + wz * rightZ, y: wx * fwdX + wz * fwdZ };
}
// World-space bearing (0-360°, 0 = world -z) for STRÖM/SVAJ's fixed real
// direction, and its inverse — lets the RIKTNING dials give a finely precise
// alternative to dragging the small on-screen pad by hand.
export function worldXZBearing(x: number, z: number) {
  return ((Math.atan2(x, z) * 180) / Math.PI + 360) % 360;
}
export function bearingToWorldXZ(deg: number, mag: number) {
  const rad = ((((deg % 360) + 360) % 360) * Math.PI) / 180;
  return { x: Math.sin(rad) * mag, z: Math.cos(rad) * mag };
}

export const WATER_TINTS: { name: string; rgb: [number, number, number] }[] = [
  { name: "Nordhav", rgb: [1, 1, 1] },
  { name: "Tropisk", rgb: [0.55, 1.15, 1.25] },
  { name: "Karibisk", rgb: [0.6, 1.35, 1.1] },
  { name: "Medelhav", rgb: [0.8, 1.15, 1.3] },
  { name: "Skärgård", rgb: [0.85, 1.0, 0.75] },
  { name: "Djuphav", rgb: [0.55, 0.7, 1.15] },
];
export const BOTTOM_OPTIONS: { name: string; rgb: [number, number, number] | null }[] = [
  { name: "AV", rgb: null },
  { name: "Sand", rgb: [0.85, 0.75, 0.5] },
  { name: "Ljus sand", rgb: [0.95, 0.9, 0.72] },
  { name: "Sten", rgb: [0.35, 0.32, 0.28] },
  { name: "Korall", rgb: [0.9, 0.5, 0.45] },
  { name: "Mörk botten", rgb: [0.08, 0.1, 0.12] },
  { name: "Moln", rgb: [1, 1, 1] },
  { name: "Anpassad", rgb: [0.6, 0.55, 0.45] },
];
export const BACKDROPS: { name: string; url: string | null }[] = [
  { name: "AV", url: null },
  { name: "Vänern", url: vanernBackdrop.url },
];

// Surface presets for the floating torus "bath rings" field (see
// src/lib/torusRings/TorusRingField.ts) — "AV" renders a flat emissive
// color with no texture map at all.
export const TORUS_RING_TEXTURES: { name: string; url: string | null }[] = [
  { name: "AV", url: null },
  { name: "Sand", url: sandTextureAsset.url },
];

export type SettingsTab = "vagor" | "kamera" | "vatten" | "miljo" | "ljud";
export const SETTINGS_TABS: { id: SettingsTab; label: string }[] = [
  { id: "vagor", label: "VÅGOR" },
  { id: "kamera", label: "KAMERA" },
  { id: "vatten", label: "VATTEN" },
  { id: "miljo", label: "MILJÖ" },
  { id: "ljud", label: "LJUD" },
];

// Three mutually-exclusive camera movement schemes:
//  - "float"  the default: buoyant, wave-riding camera (all existing behavior).
//  - "noclip" free 3D flight in any direction, ignoring the water/wave physics.
//  - "swing"  a pendulum that swings back and forth high above the water.
export type CameraMode = "float" | "noclip" | "swing";
export const CAMERA_MODES: CameraMode[] = ["float", "noclip", "swing"];
// Quick-jump starting heights for sky-swing mode: a fixed preset, or "custom"
// meaning the GUNGA POSITION Y dial is left exactly as the user set it.
export type SwingPreset = "water" | "clouds" | "custom";
export const SWING_PRESETS: SwingPreset[] = ["water", "clouds", "custom"];

// Shape of the pendulum's vertical (y) motion over one swing cycle.
// "pendulum" (default) is the physically-inspired shape: y rises at both
// ends of the arc and dips at the bottom, twice per side-to-side cycle.
// The others drive y directly off the swing clock's phase for a simpler,
// symmetric up/down motion once per cycle.
export type SwingYWaveform = "pendulum" | "sine" | "triangle" | "square";
export const SWING_Y_WAVEFORMS: SwingYWaveform[] = ["pendulum", "sine", "triangle", "square"];

// Swedish display labels for camera modes — shared by the settings dial
// (SettingsPanel.tsx) and the interval-session HUD readout (routes/index.tsx).
export const CAMERA_MODE_LABELS: Record<CameraMode, string> = {
  float: "FRI",
  noclip: "NOCLIP",
  swing: "GUNGA",
};

// An interval session automatically alternates the camera between "float"
// (FRI) and "swing" (GUNGA) every intervalDuration seconds — see the session
// driver effect in routes/index.tsx. "infinite" repeats forever; "fixed" runs
// exactly intervalCount intervals and then stops.
export type IntervalSessionType = "infinite" | "fixed";
export const INTERVAL_SESSION_TYPES: IntervalSessionType[] = ["infinite", "fixed"];

// VÅGPRESET applies a bundle of wave-only settings (VÅG/TEMPO/VÅGFORM/
// REALISTISKA VÅGOR/DÖENDE VÅG/VÅGPERIOD/SPETS/KORSVÅG) in one step — see
// WAVE_PRESETS in routes/index.tsx. "standard" is the calm FFT-hav swell
// this app now defaults to; "legacy" restores the original REGELBUNDEN
// wave's settings from before that change, for anyone who preferred it.
export type WavePresetName = "standard" | "legacy";
export const WAVE_PRESET_NAMES: WavePresetName[] = ["standard", "legacy"];

// FREKVENS bounds, shared by the HUD slider (routes/index.tsx) and the VÅGOR
// dial (SettingsPanel.tsx). A multiplier on every waveform's spatial
// wavenumbers — 1 is the wavelength each waveform was authored at, higher
// packs crests closer together. Capped at 4 because the water plane is 600m
// across with 320 segments (~1.875m between vertices), so wavenumbers beyond
// roughly 1.68 rad/m can no longer be resolved by the mesh; 4× is where the
// analytic modes' shortest swell term reaches that ceiling. The FFT modes'
// own components are faded out individually as they approach it (see
// kAliasFade in src/lib/ocean/fftOceanSpectrum.ts).
export const WAVE_FREQ_MIN = 0.25;
export const WAVE_FREQ_MAX = 4;

// Formats a duration in seconds as "m:ss" for the interval-session controls
// and HUD readout (e.g. 90 -> "1:30").
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// The full shape of the settings persisted to localStorage (routes/index.tsx)
// and — since it's exactly every field the settings dialog exposes — also
// what the save/load/export/import preset feature reads and writes (see
// src/lib/presets.ts and SettingsPanel.tsx's PresetControls).
export type Persisted = {
  waveAmp: number;
  timeOfDay: number;
  waveSpeed: number;
  waveFreq: number;
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
  turbidity: number;
  bottomIdx: number;
  leanEnabled: boolean;
  gogglesOn: boolean;
  gogglesBlur: number;
  gogglesLoop: boolean;
  regularWaves: boolean;
  realisticWaves: boolean;
  dyingWave: boolean;
  dyingWaveAmp: number;
  dyingWaveSpeed: number;
  randomizeWaves: boolean;
  wavePreset: WavePresetName;
  regularCross: boolean;
  regularPeriod: number;
  wavePeak: number;
  waveHighQuality: boolean;
  backdropIdx: number;
  wakeLock: boolean;
  camFov: number;
  camNear: number;
  camFar: number;
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
  skyCloudsOn: boolean;
  skyCloudsHeight: number;
  swayAmp: number;
  swaySpeed: number;
  swayBias: number;
  syncWaveWithSway: boolean;
  liveMode: boolean;
  sceneId: string | null;
  envId: string | null;
  envEra: string | null;
  envTime: string | null;
  surfaceId: string | null;
  reflStrength: number;
  bottomColor: string;
  sphereMaterial: boolean;
  sphereStrength: number;
  trochoid: number;
  causticsOn: boolean;
  cameraMode: CameraMode;
  noclipSpeed: number;
  swingPositionY: number;
  swingIntensity: number;
  swingXFactor: number;
  swingHeight: number;
  swingPreset: SwingPreset;
  swingYWaveform: SwingYWaveform;
  intervalSessionOn: boolean;
  intervalDuration: number;
  intervalSessionType: IntervalSessionType;
  intervalCount: number;
  intervalShowStats: boolean;
  surfaceArea: number;
  torusRingsOn: boolean;
  torusRadius: number;
  torusTube: number;
  torusScale: number;
  torusOpacity: number;
  torusTextureIdx: number;
  torusCellSize: number;
  torusVerticalSpacing: number;
  torusVerticalCount: number;
  torusViewDistance: number;
  torusFadeDistance: number;
};

// Which Persisted fields belong to each settings tab — drives the per-tab
// save/load/export/import preset controls (SettingsPanel.tsx's
// PresetControls), so a "VÅGOR-only" preset only touches wave fields, etc.
// syncWaveWithSway has no dedicated dial (its toggle lives in the virtual
// phone's remote-controller app instead) but is grouped under "vagor" since
// it's SVAJ/wave-related.
export const PRESET_TAB_FIELDS: Record<SettingsTab, (keyof Persisted)[]> = {
  vagor: [
    "waveAmp",
    "waveSpeed",
    "waveFreq",
    "heightOffset",
    "submergeAmp",
    "floatLift",
    "swayAmp",
    "swaySpeed",
    "swayBias",
    "syncWaveWithSway",
    "buoyAmp",
    "bobSpeed",
    "regularWaves",
    "realisticWaves",
    "wavePreset",
    "dyingWave",
    "dyingWaveAmp",
    "dyingWaveSpeed",
    "randomizeWaves",
    "regularCross",
    "regularPeriod",
    "wavePeak",
    "trochoid",
    "waveHighQuality",
    "waveDir",
    "vortexMode",
    "vortexOpening",
    "vortexRadius",
    "vortexSpeed",
  ],
  kamera: [
    "cameraMode",
    "noclipSpeed",
    "swingPreset",
    "swingPositionY",
    "swingIntensity",
    "swingXFactor",
    "swingHeight",
    "swingYWaveform",
    "intervalSessionOn",
    "intervalDuration",
    "intervalSessionType",
    "intervalCount",
    "intervalShowStats",
    "camOffX",
    "camOffY",
    "camOffZ",
    "camFov",
    "camNear",
    "camFar",
    "leanEnabled",
    "wakeLock",
    "gogglesOn",
    "gogglesBlur",
    "gogglesLoop",
  ],
  vatten: [
    "waterTintIdx",
    "surfaceId",
    "reflStrength",
    "sphereMaterial",
    "sphereStrength",
    "waterOpacity",
    "waterHue",
    "waterSat",
    "waterBright",
    "surfBright",
    "surfSat",
    "turbidity",
    "bottomIdx",
    "bottomColor",
    "floorDepth",
    "floorTexture",
    "depthSineOn",
    "depthSineAmp",
    "depthSineFreq",
    "hideWater",
    "causticsOn",
  ],
  miljo: [
    "timeOfDay",
    "midCloudsOn",
    "midCloudsHeight",
    "skyCloudsOn",
    "skyCloudsHeight",
    "surfaceArea",
    "sceneId",
    "envId",
    "envEra",
    "envTime",
    "backdropIdx",
    "liveMode",
    "torusRingsOn",
    "torusRadius",
    "torusTube",
    "torusScale",
    "torusOpacity",
    "torusTextureIdx",
    "torusCellSize",
    "torusVerticalSpacing",
    "torusVerticalCount",
    "torusViewDistance",
    "torusFadeDistance",
  ],
  ljud: ["audioOn", "audioVol", "audioSyncSpeed", "audioSpatial"],
};

export const PRESET_ALL_FIELDS: (keyof Persisted)[] = Object.values(PRESET_TAB_FIELDS).flat();

// Shallow-picks `keys` off `obj`, skipping any that are undefined — shared by
// the preset export (tab scope -> subset of a full snapshot) and import
// (only apply fields the target scope actually owns) paths.
export function pickFields<T extends object>(obj: T, keys: (keyof T)[]): Partial<T> {
  const out: Partial<T> = {};
  for (const k of keys) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}
