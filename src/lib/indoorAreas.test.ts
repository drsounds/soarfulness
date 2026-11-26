import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { collectIndoorAreas, isInsideIndoorArea } from "./indoorAreas";

describe("indoor areas", () => {
  test("finds scaled -indoors markers and hides their helper meshes", () => {
    const root = new THREE.Group();
    const marker = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 6), new THREE.MeshBasicMaterial());
    marker.name = "room-indoors";
    marker.position.set(3, 2, -1);
    marker.scale.set(2, 1, 0.5);
    root.add(marker);
    const prefixedMarker = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial(),
    );
    prefixedMarker.name = "-indoors-boundary";
    prefixedMarker.position.x = 10;
    root.add(prefixedMarker);

    const areas = collectIndoorAreas(root);

    expect(areas).toHaveLength(2);
    expect(areas[0].containsPoint(new THREE.Vector3(3, 2, -1))).toBe(true);
    expect(areas[0].containsPoint(new THREE.Vector3(10, 2, -1))).toBe(false);
    expect(marker.visible).toBe(false);
    expect(prefixedMarker.visible).toBe(false);
  });
});
