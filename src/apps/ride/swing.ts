const degToRad = (degrees: number) => (degrees * Math.PI) / 180;

export function rideSwingAngles(phase: number, angle: number, angle2: number) {
  const first = Number.isFinite(angle) ? Math.max(0, Math.min(180, angle)) : 0;
  const second = Number.isFinite(angle2) ? Math.max(0, Math.min(180, angle2)) : 0;
  return {
    first: degToRad(first) * Math.sin(phase),
    second: degToRad(second) * Math.cos(phase),
  };
}
