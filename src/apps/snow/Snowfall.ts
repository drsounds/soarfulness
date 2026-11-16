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
