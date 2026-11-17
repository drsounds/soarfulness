import * as THREE from "three";
import type { Hood, HoodConfig } from "./Hood";

// 3D-TYG: a layer rendered as real geometry in the scene instead of the flat
// full-screen overlay. The collar (MUN OCH HALS) is a ring of cloth around
// the neck whose top edge is the mesh's own edge, and the hood is a dome and
// skirt around the head. Both hang off the camera (so they move with the
// head, in the head's own frame), the padding is real displaced geometry
// with real normals, and the cuff, zipper and rim are shaded on the surface.
//
// The meshes are drawn last in the scene, each layer after a depth clear, so
// the world never pokes through the clothes while the collar and hood still
// sort against each other. Sizes are in meters; the groups are scaled up
// around the eye (which leaves the picture unchanged) to keep the cloth
// beyond the camera's near plane.
//
// The water features are shared with the flat layer: the waterline inside
// (VATTEN I HUVAN) and the water's color are shaded per pixel from the
// fragment's real height above the sea, FLYTANDE bends and puffs the cloth
// below FLYTGRÄNS in the vertex shader, and a LÄNGD longer than the float
// suit floats up and wraps out around you at the surface. DROPPAR are still
// drawn by the flat layer (drops only), so they fall from the 3D cloth's
// rim and hem too. The flat Hood of each layer keeps running to hold the
// water and float state.

const NU = 192;
const NV = 72;
/** Where the neck ring and the head dome sit, in the head's frame (m, -z forward). */
const NECK_RADIUS = 0.19;
const CENTER_Z = 0.06;
const HOOD_RADIUS = 0.3;
const HOOD_CENTER_Y = 0.0;

const COMMON = /* glsl */ `
  #define PI 3.14159265
  uniform float uStyle;
  uniform float uPuffSize;
  uniform float uPuffHeight;
  uniform float uPuffThick;
  uniform float uInflate;
  uniform float uTanHalf;
  uniform float uBandH;
  uniform float uCollarUp;
  uniform float uLowerH;
  uniform float uNeckBack;
  uniform float uR;
  uniform float uRh;
  uniform float uBottom;
  uniform float uTime;
  uniform float uFloatAmt;
  uniform float uFloatLift;
  uniform float uFloatInflate;
  uniform float uFloatLine;
  uniform float uWrap;
  uniform float uWrapRise;
  uniform float uWrapSpeed;
  uniform float uEyeAbove;

  // FLYTANDE: (dx, dy, bulge) in meters for a point of the cloth: below
  // FLYTGRÄNS it is lifted (or dragged down when heavy), sways in slow waves
  // and puffs up in big bubbles of trapped air.
  vec3 floatOff(vec3 P) {
    if (uFloatAmt <= 0.001) return vec3(0.0);
    float M = uTanHalf * 0.26;
    float lineY = uFloatLine * uTanHalf * 0.13;
    float kF = 1.0 - smoothstep(lineY - 0.12, lineY + 0.02, P.y);
    float wv = sin(P.x * 18.0 + uTime * 0.9) * 0.6 + sin(P.x * 32.0 - uTime * 1.3 + 0.7) * 0.4;
    float dy = (wv * 0.05 + uFloatLift) * M * uFloatAmt * kF;
    float dx = sin(P.y * 20.0 + uTime * 0.7) * 0.025 * M * uFloatAmt * kF;
    float bub = sin(P.x * 22.0 + uTime * 0.35) * sin(P.y * 30.0 - uTime * 0.27 + 1.3);
    bub = 0.5 + 0.5 * bub;
    float bulge = uFloatInflate * kF * bub * bub * 0.09 * M * 1.5;
    return vec3(dx, dy, bulge);
  }

  // The padding's height (m) at c (meters along / across), 0 for classic
  // and shell cloth.
  float puffProfile(vec2 c) {
    if (uStyle < 0.5 || (uStyle > 2.5 && uStyle < 3.5)) return 0.0;
    float inf = clamp(uInflate, 0.0, 1.0);
    float th = clamp(uPuffThick, 0.0, 1.0);
    float ex = (th < 0.5 ? mix(2.2, 1.0, th * 2.0) : mix(1.0, 0.35, th * 2.0 - 1.0)) * mix(1.0, 0.5, inf);
    float sp = mix(0.025, 0.09, clamp(uPuffSize, 0.0, 1.0)) * (1.0 + 0.12 * inf);
    float amp = 0.025 * clamp(uPuffHeight, 0.0, 2.5) * mix(0.7, 1.3, th) * (1.0 + 1.4 * inf);
    float p;
    if (uStyle < 1.5) {
      float fu = 2.0 * fract(c.y / sp) - 1.0;
      p = pow(max(0.0, 1.0 - fu * fu), 0.5 * ex);
    } else if (uStyle < 2.5) {
      vec2 fd = 2.0 * fract(vec2(c.x + c.y, c.x - c.y) / (sp * 1.4)) - 1.0;
      p = pow(max(0.0, 1.0 - fd.x * fd.x) * max(0.0, 1.0 - fd.y * fd.y), 0.5 * ex);
    } else {
      float spD = sp * 1.45;
      float cell = floor(c.y / spD);
      float fu = 2.0 * fract(c.y / spD) - 1.0;
      float lump = 0.82 + 0.18 * sin(c.x * 22.0 * (1.0 + mod(cell, 3.0) * 0.25) + cell * 1.9);
      p = pow(max(0.0, 1.0 - fu * fu), 0.4 * ex) * lump;
      amp *= 1.25;
    }
    return amp * p;
  }

  // The collar's top edge (m, head frame) at angle th around the neck
  // (0 = front): at the screen height TÄCKHÖJD gives in front, rising
  // toward the sides, with KRAGE UPPÅT pulled up over the mouth.
  float edgeYAt(float th) {
    float ndc = mix(-0.92, -0.05, uLowerH) - uNeckBack * 0.95;
    if (uCollarUp > 0.5) ndc += 0.24 * (1.0 - smoothstep(0.0, 1.1, abs(th)));
    float zf = uR - ${CENTER_Z.toFixed(3)};
    float s = sin(th);
    return ndc * uTanHalf * zf + 0.08 * s * s * (uCollarUp > 0.5 ? 0.6 : 1.0);
  }
`;

const VERT_COLLAR = /* glsl */ `
  ${COMMON}
  varying vec3 vView;
  varying vec3 vN;
  varying float vArc;
  varying float vSlope;
  varying float vY;
  varying float vEdge;
  varying float vTh;
  uniform float uFlare;

  vec3 pos(vec2 g) {
    float th = (g.x * 2.0 - 1.0) * PI;
    float yE = edgeYAt(th);
    float y = mix(uBottom, yE, g.y);
    float k = 1.0 - g.y;
    float R = uR + k * k * uFlare;
    float dEdge = yE - y;
    float p = puffProfile(vec2(th * uR, y));
    vec3 fo = floatOff(vec3(R * sin(th), y, 0.0));
    p += fo.z;
    y += fo.y;
    // LÄNGD past the float suit, in the water: the lower cloth floats up to
    // the surface and billows out around you like a dress.
    float dx = fo.x;
    if (uWrap > 0.001) {
      float yS = min(-uEyeAbove, yE - 0.05);
      float d = yS - y;
      if (d > 0.0) {
        float wv = sin(th * 3.0 + uTime * uWrapSpeed) * 0.6 + sin(th * 7.0 - uTime * uWrapSpeed * 1.4 + 1.1) * 0.4;
        y = yS - d * (1.0 - uWrap * 0.9) + wv * 0.03 * uWrap * smoothstep(0.0, 0.2, d);
        R += uWrap * uWrapRise * (0.05 + 0.2 * smoothstep(0.0, 0.5, d));
      }
    }
    if (uBandH > 0.0) {
      float x = clamp(dEdge / uBandH, 0.0, 1.0);
      p *= smoothstep(uBandH * 0.9, uBandH + 0.012, dEdge);
      // The cuff is a rolled, slightly thicker band.
      p += (sin(PI * x) * 0.010 + 0.004) * (1.0 - step(1.0, x));
    }
    R -= p;
    return vec3(R * sin(th) + dx, y, ${CENTER_Z.toFixed(3)} - R * cos(th));
  }

  void main() {
    vec2 g = uv;
    vec3 p0 = pos(g);
    vec3 pu = pos(g + vec2(1.0 / ${NU}.0, 0.0));
    vec3 pv = pos(g + vec2(0.0, 1.0 / ${NV}.0));
    vec3 n = normalize(cross(pu - p0, pv - p0));
    vec4 mv = modelViewMatrix * vec4(p0, 1.0);
    vView = mv.xyz;
    vec3 nv = normalize(mat3(modelViewMatrix) * n);
    if (dot(nv, -vView) < 0.0) nv = -nv;
    vN = nv;
    float th = (g.x * 2.0 - 1.0) * PI;
    vTh = th;
    vArc = th * uR;
    vSlope = (edgeYAt(th + 0.01) - edgeYAt(th - 0.01)) / (0.02 * uR);
    vY = p0.y;
    vEdge = edgeYAt(th) - p0.y;
    gl_Position = projectionMatrix * mv;
  }
`;

const VERT_HOOD = /* glsl */ `
  ${COMMON}
  varying vec3 vView;
  varying vec3 vN;
  uniform float uSkirt;

  vec3 pos(vec2 g) {
    float az = (g.x * 2.0 - 1.0) * PI;
    float dome = 0.62;
    float R;
    float y;
    if (g.y < dome) {
      float el = mix(PI * 0.5, -0.1, g.y / dome);
      R = uRh * cos(el);
      y = ${HOOD_CENTER_Y.toFixed(3)} + uRh * sin(el);
    } else {
      float k = (g.y - dome) / (1.0 - dome);
      R = uRh * cos(0.1) * (1.0 + 0.3 * k * k);
      y = ${HOOD_CENTER_Y.toFixed(3)} - uRh * sin(0.1) - k * uSkirt;
    }
    vec3 P = vec3(R * sin(az), y, ${CENTER_Z.toFixed(3)} - R * cos(az));
    // The padding is laid out around the face's axis: rings of constant angle
    // from straight ahead.
    vec3 D = normalize(P - vec3(0.0, ${HOOD_CENTER_Y.toFixed(3)}, ${CENTER_Z.toFixed(3)}));
    float thF = acos(clamp(-D.z, -1.0, 1.0));
    float cu = atan(D.y, D.x) * uRh * sin(thF);
    float p = puffProfile(vec2(cu, thF * uRh));
    vec3 fo = floatOff(P);
    return P - D * (p - fo.z) + vec3(fo.x, fo.y, 0.0);
  }

  void main() {
    vec2 g = uv;
    vec3 p0 = pos(g);
    vec3 pu = pos(g + vec2(1.0 / ${NU}.0, 0.0));
    vec3 pv = pos(g + vec2(0.0, 1.0 / ${NV}.0));
    vec3 n = normalize(cross(pu - p0, pv - p0));
    vec4 mv = modelViewMatrix * vec4(p0, 1.0);
    vView = mv.xyz;
    vec3 nv = normalize(mat3(modelViewMatrix) * n);
    if (dot(nv, -vView) < 0.0) nv = -nv;
    vN = nv;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG_COMMON = /* glsl */ `
  precision highp float;
  #define PI 3.14159265
  varying vec3 vView;
  varying vec3 vN;
  uniform float uTime;
  uniform float uAspect;
  uniform float uTanHalf;
  uniform float uStyle;
  uniform float uS;
  uniform float uWaterIn;
  uniform float uEyeAbove;
  uniform float uWaterLevelIn;
  uniform float uWaterTint;
  uniform float uMotion;
  uniform vec3 uColor;
  uniform float uMetal;
  uniform float uDark;
  uniform float uReflLight;
  uniform vec3 uSky;
  uniform vec3 uHorizon;
  uniform vec3 uWater;
  uniform vec3 uSunCol;
  uniform vec3 uSunDir;
  uniform float uUnderwater;
  uniform mat3 uViewToWorld;

  // VATTEN I HUVAN: cloth under the water inside is tinted and dimmer, with
  // a soft caustic shimmer and a bright meniscus along the waterline. The
  // waterline is where the cloth point's real height above the sea crosses
  // the water inside, so tilting the head moves it.
  vec3 waterInside(vec3 col) {
    if (uWaterIn < 0.5) return col;
    float distM = length(vView) / uS;
    vec3 rayW = normalize(uViewToWorld * normalize(vView));
    float slosh = (0.006 + 0.012 * uMotion) * sin(rayW.x * 9.0 + rayW.z * 5.0 + uTime * 2.1) +
      (0.004 + 0.008 * uMotion) * sin(rayW.z * 13.0 - rayW.x * 4.0 - uTime * 2.9);
    float wl = uEyeAbove - uWaterLevelIn * 0.35 + rayW.y * distM - slosh;
    float aaW = max(fwidth(wl), 1e-4);
    float wet = 1.0 - smoothstep(-aaW, aaW, wl);
    vec2 p = vView.xy / max(-vView.z, 0.01) / uTanHalf;
    float depth = max(-wl, 0.0);
    vec3 blue = mix(uWater * 1.6 + 0.05, mix(uHorizon, uSky, 0.5) * 0.45, 0.35);
    vec3 tint = mix(vec3(dot(blue, vec3(0.333))), blue, clamp(uWaterTint, 0.0, 1.0));
    float shimmer = pow(
      (0.5 + 0.5 * sin(p.x * 23.0 + uTime * 2.4 + sin(p.y * 17.0 - uTime * 1.9) * 2.0)) *
      (0.5 + 0.5 * sin(p.y * 29.0 - p.x * 11.0 - uTime * 1.7 + sin(p.x * 13.0 + uTime) * 1.5)),
      3.0);
    vec3 under = mix(col, col * 0.5 + tint * 0.6, 0.65 * (1.0 - exp(-depth * 10.0)) + 0.35);
    under += mix(uHorizon, uSky, 0.5) * shimmer * 0.09 * exp(-depth * 6.0);
    col = mix(col, under, wet);
    float meniscus = exp(-abs(wl) / (aaW * 2.5 + 0.004));
    col += (mix(uHorizon, uSky, 0.5) * 0.45 + uSunCol * 0.15) * meniscus;
    return col;
  }

  vec3 lightCloth(vec3 nView, vec3 base, float ao, float m) {
    vec3 N = normalize(uViewToWorld * nView);
    vec3 V = normalize(uViewToWorld * normalize(-vView));
    vec3 L = normalize(uSunDir);
    vec3 R = reflect(-V, N);
    float wetDark = uReflLight > 0.5 ? 0.8 : 0.55;
    float light = mix(1.0, 0.18, clamp(uDark, 0.0, 1.0));
    vec3 ambient = (mix(uHorizon, uSky, 0.5 + 0.5 * N.y) * 0.6 + 0.1) * light;
    float sunUp = clamp(L.y + 0.15, 0.0, 1.0);
    float diff = (0.35 + 0.65 * max(dot(N, L), 0.0)) * sunUp;
    vec3 col = base * mix(1.0, wetDark, m) * (ambient * ao + uSunCol * diff * ao * 0.7 * light) * mix(1.0, wetDark, m);
    // A soft sheen from the sky, and the sun's glint on glossy cloth.
    vec3 envC = R.y >= 0.0 ? mix(uHorizon, uSky, pow(clamp(R.y, 0.0, 1.0), 0.6)) : uHorizon * 0.7;
    col += envC * m * 0.35 * ao * light;
    col += uSunCol * pow(max(dot(R, L), 0.0), 40.0) * m * 0.8 * sunUp * ao;
    col = waterInside(col);
    col = mix(col, col * (uWater * 2.2 + 0.25), uUnderwater * 0.6);
    return col;
  }
`;

const FRAG_HOOD = /* glsl */ `
  ${FRAG_COMMON}
  uniform float uOpening;
  uniform float uOpenWidth;
  uniform float uDrop;
  uniform float uRound;
  uniform float uHoodBack;
  uniform float uHeight;
  uniform float uCollar;
  const float HEM = 0.075;

  void main() {
    if (vView.z > -0.01) discard;
    // The face opening, exactly as the flat hood draws it, in the view's own
    // screen units.
    vec2 pP = vView.xy / (-vView.z) / uTanHalf;
    vec2 c = vec2(0.0, 0.04 - uDrop * 0.22);
    vec2 q = pP - c;
    float a0 = uOpenWidth > 0.0 ? uAspect * uOpenWidth : uAspect * mix(0.55, 0.95, uOpening) + 0.06;
    float b0 = mix(0.6, 0.98, uOpening) * (1.0 - uDrop * 0.3);
    float pb = clamp(uHoodBack, 0.0, 1.0);
    float a = a0 * (1.0 + pb * 0.9);
    float b = b0 * (1.0 + pb * 1.1);
    float n = mix(6.0, 2.0, clamp(uRound, 0.0, 1.0));
    float r;
    if (q.y > 0.0) {
      vec2 e = abs(vec2(q.x / a, (q.y - pb * 0.25) / b));
      r = pow(pow(e.x, n) + pow(e.y, n), 1.0 / n);
    } else {
      r = abs(q.x) / (a * (1.0 + 0.12 * q.y * q.y));
    }
    float t = (r - 1.0) * min(a, b);
    if (t < 0.0) discard;
    float yCut = mix(-1.08, 0.8, uHeight) + 0.22 * exp(-max(t, 0.0) * 7.0);
    if (uCollar < 0.5 && pP.y < yCut) discard;

    // The rim's rolled lip tilts the shading just inside the edge.
    float hx = clamp(t / HEM, 0.0, 1.0);
    float dh = cos(PI * hx) * PI * 0.6 * (1.0 - step(1.0, t / HEM));
    vec2 dirT = normalize(vec2(q.x / (a * a), q.y / (b * b)) + vec2(1e-5));
    vec3 nV = normalize(vN + vec3(-dirT * dh * 0.55, 0.0));
    float ao = mix(1.0, 0.45, smoothstep(HEM, HEM + 0.7, t));
    ao *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, HEM, t));
    float m = clamp(uMetal, 0.0, 1.0);
    if (uStyle > 2.5 && uStyle < 3.5) m = max(m, 0.3);
    gl_FragColor = vec4(lightCloth(nV, uColor, ao, m), 1.0);
  }
`;

const FRAG_COLLAR = /* glsl */ `
  ${FRAG_COMMON}
  varying float vArc;
  varying float vSlope;
  varying float vY;
  varying float vEdge;
  varying float vTh;
  uniform float uBandH;
  uniform float uCuffSize;
  uniform float uCuffCustom;
  uniform float uCuffMat;
  uniform float uCuffMetal;
  uniform vec3 uCuffColor;
  uniform float uZip;
  uniform float uZipOpen;
  uniform float uYFront;
  uniform vec3 uSuitColor;

  void main() {
    float ao = 1.0;
    vec3 base = uColor;
    float m = clamp(uMetal, 0.0, 1.0);
    if (uStyle > 2.5 && uStyle < 3.5) m = max(m, 0.3);
    vec3 nV = vN;

    // MUDD: a ribbed band along the top edge.
    if (uBandH > 0.0 && vEdge < uBandH + 0.002) {
      float band = 1.0 - smoothstep(uBandH - 0.002, uBandH, vEdge);
      float x = clamp(vEdge / uBandH, 0.0, 1.0);
      float freq = mix(1500.0, 500.0, clamp(uCuffSize, 0.0, 1.0));
      float rib = 0.5 + 0.5 * cos((vArc - vSlope * vEdge * inversesqrt(1.0 + vSlope * vSlope)) * freq);
      if (uCuffCustom > 0.5 && uCuffMat > 0.5) rib = 0.5;
      vec3 cc = uCuffCustom > 0.5 ? uCuffColor : uColor * 0.9;
      float mm = uCuffCustom > 0.5 ? clamp(uCuffMetal, 0.0, 1.0) : m * 0.3;
      if (uCuffCustom > 0.5 && uCuffMat > 1.5) mm = max(mm, 0.6);
      base = mix(base, cc * mix(0.7, 1.15, rib), band);
      m = mix(m, mm, band);
      ao *= mix(1.0, 0.8 + 0.2 * sin(PI * x), band);
    }

    // BLIXTLÅS down the middle of the front.
    if (uZip > 0.5) {
      float zx = vArc;
      float zo = clamp(uZipOpen, 0.0, 1.0);
      float sliderY = uYFront - zo * (uYFront + 0.3);
      float aa = 0.0012;
      if (zo > 0.0 && vY > sliderY) {
        float gap = (0.006 + 0.05 * zo) * clamp((vY - sliderY) / max(uYFront - sliderY, 1e-3), 0.0, 1.0);
        float inGap = 1.0 - smoothstep(gap - aa, gap + aa, abs(zx));
        float tooth = 1.0 - smoothstep(0.0035, 0.0035 + aa, abs(abs(zx) - gap - 0.003));
        base = mix(base, uSuitColor * 0.6, inGap);
        m = mix(m, 0.0, inGap);
        base = mix(base, vec3(0.62, 0.64, 0.68), tooth * (1.0 - inGap) * step(0.5, fract(vY / 0.0075)));
      } else if (vY < sliderY + 0.002) {
        float tape = 1.0 - smoothstep(0.007 - aa, 0.007, abs(zx));
        base = mix(base, base * 0.55, tape);
        float side = mod(floor(vY / 0.0075), 2.0) * 2.0 - 1.0;
        float tooth = (1.0 - smoothstep(0.0045 - aa, 0.0045, abs(zx))) * step(0.15, fract(vY / 0.0075)) * step(-0.0015, zx * side);
        base = mix(base, vec3(0.66, 0.68, 0.72), tooth);
        m = mix(m, 0.5, tooth);
      }
      // The slider.
      vec2 sp = vec2(zx, vY - (sliderY - 0.008));
      vec2 sd = abs(sp) - vec2(0.0055, 0.008);
      float slider = 1.0 - smoothstep(-aa, aa, length(max(sd, 0.0)) + min(max(sd.x, sd.y), 0.0));
      base = mix(base, vec3(0.7, 0.72, 0.76), slider);
      m = mix(m, 0.6, slider);
    }
    gl_FragColor = vec4(lightCloth(nV, base, ao, m), 1.0);
  }
`;

type Uniforms = Record<string, THREE.IUniform>;

function gridGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const count = (NU + 1) * (NV + 1);
  const pos = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  for (let j = 0; j <= NV; j++) {
    for (let i = 0; i <= NU; i++) {
      const k = j * (NU + 1) + i;
      uv[k * 2] = i / NU;
      uv[k * 2 + 1] = j / NV;
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < NV; j++) {
    for (let i = 0; i < NU; i++) {
      const a = j * (NU + 1) + i;
      const b = a + 1;
      const c = a + (NU + 1);
      const d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

let sharedGrid: THREE.BufferGeometry | null = null;

/** One layer as real 3D cloth: a collar ring and a hood dome. */
export class HoodMesh3D {
  private readonly root = new THREE.Group();
  private readonly neckGroup = new THREE.Group();
  private readonly headGroup = new THREE.Group();
  private readonly collar: THREE.Mesh;
  private readonly hood: THREE.Mesh;
  private readonly sentinel: THREE.Mesh;
  private readonly u: Uniforms;
  private colorHex = "";
  private cuffHex = "";
  private suitHex = "";
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler(0, 0, 0, "YXZ");
  private readonly pos = new THREE.Vector3();
  private readonly sc = new THREE.Vector3();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly index: number,
  ) {
    const c = () => new THREE.Color();
    this.u = {
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uTanHalf: { value: 0.6 },
      uStyle: { value: 0 },
      uPuffSize: { value: 0.5 },
      uPuffHeight: { value: 0.5 },
      uPuffThick: { value: 0.5 },
      uInflate: { value: 0 },
      uBandH: { value: 0 },
      uCollarUp: { value: 0 },
      uLowerH: { value: 0.45 },
      uNeckBack: { value: 0 },
      uR: { value: NECK_RADIUS },
      uRh: { value: HOOD_RADIUS },
      uBottom: { value: -0.7 },
      uFloatAmt: { value: 0 },
      uFloatLift: { value: 0 },
      uFloatInflate: { value: 0 },
      uFloatLine: { value: 0 },
      uWrap: { value: 0 },
      uWrapRise: { value: 0.5 },
      uWrapSpeed: { value: 0.8 },
      uEyeAbove: { value: 1 },
      uS: { value: 1 },
      uWaterIn: { value: 0 },
      uWaterLevelIn: { value: 0.3 },
      uWaterTint: { value: 0 },
      uMotion: { value: 0.5 },
      uFlare: { value: 0.12 },
      uSkirt: { value: 0.5 },
      uColor: { value: c() },
      uMetal: { value: 0 },
      uDark: { value: 0 },
      uReflLight: { value: 1 },
      uSky: { value: c() },
      uHorizon: { value: c() },
      uWater: { value: c() },
      uSunCol: { value: c() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uUnderwater: { value: 0 },
      uViewToWorld: { value: new THREE.Matrix3() },
      uOpening: { value: 0.5 },
      uOpenWidth: { value: 0 },
      uDrop: { value: 0 },
      uRound: { value: 0.85 },
      uHoodBack: { value: 0 },
      uHeight: { value: 0.3 },
      uCollar: { value: 0 },
      uCuffSize: { value: 0.5 },
      uCuffCustom: { value: 0 },
      uCuffMat: { value: 0 },
      uCuffMetal: { value: 0.15 },
      uCuffColor: { value: c() },
      uZip: { value: 0 },
      uZipOpen: { value: 0 },
      uYFront: { value: -0.1 },
      uSuitColor: { value: c() },
    };
    sharedGrid ??= gridGeometry();
    const mk = (vs: string, fs: string) =>
      new THREE.ShaderMaterial({
        uniforms: this.u,
        vertexShader: vs,
        fragmentShader: fs,
        side: THREE.DoubleSide,
        transparent: true,
        depthTest: true,
        depthWrite: true,
        fog: false,
      });
    this.collar = new THREE.Mesh(sharedGrid, mk(VERT_COLLAR, FRAG_COLLAR));
    this.hood = new THREE.Mesh(sharedGrid, mk(VERT_HOOD, FRAG_HOOD));
    for (const m of [this.collar, this.hood]) m.frustumCulled = false;
    // Each layer starts from a clean depth buffer, so the world never cuts
    // into the clothes and later (inner) layers draw over earlier ones.
    const base = 1e6 + 100 + index * 10;
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(9), 3));
    this.sentinel = new THREE.Mesh(
      sg,
      new THREE.ShaderMaterial({
        vertexShader: "void main(){gl_Position=vec4(2.0,2.0,2.0,1.0);}",
        fragmentShader: "void main(){gl_FragColor=vec4(0.0);}",
        transparent: true,
        depthWrite: false,
        depthTest: false,
      }),
    );
    this.sentinel.frustumCulled = false;
    this.sentinel.renderOrder = base;
    this.sentinel.onBeforeRender = (renderer) => renderer.clearDepth();
    this.collar.renderOrder = base + 1;
    this.hood.renderOrder = base + 2;
    this.neckGroup.add(this.collar);
    this.headGroup.add(this.hood);
    this.root.add(this.sentinel, this.neckGroup, this.headGroup);
    this.root.visible = false;
    this.root.name = `hood-3d-${index}`;
    scene.add(this.root);
  }

  hide(): void {
    this.root.visible = false;
  }

  private setColor(
    c: THREE.Color,
    key: "colorHex" | "cuffHex" | "suitHex",
    hexStr: string,
    fallback: number,
  ) {
    if (hexStr === this[key]) return;
    this[key] = hexStr;
    const hex = parseInt(hexStr.replace("#", ""), 16);
    c.setHex(Number.isFinite(hex) ? hex : fallback, THREE.LinearSRGBColorSpace);
  }

  update(
    time: number,
    camera: THREE.PerspectiveCamera,
    cfg: HoodConfig,
    opts: { bodyFrame: boolean; suitColor: string },
    flat: Hood,
  ): void {
    const u = this.u;
    const clamp = THREE.MathUtils.clamp;
    // Layers are listed outermost first; inner ones sit a little closer in.
    const k = 1 - this.index * 0.06;
    const showCollar = cfg.lower;
    const showHood = cfg.hoodTop !== false;
    this.collar.visible = showCollar;
    this.hood.visible = showHood;
    this.root.visible = showCollar || showHood;
    if (!this.root.visible) return;

    camera.updateMatrixWorld();
    camera.matrixWorld.decompose(this.pos, this.q, this.sc);
    // The cloth is placed around the eye; scaling about the eye keeps the
    // picture identical while moving it clear of the near plane.
    const S = Math.max(1, camera.near * 10);
    this.root.position.copy(this.pos);
    this.root.scale.setScalar(S);
    this.root.quaternion.identity();
    this.headGroup.quaternion.copy(this.q);
    if (opts.bodyFrame) {
      // ROTERA HUVUDET: the collar stays with the body (level, turning with
      // the heading), so tilting the head down looks into it.
      this.e.setFromQuaternion(this.q, "YXZ");
      this.e.set(0, this.e.y, 0, "YXZ");
      this.neckGroup.quaternion.setFromEuler(this.e);
    } else {
      this.neckGroup.quaternion.copy(this.q);
    }

    u.uTime.value = time;
    u.uS.value = S;
    // The flat layer (kept running for the drops) holds the water and float
    // state; the 3D cloth reads it.
    for (const key of [
      "uEyeAbove",
      "uWaterLevelIn",
      "uFloatAmt",
      "uFloatLift",
      "uFloatInflate",
      "uFloatLine",
      "uWrap",
      "uWrapRise",
      "uWrapSpeed",
    ]) {
      u[key].value = flat.uniformValue(key);
    }
    u.uWaterIn.value = cfg.waterInside ? 1 : 0;
    u.uWaterTint.value = clamp(cfg.waterTint ?? 0, 0, 1);
    u.uMotion.value = clamp(cfg.motion, 0, 1);
    u.uBottom.value = cfg.lengthOn
      ? THREE.MathUtils.lerp(-0.3, -1.25, clamp(cfg.length ?? 0.6, 0, 1))
      : -0.7;
    u.uAspect.value = camera.aspect;
    u.uTanHalf.value = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const style = cfg.style;
    u.uStyle.value =
      style === "puffy"
        ? 1
        : style === "quilted"
          ? 2
          : style === "shell"
            ? 3
            : style === "down"
              ? 4
              : 0;
    u.uPuffSize.value = clamp(cfg.puffSize, 0, 1);
    u.uPuffHeight.value = clamp(cfg.puffHeight, 0, 2.5);
    u.uPuffThick.value = clamp(cfg.puffThickness ?? 0.5, 0, 1);
    u.uInflate.value =
      clamp(cfg.puffInflate ?? 0, 0, 1) * clamp(1 - (cfg.eyeAboveWater ?? 1) * 2, 0, 1);
    u.uBandH.value = cfg.cuff ? THREE.MathUtils.lerp(0.02, 0.09, clamp(cfg.cuffHeight, 0, 1)) : 0;
    u.uCollarUp.value = cfg.collarUp ? 1 : 0;
    u.uLowerH.value = clamp(cfg.lowerHeight, 0, 1);
    u.uNeckBack.value = clamp(cfg.neckBack ?? 0, 0, 1);
    u.uR.value = NECK_RADIUS * k;
    u.uRh.value = HOOD_RADIUS * k;
    u.uYFront.value = this.frontEdgeY(cfg, k, u.uTanHalf.value as number);
    this.setColor(u.uColor.value as THREE.Color, "colorHex", cfg.color, 0x2b3a55);
    u.uMetal.value = clamp(cfg.metallic, 0, 1);
    u.uDark.value = clamp(cfg.darkness, 0, 1);
    u.uReflLight.value = cfg.reflectLight === false ? 0 : 1;
    (u.uSky.value as THREE.Color).copy(cfg.skyColor);
    (u.uHorizon.value as THREE.Color).copy(cfg.horizonColor);
    (u.uWater.value as THREE.Color).copy(cfg.waterColor);
    (u.uSunCol.value as THREE.Color).copy(cfg.sunColor);
    (u.uSunDir.value as THREE.Vector3).copy(cfg.sunDir);
    u.uUnderwater.value = cfg.underwater;
    (u.uViewToWorld.value as THREE.Matrix3).setFromMatrix4(camera.matrixWorld);
    u.uOpening.value = clamp(cfg.opening, 0, 1);
    u.uOpenWidth.value = Math.max(0, Number.isFinite(cfg.openingWidth) ? cfg.openingWidth : 0);
    u.uDrop.value = clamp(cfg.drop, 0, 1);
    u.uRound.value = clamp(cfg.roundness, 0, 1);
    u.uHoodBack.value = clamp(cfg.pullBack ?? 0, 0, 1);
    u.uHeight.value = clamp(cfg.height, 0, 1);
    u.uCollar.value = cfg.lower ? 1 : 0;
    u.uCuffSize.value = clamp(cfg.cuffSize, 0, 1);
    u.uCuffCustom.value = cfg.cuffCustom ? 1 : 0;
    u.uCuffMat.value = cfg.cuffMaterial === "smooth" ? 1 : cfg.cuffMaterial === "rubber" ? 2 : 0;
    u.uCuffMetal.value = clamp(cfg.cuffMetallic ?? 0.15, 0, 1);
    this.setColor(
      u.uCuffColor.value as THREE.Color,
      "cuffHex",
      cfg.cuffColor ?? "#1f2a40",
      0x1f2a40,
    );
    u.uZip.value = cfg.zipper ? 1 : 0;
    u.uZipOpen.value = clamp(cfg.zipperOpen ?? 0, 0, 1);
    this.setColor(u.uSuitColor.value as THREE.Color, "suitHex", opts.suitColor, 0xe0602a);
  }

  /** The collar's top edge in front (m), mirroring edgeYAt(0) in the shader. */
  private frontEdgeY(cfg: HoodConfig, k: number, tanHalf: number): number {
    let ndc = THREE.MathUtils.lerp(-0.92, -0.05, THREE.MathUtils.clamp(cfg.lowerHeight, 0, 1));
    ndc -= THREE.MathUtils.clamp(cfg.neckBack ?? 0, 0, 1) * 0.95;
    if (cfg.collarUp) ndc += 0.24;
    return ndc * tanHalf * (NECK_RADIUS * k - CENTER_Z);
  }

  dispose(): void {
    this.root.removeFromParent();
    (this.collar.material as THREE.Material).dispose();
    (this.hood.material as THREE.Material).dispose();
    (this.sentinel.material as THREE.Material).dispose();
    this.sentinel.geometry.dispose();
  }
}
