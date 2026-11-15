import * as THREE from "three";
import type { AuroraPalette } from "@/lib/settingsShared";

// NORRSKEN: northern lights in the sky.
//
// The aurora is drawn as up to AURORA_MAX_BANDS thin vertical curtains — one
// ribbon mesh per band, its wavy course, folds and ragged top computed in the
// vertex shader. Real aurora curtains are thin sheets of light hanging
// ~100 km up, so a sheet seen in perspective is what they actually look like:
// edge-on near the horizon they bunch into bright arcs, overhead they spread
// into a corona. The fragment shader adds the vertical rays, the brightness
// patches drifting along each band and the color layering (a pinkish lower
// fringe, the bright main color, a faint top color).
//
// The curtains live in a camera-following group, so they sit "at infinity"
// like the sky dome, and every vertex is pushed onto the far plane: anything
// in the scene (islands, buildings, clouds, the water) is drawn in front of
// them, while they draw over the sky dome, the environment skybox and the
// flat DOM backdrop (the blending adds light, also on the transparent canvas).
//
// Coordinates: north is -Z. Units are "curtain base altitudes" (1 = the
// bottom edge of the curtains), the group's scale only keeps the geometry
// well clear of the near plane.

export const AURORA_MAX_BANDS = 7;
const SEGMENTS = 260;
// Half the length of a band along east-west (in base altitudes) — long
// enough to reach the horizon on both sides.
const X_HALF = 42;
// Curtain height above its base edge, in base altitudes (~100 km → ~250 km).
const CURTAIN_HEIGHT = 1.5;
const GROUP_SCALE = 60;

// NORRSKENSFÄRGER. Each palette is [lower fringe, main, top] in display
// (sRGB) values. "rainbow" runs the main color through the hues along the
// bands; "custom" takes the two EGNA FÄRGER colors from the settings.

type Rgb = [number, number, number];
const PALETTES: Record<Exclude<AuroraPalette, "custom">, [Rgb, Rgb, Rgb]> = {
  classic: [
    [1.0, 0.42, 0.78],
    [0.22, 1.0, 0.55],
    [0.75, 0.22, 0.6],
  ],
  green: [
    [0.62, 1.0, 0.72],
    [0.18, 0.95, 0.42],
    [0.12, 0.62, 0.55],
  ],
  red: [
    [1.0, 0.45, 0.55],
    [0.95, 0.16, 0.22],
    [0.55, 0.06, 0.35],
  ],
  violet: [
    [1.0, 0.55, 0.92],
    [0.68, 0.32, 1.0],
    [0.32, 0.2, 0.95],
  ],
  blue: [
    [0.62, 0.92, 1.0],
    [0.2, 0.62, 1.0],
    [0.42, 0.22, 0.92],
  ],
  rainbow: [
    [1.0, 0.6, 0.85],
    [0.22, 1.0, 0.55],
    [0.6, 0.25, 0.9],
  ],
};

export type AuroraConfig = {
  /** 0..~4: brightness (NORRSKENSSTYRKA). */
  intensity: number;
  /** 0..1: how many bands and how much of the sky they cover (MÄNGD). */
  amount: number;
  /** 0..~3: how fast the curtains drift, fold and shimmer (RÖRELSE). */
  speed: number;
  /** 0..1: low over the northern horizon (0) .. overhead (1) (HÖJD). */
  height: number;
  palette: AuroraPalette;
  /** Hex colors used by the "custom" palette. */
  customMain: string;
  customTop: string;
  /** 0 = day .. 1 = night (DYGNSBYTE's nightBackdropMix). */
  night: number;
  /** Show it in daylight too (SYNS PÅ DAGEN). */
  showInDaylight: boolean;
  /** 0..1, hides the aurora while the camera is under water. */
  underwater: number;
};

const NOISE_GLSL = `
  float auroraHash(float n) {
    return fract(sin(mod(n, 1000.0)) * 43758.5453);
  }
  float auroraNoise(float x) {
    float i = floor(x);
    float f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(auroraHash(i), auroraHash(i + 1.0), f);
  }
`;

export class Aurora {
  readonly group: THREE.Group;
  private readonly mesh: THREE.Mesh;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly uniforms: {
    uTime: { value: number };
    uAmount: { value: number };
    uHeight: { value: number };
    uIntensity: { value: number };
    uColBase: { value: THREE.Color };
    uColMain: { value: THREE.Color };
    uColTop: { value: THREE.Color };
    uRainbow: { value: number };
  };
  // The curtains' animation phase, integrated on the CPU so changing RÖRELSE
  // never makes them jump.
  private phase = Math.random() * 500;
  // Eases the aurora in/out when it's switched on/off or the night falls.
  private fade = 0;
  private readonly scratch = new THREE.Color();
  /** Average glow color × brightness right now, for the water's reflection. */
  readonly glow = new THREE.Color(0, 0, 0);
  /** Elevation (radians) of the brightest part of the main band. */
  glowElevation = 0.3;

  constructor(scene: THREE.Scene) {
    const verts = AURORA_MAX_BANDS * (SEGMENTS + 1) * 2;
    const rib = new Float32Array(verts * 3);
    const index: number[] = [];
    let k = 0;
    for (let b = 0; b < AURORA_MAX_BANDS; b++) {
      const base = b * (SEGMENTS + 1) * 2;
      for (let s = 0; s <= SEGMENTS; s++) {
        for (let v = 0; v < 2; v++) {
          rib[k++] = s / SEGMENTS;
          rib[k++] = v;
          rib[k++] = b;
        }
        if (s < SEGMENTS) {
          const a = base + s * 2;
          index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
      }
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(verts * 3), 3),
    );
    this.geometry.setAttribute("aRib", new THREE.BufferAttribute(rib, 3));
    this.geometry.setIndex(index);
    this.uniforms = {
      uTime: { value: 0 },
      uAmount: { value: 0.5 },
      uHeight: { value: 0.35 },
      uIntensity: { value: 0 },
      uColBase: { value: new THREE.Color() },
      uColMain: { value: new THREE.Color() },
      uColTop: { value: new THREE.Color() },
      uRainbow: { value: 0 },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      fog: false,
      // Adds light: color += src, alpha += a little (so it also shows on
      // the transparent canvas over a flat DOM backdrop).
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneFactor,
      vertexShader: `
        attribute vec3 aRib;
        uniform float uTime;
        uniform float uAmount;
        uniform float uHeight;
        varying float vX;
        varying float vV;
        varying float vBand;
        varying float vFade;
        ${NOISE_GLSL}
        void main() {
          float band = aRib.z;
          float s1 = auroraHash(band * 17.13 + 1.7);
          float s2 = auroraHash(band * 7.31 + 3.1);
          float s3 = auroraHash(band * 3.77 + 9.2);
          float t = uTime;
          // Bands switch on one by one as MÄNGD grows (the first always).
          float bands = 1.0 + uAmount * ${(AURORA_MAX_BANDS - 1).toFixed(1)};
          float bandOn = clamp(bands - band, 0.0, 1.0);
          // Low amounts give partial arcs; high amounts span the sky.
          float len = clamp(0.3 + uAmount * 0.9 + s1 * 0.25 - band * 0.04, 0.25, 1.0);
          float u = (s2 - 0.5) * (1.0 - len) + (aRib.x - 0.5) * len;
          float x = u * ${(2 * X_HALF).toFixed(1)};
          // Distance north of the camera: the first band at HÖJD's
          // distance, the others alternating behind and in front of it.
          float r = ceil(band * 0.5) * (mod(band, 2.0) > 0.5 ? -1.0 : 1.0);
          float d0 = mix(7.0, 0.12, pow(uHeight, 0.8));
          float spread = 0.5 + uAmount * 0.5;
          float d = d0 * exp(r * 0.32 * spread) + r * 0.22 * spread + (s3 - 0.5) * 0.2;
          // The curtain's wavy course and folds, slowly drifting.
          float amp = 0.25 + 0.18 * abs(d);
          float z = d
            + amp * sin(x * 0.11 + s1 * 6.2832 + t * 0.045)
            + amp * 0.45 * sin(x * 0.27 - t * 0.07 + s2 * 6.2832)
            + 0.14 * sin(x * 0.85 + t * 0.21 + s3 * 6.2832)
            + 0.05 * sin(x * 2.3 - t * 0.5 + s1 * 6.2832);
          // Ragged, slowly breathing top edge; base edge with a slight sag.
          float top = ${CURTAIN_HEIGHT.toFixed(2)} * (0.55 + 0.75 * auroraNoise(x * 0.16 + s3 * 40.0 + t * 0.06));
          float y = 1.0 - 0.06 * sin(x * 0.2 + t * 0.03 + s2 * 6.2832) + aRib.y * top;
          vec3 p = vec3(x, y, -z);
          vX = x + band * 37.0;
          vV = aRib.y;
          vBand = band;
          // Fade out at the ribbon ends and near the horizon (the light
          // travels through more air there).
          float ends = smoothstep(0.0, 0.14, aRib.x) * smoothstep(1.0, 0.86, aRib.x);
          float elev = normalize(vec3(p.x, 1.0, p.z)).y;
          vFade = bandOn * ends * smoothstep(0.02, 0.16, elev);
          vec4 clip = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          // Onto the far plane: everything in the scene draws in front.
          clip.z = clip.w * 0.999999;
          gl_Position = clip;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uIntensity;
        uniform vec3 uColBase;
        uniform vec3 uColMain;
        uniform vec3 uColTop;
        uniform float uRainbow;
        varying float vX;
        varying float vV;
        varying float vBand;
        varying float vFade;
        ${NOISE_GLSL}
        vec3 auroraHue(float h) {
          vec3 k = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          return mix(vec3(1.0), k, 0.8);
        }
        void main() {
          if (vFade < 0.002) discard;
          float t = uTime;
          // Vertical rays: brightness varies only along the band.
          float rays = 0.35 + 0.65 * pow(auroraNoise(vX * 2.1 + t * 0.32), 1.6);
          rays *= 0.7 + 0.3 * auroraNoise(vX * 8.5 - t * 1.05);
          // Bright patches drifting along the band.
          float patches = smoothstep(0.12, 0.78, auroraNoise(vX * 0.17 + t * 0.05 + vBand * 3.1));
          patches = 0.15 + 0.85 * patches;
          // Brighter rays reach higher.
          float v = vV / (0.55 + 0.6 * rays);
          float mainW = smoothstep(0.0, 0.05, vV) * (exp(-v * 2.6) * 0.85 + 0.15) * (1.0 - smoothstep(0.55, 1.0, v));
          float topW = smoothstep(0.25, 0.65, v) * (1.0 - smoothstep(0.75, 1.15, v)) * 0.35;
          float baseW = smoothstep(0.0, 0.02, vV) * exp(-vV * 24.0) * 0.55;
          vec3 colMain = uColMain;
          if (uRainbow > 0.5) colMain = auroraHue(vX * 0.012 + t * 0.01);
          vec3 col = colMain * mainW + uColTop * topW + uColBase * baseW;
          col *= rays * patches * vFade * uIntensity;
          float a = clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0) * 0.7;
          gl_FragColor = vec4(col, a);
        }
      `,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    // After the sky dome/backdrop, before the cloud decks (renderOrder -1).
    this.mesh.renderOrder = -1.5;
    this.group = new THREE.Group();
    this.group.name = "aurora";
    this.group.scale.setScalar(GROUP_SCALE);
    this.group.add(this.mesh);
    this.group.visible = false;
    scene.add(this.group);
  }

  hide() {
    this.group.visible = false;
    this.fade = 0;
    this.glow.setRGB(0, 0, 0);
  }

  private setPalette(cfg: AuroraConfig) {
    const u = this.uniforms;
    if (cfg.palette === "custom") {
      u.uColMain.value.set(cfg.customMain);
      u.uColTop.value.set(cfg.customTop);
      u.uColBase.value.copy(u.uColMain.value).lerp(this.scratch.setRGB(1, 1, 1), 0.45);
      // set() converts hex from sRGB to linear; the shader writes display
      // values directly, so take the sRGB components back.
      u.uColMain.value.convertLinearToSRGB();
      u.uColTop.value.convertLinearToSRGB();
      u.uColBase.value.convertLinearToSRGB();
      u.uRainbow.value = 0;
      return;
    }
    const p = PALETTES[cfg.palette] ?? PALETTES.classic;
    u.uColBase.value.setRGB(...p[0], THREE.LinearSRGBColorSpace);
    u.uColMain.value.setRGB(...p[1], THREE.LinearSRGBColorSpace);
    u.uColTop.value.setRGB(...p[2], THREE.LinearSRGBColorSpace);
    u.uRainbow.value = cfg.palette === "rainbow" ? 1 : 0;
  }

  update(dt: number, camPos: THREE.Vector3, cfg: AuroraConfig) {
    const step = Math.min(dt, 0.1);
    const daylight = cfg.showInDaylight ? 1 : Math.max(0, Math.min(1, cfg.night));
    const target = Math.max(0, cfg.intensity) * daylight * (1 - Math.min(1, cfg.underwater * 2));
    this.fade += (target - this.fade) * Math.min(1, step * 1.5);
    const visible = this.fade > 0.003;
    this.group.visible = visible;
    if (!visible) {
      this.glow.setRGB(0, 0, 0);
      return;
    }
    this.phase = (this.phase + step * Math.max(0, cfg.speed)) % 10000;
    this.setPalette(cfg);
    const u = this.uniforms;
    u.uTime.value = this.phase;
    u.uAmount.value = Math.max(0, Math.min(1, cfg.amount));
    u.uHeight.value = Math.max(0, Math.min(1, cfg.height));
    u.uIntensity.value = this.fade;
    this.group.position.copy(camPos);
    // For the water: the main color, scaled by brightness and coverage.
    this.glow.copy(u.uColMain.value).multiplyScalar(this.fade * (0.25 + 0.35 * u.uAmount.value));
    if (u.uRainbow.value > 0.5) this.glow.setRGB(0.35, 0.55, 0.45).multiplyScalar(this.fade * 0.5);
    const d0 = 7 + (0.12 - 7) * Math.pow(u.uHeight.value, 0.8);
    this.glowElevation = Math.atan2(1.35, d0);
  }

  dispose() {
    this.group.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
