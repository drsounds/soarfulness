import * as THREE from "three";
import { snowLightColor } from "./snowLight";

// SNÖTÄCKE: whitens every lit material in a model as if snow lay on it.
// Upward-facing surfaces get the full cover, walls a light frosting. One
// shared uniform drives all patched materials, so turning it on or off (or
// letting it build up) costs a single write per frame.
const SNOW_PATCHED = "__snowCoverPatched";

export class SnowCover {
  readonly uCover = { value: 0 };
  /** Light falling on the snow (see snowLightColor); only unlit materials
   *  and the env dome use it, lit materials get it from the scene lights. */
  readonly uLight = { value: new THREE.Color(1, 1, 1) };
  private patched = new WeakSet<THREE.Material>();
  private root: THREE.Object3D | null = null;

  get attachedTo(): THREE.Object3D | null {
    return this.root;
  }

  /** Patches every mesh material under `root` (once per material). */
  attach(root: THREE.Object3D) {
    this.root = root;
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) if (m) this.patch(m);
    });
  }

  detach() {
    this.root = null;
  }

  private patch(material: THREE.Material) {
    if (this.patched.has(material) || (material as THREE.ShaderMaterial).isShaderMaterial) return;
    // Only materials that compute a diffuseColor (all built-in mesh materials).
    if (!("color" in material)) return;
    this.patched.add(material);
    material.userData[SNOW_PATCHED] = true;
    const uCover = this.uCover;
    const uLight = this.uLight;
    const prevCompile = material.onBeforeCompile;
    const prevKey = material.customProgramCacheKey.bind(material);
    material.onBeforeCompile = (shader, renderer) => {
      prevCompile.call(material, shader, renderer);
      if (!shader.fragmentShader.includes("#include <color_fragment>")) return;
      shader.uniforms.uSnowCover = uCover;
      shader.uniforms.uSnowLight = uLight;
      // Unlit materials (MeshBasic, KHR_materials_unlit photo scans) don't
      // darken at night by themselves, so their snow takes the light level.
      const unlit = !shader.fragmentShader.includes("#include <lights_fragment_begin>");
      shader.vertexShader = shader.vertexShader
        .replace("void main() {", "varying vec3 vSnowN;\nvoid main() {")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          {
            vec3 snowN = mat3(modelMatrix) * normal;
            vSnowN = dot(snowN, snowN) > 0.0 ? normalize(snowN) : vec3(0.0, 1.0, 0.0);
          }`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "void main() {",
          "uniform float uSnowCover;\nuniform vec3 uSnowLight;\nvarying vec3 vSnowN;\nvoid main() {",
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          float snowUp = smoothstep(0.15, 0.7, normalize(vSnowN).y);
          float snowAmt = clamp(uSnowCover, 0.0, 1.0) * mix(0.22, 1.0, snowUp);
          // Keep a hint of the texture's detail in the snow.
          float snowLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          vec3 snowCol = vec3(0.86, 0.9, 0.96) + (snowLum - 0.5) * 0.12;
          ${unlit ? "snowCol *= uSnowLight;" : ""}
          diffuseColor.rgb = mix(diffuseColor.rgb, snowCol, snowAmt);`,
        );
      if (shader.fragmentShader.includes("#include <roughnessmap_fragment>")) {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <roughnessmap_fragment>",
          `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, 0.85, snowAmt);`,
        );
      }
      if (shader.fragmentShader.includes("#include <metalnessmap_fragment>")) {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <metalnessmap_fragment>",
          `#include <metalnessmap_fragment>
          metalnessFactor = mix(metalnessFactor, 0.0, snowAmt);`,
        );
      }
    };
    material.customProgramCacheKey = () => `${prevKey()}|snowCover`;
    material.needsUpdate = true;
  }

  /** Eases the cover toward `target` (0..1) — snow settles over a few seconds. */
  update(dt: number, target: number) {
    const cur = this.uCover.value;
    const rate = target > cur ? 0.35 : 0.8; // per second
    const step = Math.min(dt, 0.1) * rate;
    this.uCover.value = target > cur ? Math.min(target, cur + step) : Math.max(target, cur - step);
  }

  get cover(): number {
    return this.uCover.value;
  }

  /** `daylight` 0 (night) .. 1 (day), e.g. 1 - nightBackdropMix(tod). */
  setDaylight(daylight: number) {
    snowLightColor(daylight, this.uLight.value);
  }
}
