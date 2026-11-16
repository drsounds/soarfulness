import * as THREE from "three";
import { bulbLevel, paletteIndex, stringLightColors, type StringLight } from "./stringLights";

// Writes one frame of bulb colors: the instanced bulb mesh (palette color ×
// animation level, with a glassy floor so unlit bulbs aren't black) and the
// glow color array. Shared by hanging strings and the edge lights.

export type BulbLook = Pick<
  StringLight,
  | "palette"
  | "customColors"
  | "pattern"
  | "blockSize"
  | "anim"
  | "speed"
  | "animDepth"
  | "direction"
  | "brightness"
  | "glow"
>;

export class BulbShader {
  private readonly palette: THREE.Color[] = [];
  private readonly color = new THREE.Color();
  private readonly out = new THREE.Color();
  private readonly other = new THREE.Color();

  /**
   * @param levels optional per-bulb animation level output
   * @param glowMul 0..1 daytime glow scale
   */
  shade(
    t: number,
    look: BulbLook,
    n: number,
    seeds: ArrayLike<number>,
    bulbs: THREE.InstancedMesh,
    glowArr: Float32Array,
    glowMul: number,
    levels?: Float32Array,
  ) {
    const colors = stringLightColors(look);
    while (this.palette.length < colors.length) this.palette.push(new THREE.Color());
    for (let c = 0; c < colors.length; c++) this.palette[c].set(colors[c]);
    const shift =
      look.anim === "colorshift" ? Math.floor(t * Math.max(0, look.speed) * 2) * look.direction : 0;
    for (let i = 0; i < n; i++) {
      const k = (((i - shift) % n) + n) % n;
      const pi = paletteIndex(look.pattern, k, n, colors.length, look.blockSize);
      this.color.copy(this.palette[pi.a]);
      if (pi.f > 0) this.color.lerp(this.other.copy(this.palette[pi.b]), pi.f);
      const lvl = bulbLevel(
        look.anim,
        t,
        i,
        n,
        look.speed,
        look.animDepth,
        look.direction,
        seeds[i],
      );
      if (levels) levels[i] = lvl;
      const v = 0.12 + 0.88 * lvl;
      this.out.copy(this.color).multiplyScalar(v * Math.max(0.15, look.brightness));
      bulbs.setColorAt(i, this.out);
      const g = lvl * look.glow * glowMul;
      glowArr[i * 3] = this.color.r * g;
      glowArr[i * 3 + 1] = this.color.g * g;
      glowArr[i * 3 + 2] = this.color.b * g;
    }
    if (bulbs.instanceColor) bulbs.instanceColor.needsUpdate = true;
  }
}
