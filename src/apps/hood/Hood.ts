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
  /**
   * 0..1: how calmly the water inside follows the waves outside (VATTENLUGN).
   * 0 = instantly (the old look, which flickers in fast waves), 1 = a slow,
   * heavy slosh.
   */
  waterCalm: number;
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
  /** Coat style (STIL). */
  style: "classic" | "puffy" | "quilted" | "shell" | "down";
  /** 0..1: padding size and bulge (PUFFSTORLEK, PUFFHÖJD). */
  puffSize: number;
  puffHeight: number;
  /** 0..1: how full the padding is, flat seams .. fat puffs (PUFFTJOCKLEK). */
  puffThickness: number;
  /** 0..1: how much the puffs swell once the hood is in the water (UPPBLÅSNING I VATTEN). */
  puffInflate: number;
  /** The wet sheen reflects the bright sky and light rather than the dark water (REFLEKTERAR LJUS). */
  reflectLight: boolean;
  /** Ribbed cuff along the bottom (MUDD), its height and rib size (MUDDHÖJD, RIBBSTORLEK). */
  cuff: boolean;
  cuffHeight: number;
  cuffSize: number;
  /**
   * MUDD VID HALSKANT: the cuff runs along the top edge of the funnel neck
   * (the opening's lower edge), pinned to the cloth. Off: the old band along
   * the bottom of the view.
   */
  cuffTop: boolean;
  /**
   * EGEN MUDD: the cuff gets its own look instead of the hood's:
   * MUDDFÄRG, MUDDGLANS and MUDDMATERIAL (ribbed knit, smooth stretch, rubber).
   */
  cuffCustom: boolean;
  cuffColor: string;
  cuffMetallic: number;
  cuffMaterial: "knit" | "smooth" | "rubber";
  /**
   * HÄNGER FRÅN TOPPEN: the hood hangs from the top of the head. The top
   * follows you, the bottom lags (more with TYNGD) and twists like wet
   * cloth in the water. Off: the whole hood sways as one piece (the old look).
   */
  hanging: boolean;
  /**
   * HUVDEL: the hood above the face. Off (with MUN OCH HALS on) leaves only
   * the funnel neck, as a separate collar with no hood above it.
   */
  hoodTop: boolean;
  /**
   * KRAGE UPPÅT: the neck cover's edge bends up in the middle instead of
   * dipping, like a collar pulled up over the mouth on a cold day.
   */
  collarUp: boolean;
  /** 0..1: DRA NER BLIXTLÅS, how far the zipper is pulled down (0 = closed). */
  zipperOpen: number;
  /**
   * 0..1: FLYTANDE, how much the cloth below FLYTGRÄNS floats and bends
   * with the waves, lifted and puffed up by trapped air (more for padded
   * styles, less the heavier the cloth).
   */
  floating: number;
  /** 0..1: VATTENFÄRG, how blue the water inside the cloth is (0 = neutral grey). */
  waterTint?: number;
  /** 0..1: DROPPAR, water dripping off the wet cloth's hem. */
  dripping?: number;
  /** 0..1: HUVA BAKÅT, the top hood pulled back off the head. */
  pullBack?: number;
  /** 0..1: HALS NERÅT, the funnel neck pulled down. */
  neckBack?: number;
  /** HUVA SEPARAT FRÅN HALS: the neck is its own wrap-around collar, the hood mounted separately. */
  separate?: boolean;
  /** 3D-TYG: this layer is drawn as real geometry (HoodMesh3D) instead. */
  real3d?: boolean;
  /** Draw only the water drops (the 3D cloth is drawn by HoodMesh3D); this still keeps the water state. */
  dropsOnly?: boolean;
  /** EGEN LÄNGD: end the cloth at `length` (MUDD at the hem) instead of running on down. */
  lengthOn?: boolean;
  /**
   * 0..1: LÄNGD, short collar (0) .. ankle-long dress (1). Longer than the
   * float suit (FLOAT_SUIT_LENGTH), the lower part wraps around you in the
   * water like swimming in a dress.
   */
  length?: number;
  /** 3D-PUFFAR: puffs with real depth (bulging over the opening's edge and each other). */
  puff3d?: boolean;
  /** 0..1: FLYTGRÄNS, the screen height below which the cloth floats. */
  floatThreshold: number;
  /** Radians the head looks down while ROTERA HUVUD is on (0 = off / level). */
  rotateHead: number;
  /** FLYTDRÄKT color, shown where the cloth opens (zipper pulled down). */
  suitColor: string;
  /**
   * SKUGGA PÅ VYN: a soft contact shadow the hood casts onto the view just
   * inside the opening (the old look). Off by default: it made the world
   * read like a screen seen through a frame.
   */
  viewShadow: boolean;
  /** BLIXTLÅS FÄST I TYGET: the zipper's teeth move with the cloth, not the view. */
  zipperFixed: boolean;
  /** DRAGARE PÅ UTSIDAN: the pull tab sits on the outside; from inside only the slider's back shows. */
  zipperPullOut: boolean;
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
  uniform float uHang;
  uniform float uViewShadow;
  uniform float uHangHeavy;
  uniform float uTwist;
  uniform float uMotion;
  uniform float uHeight;
  uniform float uOpening;
  uniform float uOpenWidth;
  uniform float uLower;
  uniform float uTopOff;
  uniform float uCollarUp;
  uniform float uZipOpen;
  uniform float uFloatAmt;
  uniform float uFloatLift;
  uniform float uFloatInflate;
  uniform float uFloatLine;
  uniform float uRotateHead;
  uniform float uHemY;
  uniform float uSep;
  uniform float uWaterTint;
  uniform float uDrip;
  uniform float uDropsOnly;
  uniform float uHoodBack;
  uniform float uNeckBack;
  uniform float uWrap;
  uniform float uWrapRise;
  uniform float uWrapSpeed;
  uniform float uPuff3d;
  uniform vec3 uSuitColor;
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
  uniform float uPuffThick;
  uniform float uInflate;
  uniform float uReflLight;
  uniform float uCuff;
  uniform float uCuffHeight;
  uniform float uCuffSize;
  uniform float uCuffTop;
  uniform float uCuffCustom;
  uniform vec3 uCuffColor;
  uniform float uCuffMetal;
  uniform float uCuffMat;
  uniform float uZipFixed;
  uniform float uZipPullOut;
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
  // The funnel neck's top edge (screen height); HALS NERÅT pulls it down.
  float neckEdgeY() {
    return mix(-0.92, -0.05, uLowerHeight) + uSway.y - uNeckBack * 0.95;
  }
  // The top hood's rim (the opening's upper edge) at screen x, or -9 where
  // the opening doesn't reach. Mirrors hoodField()'s opening.
  float rimTopY(float x) {
    vec2 c = vec2(uSway.x, 0.04 + uSway.y - uDrop * 0.22);
    float a0 = uOpenWidth > 0.0 ? uAspect * uOpenWidth : uAspect * mix(0.55, 0.95, uOpening) + 0.06;
    float b0 = mix(0.6, 0.98, uOpening) * (1.0 - uDrop * 0.3);
    float pb = clamp(uHoodBack, 0.0, 1.0);
    float a = a0 * (1.0 + pb * 0.9);
    float b = b0 * (1.0 + pb * 1.1);
    float n = mix(6.0, 2.0, clamp(uRound, 0.0, 1.0));
    float ex = abs(x - c.x) / a;
    if (ex >= 1.0) return -9.0;
    return c.y + pb * 0.25 + b * pow(1.0 - pow(ex, n), 1.0 / n);
  }
  // KRAGE UPPÅT: how far up the middle of the neck cover's edge is pulled.
  const float COLLAR_UP = 0.24;
  // Set by hoodField(): 1 inside the MUDD (cuff) band.
  float gCuff = 0.0;
  // MUDD VID HALSKANT: the rib (0 groove .. 1 crest) and how far down the band.
  float gCuffRib = 0.5;
  float gCuffX = 0.0;
  // Set by hoodField(): how far the padding bulges here (3D-PUFFAR).
  float gPuff = 0.0;
  // Set by hoodField(): 0..1 how deep into the floating dress (LÄNGD) this is.
  float gWrap = 0.0;

  // x: how far into the fabric (0 at the opening's edge, < 0 in the opening),
  // y: fabric height, z: bottom-cut distance (> 0 where the fabric exists).
  vec3 hoodField(vec2 p) {
    // HUVHÖJD: the hood hangs lower over the forehead (the opening's top edge
    // comes down, the sides stay put).
    vec2 c = vec2(uSway.x, 0.04 + uSway.y - uDrop * 0.22);
    vec2 q = p - c;
    float ang = atan(q.y, q.x);
    gPuff = 0.0;
    gWrap = 0.0;
    // The hem itself ripples a little, slowest at the top of the head.
    float flutter = uMotion * (
      0.012 * sin(ang * 7.0 + uTime * 1.7) +
      0.008 * sin(ang * 13.0 - uTime * 2.3 + 1.3)
    );
    // ÖPPNINGSBREDD: when set (> 0) the opening's half-width is that many
    // half-screen-widths (1 = the screen's edges, above 1 = wider than the
    // screen); 0 (AUTO) follows ÖPPNING.
    float a0 = uOpenWidth > 0.0 ? uAspect * uOpenWidth : uAspect * mix(0.55, 0.95, uOpening) + 0.06;
    float b0 = mix(0.6, 0.98, uOpening) * (1.0 - uDrop * 0.3);
    // HUVA BAKÅT: the top hood is pulled back off the head, so its rim
    // opens wide and slides up and out of view. The funnel neck keeps a0.
    float pb = clamp(uHoodBack, 0.0, 1.0);
    float a = a0 * (1.0 + pb * 0.9);
    float b = b0 * (1.0 + pb * 1.1);
    // RUNDHET: the opening's corner shape, from boxy (0) to round (1).
    float n = mix(6.0, 2.0, clamp(uRound, 0.0, 1.0));
    float r;
    bool funnelOnly = uLower > 0.5 && uTopOff > 0.5;
    // HUVA SEPARAT FRÅN HALS: the neck is its own collar (below), so the
    // hood itself is the plain top-and-sides piece.
    bool sep = uSep > 0.5 && uLower > 0.5;
    bool lowerOn = uLower > 0.5 && !sep;
    float isNeck = 0.0;
    // The funnel neck's true distance from its edge and a continuous
    // arc coordinate, for a cuff whose band and ribs keep their size.
    float nDist = 0.0;
    float nArc = 0.0;
    if (q.y > 0.0) {
      vec2 e = abs(vec2(q.x / a, (q.y - pb * 0.25) / b));
      r = pow(pow(e.x, n) + pow(e.y, n), 1.0 / n);
      // HUVDEL off: nothing above the funnel neck.
      if (funnelOnly) r = 0.0;
    } else if (lowerOn) {
      // MUN OCH HALS: the hood closes under the face, the cover's top edge
      // at this screen height (wider and flatter than the top of the hood).
      // On its own (HUVDEL off) the funnel neck is a wider U that stays
      // low at the sides instead of running up into the hood.
      float edgeY = neckEdgeY();
      float bb = max(c.y - edgeY, 0.05);
      float aL = funnelOnly ? a0 * 1.5 : a0;
      vec2 e = abs(vec2(q.x / aL, q.y / bb));
      float nl = n + 0.6;
      r = pow(pow(e.x, nl) + pow(e.y, nl), 1.0 / nl);
      {
        // |grad r| gives the real screen distance from the edge, (r-1) /
        // |grad r|, instead of the stretched superellipse value (which made
        // the band swell at the bottom and pinch at the sides), and the
        // angle from straight down is a seam-free coordinate along it.
        float rr = max(r, 1e-3);
        vec2 gv = vec2(pow(max(e.x, 1e-4), nl - 1.0) / aL, pow(max(e.y, 1e-4), nl - 1.0) / bb);
        float gl = max(pow(rr, 1.0 - nl) * length(gv), 1e-3);
        nDist = (r - 1.0) / gl;
        nArc = atan(q.x / aL, -q.y / bb) * 0.9;
      }
      if (uCollarUp > 0.5) {
        // KRAGE UPPÅT: the middle of the edge is pulled up over the mouth,
        // falling away to the usual edge toward the sides.
        float xx = q.x / (aL * 0.62);
        float bump = COLLAR_UP * (1.0 - smoothstep(0.0, 1.0, abs(xx)));
        float rUp = 1.0 + (edgeY + bump - p.y) / min(a, b);
        // Smooth union, so the edge and the cuff band curve into the bump
        // instead of meeting it at a sharp corner.
        float kS = 0.35;
        float hS = clamp(0.5 + 0.5 * (rUp - r) / kS, 0.0, 1.0);
        r = mix(r, rUp, hS) + kS * hS * (1.0 - hS);
        // The cuff band follows the raised edge, not the old lower one: where
        // the bump wins, measure the distance from the bump's own edge (made
        // the real distance across its slope).
        float uB = clamp(abs(xx), 0.0, 1.0);
        float slopeB = COLLAR_UP * 6.0 * uB * (1.0 - uB) / (aL * 0.62);
        float dUp = (edgeY + bump - p.y) * inversesqrt(1.0 + slopeB * slopeB);
        nDist = mix(nDist, dUp, hS);
      }
    } else {
      // Below the opening's center the sides hang straight, flaring a little.
      r = abs(q.x) / (a * (1.0 + 0.12 * q.y * q.y));
    }
    float t = (r - 1.0) * min(a, b) + flutter;
    if (sep) {
      if (uTopOff > 0.5) t = -1.0; // HUVDEL off: just the collar.
      // The collar wraps around you: its edge is lowest in front and runs
      // up toward the sides (toward the back of the neck); KRAGE UPPÅT
      // makes it a tall funnel that stays high all around.
      float xN = (p.x - uSway.x * 0.6) / uAspect;
      float funnel = uCollarUp > 0.5 ? COLLAR_UP : 0.0;
      float yE = neckEdgeY() + funnel + (0.55 - funnel * 1.2) * xN * xN;
      float slopeN = (0.55 - funnel * 1.2) * 2.0 * xN / uAspect;
      // Vertical distance to the edge, made the real distance across it.
      float tN = (yE - p.y) * inversesqrt(1.0 + slopeN * slopeN) + flutter * 0.5;
      if (tN > 0.0) {
        t = tN;
        isNeck = 1.0;
        ang = xN * 5.0;
      }
    }

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
    // FLYTANDE: below FLYTGRÄNS, trapped air puffs the wet cloth up in
    // big, soft, slowly drifting bubbles.
    if (uFloatInflate > 0.001) {
      float kF = 1.0 - smoothstep(uFloatLine - 0.25, uFloatLine + 0.05, p.y);
      float bub = sin(p.x * 3.1 + uTime * 0.35) * sin(p.y * 4.3 - uTime * 0.27 + 1.3);
      bub = 0.5 + 0.5 * bub;
      h += uFloatInflate * kF * bub * bub * 0.09 * smoothstep(HEM, HEM + 0.1, t);
    }

    // STIL: winter-coat padding. PUFFIG = channels running around the
    // opening, VADDERAD = diamond quilting, DUN = big, uneven down baffles.
    // PUFFSTORLEK sets their size, PUFFHÖJD how much they bulge and
    // PUFFTJOCKLEK how full they are (flat with wide seams .. fat and round,
    // pinched only at the stitching). UPPBLÅSNING I VATTEN (uInflate, already
    // scaled by how deep the hood is in the water) swells them further. The
    // stiffer padding also folds less.
    if ((uStyle > 0.5 && uStyle < 2.5) || uStyle > 3.5) {
      float inf = clamp(uInflate, 0.0, 1.0);
      float th = clamp(uPuffThick, 0.0, 1.0);
      // Profile exponent: 1 at the default thickness, < 1 is fuller.
      float ex = (th < 0.5 ? mix(2.2, 1.0, th * 2.0) : mix(1.0, 0.35, th * 2.0 - 1.0)) * mix(1.0, 0.5, inf);
      float sp = mix(0.07, 0.26, clamp(uPuffSize, 0.0, 1.0)) * (1.0 + 0.12 * inf);
      float amp = 0.07 * clamp(uPuffHeight, 0.0, 2.5) * mix(0.7, 1.3, th) * (1.0 + 1.4 * inf);
      float puff;
      if (uStyle < 1.5) {
        float fu = 2.0 * fract(tc / sp) - 1.0;
        puff = pow(max(0.0, 1.0 - fu * fu), 0.5 * ex);
      } else if (uStyle < 2.5) {
        vec2 fd = 2.0 * fract(vec2(p.x + p.y, p.x - p.y) / (sp * 1.4)) - 1.0;
        puff = pow(max(0.0, 1.0 - fd.x * fd.x) * max(0.0, 1.0 - fd.y * fd.y), 0.5 * ex);
      } else {
        // DUN: wider baffles that each bulge a little differently along
        // their length, with a sharp stitched crease between them.
        float spD = sp * 1.45;
        float cell = floor(tc / spD);
        float fu = 2.0 * fract(tc / spD) - 1.0;
        float lump = 0.82 + 0.18 * sin(ang * (5.0 + mod(cell, 3.0)) + cell * 1.9)
                          + 0.06 * sin(ang * 13.0 - cell * 2.7);
        puff = pow(max(0.0, 1.0 - fu * fu), 0.4 * ex) * lump;
        amp *= 1.25;
      }
      gPuff = amp * puff * smoothstep(HEM, HEM + 0.04, t);
      h += gPuff - g * 0.015 * gatherMask;
    } else if (uStyle > 2.5) {
      // SKALJACKA: a taut, smooth shell: hardly any gathers, a few welded
      // panel seams (around the opening and running back over the head)
      // and a fine crinkle in the coated nylon.
      h -= g * 0.017 * gatherMask;
      float on = smoothstep(HEM, HEM + 0.03, t);
      float ringD = abs(tc - 0.2);
      float seam = exp(-ringD * ringD / 0.00006);
      float rad = abs(sin(ang * 2.0 + 0.35));
      seam += exp(-rad * rad / 0.0025) * smoothstep(0.05, 0.12, tc);
      float crinkle = sin(p.x * 61.0 + sin(p.y * 37.0) * 2.0) * sin(p.y * 53.0 - p.x * 21.0);
      h += (-0.0045 * min(seam, 1.0) + 0.0007 * crinkle) * on;
    }

    // HÖJD FRÅN BOTTEN: the sides end at this screen height, curling up
    // toward the opening.
    float yCut = mix(-1.08, 0.8, uHeight) + 0.22 * exp(-max(t, 0.0) * 7.0);
    float cut = p.y - yCut + 0.01 * sin(p.x * 11.0 + uTime * 1.3) * uMotion;
    // MUDD: a ribbed knit cuff along the bottom of the hood (at the screen's
    // bottom with MUN OCH HALS, else along the sides' bottom edge).
    // MUDDHÖJD sets the band's height, RIBBSTORLEK the ribs' width.
    gCuff = 0.0;
    if (uCuff > 0.5 && uCuffTop > 0.5) {
      // MUDD VID HALSKANT, fixed to the cloth (laid out from the opening's
      // center, which sways with the hood). With MUN OCH HALS the cuff is
      // the top of the funnel neck: a knit band starting right at the neck
      // cover's top edge (the opening's lower edge) and running down from
      // it. Without the cover it is the hem band along the hood's bottom
      // edge. MUDDHÖJD sets the band's height, RIBBSTORLEK the ribs' width.
      float H = mix(0.08, 0.6, clamp(uCuffHeight, 0.0, 1.0));
      float v;
      float Hq;
      float s;
      if (lowerOn) {
        v = nDist + flutter;
        // Full height under the face, narrowing to nothing where the edge
        // turns up into the hood's sides.
        Hq = H * (1.0 - smoothstep(-0.3, 0.0, q.y));
        s = nArc;
      } else if (sep) {
        v = isNeck > 0.5 ? t : -1.0;
        Hq = H;
        s = p.x * 5.0;
      } else {
        v = cut;
        Hq = H;
        s = q.x;
      }
      float x = clamp(v / max(Hq, 1e-3), 0.0, 1.0);
      float aa = 0.006;
      float mask = (1.0 - smoothstep(Hq - aa, Hq, v)) * smoothstep(-0.002, 0.004, v) * step(0.004, Hq);
      float freq = mix(300.0, 70.0, clamp(uCuffSize, 0.0, 1.0));
      float rib = 0.5 + 0.5 * cos(s * freq);
      // MUDDMATERIAL: smooth stretch and rubber have no ribs.
      if (uCuffCustom > 0.5 && uCuffMat > 0.5) rib = 0.5;
      gCuffRib = rib;
      gCuffX = x;
      // A rolled, ribbed band on the cloth's own curve.
      h += (sin(3.14159 * x) * 0.03 + 0.012 * rib) * mask;
      gCuff = mask;
    } else if (uCuff > 0.5) {
      float cuffV = lowerOn ? p.y + 1.0 - uSway.y * 0.5 : cut;
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
    if (lowerOn || isNeck > 0.5) cut = 1.0;
    // EGEN LÄNGD: the cloth ends at its hem (in the body's frame, so it
    // shows when ROTERA HUVUD looks down), with the MUDD along it.
    if (uHemY > -900.0) {
      float hv = p.y - uHemY + 0.01 * sin(p.x * 9.0 + uTime * 1.1) * uMotion;
      cut = min(cut, hv);
      if (uCuff > 0.5) {
        // Keep the band the same apparent height however far down it is.
        float kT = uHemY * uTanHalfFov;
        float H = mix(0.06, 0.45, clamp(uCuffHeight, 0.0, 1.0)) * (1.0 + kT * kT);
        float x = clamp(hv / H, 0.0, 1.0);
        float mask = (1.0 - smoothstep(H * 0.96, H, hv)) * step(-0.02, hv);
        float freq = mix(240.0, 50.0, clamp(uCuffSize, 0.0, 1.0));
        float rib = 0.5 + 0.5 * cos(p.x * freq);
        if (uCuffCustom > 0.5 && uCuffMat > 0.5) rib = 0.5;
        h += (sin(3.14159 * x) * 0.03 + 0.012 * rib) * mask;
        if (mask > gCuff) {
          gCuff = mask;
          gCuffRib = rib;
          gCuffX = x;
        }
      }
    }
    // LÄNGD past the float suit, in the water: the long lower part floats up
    // and wraps around you like a dress while swimming, billowing higher at
    // the sides. Light, airy cloth rises and drifts; heavy cloth clings low.
    if (uWrap > 0.001) {
      float sx = abs(p.x) / uAspect;
      float yS = -1.1 + uWrap * (
        uWrapRise * (0.18 + 0.3 * smoothstep(0.15, 1.0, sx)) +
        0.07 * sin(p.x * 2.3 + uTime * uWrapSpeed) +
        0.04 * sin(p.x * 5.7 - uTime * uWrapSpeed * 1.4 + 1.1));
      float tS = yS - p.y;
      if (tS > t || tS > cut) {
        float ws = sin(p.x * 7.0 + sin(p.y * 2.5 + uTime * uWrapSpeed * 0.6) * 2.2 + uTime * uWrapSpeed * 0.4);
        float hS = sin(3.14159 * clamp(tS / HEM, 0.0, 1.0)) * HEM * 0.6 +
          0.035 * ws * smoothstep(HEM, HEM + 0.15, tS) + 0.1;
        float k = smoothstep(-0.02, 0.02, tS - max(t, -1.0));
        h = mix(h, hS, k);
        gCuff *= 1.0 - k;
        gPuff *= 1.0 - k;
        gWrap = smoothstep(0.0, 0.5, tS) * k;
        t = max(t, tS);
        cut = max(cut, tS);
      }
    }
    return vec3(t, h, cut);
  }

  // One row of drops hanging from an edge: a bead grows, then falls. rim
  // rows hang from the top hood's rim, others from the lower hem.
  vec4 dropRow(vec2 pp, float edgeYFlat, bool rim, float seed) {
    float cw = 0.12;
    float cell = floor(pp.x / cw);
    float h1 = fract(sin((cell + seed) * 12.9898) * 43758.5453);
    float h2 = fract(sin((cell + seed) * 78.233) * 12543.17);
    float cx = (cell + 0.2 + 0.6 * h1) * cw;
    float edgeD = edgeYFlat;
    float clothHere;
    if (rim) {
      edgeD = rimTopY(cx);
      // The cloth is above the rim.
      clothHere = edgeD > -8.0 ? 1.0 : 0.0;
    } else {
      // Only where there is cloth hanging at this column's hem.
      clothHere = step(0.3, hoodField(vec2(cx, edgeD + 0.04)).x);
    }
    // A bead hangs and slowly grows, then lets go and falls like a real
    // drop: gravity (about 0.5 s across the view), stretching as it speeds up.
    float T = 1.6 + 2.4 * h2;
    float ph = fract(uTime / T + h1);
    float gEnd = clamp(1.0 - 0.55 / T, 0.5, 0.9);
    float tf = max(ph - gEnd, 0.0) * T;
    float fallT = clamp((ph - gEnd) / (1.0 - gEnd), 0.0, 1.0);
    float yd = edgeD - 0.006 - 4.8 * tf * tf;
    float grow = 0.5 + 0.5 * smoothstep(0.0, gEnd, ph);
    float stretch = 1.0 + 3.5 * min(tf, 0.5);
    vec2 dd = vec2((pp.x - cx) / (0.0034 * grow), (pp.y - yd) / (0.0075 * grow * stretch));
    // A teardrop: pointed on top, round below.
    dd.y *= dd.y > 0.0 ? 0.7 : 1.0;
    float body = 1.0 - smoothstep(0.7, 1.0, length(dd));
    float life = step(h1, uDrip * 1.15 + 0.1) * (1.0 - smoothstep(0.85, 1.0, fallT)) * clothHere;
    float dA = body * life * clamp(uDrip * 2.0, 0.0, 1.0);
    float spec = smoothstep(0.1, 0.0, length(dd - vec2(-0.3, 0.35)));
    vec3 dc = mix(uHorizon, uSky, 0.5) * 0.8 + uSunCol * 0.25;
    return vec4(dc + spec * 0.6, dA * 0.8);
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

  // HÄNGER FRÅN TOPPEN: warp the view position so the cloth near the top of
  // the head barely sways while the heavy bottom swings further and lags,
  // twisting about the top (each row turns a little more the lower it is).
  // Every later use of uSway then sees this pixel's own displacement.
  vec2 hangWarp(vec2 p) {
    if (uHang < 0.5) return p;
    float k = 1.0 - smoothstep(-1.05, 0.95, p.y);
    k = pow(k, 1.5);
    float f = mix(0.2, 1.0 + 0.8 * clamp(uHangHeavy, 0.0, 1.0), k);
    vec2 q = p - uSway * (f - 1.0);
    vec2 anchor = vec2(uSway.x * 0.2, 1.05);
    float a = uTwist * k;
    float cs = cos(a);
    float sn = sin(a);
    vec2 d = q - anchor;
    return anchor + vec2(cs * d.x + sn * d.y, -sn * d.x + cs * d.y);
  }

  // ROTERA HUVUD: the lower part of the clothes hangs on the body, not the
  // head, so when the head tilts down by uRotateHead it rises into view (a
  // pixel at view elevation e shows the body-fixed cloth at e - uRotateHead),
  // while the hood above keeps following the head.
  vec2 bodyWarp(vec2 p) {
    if (uRotateHead <= 0.0) return p;
    float e = atan(p.y * uTanHalfFov) - uRotateHead;
    float yb = tan(max(e, -1.45)) / uTanHalfFov;
    float w = 1.0 - smoothstep(-0.25, 0.3, p.y);
    return vec2(p.x, mix(p.y, yb, w));
  }

  // FLYTANDE: below FLYTGRÄNS the cloth floats: lifted (or dragged down
  // when heavy) and bending in slow waves that grow toward the hem.
  vec2 floatWarp(vec2 p) {
    if (uFloatAmt <= 0.001) return p;
    float kF = 1.0 - smoothstep(uFloatLine - 0.3, uFloatLine + 0.05, p.y);
    float wv = sin(p.x * 2.3 + uTime * 0.9) * 0.6 + sin(p.x * 4.1 - uTime * 1.3 + 0.7) * 0.4;
    float dy = (wv * 0.05 + uFloatLift) * uFloatAmt * kF;
    float dx = sin(p.y * 3.0 + uTime * 0.7) * 0.025 * uFloatAmt * kF;
    return p - vec2(dx, dy);
  }

  // FLYTDRÄKT: the padded float suit worn innermost, seen through an open
  // zipper. Fabric only (thick vertical padding channels), in the shade
  // inside the clothes.
  vec3 suitShade(vec2 p, float shade) {
    float ch = 0.8 + 0.2 * cos(p.x * 38.0);
    vec3 lit = mix(uHorizon, uSky, 0.5) * 0.55 + uSunCol * 0.12 + 0.08;
    return uSuitColor * lit * ch * shade;
  }

  void main() {
    vec2 p = floatWarp(bodyWarp(hangWarp(vec2(vNdc.x * uAspect, vNdc.y))));
    vec2 pDrip = p;
    // 3D-PUFFAR: a bulging puff stands toward the head, so from the eye it
    // is seen shifted in toward the opening; it overhangs the edge and the
    // puffs further out. Find the cloth point that lands on this pixel.
    if (uPuff3d > 0.5 && ((uStyle > 0.5 && uStyle < 2.5) || uStyle > 3.5)) {
      vec2 c0 = vec2(uSway.x, 0.04 + uSway.y - uDrop * 0.22);
      vec2 dir = normalize(p - c0 + vec2(1e-5, 0.0));
      vec2 s0 = p;
      for (int i = 0; i < 4; i++) {
        hoodField(s0);
        s0 = p + dir * gPuff * 1.8;
      }
      p = s0;
    }
    vec3 f = hoodField(p);
    float puffHere = gPuff;
    float wrapHere = gWrap;
    float cuffMask = gCuff;
    float cuffRib = gCuffRib;
    float cuffX = gCuffX;
    float t = f.x;
    float cut = f.z;
    float aaT = max(fwidth(t), 1e-4) * 1.5;
    float aaC = max(fwidth(cut), 1e-4) * 1.5;
    float inside = smoothstep(0.0, aaT, t) * smoothstep(0.0, aaC, cut);
    if (uDropsOnly > 0.5) inside = 0.0;
    // Contact shadow the hood throws onto the view just inside the opening.
    float rim = smoothstep(-0.04, 0.0, t) * (1.0 - smoothstep(0.0, aaT, t)) * smoothstep(-0.03, 0.05, cut) * uViewShadow;
    if (uDropsOnly > 0.5) rim = 0.0;
    // DROPPAR: beads of water gather at the wet cloth's hem and fall.
    vec4 drip = vec4(0.0);
    if (uDrip > 0.001) {
      // From the lower hem (or the hood's bottom edge) ...
      bool hasEdge = uHemY > -900.0 || uLower < 0.5 || uSep > 0.5;
      float edgeD = uHemY > -900.0 ? uHemY : mix(-1.08, 0.8, uHeight);
      if (hasEdge) drip = dropRow(pDrip, edgeD, false, 0.0);
      // ... and from the top hood's rim, falling through the opening.
      bool hasHood = !(uLower > 0.5 && uTopOff > 0.5);
      if (hasHood) {
        vec4 d2 = dropRow(pDrip, 0.0, true, 37.0);
        drip = d2.a > drip.a ? d2 : drip;
      }
    }
    if (inside <= 0.0 && rim <= 0.0 && drip.a <= 0.0) discard;

    // Height-field normal (view space, +z toward the eye).
    float e = 0.004;
    float hx1 = hoodField(p + vec2(e, 0.0)).y;
    float hy1 = hoodField(p + vec2(0.0, e)).y;
    float nK = uPuff3d > 0.5 ? 1.7 : 1.0;
    vec3 nView = normalize(vec3(-(hx1 - f.y) / e * nK, -(hy1 - f.y) / e * nK, 1.0));

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
    // The floating dress is out in the water, not inside the hood.
    ao = mix(ao, 0.75, wrapHere);
    // 3D-PUFFAR: deep, dark seams between the puffs.
    if (uPuff3d > 0.5) ao *= mix(0.45, 1.0, smoothstep(0.0, 0.035, puffHere));
    float hemLight = 1.0 - 0.35 * smoothstep(0.0, HEM, t);

    float m = clamp(uMetal, 0.0, 1.0);
    // SKALJACKA: coated nylon always has some gloss.
    if (uStyle > 2.5 && uStyle < 3.5) m = max(m, 0.3);
    // Knit cuffs stay mostly matte; EGEN MUDD sets its own gloss (rubber is
    // always fairly glossy).
    float cuffM = m * 0.3;
    if (uCuffCustom > 0.5) {
      cuffM = clamp(uCuffMetal, 0.0, 1.0);
      if (uCuffMat > 1.5) cuffM = max(cuffM, 0.6);
    }
    m = mix(m, cuffM, cuffMask);
    // REFLEKTERAR LJUS: wet cloth is darker but still lit; it doesn't go
    // nearly as dark as a mirror would.
    float wetDark = uReflLight > 0.5 ? 0.8 : 0.55;
    vec3 fabric = uCuffCustom > 0.5 ? mix(uColor, uCuffColor, cuffMask) : uColor;
    vec3 base = fabric * mix(1.0, wetDark, m) * mix(1.0, uCuffCustom > 0.5 ? 0.95 : 0.82, cuffMask); // wet cloth reads darker
    // MÖRKHET: darker lighting overall, for really dark fabric.
    float light = mix(1.0, 0.18, clamp(uDark, 0.0, 1.0));
    vec3 ambient = (mix(uHorizon, uSky, 0.5 + 0.5 * N.y) * 0.6 + 0.1) * light;
    float sunUp = clamp(L.y + 0.15, 0.0, 1.0);
    float diff = (0.35 + 0.65 * max(dot(N, L), 0.0)) * sunUp;
    vec3 col = base * (ambient * ao + uSunCol * diff * ao * 0.7 * light) * mix(1.0, wetDark, m);

    vec3 F0 = mix(vec3(0.04), max(fabric, vec3(0.15)), m * 0.75);
    float ndv = clamp(dot(N, V), 0.0, 1.0);
    vec3 fres = F0 + (1.0 - F0) * pow(1.0 - ndv, 5.0);
    // The hood's folds mostly face the camera, so a plain mirror reflects
    // the dark water below and the sheen reads as black. REFLEKTERAR LJUS
    // reflects a soft, bright mix of sky and light instead (a wet fabric's
    // film of water scatters light, it's not a mirror), plus a broad, soft
    // glint around the sun.
    vec3 envR = env(R);
    if (uReflLight > 0.5) {
      vec3 skyLit = mix(uHorizon, uSky, 0.35 + 0.35 * clamp(R.y + 0.5, 0.0, 1.0)) * 0.95
        + uSunCol * 0.18 * sunUp + 0.06;
      envR = mix(envR, skyLit, 0.75);
    }
    col += envR * fres * (0.25 + 1.1 * m) * mix(0.5, 1.0, ao) * mix(1.0, 0.45, uDark);
    float shin = mix(10.0, 140.0, m);
    float spec = pow(max(dot(R, L), 0.0), shin) * (0.15 + 2.2 * m) * sunUp;
    col += uSunCol * spec * mix(0.6, 1.0, ao);
    if (uReflLight > 0.5) {
      float broad = pow(max(dot(R, L), 0.0), mix(4.0, 18.0, m));
      col += uSunCol * broad * 0.35 * m * sunUp * mix(0.5, 1.0, ao) * mix(1.0, 0.5, uDark);
    }
    // A soft broad sheen along the gathers' crests, the wet-fabric look.
    col += (uReflLight > 0.5 ? mix(uHorizon, uSky, 0.6) * 0.9 + 0.05 : env(N)) * m * 0.18 * smoothstep(0.55, 1.0, ndv) * ao * light;
    col *= hemLight + 0.35;
    if (uCuffTop > 0.5 && cuffMask > 0.0 && !(uCuffCustom > 0.5 && uCuffMat > 0.5)) {
      // Knit ribs: dark grooves between lit crests, a fold line where the
      // band starts and a stitched seam where it ends, so it reads clearly
      // as a separate cuff from inside.
      float shade = mix(0.7, 1.25, smoothstep(0.15, 0.85, cuffRib));
      shade *= mix(0.8, 1.0, smoothstep(0.0, 0.12, cuffX));
      shade *= mix(0.55, 1.0, smoothstep(0.86, 0.97, 1.0 - cuffX));
      col = mix(col, col * shade, cuffMask);
    }

    // BLIXTLÅS: a zipper down the middle of the mouth/neck cover, with the
    // slider and its pull tab at the top.
    if (uLower > 0.5 && uZipper > 0.5) {
      vec2 zc = vec2(uSway.x, 0.04 + uSway.y);
      float edgeY = neckEdgeY();
      // BLIXTLÅS FÄST I TYGET: lay the teeth out in the cloth's own frame
      // (it sways with the hood) instead of the screen's.
      float zy = uZipFixed > 0.5 ? p.y - uSway.y : p.y;
      float zx = p.x - zc.x - 0.005 * sin(zy * 5.0 + uTime * 0.8) * uMotion;
      // The zipper runs right up to the cover's edge (pulled up in the
      // middle with KRAGE UPPÅT); the fabric's own edge clips the tape.
      float edgeTop = edgeY + (uCollarUp > 0.5 ? COLLAR_UP : 0.0);
      float top = edgeTop + 0.03;
      float aa = max(fwidth(p.x), 1e-4);
      // DRA NER BLIXTLÅS: the slider slides down and the cover opens in a V
      // above it, showing the float suit underneath.
      float zo = clamp(uZipOpen, 0.0, 1.0);
      float sliderTop = edgeTop - zo * (edgeTop + 1.6);
      float closedTop = zo > 0.0 ? sliderTop : top;
      float vw = 0.0;
      if (zo > 0.0 && p.y > sliderTop) {
        vw = (0.03 + 0.32 * zo) * clamp((p.y - sliderTop) / max(edgeTop - sliderTop, 1e-3), 0.0, 1.0);
        float vMask = 1.0 - smoothstep(vw - aa, vw + aa, abs(zx));
        col = mix(col, suitShade(p, 0.55 + 0.2 * smoothstep(0.0, vw + 0.01, abs(zx))), vMask);
        // The two opened halves: tape and a row of teeth along each edge.
        float edgeD = abs(abs(zx) - (vw + 0.018));
        float tapeO = 1.0 - smoothstep(0.022 - aa, 0.022, edgeD);
        col = mix(col, col * 0.55, tapeO * (1.0 - vMask));
        float fyO = fract(zy / 0.036);
        float toothO = (1.0 - smoothstep(0.011 - aa, 0.011, abs(abs(zx) - (vw + 0.012)))) *
          smoothstep(0.15, 0.25, fyO) * (1.0 - smoothstep(0.75, 0.85, fyO)) * step(p.y, top);
        col = mix(col, metalShade(normalize(vec3(0.0, (fyO - 0.5) * 1.2, 1.0)), V, L) * 0.9, toothO);
      }
      if (p.y < closedTop + 0.01) {
        float below = 1.0 - smoothstep(closedTop - aa, closedTop, p.y);
        // Tape: a darker strip of fabric the teeth sit on.
        float tape = (1.0 - smoothstep(0.045 - aa, 0.045, abs(zx))) * below;
        col = mix(col, col * 0.55, tape);
        // Teeth, alternating from each side and interlocking at the middle.
        float period = 0.036;
        float k = zy / period;
        float side = mod(floor(k), 2.0) * 2.0 - 1.0;
        float fy = fract(k);
        float tooth = (1.0 - smoothstep(0.026 - aa, 0.026, abs(zx))) *
          smoothstep(0.1, 0.1 + aa / period, fy) * (1.0 - smoothstep(0.9 - aa / period, 0.9, fy)) *
          step(-0.009, zx * side) * below;
        vec3 nT = normalize(vec3(zx * 12.0, (fy - 0.5) * 1.2, 1.0));
        col = mix(col, metalShade(nT, V, L) * 0.9, tooth);
      }
      // Slider body just under the cover's top edge, and the pull hanging off
      // it. DRAGARE PÅ UTSIDAN: the pull is on the outside of the cloth, so
      // from inside only the slider's plain back plate shows.
      vec2 sp = vec2(zx, p.y - (sliderTop - 0.05));
      vec2 sd = abs(sp) - (uZipPullOut > 0.5 ? vec2(0.03, 0.042) : vec2(0.036, 0.05));
      float slider = 1.0 - smoothstep(-aa, aa, length(max(sd, 0.0)) + min(max(sd.x, sd.y), 0.0) - 0.006);
      float swing = uSway.x * 2.0 + 0.06 * sin(uTime * 1.4) * uMotion;
      vec2 pp = vec2(zx + (p.y - (sliderTop - 0.1)) * swing, p.y - (sliderTop - 0.19));
      vec2 pd = abs(pp) - vec2(0.018, 0.075);
      float pull = 1.0 - smoothstep(-aa, aa, length(max(pd, 0.0)) + min(max(pd.x, pd.y), 0.0) - 0.008);
      float hole = 1.0 - smoothstep(-aa, aa, length(pp + vec2(0.0, 0.045)) - 0.009);
      pull *= 1.0 - hole;
      vec3 nS = normalize(vec3(sp.x * 10.0, sp.y * 4.0, 1.0));
      vec3 nP = normalize(vec3(pp.x * 25.0, 0.2, 1.0));
      if (uZipPullOut > 0.5) {
        vec3 nB = normalize(vec3(sp.x * 4.0, sp.y * 2.0, 1.0));
        col = mix(col, metalShade(nB, V, L) * 0.8, slider);
      } else {
        col = mix(col, metalShade(nS, V, L), slider);
        col = mix(col, metalShade(nP, V, L) * 0.95, pull);
      }
    }

    if (uWaterIn > 0.5) {
      // Fabric under the water inside the hood: tinted, dimmer, with a soft
      // caustic shimmer, and a bright meniscus along the waterline.
      float depth = max(-wl, 0.0);
      // VATTENFÄRG: neutral grey water by default; the slider brings back
      // the ocean's blue.
      vec3 blue = mix(uWater * 1.6 + 0.05, mix(uHorizon, uSky, 0.5) * 0.45, 0.35);
      vec3 tint = mix(vec3(dot(blue, vec3(0.333))), blue, clamp(uWaterTint, 0.0, 1.0));
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
    outCol = mix(outCol, drip.rgb, drip.a * (1.0 - inside * 0.4));
    alpha = max(alpha, drip.a);
    gl_FragColor = vec4(outCol, alpha);
  }
`;

/** How much air each STIL traps in the water (FLYTANDE lift and puff, and buoyancy). */
/** LÄNGD where the float suit's leg line sits; longer layers wrap around you in water. */
export const FLOAT_SUIT_LENGTH = 0.55;

export const HOOD_STYLE_AIR: Record<HoodConfig["style"], number> = {
  classic: 0.35,
  shell: 0.5,
  quilted: 0.65,
  puffy: 0.8,
  down: 1,
};

export class Hood {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private readonly geometry: THREE.PlaneGeometry;
  private readonly uniforms: {
    uAspect: { value: number };
    uTanHalfFov: { value: number };
    uTime: { value: number };
    uSway: { value: THREE.Vector2 };
    uHang: { value: number };
    uViewShadow: { value: number };
    uHangHeavy: { value: number };
    uTwist: { value: number };
    uMotion: { value: number };
    uHeight: { value: number };
    uOpening: { value: number };
    uOpenWidth: { value: number };
    uLower: { value: number };
    uTopOff: { value: number };
    uZipOpen: { value: number };
    uFloatAmt: { value: number };
    uFloatLift: { value: number };
    uFloatInflate: { value: number };
    uFloatLine: { value: number };
    uRotateHead: { value: number };
    uHemY: { value: number };
    uSep: { value: number };
    uWaterTint: { value: number };
    uDrip: { value: number };
    uDropsOnly: { value: number };
    uHoodBack: { value: number };
    uNeckBack: { value: number };
    uWrap: { value: number };
    uWrapRise: { value: number };
    uWrapSpeed: { value: number };
    uPuff3d: { value: number };
    uSuitColor: { value: THREE.Color };
    uCollarUp: { value: number };
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
    uPuffThick: { value: number };
    uInflate: { value: number };
    uReflLight: { value: number };
    uCuff: { value: number };
    uCuffHeight: { value: number };
    uCuffSize: { value: number };
    uCuffTop: { value: number };
    uCuffCustom: { value: number };
    uCuffColor: { value: THREE.Color };
    uCuffMetal: { value: number };
    uCuffMat: { value: number };
    uZipFixed: { value: number };
    uZipPullOut: { value: number };
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
  // HÄNGER FRÅN TOPPEN: the bottom's twist (radians) and its speed.
  private twist = 0;
  private twistVel = 0;
  private readonly lastQuat = new THREE.Quaternion();
  private readonly lastPos = new THREE.Vector3();
  private hasLast = false;
  // VATTENLUGN: the water inside the hood's own (smoothed) level and its speed.
  private waterLevel = 0;
  private waterVel = 0;
  private hasWater = false;
  private colorHex = "";
  private cuffColorHex = "";
  /** 0..1: how soaked (and so how swollen) the padding is right now. */
  private soak = 0;
  /** 0..1: how wet the cloth is (slowly dries), for DROPPAR. */
  private wet = 0;
  private suitColorHex = "";
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
      uHang: { value: 1 },
      uViewShadow: { value: 0 },
      uHangHeavy: { value: 0.4 },
      uTwist: { value: 0 },
      uMotion: { value: 0.5 },
      uHeight: { value: 0.3 },
      uOpening: { value: 0.5 },
      uOpenWidth: { value: 0 },
      uLower: { value: 0 },
      uTopOff: { value: 0 },
      uZipOpen: { value: 0 },
      uFloatAmt: { value: 0 },
      uFloatLift: { value: 0 },
      uFloatInflate: { value: 0 },
      uFloatLine: { value: -0.4 },
      uRotateHead: { value: 0 },
      uHemY: { value: -1000 },
      uSep: { value: 0 },
      uWaterTint: { value: 0 },
      uDrip: { value: 0 },
      uDropsOnly: { value: 0 },
      uHoodBack: { value: 0 },
      uNeckBack: { value: 0 },
      uWrap: { value: 0 },
      uWrapRise: { value: 0.5 },
      uWrapSpeed: { value: 0.8 },
      uPuff3d: { value: 0 },
      uSuitColor: { value: new THREE.Color(0xe0602a) },
      uCollarUp: { value: 0 },
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
      uPuffThick: { value: 0.5 },
      uInflate: { value: 0 },
      uReflLight: { value: 1 },
      uCuff: { value: 0 },
      uCuffHeight: { value: 0.3 },
      uCuffSize: { value: 0.5 },
      uCuffTop: { value: 1 },
      uCuffCustom: { value: 0 },
      uCuffColor: { value: new THREE.Color() },
      uCuffMetal: { value: 0.15 },
      uCuffMat: { value: 0 },
      uZipFixed: { value: 1 },
      uZipPullOut: { value: 1 },
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

  /** A numeric uniform's current value (the 3D cloth shares this layer's water and float state). */
  uniformValue(name: string): number {
    const v = (this.uniforms as Record<string, { value: unknown }>)[name]?.value;
    return typeof v === "number" ? v : 0;
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
    u.uSep.value = cfg.separate ? 1 : 0;
    u.uTopOff.value = cfg.hoodTop === false ? 1 : 0;
    u.uCollarUp.value = cfg.collarUp ? 1 : 0;
    u.uZipOpen.value = THREE.MathUtils.clamp(cfg.zipperOpen ?? 0, 0, 1);
    u.uRotateHead.value = THREE.MathUtils.clamp(cfg.rotateHead ?? 0, 0, 1.3);
    u.uFloatLine.value = THREE.MathUtils.lerp(
      -1.0,
      0.6,
      THREE.MathUtils.clamp(cfg.floatThreshold ?? 0.35, 0, 1),
    );
    if (cfg.suitColor && cfg.suitColor !== this.suitColorHex) {
      this.suitColorHex = cfg.suitColor;
      const hex = parseInt(cfg.suitColor.replace("#", ""), 16);
      u.uSuitColor.value.setHex(Number.isFinite(hex) ? hex : 0xe0602a, THREE.LinearSRGBColorSpace);
    }
    u.uZipper.value = cfg.zipper ? 1 : 0;
    u.uWaterIn.value = cfg.waterInside ? 1 : 0;
    u.uDrop.value = THREE.MathUtils.clamp(cfg.drop, 0, 1);
    u.uWrinkle.value = THREE.MathUtils.clamp(cfg.wrinkles, 0, 1);
    u.uDark.value = THREE.MathUtils.clamp(cfg.darkness, 0, 1);
    u.uRound.value = THREE.MathUtils.clamp(cfg.roundness, 0, 1);
    u.uStyle.value =
      cfg.style === "puffy"
        ? 1
        : cfg.style === "quilted"
          ? 2
          : cfg.style === "shell"
            ? 3
            : cfg.style === "down"
              ? 4
              : 0;
    u.uPuffSize.value = THREE.MathUtils.clamp(cfg.puffSize, 0, 1);
    u.uPuffHeight.value = THREE.MathUtils.clamp(cfg.puffHeight, 0, 2.5);
    u.uPuff3d.value = cfg.puff3d ? 1 : 0;
    u.uWaterTint.value = THREE.MathUtils.clamp(cfg.waterTint ?? 0, 0, 1);
    u.uHoodBack.value = THREE.MathUtils.clamp(cfg.pullBack ?? 0, 0, 1);
    u.uNeckBack.value = THREE.MathUtils.clamp(cfg.neckBack ?? 0, 0, 1);
    u.uPuffThick.value = THREE.MathUtils.clamp(cfg.puffThickness ?? 0.5, 0, 1);
    u.uReflLight.value = cfg.reflectLight === false ? 0 : 1;
    // UPPBLÅSNING I VATTEN: the hood hangs down around the neck, so it is in
    // the water while swimming with the head up and fully once the head goes
    // under. The puffs swell in a second or two and slowly sag back after.
    {
      const eye = Number.isFinite(cfg.eyeAboveWater) ? cfg.eyeAboveWater : 1;
      const target = 1 - THREE.MathUtils.smoothstep(eye, -0.05, 0.45);
      const k = target > this.soak ? 1.2 : 0.25;
      this.soak += (target - this.soak) * (1 - Math.exp(-k * Math.min(Math.max(dt, 0), 0.1)));
      u.uInflate.value = THREE.MathUtils.clamp(cfg.puffInflate ?? 0, 0, 1) * this.soak;
      // FLYTANDE: only while the cloth is in the water. Padded styles trap
      // more air (they puff up and lift); heavy cloth sinks and drags.
      const fl = THREE.MathUtils.clamp(cfg.floating ?? 0, 0, 1) * this.soak;
      const air = HOOD_STYLE_AIR[cfg.style] ?? 0.35;
      const w = THREE.MathUtils.clamp(cfg.weight, 0, 1);
      u.uFloatAmt.value = fl;
      u.uFloatLift.value = air * 0.08 - w * 0.07;
      u.uFloatInflate.value = fl * air * (1 - w * 0.6);
      // DROPPAR: wet cloth keeps dripping for a good while after the head
      // leaves the water (it dries far slower than the puffs sag).
      this.wet +=
        (target - this.wet) *
        (1 - Math.exp(-(target > this.wet ? 1.5 : 0.07) * Math.min(Math.max(dt, 0), 0.1)));
      u.uDrip.value = THREE.MathUtils.clamp(cfg.dripping ?? 0, 0, 1) * this.wet;
      // LÄNGD: the hem in the body's frame (0 = a short collar just under
      // the view .. 1 = ankle-long, straight down), and how much of it
      // reaches past the float suit to wrap around you in the water.
      const len = THREE.MathUtils.clamp(cfg.length ?? 1, 0, 1);
      if (cfg.lengthOn) {
        const eH = THREE.MathUtils.lerp(-0.25, -1.45, len);
        u.uHemY.value = Math.tan(eH) / u.uTanHalfFov.value;
        const past = THREE.MathUtils.smoothstep(len, FLOAT_SUIT_LENGTH, FLOAT_SUIT_LENGTH + 0.3);
        u.uWrap.value = past * this.soak;
        u.uWrapRise.value = THREE.MathUtils.clamp(0.45 + air * 0.6 - w * 0.5, 0.05, 1.2);
        u.uWrapSpeed.value = 0.25 + 0.9 * (1 - w * 0.7);
      } else {
        u.uHemY.value = -1000;
        u.uWrap.value = 0;
      }
    }
    u.uCuff.value = cfg.cuff ? 1 : 0;
    u.uCuffHeight.value = THREE.MathUtils.clamp(cfg.cuffHeight, 0, 1);
    u.uCuffSize.value = THREE.MathUtils.clamp(cfg.cuffSize, 0, 1);
    u.uCuffTop.value = cfg.cuffTop === false ? 0 : 1;
    u.uCuffCustom.value = cfg.cuffCustom ? 1 : 0;
    u.uCuffMetal.value = THREE.MathUtils.clamp(cfg.cuffMetallic ?? 0.15, 0, 1);
    u.uCuffMat.value = cfg.cuffMaterial === "smooth" ? 1 : cfg.cuffMaterial === "rubber" ? 2 : 0;
    if (cfg.cuffColor && cfg.cuffColor !== this.cuffColorHex) {
      this.cuffColorHex = cfg.cuffColor;
      const hex = parseInt(cfg.cuffColor.replace("#", ""), 16);
      u.uCuffColor.value.setHex(Number.isFinite(hex) ? hex : 0x1f2a40, THREE.LinearSRGBColorSpace);
    }
    u.uZipFixed.value = cfg.zipperFixed === false ? 0 : 1;
    u.uZipPullOut.value = cfg.zipperPullOut === false ? 0 : 1;
    u.uWaterLevelIn.value = THREE.MathUtils.clamp(cfg.waterInsideLevel, 0, 1);
    u.uDropsOnly.value = cfg.dropsOnly ? 1 : 0;
    // VATTENLUGN: the water inside lags the sea outside like water with some
    // mass: a critically damped spring with a capped speed, so fast waves
    // give a calm slosh instead of a waterline that flashes up and down.
    {
      const eye = Number.isFinite(cfg.eyeAboveWater) ? cfg.eyeAboveWater : 1;
      const calm = THREE.MathUtils.clamp(cfg.waterCalm ?? 0.6, 0, 1);
      const st = Math.min(Math.max(dt, 0), 0.1);
      if (!this.hasWater || calm <= 0) {
        this.waterLevel = eye;
        this.waterVel = 0;
        this.hasWater = true;
      } else if (st > 0) {
        const tau = THREE.MathUtils.lerp(0.08, 1.4, calm);
        const w = 2 / tau;
        const maxRate = THREE.MathUtils.lerp(3, 0.25, calm);
        // Sub-steps keep the spring stable at low frame rates.
        const n = Math.max(1, Math.ceil(st / (tau * 0.25)));
        const h = st / n;
        for (let i = 0; i < n; i++) {
          this.waterVel += (w * w * (eye - this.waterLevel) - 2 * w * this.waterVel) * h;
          this.waterVel = THREE.MathUtils.clamp(this.waterVel, -maxRate, maxRate);
          this.waterLevel += this.waterVel * h;
        }
      }
      u.uEyeAbove.value = this.waterLevel;
    }
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

      // HÄNGER FRÅN TOPPEN: the bottom twists after turns and sideways
      // moves on a looser, less damped spring than the sway, so it lags,
      // overshoots and swings back like wet cloth. In the water it also
      // drifts slowly back and forth.
      const tk = THREE.MathUtils.lerp(20, 6, weight);
      const td = THREE.MathUtils.lerp(4, 1.6, weight);
      const drift = (Math.sin(time * 0.45) * 0.05 + Math.sin(time * 0.83 + 1.1) * 0.03) * this.soak;
      const twistTarget = (pushX * 1.5 + drift) * motion;
      this.twistVel += ((twistTarget - this.twist) * tk - this.twistVel * td) * step;
      this.twist = THREE.MathUtils.clamp(this.twist + this.twistVel * step, -0.2, 0.2);
    }
    u.uSway.value.copy(this.sway);
    u.uHang.value = cfg.hanging === false ? 0 : 1;
    u.uViewShadow.value = cfg.viewShadow ? 1 : 0;
    u.uHangHeavy.value = weight;
    u.uTwist.value = cfg.hanging === false ? 0 : this.twist;
  }

  hide(): void {
    this.mesh.visible = false;
    this.hasLast = false;
    this.hasWater = false;
    this.sway.set(0, 0);
    this.swayVel.set(0, 0);
    this.twist = 0;
    this.twistVel = 0;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
