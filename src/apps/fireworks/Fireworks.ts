import * as THREE from "three";
import { FireworksAudio } from "./FireworksAudio";

// FYRVERKERI: rockets launched from the water some way in front of the
// camera, bursting into stars with trails, crackle and a colored flash that
// lights up the scene and the water.
//
// - Visuals: one THREE.Points cloud of up to FIREWORKS_MAX_PARTICLES CPU-
//   simulated particles (rockets, stars, trail sparks, crackle pops), drawn
//   additively, plus a few soft halo sprites for the burst flash.
// - Lights: FIREWORKS_LIGHTS colored flashes that follow the latest bursts.
//   They're fed both to a pool of THREE.PointLights (lit .glb scenes) and,
//   through lightUniforms(), to the ocean shader so the bursts glint and
//   reflect on the waves.
// - Sound: FireworksAudio synthesizes the launch whoosh/whistle, the boom
//   with its echo over the water and the crackle with WebAudio, so no audio
//   assets are needed. Every sound is delayed by its distance (speed of
//   sound), panned left/right and attenuated with distance.

export const FIREWORKS_MAX_PARTICLES = 24000;
export const FIREWORKS_LIGHTS = 4;

const GRAVITY = 9.81;

export type FireworksConfig = {
  /** 0..~4 (FYRVERKERI INTENSITET): burst size, star count and brightness. */
  intensity: number;
  /** Rockets per minute (RAKETER/MIN). */
  rate: number;
  /** Typical distance from the camera to the launch site (m). */
  distance: number;
  /** 0 = no light; scales the colored flash on the scene and water. */
  lightStrength: number;
  /** World Y of the water surface, where rockets are launched from. */
  waterLevel: number;
  /** 0..1, muffles the sound while the camera is under water. */
  underwater: number;
  /** Drawing-buffer height in pixels, for perspective point sizes. */
  pixelHeight: number;
  /** Halves star counts on low-end devices. */
  lowEnd: boolean;
  /** Plays the synthesized sound. */
  soundOn: boolean;
  /** 0..1 */
  volume: number;
};

type ShellType = "peony" | "chrysanthemum" | "willow" | "ring" | "crackle" | "palm" | "strobe";

const SHELL_TYPES: { type: ShellType; weight: number }[] = [
  { type: "peony", weight: 3 },
  { type: "chrysanthemum", weight: 3 },
  { type: "willow", weight: 1.5 },
  { type: "ring", weight: 1.2 },
  { type: "crackle", weight: 1.5 },
  { type: "palm", weight: 1 },
  { type: "strobe", weight: 1 },
];

// Star colors (linear-ish RGB, > 1 burns toward white with additive blend).
const PALETTE: [number, number, number][] = [
  [1.0, 0.18, 0.12], // red
  [0.15, 1.0, 0.25], // green
  [0.2, 0.45, 1.0], // blue
  [1.0, 0.72, 0.2], // gold
  [0.75, 0.25, 1.0], // purple
  [1.0, 0.95, 0.85], // white
  [0.15, 0.9, 1.0], // cyan
  [1.0, 0.4, 0.1], // orange
  [1.0, 0.3, 0.7], // pink
];
const GOLD: [number, number, number] = [1.0, 0.62, 0.22];
const SPARK: [number, number, number] = [1.0, 0.7, 0.35];

// Particle kinds.
const K_ROCKET = 0;
const K_STAR = 1;
const K_TRAIL = 2;
const K_POP = 3;

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function pickShell(): ShellType {
  let total = 0;
  for (const s of SHELL_TYPES) total += s.weight;
  let r = Math.random() * total;
  for (const s of SHELL_TYPES) {
    r -= s.weight;
    if (r <= 0) return s.type;
  }
  return "peony";
}

function pickColor(): [number, number, number] {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}

// Uniformly distributed direction on the unit sphere.
function randomDir(out: THREE.Vector3) {
  const z = Math.random() * 2 - 1;
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return out.set(r * Math.cos(a), z, r * Math.sin(a));
}

type Shell = {
  type: ShellType;
  color: [number, number, number];
  color2: [number, number, number] | null;
  /** Burst radius (m). */
  radius: number;
};

type Flash = {
  pos: THREE.Vector3;
  color: THREE.Color;
  /** Peak luminous intensity (candela, three.js physical units). */
  peak: number;
  age: number;
  life: number;
};

export class Fireworks {
  readonly points: THREE.Points;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly posAttr: THREE.BufferAttribute;
  private readonly colAttr: THREE.BufferAttribute;
  private readonly sizeAttr: THREE.BufferAttribute;
  private readonly uniforms: {
    uProjScale: { value: number };
    uMinSize: { value: number };
  };

  // Struct-of-arrays particle state; live particles are packed in [0, count).
  private count = 0;
  private readonly p = new Float32Array(FIREWORKS_MAX_PARTICLES * 3);
  private readonly v = new Float32Array(FIREWORKS_MAX_PARTICLES * 3);
  private readonly c = new Float32Array(FIREWORKS_MAX_PARTICLES * 3);
  private readonly age = new Float32Array(FIREWORKS_MAX_PARTICLES);
  private readonly life = new Float32Array(FIREWORKS_MAX_PARTICLES);
  private readonly size = new Float32Array(FIREWORKS_MAX_PARTICLES);
  private readonly drag = new Float32Array(FIREWORKS_MAX_PARTICLES);
  private readonly grav = new Float32Array(FIREWORKS_MAX_PARTICLES);
  private readonly trail = new Float32Array(FIREWORKS_MAX_PARTICLES);
  private readonly kind = new Uint8Array(FIREWORKS_MAX_PARTICLES);
  private readonly flags = new Uint8Array(FIREWORKS_MAX_PARTICLES); // 1 crackle, 2 strobe
  private readonly shellIdx = new Int32Array(FIREWORKS_MAX_PARTICLES);

  // Shells carried by rockets, indexed by shellIdx.
  private shells: (Shell | null)[] = [];

  private readonly flashes: Flash[] = [];
  private readonly lights: THREE.PointLight[] = [];
  private readonly halos: THREE.Sprite[] = [];
  private readonly haloTex: THREE.Texture;
  private readonly haloState: { age: number; life: number; peak: number }[] = [];

  // Ocean-shader light uniforms (see lightUniforms()).
  readonly lightPos: THREE.Vector4[] = [];
  readonly lightCol: THREE.Vector3[] = [];

  private nextLaunch = 0.4;
  private time = 0;
  private active = false;
  private lightsAttached = false;
  private readonly scene: THREE.Scene;
  readonly audio = new FireworksAudio();

  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private readonly camFwd = new THREE.Vector3();
  private readonly camRight = new THREE.Vector3();
  private readonly camPos = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.geometry = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(new Float32Array(FIREWORKS_MAX_PARTICLES * 3), 3);
    this.colAttr = new THREE.BufferAttribute(new Float32Array(FIREWORKS_MAX_PARTICLES * 3), 3);
    this.sizeAttr = new THREE.BufferAttribute(new Float32Array(FIREWORKS_MAX_PARTICLES), 1);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.colAttr.setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute("position", this.posAttr);
    this.geometry.setAttribute("aColor", this.colAttr);
    this.geometry.setAttribute("aSize", this.sizeAttr);
    this.geometry.setDrawRange(0, 0);
    this.uniforms = { uProjScale: { value: 800 }, uMinSize: { value: 1.5 } };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        attribute float aSize;
        uniform float uProjScale;
        uniform float uMinSize;
        varying vec3 vColor;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          float dist = max(-mv.z, 0.1);
          float px = aSize * uProjScale / dist;
          // Keep far sparks visible as at least a pixel or two, dimming them
          // a little instead of letting them vanish.
          float s = max(px, uMinSize);
          gl_PointSize = min(s, 128.0);
          vColor = aColor * clamp(px / uMinSize, 0.35, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float r = length(c) * 2.0;
          if (r > 1.0) discard;
          // Hot white core inside a colored glow.
          float glow = pow(1.0 - r, 1.6);
          float core = smoothstep(0.45, 0.0, r);
          vec3 col = vColor * glow + vec3(1.0, 0.95, 0.85) * core * min(1.0, dot(vColor, vec3(0.33)));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.name = "fireworks";
    this.points.frustumCulled = false;
    this.points.visible = false;
    this.points.renderOrder = 11;
    scene.add(this.points);

    this.haloTex = makeHaloTexture();
    for (let i = 0; i < FIREWORKS_LIGHTS; i++) {
      this.lightPos.push(new THREE.Vector4(0, -1e6, 0, 0));
      this.lightCol.push(new THREE.Vector3());
      const mat = new THREE.SpriteMaterial({
        map: this.haloTex,
        color: 0xffffff,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
        opacity: 0,
      });
      const halo = new THREE.Sprite(mat);
      halo.visible = false;
      halo.renderOrder = 10;
      halo.name = "fireworks-halo";
      scene.add(halo);
      this.halos.push(halo);
      this.haloState.push({ age: 0, life: 1, peak: 0 });
    }
  }

  /** The four ocean-shader light slots: xyz position, color·intensity (cd). */
  lightUniforms() {
    return { pos: this.lightPos, col: this.lightCol };
  }

  /** True while anything (particles, lights) is still on screen. */
  get busy() {
    return this.count > 0 || this.flashes.length > 0;
  }

  /**
   * Advances the show. With `on` false no new rockets are launched, but the
   * ones in the air finish so switching off never cuts a burst in half.
   */
  update(dt: number, camera: THREE.PerspectiveCamera, on: boolean, cfg: FireworksConfig) {
    const step = Math.min(Math.max(dt, 0), 0.1);
    this.time += step;
    camera.getWorldPosition(this.camPos);
    camera.getWorldDirection(this.camFwd);
    this.camRight.crossVectors(this.camFwd, camera.up).normalize();
    this.audio.update(cfg.soundOn && (on || this.busy), cfg.volume, cfg.underwater);

    if (on) {
      if (!this.active) {
        // Turning it on: first rocket shortly after.
        this.active = true;
        this.nextLaunch = this.time + 0.4;
      }
      const rate = Math.max(0, cfg.rate);
      if (rate > 0 && this.time >= this.nextLaunch) {
        this.launchVolley(cfg);
        const mean = 60 / rate;
        this.nextLaunch = this.time + Math.max(0.05, -Math.log(1 - Math.random()) * mean);
      }
    } else {
      this.active = false;
    }

    this.simulate(step, cfg);
    this.updateFlashes(step, cfg);

    this.uniforms.uProjScale.value =
      cfg.pixelHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    this.points.visible = this.count > 0;
  }

  private launchVolley(cfg: FireworksConfig) {
    const k = Math.max(0, cfg.intensity);
    // Occasionally a salvo of several rockets from neighbouring tubes.
    const salvo =
      Math.random() < 0.08 + 0.1 * Math.min(1, k) ? 2 + Math.floor(Math.random() * (2 + k)) : 1;
    // Launch site: in front of the camera, within ±35° of the view.
    const fx = this.camFwd.x;
    const fz = this.camFwd.z;
    const base = Math.hypot(fx, fz) > 1e-3 ? Math.atan2(fz, fx) : Math.random() * Math.PI * 2;
    const ang = base + rand(-0.6, 0.6);
    const dist = Math.max(20, cfg.distance) * rand(0.75, 1.25);
    const cx = this.camPos.x + Math.cos(ang) * dist;
    const cz = this.camPos.z + Math.sin(ang) * dist;
    const n = Math.min(salvo, 8);
    for (let i = 0; i < n; i++) {
      const spread = dist * 0.08 * (i - (n - 1) / 2);
      this.launch(
        cx - Math.sin(ang) * spread + rand(-3, 3),
        cfg.waterLevel + 0.5,
        cz + Math.cos(ang) * spread + rand(-3, 3),
        dist,
        cfg,
        i * rand(0.05, 0.25),
      );
    }
  }

  private launch(
    x: number,
    y: number,
    z: number,
    dist: number,
    cfg: FireworksConfig,
    delay: number,
  ) {
    const k = Math.max(0, cfg.intensity);
    const height =
      THREE.MathUtils.clamp(dist * rand(0.32, 0.5), 25, 400) * (0.85 + 0.15 * Math.sqrt(k));
    const vy = Math.sqrt(2 * GRAVITY * height);
    const i = this.alloc();
    if (i < 0) return;
    const shell: Shell = {
      type: pickShell(),
      color: pickColor(),
      color2: Math.random() < 0.3 ? pickColor() : null,
      radius: 55 * (0.55 + 0.45 * Math.sqrt(Math.max(k, 0.05))) * rand(0.8, 1.2),
    };
    if (shell.type === "willow" || shell.type === "palm") shell.color = GOLD;
    let si = this.shells.indexOf(null);
    if (si < 0) {
      si = this.shells.length;
      this.shells.push(shell);
    } else this.shells[si] = shell;
    this.set(i, K_ROCKET, x, y, z, rand(-2.5, 2.5), vy, rand(-2.5, 2.5), SPARK, 0.9, 1.2, 0, 1, 70);
    this.shellIdx[i] = si;
    // A negative age holds the rocket in its tube for the salvo stagger.
    this.age[i] = -delay;
    this.life[i] = (vy / GRAVITY) * rand(0.88, 0.98);
    this.audio.launch(this.tmp.set(x, y, z), this.camPos, this.camRight, delay, this.life[i]);
  }

  private alloc(): number {
    if (this.count >= FIREWORKS_MAX_PARTICLES) return -1;
    return this.count++;
  }

  private set(
    i: number,
    kind: number,
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    col: [number, number, number],
    bright: number,
    size: number,
    drag: number,
    grav: number,
    trail: number,
  ) {
    const i3 = i * 3;
    this.p[i3] = x;
    this.p[i3 + 1] = y;
    this.p[i3 + 2] = z;
    this.v[i3] = vx;
    this.v[i3 + 1] = vy;
    this.v[i3 + 2] = vz;
    this.c[i3] = col[0] * bright;
    this.c[i3 + 1] = col[1] * bright;
    this.c[i3 + 2] = col[2] * bright;
    this.kind[i] = kind;
    this.size[i] = size;
    this.drag[i] = drag;
    this.grav[i] = grav;
    this.trail[i] = trail;
    this.age[i] = 0;
    this.life[i] = 1;
    this.flags[i] = 0;
    this.shellIdx[i] = -1;
  }

  private kill(i: number) {
    const last = --this.count;
    if (i === last) return;
    const i3 = i * 3;
    const l3 = last * 3;
    for (let a = 0; a < 3; a++) {
      this.p[i3 + a] = this.p[l3 + a];
      this.v[i3 + a] = this.v[l3 + a];
      this.c[i3 + a] = this.c[l3 + a];
    }
    this.age[i] = this.age[last];
    this.life[i] = this.life[last];
    this.size[i] = this.size[last];
    this.drag[i] = this.drag[last];
    this.grav[i] = this.grav[last];
    this.trail[i] = this.trail[last];
    this.kind[i] = this.kind[last];
    this.flags[i] = this.flags[last];
    this.shellIdx[i] = this.shellIdx[last];
  }

  private burst(i: number, cfg: FireworksConfig) {
    const si = this.shellIdx[i];
    const shell = si >= 0 ? this.shells[si] : null;
    if (si >= 0) this.shells[si] = null;
    if (!shell) return;
    const k = Math.max(0, cfg.intensity);
    const i3 = i * 3;
    const ox = this.p[i3];
    const oy = this.p[i3 + 1];
    const oz = this.p[i3 + 2];
    const ivx = this.v[i3] * 0.3;
    const ivy = this.v[i3 + 1] * 0.3;
    const ivz = this.v[i3 + 2] * 0.3;
    const bright = 1.1 + 0.35 * Math.min(k, 4);
    const lowScale = cfg.lowEnd ? 0.5 : 1;
    const dir = this.tmp2;

    let n = 0;
    let drag = 1.4;
    let life = 1.8;
    let trail = 0;
    let size = 2.4;
    let grav = 1;
    let flags = 0;
    switch (shell.type) {
      case "peony":
        n = 140;
        break;
      case "chrysanthemum":
        n = 110;
        trail = 22;
        life = 2.0;
        break;
      case "willow":
        n = 90;
        drag = 2.4;
        life = 4.2;
        trail = 30;
        size = 1.9;
        grav = 0.7;
        break;
      case "ring":
        n = 80;
        life = 1.7;
        break;
      case "crackle":
        n = 90;
        life = 1.3;
        flags = 1;
        trail = 8;
        break;
      case "palm":
        n = 9;
        drag = 0.9;
        life = 2.4;
        trail = 90;
        size = 3.2;
        break;
      case "strobe":
        n = 120;
        life = 2.2;
        flags = 2;
        size = 2;
        break;
    }
    n = Math.round(n * (0.45 + 0.55 * k) * lowScale);
    // Stars leave at the speed that, against their drag, carries them out
    // to the shell's radius.
    const speed = shell.radius * drag;
    let ringN: THREE.Vector3 | null = null;
    let ringU: THREE.Vector3 | null = null;
    let ringV: THREE.Vector3 | null = null;
    if (shell.type === "ring") {
      ringN = randomDir(new THREE.Vector3());
      ringN.y = Math.abs(ringN.y) * 0.4;
      ringN.normalize();
      ringU = new THREE.Vector3().crossVectors(ringN, new THREE.Vector3(0, 1, 0)).normalize();
      if (ringU.lengthSq() < 1e-6) ringU.set(1, 0, 0);
      ringV = new THREE.Vector3().crossVectors(ringN, ringU).normalize();
    }
    for (let s = 0; s < n; s++) {
      const j = this.alloc();
      if (j < 0) break;
      let sp = speed * rand(0.92, 1.05);
      if (shell.type === "ring" && ringU && ringV) {
        const a = (s / n) * Math.PI * 2;
        dir.copy(ringU).multiplyScalar(Math.cos(a)).addScaledVector(ringV, Math.sin(a));
      } else {
        randomDir(dir);
        if (shell.type === "palm") {
          dir.y = Math.abs(dir.y) * 0.6 + 0.4;
          dir.normalize();
        }
        if (shell.type === "willow" || shell.type === "crackle") sp *= rand(0.7, 1.05);
      }
      const col = shell.color2 && s % 2 === 1 ? shell.color2 : shell.color;
      this.set(
        j,
        K_STAR,
        ox,
        oy,
        oz,
        ivx + dir.x * sp,
        ivy + dir.y * sp,
        ivz + dir.z * sp,
        col,
        bright,
        size,
        drag,
        grav,
        trail,
      );
      this.life[j] = life * rand(0.8, 1.15);
      this.flags[j] = flags;
    }

    // Flash: halo + light.
    const avg = shell.color2
      ? [
          (shell.color[0] + shell.color2[0]) / 2,
          (shell.color[1] + shell.color2[1]) / 2,
          (shell.color[2] + shell.color2[2]) / 2,
        ]
      : shell.color;
    const flash: Flash = {
      pos: new THREE.Vector3(ox, oy, oz),
      color: new THREE.Color(avg[0], avg[1], avg[2]),
      peak: 0.6 + 0.4 * Math.min(k, 4),
      age: 0,
      life: Math.max(1.2, life * 0.9),
    };
    if (this.flashes.length >= FIREWORKS_LIGHTS) this.flashes.shift();
    this.flashes.push(flash);
    this.startHalo(flash, shell.radius, k);

    this.audio.burst(
      flash.pos,
      this.camPos,
      this.camRight,
      Math.min(2, 0.5 + 0.35 * k) * (shell.radius / 55),
      shell.type === "crackle" || shell.type === "strobe" ? shell.type : null,
      life,
    );
  }

  private startHalo(flash: Flash, radius: number, k: number) {
    // Reuse the halo that's the most faded.
    let best = 0;
    let bestLeft = Infinity;
    for (let h = 0; h < this.halos.length; h++) {
      const st = this.haloState[h];
      const left = this.halos[h].visible ? st.life - st.age : -1;
      if (left < bestLeft) {
        bestLeft = left;
        best = h;
      }
    }
    const halo = this.halos[best];
    halo.position.copy(flash.pos);
    halo.scale.setScalar(radius * 2.4);
    (halo.material as THREE.SpriteMaterial).color.copy(flash.color);
    halo.visible = true;
    this.haloState[best] = { age: 0, life: 0.9, peak: 0.35 + 0.12 * Math.min(k, 4) };
  }

  private simulate(dt: number, cfg: FireworksConfig) {
    const t = this.time;
    for (let i = 0; i < this.count;) {
      this.age[i] += dt;
      const a = this.age[i];
      if (a < 0) {
        // Rocket waiting in its tube.
        this.writeOut(i, 0);
        i++;
        continue;
      }
      const kind = this.kind[i];
      if (a >= this.life[i]) {
        if (kind === K_ROCKET) this.burst(i, cfg);
        else if (kind === K_STAR && this.flags[i] === 1) this.pop(i);
        // burst()/pop() may have appended particles; kill() swaps in the
        // last one, which is processed on the next pass of this index.
        this.kill(i);
        continue;
      }
      const i3 = i * 3;
      const d = Math.exp(-this.drag[i] * dt);
      this.v[i3] *= d;
      this.v[i3 + 1] = this.v[i3 + 1] * d - GRAVITY * this.grav[i] * dt;
      this.v[i3 + 2] *= d;
      this.p[i3] += this.v[i3] * dt;
      this.p[i3 + 1] += this.v[i3 + 1] * dt;
      this.p[i3 + 2] += this.v[i3 + 2] * dt;

      // Trails: sparks shed behind rockets and trailing stars.
      const tr = this.trail[i];
      if (tr > 0) {
        let emit = tr * dt;
        while (emit > 0 && this.count < FIREWORKS_MAX_PARTICLES) {
          if (emit < 1 && Math.random() > emit) break;
          emit -= 1;
          const j = this.alloc();
          const life = this.life[i];
          const fade = kind === K_STAR ? 1 - a / life : 1;
          const col: [number, number, number] =
            kind === K_ROCKET
              ? SPARK
              : [
                  (this.c[i3] * 0.5 + GOLD[0] * 0.5) * fade,
                  (this.c[i3 + 1] * 0.5 + GOLD[1] * 0.5) * fade,
                  (this.c[i3 + 2] * 0.5 + GOLD[2] * 0.5) * fade,
                ];
          this.set(
            j,
            K_TRAIL,
            this.p[i3] + rand(-0.2, 0.2),
            this.p[i3 + 1] + rand(-0.2, 0.2),
            this.p[i3 + 2] + rand(-0.2, 0.2),
            this.v[i3] * 0.15 + rand(-1, 1),
            this.v[i3 + 1] * 0.15 + rand(-1, 1),
            this.v[i3 + 2] * 0.15 + rand(-1, 1),
            col,
            kind === K_ROCKET ? 0.9 : 0.55,
            kind === K_ROCKET ? 1.1 : 1.1,
            2.5,
            0.35,
            0,
          );
          this.life[j] = kind === K_ROCKET ? rand(0.35, 0.8) : rand(0.4, 1.1);
        }
      }

      // Brightness envelope.
      const u = a / this.life[i];
      let bright: number;
      if (kind === K_ROCKET) bright = 1;
      else if (kind === K_POP) bright = 1.6 * (1 - u);
      else if (kind === K_TRAIL) bright = (1 - u) * (1 - u);
      else {
        // Stars: brief flare, steady, then fade with a last flicker.
        bright = (u < 0.06 ? 1.6 - u * 10 : 1) * (u > 0.6 ? 1 - (u - 0.6) / 0.4 : 1);
        if (u > 0.7) bright *= 0.7 + 0.3 * Math.sin(t * 40 + i);
        if (this.flags[i] === 2) bright *= Math.sin(t * 28 + i * 1.7) > 0.2 ? 1.2 : 0.08;
      }
      this.writeOut(i, Math.max(0, bright));
      i++;
    }
    this.geometry.setDrawRange(0, this.count);
    if (this.count === 0) return;
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
    this.posAttr.clearUpdateRanges();
    this.posAttr.addUpdateRange(0, this.count * 3);
    this.colAttr.clearUpdateRanges();
    this.colAttr.addUpdateRange(0, this.count * 3);
    this.sizeAttr.clearUpdateRanges();
    this.sizeAttr.addUpdateRange(0, this.count);
  }

  private writeOut(i: number, bright: number) {
    const i3 = i * 3;
    const pos = this.posAttr.array as Float32Array;
    const col = this.colAttr.array as Float32Array;
    const sz = this.sizeAttr.array as Float32Array;
    pos[i3] = this.p[i3];
    pos[i3 + 1] = this.p[i3 + 1];
    pos[i3 + 2] = this.p[i3 + 2];
    col[i3] = this.c[i3] * bright;
    col[i3 + 1] = this.c[i3 + 1] * bright;
    col[i3 + 2] = this.c[i3 + 2] * bright;
    sz[i] = this.size[i];
  }

  // Crackle: a dying star pops into a few tiny white flashes.
  private pop(i: number) {
    const i3 = i * 3;
    const n = 3 + Math.floor(Math.random() * 3);
    for (let s = 0; s < n; s++) {
      const j = this.alloc();
      if (j < 0) return;
      randomDir(this.tmp2);
      const sp = rand(2, 6);
      this.set(
        j,
        K_POP,
        this.p[i3],
        this.p[i3 + 1],
        this.p[i3 + 2],
        this.tmp2.x * sp,
        this.tmp2.y * sp,
        this.tmp2.z * sp,
        [1, 0.97, 0.9],
        1,
        1.1,
        4,
        0.2,
        0,
      );
      // Pops go off one after another over a few tenths of a second.
      this.age[j] = -rand(0, 0.35);
      this.life[j] = rand(0.06, 0.14);
    }
  }

  private updateFlashes(dt: number, cfg: FireworksConfig) {
    for (let f = this.flashes.length - 1; f >= 0; f--) {
      const fl = this.flashes[f];
      fl.age += dt;
      fl.pos.y -= dt * 3;
      if (fl.age >= fl.life) this.flashes.splice(f, 1);
    }
    const strength = Math.max(0, cfg.lightStrength);
    const wantLights = strength > 0 && this.flashes.length > 0;
    if (wantLights && !this.lightsAttached) {
      // Added once on first use and then kept, so the light count (and with
      // it every lit material's shader program) stays fixed afterwards.
      for (let l = 0; l < FIREWORKS_LIGHTS; l++) {
        const light = new THREE.PointLight(0xffffff, 0, 0, 2);
        light.name = "fireworks-light";
        this.scene.add(light);
        this.lights.push(light);
      }
      this.lightsAttached = true;
    }
    for (let l = 0; l < FIREWORKS_LIGHTS; l++) {
      const fl = this.flashes[l];
      let cd = 0;
      if (fl && strength > 0) {
        const u = fl.age / fl.life;
        // A sharp flash at the burst, then a glow that fades with the stars.
        const env = (0.3 + 0.7 * Math.exp(-fl.age / 0.12)) * Math.pow(Math.max(0, 1 - u), 1.5);
        // ~3 lux on the water from a typical burst 200 m away.
        cd = strength * fl.peak * env * 120000;
      }
      if (fl) {
        this.lightPos[l].set(fl.pos.x, fl.pos.y, fl.pos.z, 1);
        this.lightCol[l].set(fl.color.r * cd, fl.color.g * cd, fl.color.b * cd);
      } else {
        this.lightPos[l].set(0, -1e6, 0, 0);
        this.lightCol[l].set(0, 0, 0);
      }
      const light = this.lights[l];
      if (light) {
        light.visible = cd > 0;
        light.intensity = cd;
        if (fl) {
          light.position.copy(fl.pos);
          light.color.copy(fl.color);
        }
      }
    }
    for (let h = 0; h < this.halos.length; h++) {
      const halo = this.halos[h];
      if (!halo.visible) continue;
      const st = this.haloState[h];
      st.age += dt;
      if (st.age >= st.life) {
        halo.visible = false;
        continue;
      }
      (halo.material as THREE.SpriteMaterial).opacity =
        st.peak * Math.exp(-st.age / 0.18) * (0.4 + 0.6 * Math.min(1, strength + 0.3));
    }
  }

  /** Removes everything in flight (e.g. when the scene is torn down). */
  clear() {
    this.count = 0;
    this.shells = [];
    this.flashes.length = 0;
    for (const h of this.halos) h.visible = false;
    for (const l of this.lights) {
      l.intensity = 0;
      l.visible = false;
    }
    for (let l = 0; l < FIREWORKS_LIGHTS; l++) {
      this.lightPos[l].set(0, -1e6, 0, 0);
      this.lightCol[l].set(0, 0, 0);
    }
    this.geometry.setDrawRange(0, 0);
    this.points.visible = false;
  }

  dispose() {
    this.clear();
    this.points.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
    for (const h of this.halos) {
      h.removeFromParent();
      (h.material as THREE.SpriteMaterial).dispose();
    }
    this.haloTex.dispose();
    for (const l of this.lights) {
      l.removeFromParent();
      l.dispose();
    }
    this.audio.dispose();
  }
}

function makeHaloTexture(): THREE.Texture {
  const size = 128;
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  if (g) {
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.2, "rgba(255,255,255,0.45)");
    grad.addColorStop(0.55, "rgba(255,255,255,0.1)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
