import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import type { FrameContext } from "@/core/apps/types";
import { TorusRingsRuntime } from "./TorusRingsRuntime";
import { TORUS_RINGS_DEFAULTS } from "./settings";

const frameAt = (camera: THREE.PerspectiveCamera, dt: number) => ({ camera, dt }) as FrameContext;

describe("TorusRingsRuntime", () => {
  test("is empty while off, fills in around the camera when on, empties again when off", () => {
    const scene = new THREE.Scene();
    const rt = new TorusRingsRuntime({ scene });
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(5, 1, -3);

    rt.configure(TORUS_RINGS_DEFAULTS, false);
    rt.frame(frameAt(camera, 0.1));
    expect(scene.children.length).toBe(0);

    rt.configure({ ...TORUS_RINGS_DEFAULTS, torusRingsOn: true }, false);
    for (let i = 0; i < 20; i++) rt.frame(frameAt(camera, 0.1));
    expect(scene.children.length).toBeGreaterThan(0);

    // LOW GRAPHICS MODE switches the whole field off.
    rt.configure({ ...TORUS_RINGS_DEFAULTS, torusRingsOn: true }, true);
    for (let i = 0; i < 40; i++) rt.frame(frameAt(camera, 0.1));
    expect(scene.children.length).toBe(0);
    rt.dispose();
  });

  test("dispose removes every ring from the scene", () => {
    const scene = new THREE.Scene();
    const rt = new TorusRingsRuntime({ scene });
    const camera = new THREE.PerspectiveCamera();
    rt.configure({ ...TORUS_RINGS_DEFAULTS, torusRingsOn: true }, false);
    for (let i = 0; i < 10; i++) rt.frame(frameAt(camera, 0.1));
    rt.dispose();
    expect(scene.children.length).toBe(0);
  });
});
