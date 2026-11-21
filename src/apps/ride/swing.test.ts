import { describe, expect, test } from "bun:test";
import { rideSwingAngles } from "./swing";

describe("ride swing", () => {
  test("combines a second swing direction a quarter-cycle out of phase", () => {
    const atBottom = rideSwingAngles(0, 60, 30);
    expect(atBottom.first).toBeCloseTo(0);
    expect(atBottom.second).toBeCloseTo(Math.PI / 6);

    const atSide = rideSwingAngles(Math.PI / 2, 60, 30);
    expect(atSide.first).toBeCloseTo(Math.PI / 3);
    expect(atSide.second).toBeCloseTo(0);
  });

  test("clamps each swing angle independently", () => {
    expect(rideSwingAngles(0, 240, -10).second).toBeCloseTo(0);
    expect(rideSwingAngles(Math.PI / 2, 240, 30).first).toBeCloseTo(Math.PI);
  });
});
