// ROAMING: turns the motion events of the Roaming Android app
// (drsounds/roaming-android-app, broadcast se.spacify.app.roaming.event.MOTION)
// into a smooth, camera-relative swimming velocity.
//
// Each event sets a *target* velocity: the event's direction (from the
// user's point of view: forward/backward/left/right) times its intensity
// (0..1) times the top speed. The actual velocity then chases that target:
//
//  - speeding up, it closes the gap with time constant `accel`, so the
//    acceleration is proportional to how much faster the motion asks you to
//    go: break into a run and you surge, walk on and you settle at speed;
//  - slowing down, it uses the longer `glide` time constant, so when the
//    motion eases off the deceleration starts gentle and keeps easing out,
//    like gliding through water, instead of stopping dead.
//
// Roaming sends an event whenever the motion type or direction changes, when
// the intensity changes noticeably and once per detected step. Steady walking
// therefore produces an event every step; if none arrives for STALE_AFTER
// seconds (tracking stopped, phone put down, broadcast missed) the target
// falls back to zero as if an `idle` event had arrived.

export type RoamingMotionType =
  | "idle"
  | "step"
  | "walking"
  | "running"
  | "jumping"
  | "squatting"
  | "leaning"
  | "arms_raised"
  /** Camera gesture: one arm up / out left / out right, or both hands down. */
  | "raising";

export type RoamingDirection = "none" | "forward" | "backward" | "left" | "right" | "up" | "down";

/** One `se.spacify.app.roaming.event.MOTION` broadcast, normalized. */
export type RoamingMotionEvent = {
  motionType: RoamingMotionType;
  direction: RoamingDirection;
  /** 0..1 */
  intensity: number;
  /** "step_sensor" | "camera" (informational). */
  source?: string;
};

/**
 * Speed per gait, as a share of top speed at full intensity (ROAMING →
 * WALK / RUN / SIDESTEP SPEED).
 */
export type RoamingSpeeds = {
  /** step and walking */
  walk: number;
  running: number;
  /** leaning sideways */
  lean: number;
};

export type RoamingParams = {
  on: boolean;
  /** Top speed (m/s) at intensity 1. */
  maxSpeed: number;
  /** Seconds, speeding up. */
  accel: number;
  /** Seconds, slowing down. */
  glide: number;
  sideways: boolean;
};

/** Seconds without any event before the target drops to zero. */
export const STALE_AFTER = 2.5;
/** Leaning is a gentler input than walking: default share of top speed sideways. */
export const LEAN_SHARE = 0.5;

export const DEFAULT_ROAMING_SPEEDS: RoamingSpeeds = { walk: 1, running: 1, lean: LEAN_SHARE };

const clamp01 = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
const nonNeg = (v: number) => (Number.isFinite(v) ? Math.max(0, v) : 0);

const MOVING: ReadonlySet<RoamingMotionType> = new Set(["step", "walking", "running"]);

/**
 * Target velocity, body frame (x = right, z = forward), as a share of top
 * speed, for one event.
 */
export function targetFor(
  e: RoamingMotionEvent,
  sideways: boolean,
  speeds: RoamingSpeeds = DEFAULT_ROAMING_SPEEDS,
): { x: number; z: number } {
  const intensity = clamp01(e.intensity);
  if (MOVING.has(e.motionType)) {
    const i = intensity * nonNeg(e.motionType === "running" ? speeds.running : speeds.walk);
    switch (e.direction) {
      case "backward":
        return { x: 0, z: -i };
      case "left":
        return sideways ? { x: -i, z: 0 } : { x: 0, z: i };
      case "right":
        return sideways ? { x: i, z: 0 } : { x: 0, z: i };
      default:
        // forward, none, up, down: walking/running in place means forward.
        return { x: 0, z: i };
    }
  }
  if (e.motionType === "leaning" && sideways) {
    const i = intensity * nonNeg(speeds.lean);
    if (e.direction === "left") return { x: -i, z: 0 };
    if (e.direction === "right") return { x: i, z: 0 };
  }
  // idle, jumping, squatting, arms_raised, raising: no travel of their own.
  return { x: 0, z: 0 };
}

/**
 * Target for a motion that the gesture map sends to a fixed direction
 * (moveForward / moveBack / moveLeft / moveRight): that way, at the motion's
 * intensity times the walk speed (the run speed while running).
 */
export function targetToward(
  e: RoamingMotionEvent,
  dir: "forward" | "back" | "left" | "right",
  speeds: RoamingSpeeds = DEFAULT_ROAMING_SPEEDS,
): { x: number; z: number } {
  const i =
    clamp01(e.intensity) * nonNeg(e.motionType === "running" ? speeds.running : speeds.walk);
  if (dir === "forward") return { x: 0, z: i };
  if (dir === "back") return { x: 0, z: -i };
  return { x: dir === "left" ? -i : i, z: 0 };
}

export class RoamingMotion {
  /** Current velocity, body frame, m/s (x = right, z = forward). */
  readonly vel = { x: 0, z: 0 };
  /** Target, body frame, as a share of top speed. */
  readonly target = { x: 0, z: 0 };
  /** Seconds since the last event (Infinity before the first one). */
  sinceEvent = Infinity;
  last: RoamingMotionEvent | null = null;

  /** True while the motion is (still) moving the player at all. */
  get active(): boolean {
    return Math.hypot(this.vel.x, this.vel.z) > 1e-4 || this.target.x !== 0 || this.target.z !== 0;
  }

  get speed(): number {
    return Math.hypot(this.vel.x, this.vel.z);
  }

  /**
   * Feed one broadcast. `target` overrides the default (targetFor), for a
   * motion the gesture map sends somewhere else.
   */
  push(e: RoamingMotionEvent, sideways: boolean, target?: { x: number; z: number }) {
    const t = target ?? targetFor(e, sideways);
    this.target.x = t.x;
    this.target.z = t.z;
    this.last = e;
    this.sinceEvent = 0;
  }

  reset() {
    this.vel.x = this.vel.z = 0;
    this.target.x = this.target.z = 0;
    this.sinceEvent = Infinity;
    this.last = null;
  }

  /**
   * Advance by dt seconds and return this step's displacement in the body
   * frame (meters, x = right, z = forward).
   */
  step(dt: number, p: RoamingParams): { dx: number; dz: number } {
    if (!(dt > 0)) return { dx: 0, dz: 0 };
    dt = Math.min(dt, 0.25);
    this.sinceEvent += dt;
    if (this.sinceEvent > STALE_AFTER) this.target.x = this.target.z = 0;

    const max = p.on ? Math.max(0, p.maxSpeed) : 0;
    const tx = this.target.x * max;
    const tz = this.target.z * max;
    const speedingUp = Math.hypot(tx, tz) > this.speed + 1e-6;
    const tau = Math.max(0.05, speedingUp ? p.accel : p.glide);
    const k = 1 - Math.exp(-dt / tau);
    this.vel.x += (tx - this.vel.x) * k;
    this.vel.z += (tz - this.vel.z) * k;
    if (tx === 0 && tz === 0 && this.speed < 1e-3) this.vel.x = this.vel.z = 0;
    return { dx: this.vel.x * dt, dz: this.vel.z * dt };
  }
}
