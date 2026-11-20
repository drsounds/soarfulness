import { describe, expect, test } from "bun:test";
import { HOOD_LAYER_DEFAULTS, patchHoodLayers, sanitizeHoodLayer } from "./hoodLayers";

describe("hood layers", () => {
  test("sanitizes hood weight across its signed range", () => {
    expect(sanitizeHoodLayer({ weight: -0.75 }).weight).toBe(-0.75);
    expect(sanitizeHoodLayer({ weight: -2 }).weight).toBe(-1);
    expect(sanitizeHoodLayer({ weight: 2 }).weight).toBe(1);
  });

  test("patches the same setting onto every layer without mutating them", () => {
    const layers = [
      { ...HOOD_LAYER_DEFAULTS, weight: -0.5 },
      { ...HOOD_LAYER_DEFAULTS, weight: 0.8, color: "#123456" },
    ];
    const patched = patchHoodLayers(layers, { weight: -0.25 });

    expect(patched.map((layer) => layer.weight)).toEqual([-0.25, -0.25]);
    expect(patched[1].color).toBe("#123456");
    expect(layers.map((layer) => layer.weight)).toEqual([-0.5, 0.8]);
  });
});
