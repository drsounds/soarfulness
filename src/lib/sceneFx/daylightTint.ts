import * as THREE from "three";

// DYGNSTONING: how strongly the current time of day colors the light
// falling on an environment skybox, from the same time-of-day palette the
// water/sky shaders use (see palette() in routes/index.tsx). Bright and
// neutral at noon, warm toward the sun's color near the horizon, dim and
// blue at night.
export type DaylightSample = {
  sun: number[];
  sunDir: THREE.Vector3;
};

const NIGHT_TINT = [0.42, 0.52, 1.0];

export function daylightTint(p: DaylightSample, out: THREE.Color): THREE.Color {
  const elev = p.sunDir.y;
  const bright = THREE.MathUtils.clamp(0.25 + elev * 1.1, 0.25, 1);
  const warmth = THREE.MathUtils.clamp(1 - Math.abs(elev) / 0.35, 0, 1) * 0.7;
  const night = THREE.MathUtils.clamp((0.05 - elev) / 0.25, 0, 1);
  const sunMax = Math.max(p.sun[0], p.sun[1], p.sun[2], 1e-3);
  const rgb = [0, 1, 2].map((i) => {
    const warm = 1 + (p.sun[i] / sunMax - 1) * warmth;
    return (warm + (NIGHT_TINT[i] - warm) * night) * bright;
  });
  return out.setRGB(rgb[0], rgb[1], rgb[2]);
}

// The skybox photo already shows its own time of day (its manifest's
// timeOfDay), so the tint actually applied is the current daylight relative
// to that reference — a "day" skybox at noon stays untouched, the same
// skybox at dusk turns warm and dark. strength 0..1 blends from no tint.
export function relativeDaylightTint(
  current: DaylightSample,
  reference: DaylightSample,
  strength: number,
  out: THREE.Color,
  scratch: THREE.Color,
): THREE.Color {
  daylightTint(current, out);
  daylightTint(reference, scratch);
  const k = THREE.MathUtils.clamp(strength, 0, 1);
  return out.setRGB(
    1 + (THREE.MathUtils.clamp(out.r / scratch.r, 0, 1.6) - 1) * k,
    1 + (THREE.MathUtils.clamp(out.g / scratch.g, 0, 1.6) - 1) * k,
    1 + (THREE.MathUtils.clamp(out.b / scratch.b, 0, 1.6) - 1) * k,
  );
}
