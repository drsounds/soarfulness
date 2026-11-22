export function lookSpinDeltas(
  stick: { x: number; y: number },
  speed: number,
  dt: number,
): { yaw: number; pitch: number } {
  return { yaw: -stick.x * speed * dt, pitch: 0 };
}
