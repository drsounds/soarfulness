import { describe, expect, test } from "bun:test";
import {
  WindField,
  altitudeMix,
  getWindVector,
  hearWind,
  heightFactor,
  makeWind,
  sanitizeWinds,
  steerWaveDir,
  sumWinds,
  windFromBearing,
} from "./wind";
import { windVoice } from "./windSound";

const deg = (r: number) => ((((r * 180) / Math.PI) % 360) + 360) % 360;

describe("winds", () => {
  test("sum of opposite winds cancels, perpendicular winds add", () => {
    const a = { ...makeWind(0, 10), gust: 0 };
    const b = { ...makeWind(180, 10), gust: 0 };
    expect(sumWinds([a, b]).speed).toBeCloseTo(0, 6);
    const c = { ...makeWind(90, 10), gust: 0 };
    const s = sumWinds([a, c]);
    expect(s.speed).toBeCloseTo(Math.SQRT2 * 10, 6);
    expect(s.bearing).toBeCloseTo(45, 6);
    expect(sumWinds([{ ...a, on: false }]).speed).toBe(0);
  });

  test("from-bearing is the opposite side", () => {
    expect(windFromBearing(0)).toBe(180);
    expect(windFromBearing(270)).toBe(90);
  });

  test("sanitize drops junk and clamps", () => {
    const w = sanitizeWinds([{ bearing: -90, speed: 999, gust: 4 }, null, "x"]);
    expect(w.length).toBe(1);
    expect(w[0].bearing).toBe(270);
    expect(w[0].speed).toBe(40);
    expect(w[0].gust).toBe(1);
    expect(w[0].on).toBe(true);
    expect(sanitizeWinds(undefined)).toEqual([]);
  });

  test("wind is stronger higher up", () => {
    expect(heightFactor(10)).toBeCloseTo(1, 6);
    expect(heightFactor(0)).toBeLessThan(0.75);
    expect(heightFactor(1000)).toBeGreaterThan(1.9);
  });

  test("field eases in and publishes the live vector", () => {
    const f = new WindField();
    const winds = [{ ...makeWind(90, 10), gust: 0 }];
    f.update(1 / 60, winds);
    expect(getWindVector().speed).toBeLessThan(1);
    for (let i = 0; i < 600; i++) f.update(1 / 60, winds);
    const v = getWindVector();
    expect(v.speed).toBeCloseTo(10, 1);
    expect(v.bearing).toBeCloseTo(90, 1);
    // Current drifts downwind (+x), ~3.5 % of the wind.
    let x = 0;
    for (let i = 0; i < 600; i++) x += f.current(1 / 60, true, 1).dx;
    expect(x).toBeGreaterThan(2);
    expect(x).toBeLessThan(3.6);
    f.reset();
    expect(getWindVector().speed).toBe(0);
  });

  test("waves steer toward the wind", () => {
    const wind = { x: 10, z: 0, speed: 10, bearing: 90, gust: 0 };
    expect(deg(steerWaveDir(0, wind, 1))).toBeCloseTo(90, 3);
    expect(deg(steerWaveDir(0, wind, 0))).toBeCloseTo(0, 6);
    const half = deg(steerWaveDir(0, wind, 0.5));
    expect(half).toBeGreaterThan(30);
    expect(half).toBeLessThan(60);
    // Stays on the same branch as the input (no 2π jumps).
    expect(
      Math.abs(
        steerWaveDir(350, { ...wind, bearing: 10, x: 1.7, z: 9.8 }, 1) - (350 * Math.PI) / 180,
      ),
    ).toBeLessThan(0.5);
  });
});

describe("wind sound", () => {
  const fwd = { x: 0, z: 1 };
  test("running into the wind is louder than running with it", () => {
    const wind = { x: 0, z: -8 }; // blows toward -z, i.e. into a +z-facing face
    const into = hearWind(wind, { x: 0, z: 5 }, fwd, 0);
    const withIt = hearWind(wind, { x: 0, z: -5 }, fwd, 0);
    expect(into.apparent).toBeCloseTo(13, 6);
    expect(withIt.apparent).toBeCloseTo(3, 6);
    expect(into.facing).toBeCloseTo(1, 6);
    expect(windVoice(into.apparent, into.facing).gain).toBeGreaterThan(
      windVoice(withIt.apparent, withIt.facing).gain * 4,
    );
  });

  test("a side wind pans to that ear and pitch rises with speed", () => {
    // padToWorldXZ's basis: forward (0, 1) has right (-1, 0). A wind blowing
    // toward +x comes from -x, the right ear.
    const fromRight = hearWind({ x: 8, z: 0 }, { x: 0, z: 0 }, fwd, 0);
    expect(fromRight.pan).toBeCloseTo(1, 6);
    expect(windVoice(20, 0).rushHz).toBeGreaterThan(windVoice(5, 0).rushHz);
  });

  test("altitude: water fades, surface noise peaks low, breeze grows", () => {
    expect(altitudeMix(-2)).toEqual({ water: 1, surface: 0, breeze: 0 });
    expect(altitudeMix(0.5).water).toBe(1);
    expect(altitudeMix(5).surface).toBeGreaterThan(0.9);
    expect(altitudeMix(50).water).toBe(0);
    expect(altitudeMix(300).surface).toBe(0);
    expect(altitudeMix(1000).breeze).toBeGreaterThan(altitudeMix(100).breeze);
  });
});
