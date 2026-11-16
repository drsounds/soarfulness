import { describe, expect, test } from "bun:test";
import {
  bulbLevel,
  catenaryParam,
  paletteIndex,
  sagShape,
  sanitizeStringLightsState,
  stringCurvePoints,
} from "./stringLights";

describe("string light curves", () => {
  test("catenary parameter hits the requested sag", () => {
    const a = catenaryParam(10, 1);
    expect(a * Math.cosh(10 / (2 * a)) - a).toBeCloseTo(1, 4);
  });

  test("every curve sits on the anchors and dips to the full sag mid-span", () => {
    for (const curve of ["catenary", "parabola"] as const) {
      expect(sagShape(curve, 0, 10, 1, 1)).toBeCloseTo(0, 6);
      expect(sagShape(curve, 1, 10, 1, 1)).toBeCloseTo(0, 6);
      expect(sagShape(curve, 0.5, 10, 1, 1)).toBeCloseTo(1, 6);
    }
    expect(sagShape("straight", 0.5, 10, 1, 1)).toBe(0);
  });

  test("festoon returns to the anchor line between drapes", () => {
    expect(sagShape("festoon", 1 / 3, 9, 0.5, 3)).toBeCloseTo(0, 6);
    expect(sagShape("festoon", 1 / 6, 9, 0.5, 3)).toBeCloseTo(1, 6);
  });

  test("points run from anchor A to anchor B", () => {
    const pts = stringCurvePoints(
      { span: 8, heightA: 3, heightB: 4, curve: "catenary", sag: 1, drapes: 1 },
      32,
    );
    expect(pts[0]).toEqual([0, 0, 0]);
    expect(pts[32][0]).toBeCloseTo(8);
    expect(pts[32][1]).toBeCloseTo(1);
    expect(pts[16][1]).toBeCloseTo(0.5 - 1);
  });
});

describe("palette patterns", () => {
  test("repeat, mirror and blocks", () => {
    const seq = (p: Parameters<typeof paletteIndex>[0]) =>
      Array.from({ length: 8 }, (_, i) => paletteIndex(p, i, 8, 3, 2).a);
    expect(seq("repeat")).toEqual([0, 1, 2, 0, 1, 2, 0, 1]);
    expect(seq("mirror")).toEqual([0, 1, 2, 1, 0, 1, 2, 1]);
    expect(seq("blocks")).toEqual([0, 0, 1, 1, 2, 2, 0, 0]);
  });

  test("gradient spans the palette end to end", () => {
    expect(paletteIndex("gradient", 0, 5, 3, 1)).toEqual({ a: 0, b: 1, f: 0 });
    expect(paletteIndex("gradient", 4, 5, 3, 1).a).toBe(2);
  });
});

describe("animation", () => {
  test("levels stay within [1 - depth, 1]", () => {
    for (const anim of ["twinkle", "chase", "fade", "pulse", "alternate"] as const) {
      for (let k = 0; k < 50; k++) {
        const v = bulbLevel(anim, k * 0.137, k % 9, 9, 1.3, 0.6, 1, (k * 0.31) % 1);
        expect(v).toBeGreaterThanOrEqual(0.4 - 1e-9);
        expect(v).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
    expect(bulbLevel("steady", 3, 1, 5, 1, 1, 1, 0.5)).toBe(1);
  });
});

describe("sanitizing", () => {
  test("defaults off and drops junk", () => {
    expect(sanitizeStringLightsState(null).on).toBe(false);
    const s = sanitizeStringLightsState({
      on: true,
      emitters: 99,
      scenes: { a: [{ bulbCount: 1e6, curve: "nope", customColors: ["#fff", "#123456"] }, 5] },
    });
    expect(s.emitters).toBe(8);
    expect(s.scenes.a).toHaveLength(1);
    expect(s.scenes.a[0].bulbCount).toBe(300);
    expect(s.scenes.a[0].curve).toBe("catenary");
    expect(s.scenes.a[0].customColors).toEqual(["#123456"]);
  });
});
