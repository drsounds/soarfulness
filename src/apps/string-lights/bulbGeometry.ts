import * as THREE from "three";
import type { StringLightBulb } from "./stringLights";

// Bulb meshes (unit-sized, centered on the origin) shared by hanging strings
// and the edge lights.

function starGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 0.5 : 0.22;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.18,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.03,
    bevelSegments: 1,
  });
  geo.center();
  return geo;
}

export function bulbGeometry(style: StringLightBulb): THREE.BufferGeometry {
  switch (style) {
    case "fairy":
      return new THREE.SphereGeometry(0.5, 8, 6);
    case "c9": {
      // Strawberry-shaped bulb, tip pointing down, base at the top (y=0.5).
      const pts: THREE.Vector2[] = [];
      for (let i = 0; i <= 12; i++) {
        const u = i / 12;
        const y = 0.5 - u * 1.2;
        const r =
          0.36 * Math.sin(Math.PI * Math.pow(u, 0.8)) * (1 - 0.15 * u) + (u < 0.05 ? 0.2 : 0);
        pts.push(new THREE.Vector2(Math.max(0.001, r), y));
      }
      const geo = new THREE.LatheGeometry(pts, 12);
      geo.translate(0, 0.1, 0);
      return geo;
    }
    case "lantern": {
      const pts: THREE.Vector2[] = [];
      for (let i = 0; i <= 10; i++) {
        const u = i / 10;
        pts.push(new THREE.Vector2(0.1 + 0.42 * Math.sin(Math.PI * u), 0.6 - u * 1.2));
      }
      return new THREE.LatheGeometry(pts, 14);
    }
    case "star":
      return starGeometry();
    default:
      return new THREE.SphereGeometry(0.5, 14, 10);
  }
}
