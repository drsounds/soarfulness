import * as THREE from "three";

// SNÖ: falling snow around the camera, plus the optional SNÖTÄCKE that
// whitens the loaded scene's surfaces as if snow had settled on them.
//
// Snowfall is one THREE.Points cloud of SNOW_MAX_FLAKES flakes, of which the
// first `amount` are drawn (setDrawRange), so changing SNÖMÄNGD never
// reallocates. Every flake's position is computed in the vertex shader from
// its seed, the time and the camera position, wrapped into a box that follows
// the camera, so the snow is endless in every direction at no CPU cost.

export const SNOW_MAX_FLAKES = 40000;

// Half extents of the camera-following box the flakes live in (m).
const BOX_HALF = new THREE.Vector3(22, 14, 22);

export type SnowConfig = {
  /** Number of flakes drawn (SNÖMÄNGD). */
  amount: number;
  /** 0..~4: how hard it snows — fall speed, flake size and wind (SNÖSTYRKA). */
  intensity: number;
  /** World Y below which flakes are hidden (the water level). */
  waterLevel: number;
  /** 0..1, hides the snow while the camera is under water. */
  underwater: number;
};

export class Snowfall {
  readonly points: THREE.Points;
  private readonly material: THREE.ShaderMaterial;
  private readonly geometry: THREE.BufferGeometry;
  private readonly uniforms: {
    uTime: { value: number };
    uCamPos: { value: THREE.Vector3 };
    uBoxHalf: { value: THREE.Vector3 };
    uFall: { value: number };
    uSink: { value: number };
    uWind: { value: THREE.Vector2 };
    uSway: { value: number };
    uSize: { value: number };
    uPixelRatio: { value: number };
    uWaterLevel: { value: number };
    uOpacity: { value: number };
  };
  // Wind and fall drift are integrated on the CPU (not uTime * speed in the
  // shader) so that changing SNÖSTYRKA doesn't make every flake jump.
  private readonly drift = new THREE.Vector3();
  private windAngle = Math.random() * Math.PI * 2;
  // How far the snow has sunk along with a descending camera (m), and the
  // camera height last frame — see the sinking compensation in update().
  private sink = 0;
  private lastCamY: number | null = null;

  constructor(scene: THREE.Scene) {
    const seeds = new Float32Array(SNOW_MAX_FLAKES * 4);
    for (let i = 0; i < SNOW_MAX_FLAKES; i++) {
      seeds[i * 4] = Math.random();
      seeds[i * 4 + 1] = Math.random();
      seeds[i * 4 + 2] = Math.random();
      seeds[i * 4 + 3] = Math.random();
    }
    this.geometry = new THREE.BufferGeometry();
    // three.js needs a position attribute to draw; the real position comes
    // from aSeed in the shader.
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(SNOW_MAX_FLAKES * 3), 3),
    );
    this.geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4));
    this.geometry.setDrawRange(0, 0);
    this.uniforms = {
      uTime: { value: 0 },
      uCamPos: { value: new THREE.Vector3() },
      uBoxHalf: { value: BOX_HALF.clone() },
      uFall: { value: 0 },
      uSink: { value: 0 },
      uWind: { value: new THREE.Vector2() },
      uSway: { value: 0.4 },
      uSize: { value: 1 },
      uPixelRatio: { value: 1 },
      uWaterLevel: { value: -1e9 },
      uOpacity: { value: 0.9 },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      fog: false,
      vertexShader: `
        attribute vec4 aSeed;
        uniform float uTime;
        uniform vec3 uCamPos;
        uniform vec3 uBoxHalf;
        uniform float uFall;
        uniform float uSink;
        uniform vec2 uWind;
        uniform float uSway;
        uniform float uSize;
        uniform float uPixelRatio;
        varying float vAlpha;
        varying float vWorldY;
        void main() {
          vec3 box = uBoxHalf * 2.0;
          // Each flake falls at 70..130 % of the common speed and sways on
          // its own little circle.
          float speedVar = 0.7 + aSeed.w * 0.6;
          vec3 p = aSeed.xyz * box;
          p.y -= uFall * speedVar + uSink;
          p.xz += uWind * speedVar;
          float ph = aSeed.w * 6.2831853 + uTime * (0.6 + aSeed.x * 0.8);
          p.x += sin(ph) * uSway;
          p.z += cos(ph * 0.83) * uSway;
          // Wrap into the box centred on the camera.
          p = mod(p - uCamPos + uBoxHalf, box) - uBoxHalf + uCamPos;
          vWorldY = p.y;
          vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float dist = max(-mv.z, 0.05);
          float flake = uSize * (0.55 + aSeed.y * 0.9);
          gl_PointSize = clamp(flake * 0.08 * uPixelRatio * 600.0 / dist, 0.0, 48.0 * uPixelRatio);
          // Fade out toward the edges of the box so its walls never show.
          vec3 rel = abs(p - uCamPos) / uBoxHalf;
          float edge = max(max(rel.x, rel.z), rel.y);
          vAlpha = (1.0 - smoothstep(0.7, 1.0, edge)) * smoothstep(0.2, 0.8, dist);
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        uniform float uWaterLevel;
        varying float vAlpha;
        varying float vWorldY;
        void main() {
          if (vWorldY < uWaterLevel) discard;
          vec2 c = gl_PointCoord - 0.5;
          float r = length(c) * 2.0;
          float a = (1.0 - smoothstep(0.35, 1.0, r)) * vAlpha * uOpacity;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vec3(0.97, 0.98, 1.0), a);
        }
      `,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.name = "snowfall";
    this.points.frustumCulled = false;
    this.points.visible = false;
    this.points.renderOrder = 10;
    scene.add(this.points);
  }

  setPixelRatio(ratio: number) {
    this.uniforms.uPixelRatio.value = ratio;
  }

  hide() {
    this.points.visible = false;
    this.lastCamY = null;
  }

  update(timeS: number, dt: number, camPos: THREE.Vector3, cfg: SnowConfig) {
    const count = Math.max(0, Math.min(SNOW_MAX_FLAKES, Math.round(cfg.amount)));
    const step = Math.min(dt, 0.1);
    // When the camera sinks (diving under, bobbing down on a wave, a
    // descending flight), world-anchored flakes would seem to rise past it.
    // So the whole cloud sinks along with the camera — uniformly, not scaled
    // by each flake's speed — and the snow keeps looking like it falls.
    // Rising is left alone (flakes then just fall a bit faster past you).
    // Jumps of 5 m or more in one frame are teleports, not sinking.
    if (this.lastCamY !== null) {
      const descent = this.lastCamY - camPos.y;
      if (descent > 0 && descent < 5) this.sink = (this.sink + descent) % (BOX_HALF.y * 2);
    }
    this.lastCamY = camPos.y;
    const visible = count > 0 && cfg.underwater < 0.5;
    this.points.visible = visible;
    if (!visible) return;
    this.geometry.setDrawRange(0, count);
    const k = Math.max(0, cfg.intensity);
    // Calm snow drifts down at ~0.8 m/s; a storm at a few m/s with wind
    // that slowly turns.
    const fallSpeed = 0.6 + k * 1.6;
    const windSpeed = k * k * 2.2;
    this.windAngle += step * 0.05 * (0.5 + k);
    this.drift.y += fallSpeed * step;
    this.drift.x += Math.cos(this.windAngle) * windSpeed * step;
    this.drift.z += Math.sin(this.windAngle) * windSpeed * step;
    // Keep the accumulators small (positions wrap anyway, period = box size).
    const box = this.uniforms.uBoxHalf.value;
    this.drift.x %= box.x * 2;
    this.drift.y %= box.y * 2;
    this.drift.z %= box.z * 2;
    const u = this.uniforms;
    u.uTime.value = timeS;
    u.uCamPos.value.copy(camPos);
    u.uFall.value = this.drift.y;
    u.uSink.value = this.sink;
    u.uWind.value.set(this.drift.x, this.drift.z);
    u.uSway.value = 0.25 + k * 0.35;
    u.uSize.value = 0.8 + k * 0.45;
    u.uOpacity.value = Math.min(1, 0.75 + k * 0.1);
    u.uWaterLevel.value = cfg.waterLevel;
  }

  dispose() {
    this.points.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}

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

// The light snow is seen in: white by day, a dim moonlit blue at night.
const NIGHT_SNOW_LIGHT = new THREE.Color(0.17, 0.21, 0.32);
const DAY_SNOW_LIGHT = new THREE.Color(1, 1, 1);
export function snowLightColor(daylight: number, out = new THREE.Color()): THREE.Color {
  const d = Math.min(1, Math.max(0, daylight));
  return out.copy(NIGHT_SNOW_LIGHT).lerp(DAY_SNOW_LIGHT, d);
}
