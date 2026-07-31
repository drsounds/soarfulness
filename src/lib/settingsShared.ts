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
// meaning the SWING HÖJD dial is left exactly as the user set it.
export type SwingPreset = "water" | "clouds" | "custom";
export const SWING_PRESETS: SwingPreset[] = ["water", "clouds", "custom"];
