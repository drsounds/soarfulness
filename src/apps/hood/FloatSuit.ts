import * as THREE from "three";

// FLYTDRÄKT: the padded float suit the bather always wears innermost under
// the HUVA layers. It is only ever drawn as a garment: a thick, padded
// front panel seen from above when ROTERA HUVUD tilts the head down, with
// nothing (no body) drawn around it or through its openings.
//
// Like the hood it is one full-screen clip-space quad, drawn just before
// the hood layers so every layer's cloth covers it.

export type FloatSuitConfig = {
  /** "#rrggbb" suit color. */
  color: string;
  /** -1 (leotard cut, high at the sides) .. 0 .. 1 (long trunks). */
  leg: number;
  /** Radians the head looks down (ROTERA HUVUD); the suit only shows when > 0. */
  rotateHead: number;
  skyColor: THREE.Color;
  horizonColor: THREE.Color;
  sunColor: THREE.Color;
  underwater: number;
  waterColor: THREE.Color;
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
  uniform float uRotateHead;
  uniform float uLeg;
  uniform vec3 uColor;
  uniform vec3 uSky;
  uniform vec3 uHorizon;
  uniform vec3 uSunCol;
  uniform vec3 uWater;
  uniform float uUnderwater;

  void main() {
    vec2 p = vec2(vNdc.x * uAspect, vNdc.y);
    vec3 d = normalize(vec3(p.x * uTanHalfFov, p.y * uTanHalfFov, -1.0));
    // The view ray in the body's level frame (the head is tilted down).
    float c = cos(uRotateHead);
    float s = sin(uRotateHead);
    vec3 db = vec3(d.x, d.y * c + d.z * s, -d.y * s + d.z * c);
    // The suit's front: a plane in front of and below the eyes, leaning
    // back toward them a little.
    vec3 n = normalize(vec3(0.0, 0.45, 0.9));
    vec3 p0 = vec3(0.0, -0.18, -0.1);
    float den = dot(n, db);
    if (den > -1e-3) discard;
    float tt = dot(n, p0) / den;
    if (tt <= 0.0) discard;
    vec3 X = db * tt;
    float u = X.x;
    float v = -X.y; // how far below the eyes

    // Outline: a scooped neckline, straps widening into the panel, and the
    // leg line (high-cut leotard .. straight trunks).
    float neck = 0.17 + 0.07 * max(0.0, 1.0 - (u / 0.11) * (u / 0.11));
    float halfW = mix(0.12, 0.18, smoothstep(0.17, 0.32, v));
    float leg = clamp(uLeg, -1.0, 1.0);
    float uu = clamp(abs(u) / 0.18, 0.0, 1.0);
    float hem = 0.62 + 0.12 * max(leg, 0.0) - max(-leg, 0.0) * 0.24 * uu * uu;
    float aa = max(fwidth(v), 1e-4) * 1.5;
    float aaU = max(fwidth(u), 1e-4) * 1.5;
    float mask = smoothstep(neck - aa, neck + aa, v) *
      (1.0 - smoothstep(hem - aa, hem + aa, v)) *
      (1.0 - smoothstep(halfW - aaU, halfW + aaU, abs(u)));
    if (mask <= 0.0) discard;

    // Thick padding in vertical channels, bound edges, soft shade inside
    // the clothes.
    float ch = 0.78 + 0.22 * cos(u * 95.0);
    float edgeDist = min(min(v - neck, hem - v), halfW - abs(u));
    float bind = smoothstep(0.0, 0.018, edgeDist);
    vec3 lit = mix(uHorizon, uSky, 0.6) * 0.6 + uSunCol * 0.15 + 0.08;
    vec3 col = uColor * lit * ch * mix(0.7, 1.0, bind);
    col *= mix(0.95, 0.7, smoothstep(0.3, 0.65, v));
    col = mix(col, col * (uWater * 2.2 + 0.25), uUnderwater * 0.6);
    gl_FragColor = vec4(col, mask);
  }
`;

export class FloatSuit {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private readonly geometry: THREE.PlaneGeometry;
  private colorHex = "";
  private readonly u = {
    uAspect: { value: 1 },
    uTanHalfFov: { value: 1 },
    uRotateHead: { value: 0 },
    uLeg: { value: 0 },
    uColor: { value: new THREE.Color() },
    uSky: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uSunCol: { value: new THREE.Color() },
    uWater: { value: new THREE.Color() },
    uUnderwater: { value: 0 },
  };

  constructor(scene: THREE.Scene) {
    this.material = new THREE.ShaderMaterial({
      uniforms: this.u,
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
    // Just under the hood layers (1e6 + i), so all of them cover it.
    this.mesh.renderOrder = 1e6 - 1;
    this.mesh.visible = false;
    this.mesh.name = "float-suit";
    scene.add(this.mesh);
  }

  update(camera: THREE.PerspectiveCamera, cfg: FloatSuitConfig): void {
    if (cfg.rotateHead <= 0.02) {
      this.mesh.visible = false;
      return;
    }
    const u = this.u;
    this.mesh.visible = true;
    u.uAspect.value = camera.aspect;
    u.uTanHalfFov.value = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    u.uRotateHead.value = cfg.rotateHead;
    u.uLeg.value = THREE.MathUtils.clamp(cfg.leg, -1, 1);
    if (cfg.color !== this.colorHex) {
      this.colorHex = cfg.color;
      const hex = parseInt(cfg.color.replace("#", ""), 16);
      u.uColor.value.setHex(Number.isFinite(hex) ? hex : 0xe0602a, THREE.LinearSRGBColorSpace);
    }
    u.uSky.value.copy(cfg.skyColor);
    u.uHorizon.value.copy(cfg.horizonColor);
    u.uSunCol.value.copy(cfg.sunColor);
    u.uWater.value.copy(cfg.waterColor);
    u.uUnderwater.value = cfg.underwater;
  }

  hide(): void {
    this.mesh.visible = false;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
