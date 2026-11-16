import * as THREE from "three";

// NEONACCENT: every material in a loaded scene whose name ends in "-neon"
// (case-insensitive; Blender's ".001"-style duplicate suffix is allowed
// after it, e.g. "sign-neon.002") takes the neon accent color both as its
// tint (material.color) and as its emission (material.emissive), with
// emissiveIntensity fixed at 1.00 — so a scene can mark its neon tubes and
// signs in the authoring tool and the player picks their color.

const NEON_MATERIAL_RE = /-neon(\.\d+)?$/i;

export function isNeonMaterialName(name: string | undefined | null): boolean {
  return !!name && NEON_MATERIAL_RE.test(name.trim());
}

type Tintable = THREE.Material & {
  color?: THREE.Color;
  emissive?: THREE.Color;
  emissiveIntensity?: number;
};

/** Collects the distinct "-neon" materials under `root`. */
export function collectNeonMaterials(root: THREE.Object3D): THREE.Material[] {
  const found = new Set<THREE.Material>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) if (isNeonMaterialName(m.name)) found.add(m);
  });
  return [...found];
}

/** Applies `color` as tint + emission (intensity 1.00) to every "-neon"
 *  material under `root`. Returns how many materials were recolored. */
export function applyNeonAccent(root: THREE.Object3D, color: string): number {
  const c = new THREE.Color(color);
  const mats = collectNeonMaterials(root);
  for (const m of mats as Tintable[]) {
    if (m.color) m.color.copy(c);
    if (m.emissive) {
      m.emissive.copy(c);
      m.emissiveIntensity = 1;
    }
    m.needsUpdate = true;
  }
  return mats.length;
}
