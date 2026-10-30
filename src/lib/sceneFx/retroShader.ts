import * as THREE from "three";
import type { RetroPalette } from "@/lib/settingsShared";

// RETRO post-process: makes the frame look like a 1990s app/game running in
// a 256-color (or smaller) video mode. The frame is first pixelated into
// uPixelSize-sized blocks, then each block is snapped to the chosen palette
// after adding a 4x4 ordered (Bayer) dither offset — the classic way those
// modes faked smooth gradients — and finally darkened on alternate screen
// rows for optional CRT scanlines.
//
// The cube palettes (rgb332/websafe/gray) quantize each channel to a fixed
// number of evenly spaced levels; "ega" is a nearest-color search over the
// 16 fixed EGA/VGA default colors.

export const RETRO_PALETTE_INDEX: Record<RetroPalette, number> = {
  rgb332: 0,
  websafe: 1,
  ega: 2,
  gray: 3,
};

const EGA_COLORS = [
  0x000000, 0x0000aa, 0x00aa00, 0x00aaaa, 0xaa0000, 0xaa00aa, 0xaa5500, 0xaaaaaa, 0x555555,
  0x5555ff, 0x55ff55, 0x55ffff, 0xff5555, 0xff55ff, 0xffff55, 0xffffff,
].map(
  (hex) =>
    new THREE.Vector3(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255),
);

export const RETRO_SHADER = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uPixelSize: { value: 2 },
    uDither: { value: 1 },
    uScanlines: { value: 0.2 },
    uPalette: { value: 0 },
    uEga: { value: EGA_COLORS },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uPixelSize;
    uniform float uDither;
    uniform float uScanlines;
    uniform int uPalette;
    uniform vec3 uEga[16];
    varying vec2 vUv;

    // Recursive Bayer matrix in closed form: 0..1 thresholds for a 4x4 tile.
    float bayer2(vec2 a) {
      a = floor(a);
      return fract(a.x / 2.0 + a.y * a.y * 0.75);
    }
    float bayer4(vec2 a) {
      return bayer2(0.5 * a) * 0.25 + bayer2(a);
    }

    vec3 quantize(vec3 c, vec3 levels, float d) {
      vec3 steps = levels - 1.0;
      return clamp(floor(c * steps + 0.5 + d) / steps, 0.0, 1.0);
    }

    void main() {
      float px = max(uPixelSize, 1.0);
      vec2 cell = floor(vUv * uResolution / px);
      vec2 uv = (cell + 0.5) * px / uResolution;
      vec4 src = texture2D(tDiffuse, uv);
      vec3 c = clamp(src.rgb, 0.0, 1.0);
      float d = (bayer4(cell) - 0.5) * uDither;

      vec3 outCol;
      if (uPalette == 0) {
        outCol = quantize(c, vec3(8.0, 8.0, 4.0), d);
      } else if (uPalette == 1) {
        outCol = quantize(c, vec3(6.0), d);
      } else if (uPalette == 2) {
        // EGA's levels are a third apart, so a dither of one third of a step
        // is what spreads a gradient across neighbouring palette entries.
        vec3 target = clamp(c + d * 0.333, 0.0, 1.0);
        float best = 1e9;
        outCol = uEga[0];
        for (int i = 0; i < 16; i++) {
          vec3 diff = target - uEga[i];
          float dist = dot(diff, diff * vec3(0.3, 0.59, 0.11));
          if (dist < best) {
            best = dist;
            outCol = uEga[i];
          }
        }
      } else {
        float g = dot(c, vec3(0.299, 0.587, 0.114));
        outCol = vec3(quantize(vec3(g), vec3(16.0), d).r);
      }

      float row = mod(floor(gl_FragCoord.y / max(1.0, floor(px * 0.5 + 0.5))), 2.0);
      outCol *= 1.0 - uScanlines * 0.5 * row;
      gl_FragColor = vec4(outCol, src.a);
    }
  `,
};
