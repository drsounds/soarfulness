import * as THREE from "three";

// Additive glows (neon lines, bulb glow) are transparent and don't write
// depth, but the ocean is transparent AND writes depth. Drawn after the
// ocean, a glow that lies behind the water surface (the camera looking up
// through the waves at lights above, or down at lights under water) fails
// the depth test against the ocean and is clipped to the wave shapes
// instead of showing through the water's transparency.
//
// The fix draws each glow twice, split per fragment by which side of the
// water plane it is on relative to the camera:
//  - "behind" pass: fragments on the far side of the water. Drawn BEFORE the
//    ocean (renderOrder WATER_PASS_BEHIND_ORDER < the ocean's 0), tested only
//    against opaque scene geometry, so the ocean then blends over them and
//    they show through its transparency.
//  - "front" pass: the rest. Drawn after the ocean as before, tested against
//    everything including the ocean surface.
// Every fragment is drawn by exactly one pass, so nothing is doubled.

export const WATER_PASS_BEHIND_ORDER = -0.5;

/** Shared by every glow material; written once per frame by setWaterPass. */
export const waterPassUniforms = {
  uWaterY: { value: 0 },
  uCamAbove: { value: 1 },
};

export function setWaterPass(waterY: number, cameraY: number) {
  waterPassUniforms.uWaterY.value = waterY;
  waterPassUniforms.uCamAbove.value = cameraY >= waterY ? 1 : 0;
}

export const WATER_PASS_DECL_VERTEX = /* glsl */ `
  varying float vWaterPassY;
`;
export const WATER_PASS_DECL_FRAGMENT = /* glsl */ `
  varying float vWaterPassY;
  uniform float uWaterY;
  uniform float uCamAbove;
`;
/** Start of main() in the fragment shader. WATER_PASS_BEHIND is a define: 1 = behind pass. */
export const WATER_PASS_DISCARD = /* glsl */ `
  {
    bool fragAbove = vWaterPassY > uWaterY;
    bool behindWater = fragAbove != (uCamAbove > 0.5);
    #if WATER_PASS_BEHIND
      if (!behindWater) discard;
    #else
      if (behindWater) discard;
    #endif
  }
`;

/**
 * Patches a built-in-style material (LineMaterial, ...) so it splits by water
 * side. `worldYExpr` is a GLSL expression for the vertex's world-space y,
 * evaluated at `anchor` in the vertex shader (just before its closing brace).
 */
export function applyWaterPass(
  material: THREE.ShaderMaterial,
  behind: boolean,
  worldYExpr: string,
  vertexAnchor: string,
  fragmentAnchor: string,
) {
  material.defines = { ...material.defines, WATER_PASS_BEHIND: behind ? 1 : 0 };
  Object.assign(material.uniforms, waterPassUniforms);
  material.vertexShader = WATER_PASS_DECL_VERTEX + material.vertexShader;
  material.vertexShader = material.vertexShader.replace(
    vertexAnchor,
    `${vertexAnchor}\n  vWaterPassY = ${worldYExpr};\n`,
  );
  material.fragmentShader = WATER_PASS_DECL_FRAGMENT + material.fragmentShader;
  material.fragmentShader = material.fragmentShader.replace(
    fragmentAnchor,
    `${fragmentAnchor}\n${WATER_PASS_DISCARD}\n`,
  );
}
