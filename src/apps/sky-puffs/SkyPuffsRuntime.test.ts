import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { SkyPuffsRuntime } from "./SkyPuffsRuntime";
import { SKY_PUFFS_DEFAULTS } from "./settings";

const frame = (dt: number, lowEnd = false) => ({ dt, camX: 10, camZ: -20, lowEnd });

describe("SkyPuffsRuntime", () => {
  test("adds its pool to the scene and removes it on dispose", () => {
    const scene = new THREE.Scene();
    const rt = new SkyPuffsRuntime({ scene });
    expect(scene.children.length).toBe(20);
    rt.dispose();
    expect(scene.children.length).toBe(0);
  });

  test("shows only skyPuffsCount puffs, and none when off or on low-end", () => {
    const scene = new THREE.Scene();
    const rt = new SkyPuffsRuntime({ scene });
    rt.scatterAround(0, 0);
    const on = { ...SKY_PUFFS_DEFAULTS, skyPuffsOn: true, skyPuffsCount: 5, skyPuffsFreq: 1 };
    // Step through a few cycles so every active puff passes its fade peak.
    let maxVisible = 0;
    for (let i = 0; i < 200; i++) {
      rt.update(frame(0.5), on);
      maxVisible = Math.max(maxVisible, scene.children.filter((c) => c.visible).length);
    }
    expect(maxVisible).toBeGreaterThan(0);
    expect(maxVisible).toBeLessThanOrEqual(5);
    rt.update(frame(0.5), SKY_PUFFS_DEFAULTS);
    expect(scene.children.some((c) => c.visible)).toBe(false);
    rt.update(frame(0.5, true), on);
    expect(scene.children.some((c) => c.visible)).toBe(false);
    rt.dispose();
  });

  test("a puff respawns around the camera once its cycle ends", () => {
    const scene = new THREE.Scene();
    const rt = new SkyPuffsRuntime({ scene });
    const on = { ...SKY_PUFFS_DEFAULTS, skyPuffsOn: true, skyPuffsCount: 1, skyPuffsFreq: 1 };
    for (let i = 0; i < 400; i++) rt.update(frame(0.5), on);
    const puff = scene.children[0];
    const dx = puff.position.x - 10;
    const dz = puff.position.z + 20;
    const dist = Math.hypot(dx, dz);
    expect(dist).toBeGreaterThanOrEqual(700 - 1e-6);
    expect(dist).toBeLessThanOrEqual(2500 + 1e-6);
    rt.dispose();
  });
});
