import { describe, expect, test } from "bun:test";
import { swingPendulumAngles } from "./pendulum";

describe("regular swing pendulum angles", () => {
  test("uses each directional angle at its own end of the swing", () => {
    const forward = swingPendulumAngles(Math.PI / 2, 40, 20, 10, 30);
    expect(forward.forward).toBeCloseTo((40 * Math.PI) / 180);
    expect(forward.right).toBeCloseTo(0);

    const backward = swingPendulumAngles((3 * Math.PI) / 2, 40, 20, 10, 30);
    expect(backward.forward).toBeCloseTo((-20 * Math.PI) / 180);
    expect(backward.right).toBeCloseTo(0);
  });

  test("swings right and left with independent angles", () => {
    const right = swingPendulumAngles(0, 40, 20, 10, 30);
    expect(right.right).toBeCloseTo((30 * Math.PI) / 180);

    const left = swingPendulumAngles(Math.PI, 40, 20, 10, 30);
    expect(left.right).toBeCloseTo((-10 * Math.PI) / 180);
  });

  test("clamps angles and treats non-finite angles as zero", () => {
    expect(swingPendulumAngles(Math.PI / 2, 240, 20, 10, 30).forward).toBeCloseTo(Math.PI);
    expect(swingPendulumAngles(Math.PI / 2, Number.NaN, 20, 10, 30).forward).toBeCloseTo(0);
  });

  test("scales every directional angle with swing intensity", () => {
    expect(swingPendulumAngles(Math.PI / 2, 40, 20, 10, 30, 0.5).forward).toBeCloseTo(
      (20 * Math.PI) / 180,
    );
    expect(swingPendulumAngles(Math.PI / 2, 40, 20, 10, 30, 0).forward).toBeCloseTo(0);
  });
});
