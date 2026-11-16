import { describe, expect, test } from "bun:test";
import { OpenDrift, smoothNoise, type OpenDriftParams } from "./OpenDrift";

const base: OpenDriftParams = {
  on: true,
  curve: "circle",
  radius: 10,
  cycleSpeed: 1,
  magnitude: 1,
  direction: "cw",
};

function run(d: OpenDrift, p: OpenDriftParams, seconds: number, dt = 1 / 60) {
  let x = 0,
    z = 0;
  const path: { x: number; z: number }[] = [];
  for (let t = 0; t < seconds; t += dt) {
    const s = d.step(dt, p);
    x += s.dx;
    z += s.dz;
    path.push({ x, z });
  }
  return path;
}

describe("OpenDrift", () => {
  test("stays still while off", () => {
    const d = new OpenDrift(1, 0);
    const path = run(d, { ...base, on: false }, 30);
    expect(path.at(-1)).toEqual({ x: 0, z: 0 });
    expect(d.active).toBe(false);
  });

  test("circle settles to the configured radius and speed", () => {
    const d = new OpenDrift(1, 0);
    run(d, base, 40); // fade in fully
    // One lap per minute at r = 10 m → 2π·10/60 m/s.
    expect(d.speed).toBeCloseTo((2 * Math.PI * 10) / 60, 2);
    const lap = run(d, base, 60);
    const cx = lap.reduce((a, p) => a + p.x, 0) / lap.length;
    const cz = lap.reduce((a, p) => a + p.z, 0) / lap.length;
    for (const p of lap.filter((_, i) => i % 300 === 0)) {
      expect(Math.hypot(p.x - cx, p.z - cz)).toBeCloseTo(10, 0);
    }
    // A full lap returns (nearly) to where it began.
    expect(Math.hypot(lap.at(-1)!.x - lap[0].x, lap.at(-1)!.z - lap[0].z)).toBeLessThan(0.3);
  });

  test("STYRKA scales the circle", () => {
    const d = new OpenDrift(1, 0);
    run(d, { ...base, magnitude: 2 }, 40);
    expect(d.speed).toBeCloseTo((2 * Math.PI * 20) / 60, 2);
  });

  test("wander keeps going: it travels far and its heading changes", () => {
    const d = new OpenDrift(7, 0);
    const p = { ...base, curve: "wander" as const, cycleSpeed: 2 };
    const path = run(d, p, 600, 1 / 30);
    const end = path.at(-1)!;
    expect(Math.hypot(end.x, end.z)).toBeGreaterThan(20);
    const headings = new Set(
      path
        .filter((_, i) => i % 600 === 0)
        .map((q, i, a) => {
          const prev = a[i - 1] ?? { x: 0, z: 0 };
          return Math.round(Math.atan2(q.x - prev.x, q.z - prev.z));
        }),
    );
    expect(headings.size).toBeGreaterThan(1);
  });

  test("velocity changes smoothly when the curve switches", () => {
    const d = new OpenDrift(3, 0);
    run(d, base, 40);
    const before = { ...d.vel };
    d.step(1 / 60, { ...base, curve: "wander" });
    expect(Math.hypot(d.vel.x - before.x, d.vel.z - before.z)).toBeLessThan(0.05);
  });

  test("smoothNoise stays in [-1, 1] and is continuous", () => {
    let prev = smoothNoise(0, 5);
    for (let x = 0.01; x < 50; x += 0.01) {
      const v = smoothNoise(x, 5);
      expect(Math.abs(v)).toBeLessThanOrEqual(1);
      expect(Math.abs(v - prev)).toBeLessThan(0.05);
      prev = v;
    }
  });
});
