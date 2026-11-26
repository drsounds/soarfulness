import { describe, expect, test } from "bun:test";
import { RoamingMotion, STALE_AFTER, targetFor, type RoamingParams } from "./RoamingMotion";
import { parseRoamingMotion } from "./roamingBridge";

const p: RoamingParams = { on: true, maxSpeed: 2, accel: 0.8, glide: 2.5, sideways: true };
const DT = 1 / 60;

function run(m: RoamingMotion, seconds: number, params = p) {
  for (let t = 0; t < seconds; t += DT) m.step(DT, params);
}

describe("targetFor", () => {
  test("walking and running go forward, scaled by intensity", () => {
    expect(
      targetFor({ motionType: "running", direction: "forward", intensity: 0.8 }, true),
    ).toEqual({
      x: 0,
      z: 0.8,
    });
    expect(targetFor({ motionType: "walking", direction: "none", intensity: 0.5 }, true).z).toBe(
      0.5,
    );
    expect(targetFor({ motionType: "step", direction: "backward", intensity: 0.4 }, true).z).toBe(
      -0.4,
    );
  });
  test("leaning moves sideways only when allowed", () => {
    expect(
      targetFor({ motionType: "leaning", direction: "left", intensity: 1 }, true).x,
    ).toBeLessThan(0);
    expect(targetFor({ motionType: "leaning", direction: "left", intensity: 1 }, false)).toEqual({
      x: 0,
      z: 0,
    });
  });
  test("idle, jumping, squatting and arms raised don't travel", () => {
    for (const motionType of ["idle", "jumping", "squatting", "arms_raised"] as const)
      expect(targetFor({ motionType, direction: "up", intensity: 1 }, true)).toEqual({
        x: 0,
        z: 0,
      });
  });
});

describe("RoamingMotion", () => {
  test("accelerates toward intensity × top speed, harder for a bigger ask", () => {
    const walk = new RoamingMotion();
    const run2 = new RoamingMotion();
    walk.push({ motionType: "walking", direction: "forward", intensity: 0.4 }, true);
    run2.push({ motionType: "running", direction: "forward", intensity: 0.9 }, true);
    walk.step(DT, p);
    run2.step(DT, p);
    expect(run2.vel.z).toBeGreaterThan(walk.vel.z);
    // Keep the events coming (one per step), then it settles at the target.
    for (let i = 0; i < 10; i++) {
      run2.push({ motionType: "running", direction: "forward", intensity: 0.9 }, true);
      run(run2, 0.5);
    }
    expect(run2.vel.z).toBeCloseTo(1.8, 2);
  });

  test("slowing down glides: gentler than speeding up, and eases out", () => {
    const m = new RoamingMotion();
    m.push({ motionType: "running", direction: "forward", intensity: 1 }, true);
    run(m, 1);
    const upAfter1s = m.vel.z;
    for (let i = 0; i < 10; i++) {
      m.push({ motionType: "running", direction: "forward", intensity: 1 }, true);
      run(m, 0.5);
    }
    const top = m.vel.z;
    m.push({ motionType: "idle", direction: "none", intensity: 0 }, true);
    run(m, 1);
    const lostIn1s = top - m.vel.z;
    expect(lostIn1s).toBeLessThan(upAfter1s);
    // Deceleration itself eases off: less lost in the 2nd second than the 1st.
    const v1 = m.vel.z;
    run(m, 1);
    expect(v1 - m.vel.z).toBeLessThan(lostIn1s);
    run(m, 30);
    expect(m.vel.z).toBe(0);
    expect(m.active).toBe(false);
  });

  test("stops chasing a stale event", () => {
    const m = new RoamingMotion();
    m.push({ motionType: "walking", direction: "forward", intensity: 1 }, true);
    run(m, STALE_AFTER + 0.1);
    expect(m.target.z).toBe(0);
  });

  test("off: no push", () => {
    const m = new RoamingMotion();
    m.push({ motionType: "running", direction: "forward", intensity: 1 }, true);
    m.step(DT, { ...p, on: false });
    expect(m.vel.z).toBe(0);
  });
});

describe("parseRoamingMotion", () => {
  test("normalizes Roaming's flat extras", () => {
    expect(
      parseRoamingMotion({ motion_type: "running", direction: "forward", intensity: 1.4 }),
    ).toEqual({ motionType: "running", direction: "forward", intensity: 1, source: undefined });
    expect(parseRoamingMotion({ motion_type: "flying", intensity: "x" })).toEqual({
      motionType: "idle",
      direction: "none",
      intensity: 0,
      source: undefined,
    });
  });
});
