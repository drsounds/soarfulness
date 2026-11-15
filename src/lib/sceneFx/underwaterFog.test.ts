import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import {
  underwaterFogGradient,
  waterlineScreenFraction,
  type UnderwaterFogParams,
} from "./underwaterFog";

const params: UnderwaterFogParams = {
  fogColor: "#ffffff",
  fogOpacity: 0.5,
  waterColor: [0, 0, 0],
  waterOpacity: 1,
  intensity: 1,
  spread: 1,
  curve: 1,
  feather: 0,
  visibility: 1,
};

function cam(y: number, pitch = 0) {
  const c = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 1000);
  c.position.set(0, y, 0);
  c.lookAt(0, y, -10);
  c.rotateX(pitch);
  c.updateMatrixWorld();
  return c;
}

describe("waterlineScreenFraction", () => {
  test("level camera at the surface puts the waterline mid-screen", () => {
    expect(waterlineScreenFraction(cam(0), 0, 30)).toBeCloseTo(0.5, 5);
  });

  test("rising above the water moves it lower, diving moves it higher", () => {
    const at = waterlineScreenFraction(cam(0), 0, 30);
    const above = waterlineScreenFraction(cam(2), 0, 30);
    const higherStill = waterlineScreenFraction(cam(6), 0, 30);
    const below = waterlineScreenFraction(cam(-2), 0, 30);
    expect(above).toBeGreaterThan(at);
    expect(higherStill).toBeGreaterThan(above);
    expect(below).toBeLessThan(at);
  });

  test("a shorter distance reacts more strongly to height", () => {
    const near = waterlineScreenFraction(cam(1), 0, 5);
    const far = waterlineScreenFraction(cam(1), 0, 100);
    expect(near).toBeGreaterThan(far);
  });

  test("looking up moves the waterline down the screen", () => {
    expect(waterlineScreenFraction(cam(0, 0.3), 0, 30)).toBeGreaterThan(0.5);
  });

  test("stays finite looking straight down", () => {
    const f = waterlineScreenFraction(cam(3, -Math.PI / 2), 0, 30);
    expect(Number.isFinite(f)).toBe(true);
  });
});

describe("underwaterFogGradient", () => {
  test("starts transparent at the top edge and ends in the water color", () => {
    const g = underwaterFogGradient(0.4, params);
    expect(g.startsWith("linear-gradient(to bottom,")).toBe(true);
    expect(g).toContain("rgba(255,255,255,0.000) 40.00%");
    expect(g).toContain("rgba(255,255,255,0.500) 40.00%");
    expect(g).toContain("rgba(0,0,0,1.000) 100.00%");
  });

  test("intensity, visibility and an off-screen edge hide it", () => {
    expect(underwaterFogGradient(0.4, { ...params, intensity: 0 })).toBe("none");
    expect(underwaterFogGradient(0.4, { ...params, visibility: 0 })).toBe("none");
    expect(underwaterFogGradient(1.2, params)).toBe("none");
  });

  test("spread shortens the fade", () => {
    const g = underwaterFogGradient(0, { ...params, spread: 0.5 });
    expect(g).toContain("rgba(0,0,0,1.000) 50.00%");
  });
});
