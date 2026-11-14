import * as THREE from "three";
import type { ConfettiPalette } from "@/lib/settingsShared";

// KONFETTI: paper confetti drifting down around the camera, like SNÖ
// (lib/sceneFx/snow.ts) but with colored pieces that spin and tumble.
//
// Same technique as the snowfall: one THREE.Points cloud of
// CONFETTI_MAX_PIECES pieces, of which the first `amount` are drawn
// (setDrawRange), each piece's position computed in the vertex shader from
// its seed, the time and the camera position, wrapped into a box that follows
// the camera. A piece is a point sprite cut into a rotated rectangle in the
// fragment shader; the rectangle's short side shrinks and grows with the
// piece's flip (tumble) and its shade changes as it shows its back.

export const CONFETTI_MAX_PIECES = 40000;

// Half extents of the camera-following box the pieces live in (m).
const BOX_HALF = new THREE.Vector3(22, 14, 22);

const MAX_COLORS = 6;

// KONFETTIFÄRGER: the colors a palette draws from (linear-ish sRGB 0..1).
// `shine` adds a glint when a piece faces the camera (foil confetti).
const PALETTES: Record<ConfettiPalette, { colors: number[]; shine: number }> = {
  rainbow: {
    colors: [0xff3b5c, 0xffc21a, 0x2ed36b, 0x2f8cff, 0xb44dff, 0xff7a1a],
    shine: 0.15,
  },
  pastel: {
    colors: [0xffb3c7, 0xffe3a3, 0xb8f0c8, 0xa9d4ff, 0xd9c2ff, 0xffffff],
    shine: 0.1,
  },
  gold: {
    colors: [0xffd257, 0xe0a826, 0xfff0b0, 0xd9dde3, 0xb7bdc6, 0xf6c445],
    shine: 0.9,
  },
  white: {
    colors: [0xffffff, 0xf4f6fa, 0xe9edf4],
    shine: 0.25,
  },
};

export type ConfettiConfig = {
  /** Number of pieces drawn (KONFETTIMÄNGD). */
  amount: number;
  /** 0..~4: fall speed, piece size and wind (KONFETTISTYRKA). */
  intensity: number;
  /** 0..2: how much the pieces spin, tumble and sway as they fall (FLADDER). */
  flutter: number;
  /** KONFETTIFÄRGER. */
  palette: ConfettiPalette;
  /** World Y below which pieces are hidden (the water level). */
  waterLevel: number;
  /** 0..1, hides the confetti while the camera is under water. */
  underwater: number;
};

export class Confetti {
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
    uSpin: { value: number };
    uTumble: { value: number };
    uSize: { value: number };
    uPixelRatio: { value: number };
    uWaterLevel: { value: number };
    uPalette: { value: THREE.Color[] };
    uPaletteCount: { value: number };
    uShine: { value: number };
  };
  // Fall, wind and tumble are integrated on the CPU (not uTime * speed in
  // the shader) so that changing KONFETTISTYRKA or FLADDER doesn't make every
  // piece jump.
  private readonly drift = new THREE.Vector3();
  private sink = 0;
  private spin = 0;
  private tumble = 0;
  private windAngle = Math.random() * Math.PI * 2;
  private lastCamY: number | null = null;
  private palette: ConfettiPalette | null = null;

  constructor(scene: THREE.Scene) {
    const seeds = new Float32Array(CONFETTI_MAX_PIECES * 4);
    const seeds2 = new Float32Array(CONFETTI_MAX_PIECES * 4);
    for (let i = 0; i < CONFETTI_MAX_PIECES * 4; i++) {
      seeds[i] = Math.random();
      seeds2[i] = Math.random();
    }
    this.geometry = new THREE.BufferGeometry();
    // three.js needs a position attribute to draw; the real position comes
    // from aSeed in the shader.
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(CONFETTI_MAX_PIECES * 3), 3),
    );
    this.geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4));
    this.geometry.setAttribute("aSeed2", new THREE.BufferAttribute(seeds2, 4));
    this.geometry.setDrawRange(0, 0);
    this.uniforms = {
      uTime: { value: 0 },
      uCamPos: { value: new THREE.Vector3() },
      uBoxHalf: { value: BOX_HALF.clone() },
      uFall: { value: 0 },
      uSink: { value: 0 },
      uWind: { value: new THREE.Vector2() },
      uSway: { value: 0.6 },
      uSpin: { value: 0 },
      uTumble: { value: 0 },
      uSize: { value: 1 },
      uPixelRatio: { value: 1 },
      uWaterLevel: { value: -1e9 },
      uPalette: { value: Array.from({ length: MAX_COLORS }, () => new THREE.Color(1, 1, 1)) },
      uPaletteCount: { value: 1 },
      uShine: { value: 0 },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      fog: false,
      vertexShader: `
        attribute vec4 aSeed;
        attribute vec4 aSeed2;
        uniform float uTime;
        uniform vec3 uCamPos;
        uniform vec3 uBoxHalf;
        uniform float uFall;
        uniform float uSink;
        uniform vec2 uWind;
        uniform float uSway;
        uniform float uSpin;
        uniform float uTumble;
        uniform float uSize;
        uniform float uPixelRatio;
        uniform vec3 uPalette[${MAX_COLORS}];
        uniform float uPaletteCount;
        varying float vAlpha;
        varying float vWorldY;
        varying vec3 vColor;
        varying float vAngle;
        varying float vFlip;
        void main() {
          vec3 box = uBoxHalf * 2.0;
          // Each piece falls at 60..140 % of the common speed (light pieces
          // flutter down slower) and sways on its own wobbly path.
          float speedVar = 0.6 + aSeed.w * 0.8;
          vec3 p = aSeed.xyz * box;
          // uSink is the camera's own descent, the same for every piece, so
          // the confetti never seems to rise while the camera sinks.
          p.y -= uFall * speedVar + uSink;
          p.xz += uWind * speedVar;
          float ph = aSeed.w * 6.2831853 + uTime * (0.9 + aSeed2.z * 1.2);
          p.x += sin(ph) * uSway;
          p.z += cos(ph * 0.77 + aSeed2.y * 3.0) * uSway;
          // Wrap into the box centred on the camera.
          p = mod(p - uCamPos + uBoxHalf, box) - uBoxHalf + uCamPos;
          vWorldY = p.y;
          vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float dist = max(-mv.z, 0.05);
          float piece = uSize * (0.6 + aSeed.y * 0.8);
          gl_PointSize = clamp(piece * 0.13 * uPixelRatio * 600.0 / dist, 0.0, 56.0 * uPixelRatio);
          // Fade out toward the edges of the box so its walls never show.
          vec3 rel = abs(p - uCamPos) / uBoxHalf;
          float edge = max(max(rel.x, rel.z), rel.y);
          vAlpha = (1.0 - smoothstep(0.7, 1.0, edge)) * smoothstep(0.2, 0.8, dist);
          int idx = int(floor(aSeed2.x * uPaletteCount));
          vec3 c = uPalette[0];
          for (int i = 1; i < ${MAX_COLORS}; i++) {
            if (i == idx) c = uPalette[i];
          }
          vColor = c;
          // Spin in the screen plane and flip about the piece's long axis,
          // each piece at its own rate and in its own direction.
          float spinDir = aSeed2.y < 0.5 ? -1.0 : 1.0;
          vAngle = aSeed2.w * 6.2831853 + uSpin * spinDir * (0.4 + aSeed2.z);
          vFlip = cos(aSeed2.y * 6.2831853 + uTumble * (0.6 + aSeed2.w * 0.9));
        }
      `,
      fragmentShader: `
        uniform float uWaterLevel;
        uniform float uShine;
        varying float vAlpha;
        varying float vWorldY;
        varying vec3 vColor;
        varying float vAngle;
        varying float vFlip;
        void main() {
          if (vWorldY < uWaterLevel) discard;
          vec2 c = gl_PointCoord - 0.5;
          float cs = cos(vAngle);
          float sn = sin(vAngle);
          c = vec2(cs * c.x - sn * c.y, sn * c.x + cs * c.y);
          // A paper strip 2:1, its short side foreshortened by the flip.
          float f = abs(vFlip);
          vec2 hs = vec2(0.42, 0.2 * max(f, 0.06));
          vec2 d = abs(c) - hs;
          float outside = max(d.x, d.y);
          float a = (1.0 - smoothstep(-0.02, 0.02, outside)) * vAlpha;
          if (a < 0.01) discard;
          // Front a touch brighter than the back; edge-on pieces darker;
          // foil glints when it faces the camera.
          float shade = (vFlip > 0.0 ? 1.0 : 0.78) * (0.7 + 0.3 * f);
          vec3 col = vColor * shade + vec3(uShine * pow(f, 12.0));
          gl_FragColor = vec4(col, a);
        }
      `,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.name = "confetti";
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

  private setPalette(palette: ConfettiPalette) {
    if (palette === this.palette) return;
    this.palette = palette;
    const def = PALETTES[palette] ?? PALETTES.rainbow;
    const cols = this.uniforms.uPalette.value;
    for (let i = 0; i < MAX_COLORS; i++) {
      cols[i].setHex(def.colors[i % def.colors.length]);
    }
    this.uniforms.uPaletteCount.value = Math.min(MAX_COLORS, def.colors.length);
    this.uniforms.uShine.value = def.shine;
  }

  update(timeS: number, dt: number, camPos: THREE.Vector3, cfg: ConfettiConfig) {
    const count = Math.max(0, Math.min(CONFETTI_MAX_PIECES, Math.round(cfg.amount)));
    const visible = count > 0 && cfg.underwater < 0.5;
    this.points.visible = visible;
    if (!visible) {
      this.lastCamY = null;
      return;
    }
    this.geometry.setDrawRange(0, count);
    this.setPalette(cfg.palette);
    const k = Math.max(0, cfg.intensity);
    const fl = Math.max(0, cfg.flutter);
    const step = Math.min(dt, 0.1);
    // Paper falls slower than snow (~0.5 m/s calm) and flutters more.
    const fallSpeed = 0.35 + k * 1.2;
    const windSpeed = k * k * 2.2;
    this.windAngle += step * 0.05 * (0.5 + k);
    this.drift.y += fallSpeed * step;
    this.drift.x += Math.cos(this.windAngle) * windSpeed * step;
    this.drift.z += Math.sin(this.windAngle) * windSpeed * step;
    this.spin += step * fl * 2.2;
    this.tumble += step * (0.5 + fl * 5.5);
    // When the camera sinks (diving under, a wave trough, the swing coming
    // down) faster than the confetti falls, the pieces would seem to rise.
    // Carry them down with the camera's descent so they always fall in view.
    // Jumps (teleports, scene loads) are ignored.
    if (this.lastCamY !== null) {
      const descent = this.lastCamY - camPos.y;
      if (descent > 0 && descent < 5) this.sink += descent;
    }
    this.lastCamY = camPos.y;
    // Keep the accumulators small (positions wrap anyway, period = box size).
    const box = this.uniforms.uBoxHalf.value;
    this.drift.x %= box.x * 2;
    this.drift.y %= box.y * 2;
    this.drift.z %= box.z * 2;
    this.sink %= box.y * 2;
    this.spin %= Math.PI * 2 * 1000;
    this.tumble %= Math.PI * 2 * 1000;
    const u = this.uniforms;
    u.uTime.value = timeS;
    u.uCamPos.value.copy(camPos);
    u.uFall.value = this.drift.y;
    u.uSink.value = this.sink;
    u.uWind.value.set(this.drift.x, this.drift.z);
    u.uSway.value = 0.2 + fl * 0.6 + k * 0.3;
    u.uSpin.value = this.spin;
    u.uTumble.value = this.tumble;
    u.uSize.value = 0.85 + k * 0.35;
    u.uWaterLevel.value = cfg.waterLevel;
  }

  dispose() {
    this.points.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
