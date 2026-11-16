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
  /** Opening width in screen widths (1 = edge to edge, > 1 wider); 0 = follow ÖPPNING (ÖPPNINGSBREDD). */
  openingWidth: number;
  /** Also cover the mouth and neck, closing the hood under the face (MUN OCH HALS). */
  lower: boolean;
  /** 0..1: how high up the view the mouth/neck cover reaches (TÄCKHÖJD). */
  lowerHeight: number;
  /** A zipper down the middle of the mouth/neck cover (BLIXTLÅS). */
  zipper: boolean;
  /** Water runs in inside the hood below the waterline (VATTEN I HUVAN). */
  waterInside: boolean;
  /** 0..1: how much higher the water inside sits than the sea outside (VATTENNIVÅ). */
  waterInsideLevel: number;
  /** 0..1: how low the hood hangs over the forehead (HUVHÖJD). */
  drop: number;
  /** 0..1: cloth weight — more sag and lag behind movement (TYNGD). */
  weight: number;
  /** 0..1: fine wet-cloth wrinkles (VÅTA VECK). */
  wrinkles: number;
  /** 0..1: darker lighting (MÖRKHET). */
  darkness: number;
  /** 0..1: opening shape, boxy (0) .. round (1) (RUNDHET). */
  roundness: number;
  /** Winter-coat style (STIL). */
  style: "classic" | "puffy" | "quilted";
  /** 0..1: padding size and bulge (PUFFSTORLEK, PUFFHÖJD). */
  puffSize: number;
  puffHeight: number;
  /** Ribbed cuff along the bottom (MUDD), its height and rib size (MUDDHÖJD, RIBBSTORLEK). */
  cuff: boolean;
  cuffHeight: number;
  cuffSize: number;
  /** Eye height above the water surface at the bather (m, negative under water). */
  eyeAboveWater: number;
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
  uniform float uOpenWidth;
  uniform float uLower;
  uniform float uLowerHeight;
  uniform float uZipper;
  uniform float uWaterIn;
  uniform float uEyeAbove;
  uniform float uWaterLevelIn;
  uniform float uDrop;
  uniform float uWrinkle;
  uniform float uDark;
  uniform float uRound;
  uniform float uStyle;
  uniform float uPuffSize;
  uniform float uPuffHeight;
  uniform float uCuff;
  uniform float uCuffHeight;
  uniform float uCuffSize;
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
  // Set by hoodField(): 1 inside the MUDD (cuff) band.
  float gCuff = 0.0;

  // x: how far into the fabric (0 at the opening's edge, < 0 in the opening),
  // y: fabric height, z: bottom-cut distance (> 0 where the fabric exists).
  vec3 hoodField(vec2 p) {
    // HUVHÖJD: the hood hangs lower over the forehead (the opening's top edge
    // comes down, the sides stay put).
    vec2 c = vec2(uSway.x, 0.04 + uSway.y - uDrop * 0.22);
    vec2 q = p - c;
    float ang = atan(q.y, q.x);
    // The hem itself ripples a little, slowest at the top of the head.
    float flutter = uMotion * (
      0.012 * sin(ang * 7.0 + uTime * 1.7) +
      0.008 * sin(ang * 13.0 - uTime * 2.3 + 1.3)
    );
    // ÖPPNINGSBREDD: when set (> 0) the opening's half-width is that many
    // half-screen-widths (1 = the screen's edges, above 1 = wider than the
    // screen); 0 (AUTO) follows ÖPPNING.
    float a = uOpenWidth > 0.0 ? uAspect * uOpenWidth : uAspect * mix(0.55, 0.95, uOpening) + 0.06;
    float b = mix(0.6, 0.98, uOpening) * (1.0 - uDrop * 0.3);
    // RUNDHET: the opening's corner shape, from boxy (0) to round (1).
    float n = mix(6.0, 2.0, clamp(uRound, 0.0, 1.0));
    float r;
    if (q.y > 0.0) {
      vec2 e = abs(vec2(q.x / a, q.y / b));
      r = pow(pow(e.x, n) + pow(e.y, n), 1.0 / n);
    } else if (uLower > 0.5) {
      // MUN OCH HALS: the hood closes under the face, the cover's top edge
      // at this screen height (wider and flatter than the top of the hood).
      float edgeY = mix(-0.92, -0.05, uLowerHeight) + uSway.y;
      float bb = max(c.y - edgeY, 0.05);
      vec2 e = abs(vec2(q.x / a, q.y / bb));
      float nl = n + 0.6;
      r = pow(pow(e.x, nl) + pow(e.y, nl), 1.0 / nl);
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
    // VÅTA VECK: fine, irregular wrinkles where wet cloth clings.
    float wr = 0.0;
    if (uWrinkle > 0.001) {
      wr = sin(p.x * 19.0 + sin(p.y * 11.0 + ph * 0.2) * 2.5) *
           sin(p.y * 16.0 - p.x * 6.0 + sin(p.x * 7.0) * 1.5)
         + 0.5 * sin(ang * 23.0 + t * 17.0 + sin(p.x * 9.0 + p.y * 5.0) * 1.7)
         + 0.3 * sin(p.x * 31.0 + p.y * 27.0 + sin(p.y * 13.0) * 2.0);
      wr *= uWrinkle * 0.008 * smoothstep(HEM * 0.6, HEM * 1.6, t);
    }
    float h = hem + curve + g * 0.022 * gatherMask + wr;

    // STIL: winter-coat padding. PUFFIG = channels running around the
    // opening, VADDERAD = diamond quilting. PUFFSTORLEK sets their size and
    // PUFFHÖJD how much they bulge; the stiffer padding also folds less.
    if (uStyle > 0.5) {
      float sp = mix(0.07, 0.26, clamp(uPuffSize, 0.0, 1.0));
      float amp = mix(0.0, 0.07, clamp(uPuffHeight, 0.0, 1.0));
      float puff;
      if (uStyle < 1.5) {
        float fu = 2.0 * fract(tc / sp) - 1.0;
        puff = sqrt(max(0.0, 1.0 - fu * fu));
      } else {
        vec2 fd = 2.0 * fract(vec2(p.x + p.y, p.x - p.y) / (sp * 1.4)) - 1.0;
        puff = sqrt(max(0.0, 1.0 - fd.x * fd.x)) * sqrt(max(0.0, 1.0 - fd.y * fd.y));
      }
      h += amp * puff * smoothstep(HEM, HEM + 0.04, t) - g * 0.015 * gatherMask;
    }

    // HÖJD FRÅN BOTTEN: the sides end at this screen height, curling up
    // toward the opening.
    float yCut = mix(-1.08, 0.8, uHeight) + 0.22 * exp(-max(t, 0.0) * 7.0);
    float cut = p.y - yCut + 0.01 * sin(p.x * 11.0 + uTime * 1.3) * uMotion;
    // MUDD: a ribbed knit cuff along the bottom of the hood (at the screen's
    // bottom with MUN OCH HALS, else along the sides' bottom edge).
    // MUDDHÖJD sets the band's height, RIBBSTORLEK the ribs' width.
    gCuff = 0.0;
    if (uCuff > 0.5) {
      float cuffV = uLower > 0.5 ? p.y + 1.0 - uSway.y * 0.5 : cut;
      float H = mix(0.06, 0.45, clamp(uCuffHeight, 0.0, 1.0));
      float x = clamp(cuffV / H, 0.0, 1.0);
      float mask = (1.0 - smoothstep(H - 0.006, H, cuffV)) * step(-0.02, cuffV);
      float freq = mix(240.0, 50.0, clamp(uCuffSize, 0.0, 1.0));
      float ribs = 0.006 * (0.5 + 0.5 * cos(p.x * freq + sin(p.y * 9.0) * 0.4));
      float hc = 0.34 + sin(3.14159 * x) * 0.035 + ribs;
      h = mix(h, hc, mask);
      gCuff = mask;
    }
    // With MUN OCH HALS on, the fabric runs all the way down.
    if (uLower > 0.5) cut = 1.0;
    return vec3(t, h, cut);
  }

  vec3 env(vec3 d) {
    if (d.y >= 0.0) return mix(uHorizon, uSky, pow(clamp(d.y, 0.0, 1.0), 0.6));
    return mix(uHorizon, uWater, smoothstep(0.0, 0.35, -d.y));
  }

  // A brushed-metal shade for the zipper's teeth, slider and pull.
  vec3 metalShade(vec3 nView, vec3 V, vec3 L) {
    vec3 N = normalize(uViewToWorld * nView);
    vec3 R = reflect(-V, N);
    float sunUp = clamp(L.y + 0.15, 0.0, 1.0);
    // Silver lit by the sky, plus a softer mirror term (a pure mirror would
    // mostly show the dark water below and read as black).
    vec3 lit = mix(uHorizon, uSky, 0.5) * 0.75 + uSunCol * 0.25 * sunUp + 0.12;
    vec3 c = vec3(0.66, 0.68, 0.72) * lit + env(R) * 0.3;
    c += uSunCol * pow(max(dot(R, L), 0.0), 60.0) * 1.6 * sunUp;
    return c * mix(0.75, 1.0, clamp(N.y * 0.5 + 0.5, 0.0, 1.0));
  }

  void main() {
    vec2 p = vec2(vNdc.x * uAspect, vNdc.y);
    vec3 f = hoodField(p);
    float cuffMask = gCuff;
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

    // VATTEN I HUVAN: water that has run in between the hood and the face.
    // The fabric sits about HOOD_DIST m from the eye along this pixel's view
    // ray, so it is under water where eye height + ray.y * HOOD_DIST drops
    // below the (sloshing) water inside. Tilting the head moves the line,
    // and it fills the whole hood once the head goes under.
    float wl = 1.0;
    float wet = 0.0;
    if (uWaterIn > 0.5) {
      const float HOOD_DIST = 0.3;
      vec3 rayW = normalize(uViewToWorld * vec3(p.x * uTanHalfFov, p.y * uTanHalfFov, -1.0));
      float slosh = (0.6 * uSway.x * rayW.x + 0.4 * uSway.y) * 0.9 +
        (0.006 + 0.012 * uMotion) * sin(rayW.x * 9.0 + rayW.z * 5.0 + uTime * 2.1) +
        (0.004 + 0.008 * uMotion) * sin(rayW.z * 13.0 - rayW.x * 4.0 - uTime * 2.9);
      wl = uEyeAbove - uWaterLevelIn * 0.35 + rayW.y * HOOD_DIST - slosh;
      float aaW = max(fwidth(wl), 1e-4);
      wet = 1.0 - smoothstep(-aaW, aaW, wl);
      // Seen through the water the fabric's folds wobble.
      vec2 wob = vec2(
        sin(p.y * 38.0 + uTime * 3.1) + sin(p.x * 23.0 - uTime * 2.2),
        cos(p.x * 35.0 - uTime * 2.6) + cos(p.y * 19.0 + uTime * 1.7)
      ) * 0.09;
      nView = normalize(nView + vec3(wob * wet, 0.0));
    }
    vec3 vView = normalize(vec3(-p.x * uTanHalfFov, -p.y * uTanHalfFov, 1.0));
    vec3 N = normalize(uViewToWorld * nView);
    vec3 V = normalize(uViewToWorld * vView);
    vec3 L = normalize(uSunDir);
    vec3 R = reflect(-V, N);

    // The hood's inside is in its own shade: darker the deeper into it.
    float ao = mix(1.0, 0.32, smoothstep(HEM, HEM + 0.7, t));
    float hemLight = 1.0 - 0.35 * smoothstep(0.0, HEM, t);

    float m = clamp(uMetal, 0.0, 1.0);
    m = mix(m, m * 0.3, cuffMask); // knit cuffs stay mostly matte
    vec3 base = uColor * mix(1.0, 0.55, m) * mix(1.0, 0.82, cuffMask); // wet cloth reads darker
    // MÖRKHET: darker lighting overall, for really dark fabric.
    float light = mix(1.0, 0.18, clamp(uDark, 0.0, 1.0));
    vec3 ambient = (mix(uHorizon, uSky, 0.5 + 0.5 * N.y) * 0.6 + 0.1) * light;
    float sunUp = clamp(L.y + 0.15, 0.0, 1.0);
    float diff = (0.35 + 0.65 * max(dot(N, L), 0.0)) * sunUp;
    vec3 col = base * (ambient * ao + uSunCol * diff * ao * 0.7 * light) * mix(1.0, 0.55, m);

    vec3 F0 = mix(vec3(0.04), max(uColor, vec3(0.15)), m * 0.75);
    float ndv = clamp(dot(N, V), 0.0, 1.0);
    vec3 fres = F0 + (1.0 - F0) * pow(1.0 - ndv, 5.0);
    col += env(R) * fres * (0.25 + 1.1 * m) * mix(0.5, 1.0, ao) * mix(1.0, 0.45, uDark);
    float shin = mix(10.0, 140.0, m);
    float spec = pow(max(dot(R, L), 0.0), shin) * (0.15 + 2.2 * m) * sunUp;
    col += uSunCol * spec * mix(0.6, 1.0, ao);
    // A soft broad sheen along the gathers' crests, the wet-fabric look.
    col += env(N) * m * 0.18 * smoothstep(0.55, 1.0, ndv) * ao * light;
    col *= hemLight + 0.35;

    // BLIXTLÅS: a zipper down the middle of the mouth/neck cover, with the
    // slider and its pull tab at the top.
    if (uLower > 0.5 && uZipper > 0.5) {
      vec2 zc = vec2(uSway.x, 0.04 + uSway.y);
      float edgeY = mix(-0.92, -0.05, uLowerHeight) + uSway.y;
      float zx = p.x - zc.x - 0.005 * sin(p.y * 5.0 + uTime * 0.8) * uMotion;
      float top = edgeY - HEM * 0.35;
      float aa = max(fwidth(p.x), 1e-4);
      if (p.y < top + 0.01) {
        float below = 1.0 - smoothstep(top - aa, top, p.y);
        // Tape: a darker strip of fabric the teeth sit on.
        float tape = (1.0 - smoothstep(0.045 - aa, 0.045, abs(zx))) * below;
        col = mix(col, col * 0.55, tape);
        // Teeth, alternating from each side and interlocking at the middle.
        float period = 0.036;
        float k = p.y / period;
        float side = mod(floor(k), 2.0) * 2.0 - 1.0;
        float fy = fract(k);
        float tooth = (1.0 - smoothstep(0.026 - aa, 0.026, abs(zx))) *
          smoothstep(0.1, 0.1 + aa / period, fy) * (1.0 - smoothstep(0.9 - aa / period, 0.9, fy)) *
          step(-0.009, zx * side) * below;
        vec3 nT = normalize(vec3(zx * 12.0, (fy - 0.5) * 1.2, 1.0));
        col = mix(col, metalShade(nT, V, L) * 0.9, tooth);
      }
      // Slider body just under the cover's top edge, and the pull hanging off it.
      vec2 sp = vec2(zx, p.y - (top - 0.05));
      vec2 sd = abs(sp) - vec2(0.036, 0.05);
      float slider = 1.0 - smoothstep(-aa, aa, length(max(sd, 0.0)) + min(max(sd.x, sd.y), 0.0) - 0.006);
      float swing = uSway.x * 2.0 + 0.06 * sin(uTime * 1.4) * uMotion;
      vec2 pp = vec2(zx + (p.y - (top - 0.1)) * swing, p.y - (top - 0.19));
      vec2 pd = abs(pp) - vec2(0.018, 0.075);
      float pull = 1.0 - smoothstep(-aa, aa, length(max(pd, 0.0)) + min(max(pd.x, pd.y), 0.0) - 0.008);
      float hole = 1.0 - smoothstep(-aa, aa, length(pp + vec2(0.0, 0.045)) - 0.009);
      pull *= 1.0 - hole;
      vec3 nS = normalize(vec3(sp.x * 10.0, sp.y * 4.0, 1.0));
      vec3 nP = normalize(vec3(pp.x * 25.0, 0.2, 1.0));
      col = mix(col, metalShade(nS, V, L), slider);
      col = mix(col, metalShade(nP, V, L) * 0.95, pull);
    }

    if (uWaterIn > 0.5) {
      // Fabric under the water inside the hood: tinted, dimmer, with a soft
      // caustic shimmer, and a bright meniscus along the waterline.
      float depth = max(-wl, 0.0);
      vec3 tint = mix(uWater * 1.6 + 0.05, mix(uHorizon, uSky, 0.5) * 0.45, 0.35);
      float shimmer = pow(
        (0.5 + 0.5 * sin(p.x * 23.0 + uTime * 2.4 + sin(p.y * 17.0 - uTime * 1.9) * 2.0)) *
        (0.5 + 0.5 * sin(p.y * 29.0 - p.x * 11.0 - uTime * 1.7 + sin(p.x * 13.0 + uTime) * 1.5)),
        3.0);
      vec3 under = mix(col, col * 0.5 + tint * 0.6, 0.65 * (1.0 - exp(-depth * 10.0)) + 0.35);
      under += mix(uHorizon, uSky, 0.5) * shimmer * 0.09 * exp(-depth * 6.0);
      col = mix(col, under, wet);
      float aaW = max(fwidth(wl), 1e-4);
      float meniscus = exp(-abs(wl) / (aaW * 2.5 + 0.004));
      col += (mix(uHorizon, uSky, 0.5) * 0.45 + uSunCol * 0.15) * meniscus * inside;
    }

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
    uOpenWidth: { value: number };
    uLower: { value: number };
    uLowerHeight: { value: number };
    uZipper: { value: number };
    uWaterIn: { value: number };
    uEyeAbove: { value: number };
    uWaterLevelIn: { value: number };
    uDrop: { value: number };
    uWrinkle: { value: number };
    uDark: { value: number };
    uRound: { value: number };
    uStyle: { value: number };
    uPuffSize: { value: number };
    uPuffHeight: { value: number };
    uCuff: { value: number };
    uCuffHeight: { value: number };
    uCuffSize: { value: number };
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

  /** `order` stacks layers: a higher one draws over a lower one. */
  constructor(scene: THREE.Scene, order = 0) {
    this.uniforms = {
      uAspect: { value: 1 },
      uTanHalfFov: { value: 1 },
      uTime: { value: 0 },
      uSway: { value: new THREE.Vector2() },
      uMotion: { value: 0.5 },
      uHeight: { value: 0.3 },
      uOpening: { value: 0.5 },
      uOpenWidth: { value: 0 },
      uLower: { value: 0 },
      uLowerHeight: { value: 0.45 },
      uZipper: { value: 0 },
      uWaterIn: { value: 0 },
      uEyeAbove: { value: 1 },
      uWaterLevelIn: { value: 0.3 },
      uDrop: { value: 0 },
      uWrinkle: { value: 0 },
      uDark: { value: 0 },
      uRound: { value: 0.85 },
      uStyle: { value: 0 },
      uPuffSize: { value: 0.4 },
      uPuffHeight: { value: 0.5 },
      uCuff: { value: 0 },
      uCuffHeight: { value: 0.3 },
      uCuffSize: { value: 0.5 },
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
    this.mesh.renderOrder = 1e6 + order;
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
    u.uOpenWidth.value = Math.max(0, Number.isFinite(cfg.openingWidth) ? cfg.openingWidth : 0);
    u.uLower.value = cfg.lower ? 1 : 0;
    u.uZipper.value = cfg.zipper ? 1 : 0;
    u.uWaterIn.value = cfg.waterInside ? 1 : 0;
    u.uDrop.value = THREE.MathUtils.clamp(cfg.drop, 0, 1);
    u.uWrinkle.value = THREE.MathUtils.clamp(cfg.wrinkles, 0, 1);
    u.uDark.value = THREE.MathUtils.clamp(cfg.darkness, 0, 1);
    u.uRound.value = THREE.MathUtils.clamp(cfg.roundness, 0, 1);
    u.uStyle.value = cfg.style === "puffy" ? 1 : cfg.style === "quilted" ? 2 : 0;
    u.uPuffSize.value = THREE.MathUtils.clamp(cfg.puffSize, 0, 1);
    u.uPuffHeight.value = THREE.MathUtils.clamp(cfg.puffHeight, 0, 1);
    u.uCuff.value = cfg.cuff ? 1 : 0;
    u.uCuffHeight.value = THREE.MathUtils.clamp(cfg.cuffHeight, 0, 1);
    u.uCuffSize.value = THREE.MathUtils.clamp(cfg.cuffSize, 0, 1);
    u.uWaterLevelIn.value = THREE.MathUtils.clamp(cfg.waterInsideLevel, 0, 1);
    u.uEyeAbove.value = Number.isFinite(cfg.eyeAboveWater) ? cfg.eyeAboveWater : 1;
    u.uLowerHeight.value = THREE.MathUtils.clamp(cfg.lowerHeight, 0, 1);
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

    // RÖRELSE + TYNGD: the hood hangs on the head like cloth on a damped
    // spring. Moving up leaves it behind (it slides down), sinking lifts it,
    // and turning or moving sideways swings it the other way. Heavier cloth
    // sags more, swings further and settles more slowly.
    const weight = THREE.MathUtils.clamp(cfg.weight, 0, 1);
    const heavy = 0.5 + weight * 1.5;
    const step = Math.min(Math.max(dt, 0), 0.1);
    let pushX = 0;
    let pushY = 0;
    if (this.hasLast && step > 0) {
      // Camera rotation since last frame, in the camera's own frame.
      this.tmpQ.copy(this.lastQuat).invert().multiply(camera.quaternion);
      this.tmpE.setFromQuaternion(this.tmpQ, "YXZ");
      const yawRate = THREE.MathUtils.clamp(this.tmpE.y / step, -6, 6);
      const pitchRate = THREE.MathUtils.clamp(this.tmpE.x / step, -6, 6);
      // Camera velocity, in the camera's own frame (x = right, y = up).
      this.tmpV.copy(camera.position).sub(this.lastPos).divideScalar(step);
      const vyWorld = THREE.MathUtils.clamp(this.tmpV.y, -8, 8);
      this.tmpQ.copy(camera.quaternion).invert();
      this.tmpV.applyQuaternion(this.tmpQ);
      const vxLocal = THREE.MathUtils.clamp(this.tmpV.x, -8, 8);
      pushX = (yawRate * 0.05 - vxLocal * 0.02) * heavy;
      pushY = (-pitchRate * 0.04 - vyWorld * 0.02) * heavy;
    }
    this.lastQuat.copy(camera.quaternion);
    this.lastPos.copy(camera.position);
    this.hasLast = true;
    if (step > 0) {
      const k = THREE.MathUtils.lerp(55, 16, weight);
      const damping = THREE.MathUtils.lerp(9, 4.5, weight);
      const idleX = Math.sin(time * 0.7) * 0.006 + Math.sin(time * 1.9 + 1.2) * 0.003;
      const idleY = Math.sin(time * 0.9 + 0.4) * 0.005;
      const targetX = (pushX + idleX) * motion;
      const targetY = (pushY + idleY) * motion - weight * 0.04;
      this.swayVel.x += ((targetX - this.sway.x) * k - this.swayVel.x * damping) * step;
      this.swayVel.y += ((targetY - this.sway.y) * k - this.swayVel.y * damping) * step;
      this.sway.x += this.swayVel.x * step;
      this.sway.y += this.swayVel.y * step;
      const maxX = 0.12 + 0.08 * weight;
      const maxY = 0.08 + 0.08 * weight;
      this.sway.x = THREE.MathUtils.clamp(this.sway.x, -maxX, maxX);
      this.sway.y = THREE.MathUtils.clamp(this.sway.y, -maxY, maxY);
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
