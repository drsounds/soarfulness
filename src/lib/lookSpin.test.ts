import { describe, expect, test } from "bun:test";
import { lookSpinDeltas } from "./lookSpin";

describe("look spin", () => {
  test("rotates horizontally and ignores vertical stick input", () => {
    expect(lookSpinDeltas({ x: 0.5, y: 1 }, 1.6, 0.25)).toEqual({
      yaw: -0.2,
      pitch: 0,
    });
  });
});
