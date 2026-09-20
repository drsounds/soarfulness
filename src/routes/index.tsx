import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { CSS3DTVManager, type DeviceKind } from "@/lib/tv/CSS3DTVManager";
import { TorusRingField } from "@/lib/torusRings/TorusRingField";
import { WatercraftRig } from "@/lib/watercraft/WatercraftRig";
import type { BuildAction, SculptAction, ToolMode } from "@/lib/watercraft/types";
import { WatercraftHud } from "@/components/watercraft/WatercraftHud";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { VirtualPhone, type RemoteControllerProps } from "@/components/VirtualPhone";
import { SettingsPanel, type SettingsPanelProps } from "@/components/SettingsPanel";
import { ShareBathDialog } from "@/components/ShareBathDialog";
import { GogglesOverlay } from "@/components/GogglesOverlay";
import { TimeTravelDialog } from "@/components/TimeTravelDialog";
import { isFuturisticYear, northernHemisphereTimeOfDay, simulatedDate } from "@/lib/timeTravel";
import { PadSlider } from "@/components/PadDial";
import {
  Joystick,
  JoystickPad,
  VerticalDial,
  VerticalModeSlider,
  type VerticalMode,
} from "@/components/Joystick";
import { hsvToRgb } from "@/lib/waterTint";
import {
  padToWorldXZ,
  worldXZToPad,
  worldXZBearing,
  bearingToWorldXZ,
  WATER_COLORS,
  BOTTOM_OPTIONS,
  BACKDROPS,
  WATER_SOUNDS,
  SETTINGS_TABS,
  CAMERA_MODES,
  CAMERA_MODE_LABEL_KEYS,
  TORNADO_DIRECTION_LABEL_KEYS,
  SWING_PRESETS,
  TORUS_RING_TEXTURES,
  SWING_Y_WAVEFORMS,
  DEPTH_SINE_WAVEFORMS,
  INTERVAL_SESSION_TYPES,
  WAVE_FREQ_MIN,
  WAVE_FREQ_MAX,
  formatClock,
  PRESET_TAB_FIELDS,
  PRESET_ALL_FIELDS,
  pickFields,
  type SettingsTab,
  type CameraMode,
  type SwingPreset,
  type SwingYWaveform,
  type DepthSineWaveform,
  type IntervalSessionType,
  type WavePresetName,
  type TornadoDirection,
  type SurgeRotationMode,
  type Persisted,
} from "@/lib/settingsShared";
import {
  type PresetScope,
  type SavedPreset,
  type RuntimeState,
  type SavedState,
  buildPresetFilePayload,
  extractPresetData,
  downloadJsonFile,
  readJsonFile,
  loadSavedPresets,
  addSavedPreset,
  removeSavedPreset,
  buildStateFilePayload,
  extractStateData,
  isValidRuntimeState,
  loadSavedStates,
  addSavedState,
  removeSavedState,
} from "@/lib/presets";
import {
  encodeStateToBase62,
  buildBathUrl,
  BATH_TITLE_MAX_LENGTH,
  BATH_DESCRIPTION_MAX_LENGTH,
  type BathPayload,
} from "@/lib/shareState";
import {
  FFT_WAVE_COUNT,
  generateOceanWaveComponents,
  DYING_WAVE_COUNT,
  generateDyingWaveComponents,
  createSeededRandom,
  packOceanWaveComponents,
  sampleOceanWaveHeight,
  K_ALIAS_FADE_GLSL,
  type OceanWaveComponent,
} from "@/lib/ocean/fftOceanSpectrum";
import sandTextureAsset from "@/assets/sand_cc0_512.jpg.asset.json";
import appIconAsset from "@/assets/AppIconBlack.png.asset.json";

export const Route = createFileRoute("/")({
  component: SplashScreen,
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
        content:
          "A calming WebGL ocean where the camera drifts on the waves. Adjust swell, time of day, and wander across the sea.",
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
  // Gaussian crest-pulse strength cut hard (was 0.28) — this, not just the
  // width/exponent/trough terms below, turned out to be the dominant
  // driver of trough dominating the cycle at high SPETS. A 20k-sample
  // numeric sweep of max point-to-point slope and "fraction of the cycle
  // spent near the flat trough" guided all four constants in this
  // function together: at max SPETS the old values spent ~38-51% of the
  // cycle near the trough (vs ~25% for plain sine, reading as crests
  // implausibly far apart); these land around 32%.
  const amount = (p - 1) * 0.08;
  const wrapped = Math.atan2(Math.sin(theta - Math.PI / 2), Math.cos(theta - Math.PI / 2));
  const width = 0.72 * (1 - k) + 0.6 * k;
  const crest = Math.exp(-(wrapped * wrapped) / (2 * width * width));
  const mean = width * 0.3989;
  const base = Math.sin(theta);
  const peakBoost = Math.pow(Math.max(base, 0), 1 + 0.8 * k) - 0.3183 * k;
  // Smooth (Stokes-like) second-harmonic term: -cos(2*theta) is +k*0.01 at
  // both the crest and the trough, so it makes the crest taller *and* the
  // trough shallower/flatter at once — the asymmetric narrow-crest,
  // broad-trough look of real swells. Unlike a fractional power split on
  // the two lobes (which has an infinite derivative right at the
  // zero-crossing and put a near-vertical kink in the mesh there, visible
  // as periodic glitching across the whole ocean), this is a pure trig
  // term: smooth everywhere, no kinks, safe at any SPETS value.
  const stokes = -Math.cos(2 * theta) * k * 0.01;
  return (
    (base + stokes + amount * (crest - mean) + k * 0.55 * peakBoost) /
    (1 + amount * 0.28 + k * 0.35 + k * 0.01)
  );
}

// DEPTH SINE's "sawtooth" waveform option: unlike shapedWave()'s symmetric
// rise/fall, this climbs smoothly for most of the cycle and then drops
// steeply right after the peak. Reuses the same "peak" sharpness dial as
// shapedWave() (SPETS) to control how much of the cycle the fall eats up —
// 1 gives a gentle ~35% fall, 6 crams it into a near-vertical ~6%.
function sawtoothWave(theta: number, p: number) {
  const twoPi = Math.PI * 2;
  let frac = (theta % twoPi) / twoPi;
  if (frac < 0) frac += 1;
  const k = Math.min(1, Math.max(0, (p - 1) / 5));
  const fallFrac = 0.35 * (1 - k) + 0.06 * k;
  const riseFrac = 1 - fallFrac;
  if (frac < riseFrac) {
    const u = frac / riseFrac;
    return -Math.cos(u * Math.PI);
  }
  const u = (frac - riseFrac) / fallFrac;
  return 1 - 2 * u;
}

// HEAVE SKEW: warps a *temporal* phase (t*speed [+ a fixed per-term offset],
// never anything that also depends on x/z) so it advances faster through the
// rising half of its cycle and slower through the falling half — a fixed
// point on the water then rises quickly to a peak and sinks back slowly,
// instead of the perfectly symmetric rise/fall a plain sine gives. This is
// intentionally applied to the temporal argument alone, *before* it's added
// to any spatial phase term: warping the combined spatiotemporal phase
// (like shapedWave()/shp()'s SPETS shaping does deliberately, for a
// different reason) would reintroduce exactly the near-vertical, phase-
// bunched mesh faces the comment on shapedWave() above warns a *previous*
// phase warp caused — because at a fixed instant, the wave's shape across
// space would then no longer be a clean, evenly-sampled sine. Warping only
// the time-dependent term keeps every spatial snapshot undistorted (the
// warp is just a constant offset from x/z's point of view) while still
// reshaping how a stationary point's height changes *over time* — exactly
// what camera heave feels. Clamped below 1 to avoid the phase going
// non-monotonic (which would fold the waveform back on itself).
function warpPhase(phase: number, skew: number): number {
  if (skew <= 0.001) return phase;
  return phase + Math.min(0.9, Math.max(0, skew)) * Math.sin(phase);
}

// Gerstner-like sum of sines. Keep in sync with vertex shader.
// `realistic` swaps in the JONSWAP/FFT-ocean waveform (see
// src/lib/ocean/fftOceanSpectrum.ts) so the camera floats correctly on it
// too; `realisticComponents` is the fixed component set generated once per
// mount that both this and the vertex shader's fftHeight() sample from.
// `dying` layers the long, decaying-swell waveform on top (same idea as
// `realistic`, its own fixed component set and independent time base
// `dyingT` so DÖD VÅG TEMPO can run at its own speed) — takes precedence
// over `realistic` when both are on, matching the vertex shader's mix
// order (uDying is applied after uFft).
// `freq` is FREKVENS: a multiplier on every mode's spatial wavenumbers (and
// only those), so raising it packs more, shorter crests into the same stretch
// of water while each still passes a fixed point at the rate TEMPO sets. It
// is the one dial that reaches every waveform — VÅGPERIOD only ever scaled
// REGELBUNDEN/VIRVEL, and SPRIDD and the two FFT modes had no wavelength
// control at all. Applied on top of VÅGPERIOD where both apply.
function waveHeight(
  x: number,
  z: number,
  t: number,
  amp: number,
  regular: boolean,
  cross: boolean,
  period: number = 1,
  peak: number = 1,
  dir: number = 0,
  realistic: boolean = false,
  realisticComponents: OceanWaveComponent[] | null = null,
  dying: boolean = false,
  dyingComponents: OceanWaveComponent[] | null = null,
  dyingAmp: number = 0,
  dyingT: number = 0,
  freq: number = 1,
  skew: number = 0,
) {
  // Use compass-bearing convention (matches bearingToWorldXZ / the dial:
  // 0deg = world +z, 90deg = world +x) rather than the math-angle
  // convention, so the wave actually travels the direction the dial shows.
  // Negated: every phase term below is xr*k + t*speed (positive time
  // coefficient), and for sin(k*x + w*t) the crest position (const-w*t)/k
  // *decreases* as t grows — i.e. crests travel toward -xr, not +xr. Without
  // the negation the wave would visibly travel exactly opposite the bearing
  // the dial (and the linked SVAJ push) claim.
  const c = -Math.sin(dir),
    s = -Math.cos(dir);
  const xr = c * x + s * z;
  const zr = -s * x + c * z;
  if (dying && dyingComponents) {
    return sampleOceanWaveHeight(dyingComponents, xr, zr, dyingT, freq) * dyingAmp;
  }
  if (realistic && realisticComponents) {
    return sampleOceanWaveHeight(realisticComponents, xr, zr, t, freq) * amp;
  }
  if (regular) {
    const kx = (0.12 * freq) / period;
    const kz = (0.09 * freq) / period;
    const rx = shapedWave(xr * kx + warpPhase(t * 0.9, skew), peak) * 2.6 * amp;
    const rz = cross ? shapedWave(zr * kz + warpPhase(t * 0.7 + 1.1, skew), peak) * 1.4 * amp : 0;
    return rx + rz;
  }
  const w1 = shapedWave(xr * 0.12 * freq + warpPhase(t * 0.9, skew), peak) * 1.0;
  const w2 = shapedWave(zr * 0.17 * freq + warpPhase(t * 0.7 + 1.3, skew), peak) * 0.75;
  const w3 =
    shapedWave((xr * 0.22 + zr * 0.19) * freq + warpPhase(t * 1.4 + 2.1, skew), peak) * 0.5;
  const w4 =
    shapedWave((xr * 0.31 - zr * 0.11) * freq + warpPhase(t * 1.8 + 0.4, skew), peak) * 0.35;
  return (w1 + w2 + w3 + w4) * amp;
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const v = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return v * v * (3 - 2 * v);
}

// Pure radial sine surface used for the water whirlpool that opens up while
// swinging with TORNADO on. Keep in sync with the shader's vortex block so
// the camera rides the same even wave that is rendered. x/z are relative to
// the tornado/whirlpool's own center (the swing anchor — see the
// cameraMode==="swing" branch of the physics loop).
function whirlpoolSurfaceHeight(
  x: number,
  z: number,
  t: number,
  amp: number,
  period: number,
  opening: number,
  freq: number = 1,
) {
  const op = Math.max(1, opening);
  const r = Math.hypot(x, z);
  const g = Math.exp(-(r * r) / (op * op));
  const pit = -op * 1.6 * g;
  const stableFade = 1 - smoothstep(220, 520, r);
  const kR = (0.12 * freq) / period;
  const phase = r * kR - t * 0.9;
  const ring = Math.sin(phase) * 2.6 * amp * stableFade * (1 - g * 0.85);
  return pit + ring;
}

// Normalized (roughly -1..1, peaking at exactly 1) vertical drive for GUNGA-
// mode's pendulum, evaluated once per frame from the swing's own angle
// (theta, radians — the horizontal arc's instantaneous deflection), phase
// (t*omega, radians — the swing clock, unwrapped), and thetaMax (theta's own
// peak deflection this frame, i.e. GUNGA INTENSITET's current arc width —
// see swingAmpRadNow in the physics loop). "pendulum" is the physically-
// inspired default: y rises at both ends of the arc and dips at the bottom,
// twice per side-to-side cycle, and is always >= 0. The other shapes drive y
// directly off the swing clock's phase instead, for a simpler symmetric
// up/down motion (able to dip below GUNGA POSITION Y) once per cycle.
function swingYWaveformValue(
  kind: SwingYWaveform,
  theta: number,
  phase: number,
  thetaMax: number,
): number {
  switch (kind) {
    case "sine":
      return Math.sin(phase);
    case "triangle": {
      const x = (((phase / (2 * Math.PI)) % 1) + 1) % 1;
      return x < 0.25 ? x * 4 : x < 0.75 ? 2 - x * 4 : x * 4 - 4;
    }
    case "square":
      return Math.sin(phase) >= 0 ? 1 : -1;
    case "pendulum":
    default: {
      // Divide out thetaMax's own contribution so this always peaks at
      // exactly 1, same as every other waveform above, regardless of how
      // wide GUNGA INTENSITET happens to be swinging the arc this frame —
      // otherwise a faster/wider swing (higher intensity) would also read
      // as a taller one even with GUNGA HÖJD left untouched, coupling the
      // SPEED and HEIGHT dials together instead of keeping them independent.
      const peak = Math.max(1e-9, 1 - Math.cos(thetaMax));
      return (1 - Math.cos(theta)) / peak;
    }
  }
}

// Original PlaneGeometry extents the water/cloud meshes are built at; the
// live YTA (surface area) setting rescales each mesh by surfaceArea/base so
// the *resulting* on-screen size matches the dial regardless of how finely
// each mesh happens to be subdivided.
//
// The ocean mesh is split into two tiers instead of one scaled plane: a
// small, finely-tessellated OCEAN_BASE_SIZE square that always stays at
// scale 1 (so its ~3.75-unit vertex spacing keeps resolving the wave's
// shortest ~20-unit wavelength), and a coarse ring around it — reusing the
// same material — whose outer radius RUMSSTORLEK/surfaceArea controls, to
// push the horizon edge out. Stretching a single low-segment plane to reach
// a huge surfaceArea (as this used to do) also stretches its vertex
// spacing by the same factor: at the default 150,000m surfaceArea that was
// ~470 world units between adjacent vertices, so the wave phase (evaluated
// per-vertex in world space) was sampled far below its own Nyquist rate —
// aliasing the whole visible surface into flat, blocky facets instead of
// smooth waves.
//
// The ring's inner radius is fixed at OCEAN_FAR_INNER_RADIUS (not scaled
// with surfaceArea, unlike the old single-plane approach) so it can't
// shrink inside the near tier's own still-wavy area — it only ever starts
// where the near tier's amplitude has already faded to exactly 0 (see
// ampFade in the vertex shader), so the ring can stay coarse and flat
// without a seam or clipping through a wave trough/crest. Half of
// OCEAN_BASE_SIZE reaches every straight edge of the near tier with no
// gap; the ring only overlaps the near tier in its four diagonal corners
// (out to OCEAN_BASE_SIZE/√2), comfortably past the ~500-unit farthest
// possible ampFade radius (vortex mode's), so that overlap is always
// zero-amplitude on both sides and harmless.
const OCEAN_BASE_SIZE = 1200;
const OCEAN_FAR_INNER_RADIUS = OCEAN_BASE_SIZE / 2;
const CLOUD_BASE_SIZE = 200000;

// TORNADO CLOUD's shape, relative to whichever tornado mode's own radius is
// currently active (tornadoCloudX/Y/Z/Radius/Angle in the physics loop):
// the wide top sits a bit outside the actual orbit (so the orbiting camera
// grazes/enters its wall rather than always staying outside it) and the
// narrow tip is a small fraction of that, never a literal zero-width point.
const TORNADO_CLOUD_TOP_SCALE = 1.15;
const TORNADO_CLOUD_TIP_RATIO = 0.1;
// Vertical extent as a multiple of the radius — tall and narrow, like a real
// funnel cloud, rather than a squat cone.
const TORNADO_CLOUD_HEIGHT_SCALE = 2.2;

// Perf-diagnostic kill switch for the DATE & TIME TRAVEL feature (its
// once-a-minute tick effect and the clock button/dialog in the HUD).
// It was previously suspected of contributing to reported lag, but the
// component has since had its own known perf issues fixed (60s tick,
// memoized label, dialog unmounted while closed) and the unrelated
// "live viewer count/likes" ticker re-renders were the more likely cause.
// RE-ENABLED (false) for a fresh trial now that other perf fixes have
// landed. If it turns out to still cause lag on a real device, flip this
// back to true — that alone fully disables it again, no other changes
// needed.
const CLOCK_DISABLED_FOR_PERF_TEST = false;

// VÄRLDSGRÄNS (world boundary): wraps `value` back into [-half, half) once it
// crosses either edge, teleporting to the opposite side instead of just
// clamping — e.g. crossing +half re-enters at -half plus whatever the camera
// overshot by, so a fast pass through the boundary never loses momentum.
// Used for x/z always, and for y whenever worldBoundaryYExtend is off (see
// the animate() loop below) or the seamless extension is on but the camera
// still somehow overshoots several boundary-widths in one frame.
function wrapAxis(value: number, half: number): number {
  if (!(half > 0)) return value;
  const period = half * 2;
  return ((((value + half) % period) + period) % period) - half;
}

// VÄRLDSGRÄNS's y-extension: rather than a hard wrap, more instances of the
// same sky-cloud layer (see EXTEND_CLOUD_LAYER_COUNT below, and the skyClouds
// setup + animate() loop) tile every EXTEND_CLOUD_LAYER_SPACING meters of
// altitude around wherever the camera currently is, so climbing or diving
// forever always has another cloud deck coming up — the wrap at
// ±worldBoundaryHeight becomes invisible since every altitude already looks
// the same as any other. cloudLayerJitter gives each altitude band's layer a
// small, deterministic (same index -> same offset every time) horizontal
// offset so passing through many bands doesn't read as the exact same cloud
// pattern repeating in place — same trick as hashing in the wave/noise code
// above, just used to pick a *position* instead of a value.
const EXTEND_CLOUD_LAYER_SPACING = 500;
const EXTEND_CLOUD_LAYER_COUNT = 5;
// Display order for the top camera mode toggle's tab buttons — independent
// of CAMERA_MODES' own order (which cycleCameraMode/the KAMERA settings
// dial still cycle through), so the three tabs can read left-to-right as
// SIMMARE/GUNGA/FLYG regardless of how CAMERA_MODES itself is ordered.
const CAMERA_MODE_TAB_ORDER: CameraMode[] = ["float", "swing", "noclip"];
// SKY PUFFS: a pool of this many puff meshes is always created (cheap —
// shared geometry, one small cloned material each); SKY PUFFS COUNT just
// controls how many of them animate() keeps active, so raising/lowering the
// dial never adds/removes actual scene objects.
const MAX_SKY_PUFFS = 20;
// Seconds for one puff's fade-in/hold/fade-out/respawn cycle at SKY PUFFS Y
// FREQUENCY = 1; the dial divides this down, so higher = more frequent.
const SKY_PUFF_BASE_CYCLE = 45;

// Picks a fresh spot for a sky puff to fade in at: a random bearing/distance
// from wherever the camera currently is (so puffs keep appearing somewhere
// visible even as the camera roams) and a random altitude within a fixed
// band, plus a random noise seed so no two puffs look identical.
function randomSkyPuffSpot(camX: number, camZ: number) {
  const angle = Math.random() * Math.PI * 2;
  const radius = 700 + Math.random() * 1800;
  return {
    x: camX + Math.cos(angle) * radius,
    z: camZ + Math.sin(angle) * radius,
    y: 220 + Math.random() * 700,
    seed: Math.random() * 1000,
  };
}

function cloudLayerJitter(layerIndex: number): { x: number; z: number } {
  const s1 = Math.sin(layerIndex * 12.9898) * 43758.5453;
  const s2 = Math.sin(layerIndex * 78.233) * 12543.231;
  return {
    x: (s1 - Math.floor(s1) - 0.5) * 8000,
    z: (s2 - Math.floor(s2) - 0.5) * 8000,
  };
}

// Builds the far ocean ring at the given RUMSSTORLEK/surfaceArea outer
// extent — see OCEAN_FAR_INNER_RADIUS above for why this is a ring (fixed
// inner radius) rebuilt on change, not a plane scaled from origin.
function buildFarOceanGeometry(surfaceArea: number) {
  const outerRadius = Math.max(OCEAN_FAR_INNER_RADIUS + 1, surfaceArea / 2);
  const geo = new THREE.RingGeometry(OCEAN_FAR_INNER_RADIUS, outerRadius, 64, 1);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

// SLUMPA VÅGOR off (default): the FFT wave modes (REALISTISKA VÅGOR/DÖENDE
// VÅG) are generated from these fixed seeds instead of Math.random(), so the
// component set — and the exact wave shape/heave rhythm it produces — is the
// same every load rather than reshuffling each time. Two distinct seeds so
// the two generators don't happen to draw the same sequence of values.
const FFT_WAVE_SEED = 20260108;
const DYING_WAVE_SEED = 19700101;

// Exported so routes/bathing.$payload.tsx can seed the same localStorage
// keys with a decoded shared-link state before this route's own component
// (which reads them once at mount via loadSettings/loadCameraPose below)
// ever renders.
export const STORAGE_KEY = "aquafulness:settings:v1";
// Parse a "#rrggbb" hex string into normalized [0,1] RGB. Falls back to a
// neutral sand tone on malformed input rather than throwing.
function hexToRgbNorm(hex: string): [number, number, number] {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return [0.6, 0.55, 0.45];
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// A loadable scene lives in public/scenes/<id>/<id>.glb (or <id>.gltf, for
// scenes exported with external .bin/texture files instead of a single
// binary blob) with an optional public/scenes/<id>/manifest.json describing
// where/how to place it. The list of available scenes and their display
// names comes from public/scenes/scenes.json.
type SceneEntry = { id: string; name: string };
// One named player start point, listed under a scene manifest's "locations"
// (or "places" — either key is accepted) array. yaw is in radians, matching
// yawRef; omitted fields default to 0.
type RawSpawnLocation = {
  id?: string;
  name?: string;
  x?: number;
  y?: number;
  z?: number;
  yaw?: number;
};
export type SpawnLocation = {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
};
type SceneManifest = {
  name?: string;
  // World placement of the loaded model. rotation is in degrees.
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  // Optional bobbing. Omitted / false → the model stays perfectly static.
  //   true                         → floats on the waves (follow, amp 1)
  //   { follow: true, amp }        → rides the wave surface at its position
  //   { follow: false, amp, speed} → simple vertical sine bob
  bob?: boolean | { follow?: boolean; amp?: number; speed?: number };
  // Named respawn points for this scene — the "Locations"/"Places" list the
  // respawn button's picker cycles through. Either key is accepted so scene
  // authors can use whichever reads better.
  locations?: RawSpawnLocation[];
  places?: RawSpawnLocation[];
};

// Fixed world position of the "watercraft" camera mode's raft — see the
// cameraMode==="watercraft" wiring in the render loop and mode-switch effect
// below, and WatercraftRig in src/lib/watercraft/. A little off from world
// origin (DEFAULT_SPAWN_LOCATION below) so it's visible in the distance from
// the default spawn in "float" mode, without sitting exactly on top of it.
const WATERCRAFT_RAFT_X = 0;
const WATERCRAFT_RAFT_Z = -30;

// Respawn falls back to this single "Spawn" point at world origin whenever a
// scene has no manifest, or its manifest lists no locations/places.
const DEFAULT_SPAWN_LOCATION: SpawnLocation = {
  id: "spawn",
  name: "Spawn",
  x: 0,
  y: 0,
  z: 0,
  yaw: 0,
};

function resolveSpawnLocations(manifest: SceneManifest | null | undefined): SpawnLocation[] {
  const raw = manifest?.locations ?? manifest?.places ?? [];
  const resolved = raw
    .map((loc, i) => {
      const name = loc.name?.trim() || `${DEFAULT_SPAWN_LOCATION.name} ${i + 1}`;
      return {
        id: loc.id?.trim() || name,
        name,
        x: loc.x ?? 0,
        y: loc.y ?? 0,
        z: loc.z ?? 0,
        yaw: loc.yaw ?? 0,
      };
    })
    .filter((loc) => loc.id.length > 0);
  return resolved.length > 0 ? resolved : [DEFAULT_SPAWN_LOCATION];
}

// Resolved bob settings the animation loop consumes; null means static.
type BobConfig = { follow: boolean; amp: number; speed: number };
function resolveBob(bob: SceneManifest["bob"]): BobConfig | null {
  if (!bob) return null;
  if (bob === true) return { follow: true, amp: 1, speed: 1 };
  return {
    follow: bob.follow ?? true,
    amp: bob.amp ?? 1,
    speed: bob.speed ?? 1,
  };
}

// Apply a scene manifest's transform to a loaded model root.
function applyManifest(obj: THREE.Object3D, m: SceneManifest) {
  const d2r = (d: number) => (d * Math.PI) / 180;
  const p = m.position ?? [0, 0, 0];
  obj.position.set(p[0] ?? 0, p[1] ?? 0, p[2] ?? 0);
  const r = m.rotation ?? [0, 0, 0];
  obj.rotation.set(d2r(r[0] ?? 0), d2r(r[1] ?? 0), d2r(r[2] ?? 0));
  const s = m.scale ?? 1;
  if (Array.isArray(s)) obj.scale.set(s[0] ?? 1, s[1] ?? 1, s[2] ?? 1);
  else obj.scale.setScalar(s);
}

// Free all GPU resources held by a loaded model subtree.
function disposeObject(obj: THREE.Object3D) {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (!mat) return;
    const mats = Array.isArray(mat) ? mat : [mat];
    for (const m of mats) {
      for (const key of Object.keys(m) as (keyof THREE.Material)[]) {
        const val = (m as unknown as Record<string, unknown>)[key];
        if (val instanceof THREE.Texture) val.dispose();
      }
      m.dispose();
    }
  });
}

// A real (3D) skybox environment lives under
//   public/environments/<env>/<era>/<time>/skybox.png  (+ manifest.json)
// and the tree of available environments/eras/times comes from
// public/environments/environment.json. The skybox is rendered as the scene's
// equirectangular background so it responds correctly to camera rotation,
// unlike the flat DOM backdrop which stays fixed on screen.
type EnvTime = { id: string; name: string };
type EnvEra = { id: string; name: string; times: EnvTime[] };
type EnvironmentEntry = { id: string; name: string; eras: EnvEra[] };
type EnvManifest = {
  name?: string;
  // If set, the water/lighting palette snaps to this time-of-day (0..1).
  timeOfDay?: number;
  // Horizontal rotation of the panorama, in degrees, to align the sun/horizon.
  rotationY?: number;
  // Skybox image filename within the leaf folder (defaults to skybox.png).
  image?: string;
};

// Parse the loosely-typed environment.json into a validated tree.
function parseEnvironments(data: unknown): EnvironmentEntry[] {
  const rawList = Array.isArray(data)
    ? data
    : ((data as { environments?: unknown }).environments ?? []);
  if (!Array.isArray(rawList)) return [];
  const str = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);
  return rawList
    .map((e) => {
      const env = e as { id?: unknown; name?: unknown; eras?: unknown };
      if (typeof env.id !== "string") return null;
      const eras = (Array.isArray(env.eras) ? env.eras : [])
        .map((er) => {
          const era = er as { id?: unknown; name?: unknown; times?: unknown };
          if (typeof era.id !== "string") return null;
          const times = (Array.isArray(era.times) ? era.times : [])
            .map((tm) => {
              const time = tm as { id?: unknown; name?: unknown };
              return typeof time.id === "string"
                ? { id: time.id, name: str(time.name, time.id) }
                : null;
            })
            .filter((t): t is EnvTime => t !== null);
          return times.length ? { id: era.id, name: str(era.name, era.id), times } : null;
        })
        .filter((er): er is EnvEra => er !== null);
      return eras.length ? { id: env.id, name: str(env.name, env.id), eras } : null;
    })
    .filter((e): e is EnvironmentEntry => e !== null);
}

// A water-surface reflection preset lives at
//   public/surfaces/<id>/surface.png  (+ manifest.json)
// and the list comes from public/surfaces/surfaces.json. The photo is sampled
// along the reflection vector to fake a richer environment reflection than the
// flat horizon→sky gradient.
type SurfaceEntry = { id: string; name: string };
type SurfaceManifest = {
  name?: string;
  // How strongly the photo replaces the gradient reflection (0..1, default 0.6).
  strength?: number;
  // Surface image filename within the folder (defaults to surface.png).
  image?: string;
};

// VÅGPRESET bundles — everything the wave-only preset selector applies in
// one step. "standard" is this app's current default; "legacy" restores the
// exact wave settings from before that change (tall, fast REGELBUNDEN
// waves, crossed) for anyone who preferred the original feel.
//
// applyWavePreset() re-derives every field below straight from this object
// on every WAVE PRESET dial click, so "standard" — the default, active on
// every fresh load — must exactly match DEFAULTS' own real values for any
// field that also has its own independent, dedicated toggle elsewhere
// (REALISTIC WAVES, CROSS WAVE, ...): otherwise simply touching the dial
// silently fights whatever the user set that toggle to, no matter which
// preset they land on. Already bitten twice — realisticWaves (a "standard"
// bundled with it true would re-enable the expensive FFT wave simulation:
// a 32-term sum per vertex, up to 6x per fragment for caustics) and
// regularCross — so "standard" keeps both off, matching DEFAULTS exactly.
// "legacy" intentionally differs on both (see its own historical-snapshot
// purpose above) since selecting it is itself a deliberate, explicit choice
// — that's not the same failure mode as the default preset drifting from
// the default settings. DÖENDE VÅG (dying wave) is a newer, separate
// overlay and defaults off in both presets — turn it on explicitly to layer
// a long, slow, dying swell on top of whichever base preset is active.
const WAVE_PRESETS: Record<
  WavePresetName,
  Pick<
    Persisted,
    | "waveAmp"
    | "waveSpeed"
    | "waveFreq"
    | "regularWaves"
    | "realisticWaves"
    | "dyingWave"
    | "dyingWaveAmp"
    | "dyingWaveSpeed"
    | "regularCross"
    | "regularPeriod"
    | "wavePeak"
  >
> = {
  standard: {
    waveAmp: 0.5,
    waveSpeed: 2.8,
    waveFreq: 1,
    regularWaves: true,
    realisticWaves: false,
    dyingWave: false,
    dyingWaveAmp: 1.2,
    dyingWaveSpeed: 0.6,
    regularCross: false,
    regularPeriod: 1,
    wavePeak: 1,
  },
  legacy: {
    waveAmp: 2.0,
    waveSpeed: 5,
    waveFreq: 1,
    regularWaves: true,
    realisticWaves: false,
    dyingWave: false,
    dyingWaveAmp: 1.2,
    dyingWaveSpeed: 0.6,
    regularCross: true,
    regularPeriod: 1,
    wavePeak: 1,
  },
};

const DEFAULTS: Persisted = {
  ...WAVE_PRESETS.standard,
  wavePreset: "standard",
  // Overrides on top of the "standard" wave preset — the app's default
  // initial state (see aquafulness-state export) tunes these away from that
  // preset's own values.
  waveAmp: 2.94,
  waveSpeed: 5.21,
  waveFreq: 0.51,
  // Off by default: the FFT wave modes stay the same fixed shape every load
  // (see FFT_WAVE_SEED/DYING_WAVE_SEED above) rather than reshuffling.
  randomizeWaves: false,
  timeOfDay: 0.5,
  bobSpeed: 2.8,
  buoyAmp: 2.8,
  heightOffset: 0,
  submergeAmp: 0,
  floatLift: 0,
  waveAnticipation: 1,
  camOffX: 0,
  camOffY: -0.1,
  camOffZ: 0,
  audioOn: true,
  audioVol: 0.8,
  audioSyncSpeed: false,
  audioSpatial: false,
  waterSoundIdx: 2,
  waterColorIdx: 4,
  waterOpacity: 0.5,
  waterColorAlpha: 0,
  waterHue: 0,
  waterSat: 0.95,
  waterBright: 1,
  surfBright: 1,
  surfSat: 1,
  turbidity: 0,
  bottomIdx: 0,
  leanEnabled: false,
  // Off by default: an optional "swimming goggles" overlay — static water
  // droplets on the lens, plus an optional whole-screen blur (0 = none).
  gogglesOn: false,
  gogglesBlur: 0,
  // On by default: droplets just keep falling and wrap from the top for an
  // unbroken continuous stream, rather than fading out approaching the
  // waterline and recycling above it.
  gogglesLoop: true,
  // Maps to a droplet count via GogglesOverlay's MIN_DROPLETS/MAX_DROPLETS —
  // 0.5 lands on 22, this effect's original fixed count.
  gogglesIntensity: 0.5,
  // Caps the main render loop's renderer.render() calls (and the droplet
  // overlay's own update loop) to this many fps while SIMGLASÖGON is on —
  // a lower, movie-like frame rate trades a bit of motion smoothness for
  // meaningfully less GPU/thermal load during the effect. Has no effect at
  // all while SIMGLASÖGON is off.
  gogglesFpsCap: 25,
  // General performance controls, independent of SIMGLASÖGON: targetFps caps
  // renderer.render() calls at all times (not just while goggles are on —
  // see the fpsCap logic in the animate() loop below), and resolutionScale
  // multiplies the renderer's pixel ratio to trade sharpness for GPU load.
  // Both default to a conservative preset since this scene is expensive
  // (FFT ocean, reflections, torus rings) and many devices can't sustain a
  // full-resolution 60fps render.
  targetFps: 40,
  resolutionScale: 0.5,
  // Off by default: see lowGraphicsMode's doc comment in settingsShared.ts.
  lowGraphicsMode: false,
  // Off by default like every other optional shading extra below (caustics,
  // chromatic aberration, torus rings, mid clouds) — this fbm-based
  // micro-chop + foam layer runs two 3-octave noise samples plus another for
  // foam, all per fragment, over the entire visible ocean surface. Real,
  // always-on GPU cost that had been the one exception to this file's
  // otherwise consistent "expensive extras stay opt-in" default policy.
  waveHighQuality: false,
  backdropIdx: 0,
  wakeLock: true,
  camFov: 77,
  camNear: 5,
  camFar: 100000,
  waveDir: 182.51523652581446,
  floorDepth: 28,
  floorTexture: true,
  floorCloudsAnimated: false,
  depthSineOn: false,
  depthSineAmp: 2,
  depthSineFreq: 0.2,
  depthSineSpeed: 1,
  depthSineInterval: 1,
  depthSinePeak: 1,
  depthSineWaveform: "sine",
  depthDriftSpeed: 0,
  hideWater: false,
  midCloudsOn: false,
  midCloudsHeight: 0.5,
  skyCloudsOn: true,
  skyCloudsHeight: 0.4,
  cloudFadeSpeed: 3,
  skyPuffsOn: false,
  skyPuffsCount: 6,
  skyPuffsSize: 600,
  skyPuffsFreq: 1,
  skyPuffsOpacity: 0.85,
  swayAmp: 0,
  swaySpeed: 0.15,
  swayBias: 0,
  // Default on: dragging/dialing SVAJ RIKTNING also steers VÅGRIKTNING to
  // match, so the waves read as the cause of the sway instead of two
  // independently-aimed controls.
  syncWaveWithSway: true,
  // SURGE off by default (0 amplitude) so it's an opt-in current on top of
  // the existing HEAVE-locked SVAJ, not a replacement for it.
  surgeAmp: 0,
  surgeSpeed: 0.2,
  surgeRotationMode: "off",
  surgeRotationSpeed: 2,
  // On by default, generous enough (20km horizontally, 3km up/down) that
  // normal float-mode swimming near origin never brushes it — mainly meant
  // to be discovered by flying far in NOCLIP. worldBoundaryYExtend on means
  // the y edge is masked by extra cloud layers (see EXTEND_CLOUD_LAYER_*)
  // rather than an abrupt wrap.
  worldBoundaryOn: true,
  worldBoundarySize: 20000,
  worldBoundaryHeight: 3000,
  worldBoundaryYExtend: true,
  liveMode: false,
  sceneId: "Strandpark2",
  spawnLocationId: null,
  envId: "strandpark",
  envEra: "present",
  envTime: "day",
  timeTravelBaseMs: null,
  timeTravelSetAtMs: null,
  timeSeasonalSync: false,
  clockOn: true,
  surfaceId: null,
  reflStrength: 1,
  bottomColor: "#8a7550",
  sphereMaterial: false,
  sphereStrength: 0.7,
  trochoid: 0,
  heaveSkew: 0,
  // Off by default: swaps the flat sine-noise "fake" caustic for a real
  // Snell's-law refraction + ray-density caustic driven by the actual FFT
  // wave field (see uCausticsOn in the ocean/floor shaders), and lets the
  // water body's color reveal the true seafloor tint at shallow refraction
  // angles instead of the fixed deep/shallow gradient. Costs extra
  // per-fragment cos() evaluations, so it stays opt-in.
  causticsOn: false,
  // Off by default: a full-screen post-process lens effect (red/blue channels
  // sampled offset radially from center, growing toward the edges) — see
  // CHROMATIC_ABERRATION_SHADER above. chromaticAberrationAmount is the
  // dial's 0..1 value (shown as a %), independent of whether the effect is on.
  chromaticAberrationOn: false,
  chromaticAberrationAmount: 0.3,
  cameraMode: "float",
  noclipSpeed: 1,
  noclipFallRiseSpeed: 48,
  noclipVertEaseTime: 0.7,
  swingPositionY: 25,
  swingIntensity: 0.3,
  swingXFactor: 0,
  swingHeight: 20000,
  swingPreset: "water",
  swingYWaveform: "pendulum",
  // Unified TORNADO toggle for GUNGA (swing) and flying (noclip/watercraft):
  // off by default (plain pendulum arc / plain free flight).
  tornadoOn: false,
  tornadoRadius: 40,
  tornadoSpeed: 1,
  tornadoDirection: "cw",
  tornadoOpening: 14,
  // On by default: camera eases toward staring at the tornado/whirlpool
  // center (like the old standalone VIRVEL mode always did) instead of
  // keeping whatever forward direction NAV/LOOK has it facing.
  tornadoFollowCenter: true,
  // TORNADO CLOUD: off by default — purely cosmetic.
  tornadoCloudOn: false,
  tornadoCloudYOffset: 0,
  // Interval session off by default; a 30s FRI/GUNGA alternation running
  // forever once turned on, until switched to a fixed number of intervals.
  intervalSessionOn: false,
  intervalDuration: 30,
  intervalSessionType: "infinite",
  intervalCount: 6,
  intervalShowStats: true,
  intervalIncludeFloat: true,
  intervalIncludeSwing: true,
  surfaceArea: 1000,
  // Floating torus "bath rings" field — off by default so existing scenes
  // look unchanged until explicitly turned on. Defaults per the feature
  // spec: emissive white, 50% opacity.
  torusRingsOn: false,
  torusRadius: 0.6,
  torusTube: 0.08,
  torusScale: 1,
  torusOpacity: 0.5,
  torusTextureIdx: 0,
  torusCellSize: 6,
  torusVerticalSpacing: 1.4,
  torusVerticalCount: 5,
  torusViewDistance: 26,
  torusFadeDistance: 8,
};
function loadSettings(): Persisted {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed: Record<string, unknown> = JSON.parse(raw);
    // Migrate settings saved before TORNADO/WHIRLPOOL were merged into one
    // shared toggle: the old standalone "whirlpool" camera mode no longer
    // exists, so fall back to "swing" — the mode the merged water-whirlpool
    // visual now lives in. Old swingTornadoOn/noclipTornadoOn carry over
    // into the new shared tornadoOn (plus whichever one of them was on's own
    // radius/speed/direction) as long as a newer save hasn't already set
    // tornadoOn itself.
    if (parsed.cameraMode === "whirlpool") parsed.cameraMode = "swing";
    if (parsed.tornadoOn === undefined) {
      const legacySrc = parsed.swingTornadoOn
        ? "swingTornado"
        : parsed.noclipTornadoOn
          ? "noclipTornado"
          : null;
      if (legacySrc) {
        parsed.tornadoOn = true;
        if (typeof parsed[`${legacySrc}Radius`] === "number")
          parsed.tornadoRadius = parsed[`${legacySrc}Radius`];
        if (typeof parsed[`${legacySrc}Speed`] === "number")
          parsed.tornadoSpeed = parsed[`${legacySrc}Speed`];
        if (parsed[`${legacySrc}Direction`])
          parsed.tornadoDirection = parsed[`${legacySrc}Direction`];
      }
    }
    return { ...DEFAULTS, ...(parsed as Partial<Persisted>) };
  } catch {
    return DEFAULTS;
  }
}

// The camera's free-roam position (x/z) and look direction (yaw/pitch) are
// autosaved continuously, separately from the dial settings above, so a
// "restore" action can jump back to wherever the camera was left without
// requiring that value to feed into the physics loop on every reload.
export const CAMERA_STORAGE_KEY = "aquafulness:camera:v1";
// y is only meaningful (and only saved) in noclip mode, where there is no
// wave-surface spring to re-derive a height from — optional so old saves
// without it still parse.
export type CameraPose = { x: number; z: number; yaw: number; pitch: number; y?: number };
function loadCameraPose(): CameraPose | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CAMERA_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (
      typeof p.x !== "number" ||
      typeof p.z !== "number" ||
      typeof p.yaw !== "number" ||
      typeof p.pitch !== "number"
    )
      return null;
    return p;
  } catch {
    return null;
  }
}
function saveCameraPose(pose: CameraPose) {
  try {
    window.localStorage.setItem(CAMERA_STORAGE_KEY, JSON.stringify(pose));
  } catch {
    /* quota or privacy mode — ignore */
  }
}

// Splash screen's "Start bath" button: encodes whatever settings/camera pose
// are already autosaved in localStorage (or the app's defaults, for a
// first-time visitor) into the same bath-link payload shape as DELA
// BADLÄNK inside the app itself (see buildBathLink further down) — so
// tapping it opens straight into "the bath as it was left" via the
// /bathing/$payload route, without ever mounting the full WebGL scene on
// the splash screen. Camera pose is only included when a full x/y/z pose
// (noclip mode) was saved — isValidBathPayload requires `y` once `c` is
// present at all, and most saved poses only carry x/z/yaw/pitch.
// `settingsOverride` lets a caller start the bath in a particular state
// (e.g. the splash screen's "Watercraft" shortcut forcing cameraMode to
// "watercraft") without writing that override back to the visitor's saved
// settings — it's applied to the encoded payload only, after the real
// autosaved settings are read.
async function buildCurrentBathPayload(
  settingsOverride?: Partial<Record<string, unknown>>,
): Promise<string> {
  const payload: BathPayload = {
    v: 1,
    s: {
      ...(pickFields(loadSettings(), PRESET_ALL_FIELDS) as Record<string, unknown>),
      ...settingsOverride,
    },
  };
  const pose = loadCameraPose();
  if (pose && typeof pose.y === "number") {
    payload.c = { x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw, pitch: pose.pitch };
  }
  return encodeStateToBase62(payload);
}

// The very first screen a visitor sees: brand mark, a "Start bath" button
// that carries them into /bathing/$payload with today's settings already
// encoded in the URL, and a link to /about — all in front of a slow,
// looping meshed-gradient background (see .aq-splash-blob in styles.css).
// Deliberately has no dependency on the ocean scene below, so it stays
// instant to paint even before Three.js has loaded.
function SplashScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);

  const startBath = async (settingsOverride?: Partial<Record<string, unknown>>) => {
    if (starting) return;
    setStarting(true);
    try {
      const payload = await buildCurrentBathPayload(settingsOverride);
      await navigate({ to: "/bathing/$payload", params: { payload } });
    } catch {
      setStarting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center overflow-hidden bg-[#dff3ef]">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-b from-[#eafff2] via-[#d9f5ee] to-[#eaf6ff]" />
        <div className="aq-splash-blob aq-splash-blob--1" />
        <div className="aq-splash-blob aq-splash-blob--2" />
        <div className="aq-splash-blob aq-splash-blob--3" />
        <div className="aq-splash-blob aq-splash-blob--4" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 px-6 pt-[calc(env(safe-area-inset-top,0px)+4rem)] text-center">
        <img
          src={appIconAsset.url}
          alt={t("splash.logoAlt")}
          className="h-20 w-20 drop-shadow-[0_6px_20px_rgba(11,61,92,0.25)]"
        />

        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => void startBath()}
            disabled={starting}
            className="min-w-[220px] cursor-pointer rounded-full bg-[#0b3d5c] px-8 py-3.5 text-sm font-semibold tracking-[0.08em] text-white shadow-lg shadow-[#0b3d5c]/30 transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-default disabled:opacity-70"
          >
            {starting ? t("splash.starting") : t("splash.startBath")}
          </button>

          {/* Quick-start straight into the raft: same bath, cameraMode
              forced to "watercraft" for this one launch (not written back to
              the visitor's saved settings — see settingsOverride above). */}
          <button
            type="button"
            onClick={() => void startBath({ cameraMode: "watercraft" })}
            disabled={starting}
            className="min-w-[220px] cursor-pointer rounded-full border border-[#0b3d5c]/25 bg-white/40 px-8 py-3 text-sm font-medium tracking-[0.08em] text-[#0b3d5c] backdrop-blur-sm transition-colors hover:bg-white/60 disabled:cursor-default disabled:opacity-70"
          >
            Watercraft (build mode)
          </button>

          <Link
            to="/about"
            className="min-w-[220px] rounded-full border border-[#0b3d5c]/25 bg-white/40 px-8 py-3 text-sm font-medium tracking-[0.08em] text-[#0b3d5c] backdrop-blur-sm transition-colors hover:bg-white/60"
          >
            {t("about.navLabel")}
          </Link>
        </div>
      </div>

      <div className="relative z-10 mt-auto pt-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] text-center text-xs text-[#0b3d5c]/70">
        {t("splash.copyright", {
          year: new Date().getFullYear(),
          name: t("about.sections.trader.name"),
        })}
      </div>
    </div>
  );
}

// Full-screen post-process pass for KROMATISK ABERRATION: samples the red and
// blue channels offset radially from frame center (green stays put), the
// offset growing linearly with distance from center so it reads as a lens
// effect concentrated at the edges rather than a uniform screen-wide smear.
// uAmount is the red/blue offset (in UV units) at the frame's corner;
// scaled from the 0..1 dial value in the render loop below.
const CHROMATIC_ABERRATION_SHADER = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uAmount: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uAmount;
    varying vec2 vUv;
    void main() {
      vec2 toCenter = vUv - 0.5;
      vec2 dir = toCenter / (length(toCenter) + 1e-6);
      vec2 offset = dir * length(toCenter) * uAmount;
      float r = texture2D(tDiffuse, vUv - offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv + offset).b;
      float a = texture2D(tDiffuse, vUv).a;
      gl_FragColor = vec4(r, g, b, a);
    }
  `,
};

// Exported so routes/bathing.$payload.tsx can render the exact same app
// after seeding its localStorage-backed settings/camera pose from a decoded
// shared "bathing" link.
export function Aquafulness() {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  const mountRef = useRef<HTMLDivElement>(null);
  const initial = useRef<Persisted>(loadSettings()).current;
  // Autosaved free-roam camera pose (see CAMERA_STORAGE_KEY below) — read
  // once at mount so a reload resumes from wherever the camera was left,
  // instead of always snapping back to the origin looking forward.
  const initialCameraPose = useRef<CameraPose | null>(loadCameraPose()).current;
  const [waveAmp, setWaveAmp] = useState(initial.waveAmp);
  const [timeOfDay, setTimeOfDay] = useState(initial.timeOfDay);
  const [waveSpeed, setWaveSpeed] = useState(initial.waveSpeed);
  const [waveFreq, setWaveFreq] = useState(initial.waveFreq);
  const [bobSpeed, setBobSpeed] = useState(initial.bobSpeed);
  const [buoyAmp, setBuoyAmp] = useState(initial.buoyAmp);
  const [heightOffset, setHeightOffset] = useState(initial.heightOffset);
  const [submergeAmp, setSubmergeAmp] = useState(initial.submergeAmp);
  const [floatLift, setFloatLift] = useState(initial.floatLift);
  const [waveAnticipation, setWaveAnticipation] = useState(initial.waveAnticipation);
  const [camOffX, setCamOffX] = useState(initial.camOffX);
  const [camOffY, setCamOffY] = useState(initial.camOffY);
  const [camOffZ, setCamOffZ] = useState(initial.camOffZ);
  // Live joystick vector (visual state) — kept in state so the thumb renders.
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const [audioOn, setAudioOn] = useState(initial.audioOn);
  const [audioVol, setAudioVol] = useState(initial.audioVol);
  const [audioSyncSpeed, setAudioSyncSpeed] = useState(initial.audioSyncSpeed);
  const [audioSpatial, setAudioSpatial] = useState(initial.audioSpatial);
  const [waterSoundIdx, setWaterSoundIdx] = useState(initial.waterSoundIdx);
  const [waterColorIdx, setWaterColorIdx] = useState(initial.waterColorIdx);
  const [waterOpacity, setWaterOpacity] = useState(initial.waterOpacity);
  const [waterColorAlpha, setWaterColorAlpha] = useState(initial.waterColorAlpha);
  const [waterHue, setWaterHue] = useState(initial.waterHue);
  const [waterSat, setWaterSat] = useState(initial.waterSat);
  const [waterBright, setWaterBright] = useState(initial.waterBright);
  const [surfBright, setSurfBright] = useState(initial.surfBright);
  const [surfSat, setSurfSat] = useState(initial.surfSat);
  const [turbidity, setTurbidity] = useState(initial.turbidity);
  const [bottomIdx, setBottomIdx] = useState(initial.bottomIdx);
  const [leanEnabled, setLeanEnabled] = useState(initial.leanEnabled);
  const [gogglesOn, setGogglesOn] = useState(initial.gogglesOn);
  const [gogglesBlur, setGogglesBlur] = useState(initial.gogglesBlur);
  const [gogglesLoop, setGogglesLoop] = useState(initial.gogglesLoop);
  const [gogglesIntensity, setGogglesIntensity] = useState(initial.gogglesIntensity);
  const [gogglesFpsCap, setGogglesFpsCap] = useState(initial.gogglesFpsCap);
  const [targetFps, setTargetFps] = useState(initial.targetFps);
  const [resolutionScale, setResolutionScale] = useState(initial.resolutionScale);
  const [lowGraphicsMode, setLowGraphicsMode] = useState(initial.lowGraphicsMode);
  const [regularWaves, setRegularWaves] = useState(initial.regularWaves);
  // Realistic (JONSWAP/FFT-ocean) waveform — see src/lib/ocean/fftOceanSpectrum.ts.
  const [realisticWaves, setRealisticWaves] = useState(initial.realisticWaves);
  // SLUMPA VÅGOR: off (default) seeds both FFT generators below so the
  // component set — and the exact wave shape/heave rhythm — is the same
  // every load; on draws real Math.random() for a fresh shape each load.
  // Read once from `initial` (not the reactive state below) since the
  // component sets are themselves only ever generated once per mount.
  const [randomizeWaves, setRandomizeWaves] = useState(initial.randomizeWaves);
  // Fixed set of spectrum-sampled wave components, generated once per mount
  // and shared by the vertex shader (uFftWave/uFftPhase uniforms) and the
  // camera's wave-following physics (waveHeight()'s realistic branch).
  const fftWaveComponents = useRef<OceanWaveComponent[]>(
    generateOceanWaveComponents(
      initial.randomizeWaves ? Math.random : createSeededRandom(FFT_WAVE_SEED),
    ),
  ).current;
  // DÖENDE VÅG (dying wave) — a long, decaying-swell overlay that blends in
  // on top of whichever base waveform is active, the same way REALISTISKA
  // VÅGOR blends over VÅGFORM. Own dedicated height/speed dials (dyingWaveAmp/
  // dyingWaveSpeed) and own fixed component set — see
  // src/lib/ocean/fftOceanSpectrum.ts's generateDyingWaveComponents().
  const [dyingWave, setDyingWave] = useState(initial.dyingWave);
  const [dyingWaveAmp, setDyingWaveAmp] = useState(initial.dyingWaveAmp);
  const [dyingWaveSpeed, setDyingWaveSpeed] = useState(initial.dyingWaveSpeed);
  const dyingWaveComponents = useRef<OceanWaveComponent[]>(
    generateDyingWaveComponents(
      initial.randomizeWaves ? Math.random : createSeededRandom(DYING_WAVE_SEED),
    ),
  ).current;
  const [wavePreset, setWavePreset] = useState<WavePresetName>(initial.wavePreset);
  const [regularCross, setRegularCross] = useState(initial.regularCross);
  const [regularPeriod, setRegularPeriod] = useState(initial.regularPeriod);
  const [wavePeak, setWavePeak] = useState(initial.wavePeak);
  const [waveHighQuality, setWaveHighQuality] = useState(initial.waveHighQuality);
  const [backdropIdx, setBackdropIdx] = useState(initial.backdropIdx);
  const [wakeLock, setWakeLock] = useState(initial.wakeLock);
  // Rotation stick (yaw / pitch look) and wave-follow stick.
  const [camFov, setCamFov] = useState(initial.camFov);
  const [camNear, setCamNear] = useState(initial.camNear);
  const [camFar, setCamFar] = useState(initial.camFar);
  const [waveDir, setWaveDir] = useState(initial.waveDir);
  const [floorDepth, setFloorDepth] = useState(initial.floorDepth);
  const [floorTexture, setFloorTexture] = useState(initial.floorTexture);
  const [floorCloudsAnimated, setFloorCloudsAnimated] = useState(initial.floorCloudsAnimated);
  const [depthSineOn, setDepthSineOn] = useState(initial.depthSineOn);
  const [depthSineAmp, setDepthSineAmp] = useState(initial.depthSineAmp);
  const [depthSineFreq, setDepthSineFreq] = useState(initial.depthSineFreq);
  const [depthSineSpeed, setDepthSineSpeed] = useState(initial.depthSineSpeed);
  const [depthSineInterval, setDepthSineInterval] = useState(initial.depthSineInterval);
  const [depthSinePeak, setDepthSinePeak] = useState(initial.depthSinePeak);
  const [depthSineWaveform, setDepthSineWaveform] = useState<DepthSineWaveform>(
    initial.depthSineWaveform,
  );
  const [depthDriftSpeed, setDepthDriftSpeed] = useState(initial.depthDriftSpeed);
  const [hideWater, setHideWater] = useState(initial.hideWater);
  const [midCloudsOn, setMidCloudsOn] = useState(initial.midCloudsOn);
  const [midCloudsHeight, setMidCloudsHeight] = useState(initial.midCloudsHeight);
  const [skyCloudsOn, setSkyCloudsOn] = useState(initial.skyCloudsOn);
  const [skyCloudsHeight, setSkyCloudsHeight] = useState(initial.skyCloudsHeight);
  const [cloudFadeSpeed, setCloudFadeSpeed] = useState(initial.cloudFadeSpeed);
  const [skyPuffsOn, setSkyPuffsOn] = useState(initial.skyPuffsOn);
  const [skyPuffsCount, setSkyPuffsCount] = useState(initial.skyPuffsCount);
  const [skyPuffsSize, setSkyPuffsSize] = useState(initial.skyPuffsSize);
  const [skyPuffsFreq, setSkyPuffsFreq] = useState(initial.skyPuffsFreq);
  const [skyPuffsOpacity, setSkyPuffsOpacity] = useState(initial.skyPuffsOpacity);
  const [swayAmp, setSwayAmp] = useState(initial.swayAmp);
  const [swaySpeed, setSwaySpeed] = useState(initial.swaySpeed);
  const [swayBias, setSwayBias] = useState(initial.swayBias);
  const [syncWaveWithSway, setSyncWaveWithSway] = useState(initial.syncWaveWithSway);
  const [surgeAmp, setSurgeAmp] = useState(initial.surgeAmp);
  const [surgeSpeed, setSurgeSpeed] = useState(initial.surgeSpeed);
  const [surgeRotationMode, setSurgeRotationMode] = useState<SurgeRotationMode>(
    initial.surgeRotationMode,
  );
  const [surgeRotationSpeed, setSurgeRotationSpeed] = useState(initial.surgeRotationSpeed);
  const [worldBoundaryOn, setWorldBoundaryOn] = useState(initial.worldBoundaryOn);
  const [worldBoundarySize, setWorldBoundarySize] = useState(initial.worldBoundarySize);
  const [worldBoundaryHeight, setWorldBoundaryHeight] = useState(initial.worldBoundaryHeight);
  const [worldBoundaryYExtend, setWorldBoundaryYExtend] = useState(initial.worldBoundaryYExtend);
  const [liveMode, setLiveMode] = useState(initial.liveMode);
  // Loadable .glb scenes discovered from public/scenes/scenes.json.
  const [scenes, setScenes] = useState<SceneEntry[]>([]);
  const [sceneId, setSceneId] = useState<string | null>(initial.sceneId);
  // Named respawn points for the current scene, from its manifest's
  // "locations"/"places" list (see resolveSpawnLocations) — always at least
  // one entry (the {0,0,0} fallback when the manifest defines none).
  const [spawnLocations, setSpawnLocations] = useState<SpawnLocation[]>([DEFAULT_SPAWN_LOCATION]);
  const [spawnLocationId, setSpawnLocationId] = useState<string | null>(initial.spawnLocationId);
  // Real-skybox environments discovered from public/environments/environment.json.
  const [environments, setEnvironments] = useState<EnvironmentEntry[]>([]);
  const [envId, setEnvId] = useState<string | null>(initial.envId);
  const [envEra, setEnvEra] = useState<string | null>(initial.envEra);
  const [envTime, setEnvTime] = useState<string | null>(initial.envTime);
  // DATE & TIME TRAVEL — see src/lib/timeTravel.ts and the clock readout/
  // dialog below the persistent brand mark in the HUD.
  const [timeTravelBaseMs, setTimeTravelBaseMs] = useState(initial.timeTravelBaseMs);
  const [timeTravelSetAtMs, setTimeTravelSetAtMs] = useState(initial.timeTravelSetAtMs);
  const [timeSeasonalSync, setTimeSeasonalSync] = useState(initial.timeSeasonalSync);
  // Master on/off for the whole feature — see its Settings-type comment.
  const [clockOn, setClockOn] = useState(initial.clockOn);
  const [timeTravelOpen, setTimeTravelOpen] = useState(false);
  // Starts null (rather than `new Date()`) so the server-rendered markup and
  // the client's first pass agree — a live clock value would almost always
  // differ between the two (different instant, and often a different
  // timezone), causing a hydration mismatch. The ticking effect below sets
  // it on mount instead, client-side only.
  const [simNow, setSimNow] = useState<Date | null>(null);
  // Memoized so the Intl-backed formatting only runs when simNow itself
  // changes (once a minute) rather than on every one of this large
  // component's re-renders (e.g. every tick of a dragged slider) — Intl
  // calls are comparatively expensive to redo that often.
  const simNowLabel = useMemo(
    () => simNow?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) ?? null,
    [simNow],
  );
  // Tracks whether the current envEra="future" was applied automatically by
  // the year-2100 gate below, so it can be reverted automatically too —
  // without ever overriding an era the user picked by hand.
  const autoFuturisticEraRef = useRef(false);
  // Selectable water-surface reflection presets from public/surfaces/surfaces.json.
  const [surfaces, setSurfaces] = useState<SurfaceEntry[]>([]);
  const [surfaceId, setSurfaceId] = useState<string | null>(initial.surfaceId);
  const [reflStrength, setReflStrength] = useState(initial.reflStrength);
  const [bottomColor, setBottomColor] = useState(initial.bottomColor);
  const [sphereMaterial, setSphereMaterial] = useState(initial.sphereMaterial);
  const [sphereStrength, setSphereStrength] = useState(initial.sphereStrength);
  const [trochoid, setTrochoid] = useState(initial.trochoid);
  const [heaveSkew, setHeaveSkew] = useState(initial.heaveSkew);
  const [causticsOn, setCausticsOn] = useState(initial.causticsOn);
  const [chromaticAberrationOn, setChromaticAberrationOn] = useState(initial.chromaticAberrationOn);
  const [chromaticAberrationAmount, setChromaticAberrationAmount] = useState(
    initial.chromaticAberrationAmount,
  );
  const [cameraMode, setCameraMode] = useState<CameraMode>(initial.cameraMode);
  const [noclipSpeed, setNoclipSpeed] = useState(initial.noclipSpeed);
  const [noclipFallRiseSpeed, setNoclipFallRiseSpeed] = useState(initial.noclipFallRiseSpeed);
  const [noclipVertEaseTime, setNoclipVertEaseTime] = useState(initial.noclipVertEaseTime);
  // Resting altitude the pendulum hangs from — GUNGA POSITION Y. Renamed from
  // the old "swingHeight" (which was confusingly close to swingYAmplitude,
  // the actual up/down excursion, now called GUNGA HÖJD below).
  const [swingPositionY, setSwingPositionY] = useState(initial.swingPositionY);
  const [swingIntensity, setSwingIntensity] = useState(initial.swingIntensity);
  // Horizontal (side-to-side) swing multiplier — defaults to 0 so the
  // pendulum bobs vertically in place until explicitly dialed up.
  const [swingXFactor, setSwingXFactor] = useState(initial.swingXFactor);
  // Vertical swing excursion in meters (GUNGA HÖJD) — independent of GUNGA
  // POSITION Y (the resting altitude), so the pendulum can swing tens of
  // thousands of meters up/down from wherever it rests.
  const [swingHeight, setSwingHeight] = useState(initial.swingHeight);
  const [swingYWaveform, setSwingYWaveform] = useState<SwingYWaveform>(initial.swingYWaveform);
  const [swingPreset, setSwingPreset] = useState<SwingPreset>(initial.swingPreset);
  // Unified TORNADO toggle, shared by GUNGA (swing) and flying (noclip/
  // watercraft) alike: instead of a back-and-forth pendulum arc / plain
  // manual flight, the camera orbits a circle around the anchor (posRef) —
  // see the cameraMode==="swing"/"noclip"/"watercraft" branches below.
  // While swinging, this also opens a real water whirlpool centered at that
  // same anchor (tornadoOpening controls its throat width; see uVortex*
  // below) — flying never shows that water effect. tornadoFollowCenter
  // additionally eases the camera's look direction toward that center
  // instead of leaving it wherever NAV/LOOK already has it facing.
  // Activating/deactivating this eases in/out (see tornadoBlendRef/
  // vortexBlendRef in the physics loop) rather than snapping instantly.
  const [tornadoOn, setTornadoOn] = useState(initial.tornadoOn);
  const [tornadoRadius, setTornadoRadius] = useState(initial.tornadoRadius);
  const [tornadoSpeed, setTornadoSpeed] = useState(initial.tornadoSpeed);
  const [tornadoDirection, setTornadoDirection] = useState<TornadoDirection>(
    initial.tornadoDirection,
  );
  const [tornadoOpening, setTornadoOpening] = useState(initial.tornadoOpening);
  const [tornadoFollowCenter, setTornadoFollowCenter] = useState(initial.tornadoFollowCenter);
  // TORNADO CLOUD: optional visible funnel-shaped cloud wrapping the active
  // tornado orbit — see tornadoCloudMeshRef further down.
  const [tornadoCloudOn, setTornadoCloudOn] = useState(initial.tornadoCloudOn);
  // Meters above the real water surface (at the tornado's own xz spot) the
  // TORNADO CLOUD's tip sits while swinging or flying — see
  // tornadoWaterHeightAt in the physics loop.
  const [tornadoCloudYOffset, setTornadoCloudYOffset] = useState(
    initial.tornadoCloudYOffset,
  );
  // Interval session: automatically cycles the camera through whichever of
  // "float" (FRI/default)/"swing" (GUNGA, optionally TORNADO) are enabled
  // below, every intervalDuration seconds — see the session-driver effect
  // further down. intervalIndex/intervalProgress/intervalElapsedTotal are
  // runtime-only (not persisted) progress readouts for the bottom HUD bars.
  const [intervalSessionOn, setIntervalSessionOn] = useState(initial.intervalSessionOn);
  const [intervalDuration, setIntervalDuration] = useState(initial.intervalDuration);
  const [intervalSessionType, setIntervalSessionType] = useState<IntervalSessionType>(
    initial.intervalSessionType,
  );
  const [intervalCount, setIntervalCount] = useState(initial.intervalCount);
  const [intervalShowStats, setIntervalShowStats] = useState(initial.intervalShowStats);
  const [intervalIncludeFloat, setIntervalIncludeFloat] = useState(initial.intervalIncludeFloat);
  const [intervalIncludeSwing, setIntervalIncludeSwing] = useState(initial.intervalIncludeSwing);
  const [intervalIndex, setIntervalIndex] = useState(0);
  const [intervalProgress, setIntervalProgress] = useState(0);
  const [intervalElapsedTotal, setIntervalElapsedTotal] = useState(0);
  const intervalDurationRef = useRef(intervalDuration);
  const intervalSessionTypeRef = useRef(intervalSessionType);
  const intervalCountRef = useRef(intervalCount);
  useEffect(() => {
    intervalDurationRef.current = intervalDuration;
  }, [intervalDuration]);
  useEffect(() => {
    intervalSessionTypeRef.current = intervalSessionType;
  }, [intervalSessionType]);
  useEffect(() => {
    intervalCountRef.current = intervalCount;
  }, [intervalCount]);
  // Physical width/depth (meters) of the recentered water and cloud planes —
  // shared by the ocean surface and both cloud layers so all three always
  // extend exactly this far before their edge could show.
  const [surfaceArea, setSurfaceArea] = useState(initial.surfaceArea);
  const [torusRingsOn, setTorusRingsOn] = useState(initial.torusRingsOn);
  const [torusRadius, setTorusRadius] = useState(initial.torusRadius);
  const [torusTube, setTorusTube] = useState(initial.torusTube);
  const [torusScale, setTorusScale] = useState(initial.torusScale);
  const [torusOpacity, setTorusOpacity] = useState(initial.torusOpacity);
  const [torusTextureIdx, setTorusTextureIdx] = useState(initial.torusTextureIdx);
  const [torusCellSize, setTorusCellSize] = useState(initial.torusCellSize);
  const [torusVerticalSpacing, setTorusVerticalSpacing] = useState(initial.torusVerticalSpacing);
  const [torusVerticalCount, setTorusVerticalCount] = useState(initial.torusVerticalCount);
  const [torusViewDistance, setTorusViewDistance] = useState(initial.torusViewDistance);
  const [torusFadeDistance, setTorusFadeDistance] = useState(initial.torusFadeDistance);
  const [rotStick, setRotStick] = useState({ x: 0, y: 0 });
  const [driftStick, setDriftStick] = useState({ x: 0, y: 0 });
  const [waveDirStick, setWaveDirStick] = useState({ x: 0, y: 0 });
  const [swayStick, setSwayStick] = useState({ x: 0, y: 0 });
  // Display-only pad state for SURGE's direction, kept in sync with
  // surgeDirRef the same way swayStick mirrors swayWorldRef — there's no
  // draggable on-screen pad for it (direction is set via the SURGE
  // DIRECTION dial in Settings), but the sync still needs a state setter to
  // trigger a re-render so that dial's live bearing readout stays fresh
  // while surgeRotationMode is turning or wandering it every frame.
  const [surgeStick, setSurgeStick] = useState({ x: 0, y: 0 });
  // Noclip's dedicated vertical (ascend/descend) joystick, shown in place of
  // STRÖM which has no meaning outside float mode. Sticky in the main HUD/
  // remote (see the JSX below) — it's noclip's own persistent "current",
  // not a momentary nudge, so it keeps climbing/descending after release.
  const [vertStick, setVertStick] = useState({ x: 0, y: 0 });
  // NOCLIP's horizontal counterpart to vertStick above — a sticky world-space
  // drift dial (same idea as float mode's STRÖM/driftStick, just its own
  // state since the two modes' drift directions are independent) that
  // replaces STRÖM/SVAJ's spot in the main HUD while in noclip.
  const [noclipDriftStick, setNoclipDriftStick] = useState({ x: 0, y: 0 });
  // FRITT FALL / OMVÄND STIGNING: two small toggle dials flanking the y
  // drift pad in noclip, each pinning the vertical rate to a strong constant
  // dive/climb (overriding vertStick) while active — a quick way to commit to
  // a long, hands-off descent/ascent through the VÄRLDSGRÄNS y extension.
  // Mutually exclusive; toggling one off falls back to vertStick's own value.
  const [noclipFreeFallOn, setNoclipFreeFallOn] = useState(false);
  const [noclipReverseRiseOn, setNoclipReverseRiseOn] = useState(false);
  // Optional hands-off cycling between the two above: while on, flips FRITT
  // FALL/OMVÄND STIGNING back and forth every noclipAutoAlternateInterval
  // seconds, so noclip bobs up and down through the world boundary without
  // needing either toggle held. See the driver effect near
  // noclipAutoAlternateIntervalRef below.
  const [noclipAutoAlternateOn, setNoclipAutoAlternateOn] = useState(false);
  const [noclipAutoAlternateInterval, setNoclipAutoAlternateInterval] = useState(6);
  // Ambient wave motion for noclip: while either is on and neither FRITT
  // FALL nor OMVÄND STIGNING is active ("still"), the camera also picks up
  // the wave's own vertical heave / horizontal sway on top of its free
  // position — purely cosmetic, decoupled from actual depth (it applies the
  // same whether the camera is high above or deep under the surface), unlike
  // FLYT/VIRVEL's buoyancy which is the real physical response to floating.
  const [noclipHeaveOn, setNoclipHeaveOn] = useState(false);
  const [noclipSwayOn, setNoclipSwayOn] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("vagor");
  // Quick per-camera-mode settings live behind their own bottom drawer (like
  // SETTINGS) rather than as always-on sliders, so a stray touch near
  // bottom-center can't accidentally nudge a value mid-session.
  const [cameraDrawerOpen, setCameraDrawerOpen] = useState(false);
  // Which tab the drawer above is showing — usually one of the camera modes
  // (kept independent of cameraMode itself, so it can be browsed without
  // switching modes, but re-synced to it below whenever cameraMode actually
  // changes) plus one extra "tornado" tab that isn't a camera mode at all,
  // just a settings category always available regardless of which mode is
  // active (mirrors the old standalone VIRVEL tab this drawer used to have).
  type CameraDrawerTab = CameraMode | "tornado";
  const [cameraDrawerTab, setCameraDrawerTab] = useState<CameraDrawerTab>(cameraMode);
  // Named settings presets (save/load, in addition to file export/import
  // below) — kept in their own localStorage list, separate from the
  // always-on autosave under STORAGE_KEY. See src/lib/presets.ts.
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>(() => loadSavedPresets());
  // Named full-state saves (settings + player position/look + current/sway
  // direction) — see buildFullStateSnapshot/applyFullState below and
  // src/lib/presets.ts's separate "state" file kind/localStorage list.
  const [savedStates, setSavedStates] = useState<SavedState[]>(() => loadSavedStates());
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [shareBathOpen, setShareBathOpen] = useState(false);
  // Edit mode: freezes wave time and all camera bob/drift/walk physics so TV
  // panels can be moved/rotated/resized precisely without the world (or the
  // camera's own automatic buoyancy) shifting underneath the gesture.
  const [editMode, setEditMode] = useState(false);
  const editModeRef = useRef(editMode);
  useEffect(() => {
    editModeRef.current = editMode;
    tvManagerRef.current?.setEditMode(editMode);
  }, [editMode]);
  const idleTimerRef = useRef<number | null>(null);
  // The three.js scene graph (populated by the WebGL setup effect) and the
  // currently loaded .glb model, so the scene-selector effect can swap models
  // in and out without tearing down the whole renderer.
  const sceneRef = useRef<THREE.Scene | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  // The recentered water/cloud planes, so the YTA (surface area) setting can
  // rescale them live without tearing down the renderer.
  const oceanRef = useRef<THREE.Mesh | null>(null);
  // Coarse far tier of the ocean mesh — see OCEAN_FAR_INNER_RADIUS above for
  // why this is a second mesh instead of just scaling `ocean` itself.
  const farOceanRef = useRef<THREE.Mesh | null>(null);
  const midCloudsMeshRef = useRef<THREE.Mesh | null>(null);
  const skyCloudsMeshRef = useRef<THREE.Mesh | null>(null);
  // VÄRLDSGRÄNS's extra sky-cloud layers (see EXTEND_CLOUD_LAYER_* above) —
  // created once alongside skyClouds, repositioned every frame in animate().
  const extendCloudLayersRef = useRef<THREE.Mesh[]>([]);
  // Per-slot fade state for the extend layers above — layerIdx is which
  // altitude band each mesh slot last represented, opacity its current
  // MOLN TONING-eased alpha. When a slot's computed layerIdx changes (its
  // mesh just got recycled to tile a different, newly-approached altitude
  // band) its opacity is reset to 0 so it fades back in there instead of
  // popping in fully visible — see the animate() loop below.
  const extendCloudLayerStateRef = useRef<{ layerIdx: number; opacity: number }[]>([]);
  // Manages the CSS3DRenderer-backed "TV apparatus" panels layered on top of
  // the WebGL scene, sharing the same camera; see CSS3DTVManager.
  const tvManagerRef = useRef<CSS3DTVManager | null>(null);
  // Floating torus "bath rings" field, arrayed around the camera on an
  // invisible grid — see TorusRingField for the fade-in/out and grid logic.
  const torusRingFieldRef = useRef<TorusRingField | null>(null);
  // Non-null only when the current scene opts into bobbing; drives the model's
  // vertical motion from inside the animation loop.
  const modelBobRef = useRef<{ base: THREE.Vector3; bob: BobConfig } | null>(null);
  // "Watercraft" camera mode's raft — block-building + brush-sculpting on a
  // raft that bobs on the real ocean; see WatercraftRig and the
  // cameraMode==="watercraft" wiring throughout this component. Built once
  // in the main scene-setup effect below and left in the scene for the
  // whole session (hidden via setVisible when not in watercraft mode)
  // rather than mounted/unmounted per mode switch, matching how
  // torusRingField/tvManager above are handled.
  const watercraftRigRef = useRef<WatercraftRig | null>(null);
  const [watercraftMode, setWatercraftMode] = useState<ToolMode>("build");
  const [watercraftBuildAction, setWatercraftBuildAction] = useState<BuildAction>("place");
  const [watercraftBlockType, setWatercraftBlockType] = useState(0);
  const [watercraftSculptAction, setWatercraftSculptAction] = useState<SculptAction>("raise");
  const [watercraftBrushRadius, setWatercraftBrushRadius] = useState(1.1);
  const [watercraftBrushStrength, setWatercraftBrushStrength] = useState(0.14);
  const [watercraftBlockCount, setWatercraftBlockCount] = useState(0);
  const [watercraftStatus, setWatercraftStatus] = useState<string | null>(null);
  // Push each watercraft HUD control straight into the live rig instance —
  // same pattern as the many <x>Ref.current = x effects further down for the
  // main scene's own settings, just scoped to a rig that's only ever built
  // once (see the setup effect) rather than every setting living on a ref
  // from the start.
  useEffect(() => {
    if (watercraftRigRef.current) watercraftRigRef.current.mode = watercraftMode;
  }, [watercraftMode]);
  useEffect(() => {
    if (watercraftRigRef.current) watercraftRigRef.current.buildAction = watercraftBuildAction;
  }, [watercraftBuildAction]);
  useEffect(() => {
    if (watercraftRigRef.current) watercraftRigRef.current.blockType = watercraftBlockType;
  }, [watercraftBlockType]);
  useEffect(() => {
    if (watercraftRigRef.current) watercraftRigRef.current.sculptAction = watercraftSculptAction;
  }, [watercraftSculptAction]);
  useEffect(() => {
    if (watercraftRigRef.current) watercraftRigRef.current.brushRadius = watercraftBrushRadius;
  }, [watercraftBrushRadius]);
  useEffect(() => {
    if (watercraftRigRef.current) watercraftRigRef.current.brushStrength = watercraftBrushStrength;
  }, [watercraftBrushStrength]);
  useEffect(() => {
    if (!watercraftStatus) return;
    const id = window.setTimeout(() => setWatercraftStatus(null), 4000);
    return () => window.clearTimeout(id);
  }, [watercraftStatus]);

  // Export/import/reset for the watercraft build — see WatercraftHud below.
  // Entirely client-side: export triggers a normal browser download, import
  // reads a local file from <input type="file">, exactly like the rest of
  // this app's DELA BADLÄNK/save-state features never touch a server.
  const [watercraftConfirm, setWatercraftConfirm] = useState<{
    kind: "import" | "reset";
    file: File | null;
  } | null>(null);

  const watercraftExport = async () => {
    const rig = watercraftRigRef.current;
    if (!rig) return;
    setWatercraftStatus("Exporting…");
    try {
      const blob = await rig.exportGlb();
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `watercraft-${stamp}.glb`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setWatercraftStatus(`Saved ${filename}`);
    } catch (err) {
      console.error("Watercraft export failed", err);
      setWatercraftStatus("Export failed — see console");
    }
  };

  const watercraftRunImport = async (file: File) => {
    const rig = watercraftRigRef.current;
    if (!rig) return;
    setWatercraftStatus("Importing…");
    try {
      const result = await rig.importGlb(file);
      if (result.kind === "restored") setWatercraftStatus("World imported.");
    } catch (err) {
      console.error("Watercraft import failed", err);
      setWatercraftStatus("Import failed — is this a valid .glb?");
    }
  };

  const watercraftImportFile = (file: File) => {
    const rig = watercraftRigRef.current;
    if (rig && rig.blockCount > 0) {
      setWatercraftConfirm({ kind: "import", file });
    } else {
      void watercraftRunImport(file);
    }
  };

  const watercraftHandleReset = () => {
    const rig = watercraftRigRef.current;
    if (rig && rig.blockCount > 0) {
      setWatercraftConfirm({ kind: "reset", file: null });
    } else {
      rig?.reset();
      setWatercraftStatus("Cleared.");
    }
  };
  // The loaded environment skybox texture and whether it is currently shown, so
  // the animation loop can hide the procedural sky dome for a real equirect one.
  const envTextureRef = useRef<THREE.Texture | null>(null);
  const envActiveRef = useRef(false);
  // Water-shader uniforms + reflection-texture plumbing, so the surface-selector
  // effect can feed a photo into the shader without rebuilding the material.
  const waterUniformsRef = useRef<Record<string, { value: unknown }> | null>(null);
  const reflTexRef = useRef<THREE.Texture | null>(null);
  const reflWhiteTexRef = useRef<THREE.Texture | null>(null);
  const maxAnisoRef = useRef(4);
  // Per-surface base reflection strength (from its manifest); the live STYRKA
  // dial multiplies it. Effective uReflMix = reflBase * reflStrength.
  const reflBaseRef = useRef(0);
  const reflStrengthRef = useRef(reflStrength);
  const bottomColorRef = useRef(bottomColor);
  const sphereMaterialRef = useRef(sphereMaterial);
  const sphereStrengthRef = useRef(sphereStrength);
  const trochoidRef = useRef(trochoid);
  const heaveSkewRef = useRef(heaveSkew);
  const causticsOnRef = useRef(causticsOn);
  const chromaticAberrationOnRef = useRef(chromaticAberrationOn);
  const chromaticAberrationAmountRef = useRef(chromaticAberrationAmount);

  // A full snapshot of every settings-dialog field, in the exact Persisted
  // shape saved to localStorage below — also reused by the preset save/
  // export feature (see exportSettingsFile/savePresetAs) so there's only one
  // place that enumerates every field.
  const buildPersistedSnapshot = (): Persisted => ({
    waveAmp,
    timeOfDay,
    waveSpeed,
    waveFreq,
    bobSpeed,
    buoyAmp,
    heightOffset,
    submergeAmp,
    floatLift,
    waveAnticipation,
    camOffX,
    camOffY,
    camOffZ,
    audioOn,
    audioVol,
    audioSyncSpeed,
    audioSpatial,
    waterSoundIdx,
    waterColorIdx,
    waterOpacity,
    waterColorAlpha,
    waterHue,
    waterSat,
    waterBright,
    surfBright,
    surfSat,
    turbidity,
    bottomIdx,
    leanEnabled,
    gogglesOn,
    gogglesBlur,
    gogglesLoop,
    gogglesIntensity,
    gogglesFpsCap,
    targetFps,
    resolutionScale,
    lowGraphicsMode,
    regularWaves,
    realisticWaves,
    dyingWave,
    dyingWaveAmp,
    dyingWaveSpeed,
    randomizeWaves,
    wavePreset,
    regularCross,
    regularPeriod,
    wavePeak,
    waveHighQuality,
    backdropIdx,
    wakeLock,
    camFov,
    camNear,
    camFar,
    waveDir,
    floorDepth,
    floorTexture,
    floorCloudsAnimated,
    depthSineOn,
    depthSineAmp,
    depthSineFreq,
    depthSineSpeed,
    depthSineInterval,
    depthSinePeak,
    depthSineWaveform,
    depthDriftSpeed,
    hideWater,
    midCloudsOn,
    midCloudsHeight,
    skyCloudsOn,
    skyCloudsHeight,
    cloudFadeSpeed,
    skyPuffsOn,
    skyPuffsCount,
    skyPuffsSize,
    skyPuffsFreq,
    skyPuffsOpacity,
    swayAmp,
    swaySpeed,
    swayBias,
    syncWaveWithSway,
    surgeAmp,
    surgeSpeed,
    surgeRotationMode,
    surgeRotationSpeed,
    worldBoundaryOn,
    worldBoundarySize,
    worldBoundaryHeight,
    worldBoundaryYExtend,
    liveMode,
    sceneId,
    spawnLocationId,
    envId,
    envEra,
    envTime,
    timeTravelBaseMs,
    timeTravelSetAtMs,
    timeSeasonalSync,
    clockOn,
    surfaceId,
    reflStrength,
    bottomColor,
    sphereMaterial,
    sphereStrength,
    trochoid,
    heaveSkew,
    causticsOn,
    chromaticAberrationOn,
    chromaticAberrationAmount,
    cameraMode,
    noclipSpeed,
    noclipFallRiseSpeed,
    noclipVertEaseTime,
    swingPositionY,
    swingIntensity,
    swingXFactor,
    swingHeight,
    swingPreset,
    swingYWaveform,
    tornadoOn,
    tornadoRadius,
    tornadoSpeed,
    tornadoDirection,
    tornadoOpening,
    tornadoFollowCenter,
    tornadoCloudOn,
    tornadoCloudYOffset,
    intervalSessionOn,
    intervalDuration,
    intervalSessionType,
    intervalCount,
    intervalShowStats,
    intervalIncludeFloat,
    intervalIncludeSwing,
    surfaceArea,
    torusRingsOn,
    torusRadius,
    torusTube,
    torusScale,
    torusOpacity,
    torusTextureIdx,
    torusCellSize,
    torusVerticalSpacing,
    torusVerticalCount,
    torusViewDistance,
    torusFadeDistance,
  });

  // Persist settings to localStorage whenever they change (SSR-safe, hydration-safe).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPersistedSnapshot()));
    } catch {
      /* quota or privacy mode — ignore */
    }
  }, [
    waveAmp,
    timeOfDay,
    waveSpeed,
    waveFreq,
    bobSpeed,
    buoyAmp,
    heightOffset,
    submergeAmp,
    floatLift,
    waveAnticipation,
    camOffX,
    camOffY,
    camOffZ,
    audioOn,
    audioVol,
    audioSyncSpeed,
    audioSpatial,
    waterSoundIdx,
    waterColorIdx,
    waterOpacity,
    waterColorAlpha,
    waterHue,
    waterSat,
    waterBright,
    surfBright,
    surfSat,
    turbidity,
    bottomIdx,
    leanEnabled,
    gogglesOn,
    gogglesBlur,
    gogglesLoop,
    gogglesIntensity,
    gogglesFpsCap,
    targetFps,
    resolutionScale,
    lowGraphicsMode,
    regularWaves,
    realisticWaves,
    dyingWave,
    dyingWaveAmp,
    dyingWaveSpeed,
    randomizeWaves,
    wavePreset,
    regularCross,
    regularPeriod,
    wavePeak,
    waveHighQuality,
    backdropIdx,
    wakeLock,
    camFov,
    camNear,
    camFar,
    waveDir,
    floorDepth,
    floorTexture,
    floorCloudsAnimated,
    depthSineOn,
    depthSineAmp,
    depthSineFreq,
    depthSineSpeed,
    depthSineInterval,
    depthSinePeak,
    depthSineWaveform,
    depthDriftSpeed,
    hideWater,
    midCloudsOn,
    midCloudsHeight,
    skyCloudsOn,
    skyCloudsHeight,
    cloudFadeSpeed,
    skyPuffsOn,
    skyPuffsCount,
    skyPuffsSize,
    skyPuffsFreq,
    skyPuffsOpacity,
    swayAmp,
    swaySpeed,
    swayBias,
    syncWaveWithSway,
    surgeAmp,
    surgeSpeed,
    surgeRotationMode,
    surgeRotationSpeed,
    worldBoundaryOn,
    worldBoundarySize,
    worldBoundaryHeight,
    worldBoundaryYExtend,
    liveMode,
    sceneId,
    spawnLocationId,
    envId,
    envEra,
    envTime,
    timeTravelBaseMs,
    timeTravelSetAtMs,
    timeSeasonalSync,
    clockOn,
    surfaceId,
    reflStrength,
    bottomColor,
    sphereMaterial,
    sphereStrength,
    trochoid,
    heaveSkew,
    causticsOn,
    chromaticAberrationOn,
    chromaticAberrationAmount,
    cameraMode,
    noclipSpeed,
    noclipFallRiseSpeed,
    noclipVertEaseTime,
    swingPositionY,
    swingIntensity,
    swingXFactor,
    swingHeight,
    swingPreset,
    swingYWaveform,
    tornadoOn,
    tornadoRadius,
    tornadoSpeed,
    tornadoDirection,
    tornadoOpening,
    tornadoFollowCenter,
    tornadoCloudOn,
    tornadoCloudYOffset,
    intervalSessionOn,
    intervalDuration,
    intervalSessionType,
    intervalCount,
    intervalShowStats,
    intervalIncludeFloat,
    intervalIncludeSwing,
    surfaceArea,
    torusRingsOn,
    torusRadius,
    torusTube,
    torusScale,
    torusOpacity,
    torusTextureIdx,
    torusCellSize,
    torusVerticalSpacing,
    torusVerticalCount,
    torusViewDistance,
    torusFadeDistance,
  ]);
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
  const freqRef = useRef(waveFreq);
  const bobSpeedRef = useRef(bobSpeed);
  const buoyRef = useRef(buoyAmp);
  const heightRef = useRef(heightOffset);
  const submergeRef = useRef(submergeAmp);
  const floatLiftRef = useRef(floatLift);
  const waveAnticipationRef = useRef(waveAnticipation);
  const camOffXRef = useRef(camOffX);
  const camOffYRef = useRef(camOffY);
  const camOffZRef = useRef(camOffZ);
  const stickRef = useRef({ x: 0, y: 0 });
  // y is only driven in noclip mode (free vertical flight); float/swing
  // modes derive height from the wave spring / pendulum instead.
  const posRef = useRef({
    x: initialCameraPose?.x ?? 0,
    y: initialCameraPose?.y ?? 0,
    z: initialCameraPose?.z ?? 0,
  });
  const camYRef = useRef<number | null>(null);
  const camVYRef = useRef(0);
  const vertStickRef = useRef({ x: 0, y: 0 });
  const cameraModeRef = useRef<CameraMode>(cameraMode);
  const noclipSpeedRef = useRef(noclipSpeed);
  const noclipFallRiseSpeedRef = useRef(noclipFallRiseSpeed);
  const noclipVertEaseTimeRef = useRef(noclipVertEaseTime);
  const noclipHeaveOnRef = useRef(noclipHeaveOn);
  const noclipSwayOnRef = useRef(noclipSwayOn);
  // Ambient noclip heave's own eased vertical offset (m), additive on top of
  // posRef.current.y — see noclipVertVelRef above for the fall/rise rate this
  // is analogous to.
  const noclipHeaveOffsetRef = useRef(0);
  const swingPositionYRef = useRef(swingPositionY);
  const swingIntensityRef = useRef(swingIntensity);
  const swingXFactorRef = useRef(swingXFactor);
  const swingHeightRef = useRef(swingHeight);
  const swingYWaveformRef = useRef(swingYWaveform);
  // Set the instant swing mode is entered: captures where the camera actually
  // was (continuous with whatever mode came before) so the pendulum's y and
  // its horizontal arc offset can ease in from there instead of snapping
  // straight to the swing formula's value for the current clock phase.
  const swingBlendRef = useRef<{ fromY: number; startMs: number } | null>(null);
  // The pendulum's horizontal arc angle (theta, radians), recomputed every
  // frame regardless of cameraMode — see the unconditional block ahead of
  // the camMode branch in the RAF loop. theta === 0 is the bottom of the
  // arc (nearest the water); the interval-session driver watches this to
  // sync FRI<->GUNGA switches to that point instead of an arbitrary phase.
  const swingThetaRef = useRef(0);
  const surfaceAreaRef = useRef(surfaceArea);
  // Yaw captured the instant swing mode is entered, so the pendulum's
  // side-to-side arc stays perpendicular to whichever way you were already
  // facing instead of snapping to a fixed world axis.
  const swingYawRef = useRef(0);
  const swayPosRef = useRef({ x: 0, z: 0 });
  const swayVelRef = useRef({ x: 0, z: 0 });
  // SURGE's own spring-damped position offset — same integrator shape as
  // swayPosRef/swayVelRef above, just driven by an independent oscillator
  // (surgeAngleRef/t below) instead of the wave's heave signal.
  const surgePosRef = useRef({ x: 0, z: 0 });
  const surgeVelRef = useRef({ x: 0, z: 0 });
  const waterColorRef = useRef(waterColorIdx);
  const waterOpacityRef = useRef(waterOpacity);
  const waterColorAlphaRef = useRef(waterColorAlpha);
  const waterHueRef = useRef(waterHue);
  const waterSatRef = useRef(waterSat);
  const waterBrightRef = useRef(waterBright);
  const surfBrightRef = useRef(surfBright);
  const surfSatRef = useRef(surfSat);
  const turbidityRef = useRef(turbidity);
  const bottomIdxRef = useRef(bottomIdx);
  const leanRef = useRef(leanEnabled);
  const regularRef = useRef(regularWaves);
  const realisticRef = useRef(realisticWaves);
  const dyingRef = useRef(dyingWave);
  const dyingAmpRef = useRef(dyingWaveAmp);
  const dyingSpeedRef = useRef(dyingWaveSpeed);
  const regularCrossRef = useRef(regularCross);
  const regularPeriodRef = useRef(regularPeriod);
  const wavePeakRef = useRef(wavePeak);
  const waveHighQualityRef = useRef(waveHighQuality);
  const backdropRef = useRef(backdropIdx);
  const wakeLockRef = useRef(wakeLock);
  const audioSpatialRef = useRef(audioSpatial);
  const rotStickRef = useRef({ x: 0, y: 0 });
  // The real, fixed-in-world direction STRÖM/SVAJ represent, set relative to
  // the look angle at the moment the pad is touched (see padToWorldXZ). The
  // pad's on-screen knob is re-derived from this every frame (worldXZToPad)
  // so it visually rotates to track the same real direction as you look
  // around, instead of the real direction silently rotating with the camera.
  const driftWorldRef = useRef({ x: 0, z: 0 });
  const swayWorldRef = useRef({ x: 0, z: 0 });
  // Same idea as driftWorldRef, for noclip's own DRIFT XZ dial.
  const noclipDriftWorldRef = useRef({ x: 0, z: 0 });
  // SURGE's real, fixed-in-world direction — same idea as driftWorldRef/
  // swayWorldRef above, but recomputed from surgeAngleRef every frame
  // instead of only on user input, since surgeRotationMode can keep turning
  // it (cw/ccw) or nudging it (random) on its own. Defaults to a concrete
  // bearing (not {0,0}) so raising SURGE AMOUNT alone already produces
  // visible motion before the direction is ever touched.
  const surgeWorldRef = useRef({ x: 0, z: 1 });
  // Current SURGE bearing in radians (atan2(x,z) convention, matching
  // worldXZBearing/bearingToWorldXZ) — the single source of truth for
  // surgeWorldRef's direction; see setSurgeBearing and the physics loop.
  const surgeAngleRef = useRef(0);
  // Smoothed angular-velocity accumulator (rad/s) driving surgeRotationMode
  // "random" — a damped random walk instead of raw per-frame jitter, so the
  // direction wanders the way a real current shifts instead of jittering.
  const surgeRandomAngVelRef = useRef(0);
  // Last pad-local coordinates pushed to the STRÖM/SVAJ knobs, so the render
  // loop only calls setState when the re-derived display value actually
  // moved (yaw changed) instead of every single frame.
  const driftDisplayRef = useRef({ x: 0, y: 0 });
  const swayDisplayRef = useRef({ x: 0, y: 0 });
  const noclipDriftDisplayRef = useRef({ x: 0, y: 0 });
  const surgeDisplayRef = useRef({ x: 0, y: 0 });
  const yawRef = useRef(initialCameraPose?.yaw ?? 0);
  const pitchRef = useRef(initialCameraPose?.pitch ?? 0);
  const prevSurfaceRef = useRef<number | null>(null);
  // Low-pass state for the buoyancy spring's anticipatory velocity estimate
  // — see its use in the animation loop below.
  const anticipVelSmoothRef = useRef(0);
  const camFovRef = useRef(camFov);
  // Read by the main render loop to cap GPU-expensive renderer.render()
  // calls to gogglesFpsCap while SIMGLASÖGON is on — see the animate()
  // closure below and GogglesOverlay's own matching cap.
  const gogglesOnRef = useRef(gogglesOn);
  const gogglesFpsCapRef = useRef(gogglesFpsCap);
  // General performance controls — read every frame by the animate() loop
  // below (targetFps: caps renderer.render() calls whenever SIMGLASÖGON is
  // off, mirroring gogglesFpsCapRef's cap for when it's on; resolutionScale:
  // multiplies the renderer's pixel ratio).
  const targetFpsRef = useRef(targetFps);
  const resolutionScaleRef = useRef(resolutionScale);
  // Read every frame by animate() (see lowEnd there) plus by the torus-ring
  // config effect and applyReflMix — forces every optional texture/live-
  // noise/extra-shading toggle off without touching their own state.
  const lowGraphicsModeRef = useRef(lowGraphicsMode);
  const camNearRef = useRef(camNear);
  const camFarRef = useRef(camFar);
  const waveDirRef = useRef(waveDir);
  const floorDepthRef = useRef(floorDepth);
  const floorTextureRef = useRef(floorTexture);
  const floorCloudsAnimatedRef = useRef(floorCloudsAnimated);
  const tornadoOnRef = useRef(tornadoOn);
  const tornadoRadiusRef = useRef(tornadoRadius);
  const tornadoSpeedRef = useRef(tornadoSpeed);
  const tornadoDirectionRef = useRef(tornadoDirection);
  const tornadoOpeningRef = useRef(tornadoOpening);
  const tornadoFollowCenterRef = useRef(tornadoFollowCenter);
  // Shared orbit angle for the tornado spin, whichever of swing/noclip/
  // watercraft is currently driving it (only one of those branches runs any
  // given frame, so one angle can serve all of them) — reset to 0 whenever
  // cameraMode switches into swing or noclip/watercraft (see that effect
  // below) so every entry starts the spin fresh.
  const tornadoAngleRef = useRef(0);
  // Continuous 0..1 "how tornado-y are we right now" blend, eased toward 1
  // while tornadoOn and cameraMode is swing/noclip/watercraft, toward 0
  // otherwise — regardless of how abruptly tornadoOn itself is toggled or
  // cameraMode switches (button, KAMERA dial, or the interval session) — see
  // its update in the render loop below. Scales the orbit's angular speed
  // and how much its offset contributes to the camera's position, so turning
  // TORNADO on/off ramps the spin up from (or back down to) a standstill —
  // and, while swinging, crossfades the pendulum arc and the circular orbit —
  // instead of snapping instantly.
  const tornadoBlendRef = useRef(0);
  // Same idea as tornadoBlendRef, but specifically for the water whirlpool
  // visual (uVortex* below), which only ever applies while swinging — so it
  // eases toward 1 only when tornadoOn && cameraMode==="swing", independent
  // of tornadoBlendRef staying high if the player then switches to flying.
  const vortexBlendRef = useRef(0);
  const tornadoCloudOnRef = useRef(tornadoCloudOn);
  const tornadoCloudYOffsetRef = useRef(tornadoCloudYOffset);
  // Live-updated by the noclip/swing tornado branches of the physics loop
  // whenever the tornado orbit is active this frame; read afterward to
  // position/scale/rotate the shared funnel-cloud mesh (tornadoCloudMeshRef,
  // created in the scene-setup effect below) — see tornadoCloudFadeRef too.
  const tornadoCloudMeshRef = useRef<THREE.Mesh | null>(null);
  const tornadoCloudFadeRef = useRef(0);
  const intervalIncludeFloatRef = useRef(intervalIncludeFloat);
  const intervalIncludeSwingRef = useRef(intervalIncludeSwing);
  const depthSineOnRef = useRef(depthSineOn);
  const depthSineAmpRef = useRef(depthSineAmp);
  const depthSineFreqRef = useRef(depthSineFreq);
  const depthSineSpeedRef = useRef(depthSineSpeed);
  const depthSineIntervalRef = useRef(depthSineInterval);
  const depthSinePeakRef = useRef(depthSinePeak);
  const depthSineWaveformRef = useRef(depthSineWaveform);
  const depthDriftSpeedRef = useRef(depthDriftSpeed);
  // Infinite water-level drift, much like noclip's FRITT FALL/OMVÄND
  // STIGNING: depthDriftVelRef eases toward depthDriftSpeedRef's target rate
  // and depthDriftRef accumulates that velocity into an unbounded offset —
  // added on top of the bounded DEPTH SINE oscillation in levelY below.
  const depthDriftVelRef = useRef(0);
  const depthDriftRef = useRef(0);
  const hideWaterRef = useRef(hideWater);
  const midCloudsOnRef = useRef(midCloudsOn);
  const midCloudsHeightRef = useRef(midCloudsHeight);
  const skyCloudsOnRef = useRef(skyCloudsOn);
  const skyCloudsHeightRef = useRef(skyCloudsHeight);
  const cloudFadeSpeedRef = useRef(cloudFadeSpeed);
  const skyPuffsOnRef = useRef(skyPuffsOn);
  const skyPuffsCountRef = useRef(skyPuffsCount);
  const skyPuffsSizeRef = useRef(skyPuffsSize);
  const skyPuffsFreqRef = useRef(skyPuffsFreq);
  const skyPuffsOpacityRef = useRef(skyPuffsOpacity);
  // SKY PUFFS pool — created once in the scene-setup effect below, resized
  // to skyPuffsCount and repositioned/faded per-puff in animate(). Kept as
  // refs (not state) since every puff's mesh/material and lifecycle timers
  // are mutable render-loop state, not anything the UI reads back.
  const skyPuffMeshesRef = useRef<THREE.Mesh[]>([]);
  const skyPuffStatesRef = useRef<
    { x: number; y: number; z: number; seed: number; cycleT: number; cycleLen: number }[]
  >([]);
  const swayAmpRef = useRef(swayAmp);
  // Per-mesh fade state (0..1) for the two main cloud decks — see
  // uOpacity/cloudFadeSpeedRef usage in animate() below.
  const midCloudFadeRef = useRef(0);
  const skyCloudFadeRef = useRef(0);
  const swaySpeedRef = useRef(swaySpeed);
  const swayBiasRef = useRef(swayBias);
  const surgeAmpRef = useRef(surgeAmp);
  const surgeSpeedRef = useRef(surgeSpeed);
  const surgeRotationModeRef = useRef(surgeRotationMode);
  const surgeRotationSpeedRef = useRef(surgeRotationSpeed);
  const worldBoundaryOnRef = useRef(worldBoundaryOn);
  const worldBoundarySizeRef = useRef(worldBoundarySize);
  const worldBoundaryHeightRef = useRef(worldBoundaryHeight);
  const worldBoundaryYExtendRef = useRef(worldBoundaryYExtend);
  const noclipFreeFallOnRef = useRef(noclipFreeFallOn);
  const noclipReverseRiseOnRef = useRef(noclipReverseRiseOn);
  const noclipAutoAlternateIntervalRef = useRef(noclipAutoAlternateInterval);
  // Eased vertical velocity actually applied in noclip mode (m/s): ramps
  // toward whatever FRITT FALL/OMVÄND STIGNING/HÖJD currently target instead
  // of snapping straight to it. See the physics loop below.
  const noclipVertVelRef = useRef(0);
  useEffect(() => {
    ampRef.current = waveAmp;
  }, [waveAmp]);
  useEffect(() => {
    todRef.current = timeOfDay;
  }, [timeOfDay]);
  useEffect(() => {
    speedRef.current = waveSpeed;
  }, [waveSpeed]);
  useEffect(() => {
    freqRef.current = waveFreq;
  }, [waveFreq]);
  useEffect(() => {
    bobSpeedRef.current = bobSpeed;
  }, [bobSpeed]);
  useEffect(() => {
    buoyRef.current = buoyAmp;
  }, [buoyAmp]);
  useEffect(() => {
    heightRef.current = heightOffset;
  }, [heightOffset]);
  useEffect(() => {
    submergeRef.current = submergeAmp;
  }, [submergeAmp]);
  useEffect(() => {
    floatLiftRef.current = floatLift;
  }, [floatLift]);
  useEffect(() => {
    waveAnticipationRef.current = waveAnticipation;
  }, [waveAnticipation]);
  useEffect(() => {
    camOffXRef.current = camOffX;
  }, [camOffX]);
  useEffect(() => {
    camOffYRef.current = camOffY;
  }, [camOffY]);
  useEffect(() => {
    camOffZRef.current = camOffZ;
  }, [camOffZ]);
  useEffect(() => {
    stickRef.current = stick;
  }, [stick]);
  useEffect(() => {
    vertStickRef.current = vertStick;
  }, [vertStick]);
  useEffect(() => {
    rotStickRef.current = rotStick;
  }, [rotStick]);
  useEffect(() => {
    waterColorRef.current = waterColorIdx;
  }, [waterColorIdx]);
  useEffect(() => {
    waterOpacityRef.current = waterOpacity;
  }, [waterOpacity]);
  useEffect(() => {
    waterColorAlphaRef.current = waterColorAlpha;
  }, [waterColorAlpha]);
  useEffect(() => {
    waterHueRef.current = waterHue;
  }, [waterHue]);
  useEffect(() => {
    waterSatRef.current = waterSat;
  }, [waterSat]);
  useEffect(() => {
    waterBrightRef.current = waterBright;
  }, [waterBright]);
  useEffect(() => {
    surfBrightRef.current = surfBright;
  }, [surfBright]);
  useEffect(() => {
    surfSatRef.current = surfSat;
  }, [surfSat]);
  useEffect(() => {
    turbidityRef.current = turbidity;
  }, [turbidity]);
  useEffect(() => {
    bottomIdxRef.current = bottomIdx;
  }, [bottomIdx]);
  useEffect(() => {
    leanRef.current = leanEnabled;
  }, [leanEnabled]);
  useEffect(() => {
    regularRef.current = regularWaves;
  }, [regularWaves]);
  useEffect(() => {
    realisticRef.current = realisticWaves;
  }, [realisticWaves]);
  useEffect(() => {
    dyingRef.current = dyingWave;
  }, [dyingWave]);
  useEffect(() => {
    dyingAmpRef.current = dyingWaveAmp;
  }, [dyingWaveAmp]);
  useEffect(() => {
    dyingSpeedRef.current = dyingWaveSpeed;
  }, [dyingWaveSpeed]);
  useEffect(() => {
    regularCrossRef.current = regularCross;
  }, [regularCross]);
  useEffect(() => {
    regularPeriodRef.current = regularPeriod;
  }, [regularPeriod]);
  useEffect(() => {
    wavePeakRef.current = wavePeak;
  }, [wavePeak]);
  useEffect(() => {
    waveHighQualityRef.current = waveHighQuality;
  }, [waveHighQuality]);
  useEffect(() => {
    backdropRef.current = backdropIdx;
  }, [backdropIdx]);
  useEffect(() => {
    wakeLockRef.current = wakeLock;
  }, [wakeLock]);
  useEffect(() => {
    audioSpatialRef.current = audioSpatial;
  }, [audioSpatial]);
  useEffect(() => {
    camFovRef.current = camFov;
  }, [camFov]);
  useEffect(() => {
    gogglesOnRef.current = gogglesOn;
  }, [gogglesOn]);
  useEffect(() => {
    gogglesFpsCapRef.current = gogglesFpsCap;
  }, [gogglesFpsCap]);
  useEffect(() => {
    targetFpsRef.current = targetFps;
  }, [targetFps]);
  useEffect(() => {
    resolutionScaleRef.current = resolutionScale;
  }, [resolutionScale]);
  useEffect(() => {
    lowGraphicsModeRef.current = lowGraphicsMode;
    applyReflMix();
  }, [lowGraphicsMode]);
  useEffect(() => {
    camNearRef.current = camNear;
  }, [camNear]);
  useEffect(() => {
    camFarRef.current = camFar;
  }, [camFar]);
  useEffect(() => {
    waveDirRef.current = waveDir;
  }, [waveDir]);
  useEffect(() => {
    floorDepthRef.current = floorDepth;
  }, [floorDepth]);
  useEffect(() => {
    floorTextureRef.current = floorTexture;
  }, [floorTexture]);
  useEffect(() => {
    floorCloudsAnimatedRef.current = floorCloudsAnimated;
  }, [floorCloudsAnimated]);
  useEffect(() => {
    tornadoOnRef.current = tornadoOn;
  }, [tornadoOn]);
  useEffect(() => {
    tornadoRadiusRef.current = tornadoRadius;
  }, [tornadoRadius]);
  useEffect(() => {
    tornadoSpeedRef.current = tornadoSpeed;
  }, [tornadoSpeed]);
  useEffect(() => {
    tornadoDirectionRef.current = tornadoDirection;
  }, [tornadoDirection]);
  useEffect(() => {
    tornadoOpeningRef.current = tornadoOpening;
  }, [tornadoOpening]);
  useEffect(() => {
    tornadoFollowCenterRef.current = tornadoFollowCenter;
  }, [tornadoFollowCenter]);
  useEffect(() => {
    tornadoCloudOnRef.current = tornadoCloudOn;
  }, [tornadoCloudOn]);
  useEffect(() => {
    tornadoCloudYOffsetRef.current = tornadoCloudYOffset;
  }, [tornadoCloudYOffset]);
  useEffect(() => {
    intervalIncludeFloatRef.current = intervalIncludeFloat;
  }, [intervalIncludeFloat]);
  useEffect(() => {
    intervalIncludeSwingRef.current = intervalIncludeSwing;
  }, [intervalIncludeSwing]);
  useEffect(() => {
    depthSineOnRef.current = depthSineOn;
  }, [depthSineOn]);
  useEffect(() => {
    depthSineAmpRef.current = depthSineAmp;
  }, [depthSineAmp]);
  useEffect(() => {
    depthSineFreqRef.current = depthSineFreq;
  }, [depthSineFreq]);
  useEffect(() => {
    depthSineSpeedRef.current = depthSineSpeed;
  }, [depthSineSpeed]);
  useEffect(() => {
    depthSineIntervalRef.current = depthSineInterval;
  }, [depthSineInterval]);
  useEffect(() => {
    depthSinePeakRef.current = depthSinePeak;
  }, [depthSinePeak]);
  useEffect(() => {
    depthSineWaveformRef.current = depthSineWaveform;
  }, [depthSineWaveform]);
  useEffect(() => {
    depthDriftSpeedRef.current = depthDriftSpeed;
  }, [depthDriftSpeed]);
  useEffect(() => {
    hideWaterRef.current = hideWater;
  }, [hideWater]);
  useEffect(() => {
    midCloudsOnRef.current = midCloudsOn;
  }, [midCloudsOn]);
  useEffect(() => {
    midCloudsHeightRef.current = midCloudsHeight;
  }, [midCloudsHeight]);
  useEffect(() => {
    skyCloudsOnRef.current = skyCloudsOn;
  }, [skyCloudsOn]);
  useEffect(() => {
    skyCloudsHeightRef.current = skyCloudsHeight;
  }, [skyCloudsHeight]);
  useEffect(() => {
    cloudFadeSpeedRef.current = cloudFadeSpeed;
  }, [cloudFadeSpeed]);
  useEffect(() => {
    skyPuffsOnRef.current = skyPuffsOn;
  }, [skyPuffsOn]);
  useEffect(() => {
    skyPuffsCountRef.current = skyPuffsCount;
  }, [skyPuffsCount]);
  useEffect(() => {
    skyPuffsSizeRef.current = skyPuffsSize;
  }, [skyPuffsSize]);
  useEffect(() => {
    skyPuffsFreqRef.current = skyPuffsFreq;
  }, [skyPuffsFreq]);
  useEffect(() => {
    skyPuffsOpacityRef.current = skyPuffsOpacity;
  }, [skyPuffsOpacity]);
  useEffect(() => {
    swayAmpRef.current = swayAmp;
  }, [swayAmp]);
  useEffect(() => {
    swaySpeedRef.current = swaySpeed;
  }, [swaySpeed]);
  useEffect(() => {
    swayBiasRef.current = swayBias;
  }, [swayBias]);
  useEffect(() => {
    surgeAmpRef.current = surgeAmp;
  }, [surgeAmp]);
  useEffect(() => {
    surgeSpeedRef.current = surgeSpeed;
  }, [surgeSpeed]);
  useEffect(() => {
    surgeRotationModeRef.current = surgeRotationMode;
  }, [surgeRotationMode]);
  useEffect(() => {
    surgeRotationSpeedRef.current = surgeRotationSpeed;
  }, [surgeRotationSpeed]);
  useEffect(() => {
    worldBoundaryOnRef.current = worldBoundaryOn;
  }, [worldBoundaryOn]);
  useEffect(() => {
    worldBoundarySizeRef.current = worldBoundarySize;
  }, [worldBoundarySize]);
  useEffect(() => {
    worldBoundaryHeightRef.current = worldBoundaryHeight;
  }, [worldBoundaryHeight]);
  useEffect(() => {
    worldBoundaryYExtendRef.current = worldBoundaryYExtend;
  }, [worldBoundaryYExtend]);
  useEffect(() => {
    noclipFreeFallOnRef.current = noclipFreeFallOn;
    // Mutually exclusive: turning FRITT FALL on cancels OMVÄND STIGNING.
    if (noclipFreeFallOn) setNoclipReverseRiseOn(false);
  }, [noclipFreeFallOn]);
  useEffect(() => {
    noclipReverseRiseOnRef.current = noclipReverseRiseOn;
    if (noclipReverseRiseOn) setNoclipFreeFallOn(false);
  }, [noclipReverseRiseOn]);
  useEffect(() => {
    noclipAutoAlternateIntervalRef.current = noclipAutoAlternateInterval;
  }, [noclipAutoAlternateInterval]);
  // Auto-alternate driver: while on, flips FRITT FALL/OMVÄND STIGNING back
  // and forth every noclipAutoAlternateInterval seconds. Reads the interval
  // from a ref each tick (like the interval-session driver above) so dialing
  // it live never restarts the cycle's current phase. Turning it off (via
  // the toggle or unmount) clears both so noclip falls back to plain
  // HÖJD/NAV control instead of freezing mid-fall or mid-rise.
  useEffect(() => {
    if (!noclipAutoAlternateOn) return;
    let phaseIsFall = true;
    let phaseStart = performance.now();
    setNoclipFreeFallOn(true);
    setNoclipReverseRiseOn(false);
    const id = window.setInterval(() => {
      const durationMs = Math.max(1, noclipAutoAlternateIntervalRef.current) * 1000;
      if (performance.now() - phaseStart >= durationMs) {
        phaseIsFall = !phaseIsFall;
        phaseStart = performance.now();
        setNoclipFreeFallOn(phaseIsFall);
        setNoclipReverseRiseOn(!phaseIsFall);
      }
    }, 100);
    return () => {
      window.clearInterval(id);
      setNoclipFreeFallOn(false);
      setNoclipReverseRiseOn(false);
    };
  }, [noclipAutoAlternateOn]);
  // Live reflection-strength dial → shader (multiplies the surface's base).
  useEffect(() => {
    reflStrengthRef.current = reflStrength;
    applyReflMix();
  }, [reflStrength]);
  useEffect(() => {
    bottomColorRef.current = bottomColor;
  }, [bottomColor]);
  useEffect(() => {
    sphereMaterialRef.current = sphereMaterial;
  }, [sphereMaterial]);
  useEffect(() => {
    causticsOnRef.current = causticsOn;
  }, [causticsOn]);
  useEffect(() => {
    chromaticAberrationOnRef.current = chromaticAberrationOn;
  }, [chromaticAberrationOn]);
  useEffect(() => {
    chromaticAberrationAmountRef.current = chromaticAberrationAmount;
  }, [chromaticAberrationAmount]);
  useEffect(() => {
    sphereStrengthRef.current = sphereStrength;
  }, [sphereStrength]);
  useEffect(() => {
    trochoidRef.current = trochoid;
  }, [trochoid]);
  useEffect(() => {
    heaveSkewRef.current = heaveSkew;
  }, [heaveSkew]);
  useEffect(() => {
    noclipSpeedRef.current = noclipSpeed;
  }, [noclipSpeed]);
  useEffect(() => {
    noclipFallRiseSpeedRef.current = noclipFallRiseSpeed;
  }, [noclipFallRiseSpeed]);
  useEffect(() => {
    noclipVertEaseTimeRef.current = noclipVertEaseTime;
  }, [noclipVertEaseTime]);
  useEffect(() => {
    noclipHeaveOnRef.current = noclipHeaveOn;
  }, [noclipHeaveOn]);
  useEffect(() => {
    noclipSwayOnRef.current = noclipSwayOn;
  }, [noclipSwayOn]);
  useEffect(() => {
    swingPositionYRef.current = swingPositionY;
  }, [swingPositionY]);
  useEffect(() => {
    swingIntensityRef.current = swingIntensity;
  }, [swingIntensity]);
  useEffect(() => {
    swingXFactorRef.current = swingXFactor;
  }, [swingXFactor]);
  useEffect(() => {
    swingHeightRef.current = swingHeight;
  }, [swingHeight]);
  useEffect(() => {
    swingYWaveformRef.current = swingYWaveform;
  }, [swingYWaveform]);
  // Live YTA dial → rescale the already-created water/cloud meshes (a no-op
  // until the WebGL mount effect below has run and populated the refs; that
  // effect applies the same scale itself when first creating them).
  useEffect(() => {
    surfaceAreaRef.current = surfaceArea;
    // The near, finely-tessellated ocean tier stays at scale 1 (see
    // OCEAN_FAR_INNER_RADIUS above) — only its coarse far ring follows the
    // dial, and it's rebuilt (not scaled) so its inner radius stays fixed.
    const farOcean = farOceanRef.current;
    if (farOcean) {
      farOcean.geometry.dispose();
      farOcean.geometry = buildFarOceanGeometry(surfaceArea);
    }
    const cloudScale = surfaceArea / CLOUD_BASE_SIZE;
    midCloudsMeshRef.current?.scale.set(cloudScale, 1, cloudScale);
    skyCloudsMeshRef.current?.scale.set(cloudScale, 1, cloudScale);
    // VÄRLDSGRÄNS's extend cloud layers (see EXTEND_CLOUD_LAYER_* above)
    // are the same skyClouds geometry as separate Mesh instances, each with
    // its own independent scale — missing here, they'd stay stuck at
    // whatever surfaceArea was in effect when they were created (or last
    // refreshed by the render loop's own scale update, which only runs
    // while WORLD BOUNDARY + INFINITE CLOUD LAYERS + SKY CLOUDS are all on
    // and no skybox/backdrop is active), silently drifting out of sync with
    // the base skyClouds mesh above the instant this dial changes under any
    // other configuration — read as freshly-generated layers appearing at
    // the wrong (typically much smaller, since surfaceArea's default is
    // small) size compared to the "standard" cloud.
    for (const layer of extendCloudLayersRef.current) {
      layer.scale.set(cloudScale, 1, cloudScale);
    }
  }, [surfaceArea]);
  // Live torus-ring settings → the field manager (a no-op via `?.` until the
  // WebGL mount effect below has run and constructed it; that effect builds
  // it with these same values as its initial config).
  useEffect(() => {
    torusRingFieldRef.current?.setConfig({
      // LOW GRAPHICS MODE turns the whole field off (extra geometry + lit
      // MeshStandardMaterial draw calls, plus its own optional texture) —
      // see lowGraphicsMode's doc comment in settingsShared.ts.
      enabled: torusRingsOn && !lowGraphicsMode,
      radius: torusRadius,
      tube: torusTube,
      scale: torusScale,
      opacity: torusOpacity,
      textureUrl: lowGraphicsMode ? null : (TORUS_RING_TEXTURES[torusTextureIdx]?.url ?? null),
      cellSize: torusCellSize,
      verticalSpacing: torusVerticalSpacing,
      verticalCount: torusVerticalCount,
      viewDistance: torusViewDistance,
      fadeDistance: torusFadeDistance,
    });
  }, [
    torusRingsOn,
    torusRadius,
    torusTube,
    torusScale,
    torusOpacity,
    torusTextureIdx,
    torusCellSize,
    torusVerticalSpacing,
    torusVerticalCount,
    torusViewDistance,
    torusFadeDistance,
    lowGraphicsMode,
  ]);
  // Mode switch: hand off position/orientation continuity between schemes so
  // switching never teleports the camera. Entering noclip seeds its vertical
  // position from wherever the wave spring last had the camera; entering
  // swing captures the current look yaw as the pendulum's swing plane and
  // arms a short blend (swingBlendRef) so the pendulum's y and horizontal
  // arc ease in from wherever the camera actually was, instead of snapping
  // straight to the swing formula's value for the current clock phase. All
  // three (float included) also reset tornadoAngleRef to 0 so TORNADO's spin
  // (if on) starts fresh rather than resuming whatever angle it was left at
  // by the other mode — TORNADO's own activation/deactivation is eased
  // separately via tornadoBlendRef/vortexBlendRef in the render loop, not by
  // this effect.
  useEffect(() => {
    cameraModeRef.current = cameraMode;
    if (cameraMode === "noclip" || cameraMode === "watercraft") {
      posRef.current.y = camYRef.current ?? swingPositionYRef.current;
      noclipVertVelRef.current = 0;
      noclipHeaveOffsetRef.current = 0;
      tornadoAngleRef.current = 0;
      // Unlike noclip (which deliberately never teleports), entering
      // watercraft mode snaps the camera to just outside the raft — the
      // player could otherwise be flying anywhere in open water with no way
      // to know which direction the raft is in.
      if (cameraMode === "watercraft") {
        posRef.current.x = WATERCRAFT_RAFT_X;
        posRef.current.z = WATERCRAFT_RAFT_Z + 15;
        posRef.current.y = 6;
        camYRef.current = 6;
        yawRef.current = 0;
        pitchRef.current = -0.28;
      }
    } else if (cameraMode === "swing") {
      swingYawRef.current = yawRef.current;
      tornadoAngleRef.current = 0;
      swingBlendRef.current = {
        fromY: camYRef.current ?? swingPositionYRef.current,
        startMs: performance.now(),
      };
    } else if (cameraMode === "float") {
      tornadoAngleRef.current = 0;
    }
  }, [cameraMode]);

  // Keep the bottom camera-settings drawer's active tab in sync with whatever
  // mode the camera actually switches to (top toggle, settings dial, or the
  // interval session driver below) — so it's always showing the dials for
  // the mode currently in effect the moment it's opened.
  useEffect(() => {
    setCameraDrawerTab(cameraMode);
  }, [cameraMode]);

  // Interval session driver: while on, cycles cameraMode through whichever of
  // "float" (FRI/default) and "swing" (GUNGA, optionally TORNADO) are
  // enabled (intervalInclude{Float,Swing}) every intervalDuration seconds,
  // ticking a low-frequency (10Hz) clock for
  // the bottom HUD progress bars. The pool is rebuilt from those refs on
  // every tick so live toggling applies immediately without restarting the
  // effect; falls back to ["float"] if a user switches every mode off. Reads
  // duration/type/count from refs each tick for the same reason. A 10Hz poll
  // (rather than hooking into the WebGL RAF loop) is plenty smooth for a
  // progress bar and keeps this concern fully decoupled from the render loop.
  //
  // Whenever GUNGA is on either side of a transition (leaving it or about to
  // enter it), that switch is held, once the interval's final SYNC_WINDOW_MS
  // begin, until the pendulum (swingThetaRef, kept live by the RAF loop
  // regardless of cameraMode — see its declaration above) next passes
  // through the bottom of its arc (theta crossing zero, nearest the water):
  // entering GUNGA there means it always starts by pulling up away from the
  // water, and leaving GUNGA there means it always hands off right as it's
  // down nearest the water, instead of snapping mid-arc either way. Detected
  // as a sign flip between consecutive 100ms samples rather than an
  // exact-zero epsilon — the bob moves fastest in angle right at the
  // bottom, so a magnitude threshold would be easy to sample straight
  // through, while crossings themselves are seconds apart at any sane
  // GUNGA INTENSITET, far coarser than the poll rate. Falls back to the
  // hard deadline if no crossing turns up in time (e.g. an extremely slow
  // swing), so a session can never hang waiting on one. Transitions that
  // don't involve GUNGA at all always just use the hard deadline, since the
  // pendulum-arc sync has nothing to do with them.
  useEffect(() => {
    if (!intervalSessionOn) {
      setIntervalIndex(0);
      setIntervalProgress(0);
      setIntervalElapsedTotal(0);
      return;
    }
    const SYNC_WINDOW_MS = 5000;
    let stopped = false;
    let idx = 0;
    const sessionStart = performance.now();
    let intervalStart = sessionStart;
    let prevTheta = swingThetaRef.current;
    const buildPool = (): CameraMode[] => {
      const pool: CameraMode[] = [];
      if (intervalIncludeFloatRef.current) pool.push("float");
      if (intervalIncludeSwingRef.current) pool.push("swing");
      return pool.length > 0 ? pool : ["float"];
    };
    setCameraMode(buildPool()[0]);
    setIntervalIndex(0);
    setIntervalProgress(0);
    setIntervalElapsedTotal(0);
    const id = window.setInterval(() => {
      if (stopped) return;
      const now = performance.now();
      const durationMs = Math.max(1, intervalDurationRef.current) * 1000;
      const remainingMs = durationMs - (now - intervalStart);
      const pool = buildPool();
      const curMode = pool[idx % pool.length];
      const nextMode = pool[(idx + 1) % pool.length];
      const involvesSwing = curMode === "swing" || nextMode === "swing";
      const theta = swingThetaRef.current;
      const crossedBottom = Math.sign(theta) !== Math.sign(prevTheta);
      prevTheta = theta;
      const dueBySync = involvesSwing && remainingMs <= SYNC_WINDOW_MS && crossedBottom;
      if (dueBySync || remainingMs <= 0) {
        idx += 1;
        if (intervalSessionTypeRef.current === "fixed" && idx >= intervalCountRef.current) {
          stopped = true;
          setIntervalSessionOn(false);
          return;
        }
        intervalStart = now;
        const nextPool = buildPool();
        setCameraMode(nextPool[idx % nextPool.length]);
        setIntervalIndex(idx);
      }
      setIntervalProgress(Math.min(1, (now - intervalStart) / durationMs));
      setIntervalElapsedTotal((now - sessionStart) / 1000);
    }, 100);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [intervalSessionOn]);
  // Håll VÅGRIKT-spakens visuella läge synkat med waveDir (t.ex. när dialen ändras
  // eller vid uppstart), men bara när spaken själv står i vila.
  useEffect(() => {
    setWaveDirStick((s) => {
      if (Math.hypot(s.x, s.y) > 0.15) return s;
      const rad = (waveDir * Math.PI) / 180;
      return { x: Math.sin(rad), y: Math.cos(rad) };
    });
  }, [waveDir]);

  // Set STRÖM/SVAJ's real direction to an exact bearing (keeping whatever
  // magnitude/strength it already had, defaulting to full if it was at
  // rest), then immediately re-derive the knob's on-screen position for it —
  // the numeric RIKTNING dials go through this instead of dragging the pad.
  const setStickBearing = (
    worldRef: { current: { x: number; z: number } },
    displayRef: { current: { x: number; y: number } },
    setDisplay: (v: { x: number; y: number }) => void,
    deg: number,
  ) => {
    const mag = Math.hypot(worldRef.current.x, worldRef.current.z) || 1;
    const w = bearingToWorldXZ(deg, mag);
    worldRef.current = w;
    const disp = worldXZToPad(w.x, w.z, yawRef.current);
    displayRef.current = disp;
    setDisplay(disp);
    // SVAJ RIKTNING is the one RIKTNING dial that can drive VÅGRIKTNING too —
    // see syncWaveWithSway (SVAJ's on-screen pad does the same in its own
    // onChange handler below).
    if (worldRef === swayWorldRef && syncWaveWithSway) {
      setWaveDir(((deg % 360) + 360) % 360);
    }
  };

  // SURGE DIRECTION's own setter, distinct from setStickBearing above:
  // surgeWorldRef is always a pure unit direction (magnitude carries no
  // meaning the way it does for the STRÖM/SVAJ pads), and — unlike those —
  // it's also rewritten every frame from surgeAngleRef whenever
  // surgeRotationMode is turning or wandering it. Routing manual dial input
  // through surgeAngleRef too (instead of writing surgeWorldRef directly)
  // keeps both in sync, so a manual nudge while cw/ccw/random is running
  // becomes the new starting point instead of being overwritten next frame.
  const setSurgeBearing = (deg: number) => {
    surgeAngleRef.current = ((((deg % 360) + 360) % 360) * Math.PI) / 180;
    const w = { x: Math.sin(surgeAngleRef.current), z: Math.cos(surgeAngleRef.current) };
    surgeWorldRef.current = w;
    const disp = worldXZToPad(w.x, w.z, yawRef.current);
    surgeDisplayRef.current = disp;
    setSurgeStick(disp);
  };

  const resetToDefaults = () => {
    setWaveAmp(DEFAULTS.waveAmp);
    setWaveSpeed(DEFAULTS.waveSpeed);
    setWaveFreq(DEFAULTS.waveFreq);
    setBobSpeed(DEFAULTS.bobSpeed);
    setBuoyAmp(DEFAULTS.buoyAmp);
    setHeightOffset(DEFAULTS.heightOffset);
    setSubmergeAmp(DEFAULTS.submergeAmp);
    setFloatLift(DEFAULTS.floatLift);
    setWaveAnticipation(DEFAULTS.waveAnticipation);
    setCamOffX(DEFAULTS.camOffX);
    setCamOffY(DEFAULTS.camOffY);
    setCamOffZ(DEFAULTS.camOffZ);
    setAudioOn(DEFAULTS.audioOn);
    setAudioVol(DEFAULTS.audioVol);
    setAudioSyncSpeed(DEFAULTS.audioSyncSpeed);
    setAudioSpatial(DEFAULTS.audioSpatial);
    setWaterSoundIdx(DEFAULTS.waterSoundIdx);
    setWaterColorIdx(DEFAULTS.waterColorIdx);
    setWaterOpacity(DEFAULTS.waterOpacity);
    setWaterColorAlpha(DEFAULTS.waterColorAlpha);
    setWaterHue(DEFAULTS.waterHue);
    setWaterSat(DEFAULTS.waterSat);
    setWaterBright(DEFAULTS.waterBright);
    setSurfBright(DEFAULTS.surfBright);
    setSurfSat(DEFAULTS.surfSat);
    setTurbidity(DEFAULTS.turbidity);
    setBottomIdx(DEFAULTS.bottomIdx);
    setLeanEnabled(DEFAULTS.leanEnabled);
    setGogglesOn(DEFAULTS.gogglesOn);
    setGogglesBlur(DEFAULTS.gogglesBlur);
    setGogglesLoop(DEFAULTS.gogglesLoop);
    setGogglesIntensity(DEFAULTS.gogglesIntensity);
    setGogglesFpsCap(DEFAULTS.gogglesFpsCap);
    setTargetFps(DEFAULTS.targetFps);
    setResolutionScale(DEFAULTS.resolutionScale);
    setLowGraphicsMode(DEFAULTS.lowGraphicsMode);
    setRegularWaves(DEFAULTS.regularWaves);
    setRealisticWaves(DEFAULTS.realisticWaves);
    setDyingWave(DEFAULTS.dyingWave);
    setDyingWaveAmp(DEFAULTS.dyingWaveAmp);
    setDyingWaveSpeed(DEFAULTS.dyingWaveSpeed);
    setRandomizeWaves(DEFAULTS.randomizeWaves);
    setWavePreset(DEFAULTS.wavePreset);
    setRegularCross(DEFAULTS.regularCross);
    setRegularPeriod(DEFAULTS.regularPeriod);
    setWavePeak(DEFAULTS.wavePeak);
    setWaveHighQuality(DEFAULTS.waveHighQuality);
    setBackdropIdx(DEFAULTS.backdropIdx);
    setWakeLock(DEFAULTS.wakeLock);
    setCamFov(DEFAULTS.camFov);
    setCamNear(DEFAULTS.camNear);
    setCamFar(DEFAULTS.camFar);
    setWaveDir(DEFAULTS.waveDir);
    setFloorDepth(DEFAULTS.floorDepth);
    setFloorTexture(DEFAULTS.floorTexture);
    setFloorCloudsAnimated(DEFAULTS.floorCloudsAnimated);
    setDepthSineOn(DEFAULTS.depthSineOn);
    setDepthSineAmp(DEFAULTS.depthSineAmp);
    setDepthSineFreq(DEFAULTS.depthSineFreq);
    setDepthSineSpeed(DEFAULTS.depthSineSpeed);
    setDepthSineInterval(DEFAULTS.depthSineInterval);
    setDepthSinePeak(DEFAULTS.depthSinePeak);
    setDepthSineWaveform(DEFAULTS.depthSineWaveform);
    setDepthDriftSpeed(DEFAULTS.depthDriftSpeed);
    depthDriftRef.current = 0;
    depthDriftVelRef.current = 0;
    setHideWater(DEFAULTS.hideWater);
    setMidCloudsOn(DEFAULTS.midCloudsOn);
    setMidCloudsHeight(DEFAULTS.midCloudsHeight);
    setSkyCloudsOn(DEFAULTS.skyCloudsOn);
    setSkyCloudsHeight(DEFAULTS.skyCloudsHeight);
    setCloudFadeSpeed(DEFAULTS.cloudFadeSpeed);
    setSkyPuffsOn(DEFAULTS.skyPuffsOn);
    setSkyPuffsCount(DEFAULTS.skyPuffsCount);
    setSkyPuffsSize(DEFAULTS.skyPuffsSize);
    setSkyPuffsFreq(DEFAULTS.skyPuffsFreq);
    setSkyPuffsOpacity(DEFAULTS.skyPuffsOpacity);
    setSwayAmp(DEFAULTS.swayAmp);
    setSwaySpeed(DEFAULTS.swaySpeed);
    setSwayBias(DEFAULTS.swayBias);
    setSyncWaveWithSway(DEFAULTS.syncWaveWithSway);
    setSurgeAmp(DEFAULTS.surgeAmp);
    setSurgeSpeed(DEFAULTS.surgeSpeed);
    setSurgeRotationMode(DEFAULTS.surgeRotationMode);
    setSurgeRotationSpeed(DEFAULTS.surgeRotationSpeed);
    setWorldBoundaryOn(DEFAULTS.worldBoundaryOn);
    setWorldBoundarySize(DEFAULTS.worldBoundarySize);
    setWorldBoundaryHeight(DEFAULTS.worldBoundaryHeight);
    setWorldBoundaryYExtend(DEFAULTS.worldBoundaryYExtend);
    setLiveMode(DEFAULTS.liveMode);
    setReflStrength(DEFAULTS.reflStrength);
    setBottomColor(DEFAULTS.bottomColor);
    setSphereMaterial(DEFAULTS.sphereMaterial);
    setSphereStrength(DEFAULTS.sphereStrength);
    setTrochoid(DEFAULTS.trochoid);
    setHeaveSkew(DEFAULTS.heaveSkew);
    setCausticsOn(DEFAULTS.causticsOn);
    setChromaticAberrationOn(DEFAULTS.chromaticAberrationOn);
    setChromaticAberrationAmount(DEFAULTS.chromaticAberrationAmount);
    setCameraMode(DEFAULTS.cameraMode);
    setNoclipSpeed(DEFAULTS.noclipSpeed);
    setNoclipFallRiseSpeed(DEFAULTS.noclipFallRiseSpeed);
    setNoclipVertEaseTime(DEFAULTS.noclipVertEaseTime);
    setSwingPositionY(DEFAULTS.swingPositionY);
    setSwingIntensity(DEFAULTS.swingIntensity);
    setSwingXFactor(DEFAULTS.swingXFactor);
    setSwingHeight(DEFAULTS.swingHeight);
    setSwingYWaveform(DEFAULTS.swingYWaveform);
    setTornadoOn(DEFAULTS.tornadoOn);
    setTornadoRadius(DEFAULTS.tornadoRadius);
    setTornadoSpeed(DEFAULTS.tornadoSpeed);
    setTornadoDirection(DEFAULTS.tornadoDirection);
    setTornadoOpening(DEFAULTS.tornadoOpening);
    setTornadoFollowCenter(DEFAULTS.tornadoFollowCenter);
    setTornadoCloudOn(DEFAULTS.tornadoCloudOn);
    setTornadoCloudYOffset(DEFAULTS.tornadoCloudYOffset);
    setIntervalSessionOn(DEFAULTS.intervalSessionOn);
    setIntervalDuration(DEFAULTS.intervalDuration);
    setIntervalSessionType(DEFAULTS.intervalSessionType);
    setIntervalCount(DEFAULTS.intervalCount);
    setIntervalShowStats(DEFAULTS.intervalShowStats);
    setIntervalIncludeFloat(DEFAULTS.intervalIncludeFloat);
    setIntervalIncludeSwing(DEFAULTS.intervalIncludeSwing);
    setSurfaceArea(DEFAULTS.surfaceArea);
    setSwingPreset(DEFAULTS.swingPreset);
    setTorusRingsOn(DEFAULTS.torusRingsOn);
    setTorusRadius(DEFAULTS.torusRadius);
    setTorusTube(DEFAULTS.torusTube);
    setTorusScale(DEFAULTS.torusScale);
    setTorusOpacity(DEFAULTS.torusOpacity);
    setTorusTextureIdx(DEFAULTS.torusTextureIdx);
    setTorusCellSize(DEFAULTS.torusCellSize);
    setTorusVerticalSpacing(DEFAULTS.torusVerticalSpacing);
    setTorusVerticalCount(DEFAULTS.torusVerticalCount);
    setTorusViewDistance(DEFAULTS.torusViewDistance);
    setTorusFadeDistance(DEFAULTS.torusFadeDistance);
    // timeOfDay is intentionally left untouched.
  };

  // Applies any subset of Persisted fields present in `patch` — the shared
  // engine behind the save/load/export/import preset feature (SettingsPanel
  // .tsx's PresetControls): loading a saved preset, importing a JSON file,
  // or restoring a per-tab subset all funnel through here. Unlike
  // resetToDefaults, this *does* touch sceneId/envId/envEra/envTime/
  // surfaceId, since a preset is meant to fully recreate a saved look.
  const applySettingsPatch = (patch: Partial<Persisted>) => {
    if (patch.waveAmp !== undefined) setWaveAmp(patch.waveAmp);
    if (patch.timeOfDay !== undefined) setTimeOfDay(patch.timeOfDay);
    if (patch.waveSpeed !== undefined) setWaveSpeed(patch.waveSpeed);
    if (patch.waveFreq !== undefined) setWaveFreq(patch.waveFreq);
    if (patch.bobSpeed !== undefined) setBobSpeed(patch.bobSpeed);
    if (patch.buoyAmp !== undefined) setBuoyAmp(patch.buoyAmp);
    if (patch.heightOffset !== undefined) setHeightOffset(patch.heightOffset);
    if (patch.submergeAmp !== undefined) setSubmergeAmp(patch.submergeAmp);
    if (patch.floatLift !== undefined) setFloatLift(patch.floatLift);
    if (patch.waveAnticipation !== undefined) setWaveAnticipation(patch.waveAnticipation);
    if (patch.camOffX !== undefined) setCamOffX(patch.camOffX);
    if (patch.camOffY !== undefined) setCamOffY(patch.camOffY);
    if (patch.camOffZ !== undefined) setCamOffZ(patch.camOffZ);
    if (patch.audioOn !== undefined) setAudioOn(patch.audioOn);
    if (patch.audioVol !== undefined) setAudioVol(patch.audioVol);
    if (patch.audioSyncSpeed !== undefined) setAudioSyncSpeed(patch.audioSyncSpeed);
    if (patch.audioSpatial !== undefined) setAudioSpatial(patch.audioSpatial);
    if (patch.waterSoundIdx !== undefined) setWaterSoundIdx(patch.waterSoundIdx);
    if (patch.waterColorIdx !== undefined) setWaterColorIdx(patch.waterColorIdx);
    if (patch.waterOpacity !== undefined) setWaterOpacity(patch.waterOpacity);
    if (patch.waterColorAlpha !== undefined) setWaterColorAlpha(patch.waterColorAlpha);
    if (patch.waterHue !== undefined) setWaterHue(patch.waterHue);
    if (patch.waterSat !== undefined) setWaterSat(patch.waterSat);
    if (patch.waterBright !== undefined) setWaterBright(patch.waterBright);
    if (patch.surfBright !== undefined) setSurfBright(patch.surfBright);
    if (patch.surfSat !== undefined) setSurfSat(patch.surfSat);
    if (patch.turbidity !== undefined) setTurbidity(patch.turbidity);
    if (patch.bottomIdx !== undefined) setBottomIdx(patch.bottomIdx);
    if (patch.leanEnabled !== undefined) setLeanEnabled(patch.leanEnabled);
    if (patch.gogglesOn !== undefined) setGogglesOn(patch.gogglesOn);
    if (patch.gogglesBlur !== undefined) setGogglesBlur(patch.gogglesBlur);
    if (patch.gogglesLoop !== undefined) setGogglesLoop(patch.gogglesLoop);
    if (patch.gogglesIntensity !== undefined) setGogglesIntensity(patch.gogglesIntensity);
    if (patch.gogglesFpsCap !== undefined) setGogglesFpsCap(patch.gogglesFpsCap);
    if (patch.targetFps !== undefined) setTargetFps(patch.targetFps);
    if (patch.resolutionScale !== undefined) setResolutionScale(patch.resolutionScale);
    if (patch.lowGraphicsMode !== undefined) setLowGraphicsMode(patch.lowGraphicsMode);
    if (patch.regularWaves !== undefined) setRegularWaves(patch.regularWaves);
    if (patch.realisticWaves !== undefined) setRealisticWaves(patch.realisticWaves);
    if (patch.dyingWave !== undefined) setDyingWave(patch.dyingWave);
    if (patch.dyingWaveAmp !== undefined) setDyingWaveAmp(patch.dyingWaveAmp);
    if (patch.dyingWaveSpeed !== undefined) setDyingWaveSpeed(patch.dyingWaveSpeed);
    if (patch.randomizeWaves !== undefined) setRandomizeWaves(patch.randomizeWaves);
    if (patch.wavePreset !== undefined) setWavePreset(patch.wavePreset);
    if (patch.regularCross !== undefined) setRegularCross(patch.regularCross);
    if (patch.regularPeriod !== undefined) setRegularPeriod(patch.regularPeriod);
    if (patch.wavePeak !== undefined) setWavePeak(patch.wavePeak);
    if (patch.waveHighQuality !== undefined) setWaveHighQuality(patch.waveHighQuality);
    if (patch.backdropIdx !== undefined) setBackdropIdx(patch.backdropIdx);
    if (patch.wakeLock !== undefined) setWakeLock(patch.wakeLock);
    if (patch.camFov !== undefined) setCamFov(patch.camFov);
    if (patch.camNear !== undefined) setCamNear(patch.camNear);
    if (patch.camFar !== undefined) setCamFar(patch.camFar);
    if (patch.waveDir !== undefined) setWaveDir(patch.waveDir);
    if (patch.floorDepth !== undefined) setFloorDepth(patch.floorDepth);
    if (patch.floorTexture !== undefined) setFloorTexture(patch.floorTexture);
    if (patch.floorCloudsAnimated !== undefined) setFloorCloudsAnimated(patch.floorCloudsAnimated);
    if (patch.depthSineOn !== undefined) setDepthSineOn(patch.depthSineOn);
    if (patch.depthSineAmp !== undefined) setDepthSineAmp(patch.depthSineAmp);
    if (patch.depthSineFreq !== undefined) setDepthSineFreq(patch.depthSineFreq);
    if (patch.depthSineSpeed !== undefined) setDepthSineSpeed(patch.depthSineSpeed);
    if (patch.depthSineInterval !== undefined) setDepthSineInterval(patch.depthSineInterval);
    if (patch.depthSinePeak !== undefined) setDepthSinePeak(patch.depthSinePeak);
    if (patch.depthSineWaveform !== undefined) setDepthSineWaveform(patch.depthSineWaveform);
    if (patch.depthDriftSpeed !== undefined) setDepthDriftSpeed(patch.depthDriftSpeed);
    if (patch.hideWater !== undefined) setHideWater(patch.hideWater);
    if (patch.midCloudsOn !== undefined) setMidCloudsOn(patch.midCloudsOn);
    if (patch.midCloudsHeight !== undefined) setMidCloudsHeight(patch.midCloudsHeight);
    if (patch.skyCloudsOn !== undefined) setSkyCloudsOn(patch.skyCloudsOn);
    if (patch.skyCloudsHeight !== undefined) setSkyCloudsHeight(patch.skyCloudsHeight);
    if (patch.cloudFadeSpeed !== undefined) setCloudFadeSpeed(patch.cloudFadeSpeed);
    if (patch.skyPuffsOn !== undefined) setSkyPuffsOn(patch.skyPuffsOn);
    if (patch.skyPuffsCount !== undefined) setSkyPuffsCount(patch.skyPuffsCount);
    if (patch.skyPuffsSize !== undefined) setSkyPuffsSize(patch.skyPuffsSize);
    if (patch.skyPuffsFreq !== undefined) setSkyPuffsFreq(patch.skyPuffsFreq);
    if (patch.skyPuffsOpacity !== undefined) setSkyPuffsOpacity(patch.skyPuffsOpacity);
    if (patch.swayAmp !== undefined) setSwayAmp(patch.swayAmp);
    if (patch.swaySpeed !== undefined) setSwaySpeed(patch.swaySpeed);
    if (patch.swayBias !== undefined) setSwayBias(patch.swayBias);
    if (patch.syncWaveWithSway !== undefined) setSyncWaveWithSway(patch.syncWaveWithSway);
    if (patch.surgeAmp !== undefined) setSurgeAmp(patch.surgeAmp);
    if (patch.surgeSpeed !== undefined) setSurgeSpeed(patch.surgeSpeed);
    if (patch.surgeRotationMode !== undefined) setSurgeRotationMode(patch.surgeRotationMode);
    if (patch.surgeRotationSpeed !== undefined) setSurgeRotationSpeed(patch.surgeRotationSpeed);
    if (patch.worldBoundaryOn !== undefined) setWorldBoundaryOn(patch.worldBoundaryOn);
    if (patch.worldBoundarySize !== undefined) setWorldBoundarySize(patch.worldBoundarySize);
    if (patch.worldBoundaryHeight !== undefined) setWorldBoundaryHeight(patch.worldBoundaryHeight);
    if (patch.worldBoundaryYExtend !== undefined)
      setWorldBoundaryYExtend(patch.worldBoundaryYExtend);
    if (patch.liveMode !== undefined) setLiveMode(patch.liveMode);
    if (patch.sceneId !== undefined) setSceneId(patch.sceneId);
    if (patch.envId !== undefined) setEnvId(patch.envId);
    if (patch.envEra !== undefined) setEnvEra(patch.envEra);
    if (patch.envTime !== undefined) setEnvTime(patch.envTime);
    if (patch.timeTravelBaseMs !== undefined) setTimeTravelBaseMs(patch.timeTravelBaseMs);
    if (patch.timeTravelSetAtMs !== undefined) setTimeTravelSetAtMs(patch.timeTravelSetAtMs);
    if (patch.timeSeasonalSync !== undefined) setTimeSeasonalSync(patch.timeSeasonalSync);
    if (patch.clockOn !== undefined) setClockOn(patch.clockOn);
    if (patch.surfaceId !== undefined) setSurfaceId(patch.surfaceId);
    if (patch.reflStrength !== undefined) setReflStrength(patch.reflStrength);
    if (patch.bottomColor !== undefined) setBottomColor(patch.bottomColor);
    if (patch.sphereMaterial !== undefined) setSphereMaterial(patch.sphereMaterial);
    if (patch.sphereStrength !== undefined) setSphereStrength(patch.sphereStrength);
    if (patch.trochoid !== undefined) setTrochoid(patch.trochoid);
    if (patch.heaveSkew !== undefined) setHeaveSkew(patch.heaveSkew);
    if (patch.causticsOn !== undefined) setCausticsOn(patch.causticsOn);
    if (patch.chromaticAberrationOn !== undefined)
      setChromaticAberrationOn(patch.chromaticAberrationOn);
    if (patch.chromaticAberrationAmount !== undefined)
      setChromaticAberrationAmount(patch.chromaticAberrationAmount);
    if (patch.cameraMode !== undefined) setCameraMode(patch.cameraMode);
    if (patch.noclipSpeed !== undefined) setNoclipSpeed(patch.noclipSpeed);
    if (patch.noclipFallRiseSpeed !== undefined) setNoclipFallRiseSpeed(patch.noclipFallRiseSpeed);
    if (patch.noclipVertEaseTime !== undefined) setNoclipVertEaseTime(patch.noclipVertEaseTime);
    if (patch.swingPositionY !== undefined) setSwingPositionY(patch.swingPositionY);
    if (patch.swingIntensity !== undefined) setSwingIntensity(patch.swingIntensity);
    if (patch.swingXFactor !== undefined) setSwingXFactor(patch.swingXFactor);
    if (patch.swingHeight !== undefined) setSwingHeight(patch.swingHeight);
    if (patch.swingPreset !== undefined) setSwingPreset(patch.swingPreset);
    if (patch.swingYWaveform !== undefined) setSwingYWaveform(patch.swingYWaveform);
    if (patch.tornadoOn !== undefined) setTornadoOn(patch.tornadoOn);
    if (patch.tornadoRadius !== undefined) setTornadoRadius(patch.tornadoRadius);
    if (patch.tornadoSpeed !== undefined) setTornadoSpeed(patch.tornadoSpeed);
    if (patch.tornadoDirection !== undefined) setTornadoDirection(patch.tornadoDirection);
    if (patch.tornadoOpening !== undefined) setTornadoOpening(patch.tornadoOpening);
    if (patch.tornadoFollowCenter !== undefined)
      setTornadoFollowCenter(patch.tornadoFollowCenter);
    if (patch.tornadoCloudOn !== undefined) setTornadoCloudOn(patch.tornadoCloudOn);
    if (patch.tornadoCloudYOffset !== undefined)
      setTornadoCloudYOffset(patch.tornadoCloudYOffset);
    if (patch.intervalSessionOn !== undefined) setIntervalSessionOn(patch.intervalSessionOn);
    if (patch.intervalDuration !== undefined) setIntervalDuration(patch.intervalDuration);
    if (patch.intervalSessionType !== undefined) setIntervalSessionType(patch.intervalSessionType);
    if (patch.intervalCount !== undefined) setIntervalCount(patch.intervalCount);
    if (patch.intervalShowStats !== undefined) setIntervalShowStats(patch.intervalShowStats);
    if (patch.intervalIncludeFloat !== undefined)
      setIntervalIncludeFloat(patch.intervalIncludeFloat);
    if (patch.intervalIncludeSwing !== undefined)
      setIntervalIncludeSwing(patch.intervalIncludeSwing);
    if (patch.surfaceArea !== undefined) setSurfaceArea(patch.surfaceArea);
    if (patch.torusRingsOn !== undefined) setTorusRingsOn(patch.torusRingsOn);
    if (patch.torusRadius !== undefined) setTorusRadius(patch.torusRadius);
    if (patch.torusTube !== undefined) setTorusTube(patch.torusTube);
    if (patch.torusScale !== undefined) setTorusScale(patch.torusScale);
    if (patch.torusOpacity !== undefined) setTorusOpacity(patch.torusOpacity);
    if (patch.torusTextureIdx !== undefined) setTorusTextureIdx(patch.torusTextureIdx);
    if (patch.torusCellSize !== undefined) setTorusCellSize(patch.torusCellSize);
    if (patch.torusVerticalSpacing !== undefined)
      setTorusVerticalSpacing(patch.torusVerticalSpacing);
    if (patch.torusVerticalCount !== undefined) setTorusVerticalCount(patch.torusVerticalCount);
    if (patch.torusViewDistance !== undefined) setTorusViewDistance(patch.torusViewDistance);
    if (patch.torusFadeDistance !== undefined) setTorusFadeDistance(patch.torusFadeDistance);
  };

  // Which Persisted fields a given preset scope owns — "all" is every field
  // the settings dialog exposes, a tab id is just that tab's fields.
  const fieldsForScope = (scope: PresetScope): (keyof Persisted)[] =>
    scope === "all" ? PRESET_ALL_FIELDS : PRESET_TAB_FIELDS[scope];

  // Restricts an arbitrary (e.g. imported/loaded) data object down to the
  // fields `scope` actually owns, dropping anything else it might contain.
  const filterToScope = (scope: PresetScope, data: Record<string, unknown>): Partial<Persisted> => {
    const allowed = new Set<string>(fieldsForScope(scope));
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (allowed.has(k)) patch[k] = v;
    }
    return patch as Partial<Persisted>;
  };

  // EXPORTERA: downloads the current settings (all tabs, or just one) as a
  // JSON file via the File API.
  const exportSettingsFile = (scope: PresetScope) => {
    const snapshot = buildPersistedSnapshot();
    const data = pickFields(snapshot, fieldsForScope(scope));
    const payload = buildPresetFilePayload(scope, data);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadJsonFile(`aquafulness-${scope}-preset-${stamp}.json`, payload);
  };

  // IMPORTERA: reads a JSON file (dropped via the File API's file picker)
  // and applies whichever of its fields belong to `scope`.
  const importSettingsFile = async (scope: PresetScope, file: File) => {
    try {
      const raw = await readJsonFile(file);
      const data = extractPresetData(raw);
      if (!data) throw new Error("invalid preset file");
      applySettingsPatch(filterToScope(scope, data));
    } catch {
      window.alert(t("presets.invalidPresetFile"));
    }
  };

  // SPARA: saves the current settings (all tabs, or just one) as a named
  // preset in localStorage, for later one-click recall via LÄS IN.
  const savePresetAs = (scope: PresetScope, name: string) => {
    const snapshot = buildPersistedSnapshot();
    const data = pickFields(snapshot, fieldsForScope(scope)) as Record<string, unknown>;
    setSavedPresets((list) => addSavedPreset(list, name, scope, data));
  };

  // LÄS IN: applies a previously saved named preset.
  const loadSavedPreset = (id: string) => {
    const preset = savedPresets.find((p) => p.id === id);
    if (!preset) return;
    applySettingsPatch(filterToScope(preset.scope, preset.data));
  };

  // RADERA: removes a previously saved named preset.
  const deleteSavedPreset = (id: string) => {
    setSavedPresets((list) => removeSavedPreset(list, id));
  };

  // The runtime-only half of a full "state" save/load (as opposed to a
  // parameters-only preset above): the player's live position/look and the
  // STRÖM/SVAJ world-space direction vectors. None of these are part of
  // Persisted — they're deliberately ref-only/runtime state (see
  // driftWorldRef/swayWorldRef and CAMERA_STORAGE_KEY's separate pose
  // autosave) — so a full state save has to capture them separately.
  const buildRuntimeSnapshot = (): RuntimeState => ({
    camera: {
      x: posRef.current.x,
      y: posRef.current.y,
      z: posRef.current.z,
      yaw: yawRef.current,
      pitch: pitchRef.current,
    },
    driftDir: { x: driftWorldRef.current.x, z: driftWorldRef.current.z },
    swayDir: { x: swayWorldRef.current.x, z: swayWorldRef.current.z },
    noclipDriftDir: { x: noclipDriftWorldRef.current.x, z: noclipDriftWorldRef.current.z },
    noclipVertDrift: { x: vertStickRef.current.x, y: vertStickRef.current.y },
    surgeDir: { x: surgeWorldRef.current.x, z: surgeWorldRef.current.z },
  });

  const applyRuntimeState = (runtime: RuntimeState) => {
    posRef.current.x = runtime.camera.x;
    posRef.current.y = runtime.camera.y;
    posRef.current.z = runtime.camera.z;
    yawRef.current = runtime.camera.yaw;
    pitchRef.current = runtime.camera.pitch;
    saveCameraPose({
      x: posRef.current.x,
      y: posRef.current.y,
      z: posRef.current.z,
      yaw: yawRef.current,
      pitch: pitchRef.current,
    });

    driftWorldRef.current = runtime.driftDir;
    const driftDisp = worldXZToPad(runtime.driftDir.x, runtime.driftDir.z, yawRef.current);
    driftDisplayRef.current = driftDisp;
    setDriftStick(driftDisp);

    swayWorldRef.current = runtime.swayDir;
    const swayDisp = worldXZToPad(runtime.swayDir.x, runtime.swayDir.z, yawRef.current);
    swayDisplayRef.current = swayDisp;
    setSwayStick(swayDisp);

    if (runtime.noclipDriftDir) {
      noclipDriftWorldRef.current = runtime.noclipDriftDir;
      const noclipDriftDisp = worldXZToPad(
        runtime.noclipDriftDir.x,
        runtime.noclipDriftDir.z,
        yawRef.current,
      );
      noclipDriftDisplayRef.current = noclipDriftDisp;
      setNoclipDriftStick(noclipDriftDisp);
    }
    if (runtime.noclipVertDrift) {
      vertStickRef.current = runtime.noclipVertDrift;
      setVertStick(runtime.noclipVertDrift);
    }
    if (runtime.surgeDir) {
      surgeWorldRef.current = runtime.surgeDir;
      surgeAngleRef.current = Math.atan2(runtime.surgeDir.x, runtime.surgeDir.z);
      const surgeDisp = worldXZToPad(runtime.surgeDir.x, runtime.surgeDir.z, yawRef.current);
      surgeDisplayRef.current = surgeDisp;
      setSurgeStick(surgeDisp);
    }
  };

  // A full state snapshot is every settings field (like an "all"-scope
  // preset) plus the runtime snapshot above, flattened into one object with
  // the runtime piece nested under "runtime" so import can tell them apart.
  const buildFullStateSnapshot = (): Record<string, unknown> => ({
    ...pickFields(buildPersistedSnapshot(), PRESET_ALL_FIELDS),
    runtime: buildRuntimeSnapshot(),
  });

  // Applies a full state object: every recognized Persisted field, plus
  // (if present and well-formed) the runtime position/look/current/sway.
  const applyFullState = (data: Record<string, unknown>) => {
    const { runtime, ...settingsData } = data;
    applySettingsPatch(filterToScope("all", settingsData));
    if (isValidRuntimeState(runtime)) applyRuntimeState(runtime);
  };

  // TILLSTÅND EXPORTERA: downloads the full live state (settings + player
  // position/look + current/sway) as a JSON file via the File API.
  const exportStateFile = () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadJsonFile(
      `aquafulness-state-${stamp}.json`,
      buildStateFilePayload(buildFullStateSnapshot()),
    );
  };

  // TILLSTÅND IMPORTERA: reads a JSON state file and applies it in full.
  const importStateFile = async (file: File) => {
    try {
      const raw = await readJsonFile(file);
      const data = extractStateData(raw);
      if (!data) throw new Error("invalid state file");
      applyFullState(data);
    } catch {
      window.alert(t("presets.invalidStateFile"));
    }
  };

  // TILLSTÅND SPARA: saves the full live state as a named entry in
  // localStorage, for later one-click recall via LÄS IN.
  const saveStateAs = (name: string) => {
    setSavedStates((list) => addSavedState(list, name, buildFullStateSnapshot()));
  };

  // TILLSTÅND LÄS IN: applies a previously saved named state.
  const loadSavedStateById = (id: string) => {
    const state = savedStates.find((s) => s.id === id);
    if (!state) return;
    applyFullState(state.data);
  };

  // TILLSTÅND RADERA: removes a previously saved named state.
  const deleteSavedState = (id: string) => {
    setSavedStates((list) => removeSavedState(list, id));
  };

  // DELA BADLÄNK: encodes every setting (same field set as an "all"-scope
  // preset) plus the camera's live position/look, and an optional title/
  // description meant for the link's Open Graph preview, into a single
  // base62 string — no server round trip, the URL alone fully recreates
  // this bath (see src/lib/shareState.ts and routes/bathing.$payload.tsx,
  // which decodes it back and seeds STORAGE_KEY/CAMERA_STORAGE_KEY before
  // this same component mounts again).
  const buildBathLink = async (title: string, description: string): Promise<string> => {
    const payload: BathPayload = {
      v: 1,
      s: pickFields(buildPersistedSnapshot(), PRESET_ALL_FIELDS) as Record<string, unknown>,
      c: {
        x: posRef.current.x,
        y: posRef.current.y,
        z: posRef.current.z,
        yaw: yawRef.current,
        pitch: pitchRef.current,
      },
    };
    const trimmedTitle = title.trim().slice(0, BATH_TITLE_MAX_LENGTH);
    const trimmedDescription = description.trim().slice(0, BATH_DESCRIPTION_MAX_LENGTH);
    if (trimmedTitle) payload.t = trimmedTitle;
    if (trimmedDescription) payload.d = trimmedDescription;
    const encoded = await encodeStateToBase62(payload);
    return buildBathUrl(window.location.origin, encoded);
  };

  // VÅGPRESET: applies a bundle of wave-only settings in one step (see
  // WAVE_PRESETS above) — everything else (camera, water color,
  // environment, ...) is left untouched, unlike the full resetToDefaults().
  const applyWavePreset = (preset: WavePresetName) => {
    const p = WAVE_PRESETS[preset];
    setWavePreset(preset);
    setWaveAmp(p.waveAmp);
    setWaveSpeed(p.waveSpeed);
    setWaveFreq(p.waveFreq);
    setRegularWaves(p.regularWaves);
    setRealisticWaves(p.realisticWaves);
    setDyingWave(p.dyingWave);
    setDyingWaveAmp(p.dyingWaveAmp);
    setDyingWaveSpeed(p.dyingWaveSpeed);
    setRegularCross(p.regularCross);
    setRegularPeriod(p.regularPeriod);
    setWavePeak(p.wavePeak);
  };

  // Jump the camera back to the last autosaved free-roam position/look
  // direction. Reads localStorage fresh (rather than a stale ref) so it
  // always restores whatever was most recently saved, including from a
  // previous page load.
  const restoreCameraPosition = () => {
    const saved = loadCameraPose();
    if (!saved) return;
    posRef.current.x = saved.x;
    posRef.current.z = saved.z;
    if (typeof saved.y === "number") posRef.current.y = saved.y;
    yawRef.current = saved.yaw;
    pitchRef.current = saved.pitch;
  };

  // Cycle through the three camera movement schemes (float / noclip / swing).
  const cycleCameraMode = (dir: number) => {
    const idx = CAMERA_MODES.indexOf(cameraMode);
    setCameraMode(CAMERA_MODES[(idx + dir + CAMERA_MODES.length) % CAMERA_MODES.length]);
  };

  // LEVEL DRIFT's dedicated reset button: setting depthDriftSpeed to 0 alone
  // only stops *further* drift — depthDriftVelRef would still ease its
  // existing velocity down over about half a second, and whatever offset
  // depthDriftRef already accumulated would stay right where it was instead
  // of the water level actually coming back to normal. A real reset needs
  // all three snapped to 0 at once.
  const resetDepthDrift = () => {
    setDepthDriftSpeed(0);
    depthDriftVelRef.current = 0;
    depthDriftRef.current = 0;
  };

  // Sky-swing's starting height: a fixed preset snaps GUNGA POSITION Y to a
  // sane value immediately; "custom" just marks the dial as freely user-set.
  const applySwingPreset = (preset: SwingPreset) => {
    setSwingPreset(preset);
    if (preset === "water") setSwingPositionY(12);
    else if (preset === "clouds") setSwingPositionY(Math.round(60 + skyCloudsHeight * 440));
  };
  const cycleSwingPreset = (dir: number) => {
    const idx = SWING_PRESETS.indexOf(swingPreset);
    applySwingPreset(SWING_PRESETS[(idx + dir + SWING_PRESETS.length) % SWING_PRESETS.length]);
  };
  const cycleSwingYWaveform = (dir: number) => {
    const idx = SWING_Y_WAVEFORMS.indexOf(swingYWaveform);
    setSwingYWaveform(
      SWING_Y_WAVEFORMS[(idx + dir + SWING_Y_WAVEFORMS.length) % SWING_Y_WAVEFORMS.length],
    );
  };
  const cycleDepthSineWaveform = (dir: number) => {
    const idx = DEPTH_SINE_WAVEFORMS.indexOf(depthSineWaveform);
    setDepthSineWaveform(
      DEPTH_SINE_WAVEFORMS[(idx + dir + DEPTH_SINE_WAVEFORMS.length) % DEPTH_SINE_WAVEFORMS.length],
    );
  };

  // Step through the available scenes, including an "AV" (no model) slot.
  const cycleScene = (dir: number) => {
    const options: (string | null)[] = [null, ...scenes.map((s) => s.id)];
    const cur = options.indexOf(sceneId ?? null);
    const idx = cur < 0 ? 0 : cur;
    const next = (idx + dir + options.length) % options.length;
    setSceneId(options[next]);
  };

  // Currently selected spawn location (never empty — spawnLocations always
  // carries at least the {0,0,0} fallback, see resolveSpawnLocations).
  const curSpawnLocation =
    spawnLocations.find((l) => l.id === spawnLocationId) ??
    spawnLocations[0] ??
    DEFAULT_SPAWN_LOCATION;

  // Step through the current scene's named spawn locations.
  const cycleSpawnLocation = (dir: number) => {
    const idx = spawnLocations.findIndex((l) => l.id === curSpawnLocation.id);
    const next = ((idx < 0 ? 0 : idx) + dir + spawnLocations.length) % spawnLocations.length;
    setSpawnLocationId(spawnLocations[next].id);
  };

  // Teleport the player to the currently selected spawn location, persisting
  // the new pose immediately (mirrors applyRuntimeState below) so it survives
  // a reload even before the next autosave tick.
  const respawn = () => {
    const loc = curSpawnLocation;
    posRef.current.x = loc.x;
    posRef.current.y = loc.y;
    posRef.current.z = loc.z;
    yawRef.current = loc.yaw;
    pitchRef.current = 0;
    camYRef.current = loc.y;
    saveCameraPose({ x: loc.x, y: loc.y, z: loc.z, yaw: loc.yaw, pitch: 0 });
  };

  // Currently selected environment / era / time objects (null when unset).
  const curEnv = environments.find((e) => e.id === envId) ?? null;
  const curEra = curEnv?.eras.find((er) => er.id === envEra) ?? null;
  const curTime = curEra?.times.find((tm) => tm.id === envTime) ?? null;

  // Selecting an environment cascades to its first era + time.
  const applyEnv = (id: string | null) => {
    if (!id) {
      setEnvId(null);
      setEnvEra(null);
      setEnvTime(null);
      return;
    }
    const env = environments.find((e) => e.id === id) ?? null;
    const era = env?.eras[0] ?? null;
    setEnvId(id);
    setEnvEra(era?.id ?? null);
    setEnvTime(era?.times[0]?.id ?? null);
  };

  // Step through environments, including an "AV" (procedural sky) slot.
  const cycleEnv = (dir: number) => {
    const options: (string | null)[] = [null, ...environments.map((e) => e.id)];
    const cur = options.indexOf(envId ?? null);
    const idx = cur < 0 ? 0 : cur;
    applyEnv(options[(idx + dir + options.length) % options.length]);
  };

  // Selecting an era (directly, e.g. from a dropdown) cascades to its first time.
  const applyEra = (id: string) => {
    const era = curEnv?.eras.find((e) => e.id === id);
    setEnvEra(id);
    setEnvTime(era?.times[0]?.id ?? null);
  };
  const cycleEra = (dir: number) => {
    if (!curEnv || curEnv.eras.length === 0) return;
    const eras = curEnv.eras;
    const i = Math.max(
      0,
      eras.findIndex((e) => e.id === envEra),
    );
    applyEra(eras[(i + dir + eras.length) % eras.length].id);
  };

  const cycleTime = (dir: number) => {
    if (!curEra || curEra.times.length === 0) return;
    const times = curEra.times;
    const i = Math.max(
      0,
      times.findIndex((t) => t.id === envTime),
    );
    setEnvTime(times[(i + dir + times.length) % times.length].id);
  };

  // DATE & TIME TRAVEL: once a minute, advance the simulated clock (real
  // time, or a time-traveled date ticking forward from wherever it was
  // pinned — see simulatedDate()), optionally sync TIMEOFDAY to that date's
  // real northern-hemisphere sunrise/sunset, and gate the current
  // environment's era to its futuristic look once the simulated year passes
  // FUTURISTIC_YEAR (only for environments that actually have a "future"
  // era, and never overriding an era the user picked by hand). A minute
  // (rather than a second) is plenty for a HH:MM readout and for how slowly
  // sunrise/sunset actually drifts, and keeps this from re-rendering the
  // whole component — a real cost given its size — more than once a minute.
  //
  // Gated by CLOCK_DISABLED_FOR_PERF_TEST above (a dev-only perf kill
  // switch) and by clockOn (the user-facing setting that turns the whole
  // feature off — see its Settings-type comment) — either disables this,
  // along with the clock button/dialog in the HUD.
  useEffect(() => {
    if (CLOCK_DISABLED_FOR_PERF_TEST || !clockOn) return;
    const tick = () => {
      const date = simulatedDate(timeTravelBaseMs, timeTravelSetAtMs);
      setSimNow(date);

      if (timeSeasonalSync) {
        setTimeOfDay(northernHemisphereTimeOfDay(date));
      }

      const env = environments.find((e) => e.id === envId);
      const wantFuturistic = isFuturisticYear(date);
      const hasFutureEra = env?.eras.some((e) => e.id === "future") ?? false;
      const hasPresentEra = env?.eras.some((e) => e.id === "present") ?? false;
      if (wantFuturistic && hasFutureEra && envEra !== "future") {
        autoFuturisticEraRef.current = true;
        setEnvEra("future");
        setEnvTime((prev) => {
          const era = env?.eras.find((e) => e.id === "future");
          return era?.times.some((tm) => tm.id === prev) ? prev : (era?.times[0]?.id ?? prev);
        });
      } else if (!wantFuturistic && autoFuturisticEraRef.current && envEra === "future") {
        autoFuturisticEraRef.current = false;
        const fallback = hasPresentEra ? "present" : (env?.eras[0]?.id ?? null);
        if (fallback) {
          setEnvEra(fallback);
          setEnvTime((prev) => {
            const era = env?.eras.find((e) => e.id === fallback);
            return era?.times.some((tm) => tm.id === prev) ? prev : (era?.times[0]?.id ?? prev);
          });
        }
      }
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [timeTravelBaseMs, timeTravelSetAtMs, timeSeasonalSync, clockOn, environments, envId, envEra]);

  // Step through the reflection surfaces, including an "AV" (gradient-only) slot.
  const cycleSurface = (dir: number) => {
    const options: (string | null)[] = [null, ...surfaces.map((s) => s.id)];
    const cur = options.indexOf(surfaceId ?? null);
    const idx = cur < 0 ? 0 : cur;
    setSurfaceId(options[(idx + dir + options.length) % options.length]);
  };

  // Push the effective reflection blend (surface base × live strength) into the
  // water shader. Cheap and idempotent; called on surface load and dial change.
  const applyReflMix = () => {
    const u = waterUniformsRef.current;
    if (!u) return;
    u.uReflMix.value = lowGraphicsModeRef.current
      ? 0
      : Math.max(0, Math.min(1, reflBaseRef.current * reflStrengthRef.current));
  };

  // Ocean sound: loop the selected recorded water track (see WATER_SOUNDS)
  // through a lowpass + depth gain so we can still muffle & boost it based
  // on how deep the camera is.
  useEffect(() => {
    if (!audioOn) {
      if (audioRef.current) {
        const a = audioRef.current;
        a.master.gain.cancelScheduledValues(a.ctx.currentTime);
        a.master.gain.setTargetAtTime(0, a.ctx.currentTime, 0.4);
        const dying = a;
        setTimeout(() => {
          try {
            dying.el.pause();
          } catch {
            /* noop */
          }
          try {
            dying.ctx.close();
          } catch {
            /* noop */
          }
        }, 600);
        audioRef.current = null;
      }
      return;
    }
    // This effect also re-runs when the selected water sound changes while
    // audio is already on, so tear down any existing graph immediately
    // (no fade — it's a deliberate track swap, not a mute) before rebuilding.
    if (audioRef.current) {
      const prev = audioRef.current;
      try {
        prev.el.pause();
      } catch {
        /* noop */
      }
      try {
        prev.ctx.close();
      } catch {
        /* noop */
      }
      audioRef.current = null;
    }
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();

    const el = new Audio(WATER_SOUNDS[waterSoundIdx]?.url ?? WATER_SOUNDS[0].url);
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

    el.play().catch(() => {
      /* user gesture required — will retry on next toggle */
    });
    master.gain.setTargetAtTime(audioVol, ctx.currentTime, 0.6);

    audioRef.current = { ctx, el, master, depthGain, lp };
  }, [audioOn, waterSoundIdx]);

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
  // re-request it when the tab becomes visible again. The OS/browser can
  // also drop the lock on its own while the page stays visible (observed
  // on Android Chrome under thermal throttling); the sentinel's "release"
  // event fires either way, so we re-acquire there too unless it was us
  // releasing it on purpose (tab hide, toggle off, unmount).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
    };
    if (!nav.wakeLock) return;

    let sentinel: WakeLockSentinel | null = null;
    let active = true;
    let releasingManually = false;

    const request = async () => {
      if (!wakeLock || document.hidden) return;
      try {
        const s = await nav.wakeLock!.request("screen");
        if (!active) {
          s.release().catch(() => {
            /* noop */
          });
          return;
        }
        sentinel = s;
        s.addEventListener("release", () => {
          sentinel = null;
          if (releasingManually) {
            releasingManually = false;
            return;
          }
          if (active && wakeLock && !document.hidden) {
            request();
          }
        });
      } catch {
        // User gesture or permission may be missing — silently fail.
      }
    };

    const release = () => {
      if (sentinel) {
        releasingManually = true;
        sentinel.release().catch(() => {
          releasingManually = false;
        });
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
  // Paused while the settings panel is open so users can adjust without the UI vanishing.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const IDLE_MS = 3500;
    const bump = () => {
      setUiVisible(true);
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      if (settingsOpen) return;
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
      document.documentElement.requestFullscreen?.().catch(() => {
        /* noop */
      });
    } else {
      document.exitFullscreen?.().catch(() => {
        /* noop */
      });
    }
  };

  // Discover the available .glb scenes from public/scenes/scenes.json.
  useEffect(() => {
    let alive = true;
    fetch("/scenes/scenes.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no scenes.json"))))
      .then((data: unknown) => {
        if (!alive) return;
        const raw = Array.isArray(data) ? data : ((data as { scenes?: unknown }).scenes ?? []);
        const list: SceneEntry[] = (Array.isArray(raw) ? raw : [])
          .map((s) => {
            const e = s as { id?: unknown; name?: unknown };
            return typeof e.id === "string"
              ? { id: e.id, name: typeof e.name === "string" ? e.name : e.id }
              : null;
          })
          .filter((s): s is SceneEntry => s !== null);
        setScenes(list);
        // Drop a persisted selection that no longer exists.
        setSceneId((cur) => (cur && !list.some((s) => s.id === cur) ? null : cur));
      })
      .catch(() => {
        if (alive) setScenes([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Discover the available skybox environments from environment.json.
  useEffect(() => {
    let alive = true;
    fetch("/environments/environment.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no environment.json"))))
      .then((data: unknown) => {
        if (alive) setEnvironments(parseEnvironments(data));
      })
      .catch(() => {
        if (alive) setEnvironments([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Once the environment list loads, repair a persisted selection whose
  // env/era/time no longer exists (e.g. renamed or removed on disk).
  useEffect(() => {
    if (environments.length === 0 || !envId) return;
    const env = environments.find((e) => e.id === envId);
    if (!env) {
      setEnvId(null);
      setEnvEra(null);
      setEnvTime(null);
      return;
    }
    const era = env.eras.find((e) => e.id === envEra) ?? env.eras[0] ?? null;
    if (era?.id !== envEra) setEnvEra(era?.id ?? null);
    const time = era?.times.find((t) => t.id === envTime) ?? era?.times[0] ?? null;
    if (time?.id !== envTime) setEnvTime(time?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [environments]);

  // Discover the available reflection surfaces from surfaces.json.
  useEffect(() => {
    let alive = true;
    fetch("/surfaces/surfaces.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no surfaces.json"))))
      .then((data: unknown) => {
        if (!alive) return;
        const raw = Array.isArray(data) ? data : ((data as { surfaces?: unknown }).surfaces ?? []);
        const list: SurfaceEntry[] = (Array.isArray(raw) ? raw : [])
          .map((s) => {
            const e = s as { id?: unknown; name?: unknown };
            return typeof e.id === "string"
              ? { id: e.id, name: typeof e.name === "string" ? e.name : e.id }
              : null;
          })
          .filter((s): s is SurfaceEntry => s !== null);
        setSurfaces(list);
        setSurfaceId((cur) => (cur && !list.some((s) => s.id === cur) ? null : cur));
      })
      .catch(() => {
        if (alive) setSurfaces([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * resolutionScaleRef.current);
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x032033, 1);
    // Positioned (not static) to match the CSS3D layer's own `position:
    // absolute` — both are in the same stacking context, so DOM order (the
    // CSS3D root is inserted before this canvas, see CSS3DTVManager) is what
    // decides paint order between them, enabling per-pixel occlusion via the
    // occluder-mesh technique. A static canvas would always paint above a
    // positioned sibling regardless of DOM order.
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.top = "0";
    renderer.domElement.style.left = "0";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // Above water this stays at density 0 (no whiteout of distant objects);
    // it only ramps up once submerged, to sell the underwater murk on
    // default-material objects like .glb scenes and torus rings — see the
    // per-frame update below.
    scene.fog = new THREE.FogExp2(0x88aacc, 0);
    // Expose the scene graph so the scene-selector effect can add/remove models.
    sceneRef.current = scene;

    // The ocean/sky are custom ShaderMaterials that compute their own
    // lighting from uSunDir/uSunColor and never touch scene lights — but
    // loaded .glb scenes (Strandpark etc.) and the CSS3D TV panel's occluder
    // meshes use glTF's default MeshStandardMaterial, which renders pure
    // black with no scene lights at all. sunLight/hemiLight exist only for
    // those: driven every frame from the same time-of-day palette() the
    // shaders use (see the per-frame block below), so lit models stay
    // consistent with the sky/sun color instead of using a fixed light.
    const sunLight = new THREE.DirectionalLight(0xffffff, 1);
    scene.add(sunLight);
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x223344, 0.6);
    scene.add(hemiLight);

    const camera = new THREE.PerspectiveCamera(
      camFovRef.current,
      mount.clientWidth / mount.clientHeight,
      camNearRef.current,
      camFarRef.current,
    );

    const tvManager = new CSS3DTVManager(
      mount,
      camera,
      scene,
      mount.clientWidth,
      mount.clientHeight,
    );
    tvManager.setEditMode(editModeRef.current);
    tvManagerRef.current = tvManager;

    // KROMATISK ABERRATION post-process — only ever engaged (via
    // composer.render() instead of renderer.render()) on frames where the
    // effect is actually on, so it costs nothing when off. Built once here
    // regardless, at whatever pixel ratio the renderer already has (see
    // resolutionScale sync below for what keeps it matching afterwards).
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const chromaticAberrationPass = new ShaderPass(CHROMATIC_ABERRATION_SHADER);
    chromaticAberrationPass.renderToScreen = true;
    composer.addPass(chromaticAberrationPass);

    const torusRingField = new TorusRingField(scene, {
      enabled: initial.torusRingsOn && !initial.lowGraphicsMode,
      radius: initial.torusRadius,
      tube: initial.torusTube,
      scale: initial.torusScale,
      opacity: initial.torusOpacity,
      color: 0xffffff,
      textureUrl: initial.lowGraphicsMode
        ? null
        : (TORUS_RING_TEXTURES[initial.torusTextureIdx]?.url ?? null),
      cellSize: initial.torusCellSize,
      verticalSpacing: initial.torusVerticalSpacing,
      verticalCount: initial.torusVerticalCount,
      viewDistance: initial.torusViewDistance,
      fadeDistance: initial.torusFadeDistance,
    });
    torusRingFieldRef.current = torusRingField;

    // "Watercraft" camera mode's raft — see WatercraftRig. Built once here
    // (hidden by default; setVisible(true) only while cameraMode ===
    // "watercraft", driven each frame from the animate loop below) rather
    // than mounted per mode switch, matching torusRingField above.
    const watercraftRig = new WatercraftRig(scene, WATERCRAFT_RAFT_X, WATERCRAFT_RAFT_Z, {
      onBlockCountChange: setWatercraftBlockCount,
      onImportedStatic: () =>
        setWatercraftStatus("Imported as a static model (not a saved watercraft world)."),
    });
    watercraftRigRef.current = watercraftRig;

    // Build/sculpt input for watercraft mode: a plain tap/click anywhere on
    // the canvas (not a drag) places/removes a block or paints the sculpt
    // brush. Safe to listen unconditionally — every handler bails out via
    // the cameraModeRef check unless "watercraft" is actually the active
    // mode, and NAV/LOOK camera control here is joystick-driven rather than
    // canvas-drag-driven, so there's nothing for this to conflict with.
    const onWatercraftPointerDown = (e: PointerEvent) => {
      if (cameraModeRef.current !== "watercraft" || e.button !== 0) return;
      watercraftRig.setPointerFromEvent(renderer.domElement, e.clientX, e.clientY);
      watercraftRig.pointerDown(camera);
    };
    const onWatercraftPointerMove = (e: PointerEvent) => {
      if (cameraModeRef.current !== "watercraft") return;
      watercraftRig.setPointerFromEvent(renderer.domElement, e.clientX, e.clientY);
    };
    const onWatercraftPointerUp = () => {
      watercraftRig.pointerUp();
    };
    renderer.domElement.addEventListener("pointerdown", onWatercraftPointerDown);
    renderer.domElement.addEventListener("pointermove", onWatercraftPointerMove);
    renderer.domElement.addEventListener("pointerup", onWatercraftPointerUp);
    renderer.domElement.addEventListener("pointercancel", onWatercraftPointerUp);

    // Ocean plane (near, finely-tessellated tier — see OCEAN_BASE_SIZE above)
    const geo = new THREE.PlaneGeometry(OCEAN_BASE_SIZE, OCEAN_BASE_SIZE, 320, 320);
    geo.rotateX(-Math.PI / 2);

    // Max anisotropy for later texture loads (reflection surface, etc.).
    maxAnisoRef.current = renderer.capabilities.getMaxAnisotropy?.() ?? 4;

    // 1×1 white fallback so the reflection sampler is always valid; the
    // surface-selector effect swaps in a real photo and raises uReflMix.
    const whiteTex = new THREE.DataTexture(
      new Uint8Array([255, 255, 255, 255]),
      1,
      1,
      THREE.RGBAFormat,
    );
    whiteTex.needsUpdate = true;
    reflWhiteTexRef.current = whiteTex;

    const { wave: fftWaveData, phase: fftPhaseData } = packOceanWaveComponents(fftWaveComponents);
    const { wave: dyingWaveData, phase: dyingPhaseData } =
      packOceanWaveComponents(dyingWaveComponents);
    const uniforms = {
      uTime: { value: 0 },
      uAmp: { value: waveAmp },
      // Realistic (JONSWAP/FFT-ocean) waveform — see uFft blend below and
      // src/lib/ocean/fftOceanSpectrum.ts for the credited source algorithm.
      // The component arrays are static for the mount's lifetime (only
      // uFft's blend weight animates), so they're set once here.
      uFft: { value: 0 },
      uFftWave: { value: fftWaveData },
      uFftPhase: { value: fftPhaseData },
      // DÖENDE VÅG (dying wave) — same idea as uFft above, but its own blend
      // weight, own time base (own TEMPO dial) and own component set from
      // generateDyingWaveComponents().
      uDying: { value: 0 },
      uDyingAmp: { value: dyingWaveAmp },
      uDyingTime: { value: 0 },
      uDyingWave: { value: dyingWaveData },
      uDyingPhase: { value: dyingPhaseData },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSkyColor: { value: new THREE.Color(0x88aacc) },
      uHorizonColor: { value: new THREE.Color(0xffddaa) },
      uWaterDeep: { value: new THREE.Color(0x022244) },
      uWaterShallow: { value: new THREE.Color(0x2a89b8) },
      uSunColor: { value: new THREE.Color(0xffe6b0) },
      uFogColor: { value: new THREE.Color(0x88aacc) },
      uWaterColor: { value: new THREE.Vector3(1, 1, 1) },
      uOverlayColor: { value: new THREE.Vector3(1, 0, 0) },
      uOpacity: { value: 1 },
      uWaterColorAlpha: { value: 0 },
      uTintHue: { value: 0 },
      uTintSat: { value: 1 },
      uTintBright: { value: 1 },
      uSurfBright: { value: 1 },
      uSurfSat: { value: 1 },
      uUnderwater: { value: 0 },
      uRegular: { value: 0 },
      uCross: { value: 1 },
      uPeriod: { value: 1 },
      // FREKVENS — multiplies the spatial wavenumbers of every waveform
      // (analytic, FFT and vortex alike); see waveHeight() in the JS above,
      // which this shader is kept in sync with.
      uFreq: { value: waveFreq },
      uPeak: { value: 1 },
      uQuality: { value: 0 },
      uDir: { value: 0 },
      uVortex: { value: 0 },
      uVortexOpening: { value: 14 },
      uVortexCenter: { value: new THREE.Vector2(0, 0) },
      // Selectable photo reflection: sampled along the reflection vector.
      uReflTex: { value: whiteTex },
      uReflMix: { value: 0 },
      // Procedural sphere-map ("matcap") material: a stylized, glossy
      // sphere-lit look driven by the view-space normal rather than a real
      // reflection — cheap, and unlike the photo reflection above it stays
      // convincing at any camera angle. uSphereMix is the blend amount.
      uSphereMix: { value: 0 },
      // Trochoidal (Gerstner-like) horizontal displacement blended in on top
      // of the existing sine/shaped height — purely a vertex-shader visual,
      // never fed into the JS-side waveHeight() the camera physics reads.
      uTrochoid: { value: 0 },
      // HEAVE SKEW: a temporal phase warp shared with the JS-side
      // waveHeight() the camera physics reads (see warpPhase() there) — so
      // the rendered surface's own rise/sink timing actually matches what's
      // lifting the camera, unlike uTrochoid above.
      uSkew: { value: 0 },
      // Grumlighet (turbidity), shared with the seafloor/mid-cloud/sky
      // shaders — see uTurbidity handling in the fragment shader below.
      uTurbidity: { value: 0 },
      // ÄKTA KAUSTIK: real Snell's-law refraction of the view ray reveals
      // the actual seafloor tint in shallow water instead of the fixed
      // deep/shallow gradient — see uRefraction handling below. Shares the
      // floor's live color/depth so the two stay consistent.
      uRefraction: { value: 0 },
      uFloorColor: { value: new THREE.Color(0xd8c078) },
      uFloorDepth: { value: 14 },
    };
    // Expose the uniforms so the surface-selector effect can feed in a photo.
    waterUniformsRef.current = uniforms as unknown as Record<string, { value: unknown }>;

    const vertexShader = /* glsl */ `
      uniform float uTime;
      uniform float uAmp;
      uniform float uRegular;
      uniform float uCross;
      uniform float uPeriod;
      uniform float uFreq;
      uniform float uPeak;
      uniform float uTrochoid;
      uniform float uSkew;
      uniform float uDir;
      uniform float uVortex;
      uniform float uVortexOpening;
      uniform vec2 uVortexCenter;
      // Realistic (JONSWAP/FFT-ocean) waveform, ported from
      // https://github.com/drsounds/OceanDemo (MIT, Popov / evpopov.com) —
      // see src/lib/ocean/fftOceanSpectrum.ts for the full derivation. Each
      // component is one cosine term of a spectrum-sampled sum-of-sinusoids
      // realization: vec4(kx, kz, amplitude, omega) + a parallel phase.
      uniform float uFft;
      uniform vec4 uFftWave[${FFT_WAVE_COUNT}];
      uniform float uFftPhase[${FFT_WAVE_COUNT}];
      // DÖENDE VÅG (dying wave) — a long, decaying-swell overlay blended in
      // on top of whichever base waveform (uRegular/uFft) is active, with its
      // own time base (uDyingTime, driven by the DÖD VÅG TEMPO dial) and own
      // height (uDyingAmp, DÖD VÅG HÖJD) so it can run independently of the
      // other wave layers. See generateDyingWaveComponents() in
      // src/lib/ocean/fftOceanSpectrum.ts.
      uniform float uDying;
      uniform float uDyingAmp;
      uniform float uDyingTime;
      uniform vec4 uDyingWave[${DYING_WAVE_COUNT}];
      uniform float uDyingPhase[${DYING_WAVE_COUNT}];
      varying vec3 vWorldPos;
      varying vec3 vNormal;

      // FREKVENS scales each component's wave vector, which can push it past
      // the mesh's Nyquist limit into aliasing noise — fade those out. Mirror
      // of kAliasFade() in src/lib/ocean/fftOceanSpectrum.ts (same edges, so
      // the camera physics and the rendered surface agree); a no-op at
      // uFreq = 1, where no generated component reaches the fade's start.
      float kAliasFade(vec2 k) {
        return 1.0 - smoothstep(${K_ALIAS_FADE_GLSL.start}, ${K_ALIAS_FADE_GLSL.end}, length(k));
      }

      float fftHeight(vec2 xz, float t) {
        float h = 0.0;
        for (int i = 0; i < ${FFT_WAVE_COUNT}; i++) {
          vec4 w = uFftWave[i];
          vec2 k = w.xy * uFreq;
          h += w.z * kAliasFade(k) * cos(k.x * xz.x + k.y * xz.y - w.w * t + uFftPhase[i]);
        }
        return h;
      }

      // Same idea as fftHeight() above, sampling the long-swell-only
      // DÖENDE VÅG component set instead — see generateDyingWaveComponents().
      float dyingHeight(vec2 xz, float t) {
        float h = 0.0;
        for (int i = 0; i < ${DYING_WAVE_COUNT}; i++) {
          vec4 w = uDyingWave[i];
          vec2 k = w.xy * uFreq;
          h += w.z * kAliasFade(k) * cos(k.x * xz.x + k.y * xz.y - w.w * t + uDyingPhase[i]);
        }
        return h;
      }

      // HEAVE SKEW — see warpPhase() in the JS above, kept in sync: warps
      // only a temporal phase (never a term that also carries x/z), applied
      // at each wave()/waveHeight() call site *before* combining with that
      // term's spatial phase, so any fixed-time snapshot of the mesh stays
      // an undistorted sine — no new phase-bunched faces.
      float warpPhase(float phase, float skew) {
        return phase + clamp(skew, 0.0, 0.9) * sin(phase);
      }

      // Rounded Gaussian crest boost — sharpens the wave top without creating
      // near-vertical phase-bunched faces that alias when viewed from the side.
      float shp(float theta) {
        float k = clamp((uPeak - 1.0) / 5.0, 0.0, 1.0);
        // Gaussian crest-pulse strength cut hard (was 0.28) — see
        // shapedWave() in the JS above for the numeric reasoning, kept in
        // sync.
        float amount = max(0.0, uPeak - 1.0) * 0.08;
        float wrapped = atan(sin(theta - 1.57079632679), cos(theta - 1.57079632679));
        float width = mix(0.72, 0.6, k);
        float crest = exp(-(wrapped * wrapped) / (2.0 * width * width));
        // Analytic mean of the Gaussian pulse over one period, so raising
        // SPETS keeps the mean surface level and only sharpens the top.
        float mean = width * 0.3989;
        // Extra pow-based crest boost purely on the positive lobe — adds a
        // realistic near-cusp peak without steepening the wave face.
        float base = sin(theta);
        float peakBoost = pow(max(base, 0.0), mix(1.0, 1.8, k)) - 0.3183 * mix(0.0, 1.0, k);
        // Smooth (Stokes-like) second-harmonic term — see shapedWave() in
        // the JS above, kept in sync. No kinks, safe at any SPETS value.
        float stokes = -cos(2.0 * theta) * k * 0.01;
        return (base + stokes + amount * (crest - mean) + k * 0.55 * peakBoost) / (1.0 + amount * 0.28 + k * 0.35 + k * 0.01);
      }


      float wave(vec3 pIn, float t, float amp, float rippleFade, float dyingAmp) {
        // Rotate horizontal coords by uDir so wave crests advance in the
        // chosen direction. Small ripples stay in world space so they still
        // sparkle from every angle. Uses compass-bearing convention (0 =
        // world +z, 90deg = world +x), matching the JS waveHeight() and the
        // angle dial, rather than the math-angle convention. Negated to
        // match waveHeight(): every phase term below is p.x/p.z*k + t*speed,
        // and that sign makes crests travel toward -p, not +p — the
        // negation here points +p (and so crest travel) at uDir directly.
        float cd = -sin(uDir), sd = -cos(uDir);
        vec3 p = vec3(cd * pIn.x + sd * pIn.z, pIn.y, -sd * pIn.x + cd * pIn.z);
        // Regular sine along x, with optional cross-axis sine so it doesn't
        // look like a flat carpet when uRegular = 1. uPeriod scales the
        // spatial wavelength (higher = longer, calmer swells); uFreq (FREKVENS)
        // scales it the other way, and unlike uPeriod also reaches the swell
        // and FFT terms below.
        float regX = shp(p.x * (0.12 * uFreq / uPeriod) + warpPhase(t * 0.9, uSkew)) * 2.6 * amp;
        float regZ = shp(p.z * (0.09 * uFreq / uPeriod) + warpPhase(t * 0.7 + 1.1, uSkew)) * 1.4 * amp * uCross;
        float reg = regX + regZ;

        // Large primary swell (chaotic sum of sines)
        float w1 = shp(p.x * 0.12 * uFreq + warpPhase(t * 0.9, uSkew)) * 1.0;
        float w2 = shp(p.z * 0.17 * uFreq + warpPhase(t * 0.7 + 1.3, uSkew)) * 0.75;
        float w3 = shp((p.x * 0.22 + p.z * 0.19) * uFreq + warpPhase(t * 1.4 + 2.1, uSkew)) * 0.5;
        float w4 = shp((p.x * 0.31 - p.z * 0.11) * uFreq + warpPhase(t * 1.8 + 0.4, uSkew)) * 0.35;
        float big = (w1 + w2 + w3 + w4) * amp;

        // Small ripples on top of the swell — high frequency, so they must
        // fade with distance well before the mesh becomes under-sampled or
        // they alias into jagged spikes at grazing angles. Deliberately left
        // out of uFreq: these are decorative surface sparkle rather than part
        // of the wave train, and they already sit near the mesh's resolution
        // limit, so scaling them up would alias straight into the boiling
        // look the distance fade above exists to prevent.
        float r1 = sin(p.x * 0.85 + p.z * 0.42 + t * 2.6) * 0.06;
        float r2 = sin(p.x * 0.55 - p.z * 0.95 + t * 3.1 + 1.7) * 0.05;
        float r3 = sin((p.x * 1.35 + p.z * 1.15) + t * 3.8 + 0.6) * 0.035;
        float r4 = sin((p.x * 1.9 - p.z * 1.6) + t * 4.7 + 2.3) * 0.022;
        float ripples = (r1 + r2 + r3 + r4) * (1.0 - uRegular) * rippleFade;

        float base = mix(big + ripples, reg, uRegular);
        if (uFft > 0.001) {
          float fft = fftHeight(p.xz, t) * amp;
          base = mix(base, fft, uFft);
        }
        if (uDying > 0.001) {
          float dying = dyingHeight(p.xz, uDyingTime) * dyingAmp;
          base = mix(base, dying, uDying);
        }
        return base;
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
        float dyingAmpF = uDyingAmp * ampFade;

        float h = wave(wpBase.xyz, uTime, ampF, rippleFade, dyingAmpF);
        p.y += h;


        // approximate normal via finite differences — small epsilon so
        // the ripples contribute crisp shading.
        float e = 0.22;
        float hx = wave(wpBase.xyz + vec3(e, 0.0, 0.0), uTime, ampF, rippleFade, dyingAmpF);
        float hz = wave(wpBase.xyz + vec3(0.0, 0.0, e), uTime, ampF, rippleFade, dyingAmpF);
        vec3 n = normalize(vec3(h - hx, e, h - hz));

        // Trochoidal (Gerstner-like) horizontal displacement: shifts each
        // vertex sideways along the local wave slope, which bunches vertices
        // together on the rising face and spreads them apart in the trough —
        // the classic sharp-crest, wide-trough trochoid silhouette a pure
        // sine height field can't produce. This only ever moves the mesh
        // (visual); the JS-side waveHeight() the camera buoyancy reads is a
        // separate function untouched by uTrochoid, so it never feeds back
        // into camera movement.
        if (uTrochoid > 0.001) {
          float dhdx = (h - hx) / e;
          float dhdz = (h - hz) / e;
          float steepness = min(ampF, 3.0) * 0.7 * uTrochoid;
          p.x += dhdx * steepness;
          p.z += dhdz * steepness;
        }

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
          float kR = 0.12 * uFreq / uPeriod;
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
      uniform vec3 uWaterColor;
      // The water color picker's own flat overlay color (see the "Water
      // color overlay" block below) — independent of uWaterColor, which is
      // the always-on WATER preset tint multiplier.
      uniform vec3 uOverlayColor;
      uniform float uOpacity;
      // Independent alpha for the flat overlay color blended in below (see
      // the "Water color overlay" block) — separate from uOpacity
      // (translucency to whatever's behind the water).
      uniform float uWaterColorAlpha;
      uniform float uTintHue;
      uniform float uTintSat;
      uniform float uTintBright;
      uniform float uSurfBright;
      uniform float uSurfSat;
      uniform float uUnderwater;
      uniform float uTime;
      uniform float uAmp;
      uniform float uQuality;
      uniform sampler2D uReflTex;
      uniform float uReflMix;
      uniform float uSphereMix;
      uniform float uTurbidity;
      uniform float uRefraction;
      uniform vec3 uFloorColor;
      uniform float uFloorDepth;
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

      // Value noise + fbm reused from the seafloor shader, for the optional
      // high-quality micro-chop and foam below. Kept to 3 octaves (vs the
      // floor's 5) since this runs per-pixel over the whole ocean plane.
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
        for (int i = 0; i < 3; i++) {
          v += a * vnoise(p);
          p *= 2.02; a *= 0.5;
        }
        return v;
      }

      // Procedural sphere-map ("matcap") material: instead of sampling a
      // real environment, a glossy sphere-lit look is derived analytically
      // from the surface's VIEW-SPACE normal (the classic matcap trick) —
      // an off-center highlight blob plus a rim brighten, always coherent
      // from any camera angle and needing no extra texture asset.
      vec3 sphereMapShade(vec3 Nsh, vec3 baseCol) {
        vec3 viewN = normalize((viewMatrix * vec4(Nsh, 0.0)).xyz);
        vec2 muv = viewN.xy * 0.5 + 0.5;
        float hiCore = smoothstep(0.16, 0.0, length(muv - vec2(0.32, 0.68)));
        float hiSoft = smoothstep(0.55, 0.0, length(muv - vec2(0.32, 0.68)));
        float rim = pow(clamp(1.0 - viewN.z, 0.0, 1.0), 3.0);
        vec3 body = mix(baseCol * 0.32, baseCol * 0.95, hiSoft);
        return body + vec3(1.0) * hiCore * 0.95 + uSkyColor * rim * 0.6;
      }

      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uSunDir);

        // Apply user color adjustments on top of the water-color preset.
        vec3 tint = uWaterColor * uTintBright;
        tint = hueRotate(uTintHue) * tint;
        vec3 gray = vec3(dot(tint, vec3(0.299, 0.587, 0.114)));
        tint = mix(gray, tint, uTintSat);

        float NdotV = clamp(dot(N, V), 0.0, 1.0);

        // Schlick Fresnel with water's real F0 (~0.02) — grazing angles push
        // reflectance to 1.0 for natural rim shimmer, straight-down stays dim.
        float F0 = 0.02;
        float fres = F0 + (1.0 - F0) * pow(1.0 - NdotV, 5.0);

        // Distance from camera in the water plane — same idea as the vertex
        // shader's ampFade/rippleFade (see uTrochoid's neighborhood above),
        // but computed here since the fine per-pixel normal perturbations
        // below have no vertex-side equivalent to inherit a fade from. Every
        // wave mode (REGELBUNDEN/FFT-HAV/DÖENDE VÅG) shares this same
        // fragment shader, so an un-faded high-frequency term here reads as
        // "boiling water" regardless of which waveform is actually driving
        // the mesh underneath it.
        float shimDist = length(vWorldPos.xz - cameraPosition.xz);

        // Micro-shimmer: high-frequency normal perturbation for scale-fine
        // sparkle that only shows up near the Fresnel rim / sun highlight.
        // At ~4-6 rad/m (≈1-1.7m wavelength) this is far finer than anything
        // else in the shader and had no distance fade at all, so once enough
        // of the visible water sits at a grazing angle — where each pixel's
        // footprint spans many wavelengths of it — it aliased into a dense,
        // shimmering "boiling" texture instead of the intended sparse sparkle.
        // Distance alone isn't enough to tame it though: reflect(-V, Nshim)
        // is inherently hypersensitive to normal perturbation right as NdotV
        // approaches 0 (a grazing ray's reflection direction swings hugely
        // for a tiny normal wobble), so even a mostly-distance-faded shim
        // still visibly shimmers at the most extreme grazing angles — fade
        // it out there too, accepting a little less rim sparkle for a lot
        // less boiling.
        float shimFade = (1.0 - smoothstep(10.0, 40.0, shimDist)) * smoothstep(0.02, 0.15, NdotV);
        float shim = sin(vWorldPos.x * 3.7 + vWorldPos.z * 4.3) *
                     sin(vWorldPos.x * 5.1 - vWorldPos.z * 6.2) * shimFade;
        vec3 Nshim = normalize(N + vec3(shim * 0.06, 0.0, shim * 0.05));

        // Fine procedural micro-chop + whitecap foam (HIGH quality only) —
        // breaks up the too-clean analytic-sine "plasma" look with organic,
        // non-repeating detail, and adds animated, patchy foam near steep,
        // high crests. uQuality is a uniform (same value for every fragment
        // in the draw call), so this branch is free when off, and LOW
        // quality stays byte-for-byte the original shading.
        float foam = 0.0;
        if (uQuality > 0.5) {
          // Coarser frequency than shim above, so it stays resolved (and
          // fades out) at a proportionally longer distance; same grazing-
          // angle taming since it feeds the same reflection-sensitive Nshim.
          float microFade = (1.0 - smoothstep(20.0, 90.0, shimDist)) * smoothstep(0.02, 0.15, NdotV);
          float n1 = fbm(vWorldPos.xz * 0.6 + vec2(uTime * 0.05, uTime * 0.03));
          float n2 = fbm(vWorldPos.xz * 2.3 - vec2(uTime * 0.08, uTime * 0.11));
          float microBump = ((n1 - 0.5) * 0.05 + (n2 - 0.5) * 0.025) * microFade;
          Nshim = normalize(Nshim + vec3(microBump, 0.0, microBump * 0.7));

          float slope = 1.0 - N.y;
          float crestF = smoothstep(uAmp * 0.55, uAmp * 1.3, vWorldPos.y);
          float foamNoise = fbm(vWorldPos.xz * 0.8 + vec2(uTime * 0.12, -uTime * 0.09));
          foam = clamp(crestF * (0.35 + slope * 1.8) * smoothstep(0.3, 0.75, foamNoise), 0.0, 1.0);
        }

        // Sky reflection — sample along the reflection vector so different
        // camera angles pick different sky bands (horizon vs zenith).
        vec3 R = reflect(-V, Nshim);
        float rUp = clamp(R.y, 0.0, 1.0);
        vec3 skyRef = mix(uHorizonColor, uSkyColor, pow(rUp, 0.65));

        // Selectable photo reflection: map the reflection direction to
        // equirectangular-ish UVs (azimuth → u, elevation → v) and sample a
        // real surface photo. Because R is built from the wave-perturbed
        // normal, the reflected image ripples and breaks up with the swell —
        // far cheaper than planar/SSR reflections but far richer than the flat
        // gradient. Modulated by daylight so it still darkens at night.
        if (uReflMix > 0.001) {
          vec2 reflUv = vec2(atan(R.z, R.x) * 0.15915494 + 0.5, clamp(1.0 - rUp, 0.0, 1.0));
          vec3 photo = texture2D(uReflTex, reflUv).rgb;
          float daylight = clamp(uSunDir.y + 0.35, 0.12, 1.15);
          // Keep the gradient's hue as a base (25%) so dawn/dusk still tints
          // the water; the photo supplies the detail (75%).
          vec3 envRefl = mix(skyRef, photo * daylight, 0.75);
          skyRef = mix(skyRef, envRefl, uReflMix);
        }

        // Refraction tint — view-dependent transmitted color. Straight down
        // we see into the deep hue; at grazing angles the shallow tint takes
        // over just before Fresnel flips everything to reflection.
        vec3 deepT = uWaterDeep * tint;
        vec3 shalT = uWaterShallow * tint;
        float refrMix = mix(0.15, 0.85, pow(1.0 - NdotV, 1.6));
        vec3 water = mix(deepT, shalT, refrMix);

        // ÄKTA KAUSTIK / optisk ljusbrytning: bend the view ray through the
        // surface with real Snell's law (air->water, IOR 1.333) and see how
        // far it has to travel to reach the seafloor. Near-vertical looks
        // into shallow water land close by, so the true sand tint shows
        // through instead of the fixed deep/shallow gradient; steep angles
        // or deep water travel far enough that the approximation fades back
        // to the plain gradient.
        if (uRefraction > 0.001) {
          vec3 refr = refract(-V, N, 1.0 / 1.333);
          if (dot(refr, refr) > 0.0001) {
            float travel = uFloorDepth / max(0.05, -refr.y);
            float seeBottom = clamp(1.0 - travel / 45.0, 0.0, 1.0);
            vec3 bottomTint = uFloorColor * clamp(uSunDir.y + 0.3, 0.2, 1.0) * tint;
            water = mix(water, bottomTint, seeBottom * 0.6 * uRefraction);
          }
        }

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

        // Reflective share of this pixel (sky/photo Fresnel term) — kept
        // around post-mix so the alpha/compositing step below can tell it
        // apart from the transmitted water body.
        float reflAmt = fres * (1.0 - uUnderwater * 0.85);
        vec3 col = mix(water, skyRef, reflAmt) + sun;

        // Selectable sphere-map ("matcap") material — a distinct, glossier
        // look the user opts into per VÅGMATERIAL, blended on top of the
        // regular Fresnel/sky shading rather than replacing it outright.
        if (uSphereMix > 0.001) {
          col = mix(col, sphereMapShade(Nshim, water), uSphereMix);
        }

        // The color picker's flat uOverlayColor and the whitecap foam are
        // *not* folded into col here — they're composited as their own
        // layers, on top of the shaded water body, further down (see the
        // Translucency block below) so they stay visible independently of
        // how transparent uOpacity makes the body underneath.

        // Final surface color adjustment (independent of internal tint).
        col *= uSurfBright;
        float sg = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(vec3(sg), col, uSurfSat);

        // Underwater tone-down: desaturate + darken, pulled toward tinted deep hue.
        if (uUnderwater > 0.0) {
          float g = dot(col, vec3(0.299, 0.587, 0.114));
          vec3 muted = mix(vec3(g), deepT * 1.1, 0.55) * (1.0 - 0.35 * uUnderwater);
          col = mix(col, muted, clamp(uUnderwater, 0.0, 1.0));
        }

        // Grumlighet (turbidity): once submerged, real depth-based fog on
        // top of the flat tone-down above so diving deeper into murky water
        // keeps getting hazier instead of plateauing at the same fixed
        // darken. This plane is small and finely tessellated (unlike the
        // seafloor), so a plain interpolated-position distance is accurate
        // here — no depth-buffer reconstruction needed.
        if (uTurbidity > 0.001 && uUnderwater > 0.001) {
          float distC = length(cameraPosition - vWorldPos);
          float murk = clamp(1.0 - exp(-distC * uTurbidity * 0.01), 0.0, 0.95) * uUnderwater;
          col = mix(col, deepT * 0.55, murk);
        }

        // Translucency — uOpacity controls how see-through the water is.
        // The water is built from three independent layers, each composited
        // "over" the last with its own alpha (standard Porter-Duff, kept in
        // premultiplied form — see mat.premultipliedAlpha below), instead of
        // one flat mix of everything into a single alpha. That's what makes
        // uOpacity actually empty the shaded body out to nothing rather than
        // leaving a residual tinted haze:
        //   1. body  — col as shaded above (tint, reflection, sun, sphere
        //      material, underwater tone-down, turbidity). Alpha is
        //      bodyAlpha, plain uOpacity with no boost: 0 is fully gone, 1
        //      is fully opaque, and every value between fades linearly.
        //   2. paint — the color picker's flat uOverlayColor (WaterColorPicker
        //      in SettingsPanel.tsx). Alpha is uWaterColorAlpha ("COLOR
        //      STRENGTH") times visGate — deliberately *not* multiplied by
        //      bodyAlpha, so a chosen color reads as paint sitting on top of
        //      however transparent the water is, not something that fades
        //      away at the same rate the body does.
        //   3. foam — whitecap highlights, alpha is the foam strength
        //      computed above times visGate, unaffected by uSurfBright/
        //      uSurfSat/underwater toning (those apply to the body only).
        // visGate is a curve that's exactly 0 at uOpacity = 0 (so paint and
        // foam still respect "0 = fully invisible", same as VATTENYTA/
        // hideWater) but rises to ~1 almost immediately after, so neither
        // layer fades proportionally with the body — they stay visible
        // through fairly transparent water instead of thinning out with it.
        float bodyAlpha = clamp(uOpacity, 0.0, 1.0);
        float visGate = pow(bodyAlpha, 0.35);

        vec3 premult = col * bodyAlpha;
        float alpha = bodyAlpha;

        float paintAlpha = clamp(uWaterColorAlpha, 0.0, 1.0) * visGate;
        premult = uOverlayColor * paintAlpha + premult * (1.0 - paintAlpha);
        alpha = paintAlpha + alpha * (1.0 - paintAlpha);

        float foamAlpha = clamp(foam * 0.85 * (1.0 - uUnderwater), 0.0, 1.0) * visGate;
        premult = vec3(0.95, 0.98, 1.0) * foamAlpha + premult * (1.0 - foamAlpha);
        alpha = foamAlpha + alpha * (1.0 - foamAlpha);

        gl_FragColor = vec4(premult, alpha);
      }
    `;

    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      // The fragment shader writes premultiplied color (see the alpha/
      // compositing block above) so lowering uOpacity fades the tinted
      // water body toward whatever's behind it without dimming the
      // reflection/foam that's blended on top.
      premultipliedAlpha: true,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
    mat.forceSinglePass = true;
    const ocean = new THREE.Mesh(geo, mat);
    // Stays at scale 1 — see OCEAN_FAR_INNER_RADIUS above. The YTA (surface
    // area) dial no longer touches this near tier, only farOcean below.
    oceanRef.current = ocean;
    scene.add(ocean);

    // Coarse far tier: reuses the same material (so it shades identically)
    // over a low-segment ring whose outer radius YTA/surfaceArea controls,
    // to push the horizon edge out. Safe to be coarse because by the time
    // waves reach this tier's (fixed) inner edge, ampFade (see vertex
    // shader) has already faded their amplitude to exactly 0 — it only ever
    // renders flat water, so it needs no more tessellation than the
    // equally-flat seafloor below.
    const farOcean = new THREE.Mesh(buildFarOceanGeometry(surfaceAreaRef.current), mat);
    farOceanRef.current = farOcean;
    scene.add(farOcean);

    // Optional seafloor beneath the ocean plane. ShaderMaterial gör den
    // procedurellt strukturerad (sandbankar, småsten, kaustik) när uTextured=1.
    // Stor nog att alltid nå bortom det maximala FJÄRRSIKT-värdet (300 000) så
    // att botten aldrig klipps av mot en synlig kant innan horisonten — helt
    // ofarligt prestandamässigt eftersom golvet är platt (ingen vertex-
    // förskjutning, bara fragment-shadad färg), så färre segment räcker på
    // den enorma ytan.
    const floorGeo = new THREE.PlaneGeometry(900000, 900000, 32, 32);
    floorGeo.rotateX(-Math.PI / 2);
    // Real CC0 sand photo (ambientCG Ground054, 512px) – loaded lazily so the
    // scene renders even if the CDN request is slow.
    const sandTex = new THREE.TextureLoader().load(sandTextureAsset.url);
    sandTex.wrapS = THREE.RepeatWrapping;
    sandTex.wrapT = THREE.RepeatWrapping;
    sandTex.anisotropy = renderer.capabilities.getMaxAnisotropy?.() ?? 4;
    sandTex.colorSpace = THREE.SRGBColorSpace;

    const floorUniforms = {
      uColor: { value: new THREE.Color(0xd8c078) },
      uTextured: { value: 0 },
      uClouds: { value: 0 },
      uCloudScroll: { value: new THREE.Vector2(0, 0) },
      uTime: { value: 0 },
      uSunDir: { value: uniforms.uSunDir.value },
      uSandTex: { value: sandTex },
      uSandScale: { value: 0.35 }, // ~1 tile per 2.9 m så kornen syns
      // Grumlighet (turbidity): optional murkiness for the geometry seen
      // below the water line — see uTurbidity handling in the fragment
      // shader for details.
      uTurbidity: { value: 0 },
      uUnderwater: { value: 0 },
      uFogColor: { value: new THREE.Color(0x0a2a3a) },
      uCamNear: { value: camNearRef.current },
      uCamFar: { value: camFarRef.current },
      // ÄKTA KAUSTIK — see uCausticsOn handling in the fragment shader
      // above. uSunColor/uFftWave/uFftPhase share the ocean's own uniform
      // value objects so they never drift out of sync with the visible
      // surface's wave state.
      uCausticsOn: { value: 0 },
      uSunColor: { value: uniforms.uSunColor.value },
      uFftWave: { value: fftWaveData },
      uFftPhase: { value: fftPhaseData },
      uCausticAmp: { value: waveAmp },
      uCausticFreq: { value: waveFreq },
      uCausticDepth: { value: 14 },
      uOpacity: { value: 1 },
    };
    const floorMat = new THREE.ShaderMaterial({
      uniforms: floorUniforms,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: true,
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorld;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
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
        uniform float uTurbidity;
        uniform float uUnderwater;
        uniform vec3 uFogColor;
        uniform float uCamNear;
        uniform float uCamFar;
        // ÄKTA KAUSTIK: real Snell's-law refraction + ray-density caustics,
        // driven by the same FFT wave spectrum the ocean surface itself
        // renders with (see uFftWave/uFftPhase in the ocean vertex shader,
        // src/lib/ocean/fftOceanSpectrum.ts) — off by default since it costs
        // several extra wave-sum evaluations per seafloor fragment.
        uniform float uCausticsOn;
        uniform vec3 uSunColor;
        uniform vec4 uFftWave[${FFT_WAVE_COUNT}];
        uniform float uFftPhase[${FFT_WAVE_COUNT}];
        uniform float uCausticAmp;
        uniform float uCausticFreq;
        uniform float uCausticDepth;
        // Per-mesh fade-in/out multiplier (see uOpacity in floorUniforms/
        // midCloudUniforms/skyCloudUniforms) — lets each cloud layer (the
        // main mid/sky decks and VÄRLDSGRÄNS's extra y-extension layers,
        // each with its own material instance) ease in/out independently
        // instead of popping visible/invisible, at MOLN TONING's rate.
        uniform float uOpacity;

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

        // Same FFT ocean-spectrum sum used by the water surface's vertex
        // shader (kept in sync via the shared FFT_WAVE_COUNT/K_ALIAS_FADE_GLSL
        // constants), so the seafloor caustics below are driven by the
        // actual live wave state rather than independent decorative noise.
        float kAliasFade(vec2 k) {
          return 1.0 - smoothstep(${K_ALIAS_FADE_GLSL.start}, ${K_ALIAS_FADE_GLSL.end}, length(k));
        }
        float fftHeight(vec2 xz, float t) {
          float h = 0.0;
          for (int i = 0; i < ${FFT_WAVE_COUNT}; i++) {
            vec4 w = uFftWave[i];
            vec2 k = w.xy * uCausticFreq;
            h += w.z * kAliasFade(k) * cos(k.x * xz.x + k.y * xz.y - w.w * t + uFftPhase[i]);
          }
          return h;
        }

        // Real caustics: refract the sun ray through the true wave-surface
        // normal at three neighboring points (finite differences of
        // fftHeight) and measure how much the resulting rays converge
        // (bright focus) or spread apart (dim) by the time they reach the
        // seafloor — the actual ray-density mechanism real underwater
        // caustics come from, applied to this scene's live wave field.
        float causticIntensity(vec2 xz) {
          float e = 0.5;
          float h0  = fftHeight(xz, uTime) * uCausticAmp;
          float hx  = fftHeight(xz + vec2(e, 0.0), uTime) * uCausticAmp;
          float hz  = fftHeight(xz + vec2(0.0, e), uTime) * uCausticAmp;
          float hxx = fftHeight(xz + vec2(2.0 * e, 0.0), uTime) * uCausticAmp;
          float hxz = fftHeight(xz + vec2(e, e), uTime) * uCausticAmp;
          float hzz = fftHeight(xz + vec2(0.0, 2.0 * e), uTime) * uCausticAmp;

          vec3 n0 = normalize(vec3(h0 - hx, e, h0 - hz));
          vec3 nx = normalize(vec3(hx - hxx, e, hx - hxz));
          vec3 nz = normalize(vec3(hz - hxz, e, hz - hzz));

          vec3 sunDirN = normalize(uSunDir);
          float eta = 1.0 / 1.333; // air -> water
          vec3 r0 = refract(-sunDirN, n0, eta);
          vec3 rx = refract(-sunDirN, nx, eta);
          vec3 rz = refract(-sunDirN, nz, eta);

          float depth0 = max(0.1, uCausticDepth - h0);
          float depthx = max(0.1, uCausticDepth - hx);
          float depthz = max(0.1, uCausticDepth - hz);

          vec2 hit0 = xz + r0.xz * (depth0 / max(0.05, -r0.y));
          vec2 hitx = (xz + vec2(e, 0.0)) + rx.xz * (depthx / max(0.05, -rx.y));
          vec2 hitz = (xz + vec2(0.0, e)) + rz.xz * (depthz / max(0.05, -rz.y));

          vec2 edge1 = hitx - hit0;
          vec2 edge2 = hitz - hit0;
          float refractedArea = abs(edge1.x * edge2.y - edge1.y * edge2.x);
          float undisturbedArea = e * e;
          float intensity = clamp(undisturbedArea / max(refractedArea, 0.02), 0.0, 8.0);
          return pow(intensity, 1.3);
        }

        // Grumlighet (turbidity): murks up whatever is visible below the
        // water line — suspended particles both dim/desaturate light overall
        // (a flat mix toward the fog tint, independent of distance) and
        // scatter it more the further away / the more submerged the camera
        // is, swallowing detail into a patchy haze. uTurbidity=0 reproduces
        // the exact original look; the fbm patchiness keeps dense turbidity
        // from reading as a flat, unnaturally uniform curtain.
        vec3 applyTurbidity(vec3 col) {
          if (uTurbidity <= 0.001) return col;
          // Distance from the depth buffer, not from interpolating vWorld:
          // this seafloor is one 200,000-unit plane with only 32 segments,
          // so its vertices sit thousands of units apart. A triangle with
          // one corner almost underfoot and the other two kilometers away
          // makes the rasterizer's perspective-correct interpolation of any
          // world-space varying (vWorld included) collapse — every nearby
          // fragment was reading back thousands of units "away". Rebuilding
          // linear view depth from gl_FragCoord.z sidesteps that entirely.
          float ndcZ = gl_FragCoord.z * 2.0 - 1.0;
          float distC = (2.0 * uCamNear * uCamFar) / (uCamFar + uCamNear - ndcZ * (uCamFar - uCamNear));
          // At a level, near-horizon gaze the grazing angle over this huge
          // seafloor plane means most on-screen "floor" pixels are actually
          // hundreds/thousands of units away, so the density has to be tiny
          // — this keeps nearby sand (tens of units) essentially clear even
          // at uTurbidity=1, only swallowing the far distance into haze, and
          // thickens noticeably once the camera itself is submerged.
          float density = uTurbidity * (0.0012 + 0.006 * uUnderwater);
          float fogAmt = clamp(1.0 - exp(-distC * density), 0.0, 0.92);
          float patchy = fbm(vWorld.xz * 0.06 + uTime * 0.015);
          fogAmt *= 0.75 + 0.35 * patchy;
          vec3 muted = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), uFogColor, 0.6);
          col = mix(col, muted, uTurbidity * 0.3);
          col = mix(col, uFogColor, fogAmt);
          return col;
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
            col = applyTurbidity(col);
            gl_FragColor = vec4(col, cloud * uOpacity);
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
            if (uCausticsOn > 0.001) {
              float realCaustic = causticIntensity(p) * clamp(uSunDir.y + 0.15, 0.0, 1.0);
              caustic = mix(caustic, realCaustic, uCausticsOn);
              sand += uSunColor * caustic * 0.22 * uCausticsOn;
              sand += vec3(0.95, 0.88, 0.7) * caustic * 0.22 * (1.0 - uCausticsOn);
            } else {
              sand += vec3(0.95, 0.88, 0.7) * caustic * 0.22;
            }
            base = mix(uColor, sand, clamp(uTextured, 0.0, 1.0));
          }
          base = applyTurbidity(base);
          gl_FragColor = vec4(base, 1.0);
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
    // Same generous size as the floor for the same reason — no visible edge
    // before the horizon regardless of FJÄRRSIKT.
    const midCloudGeo = new THREE.PlaneGeometry(200000, 200000, 8, 8);
    midCloudGeo.rotateX(-Math.PI / 2);
    const midCloudUniforms = {
      uColor: { value: new THREE.Color(0xffffff) },
      uTextured: { value: 0 },
      uClouds: { value: 1 },
      uCloudScroll: { value: new THREE.Vector2(0, 0) },
      uTime: { value: 0 },
      uSunDir: { value: uniforms.uSunDir.value },
      uSandTex: { value: sandTex },
      uSandScale: { value: 0.35 },
      uTurbidity: { value: 0 },
      uUnderwater: { value: 0 },
      uFogColor: { value: new THREE.Color(0x0a2a3a) },
      uCamNear: { value: camNearRef.current },
      uCamFar: { value: camFarRef.current },
      uOpacity: { value: 0 },
    };
    const midCloudMat = new THREE.ShaderMaterial({
      uniforms: midCloudUniforms,
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
    const cloudScale0 = surfaceAreaRef.current / CLOUD_BASE_SIZE;
    midClouds.scale.set(cloudScale0, 1, cloudScale0);
    midCloudsMeshRef.current = midClouds;
    scene.add(midClouds);

    // Sky clouds — same drifting fbm layer as the mid-water clouds, but
    // parked high overhead instead of underwater, so the procedural sky
    // gets a proper cloud deck. Reuses the floor cloud shader verbatim.
    const skyCloudGeo = new THREE.PlaneGeometry(200000, 200000, 8, 8);
    skyCloudGeo.rotateX(-Math.PI / 2);
    const skyCloudUniforms = {
      uColor: { value: new THREE.Color(0xffffff) },
      uTextured: { value: 0 },
      uClouds: { value: 1 },
      uCloudScroll: { value: new THREE.Vector2(0, 0) },
      uTime: { value: 0 },
      uSunDir: { value: uniforms.uSunDir.value },
      uSandTex: { value: sandTex },
      uSandScale: { value: 0.35 },
      uTurbidity: { value: 0 },
      uUnderwater: { value: 0 },
      uFogColor: { value: new THREE.Color(0x0a2a3a) },
      uCamNear: { value: camNearRef.current },
      uCamFar: { value: camFarRef.current },
      uOpacity: { value: 0 },
    };
    const skyCloudMat = new THREE.ShaderMaterial({
      uniforms: skyCloudUniforms,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      vertexShader: floorMat.vertexShader,
      fragmentShader: floorMat.fragmentShader,
    });
    const skyClouds = new THREE.Mesh(skyCloudGeo, skyCloudMat);
    skyClouds.position.y = 150;
    skyClouds.visible = false;
    skyClouds.renderOrder = -1;
    skyClouds.scale.set(cloudScale0, 1, cloudScale0);
    skyCloudsMeshRef.current = skyClouds;
    scene.add(skyClouds);

    // TORNADO CLOUD: an optional funnel-shaped cloud mesh wrapping whichever
    // of GUNGA's or NOCLIP's own tornado spin is active (see
    // tornadoCloudActive/tornadoCloudX/Y/Z/Radius/Angle in the physics loop
    // below). A unit cylinder tapering from a wide top (radius 1) to a
    // narrow tip (radius TORNADO_CLOUD_TIP_RATIO) — scaled per-frame to the
    // active mode's own *TornadoRadius, so one mesh serves both. Reuses the
    // exact same fbm "clouds" shader as the mid/sky cloud decks (uClouds=1
    // below), just painted onto a cone instead of a flat plane; rotating it
    // to the tornado's own spin angle each frame shifts the world-space
    // fbm sampling across its surface, reading as the funnel visibly
    // churning as it spins instead of a static, decal-like texture.
    const tornadoCloudGeo = new THREE.CylinderGeometry(1, TORNADO_CLOUD_TIP_RATIO, 1, 28, 12, true);
    const tornadoCloudUniforms = {
      uColor: { value: new THREE.Color(0x9aa4ad) },
      uTextured: { value: 0 },
      uClouds: { value: 1 },
      uCloudScroll: { value: new THREE.Vector2(0, 0) },
      uTime: { value: 0 },
      uSunDir: { value: uniforms.uSunDir.value },
      uSandTex: { value: sandTex },
      uSandScale: { value: 0.35 },
      uTurbidity: { value: 0 },
      uUnderwater: { value: 0 },
      uFogColor: { value: new THREE.Color(0x0a2a3a) },
      uCamNear: { value: camNearRef.current },
      uCamFar: { value: camFarRef.current },
      uOpacity: { value: 0 },
    };
    const tornadoCloudMat = new THREE.ShaderMaterial({
      uniforms: tornadoCloudUniforms,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      vertexShader: floorMat.vertexShader,
      fragmentShader: floorMat.fragmentShader,
    });
    const tornadoCloud = new THREE.Mesh(tornadoCloudGeo, tornadoCloudMat);
    tornadoCloud.visible = false;
    tornadoCloudMeshRef.current = tornadoCloud;
    scene.add(tornadoCloud);

    // VÄRLDSGRÄNS's extra sky-cloud layers (see EXTEND_CLOUD_LAYER_* and
    // wrapAxis above) — same geometry as skyClouds (cheap: not duplicated,
    // just referenced by more Mesh objects), each repositioned every frame
    // in animate() to tile around the camera's current altitude. Each gets
    // its own cloned material (cheap — same shader source, so it still
    // shares one compiled GL program) rather than reusing skyCloudMat
    // directly, so each layer's uOpacity can fade in/out independently as
    // it's recycled to a newly-approached altitude band.
    const extendCloudLayers: THREE.Mesh[] = [];
    for (let i = 0; i < EXTEND_CLOUD_LAYER_COUNT; i++) {
      const layerMat = skyCloudMat.clone();
      layerMat.uniforms.uOpacity.value = 0;
      const layer = new THREE.Mesh(skyCloudGeo, layerMat);
      layer.visible = false;
      layer.renderOrder = -1;
      layer.scale.set(cloudScale0, 1, cloudScale0);
      extendCloudLayers.push(layer);
      scene.add(layer);
    }
    extendCloudLayersRef.current = extendCloudLayers;
    extendCloudLayerStateRef.current = extendCloudLayers.map(() => ({
      layerIdx: Number.NaN,
      opacity: 0,
    }));

    // SKY PUFFS: optional individual, randomly-placed puffy clouds — see
    // MAX_SKY_PUFFS/randomSkyPuffSpot above. A dedicated shader (rather than
    // reusing the mid/sky cloud deck's shader) confines its fbm cloud shape
    // inside a circular vignette (see uOpacity/uSeed below) so each puff
    // reads as one soft blob on its own small plane instead of the deck's
    // giant, hard-edged-if-cropped tiled plane.
    const puffGeo = new THREE.PlaneGeometry(1, 1, 1, 1);
    puffGeo.rotateX(-Math.PI / 2);
    const puffMeshes: THREE.Mesh[] = [];
    const puffStates: {
      x: number;
      y: number;
      z: number;
      seed: number;
      cycleT: number;
      cycleLen: number;
    }[] = [];
    for (let i = 0; i < MAX_SKY_PUFFS; i++) {
      const puffMat = new THREE.ShaderMaterial({
        uniforms: {
          uOpacity: { value: 0 },
          uSeed: { value: 0 },
          uColor: { value: new THREE.Color(0xffffff) },
        },
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          precision highp float;
          varying vec2 vUv;
          uniform float uOpacity;
          uniform float uSeed;
          uniform vec3 uColor;
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
            vec2 c = vUv - 0.5;
            float dist = length(c) * 2.0;
            float edge = 1.0 - smoothstep(0.55, 1.0, dist);
            if (edge < 0.01) discard;
            vec2 p = vUv * 3.0 + uSeed;
            float n = fbm(p);
            float cloud = smoothstep(0.35, 0.75, n) * edge;
            if (cloud < 0.01) discard;
            float shade = 0.85 + 0.25 * fbm(p * 2.3 + 5.0);
            vec3 col = uColor * shade;
            gl_FragColor = vec4(col, cloud * uOpacity);
          }
        `,
      });
      const puffMesh = new THREE.Mesh(puffGeo, puffMat);
      puffMesh.visible = false;
      puffMesh.renderOrder = -1;
      scene.add(puffMesh);
      puffMeshes.push(puffMesh);
      const spot = randomSkyPuffSpot(posRef.current.x, posRef.current.z);
      puffStates.push({
        ...spot,
        cycleT: Math.random() * SKY_PUFF_BASE_CYCLE,
        cycleLen: SKY_PUFF_BASE_CYCLE,
      });
    }
    skyPuffMeshesRef.current = puffMeshes;
    skyPuffStatesRef.current = puffStates;

    // Sky dome
    const skyGeo = new THREE.SphereGeometry(800, 32, 32);
    const skyUniforms = {
      uTop: { value: new THREE.Color(0x88aacc) },
      uBottom: { value: new THREE.Color(0xffddaa) },
      uSunDir: { value: uniforms.uSunDir.value },
      uSunColor: { value: new THREE.Color(0xffe6b0) },
      // Grumlighet (turbidity): once the camera submerges, the "sky" seen
      // through the water column fades into murk instead of staying a crisp
      // gradient — this is what actually makes the fog read as "everywhere
      // underwater" rather than only on the seafloor right below.
      uUnderwater: uniforms.uUnderwater,
      uTurbidity: { value: 0 },
      uFogColor: { value: new THREE.Color(0x0a2a3a) },
    };
    const skyMat = new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      side: THREE.BackSide,
      // The dome recenters on the camera every frame (see sky.position.copy
      // below) but its geometry is only 800 units in radius — far short of
      // the extend-cloud-layer altitudes VÄRLDSGRÄNS tiles at (hundreds to
      // low thousands of units away once the camera's altitude diverges from
      // a layer's). Without this, the dome's default depthWrite left an
      // opaque depth value at 800 units in every direction, which silently
      // failed the depth test for any transparent cloud fragment drawn
      // farther than that — invisible clouds, not missing ones. A pure
      // background dome should never occlude anything.
      depthWrite: false,
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
        uniform float uUnderwater;
        uniform float uTurbidity;
        uniform vec3 uFogColor;
        varying vec3 vDir;
        void main() {
          float t = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 col = mix(uBottom, uTop, smoothstep(0.35, 0.75, t));
          float sd = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
          col += uSunColor * pow(sd, 180.0) * 3.0;
          col += uSunColor * pow(sd, 8.0) * 0.15;
          if (uUnderwater > 0.001) {
            float murk = clamp(uUnderwater * (0.25 + uTurbidity * 0.7), 0.0, 1.0);
            col = mix(col, uFogColor, murk);
          }
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
      composer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      tvManager.setSize(w, h);
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
        a = night;
        b = dawn;
        k = t / 0.25;
      } else if (t < 0.5) {
        a = dawn;
        b = day;
        k = (t - 0.25) / 0.25;
      } else if (t < 0.75) {
        a = day;
        b = dusk;
        k = (t - 0.5) / 0.25;
      } else {
        a = dusk;
        b = night;
        k = (t - 0.75) / 0.25;
      }
      const lerp = (x: number[], y: number[], k: number) => [
        x[0] + (y[0] - x[0]) * k,
        x[1] + (y[1] - x[1]) * k,
        x[2] + (y[2] - x[2]) * k,
      ];
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
    let lastCamSaveMs = 0;
    // Throttles renderer.render() (see below) to targetFps (or gogglesFpsCap
    // while SIMGLASÖGON is on) by rendering every Nth rAF tick rather than
    // "has enough wall-clock time passed" — see rafIntervalEstimate below
    // for why.
    let renderTickCount = 0;
    // A rolling estimate of the display's actual vsync interval (ms), so the
    // render cap can skip a *fixed number of ticks* between renders instead
    // of comparing elapsed wall-clock time against 1000/fpsCap. The wall-
    // clock version reads as juddery even though the underlying motion (camera
    // physics/uniforms update every rAF tick regardless, see below) is
    // perfectly smooth: 1000/fpsCap rarely divides the display's real frame
    // interval evenly (e.g. 25ms at a 40fps cap vs. 16.7ms on a 60Hz panel),
    // so the pattern of frames actually reaching the screen alternates
    // between waiting 1 and 2 vsyncs — an uneven cadence that's exactly what
    // "janky"/stuttery motion looks like, independent of raw performance.
    // Rendering every Nth tick instead — N derived from this estimate —
    // reproduces the cap as an exact, uniform fraction of the display's own
    // refresh, which reads as smooth motion at a reduced rate instead.
    let rafIntervalMsEstimate = 16.67;
    // Re-applied only when resolutionScale actually changes (see animate()
    // below), rather than every frame, since setPixelRatio touches the GL
    // context's drawing-buffer size.
    let lastResolutionScale = resolutionScaleRef.current;
    let waveT = 0;
    // DÖENDE VÅG runs on its own clock (own TEMPO dial), independent of the
    // shared waveT above, so it can be a long, slow swell regardless of how
    // the other wave layers' speed is set.
    let dyingWaveT = 0;
    const clock = new THREE.Clock();
    const saveCameraPoseNow = () => {
      saveCameraPose({
        x: posRef.current.x,
        z: posRef.current.z,
        y: posRef.current.y,
        yaw: yawRef.current,
        pitch: pitchRef.current,
      });
    };
    window.addEventListener("pagehide", saveCameraPoseNow);
    const animate = () => {
      // LOW GRAPHICS MODE: read once per frame and threaded through every
      // texture/live-noise/extra-shading gate below (see lowGraphicsMode's
      // doc comment in settingsShared.ts for the full list it covers).
      const lowEnd = lowGraphicsModeRef.current;
      // resolutionScale multiplies the renderer's pixel ratio to trade
      // sharpness for GPU load — only touch the renderer when the setting
      // actually changed.
      if (resolutionScaleRef.current !== lastResolutionScale) {
        lastResolutionScale = resolutionScaleRef.current;
        const pixelRatio = Math.min(window.devicePixelRatio, 2) * lastResolutionScale;
        renderer.setPixelRatio(pixelRatio);
        composer.setPixelRatio(pixelRatio);
      }
      // Sync camera lens (FOV / near / far clip) with live settings.
      if (
        camera.fov !== camFovRef.current ||
        camera.near !== camNearRef.current ||
        camera.far !== camFarRef.current
      ) {
        camera.fov = camFovRef.current;
        camera.near = camNearRef.current;
        camera.far = camFarRef.current;
        camera.updateProjectionMatrix();
      }
      // uCamNear/uCamFar feed the seafloor/mid-cloud shader's depth-buffer
      // reconstruction for uTurbidity — keep them in lockstep with the
      // camera's own (user-adjustable) clip planes.
      floorUniforms.uCamNear.value = camera.near;
      floorUniforms.uCamFar.value = camera.far;
      midCloudUniforms.uCamNear.value = camera.near;
      midCloudUniforms.uCamFar.value = camera.far;
      const now = performance.now();
      const rawTickMs = now - lastMs;
      const dt = Math.min(rawTickMs / 1000, 0.1);
      lastMs = now;
      // Feed the render-cap's vsync-interval estimate (see
      // rafIntervalMsEstimate above) — only from ticks that look like a
      // real, undropped vsync (a wide plausible refresh-rate range), so a
      // one-off stall or a backgrounded tab's throttled rAF doesn't drag the
      // estimate away from the display's actual cadence.
      if (rawTickMs > 4 && rawTickMs < 40) {
        rafIntervalMsEstimate += (rawTickMs - rafIntervalMsEstimate) * 0.1;
      }
      // Edit mode freezes wave time and camera bob/drift/walk (physDt below)
      // but leaves the LOOK stick's yaw/pitch (which still uses dt directly)
      // free, so the view can still be reoriented while editing.
      const physDt = editModeRef.current ? 0 : dt;
      waveT += physDt * speedRef.current;
      const t = waveT;
      dyingWaveT += physDt * dyingSpeedRef.current;
      uniforms.uTime.value = t;
      uniforms.uAmp.value = ampRef.current;
      uniforms.uDyingTime.value = dyingWaveT;
      uniforms.uDyingAmp.value = dyingAmpRef.current;
      uniforms.uQuality.value +=
        ((waveHighQualityRef.current && !lowEnd ? 1 : 0) - uniforms.uQuality.value) *
        Math.min(1, dt * 4);
      uniforms.uRegular.value +=
        ((regularRef.current ? 1 : 0) - uniforms.uRegular.value) * Math.min(1, dt * 4);
      uniforms.uFft.value +=
        ((realisticRef.current ? 1 : 0) - uniforms.uFft.value) * Math.min(1, dt * 4);
      uniforms.uDying.value +=
        ((dyingRef.current ? 1 : 0) - uniforms.uDying.value) * Math.min(1, dt * 4);
      uniforms.uCross.value +=
        ((regularCrossRef.current ? 1 : 0) - uniforms.uCross.value) * Math.min(1, dt * 4);
      uniforms.uPeriod.value +=
        (regularPeriodRef.current - uniforms.uPeriod.value) * Math.min(1, dt * 4);
      uniforms.uFreq.value += (freqRef.current - uniforms.uFreq.value) * Math.min(1, dt * 4);
      uniforms.uPeak.value += (wavePeakRef.current - uniforms.uPeak.value) * Math.min(1, dt * 4);
      uniforms.uSkew.value += (heaveSkewRef.current - uniforms.uSkew.value) * Math.min(1, dt * 4);
      // Wave direction stored in degrees; smoothly interpolate the shortest
      // angular path so wrapping around 360° doesn't spin the ocean.
      {
        const targetRad = (waveDirRef.current * Math.PI) / 180;
        let delta = targetRad - uniforms.uDir.value;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        uniforms.uDir.value += delta * Math.min(1, dt * 4);
      }

      // Graceful TORNADO spin-up/spin-down: two continuous blends (0 = fully
      // out, 1 = fully in), each eased toward whichever state is actually
      // active at a slow enough rate (~1.4s time constant) to read as
      // gradually working up to full speed rather than popping in — and,
      // symmetrically, winding back down rather than cutting out the moment
      // TORNADO is toggled off or cameraMode switches away.
      // tornadoBlendRef drives the camera's own orbit, shared by float
      // (swimming — the WHIRLPOOL/VIRVEL feel), swing and noclip/watercraft
      // alike (see the camMode branch below); vortexBlendRef drives the real
      // water whirlpool visual (uVortex below), which only ever applies
      // while floating or swinging — flying never shows it.
      const tornadoApplicableMode =
        cameraModeRef.current === "float" ||
        cameraModeRef.current === "swing" ||
        cameraModeRef.current === "noclip" ||
        cameraModeRef.current === "watercraft";
      const tornadoTarget = tornadoOnRef.current && tornadoApplicableMode ? 1 : 0;
      tornadoBlendRef.current += (tornadoTarget - tornadoBlendRef.current) * Math.min(1, dt * 0.7);
      if (tornadoBlendRef.current < 0.0008) tornadoBlendRef.current = 0;
      else if (tornadoBlendRef.current > 0.9992) tornadoBlendRef.current = 1;
      const vortexTarget =
        tornadoOnRef.current &&
        (cameraModeRef.current === "float" || cameraModeRef.current === "swing")
          ? 1
          : 0;
      vortexBlendRef.current += (vortexTarget - vortexBlendRef.current) * Math.min(1, dt * 0.7);
      if (vortexBlendRef.current < 0.0008) vortexBlendRef.current = 0;
      else if (vortexBlendRef.current > 0.9992) vortexBlendRef.current = 1;
      uniforms.uVortex.value = vortexBlendRef.current;
      uniforms.uVortexOpening.value +=
        (tornadoOpeningRef.current - uniforms.uVortexOpening.value) * Math.min(1, dt * 4);
      uniforms.uVortexCenter.value.set(posRef.current.x, posRef.current.z);

      const p = palette(todRef.current);
      // Keep the real scene lights (see their creation above) in sync with
      // the same sun direction/color driving the water and sky shaders, so
      // glTF-model materials are lit consistently with the rest of the
      // scene instead of going flat black. Sun intensity fades toward the
      // hemisphere light's fill as it sets, rather than to zero, so
      // nighttime models stay dimly visible instead of vanishing.
      sunLight.position.copy(p.sunDir).multiplyScalar(100);
      sunLight.color.setRGB(p.sun[0], p.sun[1], p.sun[2]);
      sunLight.intensity = Math.max(0, p.sunDir.y) * 2.2 + 0.15;
      hemiLight.color.setRGB(p.top[0], p.top[1], p.top[2]);
      hemiLight.groundColor.setRGB(p.bot[0] * 0.4, p.bot[1] * 0.4, p.bot[2] * 0.4);
      uniforms.uSunDir.value.copy(p.sunDir);
      uniforms.uSkyColor.value.setRGB(p.top[0], p.top[1], p.top[2]);
      uniforms.uHorizonColor.value.setRGB(p.bot[0], p.bot[1], p.bot[2]);
      uniforms.uSunColor.value.setRGB(p.sun[0], p.sun[1], p.sun[2]);
      uniforms.uWaterShallow.value.setRGB(p.waterShallow[0], p.waterShallow[1], p.waterShallow[2]);
      uniforms.uWaterDeep.value.setRGB(p.waterDeep[0], p.waterDeep[1], p.waterDeep[2]);
      uniforms.uFogColor.value.setRGB(p.bot[0], p.bot[1], p.bot[2]);
      skyUniforms.uTop.value.copy(uniforms.uSkyColor.value);
      skyUniforms.uBottom.value.copy(uniforms.uHorizonColor.value);
      skyUniforms.uSunColor.value.copy(uniforms.uSunColor.value);
      (scene.fog as THREE.FogExp2).color.copy(uniforms.uFogColor.value);

      // Water color + optional seafloor. uWaterColor stays the always-on
      // WATER preset tint (unaffected by the color picker). uOverlayColor is
      // fed from the color picker's own hue instead (see WaterColorPicker in
      // SettingsPanel.tsx and hsvToRgb in lib/waterTint.ts) — a real, vivid
      // RGB color, independent of the preset — used only by the optional
      // flat overlay below (uWaterColorAlpha / "COLOR STRENGTH").
      const waterColor = WATER_COLORS[waterColorRef.current] ?? WATER_COLORS[0];
      uniforms.uWaterColor.value.set(waterColor.rgb[0], waterColor.rgb[1], waterColor.rgb[2]);
      const pickedOverlayColor = hsvToRgb(waterHueRef.current, 1, 1);
      uniforms.uOverlayColor.value.x +=
        (pickedOverlayColor[0] - uniforms.uOverlayColor.value.x) * Math.min(1, dt * 6);
      uniforms.uOverlayColor.value.y +=
        (pickedOverlayColor[1] - uniforms.uOverlayColor.value.y) * Math.min(1, dt * 6);
      uniforms.uOverlayColor.value.z +=
        (pickedOverlayColor[2] - uniforms.uOverlayColor.value.z) * Math.min(1, dt * 6);
      uniforms.uOpacity.value +=
        (waterOpacityRef.current - uniforms.uOpacity.value) * Math.min(1, dt * 6);
      uniforms.uWaterColorAlpha.value +=
        (waterColorAlphaRef.current - uniforms.uWaterColorAlpha.value) * Math.min(1, dt * 6);
      uniforms.uTintSat.value +=
        (waterSatRef.current - uniforms.uTintSat.value) * Math.min(1, dt * 6);
      uniforms.uTintBright.value +=
        (waterBrightRef.current - uniforms.uTintBright.value) * Math.min(1, dt * 6);
      uniforms.uSurfBright.value +=
        (surfBrightRef.current - uniforms.uSurfBright.value) * Math.min(1, dt * 6);
      uniforms.uSurfSat.value +=
        (surfSatRef.current - uniforms.uSurfSat.value) * Math.min(1, dt * 6);
      uniforms.uRefraction.value +=
        ((causticsOnRef.current && !lowEnd ? 1 : 0) - uniforms.uRefraction.value) *
        Math.min(1, dt * 4);
      const bot = BOTTOM_OPTIONS[bottomIdxRef.current] ?? BOTTOM_OPTIONS[0];
      // Sinus-modulerat "havsnivå"-offset. Vi flyttar hela scenen (yta, botten,
      // mellan-moln, kamera) rigidt i Y istället för att modulera bottendjupet
      // eller vågshaderns tid — det håller vågens rytm och form helt orörd.
      // depthSineSpeed (rise/sink TEMPO) and depthSineInterval (cycle length,
      // seconds) both scale the phase's time rate alongside depthSineFreq —
      // same stacked-multiplier pattern VÅGOR uses for TEMPO/FREKVENS/
      // VÅGPERIOD — and depthSinePeak reuses shapedWave() (VÅGOR's SPETS
      // curve) so the rise/sink shape can be sharpened just like a wave crest.
      const depthPhase =
        (t * depthSineSpeedRef.current * depthSineFreqRef.current * Math.PI * 2) /
        Math.max(0.001, depthSineIntervalRef.current);
      const depthWaveFn = depthSineWaveformRef.current === "sawtooth" ? sawtoothWave : shapedWave;
      const depthMod = depthSineOnRef.current
        ? depthWaveFn(depthPhase, depthSinePeakRef.current) * depthSineAmpRef.current
        : 0;
      // LEVEL DRIFT: an unbounded rise/sink layered on top of the bounded
      // DEPTH SINE oscillation above — same idea as noclip's FRITT FALL/
      // OMVÄND STIGNING, but continuously moving the water level itself
      // rather than the camera. depthDriftVelRef eases toward the dial's
      // target rate instead of snapping to it, then depthDriftRef integrates
      // that velocity into a running offset that never resets on its own —
      // 0 just holds the level wherever it last drifted to.
      depthDriftVelRef.current +=
        (depthDriftSpeedRef.current - depthDriftVelRef.current) * Math.min(1, dt * 2);
      depthDriftRef.current += depthDriftVelRef.current * dt;
      const effectiveDepth = Math.max(0.5, floorDepthRef.current);
      const levelY = depthMod + depthDriftRef.current;
      ocean.position.y = levelY;
      farOcean.position.y = levelY;
      if (bot.rgb) {
        floor.visible = true;
        const botRgb = bot.id === "custom" ? hexToRgbNorm(bottomColorRef.current) : bot.rgb;
        floorUniforms.uColor.value.setRGB(botRgb[0], botRgb[1], botRgb[2]);
        uniforms.uFloorColor.value.setRGB(botRgb[0], botRgb[1], botRgb[2]);
        // The floor stays put in world space (DJUP alone sets its position)
        // instead of riding levelY with the surface — the sea bed shouldn't
        // rise and fall along with the DEPTH SINE tide. The refraction/
        // caustics depth uniforms still need the *real* current gap between
        // the (possibly risen/sunk) surface and the fixed floor, though, so
        // those use floorSurfaceGap rather than the raw DJUP value.
        const floorSurfaceGap = Math.max(0.5, effectiveDepth + levelY);
        uniforms.uFloorDepth.value = floorSurfaceGap;
        floor.position.y = -effectiveDepth;
        floorUniforms.uTime.value = t;
        floorUniforms.uCausticDepth.value = floorSurfaceGap;
        floorUniforms.uCausticAmp.value = ampRef.current;
        floorUniforms.uCausticFreq.value = uniforms.uFreq.value;
        floorUniforms.uCausticsOn.value +=
          ((causticsOnRef.current && !lowEnd ? 1 : 0) - floorUniforms.uCausticsOn.value) *
          Math.min(1, dt * 4);
        // LOW GRAPHICS MODE treats BOTTOM "clouds" as flat (the fbm noise
        // pattern it draws is itself a live-noise effect) — falls back to
        // the same solid uColor every other flat bottom option renders.
        const isClouds = bot.id === "clouds" && !lowEnd;
        // Cloud mode blends independently of the sand-texture toggle.
        const cloudTarget = isClouds ? 1 : 0;
        floorUniforms.uClouds.value +=
          (cloudTarget - floorUniforms.uClouds.value) * Math.min(1, dt * 4);
        const target = isClouds || lowEnd ? 0 : floorTextureRef.current ? 1 : 0;
        floorUniforms.uTextured.value +=
          (target - floorUniforms.uTextured.value) * Math.min(1, dt * 4);
        // Drift moln-lagret långsamt över tid — nu opt-in via ANIMERA
        // (floorCloudsAnimatedRef); av som standard håller molnlagret still.
        if (floorCloudsAnimatedRef.current) {
          floorUniforms.uCloudScroll.value.x = t * 0.015;
          floorUniforms.uCloudScroll.value.y = t * 0.01;
        }
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

      // Mellan-moln (drivande lager mellan botten och yta). LOW GRAPHICS
      // MODE forces this whole live-noise layer off.
      const midCloudsActive = midCloudsOnRef.current && !lowEnd;
      if (midCloudsActive) {
        const frac = Math.max(0.05, Math.min(0.95, midCloudsHeightRef.current));
        // frac=0 → precis över botten, frac=1 → nära ytan.
        midClouds.position.y = -effectiveDepth + effectiveDepth * frac + levelY;
        midCloudUniforms.uTime.value = t;
        midCloudUniforms.uCloudScroll.value.x = t * 0.04;
        midCloudUniforms.uCloudScroll.value.y = t * 0.025;
      }
      // MOLN TONING: ease opacity toward on/off (cloudFadeSpeedRef, user-
      // adjustable) instead of popping visible/invisible on toggle.
      midCloudFadeRef.current +=
        ((midCloudsActive ? 1 : 0) - midCloudFadeRef.current) *
        Math.min(1, dt * cloudFadeSpeedRef.current);
      midCloudUniforms.uOpacity.value = midCloudFadeRef.current;
      midClouds.visible = midCloudFadeRef.current > 0.003;

      // Himmel-moln (drivande molnlager högt ovanför ytan). Höjden hålls
      // fast i världsrymden (som botten/mellan-moln) istället för relativt
      // kameran, annars skulle molnen aldrig glida förbi. LOW GRAPHICS MODE
      // forces this off too (see skyCloudsTargetOn further below, which
      // actually gates visibility/opacity — this block just needs to stop
      // scrolling the now-invisible layer's uCloudScroll).
      if (skyCloudsOnRef.current && !lowEnd) {
        const frac = Math.max(0, Math.min(1, skyCloudsHeightRef.current));
        skyClouds.position.y = 60 + frac * 440 + levelY;
        skyCloudUniforms.uTime.value = t;
        skyCloudUniforms.uCloudScroll.value.x = t * 0.02;
        skyCloudUniforms.uCloudScroll.value.y = t * 0.013;
      }

      // Dölj/visa vattenytan.
      ocean.visible = !hideWaterRef.current;

      // GUNGA's pendulum angle, computed unconditionally (not just while
      // camMode === "swing") purely from the shared wave clock and GUNGA
      // INTENSITET, so it keeps swinging "in the background" while in
      // another mode — letting the interval-session driver watch it for the
      // bottom-of-the-arc crossing (theta === 0, nearest the water) even
      // during a "float" interval, ahead of switching into "swing".
      const swingIntensityNow = Math.max(0.0001, swingIntensityRef.current);
      const swingOmegaNow = 0.55 * swingIntensityNow;
      const swingAmpRadNow = THREE.MathUtils.degToRad(Math.min(75, 40 * swingIntensityNow));
      const swingThetaNow = swingAmpRadNow * Math.sin(t * swingOmegaNow);
      swingThetaRef.current = swingThetaNow;

      // Apply joystick velocity (game-pad style): stick.y up = forward (-z), x = strafe.
      // STRÖM-spaken lägger till en konstant drivkraft (drift) så kameran bärs
      // med strömmen även när NAV är i vila.
      // I VIRVEL-läge tolkas NAV om: stick.y = närmare/längre bort från
      // virvelns centrum, stick.x = vridriktning kring virveln.
      const camMode = cameraModeRef.current;
      // Computed early (not just before normalSurfaceY below) so the TORNADO
      // CLOUD block further down — which runs before that point in the frame
      // — can also sample the real wave height (see tornadoWaterHeightAt
      // there).
      const dirRad = (waveDirRef.current * Math.PI) / 180;
      const walkSpeed = 16; // m/s at full deflection
      const driftSpeed = 13.2; // m/s at full deflection — mjukare än aktiv rörelse
      let camX: number, camZ: number;
      // TORNADO CLOUD: whichever of GUNGA's or NAV/HÖJD's own tornado spin
      // (if any) is active this frame stashes its live center/radius/angle
      // here so the shared funnel-cloud mesh (see tornadoCloudMeshRef setup
      // further down in this effect) can be positioned after camX/camZ/
      // camYRef settle below, without either branch needing to know the
      // mesh exists.
      let tornadoCloudActive = false;
      let tornadoCloudX = 0;
      let tornadoCloudY = 0;
      let tornadoCloudZ = 0;
      let tornadoCloudRadius = 40;
      let tornadoCloudHeight = 40 * TORNADO_CLOUD_HEIGHT_SCALE;
      let tornadoCloudAngle = 0;
      // Real ocean height at (x, z) right now — used below by the swing and
      // noclip/watercraft branches to pin the TORNADO CLOUD's tip to the
      // actual water surface at its own xz spot, instead of the camera's/
      // swing's own altitude (a tornado should look rooted in the water, not
      // bob around with wherever the camera happens to be).
      const tornadoWaterHeightAt = (x: number, z: number) =>
        waveHeight(
          x,
          z,
          t,
          ampRef.current,
          regularRef.current,
          regularCrossRef.current,
          regularPeriodRef.current,
          wavePeakRef.current,
          dirRad,
          realisticRef.current,
          fftWaveComponents,
          dyingRef.current,
          dyingWaveComponents,
          dyingAmpRef.current,
          dyingWaveT,
          freqRef.current,
          heaveSkewRef.current,
        );
      if (camMode === "noclip" || camMode === "watercraft") {
        // Free 3D flight, no wave physics: NAV's y-axis moves along the full
        // view direction (pitch included), so looking up/down while pushing
        // forward climbs or dives — the standard "spectator/noclip" feel.
        // NAV's x-axis still strafes purely horizontally. The dedicated HÖJD
        // stick adds a pure vertical rate on top, for climbing/descending
        // while looking level.
        const yaw = yawRef.current;
        const pitch = pitchRef.current;
        const cosPitch = Math.cos(pitch);
        const fwdX = -Math.sin(yaw) * cosPitch;
        const fwdY = Math.sin(pitch);
        const fwdZ = -Math.cos(yaw) * cosPitch;
        const rightX = Math.cos(yaw),
          rightZ = -Math.sin(yaw);
        const speed = walkSpeed * Math.max(0.1, noclipSpeedRef.current);
        // DRIFT XZ (noclipDriftWorldRef, a sticky world-space dial — same
        // idea as float mode's STRÖM) keeps carrying the camera even with
        // NAV at rest, just like STRÖM does in FRI.
        const driftSpeedNoclip = driftSpeed * Math.max(0.1, noclipSpeedRef.current);
        const moveX = stickRef.current.x * rightX + stickRef.current.y * fwdX;
        const moveZ = stickRef.current.x * rightZ + stickRef.current.y * fwdZ;
        // FRITT FALL / OMVÄND STIGNING pin the vertical rate to a strong,
        // constant dive/climb, overriding HÖJD (vertStickRef) while active —
        // a quick way to commit to a long, hands-off descent/ascent through
        // VÄRLDSGRÄNS's y extension below instead of holding HÖJD deflected.
        // NOCLIP FALL/RISE SPEED (noclipFallRiseSpeedRef, "throttle") and
        // NOCLIP EASE (noclipVertEaseTimeRef, "grace") are both user-tunable
        // in SETTINGS → KAMERA.
        const fallRiseSpeed =
          noclipFallRiseSpeedRef.current * Math.max(0.1, noclipSpeedRef.current);
        const targetVertRate = noclipFreeFallOnRef.current
          ? -fallRiseSpeed
          : noclipReverseRiseOnRef.current
            ? fallRiseSpeed
            : (stickRef.current.y * fwdY + vertStickRef.current.y) * speed;
        // Ease the applied vertical rate toward its target with a frame-rate-
        // independent exponential (v += (target - v) * (1 - e^(-dt/tau))),
        // instead of snapping straight to it. That's what makes FRITT
        // FALL/OMVÄND STIGNING read as a real accelerating fall/climb rather
        // than an instant terminal velocity, and — the same mechanic doing
        // double duty — makes every transition between them (or back to
        // HÖJD/NAV control, including the auto-alternate cycle above) a
        // graceful glide instead of a jarring snap.
        const vertTau = Math.max(0.02, noclipVertEaseTimeRef.current);
        const vertBlend = 1 - Math.exp(-physDt / vertTau);
        noclipVertVelRef.current += (targetVertRate - noclipVertVelRef.current) * vertBlend;
        posRef.current.x +=
          (moveX * speed + noclipDriftWorldRef.current.x * driftSpeedNoclip) * physDt;
        posRef.current.y += noclipVertVelRef.current * physDt;
        posRef.current.z +=
          (moveZ * speed + noclipDriftWorldRef.current.z * driftSpeedNoclip) * physDt;
        // TORNADO: an optional whirlpool-style circular swirl added on top
        // of the manual flight above, instead of replacing it — posRef.current
        // (still driven by NAV/HÖJD/DRIFT XZ exactly as above) keeps acting
        // as the swirl's own center, so it drifts wherever you actually fly
        // it while the view itself corkscrews around that point. Purely a
        // rendered offset (never written back into posRef.current), so it
        // never feeds back into the drift/physics above. tornadoBlendRef both
        // ramps the spin up from a standstill and scales how far the orbit
        // reaches, so toggling TORNADO on/off eases the swirl in/out instead
        // of popping.
        {
          const tornadoDirSign = tornadoDirectionRef.current === "ccw" ? -1 : 1;
          const tornadoOmega =
            0.35 * tornadoSpeedRef.current * tornadoDirSign * tornadoBlendRef.current;
          tornadoAngleRef.current += tornadoOmega * physDt;
          const ang = tornadoAngleRef.current;
          camX = posRef.current.x + Math.cos(ang) * tornadoRadiusRef.current * tornadoBlendRef.current;
          camZ = posRef.current.z + Math.sin(ang) * tornadoRadiusRef.current * tornadoBlendRef.current;
          tornadoCloudActive = tornadoBlendRef.current > 0.003;
          tornadoCloudX = posRef.current.x;
          tornadoCloudZ = posRef.current.z;
          tornadoCloudRadius = tornadoRadiusRef.current;
          // Fixed to the real water surface (see tornadoWaterHeightAt above)
          // plus the adjustable Y offset, not to the camera's own altitude —
          // and swingHeight-tall regardless of not actually swinging, per the
          // shared tornadoCloudYOffset/TORNADO settings.
          tornadoCloudHeight = swingHeightRef.current;
          tornadoCloudY =
            tornadoWaterHeightAt(tornadoCloudX, tornadoCloudZ) +
            tornadoCloudYOffsetRef.current +
            tornadoCloudHeight / 2;
          tornadoCloudAngle = ang;
        }
        camYRef.current = posRef.current.y;
        camVYRef.current = 0;
      } else if (camMode === "swing") {
        // Pendulum swinging back and forth high above the water. The
        // horizontal anchor is wherever the camera was last (so entering
        // swing mode never teleports — this doubles as its "custom start
        // position"); GUNGA POSITION Y sets the resting altitude and GUNGA
        // INTENSITET the arc's angular amplitude/speed, while swingYawRef
        // (captured on mode entry) keeps the swing plane perpendicular to
        // the direction you were already facing. GUNGA X scales how far
        // that arc reaches side-to-side (0, the default, keeps it hovering
        // in place) and GUNGA HÖJD is the vertical excursion in meters —
        // independent of both, so it can swing tens of thousands of meters
        // up/down from wherever it rests. Purely multiplicative in
        // intensity (no additive floor) so a near-zero GUNGA INTENSITET
        // truly settles toward a motionless hover instead of bottoming out
        // at a fixed minimum swing; intensity 1 still matches the
        // original tuning (40° arc, omega 0.55).
        const omega = swingOmegaNow;
        const theta = swingThetaNow;
        const rawSwingY =
          swingPositionYRef.current +
          swingHeightRef.current *
            swingYWaveformValue(swingYWaveformRef.current, theta, t * omega, swingAmpRadNow);

        // TORNADO: crossfades the pendulum arc into a circular orbit around
        // the anchor at swing altitude instead of replacing it outright — a
        // whirlpool in the sky (plus a real one in the water directly below,
        // see uVortex/vortexBlendRef above). Both the pendulum's own offset
        // and the orbit's keep computing every frame; tornadoBlendRef blends
        // between them and ramps the orbit's own angular speed up from a
        // standstill, so toggling TORNADO on/off crossfades smoothly instead
        // of snapping straight from one shape to the other.
        const rightX = Math.cos(swingYawRef.current),
          rightZ = -Math.sin(swingYawRef.current);
        const horizArmLen = Math.max(8, Math.min(60, swingPositionYRef.current * 0.6));
        const rawSwingOff = Math.sin(theta) * horizArmLen * swingXFactorRef.current;
        const pendOffX = rightX * rawSwingOff;
        const pendOffZ = rightZ * rawSwingOff;
        const tornadoDirSign = tornadoDirectionRef.current === "ccw" ? -1 : 1;
        const tornadoOmega =
          0.35 * tornadoSpeedRef.current * tornadoDirSign * tornadoBlendRef.current;
        tornadoAngleRef.current += tornadoOmega * physDt;
        const ang = tornadoAngleRef.current;
        const tornadoOffX = Math.cos(ang) * tornadoRadiusRef.current;
        const tornadoOffZ = Math.sin(ang) * tornadoRadiusRef.current;
        const rawOffX = pendOffX + (tornadoOffX - pendOffX) * tornadoBlendRef.current;
        const rawOffZ = pendOffZ + (tornadoOffZ - pendOffZ) * tornadoBlendRef.current;
        tornadoCloudActive = tornadoBlendRef.current > 0.003;
        tornadoCloudX = posRef.current.x;
        tornadoCloudZ = posRef.current.z;
        tornadoCloudRadius = tornadoRadiusRef.current;
        // Fixed to the real water surface (see tornadoWaterHeightAt above)
        // plus the adjustable Y offset, not to the pendulum's own bobbing
        // height (rawSwingY) — a tornado should look rooted in the water,
        // not swing along with the camera.
        tornadoCloudHeight = swingHeightRef.current;
        tornadoCloudY =
          tornadoWaterHeightAt(tornadoCloudX, tornadoCloudZ) +
          tornadoCloudYOffsetRef.current +
          tornadoCloudHeight / 2;
        tornadoCloudAngle = ang;

        // Ease in from wherever the camera actually was the instant swing
        // mode was entered (swingBlendRef, armed in the cameraMode-change
        // effect) instead of snapping straight to the formula's value for
        // whatever the wave clock's phase happens to be.
        let blend = 1;
        const activeBlend = swingBlendRef.current;
        if (activeBlend) {
          const SWING_BLEND_S = 0.6;
          const elapsedS = (now - activeBlend.startMs) / 1000;
          if (elapsedS >= SWING_BLEND_S) {
            swingBlendRef.current = null;
          } else {
            const lin = Math.max(0, elapsedS / SWING_BLEND_S);
            blend = lin * lin * (3 - 2 * lin); // smoothstep
          }
        }
        camX = posRef.current.x + (activeBlend ? rawOffX * blend : rawOffX);
        camZ = posRef.current.z + (activeBlend ? rawOffZ * blend : rawOffZ);
        camYRef.current = activeBlend
          ? activeBlend.fromY + (rawSwingY - activeBlend.fromY) * blend
          : rawSwingY;
        camVYRef.current = 0;
      } else {
        // NAV-spaken är kamera-relativ: stick.y "framåt" ska alltid röra sig
        // dit kameran för tillfället tittar (yaw), inte fast världs -z, annars
        // känns det som att man åker åt fel håll så fort man har svängt.
        // STRÖM (driften) representerar en ström i en fast riktning och
        // förblir därför i världsrymden, orörd av kamerans rotation.
        const yaw = yawRef.current;
        const fwdX = -Math.sin(yaw),
          fwdZ = -Math.cos(yaw);
        const rightX = Math.cos(yaw),
          rightZ = -Math.sin(yaw);
        const walkX = stickRef.current.x * rightX + stickRef.current.y * fwdX;
        const walkZ = stickRef.current.x * rightZ + stickRef.current.y * fwdZ;
        posRef.current.x += (walkX * walkSpeed + driftWorldRef.current.x * driftSpeed) * physDt;
        posRef.current.z += (walkZ * walkSpeed + driftWorldRef.current.z * driftSpeed) * physDt;
        // TORNADO/WHIRLPOOL: while swimming, an optional circular swirl added
        // on top of the normal current-driven position — posRef.current
        // (still driven by NAV/STRÖM exactly as above) keeps acting as the
        // whirlpool's own center, so it drifts wherever the current carries
        // it while the view corkscrews (and, per vortexBlendRef above, a real
        // water vortex opens) around that point — this is the old standalone
        // VIRVEL mode's feel, reached here via the top HUD's WHIRLPOOL toggle
        // instead of its own camera mode. Purely a rendered offset (never
        // written back into posRef.current), so it never feeds back into the
        // drift/current physics above.
        {
          const tornadoDirSign = tornadoDirectionRef.current === "ccw" ? -1 : 1;
          const tornadoOmega =
            0.35 * tornadoSpeedRef.current * tornadoDirSign * tornadoBlendRef.current;
          tornadoAngleRef.current += tornadoOmega * physDt;
          const ang = tornadoAngleRef.current;
          camX = posRef.current.x + Math.cos(ang) * tornadoRadiusRef.current * tornadoBlendRef.current;
          camZ = posRef.current.z + Math.sin(ang) * tornadoRadiusRef.current * tornadoBlendRef.current;
          tornadoCloudActive = tornadoBlendRef.current > 0.003;
          tornadoCloudX = posRef.current.x;
          tornadoCloudY = camYRef.current ?? 0;
          tornadoCloudZ = posRef.current.z;
          tornadoCloudRadius = tornadoRadiusRef.current;
          tornadoCloudHeight = tornadoCloudRadius * TORNADO_CLOUD_HEIGHT_SCALE;
          tornadoCloudAngle = ang;
        }
      }

      // VÄRLDSGRÄNS (world boundary): wrap x/z to the opposite edge once the
      // camera crosses ±worldBoundarySize — invisible below since the ocean/
      // floor/cloud planes recenter on the camera every frame regardless of
      // its absolute position (see wrapAxis above).
      if (worldBoundaryOnRef.current) {
        const halfXZ = Math.max(50, worldBoundarySizeRef.current);
        const wrappedX = wrapAxis(posRef.current.x, halfXZ);
        const wrappedZ = wrapAxis(posRef.current.z, halfXZ);
        if (wrappedX !== posRef.current.x) {
          camX += wrappedX - posRef.current.x;
          posRef.current.x = wrappedX;
        }
        if (wrappedZ !== posRef.current.z) {
          camZ += wrappedZ - posRef.current.z;
          posRef.current.z = wrappedZ;
        }
      }

      // Rekentrera ytan, botten och molnlagret runt kameran varje frame så
      // de ändliga planen (och havsringen, se OCEAN_FAR_INNER_RADIUS) alltid
      // täcker synfältet — vågorna och sandtexturen räknas ut i world space
      // (se shadrarna ovan) så att
      // flytta meshen bara skiftar vilket fönster av det oändliga fältet som
      // visas, utan att mönstret hoppar. Resultatet upplevs som en oändlig
      // vattenyta/botten oavsett hur långt kameran driver.
      ocean.position.x = camX;
      ocean.position.z = camZ;
      farOcean.position.x = camX;
      farOcean.position.z = camZ;
      floor.position.x = camX;
      floor.position.z = camZ;
      midClouds.position.x = camX;
      midClouds.position.z = camZ;
      skyClouds.position.x = camX;
      skyClouds.position.z = camZ;

      // TORNADO CLOUD: unlike the infinite-tiling decks above (which just
      // recenter on the camera every frame, never representing a real world
      // position), this mesh sits at the active tornado's actual center —
      // tornadoCloudX/Y/Z/Radius/Angle, set by whichever of the swing/noclip
      // branches above had its own tornado spin engaged this frame. MOLN
      // TONING's shared fade rate (cloudFadeSpeedRef) eases uOpacity toward
      // on/off instead of popping visible/invisible on toggle, exactly like
      // the mid/sky cloud decks.
      const tornadoCloudWanted = tornadoCloudOnRef.current && tornadoCloudActive;
      tornadoCloudFadeRef.current +=
        ((tornadoCloudWanted ? 1 : 0) - tornadoCloudFadeRef.current) *
        Math.min(1, dt * cloudFadeSpeedRef.current);
      tornadoCloudUniforms.uOpacity.value = tornadoCloudFadeRef.current;
      tornadoCloud.visible = tornadoCloudFadeRef.current > 0.003;
      if (tornadoCloud.visible) {
        tornadoCloud.position.set(tornadoCloudX, tornadoCloudY, tornadoCloudZ);
        tornadoCloud.rotation.y = tornadoCloudAngle;
        const topRadius = tornadoCloudRadius * TORNADO_CLOUD_TOP_SCALE;
        tornadoCloud.scale.set(topRadius, tornadoCloudHeight, topRadius);
        tornadoCloudUniforms.uTime.value = t;
        tornadoCloudUniforms.uCloudScroll.value.x = Math.cos(tornadoCloudAngle) * 0.3;
        tornadoCloudUniforms.uCloudScroll.value.y = Math.sin(tornadoCloudAngle) * 0.3;
      }

      const normalSurfaceY = waveHeight(
        camX,
        camZ,
        t,
        ampRef.current,
        regularRef.current,
        regularCrossRef.current,
        regularPeriodRef.current,
        wavePeakRef.current,
        dirRad,
        realisticRef.current,
        fftWaveComponents,
        dyingRef.current,
        dyingWaveComponents,
        dyingAmpRef.current,
        dyingWaveT,
        freqRef.current,
        heaveSkewRef.current,
      );
      // Blend the whirlpool's own radial surface in on top of the normal
      // wave as vortexBlendRef eases in/out, so the water gradually deepens
      // into (or fills back in from) the vortex instead of the camera's
      // buoyancy/goggles/underwater checks below snapping between the two
      // formulas the instant TORNADO toggles or cameraMode switches.
      const surfaceY =
        vortexBlendRef.current > 0.0008
          ? normalSurfaceY +
            (whirlpoolSurfaceHeight(
              camX - posRef.current.x,
              camZ - posRef.current.z,
              t,
              ampRef.current,
              regularPeriodRef.current,
              tornadoOpeningRef.current,
              freqRef.current,
            ) -
              normalSurfaceY) *
              vortexBlendRef.current
          : normalSurfaceY;

      // "Watercraft" camera mode: the raft (see WatercraftRig) floats on the
      // real rendered ocean by sampling the exact same waveHeight() the
      // camera itself floats on above — just at the raft's own fixed world
      // position instead of the camera's. Roll/pitch are a light cosmetic
      // sway rather than a true wave-slope estimate (cheap, and plenty
      // convincing at the raft's size). Building/sculpting input (see the
      // pointer handlers near the renderer setup below) only takes effect
      // while this mode is active; the rig itself no-ops while hidden.
      const watercraftRig = watercraftRigRef.current;
      if (watercraftRig) {
        if (camMode === "watercraft") {
          const raftSurfaceY = waveHeight(
            WATERCRAFT_RAFT_X,
            WATERCRAFT_RAFT_Z,
            t,
            ampRef.current,
            regularRef.current,
            regularCrossRef.current,
            regularPeriodRef.current,
            wavePeakRef.current,
            dirRad,
            realisticRef.current,
            fftWaveComponents,
            dyingRef.current,
            dyingWaveComponents,
            dyingAmpRef.current,
            dyingWaveT,
            freqRef.current,
            heaveSkewRef.current,
          );
          watercraftRig.setBob(
            raftSurfaceY - 0.3,
            Math.cos(t * 0.33) * 0.02,
            Math.sin(t * 0.5 + 0.4) * 0.035,
          );
          watercraftRig.tick(camera);
        }
        watercraftRig.setVisible(camMode === "watercraft");
      }

      // SURGE: an independent, slow back-and-forth current — the same
      // "carried by water" feeling as SVAJ below, but decoupled from the
      // wave's heave entirely: it runs on its own clock (t, not
      // heaveNorm/surfaceY) so it keeps gently carrying the camera fore/aft
      // even while the wave itself is flat or SVAJ is off. Computed once per
      // frame, mode-independent — like DEPTH DRIFT above it — since neither
      // the direction rotation nor the oscillator depend on which camMode is
      // active; only whether the resulting offset gets applied below does
      // (skipped for GUNGA/swing, whose pendulum arc already fully owns
      // camX/camZ, same as SVAJ skips it).
      let surgeX = 0,
        surgeZ = 0;
      {
        const rotMode = surgeRotationModeRef.current;
        const rotSpeedRad = (surgeRotationSpeedRef.current * Math.PI) / 180;
        if (rotMode === "cw" || rotMode === "ccw") {
          surgeAngleRef.current += (rotMode === "cw" ? -1 : 1) * rotSpeedRad * physDt;
        } else if (rotMode === "random") {
          // Damped random walk in angular *velocity* rather than raw angle
          // jitter — reads as the current's heading gradually swinging
          // around instead of visibly jittering frame to frame, closer to
          // how a real current's direction actually shifts.
          surgeRandomAngVelRef.current += (Math.random() * 2 - 1) * rotSpeedRad * physDt;
          surgeRandomAngVelRef.current *= Math.max(0, 1 - physDt * 0.5);
          surgeAngleRef.current += surgeRandomAngVelRef.current * physDt;
        }
        surgeWorldRef.current = {
          x: Math.sin(surgeAngleRef.current),
          z: Math.cos(surgeAngleRef.current),
        };

        const suAmp = surgeAmpRef.current;
        let surgeTargetX = 0,
          surgeTargetZ = 0;
        if (suAmp > 0.001) {
          const ss = Math.max(0.02, surgeSpeedRef.current);
          const cyc = Math.sin(t * ss * 0.4);
          surgeTargetX = suAmp * cyc * surgeWorldRef.current.x;
          surgeTargetZ = suAmp * cyc * surgeWorldRef.current.z;
        }
        // Same spring-damped ease as SVAJ's swK/swC below, so SURGE reads
        // like the same kind of floating inertia rather than snapping
        // straight to its target every frame.
        const suK = 5 + 20 * Math.max(0.05, surgeSpeedRef.current);
        const suC = 2 * 0.6 * Math.sqrt(suK);
        const surgeAX = suK * (surgeTargetX - surgePosRef.current.x) - suC * surgeVelRef.current.x;
        const surgeAZ = suK * (surgeTargetZ - surgePosRef.current.z) - suC * surgeVelRef.current.z;
        surgeVelRef.current.x += surgeAX * physDt;
        surgeVelRef.current.z += surgeAZ * physDt;
        surgePosRef.current.x += surgeVelRef.current.x * physDt;
        surgePosRef.current.z += surgeVelRef.current.z * physDt;
        if (camMode !== "swing") {
          surgeX = surgePosRef.current.x;
          surgeZ = surgePosRef.current.z;
        }
      }

      // The wave-following buoyancy spring and current/sway drift apply only
      // in float mode — noclip/watercraft fly free of the wave surface and
      // swing already set camYRef.current to its pendulum height above. In
      // float mode, surfaceY already blends in the water whirlpool's own
      // depression when TORNADO is on (see vortexBlendRef above), so the
      // buoyancy spring below naturally rides the camera down into it —
      // exactly the old standalone VIRVEL mode's feel.
      let swayX = 0,
        swayZ = 0;
      if (camMode === "float") {
        // Compute wave vertical velocity first so buoyancy can react to it.
        // Clamp it too, not just the anticipatory peek below: on a dropped
        // frame (large dt) a sharp crest can still alias into a real spike
        // here even without any forward lookahead involved, which is exactly
        // the failure mode on the low-end devices this dial should stay safe
        // for.
        if (prevSurfaceRef.current === null) prevSurfaceRef.current = surfaceY;
        const maxBaseSlope = ampRef.current * 8.0;
        const surfVel = Math.max(
          -maxBaseSlope,
          Math.min(maxBaseSlope, (surfaceY - prevSurfaceRef.current) / Math.max(dt, 1e-4)),
        );
        prevSurfaceRef.current = surfaceY;

        // Anticipatory velocity: peek slightly into the future so buoyancy
        // reacts at the *start* of a wave rise (trough) rather than mid-rise.
        // Sharper crests (higher SPETS) have very brief, near-cusp peaks — a
        // fixed lead samples a secant slope that can land right on that cusp
        // and wildly over/underestimate the true derivative, which used to
        // spike anticipVel and make the spring ring (the SPETS/heave wobble).
        // Shrink the lookahead hard as sharpness rises, hard-clamp the raw
        // secant slope to a sane bound, and lean harder on the already-exact
        // small-dt surfVel instead of the error-prone long peek.
        const peakK = Math.min(1, Math.max(0, (wavePeakRef.current - 1) / 5));
        // ANTICIPATION (waveAnticipationRef, VÅGOR settings tab) scales both
        // how far ahead this peeks and how much of that peek leans on the
        // target below — 0 makes buoyancy purely reactive (tracks only the
        // current surface height, prone to visibly lagging a crest), 1 is
        // the tuned default. Larger base lead → buoyancy reacts as soon as
        // the wave begins to rise, not after it has already lifted the
        // surface past the camera. At the default TEMPO/GUNGA-hastighet the
        // spring itself (see k/zeta below) lags its target by roughly a
        // fifth of the wave period, so a lead of 0.7 (paired with a 0.55
        // futureBias) under-corrected for it — the camera was still visibly
        // rising after the surface had already crested, i.e. reacting to
        // the wave hitting it instead of anticipating it. The default of 1
        // was raised until a numeric replay of this spring against the
        // default wave settings put the camera's own height peak within
        // noise of the surface's peak instead of trailing it.
        const anticipation = waveAnticipationRef.current;
        const lead = anticipation / (1 + peakK * 6.0);
        const futureNormalSurf = waveHeight(
          camX,
          camZ,
          t + lead,
          ampRef.current,
          regularRef.current,
          regularCrossRef.current,
          regularPeriodRef.current,
          wavePeakRef.current,
          dirRad,
          realisticRef.current,
          fftWaveComponents,
          dyingRef.current,
          dyingWaveComponents,
          dyingAmpRef.current,
          dyingWaveT + lead,
          freqRef.current,
          heaveSkewRef.current,
        );
        // Mirror surfaceY's own vortexBlendRef blend here too (using the same
        // current-frame blend value, since it eases too slowly over ~1.4s for
        // the short `lead` lookahead to matter) — otherwise, whenever TORNADO
        // is on, futureSurf silently drops back to the plain ocean while
        // surfaceY includes the whirlpool's real depression, and the mismatch
        // between the two feeds a large spurious anticipatory velocity into
        // the buoyancy spring below, fighting the vortex and reading as janky
        // heave instead of a smooth ride down into it.
        const futureSurf =
          vortexBlendRef.current > 0.0008
            ? futureNormalSurf +
              (whirlpoolSurfaceHeight(
                camX - posRef.current.x,
                camZ - posRef.current.z,
                t + lead,
                ampRef.current,
                regularPeriodRef.current,
                tornadoOpeningRef.current,
                freqRef.current,
              ) -
                futureNormalSurf) *
                vortexBlendRef.current
            : futureNormalSurf;
        const maxSlope = ampRef.current * 6.0;
        const rawAnticip = Math.max(
          -maxSlope,
          Math.min(maxSlope, (futureSurf - surfaceY) / Math.max(lead, 1e-4)),
        );
        const blend = 1 - peakK * 0.85;
        const anticipVel = rawAnticip * blend + surfVel * (1 - blend);
        // Low-pass the velocity estimate before it drives the spring — but
        // only while REALISTISKA VÅGOR or DÖENDE VÅG is actually driving the
        // height field. Both sum many out-of-phase frequency components (see
        // fftOceanSpectrum.ts), so a secant slope taken over the `lead`
        // lookahead window (and even the frame-to-frame surfVel) jitters in a
        // way the old 2-4 term analytic sine never did. But this filter's
        // time constant (~1/8s) is comparable to or slower than REGELBUNDEN's
        // own oscillation period at higher TEMPO values (e.g. LEGACY's
        // waveSpeed=5 defaults to a ~1.4s main-term period), so applying it
        // unconditionally lagged and phase-distorted that wave's already
        // exact motion too — felt as heave/sway repeatedly slowing down
        // instead of moving at a constant rate. Skip it for the plain
        // analytic modes, where the raw estimate was always exact anyway.
        const usesFftWaveform = realisticRef.current || dyingRef.current;
        if (usesFftWaveform) {
          const velSmoothing = Math.min(1, dt * 8);
          anticipVelSmoothRef.current += (anticipVel - anticipVelSmoothRef.current) * velSmoothing;
        } else {
          anticipVelSmoothRef.current = anticipVel;
        }
        const anticipVelSmoothed = anticipVelSmoothRef.current;

        const amp = ampRef.current;
        const b = buoyRef.current;
        const sub = submergeRef.current;
        const lift = floatLiftRef.current;
        // Feed-forward the future surface height into the target so the camera
        // starts moving in sync with the incoming wave instead of chasing it.
        // Weighted toward the future sample (see `lead`/ANTICIPATION above)
        // so most of the spring's own tracking lag gets cancelled by the
        // time the real wave arrives, rather than leaving the camera to
        // visibly catch up after the crest has already passed under it.
        // Scales with the same ANTICIPATION dial as `lead`, clamped below 1
        // so the target never extrapolates past the future sample itself.
        const futureBias = Math.min(0.95, 0.75 * anticipation);
        const anticipSurf = surfaceY * (1 - futureBias) + futureSurf * futureBias;
        const cap = amp * 1.4;
        // Smooth ramp instead of Math.max(0, anticipVel): the hard clamp has
        // a slope discontinuity right where anticipVel crosses zero, which
        // is exactly the rising-to-falling transition at the wave crest —
        // rawLift below has no such gate, so this was the one place putting
        // a kink in targetY right at the top of the wave, felt as choppiness
        // there. Softness is a small fraction of maxSlope so the ramp still
        // reads as max(0, x) away from the crossing.
        const diveSoftness = maxSlope * 0.12;
        const diveRamp =
          (anticipVelSmoothed +
            Math.sqrt(anticipVelSmoothed * anticipVelSmoothed + diveSoftness * diveSoftness)) /
          2;
        const rawDive = diveRamp * sub * 0.6 * (0.6 + amp * 0.6);
        const rawLift = anticipVelSmoothed * lift * 0.35 * (0.6 + amp * 0.6);
        const diveOffset = Math.min(cap, rawDive);
        const liftOffset = Math.max(-cap, Math.min(cap, rawLift));
        const targetY = anticipSurf + heightRef.current - diveOffset + liftOffset;

        if (camYRef.current === null) camYRef.current = targetY;
        // Cutting stiffness in the previous pass fixed the hard bounce but
        // broke heave sync: the wave's own angular frequency (~0.9*waveSpeed,
        // a few rad/s at defaults) was no longer well below the spring's
        // natural frequency (sqrt(k)), so it started visibly lagging the
        // wave. Stiffness is restored to its original value — needed for the
        // spring to track the wave's frequency closely — and instead only
        // damping is pushed up, close to critical. The "hard hit and bounce"
        // feeling was underdamping (zeta 0.32) causing overshoot/oscillation
        // after a fast snap, not the fast snap itself; near-critical damping
        // keeps the same fast, well-synced tracking but removes the overshoot
        // so it settles smoothly instead of bouncing.
        const k = (10 + 26 * bobSpeedRef.current) * (1 + peakK * 0.2);
        const zeta = 0.85 + peakK * 0.1;
        const c = 2 * zeta * Math.sqrt(k);
        const gravity = (1.2 + 3 * amp) * b * sub - (1.0 + 2 * amp) * b * lift;
        const ay = k * (targetY - camYRef.current) - c * camVYRef.current - gravity;
        camVYRef.current += ay * physDt;
        camYRef.current += camVYRef.current * physDt;

        // "Sway" drift — phase-locked to the vertical wave heave so the body
        // swings in rhythm with the up/down bob instead of on an unrelated
        // clock. Driven straight off the camera's own surfaceY (the same
        // signal that drives the vertical bob). tanh (instead of a hard
        // clamp) keeps the curve continuously rounded through the crest and
        // trough rather than clipping flat, so both the SVAJ dial wander and
        // the SVAJ pad below always peak together with the heave.
        const heaveNorm = amp > 0.0001 ? Math.tanh(surfaceY / (amp * 2.2)) : 0;

        const swAmp = swayAmpRef.current;
        let swayTargetX = 0,
          swayTargetZ = 0;
        if (swAmp > 0.001) {
          const ws = swaySpeedRef.current; // 0..1
          const dirRadS = (waveDirRef.current * Math.PI) / 180;
          // Same -90deg (perpendicular) offset from the wave's own travel
          // direction as before; kept in step with waveHeight()'s
          // compass-bearing convention (x=sin(dir), z=cos(dir)) above.
          const dx = Math.cos(dirRadS);
          const dz = -Math.sin(dirRadS);
          // Slow directional bias envelope (unchanged tempo knob) so the
          // along-wave push doesn't feel like a constant shove.
          const bias = swayBiasRef.current;
          const st = t * Math.max(0.02, ws);
          const biasEnv = Math.sin(st * 0.09) * 0.5 + 0.5; // 0..1
          swayTargetX = swAmp * (heaveNorm * dx + bias * dx * biasEnv * 1.2);
          swayTargetZ = swAmp * (heaveNorm * dz + bias * dz * biasEnv * 1.2);
        }

        // Directional sway from the sticky SVAJ pad — the pad was set relative
        // to the camera's look direction at the moment it was touched, but the
        // real push it represents is fixed in world space from then on
        // (swayWorldRef; padToWorldXZ), so it no longer silently rotates just
        // because the camera looks elsewhere afterwards. Amplitude follows the
        // same heaveNorm signal as the wander above, so pad-driven sway is
        // phase-locked to the vertical bob too. Distance from pad center = how
        // far the camera swings in that direction.
        const dirX = swayWorldRef.current.x;
        const dirZ = swayWorldRef.current.z;
        if (Math.abs(dirX) + Math.abs(dirZ) > 0.001) {
          // Base amplitude scale in meters — reuse SVAJ dial if set, otherwise
          // give the pad its own reasonable range so it works standalone.
          const padAmp = swAmp > 0.001 ? swAmp : 12;
          swayTargetX += padAmp * dirX * heaveNorm;
          swayTargetZ += padAmp * dirZ * heaveNorm;
        }

        // Ease toward the sway target with a light spring instead of snapping
        // straight to it every frame. Without this the horizontal sway was
        // rigidly locked to the analytic wave value — perfectly synced, but
        // reading as mechanically "dragged" since it had no inertia, unlike
        // the vertical bob below which already springs toward its target.
        // Giving sway the same kind of momentum makes it read as a floating
        // body being carried by the wave. SVAJ TEMPO still sets how snappy
        // that response is (higher = tighter to the heave, lower = looser).
        const swK = 5 + 20 * Math.max(0.05, swaySpeedRef.current);
        const swZeta = 0.6;
        const swC = 2 * swZeta * Math.sqrt(swK);
        const swayAX = swK * (swayTargetX - swayPosRef.current.x) - swC * swayVelRef.current.x;
        const swayAZ = swK * (swayTargetZ - swayPosRef.current.z) - swC * swayVelRef.current.z;
        swayVelRef.current.x += swayAX * physDt;
        swayVelRef.current.z += swayAZ * physDt;
        swayPosRef.current.x += swayVelRef.current.x * physDt;
        swayPosRef.current.z += swayVelRef.current.z * physDt;
        swayX = swayPosRef.current.x;
        swayZ = swayPosRef.current.z;
      } else if (camMode === "noclip" || camMode === "watercraft") {
        // Ambient HEAVE/SWAY: purely cosmetic wave motion layered on top of
        // noclip's free-flight position, only while "still" (FRITT
        // FALL/OMVÄND STIGNING already pin the vertical rate, so heave would
        // just be swamped by it) — unlike FLYT/VIRVEL's buoyancy above, this
        // isn't a physical response to floating, so it applies the same
        // whether the camera is high above or deep under the surface.
        // Targets fall back to 0 whenever a toggle is off or the camera is
        // rising/falling, so the same easing that eases fall/rise (using the
        // same NOCLIP EASE "grace" dial) also eases HEAVE/SWAY in and out
        // instead of snapping.
        const stillNow = !noclipFreeFallOnRef.current && !noclipReverseRiseOnRef.current;
        const easeTau = Math.max(0.02, noclipVertEaseTimeRef.current);
        const heaveBlend = 1 - Math.exp(-physDt / easeTau);
        const heaveTarget = stillNow && noclipHeaveOnRef.current ? surfaceY : 0;
        noclipHeaveOffsetRef.current += (heaveTarget - noclipHeaveOffsetRef.current) * heaveBlend;
        camYRef.current = posRef.current.y + noclipHeaveOffsetRef.current;

        let swayTargetX = 0,
          swayTargetZ = 0;
        if (stillNow && noclipSwayOnRef.current) {
          const amp = ampRef.current;
          const heaveNorm = amp > 0.0001 ? Math.tanh(surfaceY / (amp * 2.2)) : 0;
          const swAmp = swayAmpRef.current;
          if (swAmp > 0.001) {
            const ws = swaySpeedRef.current;
            const dirRadS = (waveDirRef.current * Math.PI) / 180;
            const dx = Math.cos(dirRadS);
            const dz = -Math.sin(dirRadS);
            const bias = swayBiasRef.current;
            const st = t * Math.max(0.02, ws);
            const biasEnv = Math.sin(st * 0.09) * 0.5 + 0.5;
            swayTargetX = swAmp * (heaveNorm * dx + bias * dx * biasEnv * 1.2);
            swayTargetZ = swAmp * (heaveNorm * dz + bias * dz * biasEnv * 1.2);
          }
          const dirX = swayWorldRef.current.x;
          const dirZ = swayWorldRef.current.z;
          if (Math.abs(dirX) + Math.abs(dirZ) > 0.001) {
            const padAmp = swAmp > 0.001 ? swAmp : 12;
            swayTargetX += padAmp * dirX * heaveNorm;
            swayTargetZ += padAmp * dirZ * heaveNorm;
          }
        }
        const swK = 5 + 20 * Math.max(0.05, swaySpeedRef.current);
        const swZeta = 0.6;
        const swC = 2 * swZeta * Math.sqrt(swK);
        const swayAX = swK * (swayTargetX - swayPosRef.current.x) - swC * swayVelRef.current.x;
        const swayAZ = swK * (swayTargetZ - swayPosRef.current.z) - swC * swayVelRef.current.z;
        swayVelRef.current.x += swayAX * physDt;
        swayVelRef.current.z += swayAZ * physDt;
        swayPosRef.current.x += swayVelRef.current.x * physDt;
        swayPosRef.current.z += swayVelRef.current.z * physDt;
        swayX = swayPosRef.current.x;
        swayZ = swayPosRef.current.z;
      }

      // VÄRLDSGRÄNS (world boundary): y wraps the same way as x/z above, once
      // it crosses ±worldBoundaryHeight — skipped for GUNGA (swing), whose
      // height is a bounded pendulum formula recomputed fresh every frame
      // (see rawSwingY above), not a free-roaming position that needs a loop
      // back around. When worldBoundaryYExtend is on (the default) the extra
      // cloud layers above already make this wrap invisible; when it's off,
      // y still wraps, just without that cover.
      if (worldBoundaryOnRef.current && camMode !== "swing" && camYRef.current !== null) {
        const halfY = Math.max(50, worldBoundaryHeightRef.current);
        const wrappedY = wrapAxis(camYRef.current, halfY);
        if (wrappedY !== camYRef.current) {
          camYRef.current = wrappedY;
          posRef.current.y = wrappedY;
        }
      }

      // Manual XYZ camera offset (POS X/Y/Z dials) — applied after physics so
      // the user can nudge the viewpoint without disturbing the buoyancy loop.
      // camYRef.current is only null before the very first frame sets it (in
      // whichever mode-specific branch above ran this frame).
      const camY = camYRef.current ?? 0;
      camera.position.set(
        camX + camOffXRef.current + swayX + surgeX,
        camY + camOffYRef.current + levelY,
        camZ + camOffZRef.current + swayZ + surgeZ,
      );
      // Look direction: normally level forward; with TORNADO FOLLOW CENTER
      // on, eases toward facing the tornado/whirlpool's own center instead
      // (så kameran följer med runt virveln och naturligt tittar ner mot
      // öppningen) — blended by tornadoBlendRef, the same continuous 0..1
      // "how tornado-y are we" value the position/spin transition already
      // eases with, so this only engages while TORNADO is actually spun up
      // and eases back to normal right along with it, instead of snapping
      // the instant the toggle or cameraMode flips.
      const lookY = camera.position.y;
      // Include the same horizontal offsets as camera.position (SVAJ sway +
      // SURGE current + manual POS X/Z dial) so the look target pans with the
      // camera instead of staying fixed — otherwise lookAt swivels the camera
      // to compensate, which reads as unwanted yaw rotation. This is what
      // keeps SURGE a pure translation: it shifts camera.position and this
      // look target by the exact same amount, so the view direction itself
      // never turns.
      const normalLookX = camX + camOffXRef.current + swayX + surgeX;
      const normalLookZ = camZ + camOffZRef.current + swayZ + surgeZ - 20;
      // Aim at the tornado/whirlpool's own center — posRef.current, the same
      // anchor the orbit itself is centered on ("at the same xz spot") —
      // level with the camera so the throat is visible without the horizon
      // tilting.
      const followBlend = tornadoFollowCenterRef.current ? tornadoBlendRef.current : 0;
      const lookX = normalLookX + (posRef.current.x - normalLookX) * followBlend;
      const lookZ = normalLookZ + (posRef.current.z - normalLookZ) * followBlend;
      camera.lookAt(lookX, lookY, lookZ);

      // Rotation stick: yaw (x) + pitch (y). Integrate stick as angular velocity.
      const rotSpeed = 1.6; // rad/s at full deflection
      yawRef.current -= rotStickRef.current.x * rotSpeed * dt;
      pitchRef.current += rotStickRef.current.y * rotSpeed * dt;
      // Noclip allows a steeper look-up/down range since it drives full 3D
      // flight direction (see the forward vector above); other modes keep
      // the original, more conservative range.
      const maxPitch = camMode === "noclip" || camMode === "watercraft" ? 1.5 : 1.2;
      if (pitchRef.current > maxPitch) pitchRef.current = maxPitch;
      if (pitchRef.current < -maxPitch) pitchRef.current = -maxPitch;
      camera.rotateY(yawRef.current);
      camera.rotateX(pitchRef.current);

      // STRÖM/SVAJ represent a real direction fixed in world space
      // (driftWorldRef/swayWorldRef); re-derive what that looks like relative
      // to the *current* look angle so the knobs visually rotate in place as
      // the camera looks around, instead of silently staying put while the
      // real direction they show drifts out of sync with the view.
      const driftDisp = worldXZToPad(
        driftWorldRef.current.x,
        driftWorldRef.current.z,
        yawRef.current,
      );
      if (
        Math.abs(driftDisp.x - driftDisplayRef.current.x) > 0.0015 ||
        Math.abs(driftDisp.y - driftDisplayRef.current.y) > 0.0015
      ) {
        driftDisplayRef.current = driftDisp;
        setDriftStick(driftDisp);
      }
      const swayDisp = worldXZToPad(swayWorldRef.current.x, swayWorldRef.current.z, yawRef.current);
      if (
        Math.abs(swayDisp.x - swayDisplayRef.current.x) > 0.0015 ||
        Math.abs(swayDisp.y - swayDisplayRef.current.y) > 0.0015
      ) {
        swayDisplayRef.current = swayDisp;
        setSwayStick(swayDisp);
      }
      // SURGE has no draggable on-screen pad, but its direction can keep
      // moving on its own (surgeRotationMode cw/ccw/random) — re-syncing
      // this the same way keeps the SURGE DIRECTION dial's live bearing
      // readout in Settings honest while that's happening.
      const surgeDisp = worldXZToPad(
        surgeWorldRef.current.x,
        surgeWorldRef.current.z,
        yawRef.current,
      );
      if (
        Math.abs(surgeDisp.x - surgeDisplayRef.current.x) > 0.0015 ||
        Math.abs(surgeDisp.y - surgeDisplayRef.current.y) > 0.0015
      ) {
        surgeDisplayRef.current = surgeDisp;
        setSurgeStick(surgeDisp);
      }
      const noclipDriftDisp = worldXZToPad(
        noclipDriftWorldRef.current.x,
        noclipDriftWorldRef.current.z,
        yawRef.current,
      );
      if (
        Math.abs(noclipDriftDisp.x - noclipDriftDisplayRef.current.x) > 0.0015 ||
        Math.abs(noclipDriftDisp.y - noclipDriftDisplayRef.current.y) > 0.0015
      ) {
        noclipDriftDisplayRef.current = noclipDriftDisp;
        setNoclipDriftStick(noclipDriftDisp);
      }

      // Autosave the free-roam position/look direction (throttled) so it
      // survives a reload and can be jumped back to via the restore button.
      if (now - lastCamSaveMs > 1000) {
        lastCamSaveMs = now;
        saveCameraPose({
          x: posRef.current.x,
          z: posRef.current.z,
          y: posRef.current.y,
          yaw: yawRef.current,
          pitch: pitchRef.current,
        });
      }

      // Optional forward-leaning rotation: pitch into the direction of travel.
      // Default is a fixed forward horizon (no lean). Float-only — NAV means
      // something different (full 3D flight / no movement at all) in the
      // other two modes.
      if (leanRef.current && camMode === "float") {
        const leanPitch = stickRef.current.y * 0.12;
        camera.rotateX(leanPitch);
      }

      // Sync audio intensity with depth below surface — only when spatial
      // audio is enabled. Default: constant volume with no filtering.
      const depth = surfaceY - camY; // positive when underwater
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

      // Grumlighet (turbidity): feed the smoothed murk strength + submerged
      // state into the seafloor/mid-cloud/sky/ocean shaders, tinted toward
      // the current deep-water hue so the murk color matches the water
      // tint/time of day. Smoothed once here and fanned out everywhere else
      // reads it, so every surface stays in lockstep.
      floorUniforms.uTurbidity.value +=
        (turbidityRef.current - floorUniforms.uTurbidity.value) * Math.min(1, dt * 6);
      floorUniforms.uUnderwater.value = uniforms.uUnderwater.value;
      floorUniforms.uFogColor.value.copy(uniforms.uWaterDeep.value);
      midCloudUniforms.uTurbidity.value = floorUniforms.uTurbidity.value;
      midCloudUniforms.uUnderwater.value = uniforms.uUnderwater.value;
      midCloudUniforms.uFogColor.value.copy(uniforms.uWaterDeep.value);
      skyCloudUniforms.uTurbidity.value = floorUniforms.uTurbidity.value;
      skyCloudUniforms.uUnderwater.value = uniforms.uUnderwater.value;
      skyCloudUniforms.uFogColor.value.copy(uniforms.uWaterDeep.value);

      // VÄRLDSGRÄNS's y extension: tile more of the same sky-cloud layer at
      // fixed altitude steps around wherever the camera currently is (see
      // EXTEND_CLOUD_LAYER_*/cloudLayerJitter above), so climbing or diving
      // through the y boundary always shows more cloud deck ahead instead of
      // a hard edge. Positioned here — after the y-wrap above, not earlier
      // in the frame — so it always uses this frame's fully resolved (and,
      // if a wrap just happened, already-wrapped) camY: doing it earlier
      // left the layers positioned around the *pre-wrap* altitude for one
      // frame while the camera had already jumped to the post-wrap side —
      // the wrong world-space size/position, or entirely out of the
      // frustum, for exactly the frame the boundary was crossed. Each layer
      // has its own cloned material (see the setup effect above) so it can
      // fade its own opacity in/out independently — MOLN TONING, user-
      // adjustable — instead of popping visible/invisible when recycled to
      // a new altitude band or when the whole feature gates off; the
      // frame-varying uniforms skyCloudUniforms just got above (turbidity/
      // underwater/fog) are copied into each clone here too, alongside
      // time/scroll, since a clone's own uniforms object is independent.
      const extendLayers = extendCloudLayersRef.current;
      const extendLayerState = extendCloudLayerStateRef.current;
      // Same visibility gate as skyClouds itself (sky.visible/skyClouds.visible
      // further below): a real skybox environment or a flat backdrop image
      // replaces the procedural sky entirely, so these extra layers have
      // nothing to extend and would just be dead weight.
      const extendGateOn =
        worldBoundaryOnRef.current &&
        worldBoundaryYExtendRef.current &&
        skyCloudsOnRef.current &&
        !envActiveRef.current &&
        backdropRef.current <= 0 &&
        !lowEnd;
      const extendFadeStep = Math.min(1, dt * cloudFadeSpeedRef.current);
      if (extendGateOn) {
        const spacing = EXTEND_CLOUD_LAYER_SPACING;
        const camYNow = camYRef.current ?? 0;
        const baseIdx = Math.floor(camYNow / spacing);
        const half = Math.floor(extendLayers.length / 2);
        const cloudScaleNow = surfaceAreaRef.current / CLOUD_BASE_SIZE;
        for (let i = 0; i < extendLayers.length; i++) {
          const layerIdx = baseIdx + (i - half);
          const jitter = cloudLayerJitter(layerIdx);
          const layer = extendLayers[i];
          const state = extendLayerState[i];
          if (state.layerIdx !== layerIdx) {
            state.layerIdx = layerIdx;
            state.opacity = 0;
          }
          state.opacity += (1 - state.opacity) * extendFadeStep;
          layer.visible = true;
          layer.position.set(camX + jitter.x, layerIdx * spacing + levelY, camZ + jitter.z);
          layer.scale.set(cloudScaleNow, 1, cloudScaleNow);
          const lu = (layer.material as THREE.ShaderMaterial).uniforms;
          lu.uOpacity.value = state.opacity;
          lu.uTime.value = t;
          lu.uCloudScroll.value.x = t * 0.02;
          lu.uCloudScroll.value.y = t * 0.013;
          lu.uTurbidity.value = skyCloudUniforms.uTurbidity.value;
          lu.uUnderwater.value = skyCloudUniforms.uUnderwater.value;
          lu.uFogColor.value.copy(skyCloudUniforms.uFogColor.value);
        }
      } else {
        for (let i = 0; i < extendLayers.length; i++) {
          const layer = extendLayers[i];
          const state = extendLayerState[i];
          state.opacity += (0 - state.opacity) * extendFadeStep;
          if (state.opacity > 0.003) {
            layer.visible = true;
            (layer.material as THREE.ShaderMaterial).uniforms.uOpacity.value = state.opacity;
          } else {
            layer.visible = false;
            state.layerIdx = Number.NaN;
          }
        }
      }

      uniforms.uTurbidity.value = floorUniforms.uTurbidity.value;
      skyUniforms.uTurbidity.value = floorUniforms.uTurbidity.value;
      skyUniforms.uFogColor.value.copy(uniforms.uWaterDeep.value);

      // Free underwater fog on any loaded .glb model (default materials
      // already respect scene.fog) — density/color follow the same
      // grumlighet + submersion state as everything else. Zero above water
      // (uUnderwater=0) so distant objects (torus rings, .glb scenery) read
      // their real color/shape instead of washing out to the fog tint.
      const fog = scene.fog as THREE.FogExp2;
      fog.density = floorUniforms.uTurbidity.value * uniforms.uUnderwater.value * 0.05;
      fog.color
        .copy(uniforms.uFogColor.value)
        .lerp(
          uniforms.uWaterDeep.value,
          floorUniforms.uTurbidity.value * uniforms.uUnderwater.value,
        );

      // Selectable wave material (sphere-map "matcap") + trochoidal wave
      // shape — both purely cosmetic dials on the ocean shader.
      uniforms.uSphereMix.value +=
        ((sphereMaterialRef.current && !lowEnd ? sphereStrengthRef.current : 0) -
          uniforms.uSphereMix.value) *
        Math.min(1, dt * 6);
      uniforms.uTrochoid.value +=
        (trochoidRef.current - uniforms.uTrochoid.value) * Math.min(1, dt * 6);

      // Keep horizon level: no extra pitch/roll from buoyancy.

      sky.position.copy(camera.position);

      // Backdrop / skybox priority:
      //  - A real environment skybox (scene.background) wins: hide the sky dome,
      //    ignore the flat DOM backdrop, keep an opaque clear behind it. A
      //    texture background paints unconditionally before anything else in
      //    the scene, so a TV panel's occluder can't punch a transparent hole
      //    through it the way it can through the procedural sky dome below —
      //    known limitation, only in this mode.
      //  - Otherwise an optional flat DOM backdrop hides the dome & clears alpha.
      //  - Otherwise the procedural sky dome renders as before, alpha
      //    cleared to 0 so a TV panel's occluder mesh (renderOrder -1000,
      //    see CSS3DTVManager) can reveal the CSS3D layer behind the canvas
      //    wherever nothing in the WebGL scene is actually in front of it.
      const envActive = envActiveRef.current;
      const useBackdrop = backdropRef.current > 0 && !envActive;
      sky.visible = !useBackdrop && !envActive;
      // MOLN TONING: ease opacity toward on/off instead of popping visible.
      const skyCloudsTargetOn = skyCloudsOnRef.current && !useBackdrop && !envActive && !lowEnd;
      skyCloudFadeRef.current +=
        ((skyCloudsTargetOn ? 1 : 0) - skyCloudFadeRef.current) *
        Math.min(1, dt * cloudFadeSpeedRef.current);
      skyCloudUniforms.uOpacity.value = skyCloudFadeRef.current;
      skyClouds.visible = skyCloudFadeRef.current > 0.003;
      renderer.setClearColor(0x032033, envActive ? 1 : 0);

      // SKY PUFFS: each active puff runs its own fade-in/hold/fade-out timer
      // (a smooth sin() bump rather than three hard-cut phases) and, once a
      // full cycle elapses, is instantly moved to a fresh random spot near
      // the camera while invisible at the cycle seam — so raising Y
      // FREQUENCY makes puffs come and go more often without ever popping.
      {
        const puffMeshes = skyPuffMeshesRef.current;
        const puffStates = skyPuffStatesRef.current;
        const activeCount =
          skyPuffsOnRef.current && !lowEnd
            ? Math.min(puffMeshes.length, Math.max(0, Math.round(skyPuffsCountRef.current)))
            : 0;
        const puffSize = Math.max(1, skyPuffsSizeRef.current);
        const puffFreq = Math.max(0.01, skyPuffsFreqRef.current);
        for (let i = 0; i < puffMeshes.length; i++) {
          const mesh = puffMeshes[i];
          if (i >= activeCount) {
            mesh.visible = false;
            continue;
          }
          const state = puffStates[i];
          state.cycleLen = SKY_PUFF_BASE_CYCLE / puffFreq;
          state.cycleT += dt;
          if (state.cycleT >= state.cycleLen) {
            state.cycleT -= state.cycleLen;
            const spot = randomSkyPuffSpot(camX, camZ);
            state.x = spot.x;
            state.y = spot.y;
            state.z = spot.z;
            state.seed = spot.seed;
          }
          const cycleFrac = state.cycleT / state.cycleLen;
          // 0 at both ends of the cycle, 1 at the midpoint — a plain sin()
          // bump gives a soft ease in/out for free without separate phases.
          const fade = Math.sin(Math.PI * Math.min(1, Math.max(0, cycleFrac)));
          const mat = mesh.material as THREE.ShaderMaterial;
          mat.uniforms.uOpacity.value = fade * skyPuffsOpacityRef.current;
          mat.uniforms.uSeed.value = state.seed;
          mesh.position.set(state.x, state.y, state.z);
          mesh.scale.set(puffSize, 1, puffSize);
          mesh.visible = fade > 0.003;
        }
      }

      // Optional model bobbing — static scenes leave modelBobRef null and the
      // loaded model keeps its manifest position untouched.
      const mb = modelBobRef.current;
      const model = modelRef.current;
      if (mb && model) {
        let h: number;
        if (mb.bob.follow) {
          const normalS = waveHeight(
            mb.base.x,
            mb.base.z,
            t,
            ampRef.current,
            regularRef.current,
            regularCrossRef.current,
            regularPeriodRef.current,
            wavePeakRef.current,
            dirRad,
            realisticRef.current,
            fftWaveComponents,
            dyingRef.current,
            dyingWaveComponents,
            dyingAmpRef.current,
            dyingWaveT,
            freqRef.current,
            heaveSkewRef.current,
          );
          const s =
            vortexBlendRef.current > 0.0008
              ? normalS +
                (whirlpoolSurfaceHeight(
                  mb.base.x - posRef.current.x,
                  mb.base.z - posRef.current.z,
                  t,
                  ampRef.current,
                  regularPeriodRef.current,
                  tornadoOpeningRef.current,
                  freqRef.current,
                ) -
                  normalS) *
                  vortexBlendRef.current
              : normalS;
          h = s * mb.bob.amp;
        } else {
          h = Math.sin(t * mb.bob.speed) * mb.bob.amp;
        }
        model.position.set(mb.base.x, mb.base.y + h, mb.base.z);
      }

      // Recompute the torus-ring field's active grid cells and their
      // fade-in/out/distance opacity for this frame, now that the camera's
      // position is final for the frame.
      torusRingField.update(camera.position, dt);

      // Cap actual GPU renders to targetFps (gogglesFpsCap instead while
      // SIMGLASÖGON is on, for its own lower thermal-friendly ceiling) —
      // camera/physics/uniforms above still update every rAF tick (cheap,
      // keeps input response and motion timing correct), only the expensive
      // renderer.render() draw call itself is skipped on the frames in
      // between. A cap of 0 or less renders every frame, uncapped. Render
      // every Nth tick (N from rafIntervalMsEstimate above) rather than
      // whenever enough wall-clock time has passed — see that estimate's
      // comment for why the wall-clock version reads as juddery.
      const fpsCap = gogglesOnRef.current ? gogglesFpsCapRef.current : targetFpsRef.current;
      renderTickCount++;
      const ticksPerRender =
        fpsCap <= 0 ? 1 : Math.max(1, Math.round(1000 / fpsCap / rafIntervalMsEstimate));
      const renderDue = fpsCap <= 0 || renderTickCount % ticksPerRender === 0;
      if (renderDue) {
        // Must run before renderer.render() below — it syncs each TV
        // panel's invisible occluder mesh (added to `scene`) to the
        // panel's current transform, so the depth test that lets other 3D
        // objects properly occlude the panel uses this frame's position,
        // not last frame's.
        tvManager.render();
        if (chromaticAberrationOnRef.current && !lowEnd) {
          // 0..1 dial value -> a max red/blue UV offset of 0..~3.5% of the
          // frame at its corners (see CHROMATIC_ABERRATION_SHADER above).
          chromaticAberrationPass.uniforms.uAmount.value =
            chromaticAberrationAmountRef.current * 0.05;
          composer.render();
        } else {
          renderer.render(scene, camera);
        }
      }
      raf = requestAnimationFrame(animate);
      clock.getDelta();
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("pagehide", saveCameraPoseNow);
      saveCameraPoseNow();
      renderer.dispose();
      chromaticAberrationPass.dispose();
      composer.dispose();
      geo.dispose();
      farOcean.geometry.dispose();
      mat.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      midCloudGeo.dispose();
      midCloudMat.dispose();
      skyCloudGeo.dispose();
      skyCloudMat.dispose();
      tornadoCloudGeo.dispose();
      tornadoCloudMat.dispose();
      for (const layer of extendCloudLayersRef.current) {
        (layer.material as THREE.Material).dispose();
      }
      extendCloudLayersRef.current = [];
      extendCloudLayerStateRef.current = [];
      for (const puffMesh of skyPuffMeshesRef.current) {
        (puffMesh.material as THREE.Material).dispose();
      }
      skyPuffMeshesRef.current = [];
      skyPuffStatesRef.current = [];
      puffGeo.dispose();
      sandTex.dispose();
      skyGeo.dispose();
      skyMat.dispose();
      if (modelRef.current) {
        scene.remove(modelRef.current);
        disposeObject(modelRef.current);
        modelRef.current = null;
      }
      modelBobRef.current = null;
      scene.background = null;
      if (envTextureRef.current) {
        envTextureRef.current.dispose();
        envTextureRef.current = null;
      }
      envActiveRef.current = false;
      if (reflTexRef.current) {
        reflTexRef.current.dispose();
        reflTexRef.current = null;
      }
      whiteTex.dispose();
      reflWhiteTexRef.current = null;
      waterUniformsRef.current = null;
      sceneRef.current = null;
      oceanRef.current = null;
      farOceanRef.current = null;
      midCloudsMeshRef.current = null;
      skyCloudsMeshRef.current = null;
      tornadoCloudMeshRef.current = null;
      tvManager.dispose();
      tvManagerRef.current = null;
      torusRingField.dispose();
      torusRingFieldRef.current = null;
      renderer.domElement.removeEventListener("pointerdown", onWatercraftPointerDown);
      renderer.domElement.removeEventListener("pointermove", onWatercraftPointerMove);
      renderer.domElement.removeEventListener("pointerup", onWatercraftPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onWatercraftPointerUp);
      watercraftRig.dispose();
      watercraftRigRef.current = null;
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Tracks whether the initial scene/skybox/surface picked up at mount have
  // each settled once (loaded, or determined there was nothing to load) —
  // used only to know when to hide the first-paint boot overlay below.
  // Deliberately never reset back to false: once the boot screen has hidden
  // once it stays hidden, even while the player later swaps to a different
  // scene/environment/surface and these same effects re-run.
  const [sceneBootSettled, setSceneBootSettled] = useState(false);
  const [envBootSettled, setEnvBootSettled] = useState(false);
  const [surfaceBootSettled, setSurfaceBootSettled] = useState(false);
  // Safety net: if something stalls without ever resolving or rejecting
  // (e.g. a request that neither completes nor fires an error event), don't
  // leave the player staring at the boot overlay forever.
  const [bootTimedOut, setBootTimedOut] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setBootTimedOut(true), 12000);
    return () => window.clearTimeout(id);
  }, []);
  const bootReady = (sceneBootSettled && envBootSettled && surfaceBootSettled) || bootTimedOut;
  // Keeps the boot overlay mounted for the duration of its own fade-out
  // transition after bootReady flips true, rather than unmounting it
  // instantly and cutting the CSS transition short.
  const [bootOverlayMounted, setBootOverlayMounted] = useState(true);
  useEffect(() => {
    if (!bootReady) return;
    const id = window.setTimeout(() => setBootOverlayMounted(false), 400);
    return () => window.clearTimeout(id);
  }, [bootReady]);

  // Load / swap the selected scene into the live three.js scene graph. Runs
  // after the WebGL setup effect above has populated sceneRef, and re-runs
  // whenever the user picks a different scene.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove any previously loaded model first.
    if (modelRef.current) {
      scene.remove(modelRef.current);
      disposeObject(modelRef.current);
      modelRef.current = null;
    }
    modelBobRef.current = null;

    if (!sceneId) {
      setSpawnLocations([DEFAULT_SPAWN_LOCATION]);
      setSceneBootSettled(true);
      return;
    }

    let cancelled = false;
    const base = `/scenes/${encodeURIComponent(sceneId)}`;
    const loader = new GLTFLoader();
    // Scenes are exported as either a single-file .glb or a .gltf with
    // sibling .bin/texture files; try .glb first (the common case) and fall
    // back to .gltf so both layouts resolve without a manifest flag.
    const loadModel = (ext: "glb" | "gltf") =>
      new Promise<GLTF>((resolve, reject) => {
        loader.load(`${base}/${encodeURIComponent(sceneId)}.${ext}`, resolve, undefined, reject);
      });

    fetch(`${base}/manifest.json`)
      .then((r) => (r.ok ? (r.json() as Promise<SceneManifest>) : {}))
      .catch(() => ({}) as SceneManifest)
      .then((manifest: SceneManifest) => {
        if (cancelled) return;
        setSpawnLocations(resolveSpawnLocations(manifest));
        loadModel("glb")
          .catch(() => loadModel("gltf"))
          .then((gltf) => {
            if (cancelled) {
              disposeObject(gltf.scene);
              return;
            }
            const model = gltf.scene;
            applyManifest(model, manifest);
            scene.add(model);
            modelRef.current = model;
            const bob = resolveBob(manifest.bob);
            modelBobRef.current = bob ? { base: model.position.clone(), bob } : null;
            setSceneBootSettled(true);
          })
          .catch((err) => {
            console.error(`Failed to load scene "${sceneId}"`, err);
            if (!cancelled) setSceneBootSettled(true);
          });
      });

    return () => {
      cancelled = true;
    };
  }, [sceneId]);

  // Drop a persisted spawn-location selection that no longer exists once the
  // current scene's location list resolves (e.g. after switching scenes, or
  // the manifest's locations/places changed on disk).
  useEffect(() => {
    setSpawnLocationId((cur) =>
      cur && spawnLocations.some((l) => l.id === cur) ? cur : (spawnLocations[0]?.id ?? null),
    );
  }, [spawnLocations]);

  // Load / swap the selected environment's equirectangular skybox as the scene
  // background so it moves correctly with the camera. Re-runs whenever the
  // environment, era, or time-of-day selection changes.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const clearSkybox = () => {
      scene.background = null;
      envActiveRef.current = false;
      if (envTextureRef.current) {
        envTextureRef.current.dispose();
        envTextureRef.current = null;
      }
    };

    // No environment (or an incomplete selection) → procedural sky dome.
    if (!envId || !envEra || !envTime) {
      clearSkybox();
      setEnvBootSettled(true);
      return;
    }

    let cancelled = false;
    const base = [envId, envEra, envTime].map(encodeURIComponent).join("/");
    const dir = `/environments/${base}`;

    fetch(`${dir}/manifest.json`)
      .then((r) => (r.ok ? (r.json() as Promise<EnvManifest>) : {}))
      .catch(() => ({}) as EnvManifest)
      .then((manifest: EnvManifest) => {
        if (cancelled) return;
        const image = manifest.image ?? "skybox.png";
        new THREE.TextureLoader().load(
          `${dir}/${encodeURIComponent(image)}`,
          (tex) => {
            if (cancelled) {
              tex.dispose();
              return;
            }
            tex.mapping = THREE.EquirectangularReflectionMapping;
            tex.colorSpace = THREE.SRGBColorSpace;
            // Swap in the new texture, disposing whatever was there before.
            if (envTextureRef.current) envTextureRef.current.dispose();
            envTextureRef.current = tex;
            scene.background = tex;
            scene.backgroundRotation.set(0, ((manifest.rotationY ?? 0) * Math.PI) / 180, 0);
            envActiveRef.current = true;
            // Sync the water/lighting palette to this skybox's time-of-day.
            if (typeof manifest.timeOfDay === "number") {
              setTimeOfDay(((manifest.timeOfDay % 1) + 1) % 1);
            }
            setEnvBootSettled(true);
          },
          undefined,
          (err) => {
            console.error(`Failed to load skybox "${base}"`, err);
            if (!cancelled) {
              clearSkybox();
              setEnvBootSettled(true);
            }
          },
        );
      });

    return () => {
      cancelled = true;
    };
  }, [envId, envEra, envTime]);

  // Load / swap the selected water-surface reflection photo into the water
  // shader. Re-runs whenever the surface selection changes.
  useEffect(() => {
    const uniforms = waterUniformsRef.current;
    if (!uniforms) return;

    const revert = () => {
      reflBaseRef.current = 0;
      applyReflMix();
      uniforms.uReflTex.value = reflWhiteTexRef.current;
      if (reflTexRef.current) {
        reflTexRef.current.dispose();
        reflTexRef.current = null;
      }
    };

    if (!surfaceId) {
      revert();
      setSurfaceBootSettled(true);
      return;
    }

    let cancelled = false;
    const dir = `/surfaces/${encodeURIComponent(surfaceId)}`;

    fetch(`${dir}/manifest.json`)
      .then((r) => (r.ok ? (r.json() as Promise<SurfaceManifest>) : {}))
      .catch(() => ({}) as SurfaceManifest)
      .then((manifest: SurfaceManifest) => {
        if (cancelled) return;
        const image = manifest.image ?? "surface.png";
        new THREE.TextureLoader().load(
          `${dir}/${encodeURIComponent(image)}`,
          (tex) => {
            if (cancelled) {
              tex.dispose();
              return;
            }
            // Mirror horizontally to hide the azimuth seam from atan(); clamp
            // vertically so the horizon/zenith rows don't wrap.
            tex.wrapS = THREE.MirroredRepeatWrapping;
            tex.wrapT = THREE.ClampToEdgeWrapping;
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.anisotropy = maxAnisoRef.current;
            if (reflTexRef.current) reflTexRef.current.dispose();
            reflTexRef.current = tex;
            uniforms.uReflTex.value = tex;
            reflBaseRef.current =
              typeof manifest.strength === "number"
                ? Math.max(0, Math.min(1, manifest.strength))
                : 0.6;
            applyReflMix();
            setSurfaceBootSettled(true);
          },
          undefined,
          (err) => {
            console.error(`Failed to load surface "${surfaceId}"`, err);
            if (!cancelled) {
              revert();
              setSurfaceBootSettled(true);
            }
          },
        );
      });

    return () => {
      cancelled = true;
    };
  }, [surfaceId]);

  // Time-of-day label
  const todLabel = (() => {
    const tod = timeOfDay;
    if (tod < 0.15 || tod > 0.9) return t("tod.night");
    if (tod < 0.3) return t("tod.dawn");
    if (tod < 0.45) return t("tod.morning");
    if (tod < 0.6) return t("tod.midday");
    if (tod < 0.75) return t("tod.afternoon");
    return t("tod.dusk");
  })();

  // Derived interval-session readouts for the bottom HUD's optional
  // elapsed/remaining pill — computed here (rather than inline in the JSX
  // below) to keep that JSX a plain reference to already-resolved values.
  const curIntervalElapsed = intervalProgress * intervalDuration;
  const curIntervalRemaining = Math.max(0, intervalDuration - curIntervalElapsed);
  const totalPlannedDuration =
    intervalSessionType === "fixed" ? intervalCount * intervalDuration : null;
  const totalIntervalRemaining =
    totalPlannedDuration !== null ? Math.max(0, totalPlannedDuration - intervalElapsedTotal) : null;

  // The exact same values/setters the main HUD's settings dialog above uses —
  // shared with the identical clone rendered as the "Inställningar" app
  // inside the virtual phone (see VirtualPhone.tsx's settingsPanelProps prop
  // and SettingsPanel.tsx, which both hosts render unchanged).
  const settingsPanelProps: SettingsPanelProps = {
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
    skyCloudsHeight,
    setSkyCloudsHeight,
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
  };

  // JUMP: noclip's vertical mode slider condenses FRITT FALL/OMVÄND STIGNING/
  // "neither" into a single tri-state control (see VerticalModeSlider) — this
  // is just a two-way mirror between that tri-state and the pair of booleans
  // the physics loop and the older pill buttons both still read/write.
  const noclipVerticalMode: VerticalMode = noclipFreeFallOn
    ? "fall"
    : noclipReverseRiseOn
      ? "rise"
      : "still";
  const setNoclipVerticalMode = (m: VerticalMode) => {
    setNoclipAutoAlternateOn(false);
    setNoclipFreeFallOn(m === "fall");
    setNoclipReverseRiseOn(m === "rise");
  };

  // STRÖM/HÖJD/SVAJ/VÅGRIKT — every on-screen joystick except NAV and LOOK —
  // also rendered inside the "Fjärrkontroll" app in the bathOS phone (see
  // VirtualPhone.tsx), in addition to STRÖM/SVAJ/VÅGRIKT's own spot on the
  // main HUD below (HÖJD, noclip's vertical stick, lives only in the app).
  // Built once here so both hosts share the exact same state/handlers —
  // there's only one drift direction, one sway direction, one wave direction.
  const remoteControllerProps: RemoteControllerProps = {
    cameraMode,
    driftStick,
    onDriftChange: (v) => {
      setDriftStick(v);
      driftDisplayRef.current = v;
      driftWorldRef.current = padToWorldXZ(v.x, v.y, yawRef.current);
    },
    vertStick,
    onVertChange: setVertStick,
    noclipDriftStick,
    onNoclipDriftChange: (v) => {
      setNoclipDriftStick(v);
      noclipDriftDisplayRef.current = v;
      noclipDriftWorldRef.current = padToWorldXZ(v.x, v.y, yawRef.current);
    },
    noclipFreeFallOn,
    setNoclipFreeFallOn,
    noclipReverseRiseOn,
    setNoclipReverseRiseOn,
    noclipAutoAlternateOn,
    setNoclipAutoAlternateOn,
    swayStick,
    onSwayChange: (v) => {
      setSwayStick(v);
      swayDisplayRef.current = v;
      swayWorldRef.current = padToWorldXZ(v.x, v.y, yawRef.current);
      if (syncWaveWithSway) {
        setWaveDir(worldXZBearing(swayWorldRef.current.x, swayWorldRef.current.z));
      }
    },
    waveDirStick,
    onWaveDirChange: (v) => {
      setWaveDirStick(v);
      const m = Math.hypot(v.x, v.y);
      if (m > 0.15) {
        const deg = (Math.atan2(v.x, v.y) * 180) / Math.PI;
        setWaveDir(((deg % 360) + 360) % 360);
      }
    },
    depthDriftSpeed,
    setDepthDriftSpeed,
    resetDepthDrift,
    syncWaveWithSway,
    setSyncWaveWithSway,
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black">
      {!envId && BACKDROPS[backdropIdx]?.url && (
        <img
          src={BACKDROPS[backdropIdx].url!}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div ref={mountRef} className="absolute inset-0 touch-none" />

      {/* Boot overlay — covers the gap between mounting the WebGL canvas and
          the initial scene/skybox/surface (picked up from saved settings)
          actually having loaded, so the player sees a deliberate loading
          state instead of the model/skybox/reflection popping in piecemeal
          against a bare black canvas. Fades out once, permanently — see
          bootReady/bootOverlayMounted above. */}
      {bootOverlayMounted && (
        <div
          role="status"
          aria-live="polite"
          className={`absolute inset-0 z-40 flex items-center justify-center bg-black transition-opacity duration-[400ms] ${
            bootReady ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
            <p className="ui-ink-muted text-[10px] font-light tracking-[0.2em]">
              {t("hud.loading")}
            </p>
          </div>
        </div>
      )}

      {/* Optional "swimming goggles" effect — water droplets on the lens,
          plus optional blur (see KAMERA settings tab). Sits directly above
          the 3D canvas and below every HUD element, so it reads as being on
          the camera rather than smearing the on-screen controls. */}
      {gogglesOn && (
        <GogglesOverlay
          blur={gogglesBlur}
          loop={gogglesLoop}
          intensity={gogglesIntensity}
          fpsCap={gogglesFpsCap}
          pitchRef={pitchRef}
          camFovRef={camFovRef}
          underwaterRef={waterUniformsRef}
        />
      )}

      {/* Persistent brand mark — inverted (white), semi-transparent, 24pt, 12pt margin */}
      <img
        src={appIconAsset.url}
        alt="Aquafulness"
        aria-hidden="true"
        className="pointer-events-none absolute z-30"
        style={{
          top: "12pt",
          right: "12pt",
          width: "24pt",
          height: "24pt",
          filter: "invert(1)",
          opacity: 0.5,
        }}
      />

      {/* Simulated clock — plain text (no button chrome), directly below the
          brand mark above, always up regardless of HUD fade. Tap to open the
          time-travel dialog. Only rendered once simNowLabel is set client-
          side (see simNow's useState above) so the server-rendered markup
          never includes a live time value. */}
      {!CLOCK_DISABLED_FOR_PERF_TEST && clockOn && simNowLabel && (
        <button
          onClick={() => setTimeTravelOpen(true)}
          className="absolute z-30 text-right text-[10px] font-light tabular-nums ui-ink-faint transition ui-press-ink"
          style={{ top: "40pt", right: "12pt" }}
          aria-label={t("hud.timeTravelOpenAria")}
          title={t("hud.timeTravelOpenAria")}
        >
          {simNowLabel}
        </button>
      )}

      {/* Only mounted while open, so its hooks don't run on every one of
          this large component's re-renders while the dialog is closed
          (i.e. almost always). */}
      {!CLOCK_DISABLED_FOR_PERF_TEST && clockOn && timeTravelOpen && (
        <TimeTravelDialog
          open={timeTravelOpen}
          onClose={() => setTimeTravelOpen(false)}
          timeTravelBaseMs={timeTravelBaseMs}
          timeTravelSetAtMs={timeTravelSetAtMs}
          onTravel={(targetMs) => {
            setTimeTravelBaseMs(targetMs);
            setTimeTravelSetAtMs(Date.now());
          }}
          onReturnToNow={() => {
            setTimeTravelBaseMs(null);
            setTimeTravelSetAtMs(null);
          }}
          timeSeasonalSync={timeSeasonalSync}
          onSeasonalSyncChange={setTimeSeasonalSync}
        />
      )}

      {/* Offline indicator — stays up regardless of HUD fade so it's never
          mistaken for a stall; only cached scenes/environments/surfaces are
          available while it's shown. */}
      {!online && (
        <div
          className="pointer-events-none absolute left-1/2 top-[12pt] z-30 -translate-x-1/2 rounded-full border ui-line-2 ui-surface px-3 py-1 text-[10px] font-light tracking-[0.2em] ui-ink backdrop-blur-md"
          role="status"
        >
          {t("hud.offline")}
        </div>
      )}

      {/* Fake live-broadcast overlay — hidden by default, toggled via LIVE dial. */}
      {liveMode && <LiveBroadcast />}

      {/* HUD overlay — fades out on inactivity, back in on any touch. Always
          pointer-events-none on this wrapper itself (every interactive
          descendant below — buttons, the settings panel, joysticks — already
          opts back in with its own pointer-events-auto); otherwise, since
          this covers the full screen and sits in front of the 3D view's
          sibling div, it silently swallows every touch/click that doesn't
          land exactly on one of those descendants, including all of the TV
          panels underneath. */}
      <div
        className={`pointer-events-none absolute inset-0 z-10 transition-opacity duration-700 ${uiVisible ? "opacity-100" : "opacity-0"}`}
      >
        {/* Top bar: settings + speaker toggle + phone + fullscreen + share.
            Edit-mode (the "pencil") no longer lives here — it moved into the
            bathOS phone's dedicated Skärmar app. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between px-6 pt-6">
          <button
            onClick={() => setAudioOn((v) => !v)}
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border ui-line-2 ui-surface ui-ink backdrop-blur-md transition active:scale-95 ui-press"
            aria-label={audioOn ? t("hud.audioMuteAria") : t("hud.audioUnmuteAria")}
            aria-pressed={audioOn}
            title={audioOn ? t("hud.audioOnTitle") : t("hud.audioOffTitle")}
          >
            {audioOn ? (
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 10v4h3l5 4V6L7 10H4z" />
                <path d="M16 8.5a4 4 0 010 7" />
                <path d="M18.5 6a7 7 0 010 12" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 10v4h3l5 4V6L7 10H4z" />
                <path d="M22 9l-6 6M16 9l6 6" />
              </svg>
            )}
          </button>

          <button
            onClick={() => setSettingsOpen((s) => !s)}
            className={`pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md transition active:scale-95 ${
              settingsOpen ? "ui-line-3 ui-tint-2 ui-ink" : "ui-line-2 ui-surface ui-ink ui-press"
            }`}
            aria-label={settingsOpen ? t("hud.settingsCloseAria") : t("hud.settingsOpenAria")}
            aria-expanded={settingsOpen}
            title={settingsOpen ? t("hud.settingsCloseAria") : t("hud.settingsOpenAria")}
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 13a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V19a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H4a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H10a1.65 1.65 0 001-1.51V4a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V10a1.65 1.65 0 001.51 1H20a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>

          <div className="flex gap-2">
            <button
              onClick={respawn}
              className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border ui-line-2 ui-surface ui-ink backdrop-blur-md transition active:scale-95 ui-press"
              aria-label={t("hud.respawnAria")}
              title={t("hud.respawnAria")}
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 21s-7-6.1-7-11a7 7 0 0114 0c0 4.9-7 11-7 11z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
            </button>

            <button
              onClick={() => setPhoneOpen((v) => !v)}
              className={`pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md transition active:scale-95 ${
                phoneOpen ? "ui-line-3 ui-tint-2 ui-ink" : "ui-line-2 ui-surface ui-ink ui-press"
              }`}
              aria-label={phoneOpen ? t("hud.phoneCloseAria") : t("hud.phoneOpenAria")}
              aria-pressed={phoneOpen}
              title={phoneOpen ? t("hud.phoneCloseTitle") : t("hud.phoneOpenTitle")}
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="7" y="2.5" width="10" height="19" rx="2" />
                <path d="M11 18h2" />
              </svg>
            </button>

            <button
              onClick={toggleFullscreen}
              className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border ui-line-2 ui-surface ui-ink backdrop-blur-md transition active:scale-95 ui-press"
              aria-label={isFullscreen ? t("hud.fullscreenExitAria") : t("hud.fullscreenEnterAria")}
              aria-pressed={isFullscreen}
              title={isFullscreen ? t("hud.fullscreenExitAria") : t("hud.fullscreenEnterAria")}
            >
              {isFullscreen ? (
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 4v4H5M15 4v4h4M9 20v-4H5M15 20v-4h4" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                </svg>
              )}
            </button>

            <button
              onClick={() => setShareBathOpen(true)}
              className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border ui-line-2 ui-surface ui-ink backdrop-blur-md transition active:scale-95 ui-press"
              aria-label={t("hud.shareBathAria")}
              title={t("hud.shareBathAria")}
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Camera mode toggle: picks between the four movement schemes
            (SIMMARE/FLYG/VIRVEL/GUNGA — see CameraMode) without opening the
            full settings panel — one tab button per mode (see
            CAMERA_MODE_TAB_ORDER) rather than a single cycling dial, so any
            mode is reachable in one tap. Disabled to a plain readout while
            an interval session is driving cameraMode automatically (mirrors
            the same read-only treatment the KAMERA settings tab gives it),
            so manual taps here never fight the session's own alternation.
            Changing cameraMode by any means re-syncs the bottom camera
            drawer's tab (see the cameraDrawerTab effect above) to match.
            To its left, a standalone WHIRLPOOL/TORNADO toggle button binds
            directly to the shared tornadoOn setting regardless of which
            mode is active: while swimming (float) it reads WHIRLPOOL and
            brings back the old standalone VIRVEL mode's feel (camera orbits
            and dips into a real water vortex); in every other mode it reads
            TORNADO and behaves exactly like the KAMERA settings dial. */}
        <div className="pointer-events-none absolute inset-x-0 top-20 z-20 flex items-center justify-center gap-2">
          {!intervalSessionOn && (
            <button
              type="button"
              onClick={() => setTornadoOn((v) => !v)}
              aria-pressed={tornadoOn}
              className={`pointer-events-auto rounded-full border px-3 py-1.5 text-[10px] font-light tracking-[0.2em] backdrop-blur-md transition active:scale-95 ${
                tornadoOn ? "ui-line-3 ui-tint-2 ui-ink" : "ui-line-2 ui-surface ui-ink-muted"
              }`}
            >
              {t(
                cameraMode === "float"
                  ? "hud.tornadoToggle.whirlpool"
                  : "hud.tornadoToggle.tornado",
              )}
            </button>
          )}
          {intervalSessionOn ? (
            <div className="pointer-events-auto rounded-full border ui-line-1 ui-surface px-4 py-1.5 text-[10px] font-light tracking-[0.3em] ui-ink-muted backdrop-blur-md">
              {t(CAMERA_MODE_LABEL_KEYS[cameraMode])} {t("camera.mode.autoSuffix")}
            </div>
          ) : (
            <div className="pointer-events-auto flex items-center gap-1 rounded-full border ui-line-2 ui-surface p-1.5 backdrop-blur-md">
              {CAMERA_MODE_TAB_ORDER.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setCameraMode(m)}
                  aria-pressed={cameraMode === m}
                  className={`rounded-full px-3 py-1.5 text-[10px] font-light tracking-[0.2em] transition active:scale-95 ${
                    cameraMode === m ? "ui-tint-2 ui-ink" : "ui-ink-muted"
                  }`}
                >
                  {t(CAMERA_MODE_LABEL_KEYS[m])}
                </button>
              ))}
            </div>
          )}
        </div>

        <ShareBathDialog
          open={shareBathOpen}
          onClose={() => setShareBathOpen(false)}
          buildBathLink={buildBathLink}
        />

        {/* Collapsible settings panel */}
        {settingsOpen && (
          <div className="pointer-events-auto absolute inset-x-0 top-16 z-20 mx-auto max-w-2xl px-6">
            <div className="max-h-[70vh] overflow-y-auto rounded-3xl border ui-line-1 ui-surface-strong p-4 shadow-2xl backdrop-blur-xl">
              <SettingsPanel {...settingsPanelProps} />
            </div>
          </div>
        )}

        {/* PS-liknande layout:
            Vänster sida: NAV (rörelse, momentan) längst ned, STRÖM/NOCLIP
            DRIFT XZ (drift, sticky) ovanför.
            Höger sida: LOOK (rotation, momentan) längst ned, VÅGRIKT
            (sticky) ovanför.
            SVAJ (FRI) eller HÖJD + FRITT FALL/OMVÄND STIGNING (NOCLIP) delar
            STRÖM/DRIFT XZ:s kolumn, ovanför den.
            STRÖM/HÖJD/SVAJ/VÅGRIKT finns även i "Fjärrkontroll"-appen i
            bathOS-telefonen (se VirtualPhone.tsx) — samma state/handlers,
            bara ett andra sätt att nå dem. I GUNGA-läget styrs positionen
            helt av gungans fysik, så bara LOOK visas. */}
        {cameraMode !== "swing" && (
          <Joystick
            onChange={setStick}
            value={stick}
            label={t("hud.joystick.nav")}
            positionClass="bottom-8 left-8"
          />
        )}
        {cameraMode === "float" && (
          <Joystick
            onChange={remoteControllerProps.onDriftChange}
            value={remoteControllerProps.driftStick}
            label={t("hud.joystick.current")}
            positionClass="bottom-36 left-8"
            sticky
          />
        )}
        {cameraMode === "float" && (
          <Joystick
            onChange={remoteControllerProps.onSwayChange}
            value={remoteControllerProps.swayStick}
            label={t("hud.joystick.sway")}
            positionClass="bottom-64 left-8"
            sticky
          />
        )}
        {/* NOCLIP replaces STRÖM/SVAJ's two slots with its own sticky drift
            dials: DRIFT XZ (STRÖM's spot) and, above it (SVAJ's spot), a Y
            drift pad (HÖJD/vertStick, made sticky here) flanked by two small
            toggle buttons — OMVÄND STIGNING above, FRITT FALL below — that
            each pin the vertical rate to a strong constant climb/dive. */}
        {(cameraMode === "noclip" || cameraMode === "watercraft") && (
          <Joystick
            onChange={remoteControllerProps.onNoclipDriftChange}
            value={remoteControllerProps.noclipDriftStick}
            label={t("hud.joystick.noclipDriftXZ")}
            positionClass="bottom-36 left-8"
            sticky
          />
        )}
        {(cameraMode === "noclip" || cameraMode === "watercraft") && (
          <div className="pointer-events-none absolute bottom-64 left-8 z-10 select-none">
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setNoclipAutoAlternateOn(false);
                  setNoclipReverseRiseOn((v) => !v);
                }}
                aria-pressed={noclipReverseRiseOn}
                className={`pointer-events-auto rounded-full border px-2 py-0.5 text-[8px] font-light tracking-[0.2em] backdrop-blur-md transition active:scale-95 ${
                  noclipReverseRiseOn
                    ? "ui-line-3 ui-tint-2 ui-ink"
                    : "ui-line-2 ui-surface ui-ink-muted"
                }`}
              >
                {t("hud.joystick.reverseRise")}
              </button>
              <JoystickPad
                label={t("hud.joystick.noclipDriftY")}
                value={vertStick}
                onChange={setVertStick}
                sticky
              />
              <button
                type="button"
                onClick={() => {
                  setNoclipAutoAlternateOn(false);
                  setNoclipFreeFallOn((v) => !v);
                }}
                aria-pressed={noclipFreeFallOn}
                className={`pointer-events-auto rounded-full border px-2 py-0.5 text-[8px] font-light tracking-[0.2em] backdrop-blur-md transition active:scale-95 ${
                  noclipFreeFallOn
                    ? "ui-line-3 ui-tint-2 ui-ink"
                    : "ui-line-2 ui-surface ui-ink-muted"
                }`}
              >
                {t("hud.joystick.freeFall")}
              </button>
              {/* Optional hands-off cycling between the two above, interval
                  set in SETTINGS → KAMERA. */}
              <button
                type="button"
                onClick={() => setNoclipAutoAlternateOn((v) => !v)}
                aria-pressed={noclipAutoAlternateOn}
                className={`pointer-events-auto rounded-full border px-2 py-0.5 text-[8px] font-light tracking-[0.2em] backdrop-blur-md transition active:scale-95 ${
                  noclipAutoAlternateOn
                    ? "ui-line-3 ui-tint-2 ui-ink"
                    : "ui-line-2 ui-surface ui-ink-muted"
                }`}
              >
                {t("hud.joystick.autoAlternate")}
              </button>
              {/* HEAVE/SWAY: opt in to riding the wave's own vertical bob/
                  horizontal sway on top of the free-flight position — purely
                  cosmetic (unlike FLYT/VIRVEL's real buoyancy), so it applies
                  the same above or under the surface. Only takes effect while
                  JUMP is in STILL (see the physics loop's noclip sway/heave
                  branch), easing in/out with the same NOCLIP EASE dial as
                  FRITT FALL/OMVÄND STIGNING. */}
              <button
                type="button"
                onClick={() => setNoclipHeaveOn((v) => !v)}
                aria-pressed={noclipHeaveOn}
                className={`pointer-events-auto rounded-full border px-2 py-0.5 text-[8px] font-light tracking-[0.2em] backdrop-blur-md transition active:scale-95 ${
                  noclipHeaveOn ? "ui-line-3 ui-tint-2 ui-ink" : "ui-line-2 ui-surface ui-ink-muted"
                }`}
              >
                {t("hud.joystick.heave")}
              </button>
              <button
                type="button"
                onClick={() => setNoclipSwayOn((v) => !v)}
                aria-pressed={noclipSwayOn}
                className={`pointer-events-auto rounded-full border px-2 py-0.5 text-[8px] font-light tracking-[0.2em] backdrop-blur-md transition active:scale-95 ${
                  noclipSwayOn ? "ui-line-3 ui-tint-2 ui-ink" : "ui-line-2 ui-surface ui-ink-muted"
                }`}
              >
                {t("hud.joystick.sway")}
              </button>
            </div>
          </div>
        )}
        <Joystick
          onChange={setRotStick}
          value={rotStick}
          label={t("hud.joystick.look")}
          positionClass="bottom-8 right-8"
        />
        {cameraMode === "float" && (
          <Joystick
            onChange={remoteControllerProps.onWaveDirChange}
            value={remoteControllerProps.waveDirStick}
            label={t("hud.joystick.waveDirection")}
            positionClass="bottom-36 right-8"
            sticky
          />
        )}
        {/* LEVEL DRIFT: unlike STRÖM/SVAJ/VÅGRIKT/HÖJD above, this isn't
            gated behind a cameraMode check — the water level drifts the same
            way regardless of how the camera is currently moving. */}
        <div className="pointer-events-none absolute bottom-64 right-8 z-10 select-none">
          <VerticalDial
            value={depthDriftSpeed}
            onChange={setDepthDriftSpeed}
            onReset={resetDepthDrift}
            label={t("hud.joystick.levelDrift")}
            min={-20}
            max={20}
          />
        </div>
        {/* JUMP: a single tri-state slider (RISE/STILL/FALL) replacing the
            left column's separate FRITT FALL/OMVÄND STIGNING pill buttons for
            anyone who'd rather drag one control than tap two — both drive the
            exact same state, so either stays in sync with the other. Sits in
            VÅGRIKT's unused spot on the right since noclip has no wave
            direction to steer. */}
        {(cameraMode === "noclip" || cameraMode === "watercraft") && (
          <div className="pointer-events-none absolute bottom-36 right-8 z-10 select-none">
            <VerticalModeSlider
              value={noclipVerticalMode}
              onChange={setNoclipVerticalMode}
              label={t("hud.joystick.jump")}
            />
          </div>
        )}

        {/* Quick per-camera-mode settings — tucked behind their own bottom
            drawer (like SETTINGS) instead of always-on sliders sitting right
            next to the joysticks, so a stray touch near bottom-center can't
            accidentally nudge a value mid-session. Bottom-center, clear of
            the joystick columns hugging each side. A tab row picks which
            mode's dials are showing — cameraDrawerTab defaults to (and
            re-syncs on) whatever cameraMode actually switches to (see the
            effect above), so opening the drawer right after switching modes
            (top toggle or KAMERA settings dial) always lands on that mode's
            tab, while still letting it be browsed independently once open.
            Each slider is curved rather than linear (see PadSliderCurve): the
            useful settings all live near the bottom of these ranges — VÅG's
            default is 0.5 of 100 — so a linear track put every calm sea
            inside its first pixel and made the first touch of the slider a
            cliff. Hidden entirely in watercraft mode — none of its sliders
            apply there (building/sculpting have no wave-speed-style dials),
            and it would otherwise collide with WatercraftHud occupying the
            same bottom-center spot. */}
        {cameraMode !== "watercraft" && (
          <div className="pointer-events-auto absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2">
            {cameraDrawerOpen && (
              <div className="flex flex-col items-center gap-2 rounded-3xl border ui-line-1 ui-surface-strong p-4 shadow-2xl backdrop-blur-xl">
                <div className="flex gap-1 rounded-full border ui-line-1 ui-surface p-1">
                  {CAMERA_MODES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setCameraDrawerTab(m)}
                      aria-pressed={cameraDrawerTab === m}
                      className={`rounded-full px-3 py-1 text-[9px] font-light tracking-[0.2em] transition active:scale-95 ${
                        cameraDrawerTab === m ? "ui-tint-2 ui-ink" : "ui-ink-muted"
                      }`}
                    >
                      {t(CAMERA_MODE_LABEL_KEYS[m])}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCameraDrawerTab("tornado")}
                    aria-pressed={cameraDrawerTab === "tornado"}
                    className={`rounded-full px-3 py-1 text-[9px] font-light tracking-[0.2em] transition active:scale-95 ${
                      cameraDrawerTab === "tornado" ? "ui-tint-2 ui-ink" : "ui-ink-muted"
                    }`}
                  >
                    {t("dial.camera.tornado")}
                  </button>
                </div>
                {cameraDrawerTab === "float" && (
                  <>
                    <PadSlider
                      label={t("hud.slider.wave")}
                      value={waveAmp}
                      min={0}
                      max={100}
                      step={0.5}
                      curve={4}
                      format={(v) => `${v.toFixed(2)}m`}
                      onChange={setWaveAmp}
                    />
                    <PadSlider
                      label={t("hud.slider.tempo")}
                      value={waveSpeed}
                      min={0}
                      max={10}
                      step={0.1}
                      curve={2}
                      format={(v) => `${v.toFixed(2)}×`}
                      onChange={setWaveSpeed}
                    />
                    {/* Geometric, not power-curved: FREKVENS is a multiplier,
                      so half speed (0.5×) and double (2×) should sit equally
                      far from 1×. */}
                    <PadSlider
                      label={t("hud.slider.frequency")}
                      value={waveFreq}
                      min={WAVE_FREQ_MIN}
                      max={WAVE_FREQ_MAX}
                      step={0.05}
                      curve="log"
                      format={(v) => `${v.toFixed(2)}×`}
                      onChange={setWaveFreq}
                    />
                  </>
                )}
                {cameraDrawerTab === "noclip" && (
                  <>
                    <PadSlider
                      label={t("dial.camera.noclipSpeed")}
                      value={noclipSpeed}
                      min={0.2}
                      max={6}
                      step={0.1}
                      curve={2}
                      format={(v) => `${v.toFixed(1)}×`}
                      onChange={setNoclipSpeed}
                    />
                    <PadSlider
                      label={t("dial.camera.noclipFallRiseSpeed")}
                      value={noclipFallRiseSpeed}
                      min={2}
                      max={300}
                      step={2}
                      curve={2}
                      format={(v) => `${v.toFixed(0)}m/s`}
                      onChange={setNoclipFallRiseSpeed}
                    />
                  </>
                )}
                {cameraDrawerTab === "swing" && (
                  <>
                    <PadSlider
                      label={t("dial.camera.swingIntensity")}
                      value={swingIntensity}
                      min={0.0001}
                      max={2.5}
                      step={0.05}
                      curve={2}
                      format={(v) => `${v.toFixed(2)}×`}
                      onChange={setSwingIntensity}
                    />
                    <PadSlider
                      label={t("dial.camera.swingPositionY")}
                      value={swingPositionY}
                      min={0}
                      max={100000}
                      step={100}
                      curve={2}
                      format={(v) => `${v.toFixed(0)}m`}
                      onChange={setSwingPositionY}
                    />
                    <PadSlider
                      label={t("dial.camera.swingHeight")}
                      value={swingHeight}
                      min={0}
                      max={100000}
                      step={100}
                      curve={2}
                      format={(v) => `${v.toFixed(0)}m`}
                      onChange={setSwingHeight}
                    />
                  </>
                )}
                {/* TORNADO: a fixed tab (not tied to any one camera mode)
                    exposing every tornado* setting at once — mirrors the old
                    standalone VIRVEL tab this drawer used to have. */}
                {cameraDrawerTab === "tornado" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setTornadoOn((v) => !v)}
                      aria-pressed={tornadoOn}
                      className={`rounded-full border px-4 py-1.5 text-[10px] font-light tracking-[0.2em] transition active:scale-95 ${
                        tornadoOn ? "ui-line-3 ui-tint-2 ui-ink" : "ui-line-2 ui-surface ui-ink-muted"
                      }`}
                    >
                      {t("dial.camera.tornado")}: {t(tornadoOn ? "common.on" : "common.off")}
                    </button>
                    <PadSlider
                      label={t("dial.camera.tornadoRadius")}
                      value={tornadoRadius}
                      min={0}
                      max={2000}
                      step={5}
                      curve={2}
                      format={(v) => `${v.toFixed(0)}m`}
                      onChange={setTornadoRadius}
                    />
                    <PadSlider
                      label={t("dial.camera.tornadoSpeed")}
                      value={tornadoSpeed}
                      min={0}
                      max={10}
                      step={0.1}
                      curve={2}
                      format={(v) => `${v.toFixed(2)}×`}
                      onChange={setTornadoSpeed}
                    />
                    <button
                      type="button"
                      onClick={() => setTornadoDirection((d) => (d === "cw" ? "ccw" : "cw"))}
                      className="rounded-full border ui-line-2 ui-surface px-4 py-1.5 text-[10px] font-light tracking-[0.2em] ui-ink-muted transition active:scale-95"
                    >
                      {t("dial.camera.tornadoDirection")}:{" "}
                      {t(TORNADO_DIRECTION_LABEL_KEYS[tornadoDirection])}
                    </button>
                    {(cameraMode === "float" || cameraMode === "swing") && (
                      <PadSlider
                        label={t("dial.camera.tornadoOpening")}
                        value={tornadoOpening}
                        min={3}
                        max={60}
                        step={0.5}
                        format={(v) => `${v.toFixed(1)}m`}
                        onChange={setTornadoOpening}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setTornadoFollowCenter((v) => !v)}
                      aria-pressed={tornadoFollowCenter}
                      className={`rounded-full border px-4 py-1.5 text-[10px] font-light tracking-[0.2em] transition active:scale-95 ${
                        tornadoFollowCenter
                          ? "ui-line-3 ui-tint-2 ui-ink"
                          : "ui-line-2 ui-surface ui-ink-muted"
                      }`}
                    >
                      {t("dial.camera.tornadoFollowCenter")}:{" "}
                      {t(tornadoFollowCenter ? "common.on" : "common.off")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTornadoCloudOn((v) => !v)}
                      aria-pressed={tornadoCloudOn}
                      className={`rounded-full border px-4 py-1.5 text-[10px] font-light tracking-[0.2em] transition active:scale-95 ${
                        tornadoCloudOn
                          ? "ui-line-3 ui-tint-2 ui-ink"
                          : "ui-line-2 ui-surface ui-ink-muted"
                      }`}
                    >
                      {t("dial.camera.tornadoCloud")}: {t(tornadoCloudOn ? "common.on" : "common.off")}
                    </button>
                    {tornadoCloudOn && cameraMode !== "float" && (
                      <PadSlider
                        label={t("dial.camera.tornadoCloudYOffset")}
                        value={tornadoCloudYOffset}
                        min={-200}
                        max={200}
                        step={5}
                        format={(v) => `${v.toFixed(0)}m`}
                        onChange={setTornadoCloudYOffset}
                      />
                    )}
                  </>
                )}
              </div>
            )}
            <button
              onClick={() => setCameraDrawerOpen((v) => !v)}
              className="rounded-full border ui-line-2 ui-surface px-5 py-2 text-[10px] font-light tracking-[0.35em] ui-ink backdrop-blur-md transition active:scale-95 ui-press"
              aria-label={
                cameraDrawerOpen ? t("hud.cameraDrawer.closeAria") : t("hud.cameraDrawer.openAria")
              }
              aria-expanded={cameraDrawerOpen}
            >
              {cameraDrawerOpen
                ? t("hud.cameraDrawer.closeLabel")
                : cameraDrawerTab === "tornado"
                  ? t("dial.camera.tornado")
                  : t(CAMERA_MODE_LABEL_KEYS[cameraDrawerTab])}
            </button>
          </div>
        )}
      </div>

      {/* Interval session HUD: a thin green bar along the very bottom edge
          shows progress through the current FRI/GUNGA interval; a second,
          segmented bar above it (fixed-length sessions only) shows which
          interval of the whole session is current; an optional pill above
          both shows the elapsed/remaining readout. flex-col-reverse stacks
          them bottom-up in that order without needing explicit offsets.
          Deliberately a sibling of the fading HUD wrapper above (like the
          virtual phone below), not nested inside it, so the session stays
          readable at a glance even once idle-fade has hidden the buttons
          and dials. */}
      {intervalSessionOn && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col-reverse">
          <div className="h-1 w-full ui-tint-1">
            <div
              className="h-full bg-emerald-400"
              style={{ width: `${Math.round(intervalProgress * 100)}%` }}
            />
          </div>
          {intervalSessionType === "fixed" && (
            <div className="mb-[3px] flex h-1.5 w-full gap-[2px] px-[2px]">
              {Array.from({ length: intervalCount }).map((_, i) => (
                <div
                  key={i}
                  className={`h-full flex-1 rounded-full ${
                    i < intervalIndex
                      ? "bg-emerald-400"
                      : i === intervalIndex
                        ? "bg-emerald-400/50"
                        : "ui-tint-2"
                  }`}
                />
              ))}
            </div>
          )}
          {intervalShowStats && (
            <div className="mb-2 flex justify-center px-4">
              <span className="rounded-full border ui-line-1 ui-surface px-3 py-1 text-center text-[10px] font-light tracking-[0.15em] ui-ink backdrop-blur-md">
                {t(CAMERA_MODE_LABEL_KEYS[cameraMode])} · {formatClock(curIntervalElapsed)}/
                {formatClock(intervalDuration)} (
                {t("hud.intervalRemaining", { time: formatClock(curIntervalRemaining) })})
                {intervalSessionType === "fixed"
                  ? ` · ${t("hud.intervalFixedLabel", { n: intervalIndex + 1, total: intervalCount })}`
                  : ` · ${t("hud.intervalInfiniteLabel", { n: intervalIndex + 1 })}`}
                {t("hud.totalLabel")}
                {formatClock(intervalElapsedTotal)}
                {totalPlannedDuration !== null
                  ? `/${formatClock(totalPlannedDuration)} (${t("hud.intervalRemaining", { time: formatClock(totalIntervalRemaining!) })})`
                  : ""}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Virtual phone: a floating, draggable, resizable 2D bathOS device
          (not part of the 3D world) used to browse and then "cast" whatever
          it's showing to any TV/mobile display — see VirtualPhone.tsx. Also
          hosts the Fjärrkontroll (remote controller: STRÖM/HÖJD/SVAJ/VÅGRIKT)
          and Skärmar (screen management: edit mode) apps.
          Deliberately a sibling of the fading HUD wrapper above, not nested
          inside it: that wrapper's opacity multiplies down through every
          descendant regardless of the descendant's own opacity/pointer-events,
          so the phone would otherwise visually vanish (while still silently
          receiving clicks) a few seconds after the last touch, even mid-use —
          it manages its own visibility (open/closed) and needs no idle-fade. */}
      {phoneOpen && (
        <VirtualPhone
          onClose={() => setPhoneOpen(false)}
          listDisplays={() => tvManagerRef.current?.listEntries() ?? []}
          onCastNew={(kind, url) => tvManagerRef.current?.addTV(kind, url)}
          onCastTo={(id, url) => tvManagerRef.current?.castTo(id, url)}
          onRemoveAll={() => tvManagerRef.current?.removeAll()}
          settingsPanelProps={settingsPanelProps}
          remoteControllerProps={remoteControllerProps}
          editMode={editMode}
          setEditMode={setEditMode}
        />
      )}

      {/* "Watercraft" camera mode's build/sculpt HUD — see WatercraftRig and
          the cameraMode==="watercraft" wiring throughout this component.
          Rendered last (and so painted on top) so its palette/sliders sit
          above every other HUD element while active. */}
      {cameraMode === "watercraft" && (
        <WatercraftHud
          mode={watercraftMode}
          onModeChange={setWatercraftMode}
          buildAction={watercraftBuildAction}
          onBuildActionChange={setWatercraftBuildAction}
          blockType={watercraftBlockType}
          onBlockTypeChange={setWatercraftBlockType}
          sculptAction={watercraftSculptAction}
          onSculptActionChange={setWatercraftSculptAction}
          brushRadius={watercraftBrushRadius}
          onBrushRadiusChange={setWatercraftBrushRadius}
          brushStrength={watercraftBrushStrength}
          onBrushStrengthChange={setWatercraftBrushStrength}
          blockCount={watercraftBlockCount}
          status={watercraftStatus}
          onExport={() => void watercraftExport()}
          onImportFile={watercraftImportFile}
          onReset={watercraftHandleReset}
          onDone={() => setCameraMode("float")}
        />
      )}
      <ConfirmDialog
        open={watercraftConfirm !== null}
        title={
          watercraftConfirm?.kind === "reset"
            ? "Clear your build?"
            : "Import over your current build?"
        }
        message={
          watercraftConfirm?.kind === "reset"
            ? "This removes every block and sculpted shape. This can't be undone."
            : "If this file is a saved watercraft world, it will replace your current blocks and sculpt. Export first if you want to keep this build."
        }
        confirmLabel={watercraftConfirm?.kind === "reset" ? "Clear" : "Import"}
        cancelLabel="Cancel"
        onCancel={() => setWatercraftConfirm(null)}
        onConfirm={() => {
          if (watercraftConfirm?.kind === "reset") {
            watercraftRigRef.current?.reset();
            setWatercraftStatus("Cleared.");
          } else if (watercraftConfirm?.file) {
            void watercraftRunImport(watercraftConfirm.file);
          }
          setWatercraftConfirm(null);
        }}
      />
    </main>
  );
}

// ---------------------------------------------------------------------------
// Fake "live broadcast" overlay. Simulates streaming to the body's ~28 billion
// cells: pulsing LIVE badge, animated viewer counter, floating reaction
// emojis. Purely presentational — no network, no analytics.
// ---------------------------------------------------------------------------
type Reaction = {
  id: number;
  emoji: string;
  x: number;
  drift: number;
  duration: number;
  scale: number;
};

const REACTION_EMOJIS = [
  "❤️",
  "👍",
  "✨",
  "🌊",
  "💧",
  "🙏",
  "😊",
  "💖",
  "🔥",
  "🫧",
  "☯️",
  "💫",
  "🧘",
  "🥰",
];

function formatViewerCount(n: number, t: (key: string) => string): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} ${t("live.viewerBillion")}`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)} ${t("live.viewerMillion")}`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} ${t("live.viewerThousand")}`;
  return `${Math.round(n)}`;
}

function LiveBroadcast() {
  const { t, i18n } = useTranslation();
  // Base ~28 billion cells; wander with correlated random walk so it feels alive.
  const [viewers, setViewers] = useState<number>(28_000_000_000);
  const [likes, setLikes] = useState<number>(0);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const nextIdRef = useRef(1);

  // Viewer count wanders every ~700ms with drift + jitter.
  useEffect(() => {
    let alive = true;
    const tick = () => {
      if (!alive) return;
      setViewers((v) => {
        const drift = (Math.random() - 0.48) * 4_000_000; // small bias upward
        const jitter = (Math.random() - 0.5) * 20_000_000;
        const next = v + drift + jitter;
        // Clamp to ± ~1.5B around 28B so it stays believable.
        return Math.max(26_500_000_000, Math.min(29_500_000_000, next));
      });
    };
    const id = window.setInterval(tick, 700);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  // Likes trickle in.
  useEffect(() => {
    const id = window.setInterval(() => {
      setLikes((l) => l + Math.floor(1 + Math.random() * 40));
    }, 900);
    return () => window.clearInterval(id);
  }, []);

  // Spawn floating reaction emojis on a random cadence.
  useEffect(() => {
    let alive = true;
    let timeoutId: number;
    const spawn = () => {
      if (!alive) return;
      const burst = 1 + Math.floor(Math.random() * 3);
      const created: Reaction[] = [];
      for (let i = 0; i < burst; i++) {
        const id = nextIdRef.current++;
        created.push({
          id,
          emoji: REACTION_EMOJIS[Math.floor(Math.random() * REACTION_EMOJIS.length)],
          x: 60 + Math.random() * 30, // right side column, in vw
          drift: (Math.random() - 0.5) * 16, // vw of horizontal wander
          duration: 4200 + Math.random() * 2600,
          scale: 0.85 + Math.random() * 0.9,
        });
      }
      setReactions((prev) => [...prev, ...created]);
      // Clean up after animation ends.
      created.forEach((r) => {
        window.setTimeout(() => {
          setReactions((prev) => prev.filter((p) => p.id !== r.id));
        }, r.duration + 200);
      });
      timeoutId = window.setTimeout(spawn, 260 + Math.random() * 620);
    };
    timeoutId = window.setTimeout(spawn, 400);
    return () => {
      alive = false;
      window.clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      <style>{`
        @keyframes aq-live-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(1.35); }
        }
        @keyframes aq-viewer-blip {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 1; }
        }
        @keyframes aq-reaction-rise {
          0% { transform: translate3d(0, 0, 0) scale(var(--aq-s, 1)); opacity: 0; }
          10% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translate3d(var(--aq-dx, 0), -85vh, 0) scale(calc(var(--aq-s, 1) * 1.2)); opacity: 0; }
        }
      `}</style>

      {/* Top-left LIVE badge + viewer count */}
      <div className="absolute left-4 top-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 rounded-md bg-red-600/95 px-2.5 py-1 text-white shadow-lg">
          <span
            className="inline-block h-2 w-2 rounded-full bg-white"
            style={{ animation: "aq-live-pulse 1.4s ease-in-out infinite" }}
            aria-hidden="true"
          />
          <span className="text-[10px] font-bold tracking-[0.25em]">{t("live.badge")}</span>
        </div>
        <div
          className="flex items-center gap-1.5 rounded-md ui-surface-strong px-2 py-1 ui-ink backdrop-blur-sm"
          style={{ animation: "aq-viewer-blip 2.6s ease-in-out infinite" }}
        >
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span className="text-[11px] font-medium tabular-nums tracking-wide">
            {formatViewerCount(viewers, t)}
          </span>
          <span className="text-[9px] ui-ink-muted">{t("live.cellsUnit")}</span>
        </div>
        <div className="rounded-md ui-surface px-2 py-1 text-[10px] ui-ink backdrop-blur-sm">
          {t("live.followerFlow")}
        </div>
      </div>

      {/* Bottom-left engagement counter */}
      <div className="absolute bottom-[calc(env(safe-area-inset-bottom,0px)+8rem)] right-4 flex items-center gap-1.5 rounded-full ui-surface-strong px-2.5 py-1 ui-ink backdrop-blur-sm">
        <span className="text-sm leading-none">❤️</span>
        <span className="text-[11px] font-medium tabular-nums">
          {likes.toLocaleString(i18n.language)}
        </span>
      </div>

      {/* Floating reactions rising from the bottom-right */}
      <div className="absolute inset-0 overflow-hidden">
        {reactions.map((r) => (
          <span
            key={r.id}
            className="absolute select-none"
            style={
              {
                left: `${r.x}vw`,
                bottom: "6rem",
                fontSize: "26px",
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))",
                animation: `aq-reaction-rise ${r.duration}ms ease-out forwards`,
                ["--aq-dx" as string]: `${r.drift}vw`,
                ["--aq-s" as string]: r.scale,
              } as React.CSSProperties
            }
            aria-hidden="true"
          >
            {r.emoji}
          </span>
        ))}
      </div>
    </div>
  );
}
