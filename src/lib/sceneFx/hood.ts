import * as THREE from "three";

// HUVA: a hoodie hood around the bather, seen from inside it.
//
// The bather is the camera, so the hood is drawn as a full-screen pass that
// frames the view: fabric along the top and down both sides, with a rolled
// hem around the face opening. It is a single clip-space quad drawn last in
// the 3D scene (depth test off, highest render order), so it sits over the
// water and sky but under every DOM control, and still goes through the
// RETRO / KROMATISK ABERRATION passes like the rest of the frame.
//
// The fabric is a height field (hem roll, gathers that run outward from the
// opening, and the hood curving away toward the screen edges). Its normals
// are shaded with the sun and an analytic sky/horizon/water environment taken
// from the ocean shader's own uniforms, so the hood follows time of day.
// METALLGLANS turns that shading from matte cloth into dark, glossy, wet
// fabric with a colored (metal-like) reflection. RÖRELSE makes the hood lag
// behind head turns on a damped spring and keeps the gathers and the hem
// slowly moving, like cloth.

export type HoodConfig = {
  /** 0..1: where the hood's sides end, from the bottom of the view up (HÖJD FRÅN BOTTEN). */
  height: number;
  /** 0..1: size of the face opening, tight (0) .. wide (1) (ÖPPNING). */
  opening: number;
  /** "#rrggbb" fabric color (FÄRG). */
  color: string;
  /** 0..1: matte cloth (0) .. wet metallic sheen (1) (METALLGLANS). */
  metallic: number;
  /** 0..1: how much the hood sways and flutters (RÖRELSE). */
  motion: number;
  /** Ocean shader colors and sun, for the hood's lighting. */
  skyColor: THREE.Color;
  horizonColor: THREE.Color;
  waterColor: THREE.Color;
  sunColor: THREE.Color;
  /** World-space direction toward the sun. */
  sunDir: THREE.Vector3;
  /** 0..1 while the camera is under water. */
  underwater: number;
};

const VERT = /* glsl */ `
  varying vec2 vNdc;
  void main() {
    vNdc = position.xy;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vNdc;
  uniform float uAspect;
  uniform float uTanHalfFov;
  uniform float uTime;
  uniform vec2 uSway;
  uniform float uMotion;
  uniform float uHeight;
  uniform float uOpening;
  uniform float uMetal;
  uniform vec3 uColor;
  uniform vec3 uSky;
  uniform vec3 uHorizon;
  uniform vec3 uWater;
  uniform vec3 uSunCol;
  uniform vec3 uSunDir;
  uniform float uUnderwater;
  uniform mat3 uViewToWorld;

  const float HEM = 0.075;

  // x: how far into the fabric (0 at the opening's edge, < 0 in the opening),
  // y: fabric height, z: bottom-cut distance (> 0 where the fabric exists).
  vec3 hoodField(vec2 p) {
    vec2 c = vec2(uSway.x, 0.04 + uSway.y);
    vec2 q = p - c;
    float ang = atan(q.y, q.x);
    // The hem itself ripples a little, slowest at the top of the head.
    float flutter = uMotion * (
      0.012 * sin(ang * 7.0 + uTime * 1.7) +
      0.008 * sin(ang * 13.0 - uTime * 2.3 + 1.3)
    );
    float a = uAspect * mix(0.55, 0.95, uOpening) + 0.06;
    float b = mix(0.6, 0.98, uOpening);
    float r;
    if (q.y > 0.0) {
      vec2 e = abs(vec2(q.x / a, q.y / b));
      r = pow(pow(e.x, 2.6) + pow(e.y, 2.6), 1.0 / 2.6);
    } else {
      // Below the opening's center the sides hang straight, flaring a little.
      r = abs(q.x) / (a * (1.0 + 0.12 * q.y * q.y));
    }
    float t = (r - 1.0) * min(a, b) + flutter;

    // Gathers: soft ridges running outward from the opening, drifting slowly.
    float ph = uTime * (0.35 + 0.9 * uMotion);
    float g =
      0.55 * sin(ang * 9.0 + 0.6 * sin(ang * 3.0 + ph * 0.7) + ph * 0.5) +
      0.3 * sin(ang * 17.0 - ph * 0.8 + 2.1) +
      0.15 * sin(ang * 29.0 + t * 9.0 + ph * 0.3);
    float gatherMask = smoothstep(HEM * 0.8, HEM + 0.12, t) * (1.0 - smoothstep(0.5, 1.3, t));
    // Hem roll: a rounded bump right at the opening (smooth at both ends so
    // the shading has no seams).
    float hx = clamp(t / HEM, 0.0, 1.0);
    float hem = sin(3.14159 * hx) * HEM * 0.6;
    // Past the hem the hood curves away toward the screen edges.
    float tc = max(t - HEM, 0.0);
    float curve = (1.0 - exp(-tc * 2.2)) * 0.3 + tc * 0.04;
    float h = hem + curve + g * 0.022 * gatherMask;

    // HÖJD FRÅN BOTTEN: the sides end at this screen height, curling up
    // toward the opening.
    float yCut = mix(-1.08, 0.8, uHeight) + 0.22 * exp(-max(t, 0.0) * 7.0);
    float cut = p.y - yCut + 0.01 * sin(p.x * 11.0 + uTime * 1.3) * uMotion;
    return vec3(t, h, cut);
  }

  vec3 env(vec3 d) {
    if (d.y >= 0.0) return mix(uHorizon, uSky, pow(clamp(d.y, 0.0, 1.0), 0.6));
    return mix(uHorizon, uWater, smoothstep(0.0, 0.35, -d.y));
  }

  void main() {
    vec2 p = vec2(vNdc.x * uAspect, vNdc.y);
    vec3 f = hoodField(p);
    float t = f.x;
    float cut = f.z;
    float aaT = max(fwidth(t), 1e-4) * 1.5;
    float aaC = max(fwidth(cut), 1e-4) * 1.5;
    float inside = smoothstep(0.0, aaT, t) * smoothstep(0.0, aaC, cut);
    // Contact shadow the hood throws onto the view just inside the opening.
    float rim = smoothstep(-0.04, 0.0, t) * (1.0 - smoothstep(0.0, aaT, t)) * smoothstep(-0.03, 0.05, cut);
    if (inside <= 0.0 && rim <= 0.0) discard;

    // Height-field normal (view space, +z toward the eye).
    float e = 0.004;
    float hx1 = hoodField(p + vec2(e, 0.0)).y;
    float hy1 = hoodField(p + vec2(0.0, e)).y;
    vec3 nView = normalize(vec3(-(hx1 - f.y) / e, -(hy1 - f.y) / e, 1.0));
    vec3 vView = normalize(vec3(-p.x * uTanHalfFov, -p.y * uTanHalfFov, 1.0));
    vec3 N = normalize(uViewToWorld * nView);
    vec3 V = normalize(uViewToWorld * vView);
    vec3 L = normalize(uSunDir);
    vec3 R = reflect(-V, N);

    // The hood's inside is in its own shade: darker the deeper into it.
    float ao = mix(1.0, 0.32, smoothstep(HEM, HEM + 0.7, t));
    float hemLight = 1.0 - 0.35 * smoothstep(0.0, HEM, t);

    float m = clamp(uMetal, 0.0, 1.0);
    vec3 base = uColor * mix(1.0, 0.55, m); // wet cloth reads darker
    vec3 ambient = mix(uHorizon, uSky, 0.5 + 0.5 * N.y) * 0.6 + 0.1;
    float sunUp = clamp(L.y + 0.15, 0.0, 1.0);
    float diff = (0.35 + 0.65 * max(dot(N, L), 0.0)) * sunUp;
    vec3 col = base * (ambient * ao + uSunCol * diff * ao * 0.7) * mix(1.0, 0.55, m);

    vec3 F0 = mix(vec3(0.04), max(uColor, vec3(0.15)), m * 0.75);
    float ndv = clamp(dot(N, V), 0.0, 1.0);
    vec3 fres = F0 + (1.0 - F0) * pow(1.0 - ndv, 5.0);
    col += env(R) * fres * (0.25 + 1.1 * m) * mix(0.5, 1.0, ao);
    float shin = mix(10.0, 140.0, m);
    float spec = pow(max(dot(R, L), 0.0), shin) * (0.15 + 2.2 * m) * sunUp;
    col += uSunCol * spec * mix(0.6, 1.0, ao);
    // A soft broad sheen along the gathers' crests, the wet-fabric look.
    col += env(N) * m * 0.18 * smoothstep(0.55, 1.0, ndv) * ao;
    col *= hemLight + 0.35;

    // Under water: tint toward the water and dim.
    col = mix(col, col * (uWater * 2.2 + 0.25), uUnderwater * 0.6);

    vec3 outCol = mix(vec3(0.0), col, inside);
    float alpha = max(inside, rim * 0.25);
    gl_FragColor = vec4(outCol, alpha);
  }
`;

export class Hood {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private readonly geometry: THREE.PlaneGeometry;
  private readonly uniforms: {
    uAspect: { value: number };
    uTanHalfFov: { value: number };
    uTime: { value: number };
    uSway: { value: THREE.Vector2 };
    uMotion: { value: number };
    uHeight: { value: number };
    uOpening: { value: number };
    uMetal: { value: number };
    uColor: { value: THREE.Color };
    uSky: { value: THREE.Color };
    uHorizon: { value: THREE.Color };
    uWater: { value: THREE.Color };
    uSunCol: { value: THREE.Color };
    uSunDir: { value: THREE.Vector3 };
    uUnderwater: { value: number };
    uViewToWorld: { value: THREE.Matrix3 };
  };
  // Sway spring state (screen units) and the last camera orientation.
  private readonly sway = new THREE.Vector2();
  private readonly swayVel = new THREE.Vector2();
  private readonly lastQuat = new THREE.Quaternion();
  private readonly lastPos = new THREE.Vector3();
  private hasLast = false;
  private colorHex = "";
  private readonly tmpQ = new THREE.Quaternion();
  private readonly tmpV = new THREE.Vector3();
  private readonly tmpE = new THREE.Euler();

  constructor(scene: THREE.Scene) {
    this.uniforms = {
      uAspect: { value: 1 },
      uTanHalfFov: { value: 1 },
      uTime: { value: 0 },
      uSway: { value: new THREE.Vector2() },
      uMotion: { value: 0.5 },
      uHeight: { value: 0.3 },
      uOpening: { value: 0.5 },
      uMetal: { value: 0.5 },
      uColor: { value: new THREE.Color() },
      uSky: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uWater: { value: new THREE.Color() },
      uSunCol: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uUnderwater: { value: 0 },
      uViewToWorld: { value: new THREE.Matrix3() },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      fog: false,
    });
    this.geometry = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1e6;
    this.mesh.visible = false;
    this.mesh.name = "hood";
    scene.add(this.mesh);
  }

  update(time: number, dt: number, camera: THREE.PerspectiveCamera, cfg: HoodConfig): void {
    const u = this.uniforms;
    this.mesh.visible = true;
    u.uTime.value = time;
    u.uAspect.value = camera.aspect;
    u.uTanHalfFov.value = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    u.uHeight.value = THREE.MathUtils.clamp(cfg.height, 0, 1);
    u.uOpening.value = THREE.MathUtils.clamp(cfg.opening, 0, 1);
    u.uMetal.value = THREE.MathUtils.clamp(cfg.metallic, 0, 1);
    const motion = THREE.MathUtils.clamp(cfg.motion, 0, 1);
    u.uMotion.value = motion;
    if (cfg.color !== this.colorHex) {
      this.colorHex = cfg.color;
      const hex = parseInt(cfg.color.replace("#", ""), 16);
      u.uColor.value.setHex(Number.isFinite(hex) ? hex : 0x2b3a55, THREE.LinearSRGBColorSpace);
    }
    u.uSky.value.copy(cfg.skyColor);
    u.uHorizon.value.copy(cfg.horizonColor);
    u.uWater.value.copy(cfg.waterColor);
    u.uSunCol.value.copy(cfg.sunColor);
    u.uSunDir.value.copy(cfg.sunDir);
    u.uUnderwater.value = cfg.underwater;
    camera.updateMatrixWorld();
    u.uViewToWorld.value.setFromMatrix4(camera.matrixWorld);

    // RÖRELSE: the hood lags behind head turns and bobs (damped spring).
    const step = Math.min(Math.max(dt, 0), 0.1);
    let pushX = 0;
    let pushY = 0;
    if (this.hasLast && step > 0) {
      // Camera rotation since last frame, in the camera's own frame.
      this.tmpQ.copy(this.lastQuat).invert().multiply(camera.quaternion);
      this.tmpE.setFromQuaternion(this.tmpQ, "YXZ");
      const yawRate = THREE.MathUtils.clamp(this.tmpE.y / step, -6, 6);
      const pitchRate = THREE.MathUtils.clamp(this.tmpE.x / step, -6, 6);
      // Vertical camera speed (bobbing on waves, diving).
      this.tmpV.copy(camera.position).sub(this.lastPos);
      const vy = THREE.MathUtils.clamp(this.tmpV.y / step, -8, 8);
      pushX = yawRate * 0.05;
      pushY = -pitchRate * 0.04 + vy * 0.012;
    }
    this.lastQuat.copy(camera.quaternion);
    this.lastPos.copy(camera.position);
    this.hasLast = true;
    if (step > 0) {
      const k = 38;
      const damping = 7.5;
      const idleX = Math.sin(time * 0.7) * 0.006 + Math.sin(time * 1.9 + 1.2) * 0.003;
      const idleY = Math.sin(time * 0.9 + 0.4) * 0.005;
      const targetX = (pushX + idleX) * motion;
      const targetY = (pushY + idleY) * motion;
      this.swayVel.x += ((targetX - this.sway.x) * k - this.swayVel.x * damping) * step;
      this.swayVel.y += ((targetY - this.sway.y) * k - this.swayVel.y * damping) * step;
      this.sway.x += this.swayVel.x * step;
      this.sway.y += this.swayVel.y * step;
      this.sway.x = THREE.MathUtils.clamp(this.sway.x, -0.12, 0.12);
      this.sway.y = THREE.MathUtils.clamp(this.sway.y, -0.08, 0.08);
    }
    u.uSway.value.copy(this.sway);
  }

  hide(): void {
    this.mesh.visible = false;
    this.hasLast = false;
    this.sway.set(0, 0);
    this.swayVel.set(0, 0);
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
