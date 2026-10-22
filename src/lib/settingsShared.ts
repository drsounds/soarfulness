import vanernBackdrop from "@/assets/vanern-backdrop.png.asset.json";
import sandTextureAsset from "@/assets/sand_cc0_512.jpg.asset.json";
import waterAsset from "@/assets/water.mp3.asset.json";

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
export const WATER_COLORS: { id: string; rgb: [number, number, number] }[] = [
  { id: "nordic", rgb: [1, 1, 1] },
  { id: "tropical", rgb: [0.55, 1.15, 1.25] },
  { id: "caribbean", rgb: [0.6, 1.35, 1.1] },
  { id: "mediterranean", rgb: [0.8, 1.15, 1.3] },
  { id: "archipelago", rgb: [0.85, 1.0, 0.75] },
  { id: "deepSea", rgb: [0.55, 0.7, 1.15] },
];
export const WATER_COLOR_LABEL_KEYS: Record<string, string> = {
  nordic: "options.waterColor.nordic",
  tropical: "options.waterColor.tropical",
  caribbean: "options.waterColor.caribbean",
  mediterranean: "options.waterColor.mediterranean",
  archipelago: "options.waterColor.archipelago",
  deepSea: "options.waterColor.deepSea",
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

// Three available water-sound loops: "simple" is a plain single-take field
// recording (no processing beyond what the audio graph already applies to
// any source — lowpass/depth gain), "advanced" is the original, more
// layered recorded track this app shipped with, and "ocean" is a recorded
// ocean/wave ambience — the default track.
export const WATER_SOUNDS: { id: string; url: string }[] = [
  { id: "simple", url: "/audio/water-simple.m4a" },
  { id: "advanced", url: waterAsset.url },
  { id: "ocean", url: "/audio/ocean.m4a" },
];
export const WATER_SOUND_LABEL_KEYS: Record<string, string> = {
  simple: "options.waterSound.simple",
  advanced: "options.waterSound.advanced",
  ocean: "options.waterSound.ocean",
};

export type SettingsTab = "vagor" | "kamera" | "vatten" | "miljo" | "ljud" | "tema";
// labelKey is an i18next key (see src/locales/*.json), resolved via t() in
// SettingsPanel.tsx — kept here rather than a literal label so this stays
// the single source of truth for tab order/ids.
export const SETTINGS_TABS: { id: SettingsTab; labelKey: string }[] = [
  { id: "vagor", labelKey: "settings.tabs.vagor" },
  { id: "kamera", labelKey: "settings.tabs.kamera" },
  { id: "vatten", labelKey: "settings.tabs.vatten" },
  { id: "miljo", labelKey: "settings.tabs.miljo" },
  { id: "ljud", labelKey: "settings.tabs.ljud" },
  { id: "tema", labelKey: "settings.tabs.tema" },
];

// Four mutually-exclusive camera movement schemes:
//  - "float"      the default: buoyant, wave-riding camera (optionally given
//                 a circular "tornado" swirl around wherever the current
//                 carries it, with a real water whirlpool opening up
//                 directly beneath it at the same xz spot — the old
//                 standalone VIRVEL mode's feel, now reached via the shared
//                 tornado* fields instead of its own camera mode).
//  - "noclip"     free 3D flight in any direction, ignoring the water/wave
//                 physics (optionally given the same whirlpool-style
//                 circular "tornado" swirl around wherever NAV/HÖJD/DRIFT XZ
//                 actually fly it — see the shared tornado* fields).
//  - "swing"      a pendulum that swings back and forth high above the water
//                 (optionally spun into a circular "tornado" orbit instead,
//                 with a real water whirlpool opening up directly beneath
//                 it at the same xz spot — see the shared tornado* fields).
//  - "watercraft" free 3D flight exactly like "noclip" (see every noclip
//                 branch in routes/index.tsx's render loop, each extended to
//                 also match this mode), plus a raft bobbing on the real
//                 ocean with a Minecraft-like block grid and a brush-
//                 sculptable clay pad — see WatercraftRig in
//                 src/lib/watercraft/. The one optional "build a world"
//                 mode among these four.
export type CameraMode = "float" | "noclip" | "swing" | "watercraft";
export const CAMERA_MODES: CameraMode[] = ["float", "noclip", "swing", "watercraft"];

// Angular direction of the unified TORNADO orbit (see tornado* fields
// below): "cw"/"ccw" as seen from above (+y looking down).
export type TornadoDirection = "cw" | "ccw";
export const TORNADO_DIRECTIONS: TornadoDirection[] = ["cw", "ccw"];

// How the TORNADO SEQUENCE's "exit" phase leaves the center once the "stay"
// phase's duration elapses: "outer" pulls the camera back out to
// tornadoRadius (the reverse of the initial drag-in), while "lift" instead
// raises it straight up by tornadoSequenceLiftHeight, pauses briefly, then
// sends it back down to wherever that cycle's drag-in phase started from
// (not a single fixed spot — each loop iteration recaptures its own start).
export type TornadoSequenceExitMode = "outer" | "lift";
export const TORNADO_SEQUENCE_EXIT_MODES: TornadoSequenceExitMode[] = ["outer", "lift"];

// How SURGE's own direction (surgeDirRef in routes/index.tsx) evolves over
// time: "off" holds a fixed bearing (set via the SURGE DIRECTION dial),
// "cw"/"ccw" turn it steadily clockwise/counter-clockwise as seen from
// above, and "random" instead lets it wander via a smooth, damped random
// walk — an organic drift rather than a steady spin, meant to read like a
// real current's direction shifting over time instead of a mechanical
// rotation.
export type SurgeRotationMode = "off" | "cw" | "ccw" | "random";
export const SURGE_ROTATION_MODES: SurgeRotationMode[] = ["off", "cw", "ccw", "random"];

// Quick-jump starting heights for sky-swing mode: a fixed preset, or "custom"
// meaning the GUNGA POSITION Y dial is left exactly as the user set it.
export type SwingPreset = "water" | "clouds" | "custom";
export const SWING_PRESETS: SwingPreset[] = ["water", "clouds", "custom"];
// HIMMEL-MOLNHÖJD range (meters above the water surface).
export const SKY_CLOUDS_ALTITUDE_MIN = 100;
export const SKY_CLOUDS_ALTITUDE_MAX = 5000;
// MOLNSKALA range (multiplier on the cloud texture's feature size).
export const CLOUD_SCALE_MIN = 0.25;
export const CLOUD_SCALE_MAX = 8;

// Shape of the pendulum's vertical (y) motion over one swing cycle.
// "pendulum" (default) is the physically-inspired shape: y rises at both
// ends of the arc and dips at the bottom, twice per side-to-side cycle.
// The others drive y directly off the swing clock's phase for a simpler,
// symmetric up/down motion once per cycle.
export type SwingYWaveform = "pendulum" | "sine" | "triangle" | "square";
export const SWING_Y_WAVEFORMS: SwingYWaveform[] = ["pendulum", "sine", "triangle", "square"];

// FREAK OUT: which of the gondola ring's own local axes it spins about —
// relative to the direction the camera faced when GUNGA was entered
// (swingYawRef): "x" = side axis (the ring loops up/down like a ferris
// wheel), "y" = vertical / along the arm (the real ride: a flat ring of
// outward-facing seats spinning around), "z" = forward axis (a barrel roll).
export type FreakOutAxis = "x" | "y" | "z";
export const FREAK_OUT_AXES: FreakOutAxis[] = ["x", "y", "z"];

// Shape of the DEPTH SINE water-level oscillation (routes/index.tsx's
// depthMod). "sine" (default) is the existing symmetric shapedWave() curve.
// "sawtooth" instead climbs for most of the cycle and then drops steeply
// right after the peak — depthSinePeak still controls how sharp that drop
// is, same as it sharpens the "sine" crest.
export type DepthSineWaveform = "sine" | "sawtooth";
export const DEPTH_SINE_WAVEFORMS: DepthSineWaveform[] = ["sine", "sawtooth"];

// i18next key for each camera mode's display label — shared by the settings
// dial (SettingsPanel.tsx) and the interval-session HUD readout
// (routes/index.tsx), each of which resolves it via t().
export const CAMERA_MODE_LABEL_KEYS: Record<CameraMode, string> = {
  float: "camera.mode.float",
  noclip: "camera.mode.noclip",
  swing: "camera.mode.swing",
  watercraft: "camera.mode.watercraft",
};

export const TORNADO_DIRECTION_LABEL_KEYS: Record<TornadoDirection, string> = {
  cw: "camera.tornadoDirection.cw",
  ccw: "camera.tornadoDirection.ccw",
};

export const TORNADO_SEQUENCE_EXIT_MODE_LABEL_KEYS: Record<TornadoSequenceExitMode, string> = {
  outer: "camera.tornadoSequenceExitMode.outer",
  lift: "camera.tornadoSequenceExitMode.lift",
};

export const SURGE_ROTATION_MODE_LABEL_KEYS: Record<SurgeRotationMode, string> = {
  off: "camera.surgeRotationMode.off",
  cw: "camera.surgeRotationMode.cw",
  ccw: "camera.surgeRotationMode.ccw",
  random: "camera.surgeRotationMode.random",
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
  // Multiplier on the float-mode buoyancy spring's forward lookahead (how far
  // ahead it peeks, and how much that peek biases its target) — see the
  // ANTICIPATION dial's use in routes/index.tsx's animate(). 0 makes the
  // camera purely reactive to the wave's current height (prone to visibly
  // lagging a crest); 1 is the tuned default.
  waveAnticipation: number;
  camOffX: number;
  camOffY: number;
  camOffZ: number;
  audioOn: boolean;
  audioVol: number;
  audioSyncSpeed: boolean;
  audioSpatial: boolean;
  waterSoundIdx: number;
  waterColorIdx: number;
  waterOpacity: number;
  // Blends the flat WATER_COLORS tint directly over the fully lit/reflected/
  // textured result (see uWaterColorAlpha in the ocean fragment shader) —
  // independent of waterOpacity (translucency to whatever's behind the
  // water) and of waterHue/waterSat/waterBright (which only affect the tint
  // that feeds the lit shading, not this overlay). 1 gives the flat,
  // saturated look of Super Mario Sunshine's water; 0 keeps the previous,
  // fully lit/textured appearance.
  waterColorAlpha: number;
  // The wave surface's background fill — the water body behind the wave
  // "texture" (reflections, sun glints, foam); see "Wave background" in the
  // ocean fragment shader. waveBgCustomColor is a "#rrggbb" override for its
  // color, "" = natural water shading. waveBgOpacity is the fill's own
  // opacity: 1 = the normal look, 0 = only the wave texture remains.
  // (Replaces the earlier waveBgColor/waveBgAlpha under-layer, renamed so
  // old saved values — alpha 0 — don't turn every water surface see-through.)
  waveBgCustomColor: string;
  waveBgOpacity: number;
  // Foam (SKUM) look — see the "Foam" block in the ocean fragment shader.
  // foamAmount is overall strength (0 = off, 1 = default, up to 2),
  // foamCoverage (0–1) lowers the crest/patch thresholds so more of the
  // surface foams (0.5 matches the original foam), foamScale is the
  // pattern size multiplier and foamColor a "#rrggbb" tint.
  foamAmount: number;
  foamCoverage: number;
  foamScale: number;
  foamColor: string;
  // Detail waves (DETALJVÅGOR): short wind waves rendered per-pixel on top
  // of the swell ("waves within the waves"). detailWaves is the strength
  // (0 = off), detailScale multiplies their wavelengths.
  detailWaves: number;
  detailScale: number;
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
  // LOW GRAPHICS MODE: a single opt-in "everything cheap" switch for lower-
  // end/older devices — on top of targetFps/resolutionScale above, this
  // forces off every optional texture (seafloor sand, the reflection photo,
  // torus-ring texture) and every live-noise fbm effect (BOTTOM "clouds",
  // mid/sky cloud decks + their VÄRLDSGRÄNS extension layers, sky puffs,
  // the ocean's high-quality micro-chop, foam and detail waves, real caustics) plus the
  // remaining shading extras (chromatic aberration, the sphere-map matcap
  // material, torus rings entirely) — see lowGraphicsModeRef's reads in
  // routes/index.tsx's animate() and the effects around applyReflMix/
  // torusRingField.setConfig. Purely a runtime override: it doesn't touch
  // any of those settings' own persisted values, so turning it back off
  // restores exactly what was chosen before.
  lowGraphicsMode: boolean;
  regularWaves: boolean;
  realisticWaves: boolean;
  dyingWave: boolean;
  dyingWaveAmp: number;
  dyingWaveSpeed: number;
  randomizeWaves: boolean;
  wavePreset: WavePresetName;
  regularCross: boolean;
  // VÅGFORM = STÅENDE: the regular waveform as a standing wave (alternate
  // crests rise while their neighbours sink) instead of travelling crests.
  // Only takes effect together with regularWaves.
  standingWaves: boolean;
  // VÅGFORM = SKVALPANDE: the regular waveform's crests slosh back and forth
  // along the wave direction while the mean level rises and falls, and the
  // camera floats on it with lagging buoyancy. Only takes effect together
  // with regularWaves (and with standingWaves off).
  sloshWaves: boolean;
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
  // BOTTOM "clouds" mode's cloud layer used to always drift slowly over
  // time; that drift is now opt-in (default off, so the clouds sit still)
  // via this toggle instead of always animating.
  floorCloudsAnimated: boolean;
  // TORNADO: one unified toggle shared by every applicable camera mode —
  // "float" (FRI/swimming), "swing" (GUNGA) and "noclip"/"watercraft"
  // (flying) — instead of the old standalone "whirlpool" camera mode plus
  // the separate swingTornado*/noclipTornado* schemas this replaced.
  // Radius/Speed/Direction/Opening all mean the same thing regardless of
  // which mode is active. While floating or swinging, turning this on also
  // opens a real water whirlpool centered at the same xz spot as the orbit
  // itself (see tornadoOpening and the vortexBlendRef-gated branches of the
  // physics loop in routes/index.tsx); while flying, only the camera's
  // circular orbit applies (no water effect). Activating/deactivating eases
  // in/out over time (tornadoBlendRef/vortexBlendRef in routes/index.tsx)
  // rather than snapping instantly.
  tornadoOn: boolean;
  tornadoRadius: number;
  tornadoSpeed: number;
  tornadoDirection: TornadoDirection;
  // Width of the water whirlpool's throat while floating or swinging — has
  // no effect while flying (noclip/watercraft never show the water vortex).
  tornadoOpening: number;
  // Whether the camera's look direction eases toward facing the tornado/
  // whirlpool's center (like looking down into the vortex) instead of
  // keeping whatever forward direction NAV/LOOK already has it facing.
  tornadoFollowCenter: boolean;
  // TORNADO CLOUD: optional visible funnel-shaped cloud mesh wrapping the
  // active tornado orbit, sized off tornadoRadius — see tornadoCloudMeshRef
  // in routes/index.tsx. Purely cosmetic; the orbit itself works
  // identically whether or not this is on.
  tornadoCloudOn: boolean;
  // While swinging or flying, the TORNADO CLOUD's vertical position is
  // pinned to the real water surface at its own xz spot (not to the
  // camera's/swing's own altitude — a tornado should look rooted in the
  // water, not bob around with wherever the camera happens to be) plus this
  // adjustable offset in meters; its height (vertical extent) is swingHeight
  // regardless of which of those two modes is active. Has no effect while
  // floating, where the cloud still simply follows the camera's own height.
  tornadoCloudYOffset: number;
  // Manual radial control (all tornado-applicable modes, whenever tornadoOn):
  // NAV's y-axis and the mode's own "current" dial (STRÖM for float, DRIFT XZ
  // for noclip/watercraft) both push the camera's live orbit radius in/out
  // between a small inner minimum and tornadoRadius — see tornadoLiveRadiusRef
  // in routes/index.tsx. Purely a runtime position, not itself persisted;
  // only the toggle/tuning for the automatic sequence below lives here.
  //
  // TORNADO SEQUENCE: an optional automatic cycle layered on top of that same
  // live radius — drags the camera in to the center over
  // tornadoSequenceDragDuration (at tornadoSequenceDragSpeed), holds it there
  // for tornadoSequenceStayDuration (default 5s), then either pulls it back
  // out to tornadoRadius ("outer") or lifts it straight up by
  // tornadoSequenceLiftHeight, pauses for tornadoSequencePauseDuration, and
  // sends it back down to that cycle's own drag-in starting position ("lift")
  // — see tornadoSequenceExitMode/TornadoSequenceExitMode above. Loops
  // continuously for as long as it's on. Manual NAV/current input above still
  // works alongside it (added on top of the sequence's own radius), but the
  // sequence resumes control of the baseline each cycle.
  tornadoSequenceOn: boolean;
  tornadoSequenceDragSpeed: number;
  tornadoSequenceDragDuration: number;
  tornadoSequenceStayDuration: number;
  tornadoSequenceExitMode: TornadoSequenceExitMode;
  tornadoSequenceExitSpeed: number;
  tornadoSequenceLiftHeight: number;
  tornadoSequencePauseDuration: number;
  intervalIncludeFloat: boolean;
  intervalIncludeSwing: boolean;
  depthSineOn: boolean;
  depthSineAmp: number;
  depthSineFreq: number;
  // Water-level rise/sink dials layered on top of depthSineAmp (height) and
  // depthSineFreq (frequency), all multiplying/dividing the same phase
  // together — mirrors how VÅGOR already stacks TEMPO/FREKVENS/VÅGPERIOD.
  // Each defaults to a neutral value (1) so existing depthSine* settings
  // behave exactly as before until a dial is actually moved.
  depthSineSpeed: number;
  depthSineInterval: number;
  // Sharpness of the rise/sink peak, fed straight into the same
  // shapedWave() curve VÅGOR's SPETS dial uses — 1 is a plain sine.
  depthSinePeak: number;
  // Which curve depthMod uses — see DepthSineWaveform above.
  depthSineWaveform: DepthSineWaveform;
  // Unbounded water-level drift (m/s, signed) layered on top of the bounded
  // DEPTH SINE oscillation above — much like noclip's FRITT FALL/OMVÄND
  // STIGNING, but for the water level instead of the camera: positive keeps
  // the surface rising forever, negative keeps it sinking forever, 0 is off.
  depthDriftSpeed: number;
  // DRIFT SINUS: optionally swings LEVEL DRIFT's rate as a sine around
  // depthDriftSpeed — amp in m/s, speed in cycles/s (Hz), phase in degrees.
  // Off by default so the plain constant drift is unchanged.
  depthDriftSineOn: boolean;
  depthDriftSineAmp: number;
  depthDriftSineSpeed: number;
  depthDriftSinePhase: number;
  hideWater: boolean;
  midCloudsOn: boolean;
  midCloudsHeight: number;
  skyCloudsOn: boolean;
  // Sky cloud deck altitude in meters above the water surface.
  skyCloudsAltitude: number;
  // 3D-MOLN: volumetric puff clouds on top of each flat layer — bottom
  // (only when BOTTEN is MOLN), mid-water and sky. See lib/clouds3d.ts.
  bottomClouds3d: boolean;
  midClouds3d: boolean;
  skyClouds3d: boolean;
  // Cloud texture scale (1 = original size; higher = bigger cloud features),
  // separately for the underwater decks (bottom + mid) and the sky decks.
  bottomCloudsScale: number;
  skyCloudsScale: number;
  // MOLN TONING: how fast cloud layers (mid/sky decks and VÄRLDSGRÄNS's
  // y-extension layers) ease their opacity in/out as they're toggled or
  // recycled to a new altitude band, instead of popping visible/invisible —
  // see uOpacity/cloudFadeSpeedRef in routes/index.tsx. Higher = faster.
  cloudFadeSpeed: number;
  // SKY PUFFS: optional individual, randomly-placed puffy clouds (distinct
  // from the always-tiled MID-CLOUDS/SKY-CLOUDS deck above) that each drift
  // through their own fade-in/hold/fade-out cycle and then reappear at a new
  // random spot — see the skyPuffs* refs and the SKY PUFFS block in
  // routes/index.tsx's scene setup/animate() for the actual mesh pool.
  skyPuffsOn: boolean;
  // How many puffs exist at once.
  skyPuffsCount: number;
  // Each puff's diameter in world units.
  skyPuffsSize: number;
  // Rate multiplier on each puff's fade-in/hold/fade-out/respawn cycle —
  // higher means puffs cycle to a new altitude/position more often.
  skyPuffsFreq: number;
  // Opacity each puff reaches at the peak of its fade-in.
  skyPuffsOpacity: number;
  swayAmp: number;
  swaySpeed: number;
  swayBias: number;
  syncWaveWithSway: boolean;
  // SURGE: an independent, slow back-and-forth current — the same feel as
  // SVAJ (SWAY) above, but on its own clock instead of being phase-locked to
  // the vertical HEAVE bob, so it keeps carrying the camera fore/aft along
  // its own direction even when the wave itself is flat. surgeRotationMode/
  // surgeRotationSpeed let that direction slowly turn (or wander, in
  // "random") instead of staying fixed — see routes/index.tsx's surge
  // physics for the exact math. Purely a position offset like SVAJ, applied
  // to both the camera and its look target together so it never turns the
  // view, only carries it.
  surgeAmp: number;
  surgeSpeed: number;
  surgeRotationMode: SurgeRotationMode;
  surgeRotationSpeed: number;
  // VÄRLDSGRÄNS (world boundary): once on, the camera's x/z and y wrap to the
  // opposite edge on crossing ±worldBoundarySize/Height — see wrapAxis in
  // routes/index.tsx. worldBoundaryYExtend is the *default* y behavior:
  // instead of a bare wrap, extra sky-cloud layers tile around the camera's
  // altitude (EXTEND_CLOUD_LAYER_* in routes/index.tsx) so climbing/diving
  // through the boundary always looks like more of the same infinite cloud
  // deck, hiding the wrap entirely.
  worldBoundaryOn: boolean;
  worldBoundarySize: number;
  worldBoundaryHeight: number;
  worldBoundaryYExtend: boolean;
  liveMode: boolean;
  sceneId: string | null;
  // Which entry of the current scene's manifest "locations" (a.k.a.
  // "places") list the respawn button teleports to — see resolveSpawnLocations
  // in routes/index.tsx. null = the first location in that list (typically
  // the manifest's own "Spawn" entry, or the {0,0,0} fallback when the
  // manifest defines none).
  spawnLocationId: string | null;
  envId: string | null;
  envEra: string | null;
  envTime: string | null;
  // TIME TRAVEL: when set, the simulated clock (routes/index.tsx) starts from
  // this date/time (ms since epoch) instead of the real current time, then
  // keeps ticking forward in real time from there — see
  // src/lib/timeTravel.ts's simulatedDate(). null = live (simulated clock ===
  // real current time).
  timeTravelBaseMs: number | null;
  // Real Date.now() captured the moment timeTravelBaseMs was set, so the
  // elapsed real time since then can be added back on.
  timeTravelSetAtMs: number | null;
  // When true, timeOfDay is continuously derived from the real sunrise/
  // sunset for the simulated date (a fixed northern-hemisphere latitude)
  // instead of staying at whatever value it was last set to — see
  // northernHemisphereTimeOfDay() in src/lib/timeTravel.ts.
  timeSeasonalSync: boolean;
  // Master on/off for the whole DATE & TIME TRAVEL feature: the simulated
  // clock's once-a-minute tick, the HUD clock readout/button, and the
  // time-travel dialog it opens. Off entirely hides/disables all of it,
  // regardless of timeTravelBaseMs/timeSeasonalSync.
  clockOn: boolean;
  surfaceId: string | null;
  reflStrength: number;
  bottomColor: string;
  sphereMaterial: boolean;
  sphereStrength: number;
  // VÅGMATERIAL = RAYTRACED: the port of Evan Wallace's WebGL Water (see
  // src/lib/raytracedWater/RaytracedWater.ts). Mutually exclusive with
  // sphereMaterial in the UI, layered over whichever waveform is active.
  raytracedMaterial: boolean;
  raytracedStrength: number;
  trochoid: number;
  // HEAVE SKEW: a phase-warp (0 = untouched sine, up to ~0.9 before phase
  // folding) applied to every sine term behind REGELBUNDEN/SPRIDD — see
  // shapedWave() in routes/index.tsx for the exact math. Unlike TROCHOID
  // (a purely visual horizontal mesh displacement that never reaches the
  // camera, see uTrochoid there), this warps the *time* profile itself in
  // both the rendered surface and the JS-side waveHeight() the camera
  // buoyancy reads — so a fixed point on the water rises quickly to a sharp
  // peak and sinks back slowly, and the camera's heave actually feels that
  // asymmetry instead of pure sine. Off by default so it's an opt-in look
  // to compare against the existing motion.
  heaveSkew: number;
  causticsOn: boolean;
  chromaticAberrationOn: boolean;
  chromaticAberrationAmount: number;
  cameraMode: CameraMode;
  noclipSpeed: number;
  // FRITT FALL/OMVÄND STIGNING's terminal vertical speed in m/s (at
  // noclipSpeed 1x — still scaled by NOCLIP SPEED on top of this) and the
  // exponential ease-in/out time constant ("grace") that ramps the actual
  // applied rate toward it — see the noclip branch of the physics loop in
  // routes/index.tsx for the exact math.
  noclipFallRiseSpeed: number;
  noclipVertEaseTime: number;
  swingPositionY: number;
  swingIntensity: number;
  swingSpeed: number;
  swingXFactor: number;
  swingHeight: number;
  swingPreset: SwingPreset;
  swingYWaveform: SwingYWaveform;
  // FREAK OUT: an optional carousel ride, its own toggle like TORNADO —
  // available in every camera mode and layered on top of whatever that
  // mode does (with GUNGA both swings combine) — the camera rides one seat
  // of a ring of sofas hanging freakOutSwingLength meters below a pivot,
  // swinging up to ±freakOutSwingAngle degrees about a horizontal axis whose
  // bearing is freakOutSwingAxis (0° = sideways axis, so the arm swings
  // forward/back; 90° = forward axis, so it swings side to side). With
  // freakOutRotationOn the ring itself also spins about freakOutRotationAxis
  // at freakOutRotationSpeed, and with freakOutRotationOscillate that spin
  // smoothly reverses back and forth at freakOutRotationOscillateSpeed. The
  // view tilts/turns with the seat. See freakOutPose() and the swing branch
  // of the physics loop in routes/index.tsx. Off by default.
  freakOutOn: boolean;
  freakOutSwingAxis: number;
  freakOutSwingAngle: number;
  freakOutSwingSpeed: number;
  freakOutSwingLength: number;
  freakOutRingRadius: number;
  freakOutRotationOn: boolean;
  freakOutRotationAxis: FreakOutAxis;
  freakOutRotationSpeed: number;
  freakOutRotationOscillate: boolean;
  freakOutRotationOscillateSpeed: number;
  // Spin direction of the gondola ring (before any back-and-forth
  // alternation from freakOutRotationOscillate).
  freakOutRotationDirection: TornadoDirection;
  // GUNGA BEHÅLL TEMPO: when on, the swing's cycle rate is scaled by
  // swingKeepSpeedRefHeight / swingHeight so changing GUNGA HÖJD doesn't
  // also change how fast the camera moves. The reference height is captured
  // when the option is turned on.
  swingKeepSpeed: boolean;
  swingKeepSpeedRefHeight: number;
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
    "waveAnticipation",
    "swayAmp",
    "swaySpeed",
    "swayBias",
    "syncWaveWithSway",
    "surgeAmp",
    "surgeSpeed",
    "surgeRotationMode",
    "surgeRotationSpeed",
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
    "standingWaves",
    "sloshWaves",
    "regularPeriod",
    "wavePeak",
    "trochoid",
    "heaveSkew",
    "waveHighQuality",
    "waveDir",
  ],
  kamera: [
    "cameraMode",
    "noclipSpeed",
    "noclipFallRiseSpeed",
    "noclipVertEaseTime",
    "swingPreset",
    "swingPositionY",
    "swingIntensity",
    "swingSpeed",
    "swingXFactor",
    "swingHeight",
    "swingYWaveform",
    "freakOutOn",
    "freakOutSwingAxis",
    "freakOutSwingAngle",
    "freakOutSwingSpeed",
    "freakOutSwingLength",
    "freakOutRingRadius",
    "freakOutRotationOn",
    "freakOutRotationAxis",
    "freakOutRotationSpeed",
    "freakOutRotationOscillate",
    "freakOutRotationOscillateSpeed",
    "freakOutRotationDirection",
    "swingKeepSpeed",
    "swingKeepSpeedRefHeight",
    "tornadoOn",
    "tornadoRadius",
    "tornadoSpeed",
    "tornadoDirection",
    "tornadoOpening",
    "tornadoFollowCenter",
    "tornadoCloudOn",
    "tornadoCloudYOffset",
    "tornadoSequenceOn",
    "tornadoSequenceDragSpeed",
    "tornadoSequenceDragDuration",
    "tornadoSequenceStayDuration",
    "tornadoSequenceExitMode",
    "tornadoSequenceExitSpeed",
    "tornadoSequenceLiftHeight",
    "tornadoSequencePauseDuration",
    "intervalSessionOn",
    "intervalDuration",
    "intervalSessionType",
    "intervalCount",
    "intervalShowStats",
    "intervalIncludeFloat",
    "intervalIncludeSwing",
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
    "lowGraphicsMode",
    "chromaticAberrationOn",
    "chromaticAberrationAmount",
  ],
  vatten: [
    "waterColorIdx",
    "surfaceId",
    "reflStrength",
    "sphereMaterial",
    "sphereStrength",
    "raytracedMaterial",
    "raytracedStrength",
    "waterOpacity",
    "waterColorAlpha",
    "waveBgCustomColor",
    "waveBgOpacity",
    "foamAmount",
    "foamCoverage",
    "foamScale",
    "foamColor",
    "detailWaves",
    "detailScale",
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
    "floorCloudsAnimated",
    "depthSineOn",
    "depthSineAmp",
    "depthSineFreq",
    "depthSineSpeed",
    "depthSineInterval",
    "depthSinePeak",
    "depthSineWaveform",
    "depthDriftSpeed",
    "depthDriftSineOn",
    "depthDriftSineAmp",
    "depthDriftSineSpeed",
    "depthDriftSinePhase",
    "hideWater",
    "causticsOn",
  ],
  miljo: [
    "timeOfDay",
    "midCloudsOn",
    "midCloudsHeight",
    "skyCloudsOn",
    "skyCloudsAltitude",
    "bottomClouds3d",
    "midClouds3d",
    "skyClouds3d",
    "bottomCloudsScale",
    "skyCloudsScale",
    "cloudFadeSpeed",
    "skyPuffsOn",
    "skyPuffsCount",
    "skyPuffsSize",
    "skyPuffsFreq",
    "skyPuffsOpacity",
    "worldBoundaryOn",
    "worldBoundarySize",
    "worldBoundaryHeight",
    "worldBoundaryYExtend",
    "surfaceArea",
    "sceneId",
    "spawnLocationId",
    "envId",
    "envEra",
    "envTime",
    "timeTravelBaseMs",
    "timeTravelSetAtMs",
    "timeSeasonalSync",
    "clockOn",
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
  ljud: ["audioOn", "audioVol", "audioSyncSpeed", "audioSpatial", "waterSoundIdx"],
  // Tema (UI chrome theme) isn't part of the wave/camera/water/environment/
  // audio Persisted snapshot at all — it's its own localStorage-backed
  // store (src/lib/uiTheme.ts), so there's nothing for the preset save/
  // load/export/import controls to scope to here.
  tema: [],
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
