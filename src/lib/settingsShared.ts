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

// Each option's `id` is a stable, language-independent identifier — used for
// equality checks in the render loop (routes/index.tsx) and as the lookup
// key into the matching *_LABEL_KEYS map below, whose values are i18next
// keys (see src/locales/*.json) resolved via t() wherever the option's
// display name is actually shown (SettingsPanel.tsx).
export const WATER_TINTS: { id: string; rgb: [number, number, number] }[] = [
  { id: "nordic", rgb: [1, 1, 1] },
  { id: "tropical", rgb: [0.55, 1.15, 1.25] },
  { id: "caribbean", rgb: [0.6, 1.35, 1.1] },
  { id: "mediterranean", rgb: [0.8, 1.15, 1.3] },
  { id: "archipelago", rgb: [0.85, 1.0, 0.75] },
  { id: "deepSea", rgb: [0.55, 0.7, 1.15] },
];
export const WATER_TINT_LABEL_KEYS: Record<string, string> = {
  nordic: "options.waterTint.nordic",
  tropical: "options.waterTint.tropical",
  caribbean: "options.waterTint.caribbean",
  mediterranean: "options.waterTint.mediterranean",
  archipelago: "options.waterTint.archipelago",
  deepSea: "options.waterTint.deepSea",
};

export const BOTTOM_OPTIONS: { id: string; rgb: [number, number, number] | null }[] = [
  { id: "off", rgb: null },
  { id: "sand", rgb: [0.85, 0.75, 0.5] },
  { id: "lightSand", rgb: [0.95, 0.9, 0.72] },
  { id: "stone", rgb: [0.35, 0.32, 0.28] },
  { id: "coral", rgb: [0.9, 0.5, 0.45] },
  { id: "darkBottom", rgb: [0.08, 0.1, 0.12] },
  { id: "clouds", rgb: [1, 1, 1] },
  { id: "custom", rgb: [0.6, 0.55, 0.45] },
];
export const BOTTOM_LABEL_KEYS: Record<string, string> = {
  off: "options.bottom.off",
  sand: "options.bottom.sand",
  lightSand: "options.bottom.lightSand",
  stone: "options.bottom.stone",
  coral: "options.bottom.coral",
  darkBottom: "options.bottom.darkBottom",
  clouds: "options.bottom.clouds",
  custom: "options.bottom.custom",
};

export const BACKDROPS: { id: string; url: string | null }[] = [
  { id: "off", url: null },
  { id: "vanern", url: vanernBackdrop.url },
];
export const BACKDROP_LABEL_KEYS: Record<string, string> = {
  off: "options.backdrop.off",
  vanern: "options.backdrop.vanern",
};

// Surface presets for the floating torus "bath rings" field (see
// src/lib/torusRings/TorusRingField.ts) — "off" renders a flat emissive
// color with no texture map at all.
export const TORUS_RING_TEXTURES: { id: string; url: string | null }[] = [
  { id: "off", url: null },
  { id: "sand", url: sandTextureAsset.url },
];
export const TORUS_TEXTURE_LABEL_KEYS: Record<string, string> = {
  off: "options.torusTexture.off",
  sand: "options.torusTexture.sand",
};

export type SettingsTab = "vagor" | "kamera" | "vatten" | "miljo" | "ljud";
// labelKey is an i18next key (see src/locales/*.json), resolved via t() in
// SettingsPanel.tsx — kept here rather than a literal label so this stays
// the single source of truth for tab order/ids.
export const SETTINGS_TABS: { id: SettingsTab; labelKey: string }[] = [
  { id: "vagor", labelKey: "settings.tabs.vagor" },
  { id: "kamera", labelKey: "settings.tabs.kamera" },
  { id: "vatten", labelKey: "settings.tabs.vatten" },
  { id: "miljo", labelKey: "settings.tabs.miljo" },
  { id: "ljud", labelKey: "settings.tabs.ljud" },
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

// i18next key for each camera mode's display label — shared by the settings
// dial (SettingsPanel.tsx) and the interval-session HUD readout
// (routes/index.tsx), each of which resolves it via t().
export const CAMERA_MODE_LABEL_KEYS: Record<CameraMode, string> = {
  float: "camera.mode.float",
  noclip: "camera.mode.noclip",
  swing: "camera.mode.swing",
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
  gogglesIntensity: number;
  gogglesFpsCap: number;
  targetFps: number;
  resolutionScale: number;
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
    "gogglesIntensity",
    "gogglesFpsCap",
    "targetFps",
    "resolutionScale",
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
