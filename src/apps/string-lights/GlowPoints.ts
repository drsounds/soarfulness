import * as THREE from "three";
import {
  WATER_PASS_BEHIND_ORDER,
  WATER_PASS_DECL_FRAGMENT,
  WATER_PASS_DECL_VERTEX,
  WATER_PASS_DISCARD,
  waterPassUniforms,
} from "@/lib/waterPass";

// The additive glow sprite at each bulb: one Points object per bulb set,
// sized in world units and colored per bulb. Drawn in two water passes (see
// lib/waterPass.ts) so glows behind the waves show through the ocean's
// transparency instead of being cut by its depth.

const vertex = /* glsl */ `
  ${WATER_PASS_DECL_VERTEX}
  attribute vec3 color;
  uniform float uSize;
  uniform float uScale;
  varying vec3 vColor;
  void main() {
    vColor = color;
    vWaterPassY = (modelMatrix * vec4(position, 1.0)).y;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(uSize * uScale / max(0.05, -mv.z), 0.0, 256.0);
  }
`;
const fragment = /* glsl */ `
  ${WATER_PASS_DECL_FRAGMENT}
  varying vec3 vColor;
  uniform float uStrength;
  void main() {
    ${WATER_PASS_DISCARD}
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(p, p);
    if (r2 > 1.0) discard;
    // A tight hot core plus a soft halo.
    float g = exp(-r2 * 9.0) * 0.9 + exp(-r2 * 3.0) * 0.35 * (1.0 - r2);
    gl_FragColor = vec4(vColor * g * uStrength, 1.0);
  }
`;

function material(behind: boolean) {
  return new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    defines: { WATER_PASS_BEHIND: behind ? 1 : 0 },
    uniforms: {
      uSize: { value: 0.5 },
      uScale: { value: 500 },
      uStrength: { value: 1 },
      ...waterPassUniforms,
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export class GlowPoints {
  /** Drawn after the ocean (fragments on the camera's side of the water). */
  readonly front: THREE.Points;
  /** Drawn before the ocean (fragments behind the water surface). */
  readonly behind: THREE.Points;
  readonly colors: THREE.BufferAttribute;
  private readonly geometry = new THREE.BufferGeometry();

  /** `positions`: xyz per bulb, in the parent's frame. */
  constructor(positions: Float32Array) {
    this.geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.colors = new THREE.BufferAttribute(new Float32Array(positions.length), 3);
    this.colors.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute("color", this.colors);
    this.front = new THREE.Points(this.geometry, material(false));
    this.behind = new THREE.Points(this.geometry, material(true));
    this.front.renderOrder = 11;
    this.behind.renderOrder = WATER_PASS_BEHIND_ORDER;
    for (const p of [this.front, this.behind]) {
      p.frustumCulled = false;
      p.raycast = () => {};
    }
  }

  /** Per-bulb glow colors written here are re-uploaded by commit(). */
  get array(): Float32Array {
    return this.colors.array as Float32Array;
  }

  addTo(parent: THREE.Object3D) {
    parent.add(this.behind, this.front);
  }

  /** `size` in metres, `scale` = viewport px per metre at 1 m. */
  setStyle(size: number, scale: number, visible: boolean) {
    for (const p of [this.front, this.behind]) {
      const m = p.material as THREE.ShaderMaterial;
      m.uniforms.uSize.value = size;
      m.uniforms.uScale.value = scale;
      p.visible = visible;
    }
  }

  commit() {
    this.colors.needsUpdate = true;
  }

  dispose() {
    this.front.removeFromParent();
    this.behind.removeFromParent();
    this.geometry.dispose();
    (this.front.material as THREE.Material).dispose();
    (this.behind.material as THREE.Material).dispose();
  }
}
