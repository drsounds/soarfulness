import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { HoodMesh3D } from "./HoodMesh";

describe("3D hood mesh", () => {
  test("uses enough subdivisions to preserve fine cloth padding", () => {
    const scene = new THREE.Scene();
    const hood = new HoodMesh3D(scene, 0);
    const clothMeshes: THREE.Mesh[] = [];

    scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.geometry.index?.count) {
        clothMeshes.push(object);
      }
    });

    expect(clothMeshes).toHaveLength(2);
    for (const mesh of clothMeshes) {
      expect(mesh.geometry.getAttribute("position").count).toBe(55_825);
      expect(mesh.geometry.index?.count).toBe(331_776);
    }

    hood.dispose();
  });
});
