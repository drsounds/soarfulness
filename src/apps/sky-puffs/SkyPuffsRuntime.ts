import * as THREE from "three";
import type { AppRuntime, SceneAppContext } from "@/core/apps/types";
import type { SkyPuffsSettings } from "./settings";

// SKY PUFFS: a pool of this many puff meshes is always created (cheap —
// shared geometry, one small cloned material each); SKY PUFFS COUNT just
// controls how many of them update() keeps active, so raising/lowering the
// dial never adds/removes actual scene objects.
const MAX_SKY_PUFFS = 20;
// Seconds for one puff's fade-in/hold/fade-out/respawn cycle at SKY PUFFS Y
// FREQUENCY = 1; the dial divides this down, so higher = more frequent.
const SKY_PUFF_BASE_CYCLE = 45;

type PuffState = {
  x: number;
  y: number;
  z: number;
  seed: number;
  cycleT: number;
  cycleLen: number;
};

// Picks a fresh spot for a sky puff to fade in at: a random bearing/distance
// from wherever the camera currently is (so puffs keep appearing somewhere
// visible even as the camera roams) and a random altitude within a fixed
// band, plus a random noise seed so no two puffs look identical.
function randomSkyPuffSpot(camX: number, camZ: number) {
  const angle = Math.random() * Math.PI * 2;
  const radius = 700 + Math.random() * 1800;
  return {
    x: camX + Math.cos(angle) * radius,
    z: camZ + Math.sin(angle) * radius,
    y: 220 + Math.random() * 700,
    seed: Math.random() * 1000,
  };
}

/** What the host tells the puffs each frame. */
export type SkyPuffsInputs = {
  dt: number;
  /** Camera position in x/z: puffs respawn around it. */
  camX: number;
  camZ: number;
  /** Low-end devices skip the puffs. */
  lowEnd: boolean;
};

/**
 * SKY PUFFS: optional individual, randomly placed puffy clouds. A dedicated
 * shader (rather than the cloud decks') confines its fbm cloud shape inside a
 * circular vignette (see uOpacity/uSeed) so each puff reads as one soft blob
 * on its own small plane instead of the deck's giant, hard-edged-if-cropped
 * tiled plane.
 */
export class SkyPuffsRuntime implements AppRuntime<SkyPuffsSettings> {
  private readonly scene: THREE.Scene;
  private readonly geo = new THREE.PlaneGeometry(1, 1, 1, 1);
  private readonly meshes: THREE.Mesh[] = [];
  private readonly states: PuffState[] = [];

  constructor(ctx: SceneAppContext) {
    this.scene = ctx.scene;
    this.geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < MAX_SKY_PUFFS; i++) {
      const puffMat = new THREE.ShaderMaterial({
        uniforms: {
          uOpacity: { value: 0 },
          uSeed: { value: 0 },
          uColor: { value: new THREE.Color(0xffffff) },
        },
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          precision highp float;
          varying vec2 vUv;
          uniform float uOpacity;
          uniform float uSeed;
          uniform vec3 uColor;
          float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
          float vnoise(vec2 p){
            vec2 i = floor(p); vec2 f = fract(p);
            float a = hash(i);
            float b = hash(i + vec2(1.0,0.0));
            float c = hash(i + vec2(0.0,1.0));
            float d = hash(i + vec2(1.0,1.0));
            vec2 u = f*f*(3.0-2.0*f);
            return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
          }
          float fbm(vec2 p){
            float v = 0.0; float a = 0.5;
            for (int i = 0; i < 5; i++) {
              v += a * vnoise(p);
              p *= 2.02; a *= 0.5;
            }
            return v;
          }
          void main(){
            vec2 c = vUv - 0.5;
            float dist = length(c) * 2.0;
            float edge = 1.0 - smoothstep(0.55, 1.0, dist);
            if (edge < 0.01) discard;
            vec2 p = vUv * 3.0 + uSeed;
            float n = fbm(p);
            float cloud = smoothstep(0.35, 0.75, n) * edge;
            if (cloud < 0.01) discard;
            float shade = 0.85 + 0.25 * fbm(p * 2.3 + 5.0);
            vec3 col = uColor * shade;
            gl_FragColor = vec4(col, cloud * uOpacity);
          }
        `,
      });
      const mesh = new THREE.Mesh(this.geo, puffMat);
      mesh.visible = false;
      mesh.renderOrder = -1;
      this.scene.add(mesh);
      this.meshes.push(mesh);
      this.states.push({
        ...randomSkyPuffSpot(0, 0),
        cycleT: Math.random() * SKY_PUFF_BASE_CYCLE,
        cycleLen: SKY_PUFF_BASE_CYCLE,
      });
    }
  }

  /** Re-rolls every puff's spot around (x, z): called once when the scene is built. */
  scatterAround(x: number, z: number) {
    for (const state of this.states) {
      const spot = randomSkyPuffSpot(x, z);
      state.x = spot.x;
      state.y = spot.y;
      state.z = spot.z;
      state.seed = spot.seed;
    }
  }

  /**
   * Each active puff runs its own fade-in/hold/fade-out timer (a smooth sin()
   * bump rather than three hard-cut phases) and, once a full cycle elapses,
   * is instantly moved to a fresh random spot near the camera while invisible
   * at the cycle seam — so raising Y FREQUENCY makes puffs come and go more
   * often without ever popping.
   */
  update(i: SkyPuffsInputs, s: Readonly<SkyPuffsSettings>) {
    const activeCount =
      s.skyPuffsOn && !i.lowEnd
        ? Math.min(this.meshes.length, Math.max(0, Math.round(s.skyPuffsCount)))
        : 0;
    const puffSize = Math.max(1, s.skyPuffsSize);
    const puffFreq = Math.max(0.01, s.skyPuffsFreq);
    for (let n = 0; n < this.meshes.length; n++) {
      const mesh = this.meshes[n];
      if (n >= activeCount) {
        mesh.visible = false;
        continue;
      }
      const state = this.states[n];
      state.cycleLen = SKY_PUFF_BASE_CYCLE / puffFreq;
      state.cycleT += i.dt;
      if (state.cycleT >= state.cycleLen) {
        state.cycleT -= state.cycleLen;
        const spot = randomSkyPuffSpot(i.camX, i.camZ);
        state.x = spot.x;
        state.y = spot.y;
        state.z = spot.z;
        state.seed = spot.seed;
      }
      const cycleFrac = state.cycleT / state.cycleLen;
      // 0 at both ends of the cycle, 1 at the midpoint — a plain sin() bump
      // gives a soft ease in/out for free without separate phases.
      const fade = Math.sin(Math.PI * Math.min(1, Math.max(0, cycleFrac)));
      const mat = mesh.material as THREE.ShaderMaterial;
      mat.uniforms.uOpacity.value = fade * s.skyPuffsOpacity;
      mat.uniforms.uSeed.value = state.seed;
      mesh.position.set(state.x, state.y, state.z);
      mesh.scale.set(puffSize, 1, puffSize);
      mesh.visible = fade > 0.003;
    }
  }

  dispose() {
    for (const mesh of this.meshes) {
      this.scene.remove(mesh);
      (mesh.material as THREE.Material).dispose();
    }
    this.meshes.length = 0;
    this.states.length = 0;
    this.geo.dispose();
  }
}
