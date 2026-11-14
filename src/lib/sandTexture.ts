import * as THREE from "three";

// The seafloor sand photo (src/assets/sand_cc0_512.jpg.asset.json) lives on
// a /__l5e/assets-v1/... URL that only Lovable's hosting proxies. Anywhere
// else (the self-hosted serve.mjs/nginx deploy, `vite dev`, a Capacitor
// build before its first online visit) that request 404s, and three.js then
// binds an empty texture, which samples as pure black. Every shader that
// reads the sand texture (the seafloor, the RAYTRACED refraction floor)
// multiplies its colour by that sample, so every non-cloud BOTTEN option
// with TEXTUR on turned into a black sheet with only the caustic streaks
// showing.
//
// So the texture starts out as a procedural, tileable sand grain drawn on a
// canvas (centred on mid-grey, which is what the shaders' contrast curve
// expects from the photo), and the photo replaces it in place once it has
// actually loaded. If the photo never loads, the procedural grain stays.

const SIZE = 256;

function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

// Value noise that wraps every `period` cells, so the canvas tiles seamlessly
// under RepeatWrapping.
function tiledNoise(x: number, y: number, period: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const x0 = ((xi % period) + period) % period;
  const y0 = ((yi % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const y1 = (y0 + 1) % period;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(x0, y0, seed);
  const b = hash(x1, y0, seed);
  const c = hash(x0, y1, seed);
  const d = hash(x1, y1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function drawProceduralSand(): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      // Soft dunes/ripples, medium clumps and fine per-pixel grain.
      let n = 0;
      n += 0.35 * tiledNoise((x / SIZE) * 4, (y / SIZE) * 4, 4, 1);
      n += 0.25 * tiledNoise((x / SIZE) * 16, (y / SIZE) * 16, 16, 2);
      n += 0.15 * tiledNoise((x / SIZE) * 64, (y / SIZE) * 64, 64, 3);
      const grain = hash(x, y, 4);
      n += 0.25 * grain;
      // n is roughly 0..1 around 0.5; keep the contrast gentle.
      const g = 0.62 + (n - 0.5) * 0.55;
      // Slight warm bias (the photo is warm sand) — uColor does the real tint.
      const i = (y * SIZE + x) * 4;
      img.data[i] = Math.round(Math.min(1, g * 1.04) * 255);
      img.data[i + 1] = Math.round(Math.min(1, g) * 255);
      img.data[i + 2] = Math.round(Math.min(1, g * 0.92) * 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * The seafloor sand texture: procedural grain right away, swapped for the
 * photo at `url` once (and only if) it loads.
 */
export function createSandTexture(url: string, maxAnisotropy: number): THREE.Texture {
  const tex = new THREE.Texture();
  const fallback = drawProceduralSand();
  if (fallback) {
    tex.image = fallback;
    tex.needsUpdate = true;
  }
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  tex.colorSpace = THREE.SRGBColorSpace;
  new THREE.ImageLoader().load(
    url,
    (image) => {
      tex.image = image;
      tex.needsUpdate = true;
    },
    undefined,
    () => {
      // Photo unavailable on this host — keep the procedural grain.
    },
  );
  return tex;
}
