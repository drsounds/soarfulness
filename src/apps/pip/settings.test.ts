import { describe, expect, test } from "bun:test";
import { capFpsForPip, clampPipRatio, pipAspectRatio, pipRatioParts } from "./settings";

describe("pip settings", () => {
  test("aspect ratios", () => {
    expect(pipAspectRatio("16:9", 100, 100)).toBeCloseTo(16 / 9);
    expect(pipAspectRatio("1:1", 100, 200)).toBe(1);
    expect(pipAspectRatio("screen", 1080, 2400)).toBeCloseTo(0.45);
    expect(pipAspectRatio("screen", 0, 0)).toBeCloseTo(9 / 16);
  });
  test("clamps to Android's limits", () => {
    expect(clampPipRatio(0.2)).toBeCloseTo(1 / 2.39);
    expect(clampPipRatio(5)).toBe(2.39);
    expect(clampPipRatio(NaN)).toBeCloseTo(9 / 16);
    expect(pipRatioParts(16 / 9)).toEqual({ width: 1778, height: 1000 });
  });
  test("frame cap", () => {
    expect(capFpsForPip(60, 30)).toBe(30);
    expect(capFpsForPip(0, 30)).toBe(30);
    expect(capFpsForPip(24, 30)).toBe(24);
    expect(capFpsForPip(60, 0)).toBe(60);
  });
});
