import * as THREE from "three";
import type { UnderwaterFogBlend } from "../settingsShared";

// UNDERVATTENDIS: a screen-space gradient drawn over the 3D view and below
// every HUD control (see routes/index.tsx, right above the GogglesOverlay).
// It starts at the top with a "fog color" and fades down to the water color,
// to give the feel of being underwater.
//
// The gradient's top edge is docked to the waterline on screen: the point on
// the water surface VATTENLINJEAVSTÅND meters straight ahead of the camera.
// Above the surface that point sits below the horizon (lower the higher you
// are); below the surface it sits above the horizon (higher the deeper you
// dive). So the fog sinks toward the bottom of the screen as you rise out of
// the water and climbs, until it fills the whole screen, as you dive.
//
// The element is styled imperatively from the render loop (no React state),
// and only touched when something visibly changed.

export type { UnderwaterFogBlend } from "../settingsShared";

export type UnderwaterFogParams = {
  // Hex colors (#rrggbb) and their opacities (0..1) at the top edge and at
  // the bottom of the fade.
  fogColor: string;
  fogOpacity: number;
  waterColor: [number, number, number]; // 0..1 sRGB
  waterOpacity: number;
  // Overall strength (0..1), multiplies both opacities.
  intensity: number;
  // How much of the way from the top edge to the screen's bottom the fade to
  // the water color takes (0.05..1); below that it stays the water color.
  spread: number;
  // Shape of the fade: 1 = linear, < 1 reaches the water color sooner,
  // > 1 lingers in the fog color longer.
  curve: number;
  // Soft top edge, as a fraction of the screen height (0 = hard line).
  feather: number;
  // 0..1 extra fade (e.g. for BARA UNDER YTAN while above water).
  visibility: number;
};

const STOPS = 8;

function hexToRgb01(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0.6, 0.8, 0.9];
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function rgba(c: [number, number, number], a: number): string {
  const ch = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  return `rgba(${ch(c[0])},${ch(c[1])},${ch(c[2])},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * CSS background for a full-screen element, with the top edge of the fog at
 * `topFrac` of the screen height (0 = top, 1 = bottom; may be outside 0..1).
 * Returns "none" when nothing would show.
 */
export function underwaterFogGradient(topFrac: number, p: UnderwaterFogParams): string {
  const strength = clamp(p.intensity, 0, 1) * clamp(p.visibility, 0, 1);
  if (strength <= 0.001 || topFrac >= 1.0 + Math.max(0, p.feather)) return "none";
  const fog = hexToRgb01(p.fogColor);
  const water = p.waterColor;
  const fogA = clamp(p.fogOpacity, 0, 1) * strength;
  const waterA = clamp(p.waterOpacity, 0, 1) * strength;
  if (fogA <= 0.001 && waterA <= 0.001) return "none";

  const top = topFrac * 100;
  const span = Math.max(0.5, (100 - Math.min(top, 100)) * clamp(p.spread, 0.05, 1));
  const curve = clamp(p.curve, 0.2, 5);
  const feather = Math.max(0, p.feather) * 100;
  const stops: string[] = [];
  if (feather > 0.01) {
    stops.push(`${rgba(fog, 0)} ${(top - feather).toFixed(2)}%`);
  } else {
    stops.push(`${rgba(fog, 0)} ${top.toFixed(2)}%`);
  }
  for (let i = 0; i <= STOPS; i++) {
    const t = i / STOPS;
    const f = Math.pow(t, curve);
    const c: [number, number, number] = [
      fog[0] + (water[0] - fog[0]) * f,
      fog[1] + (water[1] - fog[1]) * f,
      fog[2] + (water[2] - fog[2]) * f,
    ];
    stops.push(`${rgba(c, fogA + (waterA - fogA) * f)} ${(top + span * t).toFixed(2)}%`);
  }
  return `linear-gradient(to bottom, ${stops.join(", ")})`;
}

const _fwd = new THREE.Vector3();
const _pt = new THREE.Vector3();

/**
 * Where the waterline falls on screen (0 = top, 1 = bottom): the water
 * surface point `distance` meters horizontally ahead of the camera, projected
 * through it. Clamped to a generous band around the screen so a very steep
 * look never produces Infinity.
 */
export function waterlineScreenFraction(
  camera: THREE.PerspectiveCamera,
  surfaceY: number,
  distance: number,
): number {
  camera.updateMatrixWorld();
  camera.getWorldDirection(_fwd);
  _fwd.y = 0;
  if (_fwd.lengthSq() < 1e-8) {
    // Looking straight up or down: use the camera's up vector instead,
    // which then points along the horizontal look heading.
    _fwd.set(0, 1, 0).applyQuaternion(camera.quaternion);
    _fwd.y = 0;
    if (_fwd.lengthSq() < 1e-8) _fwd.set(0, 0, -1);
  }
  _fwd.normalize();
  const d = Math.max(0.5, distance);
  _pt.set(camera.position.x + _fwd.x * d, surfaceY, camera.position.z + _fwd.z * d);
  // Behind the camera (only when pitched past straight up/down): fall back
  // to which side of the surface the camera is on.
  _pt.applyMatrix4(camera.matrixWorldInverse);
  if (_pt.z >= -1e-4) return camera.position.y > surfaceY ? 2 : -1;
  _pt.applyMatrix4(camera.projectionMatrix);
  return clamp((1 - _pt.y) / 2, -1, 2);
}

/** Drives the overlay element; only writes styles when they changed. */
export class UnderwaterFogOverlay {
  private lastBg = "";
  private lastBlend = "";
  private smoothedTop: number | null = null;

  update(
    el: HTMLElement,
    dt: number,
    targetTopFrac: number,
    blend: UnderwaterFogBlend,
    params: UnderwaterFogParams,
  ) {
    // A light smoothing so bobbing on waves doesn't make the edge jitter,
    // while still tracking dives and look changes closely.
    if (this.smoothedTop === null || Math.abs(targetTopFrac - this.smoothedTop) > 0.5) {
      this.smoothedTop = targetTopFrac;
    } else {
      this.smoothedTop += (targetTopFrac - this.smoothedTop) * Math.min(1, dt * 18);
    }
    // Quantize to avoid restyling for sub-pixel movement.
    const top = Math.round(this.smoothedTop * 2000) / 2000;
    const bg = underwaterFogGradient(top, params);
    if (bg !== this.lastBg) {
      el.style.background = bg;
      this.lastBg = bg;
    }
    if (blend !== this.lastBlend) {
      el.style.mixBlendMode = blend;
      this.lastBlend = blend;
    }
  }

  reset() {
    this.lastBg = "";
    this.lastBlend = "";
    this.smoothedTop = null;
  }
}
