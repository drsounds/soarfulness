// HAVSDRIFT (open-water drift): an optional, endless horizontal drift that
// keeps carrying the player around the way a real swimmer or boat is moved
// by open water, even with every stick at rest. It's a velocity (m/s, world
// x/z), not a position offset, so it never pulls back toward where it
// started: the world's own wrap (VÄRLDSGRÄNS) and the camera-centred
// ocean/floor/cloud planes make the trip feel endless in any direction.
//
//  - "circle": the heading turns at a steady rate, so the path is a circle of
//    openDriftRadius meters, one lap per cycle (openDriftCycleSpeed laps/min),
//    clockwise or counter-clockwise.
//  - "wander": the heading wanders smoothly at random (smooth value noise in
//    the turn rate, never a jitter), about one change of course per cycle,
//    and the speed breathes a little so it never feels mechanical.
//
// STYRKA (openDriftMagnitude) scales the drift speed in both: in "circle" at
// a fixed lap time that grows the circle (radius × STYRKA), in "wander" it's
// the speed itself (WANDER_BASE_SPEED × STYRKA). Toggling, switching curve or
// moving a slider never jumps: the on/off blend and the velocity itself are
// both eased.

export type OpenDriftCurve = "circle" | "wander";
export const OPEN_DRIFT_CURVES: OpenDriftCurve[] = ["circle", "wander"];
export type OpenDriftDirection = "cw" | "ccw";
export const OPEN_DRIFT_DIRECTIONS: OpenDriftDirection[] = ["cw", "ccw"];

/** Wander speed at STYRKA 100 % (m/s): a slow, realistic open-water drift. */
export const WANDER_BASE_SPEED = 0.6;
/** Seconds for the drift to fade in/out when HAVSDRIFT is toggled. */
const BLEND_TAU = 2.5;
/** Seconds for the velocity to settle after a setting changes. */
const VEL_TAU = 1.2;

export type OpenDriftParams = {
  on: boolean;
  curve: OpenDriftCurve;
  /** Circle radius in meters (at STYRKA 100 %). */
  radius: number;
  /** Laps per minute ("circle") or changes of course per minute ("wander"). */
  cycleSpeed: number;
  /** Drift strength multiplier, 1 = 100 %. */
  magnitude: number;
  direction: OpenDriftDirection;
};

/** Deterministic hash → [-1, 1] for integer knot i of noise channel `seed`. */
function knot(i: number, seed: number): number {
  const s = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453123;
  return (s - Math.floor(s)) * 2 - 1;
}

/** Smooth 1D value noise in [-1, 1] (smootherstep between hashed knots). */
export function smoothNoise(x: number, seed: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * f * (f * (f * 6 - 15) + 10);
  return knot(i, seed) * (1 - u) + knot(i + 1, seed) * u;
}

export class OpenDrift {
  /** Current drift velocity, world m/s. */
  readonly vel = { x: 0, z: 0 };
  /** 0..1: how far HAVSDRIFT has faded in. */
  blend = 0;
  /** Heading (radians, world: x = sin, z = cos). */
  heading: number;
  /** Current (eased) drift speed, m/s. */
  speed = 0;
  /** Noise clock, in cycles. */
  private phase = 0;
  private readonly seed: number;

  constructor(seed = Math.random() * 1000, heading = Math.random() * Math.PI * 2) {
    this.seed = seed;
    this.heading = heading;
  }

  /** True while the drift is (still) moving the player at all. */
  get active(): boolean {
    return this.blend > 1e-4 || this.speed > 1e-4;
  }

  /**
   * Advance by dt seconds and return the displacement (meters, world x/z) to
   * add to the player's position this frame.
   */
  step(dt: number, p: OpenDriftParams): { dx: number; dz: number } {
    if (!(dt > 0)) return { dx: 0, dz: 0 };
    dt = Math.min(dt, 0.25);
    this.blend += ((p.on ? 1 : 0) - this.blend) * (1 - Math.exp(-dt / BLEND_TAU));
    if (!p.on && this.blend < 1e-4) {
      this.blend = 0;
    }

    const cyclesPerSec = Math.max(0, p.cycleSpeed) / 60;
    const mag = Math.max(0, p.magnitude);
    let speed: number;
    if (p.curve === "circle") {
      const dir = p.direction === "ccw" ? 1 : -1;
      const omega = 2 * Math.PI * cyclesPerSec;
      this.heading += dir * omega * dt;
      speed = omega * Math.max(0, p.radius) * mag;
    } else {
      this.phase += cyclesPerSec * dt;
      // Turn rate peaks at about half a turn per cycle, so each "change of
      // course" swings the heading by up to roughly ±90°.
      const turn = smoothNoise(this.phase, this.seed) * Math.PI * cyclesPerSec;
      this.heading += turn * dt;
      speed = WANDER_BASE_SPEED * mag * (1 + 0.3 * smoothNoise(this.phase * 0.7, this.seed + 17));
    }
    this.heading %= Math.PI * 2;

    // Ease the speed (not the velocity vector) so the heading stays exact and
    // a circle keeps its true radius even at high lap rates; the heading
    // itself is continuous, so switching curve never snaps the direction.
    const k = 1 - Math.exp(-dt / VEL_TAU);
    this.speed += (speed * this.blend - this.speed) * k;
    if (!p.on && this.blend === 0 && this.speed < 1e-4) this.speed = 0;
    this.vel.x = Math.sin(this.heading) * this.speed;
    this.vel.z = Math.cos(this.heading) * this.speed;
    return { dx: this.vel.x * dt, dz: this.vel.z * dt };
  }
}
