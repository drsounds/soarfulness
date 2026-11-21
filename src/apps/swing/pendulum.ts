const degToRad = (degrees: number) => (degrees * Math.PI) / 180;

function boundedAngle(angle: number): number {
  return Number.isFinite(angle) ? Math.max(0, Math.min(180, angle)) : 0;
}

function scaledAngle(angle: number, intensity: number): number {
  const scale = Number.isFinite(intensity) ? Math.max(0, intensity) : 0;
  return degToRad(Math.min(180, boundedAngle(angle) * scale));
}

export function swingPendulumAngles(
  phase: number,
  forwardAngle: number,
  backwardAngle: number,
  leftAngle: number,
  rightAngle: number,
  intensity = 1,
) {
  const forwardMotion = Math.sin(phase);
  const sideMotion = Math.cos(phase);
  const forwardMagnitude =
    Math.abs(forwardMotion) *
    scaledAngle(forwardMotion >= 0 ? forwardAngle : backwardAngle, intensity);
  const sideMagnitude =
    Math.abs(sideMotion) * scaledAngle(sideMotion >= 0 ? rightAngle : leftAngle, intensity);
  return {
    forward: forwardMotion < 0 ? -forwardMagnitude : forwardMagnitude,
    right: sideMotion < 0 ? -sideMagnitude : sideMagnitude,
  };
}
