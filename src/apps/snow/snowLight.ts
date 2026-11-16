import * as THREE from "three";

// The light snow is seen in: white by day, a dim moonlit blue at night.
const NIGHT_SNOW_LIGHT = new THREE.Color(0.17, 0.21, 0.32);
const DAY_SNOW_LIGHT = new THREE.Color(1, 1, 1);
export function snowLightColor(daylight: number, out = new THREE.Color()): THREE.Color {
  const d = Math.min(1, Math.max(0, daylight));
  return out.copy(NIGHT_SNOW_LIGHT).lerp(DAY_SNOW_LIGHT, d);
}
