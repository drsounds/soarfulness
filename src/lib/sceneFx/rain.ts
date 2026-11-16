import * as THREE from "three";
import type { RainColor } from "@/lib/settingsShared";

// REGN: falling rain around the camera, splashes on the water and a
// synthesized rain sound.
//
// Rain works like SNÖ (see snow.ts): one instanced draw of RAIN_MAX_DROPS
// drops, of which the first `amount` are drawn, every drop's position
// computed in the vertex shader from its seed, the time and the camera
// position, wrapped into a box that follows the camera. Unlike snowflakes a
// drop is a streak: a thin quad stretched along the drop's velocity (fall +
// wind), so heavy rain in a strong wind slants the way it should.
//
// Wind: RainConfig.wind takes a world-space wind vector (m/s) when the scene
// has one (e.g. a wind system); without it the rain makes its own gentle
// wind that slowly turns and grows with REGNSTYRKA.

export const RAIN_MAX_DROPS = 40000;
const SPLASH_MAX = 6000;

// Half extents of the camera-following box the drops live in (m).
const BOX_HALF = new THREE.Vector3(20, 12, 20);
// Splashes only need to cover the water close to the camera.
const SPLASH_HALF = 14;
// The drift wraps after this many box sizes: every drop's speed factor is a
// multiple of 0.1, so a wrap moves every drop by whole boxes (invisible).
const DRIFT_WRAP = 10;

// REGNFÄRG tints (see RainColor in settingsShared); the brightness also
// follows the light, see rainLightColor.
const RAIN_TINTS: Record<RainColor, THREE.Color> = {
  silver: new THREE.Color(0.8, 0.85, 0.92),
  white: new THREE.Color(0.97, 0.98, 1.0),
  blue: new THREE.Color(0.6, 0.74, 0.95),
  gray: new THREE.Color(0.52, 0.55, 0.6),
};

// The light the rain is seen in: full by day, a dim moonlit blue at night.
const NIGHT_RAIN_LIGHT = new THREE.Color(0.2, 0.24, 0.34);
const DAY_RAIN_LIGHT = new THREE.Color(1, 1, 1);
export function rainLightColor(daylight: number, out = new THREE.Color()): THREE.Color {
  const d = Math.min(1, Math.max(0, daylight));
  return out.copy(NIGHT_RAIN_LIGHT).lerp(DAY_RAIN_LIGHT, d);
}

export type RainConfig = {
  /** Number of drops drawn (REGNMÄNGD). */
  amount: number;
  /** 0..~4: how hard it rains — fall speed and its own wind (REGNSTYRKA). */
  intensity: number;
  /** Streak length multiplier, 1 = natural (DROPPLÄNGD). */
  dropLength: number;
  /** Streak width multiplier, 1 = natural (DROPPSTORLEK). */
  dropSize: number;
  /** 0..1 (REGNOPACITET). */
  opacity: number;
  color: RainColor;
  /** 0 (night) .. 1 (day), e.g. 1 - nightBackdropMix(timeOfDay). */
  daylight: number;
  /** Splash rings where drops hit the water (STÄNK). */
  splashes: boolean;
  /** World Y of the water surface; drops below it are hidden. */
  waterLevel: number;
  /** 0..1, hides the rain while the camera is under water. */
  underwater: number;
  /** World-space wind (m/s, x/z) from the scene's wind, if it has one. */
  wind?: { x: number; z: number } | null;
};

const STREAK_VERT = `
  attribute vec4 aSeed;
  uniform vec3 uCamPos;
  uniform vec3 uBoxHalf;
  uniform vec3 uDrift;
  uniform float uSink;
  uniform vec3 uVel;
  uniform float uExposure;
  uniform float uWidth;
  uniform float uViewportH;
  varying float vAlpha;
  varying float vWorldY;
  varying vec2 vUv;
  void main() {
    vec3 box = uBoxHalf * 2.0;
    // Each drop falls at 80..120 % of the common speed, in steps of 10 % so
    // that wrapping the drift by DRIFT_WRAP boxes never makes drops jump.
    float speedVar = 0.8 + floor(aSeed.w * 4.999) * 0.1;
    vec3 head = aSeed.xyz * box + uDrift * speedVar;
    head.y -= uSink;
    head = mod(head - uCamPos + uBoxHalf, box) - uBoxHalf + uCamPos;
    // The streak trails behind the drop, opposite its velocity.
    vec3 tail = head - uVel * speedVar * uExposure;
    vec3 world = mix(head, tail, position.y);
    vec4 hv = viewMatrix * vec4(head, 1.0);
    vec4 tv = viewMatrix * vec4(tail, 1.0);
    vec4 mv = viewMatrix * vec4(world, 1.0);
    vec3 axis = tv.xyz - hv.xyz;
    vec3 toCam = normalize(-mv.xyz);
    vec3 side = cross(axis, toCam);
    float sl = length(side);
    side = sl > 1e-5 ? side / sl : vec3(1.0, 0.0, 0.0);
    // Keep every streak at least about a pixel wide; thinner ones fade
    // instead of flickering in and out.
    float dist = max(-mv.z, 0.05);
    float pixel = 2.0 * dist / (projectionMatrix[1][1] * uViewportH);
    float w = uWidth * (0.7 + aSeed.y * 0.6);
    float wDraw = max(w, pixel * 1.1);
    mv.xyz += side * position.x * wDraw * 0.5;
    gl_Position = projectionMatrix * mv;
    vWorldY = world.y;
    vUv = vec2(position.x, position.y);
    vec3 rel = abs(head - uCamPos) / uBoxHalf;
    float edge = max(max(rel.x, rel.z), rel.y);
    vAlpha = (1.0 - smoothstep(0.7, 1.0, edge))
      * smoothstep(0.25, 1.0, dist)
      * clamp(w / wDraw, 0.15, 1.0);
  }
`;

const STREAK_FRAG = `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uWaterLevel;
  varying float vAlpha;
  varying float vWorldY;
  varying vec2 vUv;
  void main() {
    if (vWorldY < uWaterLevel) discard;
    // Soft sides, brightest at the drop's head, fading along the trail.
    float across = 1.0 - smoothstep(0.2, 1.0, abs(vUv.x));
    float along = mix(1.0, 0.15, vUv.y) * smoothstep(0.0, 0.08, vUv.y + 0.04);
    float a = across * along * vAlpha * uOpacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

const SPLASH_VERT = `
  attribute vec4 aSeed;
  uniform float uTime;
  uniform vec3 uCamPos;
  uniform float uHalf;
  uniform float uWaterLevel;
  uniform float uRate;
  uniform float uSize;
  uniform float uPixelRatio;
  varying float vPhase;
  varying float vFlat;
  varying float vAlpha;
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  void main() {
    // Every splash replays at its own rate, landing somewhere new each time.
    float rate = uRate * (0.7 + aSeed.z * 0.6);
    float t = uTime * rate + aSeed.w;
    float cycle = floor(t);
    vPhase = fract(t);
    vec2 r = vec2(hash(aSeed.xy + cycle), hash(aSeed.yx * 1.7 + cycle * 0.37));
    // Anchored in the world and wrapped around the camera, so the splashes
    // don't slide along with a moving camera.
    vec2 w = r * 2.0 * uHalf;
    vec2 p2 = mod(w - uCamPos.xz + uHalf, 2.0 * uHalf) - uHalf + uCamPos.xz;
    vec3 p = vec3(p2.x, uWaterLevel + 0.02, p2.y);
    vec4 mv = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float dist = max(-mv.z, 0.05);
    gl_PointSize = clamp(uSize * (0.6 + aSeed.x * 0.8) * uPixelRatio * 600.0 / dist, 0.0, 64.0 * uPixelRatio);
    // A ring on the water is seen squashed by the view's elevation.
    vec3 toP = normalize(p - cameraPosition);
    vFlat = clamp(abs(toP.y), 0.12, 1.0);
    vec2 rel = abs(p2 - uCamPos.xz) / uHalf;
    vAlpha = (1.0 - smoothstep(0.6, 1.0, max(rel.x, rel.y))) * smoothstep(0.4, 1.5, dist);
    // Only seen from above: from below the surface (a camera bobbing just
    // under the mean level) the rings would hang in the air.
    vAlpha *= 1.0 - smoothstep(-0.06, -0.01, toP.y);
  }
`;

const SPLASH_FRAG = `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vPhase;
  varying float vFlat;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    c.y /= vFlat;
    float d = length(c) * 2.0;
    // An expanding ring that thins and fades, plus a quick bright dot where
    // the drop hit.
    float radius = 0.15 + vPhase * 0.8;
    float ring = 1.0 - smoothstep(0.0, 0.07 + 0.05 * (1.0 - vPhase), abs(d - radius));
    float hit = (1.0 - smoothstep(0.0, 0.18, d)) * (1.0 - smoothstep(0.0, 0.25, vPhase));
    float a = (ring * (1.0 - vPhase) + hit) * vAlpha * uOpacity;
    if (a < 0.01 || d > 1.0) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

export class Rainfall {
  readonly mesh: THREE.Mesh;
  readonly splashPoints: THREE.Points;
  readonly audio = new RainAudio();
  private readonly geometry: THREE.InstancedBufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly splashGeometry: THREE.BufferGeometry;
  private readonly splashMaterial: THREE.ShaderMaterial;
  private readonly uniforms: {
    uCamPos: { value: THREE.Vector3 };
    uBoxHalf: { value: THREE.Vector3 };
    uDrift: { value: THREE.Vector3 };
    uSink: { value: number };
    uVel: { value: THREE.Vector3 };
    uExposure: { value: number };
    uWidth: { value: number };
    uViewportH: { value: number };
    uColor: { value: THREE.Color };
    uOpacity: { value: number };
    uWaterLevel: { value: number };
  };
  private readonly splashUniforms: {
    uTime: { value: number };
    uCamPos: { value: THREE.Vector3 };
    uHalf: { value: number };
    uWaterLevel: { value: number };
    uRate: { value: number };
    uSize: { value: number };
    uPixelRatio: { value: number };
    uColor: { value: THREE.Color };
    uOpacity: { value: number };
  };
  // Fall and wind drift are integrated on the CPU (not time * speed in the
  // shader) so that changing REGNSTYRKA or the wind doesn't make drops jump.
  private readonly drift = new THREE.Vector3();
  private readonly wind = new THREE.Vector2();
  private windAngle = Math.random() * Math.PI * 2;
  private sink = 0;
  private lastCamY: number | null = null;
  private readonly light = new THREE.Color();

  constructor(scene: THREE.Scene) {
    const seeds = new Float32Array(RAIN_MAX_DROPS * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
    const geo = new THREE.InstancedBufferGeometry();
    // One quad per drop: x = -1..1 across the streak, y = 0 (head)..1 (tail).
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0]), 3),
    );
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 4));
    geo.instanceCount = 0;
    this.geometry = geo;
    this.uniforms = {
      uCamPos: { value: new THREE.Vector3() },
      uBoxHalf: { value: BOX_HALF.clone() },
      uDrift: { value: new THREE.Vector3() },
      uSink: { value: 0 },
      uVel: { value: new THREE.Vector3(0, -7, 0) },
      uExposure: { value: 0.045 },
      uWidth: { value: 0.006 },
      uViewportH: { value: 800 },
      uColor: { value: new THREE.Color() },
      uOpacity: { value: 0.5 },
      uWaterLevel: { value: -1e9 },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: STREAK_VERT,
      fragmentShader: STREAK_FRAG,
      transparent: true,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.name = "rainfall";
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 10;
    scene.add(this.mesh);

    const sSeeds = new Float32Array(SPLASH_MAX * 4);
    for (let i = 0; i < sSeeds.length; i++) sSeeds[i] = Math.random();
    this.splashGeometry = new THREE.BufferGeometry();
    this.splashGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(SPLASH_MAX * 3), 3),
    );
    this.splashGeometry.setAttribute("aSeed", new THREE.BufferAttribute(sSeeds, 4));
    this.splashGeometry.setDrawRange(0, 0);
    this.splashUniforms = {
      uTime: { value: 0 },
      uCamPos: { value: new THREE.Vector3() },
      uHalf: { value: SPLASH_HALF },
      uWaterLevel: { value: 0 },
      uRate: { value: 2.5 },
      uSize: { value: 1 },
      uPixelRatio: { value: 1 },
      uColor: { value: new THREE.Color() },
      uOpacity: { value: 0.5 },
    };
    this.splashMaterial = new THREE.ShaderMaterial({
      uniforms: this.splashUniforms,
      vertexShader: SPLASH_VERT,
      fragmentShader: SPLASH_FRAG,
      transparent: true,
      depthWrite: false,
      fog: false,
    });
    this.splashPoints = new THREE.Points(this.splashGeometry, this.splashMaterial);
    this.splashPoints.name = "rainSplashes";
    this.splashPoints.frustumCulled = false;
    this.splashPoints.visible = false;
    this.splashPoints.renderOrder = 10;
    scene.add(this.splashPoints);
  }

  setViewport(pixelRatio: number, heightPx: number) {
    this.splashUniforms.uPixelRatio.value = pixelRatio;
    this.uniforms.uViewportH.value = Math.max(1, heightPx);
  }

  /** Hides the rain and silences it. */
  hide() {
    this.mesh.visible = false;
    this.splashPoints.visible = false;
    this.lastCamY = null;
    this.audio.update(false, 0, 0, 0);
  }

  /** The wind the rain currently falls in (m/s, world x/z). */
  get currentWind(): THREE.Vector2 {
    return this.wind;
  }

  update(
    timeS: number,
    dt: number,
    camPos: THREE.Vector3,
    cfg: RainConfig,
    sound: { on: boolean; volume: number },
  ) {
    const count = Math.max(0, Math.min(RAIN_MAX_DROPS, Math.round(cfg.amount)));
    const step = Math.min(dt, 0.1);
    // Same sinking compensation as the snow: a descending camera would
    // otherwise see world-anchored drops slow down or rise.
    if (this.lastCamY !== null) {
      const descent = this.lastCamY - camPos.y;
      if (descent > 0 && descent < 5) this.sink = (this.sink + descent) % (BOX_HALF.y * 2);
    }
    this.lastCamY = camPos.y;

    const k = Math.max(0, cfg.intensity);
    // Drizzle falls at ~5 m/s, a downpour ~9 m/s, a storm faster still.
    const fallSpeed = 4.5 + k * 4;
    if (cfg.wind) {
      // Ease toward the scene's wind so gusts don't snap the streaks.
      const a = 1 - Math.exp(-step * 2);
      this.wind.x += (cfg.wind.x - this.wind.x) * a;
      this.wind.y += (cfg.wind.z - this.wind.y) * a;
    } else {
      this.windAngle += step * 0.04 * (0.5 + k);
      const windSpeed = 0.4 + k * k * 1.8;
      this.wind.set(Math.cos(this.windAngle) * windSpeed, Math.sin(this.windAngle) * windSpeed);
    }
    this.drift.x = (this.drift.x + this.wind.x * step) % (BOX_HALF.x * 2 * DRIFT_WRAP);
    this.drift.y = (this.drift.y - fallSpeed * step) % (BOX_HALF.y * 2 * DRIFT_WRAP);
    this.drift.z = (this.drift.z + this.wind.y * step) % (BOX_HALF.z * 2 * DRIFT_WRAP);

    const amountNorm = Math.min(1.5, count / 10000);
    const uw = Math.max(0, Math.min(1, cfg.underwater));
    // The rain on the surface is still heard (muffled) from below.
    this.audio.update(
      sound.on && count > 0,
      sound.volume * Math.sqrt(amountNorm) * Math.min(1.3, 0.45 + k * 0.55),
      uw,
      Math.min(1, k / 2),
    );

    const visible = count > 0 && uw < 0.5;
    this.mesh.visible = visible;
    this.splashPoints.visible = visible && cfg.splashes;
    if (!visible) return;

    rainLightColor(cfg.daylight, this.light);
    const tint = RAIN_TINTS[cfg.color] ?? RAIN_TINTS.silver;
    const opacity = Math.max(0, Math.min(1, cfg.opacity));

    this.geometry.instanceCount = count;
    const u = this.uniforms;
    u.uCamPos.value.copy(camPos);
    u.uDrift.value.copy(this.drift);
    u.uSink.value = this.sink;
    u.uVel.value.set(this.wind.x, -fallSpeed, this.wind.y);
    u.uExposure.value = 0.045 * Math.max(0.05, cfg.dropLength);
    u.uWidth.value = 0.006 * Math.max(0.1, cfg.dropSize);
    u.uColor.value.copy(tint).multiply(this.light);
    u.uOpacity.value = opacity;
    u.uWaterLevel.value = cfg.waterLevel;

    if (cfg.splashes) {
      // Splash count follows how much rain reaches the patch near the camera.
      const splashes = Math.min(SPLASH_MAX, Math.round(count * 0.15));
      this.splashGeometry.setDrawRange(0, splashes);
      const s = this.splashUniforms;
      // Wrapped so float precision holds up in long sessions.
      s.uTime.value = timeS % 4096;
      s.uCamPos.value.copy(camPos);
      s.uWaterLevel.value = cfg.waterLevel;
      s.uRate.value = 2 + k * 0.8;
      s.uSize.value = 0.25 * (0.7 + 0.3 * Math.max(0.1, cfg.dropSize)) * (0.8 + k * 0.15);
      s.uColor.value.copy(tint).multiply(this.light);
      s.uOpacity.value = Math.min(1, opacity * 1.6);
    }
  }

  dispose() {
    this.mesh.removeFromParent();
    this.splashPoints.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
    this.splashGeometry.dispose();
    this.splashMaterial.dispose();
    this.audio.dispose();
  }
}

// ---------------------------------------------------------------------------
// Sound

type AudioCtor = typeof AudioContext;

/**
 * WebAudio-synthesized rain: a steady hiss (filtered noise) under a patter
 * of individual drops (a looped buffer of short random clicks). Its own small
 * AudioContext like FireworksAudio, created the first time it's wanted and
 * suspended again while the rain or its sound is off.
 */
export class RainAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private lp: BiquadFilterNode | null = null;
  private hissGain: GainNode | null = null;
  private patterGain: GainNode | null = null;
  private enabled = false;
  private unlockBound = false;

  private readonly onGesture = () => {
    if (this.enabled && this.ctx && this.ctx.state !== "running") {
      this.ctx.resume().catch(() => undefined);
    }
  };

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === "undefined") return null;
    const Ctx: AudioCtor | undefined =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
    if (!Ctx) return null;
    try {
      const ctx = new Ctx();
      const rate = ctx.sampleRate;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 12000;
      lp.Q.value = 0.4;
      const master = ctx.createGain();
      master.gain.value = 0;
      lp.connect(master).connect(ctx.destination);

      // Hiss: pinkish noise, band-limited to where rain lives.
      const len = Math.floor(rate * 3);
      const hissBuf = ctx.createBuffer(2, len, rate);
      for (let c = 0; c < 2; c++) {
        const ch = hissBuf.getChannelData(c);
        let b0 = 0,
          b1 = 0,
          b2 = 0;
        for (let i = 0; i < len; i++) {
          const w = Math.random() * 2 - 1;
          b0 = 0.99765 * b0 + w * 0.099046;
          b1 = 0.963 * b1 + w * 0.2965164;
          b2 = 0.57 * b2 + w * 1.0526913;
          ch[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
        }
      }
      const hiss = ctx.createBufferSource();
      hiss.buffer = hissBuf;
      hiss.loop = true;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 400;
      const hissGain = ctx.createGain();
      hissGain.gain.value = 0.5;
      hiss.connect(hp).connect(hissGain).connect(lp);

      // Patter: thousands of tiny decaying clicks at random times, levels
      // and pitches, spread over the stereo field.
      const pLen = Math.floor(rate * 4);
      const patterBuf = ctx.createBuffer(2, pLen, rate);
      const drops = 1400;
      for (let c = 0; c < 2; c++) {
        const ch = patterBuf.getChannelData(c);
        for (let d = 0; d < drops; d++) {
          const at = Math.floor(Math.random() * pLen);
          const amp = Math.pow(Math.random(), 2.5) * 0.6;
          const decay = rate * (0.0015 + Math.random() * 0.004);
          const freq = 1800 + Math.random() * 5000;
          const n = Math.floor(decay * 5);
          for (let i = 0; i < n; i++) {
            const idx = (at + i) % pLen;
            ch[idx] += Math.sin((i / rate) * freq * 6.2831853) * amp * Math.exp(-i / decay);
          }
        }
      }
      const patter = ctx.createBufferSource();
      patter.buffer = patterBuf;
      patter.loop = true;
      const patterGain = ctx.createGain();
      patterGain.gain.value = 0.5;
      patter.connect(patterGain).connect(lp);

      hiss.start();
      patter.start();
      this.ctx = ctx;
      this.master = master;
      this.lp = lp;
      this.hissGain = hissGain;
      this.patterGain = patterGain;
    } catch {
      return null;
    }
    if (!this.unlockBound) {
      // Browsers only start audio after a user gesture.
      this.unlockBound = true;
      window.addEventListener("pointerdown", this.onGesture, true);
      window.addEventListener("keydown", this.onGesture, true);
      window.addEventListener("touchend", this.onGesture, true);
    }
    return this.ctx;
  }

  /**
   * @param volume 0..~1.3, already scaled by how hard it rains.
   * @param underwater 0..1, muffles the rain heard from below the surface.
   * @param heaviness 0..1, shifts the mix from patter toward a roaring hiss.
   */
  update(enabled: boolean, volume: number, underwater: number, heaviness: number) {
    const on = enabled && volume > 0;
    if (on !== this.enabled) {
      this.enabled = on;
      if (on) {
        this.ensure()
          ?.resume()
          .catch(() => undefined);
      } else if (this.ctx && this.ctx.state === "running") {
        const ctx = this.ctx;
        this.master?.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
        window.setTimeout(() => {
          if (!this.enabled) ctx.suspend().catch(() => undefined);
        }, 900);
      }
    }
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.lp || !this.enabled) return;
    const uw = Math.max(0, Math.min(1, underwater));
    const h = Math.max(0, Math.min(1, heaviness));
    const now = ctx.currentTime;
    this.master.gain.setTargetAtTime(Math.min(1.3, volume) * (1 - 0.55 * uw), now, 0.25);
    this.lp.frequency.setTargetAtTime(12000 * Math.pow(0.03, uw), now, 0.15);
    this.hissGain?.gain.setTargetAtTime(0.25 + h * 0.6, now, 0.3);
    this.patterGain?.gain.setTargetAtTime(0.75 - h * 0.3, now, 0.3);
  }

  dispose() {
    this.enabled = false;
    if (typeof window !== "undefined" && this.unlockBound) {
      window.removeEventListener("pointerdown", this.onGesture, true);
      window.removeEventListener("keydown", this.onGesture, true);
      window.removeEventListener("touchend", this.onGesture, true);
    }
    this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }
}
