import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import {
  EDGE_FILTER_DEFAULT,
  classifyEdge,
  clipSegmentToBox,
  edgeFilterKey,
  filterSegmentsWorld,
  getEdgePositions,
  sanitizeEdgeFilter,
} from "./edgeSelect";

describe("edge direction", () => {
  test("classifies axes and diagonals", () => {
    expect(classifyEdge(3, 0, 0)).toBe("x");
    expect(classifyEdge(0, -2, 0.01)).toBe("y");
    expect(classifyEdge(0.1, 0, 5)).toBe("z");
    expect(classifyEdge(1, 1, 0)).toBe("other");
    expect(classifyEdge(0, 0, 0)).toBe("other");
  });
});

describe("clipping", () => {
  test("clips to the box and drops what's outside", () => {
    const min: [number, number, number] = [0, 0, 0];
    const max: [number, number, number] = [10, 10, 10];
    expect(clipSegmentToBox([-5, 5, 5], [15, 5, 5], min, max)).toEqual([0.25, 0.75]);
    expect(clipSegmentToBox([2, 2, 2], [4, 4, 4], min, max)).toEqual([0, 1]);
    expect(clipSegmentToBox([-5, -5, -5], [-1, -1, -1], min, max)).toBeNull();
    expect(clipSegmentToBox([5, 20, 5], [6, 20, 5], min, max)).toBeNull();
  });
});

describe("filtering a box's edges", () => {
  const geo = new THREE.BoxGeometry(2, 2, 2);
  const local = getEdgePositions(geo)!;
  const m = new THREE.Matrix4();
  test("a box has 12 edges, 4 along each axis", () => {
    expect(local.length / 6).toBe(12);
    for (const axis of ["x", "y", "z"] as const) {
      const f = {
        ...EDGE_FILTER_DEFAULT,
        x: false,
        y: false,
        z: false,
        other: false,
        [axis]: true,
      };
      expect(filterSegmentsWorld(local, m, f).length / 6).toBe(4);
    }
    const none = { ...EDGE_FILTER_DEFAULT, x: false, y: false, z: false, other: false };
    expect(filterSegmentsWorld(local, m, none).length).toBe(0);
  });
  test("a range clips edges to the box", () => {
    const f = {
      ...EDGE_FILTER_DEFAULT,
      rangeOn: true,
      min: [-5, 0, -5] as [number, number, number],
      max: [5, 5, 5] as [number, number, number],
    };
    const w = filterSegmentsWorld(local, m, f);
    for (let i = 1; i < w.length; i += 3) expect(w[i]).toBeGreaterThanOrEqual(-1e-6);
    // The 4 bottom edges (y = -1) are gone, the 4 verticals are halved.
    expect(w.length / 6).toBe(8);
  });
});

describe("sanitizing", () => {
  test("repairs junk and swaps inverted ranges", () => {
    const f = sanitizeEdgeFilter({ x: "no", rangeOn: true, min: [5, "a", 1e9], max: [1, 2, 3] });
    expect(f.x).toBe(true);
    expect(f.min[0]).toBe(1);
    expect(f.max[0]).toBe(5);
    expect(f.max[2]).toBeLessThanOrEqual(5000);
    expect(edgeFilterKey(f)).toContain(":");
  });
});
