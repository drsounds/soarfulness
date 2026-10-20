/*
 * RAYTRACED water material — a port of Evan Wallace's "WebGL Water"
 * (http://madebyevan.com/webgl-water/, https://github.com/evanw/webgl-water,
 * forked at https://github.com/drsounds/webgl-water).
 *
 *   Copyright 2011 Evan Wallace
 *   Released under the MIT license
 *
 * The original renders a 2×2 tiled pool with a sphere in it. Here the same
 * techniques are adapted to this app's open, camera-following ocean, and
 * layered on top of whichever analytic waveform (REGELBUNDEN, FFT-HAV,
 * DÖENDE VÅG, STÅENDE, SKVALPANDE, vortex…) is driving the mesh — the
 * caustics pass re-evaluates the ocean's own oceanOffset() GLSL so it always
 * focuses light through the exact surface that is on screen:
 *
 *  - Raytraced reflections and refractions: per-pixel reflect()/refract()
 *    rays traced analytically against the sky (with the sun disc) and the
 *    seafloor plane, Fresnel-mixed as in renderer.js — including the
 *    underwater view with Snell's window and total internal reflection.
 *    The pool's walls were the only thing behind Evan's water; here the
 *    refracted rays also look up whatever the scene has already drawn
 *    behind the surface (backdrop, models, cloud floor, sky) in a copy of
 *    the frame taken just before the ocean draws — see captureBackground().
 *  - Analytic ambient occlusion: Evan's closed-form sphere-occlusion term
 *    (the swimmer, a sphere at the camera) plus a heightfield-curvature term
 *    that darkens wave troughs, standing in for the pool-wall term.
 *  - Heightfield water simulation: water.js's ping-pong float-texture wave
 *    equation (drops, moving-sphere displacement, normals), run in a window
 *    that scrolls with the camera and added on top of the analytic waves.
 *  - Soft shadows: Evan's penumbra-widening blob shadow of the sphere along
 *    the refracted sun ray, baked into the caustics texture.
 *  - Caustics: the triangle-area-ratio caustics pass (oldArea / newArea via
 *    screen-space derivatives), projected onto the seafloor and sampled by
 *    both the floor shader and the water's refracted rays.
 */
import * as THREE from "three";

// Heightfield sim window: RT_SIM_RES² texels covering RT_SIM_SIZE metres,
// re-centred on the camera (in whole texels, so nothing smears).
export const RT_SIM_RES = 256;
export const RT_SIM_SIZE = 32;
// Caustics texture window on the seafloor, and the surface grid that is
// refracted onto it (oversized so its projection covers the whole texture).
export const RT_CAUSTIC_RES = 512;
export const RT_CAUSTIC_SIZE = 48;
const RT_CAUSTIC_GRID = 200;
const RT_CAUSTIC_GRID_OVERSCAN = 1.35;
// The sim runs on a fixed timestep so ripple speed doesn't depend on fps.
const RT_SIM_HZ = 60;
const RT_SIM_MAX_STEPS = 4;
// water.js couples each texel to its neighbour average with a factor of 2.0
// at 2 steps/frame over a 2-unit pool; on this much larger window that
// would race ripples across at ~10 m/s, so the coupling is lowered to give
// a ~1.5 m/s ripple speed (c = sqrt(k)/2 texels per step).
const RT_SIM_COUPLING = 0.2;
const RT_SIM_DAMPING = 0.995;
// The swimmer (a sphere riding along with the camera) that casts the soft
// shadow, occludes nearby water/sand, and pushes a wake through the sim.
const RT_SWIMMER_RADIUS = 0.35;
// Ambient forcing: a steady patter of small random drops keeps a fine
// wind-ripple chop on the sim, which is what focuses sunlight into the
// familiar caustic network (long swells alone barely focus at a few metres).
const RT_AMBIENT_DROP_INTERVAL = 0.02;
const RT_AMBIENT_DROP_STRENGTH = 0.012;

/** Uniform objects shared (by reference) between every material that reads
 *  the raytraced-water state — spread them into each material's uniforms. */
export type RaytracedWaterUniforms = {
  uRtMix: THREE.IUniform<number>;
  uRtSim: THREE.IUniform<THREE.Texture | null>;
  uRtSimCenter: THREE.IUniform<THREE.Vector2>;
  uRtSimSize: THREE.IUniform<number>;
  uRtSimOn: THREE.IUniform<number>;
  uRtCaustic: THREE.IUniform<THREE.Texture | null>;
  uRtCausticCenter: THREE.IUniform<THREE.Vector2>;
  uRtCausticSize: THREE.IUniform<number>;
  uRtCausticOn: THREE.IUniform<number>;
  uRtSwimmer: THREE.IUniform<THREE.Vector4>;
  uRtLevel: THREE.IUniform<number>;
  uRtFloorOn: THREE.IUniform<number>;
  uRtFloorTextured: THREE.IUniform<number>;
  uRtSandTex: THREE.IUniform<THREE.Texture | null>;
  uRtScene: THREE.IUniform<THREE.Texture | null>;
  uRtSceneOn: THREE.IUniform<number>;
  uRtProjection: THREE.IUniform<THREE.Matrix4>;
};

/** Heightfield sample: vec4(height, velocity, dh/dx, dh/dz) in world metres,
 *  faded to 0 at the edges of the scrolling sim window. */
export const RT_SIM_GLSL = /* glsl */ `
  uniform sampler2D uRtSim;
  uniform vec2 uRtSimCenter;
  uniform float uRtSimSize;
  uniform float uRtSimOn;
  vec4 rtSim(vec2 xz) {
    if (uRtSimOn < 0.5) return vec4(0.0);
    vec2 uv = (xz - uRtSimCenter) / uRtSimSize + 0.5;
    vec2 e = min(uv, 1.0 - uv);
    float inside = smoothstep(0.0, 0.1, min(e.x, e.y));
    if (inside <= 0.0) return vec4(0.0);
    return texture2D(uRtSim, uv) * inside;
  }
`;

/** Seafloor lighting shared by the floor shader and the water's refracted
 *  rays, so what you see through the surface matches the sand itself. */
export const RT_FLOOR_GLSL = /* glsl */ `
  uniform float uRtMix;
  uniform sampler2D uRtCaustic;
  uniform vec2 uRtCausticCenter;
  uniform float uRtCausticSize;
  uniform float uRtCausticOn;
  uniform vec4 uRtSwimmer;

  // Caustic light reaching the floor at xz (1.0 = undisturbed flat water);
  // fades back to 1.0 towards the edges of the caustics window.
  float rtCaustic(vec2 xz) {
    if (uRtCausticOn < 0.5) return 1.0;
    vec2 uv = (xz - uRtCausticCenter) / uRtCausticSize + 0.5;
    vec2 e = min(uv, 1.0 - uv);
    float inside = smoothstep(0.0, 0.12, min(e.x, e.y));
    if (inside <= 0.0) return 1.0;
    return mix(1.0, texture2D(uRtCaustic, uv).r, inside);
  }

  // Analytic ambient occlusion from the swimmer sphere — renderer.js's
  // "sphere ambient occlusion" term, 1 - 0.9 / (d / r)^4.
  float rtSphereAO(vec3 p) {
    if (uRtSwimmer.w <= 0.0) return 1.0;
    float d = max(length(p - uRtSwimmer.xyz) / uRtSwimmer.w, 1.0);
    return 1.0 - 0.9 / pow(d, 4.0);
  }

  // Light multiplier for the seafloor: caustics (with the swimmer's soft
  // shadow baked in) under the refracted sun, times ambient occlusion.
  // Averages ~1.0 in daylight so it re-lights rather than darkens the sand.
  vec3 rtFloorLight(vec3 p, vec3 sunDir, vec3 sunColor) {
    vec3 L = normalize(sunDir);
    vec3 refractedLight = -refract(-L, vec3(0.0, 1.0, 0.0), 1.0 / 1.333);
    float sunVis = clamp(L.y * 4.0 + 0.4, 0.0, 1.0);
    float diffuse = max(0.0, refractedLight.y) * sunVis;
    float c = min(rtCaustic(p.xz), 12.0);
    float light = 0.5 + 0.5 * mix(1.0, c, diffuse);
    vec3 glow = sunColor * max(c - 1.0, 0.0) * 0.18 * diffuse;
    return (vec3(light) + glow) * rtSphereAO(p);
  }
`;

/**
 * Raytraced surface shading for the ocean fragment shader. Expects the host
 * shader to already declare uSunDir, uSunColor, uSkyColor, uHorizonColor,
 * uReflTex, uReflMix, uFloorColor, uFloorDepth, uTurbidity and uOpacity,
 * and to include RT_SIM_GLSL + RT_FLOOR_GLSL before it.
 */
export const RT_WATER_GLSL = /* glsl */ `
  uniform float uRtLevel;
  uniform float uRtFloorOn;
  uniform float uRtFloorTextured;
  uniform sampler2D uRtSandTex;
  // Copy of the frame drawn so far (everything behind the water), and the
  // camera projection to find where a ray's point lands on it.
  uniform sampler2D uRtScene;
  uniform float uRtSceneOn;
  uniform mat4 uRtProjection;

  const float RT_IOR_AIR = 1.0;
  const float RT_IOR_WATER = 1.333;

  // Per-pixel normal: the analytic wave normal plus the heightfield sim's
  // gradient, nudged along the gradient a few times to make the ripples look
  // more "peaked" (the coord += info.ba loop in renderer.js).
  vec3 rtSurfaceNormal(vec3 Nv, vec2 xz) {
    vec4 info = rtSim(xz);
    for (int i = 0; i < 5; i++) {
      xz -= info.ba * 0.03;
      info = rtSim(xz);
    }
    vec2 slope = Nv.xz / max(Nv.y, 0.05) - info.ba;
    return normalize(vec3(slope.x, 1.0, slope.y));
  }

  // Sky along a ray: the scene's gradient (or the selected photo surface),
  // plus a sharp sun disc — the pow(dot(light, ray), 5000) term from
  // getSurfaceRayColor(), toned down to this scene's sun colour.
  vec3 rtSky(vec3 ray) {
    float up = clamp(ray.y, 0.0, 1.0);
    vec3 col = mix(uHorizonColor, uSkyColor, pow(up, 0.65));
    if (uReflMix > 0.001) {
      vec2 reflUv = vec2(atan(ray.z, ray.x) * 0.15915494 + 0.5, clamp(1.0 - up, 0.0, 1.0));
      vec3 photo = texture2D(uReflTex, reflUv).rgb;
      float daylight = clamp(uSunDir.y + 0.35, 0.12, 1.15);
      col = mix(col, mix(col, photo * daylight, 0.75), uReflMix);
    }
    vec3 L = normalize(uSunDir);
    float sunVis = clamp(L.y * 6.0 + 0.3, 0.0, 1.0);
    col += uSunColor * (pow(max(0.0, dot(L, ray)), 5000.0) * 8.0
                        + pow(max(0.0, dot(L, ray)), 300.0) * 0.35) * sunVis;
    return col;
  }

  // Screen-space lookup of what the scene drew dist metres along a ray:
  // rgb = colour, a = confidence (0 off-screen / behind the camera, fading
  // in from the screen edge so the analytic fallback takes over smoothly).
  vec4 rtSceneAlong(vec3 origin, vec3 ray, float dist) {
    if (uRtSceneOn < 0.5) return vec4(0.0);
    vec4 clip = uRtProjection * viewMatrix * vec4(origin + ray * dist, 1.0);
    if (clip.w <= 0.0) return vec4(0.0);
    vec2 uv = clip.xy / clip.w * 0.5 + 0.5;
    vec2 e = min(uv, 1.0 - uv);
    float w = smoothstep(0.0, 0.04, min(e.x, e.y));
    if (w <= 0.0) return vec4(0.0);
    return vec4(texture2D(uRtScene, uv).rgb, w);
  }

  vec3 rtFloorAlbedo(vec2 xz) {
    vec3 base = uFloorColor;
    if (uRtFloorTextured > 0.001) {
      // Same sand recipe as the seafloor shader's uTextured branch.
      vec2 uv0 = xz * 0.35;
      vec3 s1 = texture2D(uRtSandTex, uv0).rgb;
      mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
      vec3 s2 = texture2D(uRtSandTex, rot * uv0 * 0.25 + 0.13).rgb;
      vec3 sand = (s1 + s2) * 0.5;
      sand = (sand - 0.5) * 1.15 + 0.55;
      sand = clamp(sand * uFloorColor * 1.9, 0.0, 1.6);
      base = mix(uFloorColor, sand, clamp(uRtFloorTextured, 0.0, 1.0));
    }
    return base;
  }

  // Beer-Lambert absorption over a path of length dist, in-scattering
  // toward the water body's own colour — red dies first, as in real water.
  // The raytraced body is always opaque (the refraction already shows
  // what's behind it), so the OPACITY dial sets the water's clarity instead.
  vec3 rtAbsorb(vec3 col, float dist, vec3 scatter) {
    vec3 sigma = vec3(0.22, 0.065, 0.045) * (1.0 + uTurbidity * 4.0)
               * mix(0.12, 1.6, clamp(uOpacity, 0.0, 1.0));
    vec3 trans = exp(-sigma * dist);
    return col * trans + scatter * (1.0 - trans);
  }

  // Trace a ray travelling through the water body to whatever is behind
  // the surface: the seafloor plane gives the path length (uRtFloorOn 1 =
  // solid floor, 0.5 = cloud floor: plane only, 0 = none: open water), and
  // the colour comes from the frame copy where the ray lands on screen, or
  // from the analytic caustic-lit floor where it doesn't.
  vec3 rtTraceWater(vec3 origin, vec3 ray, vec3 scatter) {
    float t = 30.0;
    vec3 behind = scatter;
    if (uRtFloorOn > 0.25 && ray.y < -0.001) {
      float floorY = uRtLevel - uFloorDepth;
      float tf = (floorY - origin.y) / ray.y;
      if (tf > 0.0) {
        t = tf;
        if (uRtFloorOn > 0.75) {
          vec3 hit = origin + ray * t;
          behind = rtFloorAlbedo(hit.xz) * rtFloorLight(hit, uSunDir, uSunColor);
        }
      }
    }
    vec4 seen = rtSceneAlong(origin, ray, min(t, 80.0));
    behind = mix(behind, seen.rgb, seen.a);
    return rtAbsorb(behind, t, scatter);
  }

  // The raytraced surface colour (renderer.js's waterShaders[0/1]).
  //   Nv        analytic wave normal (world, up-facing)
  //   pos/eye   fragment and camera world positions
  //   above     true when this side of the surface faces the air
  //   scatter   water-body colour that absorbed light fades towards
  //   aoTrough  heightfield-curvature ambient occlusion from the vertex stage
  vec3 rtShadeWater(vec3 Nv, vec3 pos, vec3 eye, bool above, vec3 scatter, float aoTrough) {
    vec3 normal = rtSurfaceNormal(Nv, pos.xz);
    vec3 incomingRay = normalize(pos - eye);
    float ao = aoTrough * rtSphereAO(pos);
    if (above) {
      vec3 reflectedRay = reflect(incomingRay, normal);
      vec3 refractedRay = refract(incomingRay, normal, RT_IOR_AIR / RT_IOR_WATER);
      float fresnel = mix(0.25, 1.0, pow(1.0 - clamp(dot(normal, -incomingRay), 0.0, 1.0), 3.0));
      // A reflected ray that still points down has hit the next wave over.
      vec3 reflectedColor = reflectedRay.y > 0.0
        ? rtSky(reflectedRay)
        : rtTraceWater(pos, refract(reflectedRay, normal, RT_IOR_AIR / RT_IOR_WATER), scatter);
      vec3 refractedColor = rtTraceWater(pos, refractedRay, scatter);
      return mix(refractedColor, reflectedColor * ao, fresnel);
    }
    // Underwater: looking up at the surface from below.
    normal = -normal;
    vec3 reflectedRay = reflect(incomingRay, normal);
    vec3 refractedRay = refract(incomingRay, normal, RT_IOR_WATER / RT_IOR_AIR);
    float fresnel = mix(0.5, 1.0, pow(1.0 - clamp(dot(normal, -incomingRay), 0.0, 1.0), 3.0));
    vec3 reflectedColor = rtTraceWater(pos, reflectedRay, scatter) * ao;
    // refract() returns 0 past the critical angle: total internal reflection
    // everywhere outside Snell's window.
    // Through Snell's window: whatever is above the water (sky, backdrop,
    // models), from the frame copy, else the analytic sky.
    vec4 seenAbove = rtSceneAlong(pos, refractedRay, 200.0);
    vec3 refractedColor = mix(rtSky(refractedRay), seenAbove.rgb, seenAbove.a) * vec3(0.8, 1.0, 1.1);
    vec3 col = mix(reflectedColor, refractedColor, (1.0 - fresnel) * length(refractedRay));
    return rtAbsorb(col, length(pos - eye), scatter);
  }
`;

const FULLSCREEN_VERT = /* glsl */ `
  varying vec2 coord;
  void main() {
    coord = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// water.js updateShader, plus a window-scroll offset and an absorbing border
// so ripples leave the scrolling window instead of bouncing off its edge.
const SIM_UPDATE_FRAG = /* glsl */ `
  uniform sampler2D uTex;
  uniform vec2 uDelta;
  uniform vec2 uShift;
  uniform float uCoupling;
  uniform float uDamping;
  varying vec2 coord;
  vec4 samp(vec2 uv) {
    if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0);
    return texture2D(uTex, uv);
  }
  void main() {
    vec2 c = coord + uShift;
    vec4 info = samp(c);
    vec2 dx = vec2(uDelta.x, 0.0);
    vec2 dy = vec2(0.0, uDelta.y);
    float average = (samp(c - dx).r + samp(c - dy).r + samp(c + dx).r + samp(c + dy).r) * 0.25;
    info.g += (average - info.r) * uCoupling;
    info.g *= uDamping;
    vec2 edge = min(coord, 1.0 - coord);
    float border = smoothstep(0.0, 0.08, min(edge.x, edge.y));
    info.g *= mix(0.85, 1.0, border);
    info.r *= mix(0.97, 1.0, border);
    info.r += info.g;
    gl_FragColor = info;
  }
`;

// water.js normalShader, storing the world-space gradient instead.
const SIM_NORMAL_FRAG = /* glsl */ `
  uniform sampler2D uTex;
  uniform vec2 uDelta;
  uniform float uTexelWorld;
  varying vec2 coord;
  void main() {
    vec4 info = texture2D(uTex, coord);
    float hx = texture2D(uTex, coord + vec2(uDelta.x, 0.0)).r;
    float hz = texture2D(uTex, coord + vec2(0.0, uDelta.y)).r;
    info.ba = vec2(hx - info.r, hz - info.r) / uTexelWorld;
    gl_FragColor = info;
  }
`;

// water.js dropShader (centre/radius in sim-window uv units).
const SIM_DROP_FRAG = /* glsl */ `
  const float PI = 3.141592653589793;
  uniform sampler2D uTex;
  uniform vec2 uCenter;
  uniform float uRadius;
  uniform float uStrength;
  varying vec2 coord;
  void main() {
    vec4 info = texture2D(uTex, coord);
    float drop = max(0.0, 1.0 - length(uCenter - coord) / uRadius);
    drop = 0.5 - cos(drop * PI) * 0.5;
    info.r += drop * uStrength;
    gl_FragColor = info;
  }
`;

// water.js sphereShader: add the volume the swimmer left, remove the volume
// it now occupies, so moving through the water pushes a wake. Centres are
// in metres relative to the sim window's centre and the local water level.
const SIM_SPHERE_FRAG = /* glsl */ `
  uniform sampler2D uTex;
  uniform vec3 uOldCenter;
  uniform vec3 uNewCenter;
  uniform float uRadius;
  uniform float uWindow;
  varying vec2 coord;
  float volumeInSphere(vec3 center) {
    vec3 toCenter = vec3((coord.x - 0.5) * uWindow, 0.0, (coord.y - 0.5) * uWindow) - center;
    float t = length(toCenter) / uRadius;
    float dy = exp(-pow(t * 1.5, 6.0)) * uRadius;
    float ymin = min(0.0, center.y - dy);
    float ymax = min(max(0.0, center.y + dy), ymin + 2.0 * dy);
    return (ymax - ymin) * 0.1;
  }
  void main() {
    vec4 info = texture2D(uTex, coord);
    info.r += volumeInSphere(uOldCenter);
    info.r -= volumeInSphere(uNewCenter);
    gl_FragColor = info;
  }
`;

// renderer.js causticsShader: refract the sun through every vertex of a
// surface grid (the live analytic waves + sim ripples) onto the floor
// plane; each triangle's brightness is how much its area shrank.
const CAUSTICS_VERT = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec2 uCausticCenter;
  uniform float uCausticSize;
  uniform float uGridSize;
  uniform vec2 uGridCenter;
  uniform float uFloorY;
  varying vec3 oldPos;
  varying vec3 newPos;
  varying vec3 refractedLight;

  vec3 project(vec3 origin, vec3 ray) {
    float t = (uFloorY - origin.y) / min(ray.y, -0.05);
    return origin + ray * t;
  }

  void main() {
    vec3 L = normalize(uSunDir);
    refractedLight = refract(-L, vec3(0.0, 1.0, 0.0), 1.0 / 1.333);
    vec3 base = vec3(uGridCenter.x + position.x * uGridSize, uRtLevel, uGridCenter.y + position.y * uGridSize);
    vec3 n;
    float lap;
    vec3 d = oceanOffset(base, n, lap);
    vec4 sim = rtSim(base.xz);
    d.y += sim.r;
    vec2 slope = n.xz / max(n.y, 0.05) - sim.ba;
    vec3 normal = normalize(vec3(slope.x, 1.0, slope.y));
    vec3 ray = refract(-L, normal, 1.0 / 1.333);
    oldPos = project(base, refractedLight);
    newPos = project(base + d, ray);
    gl_Position = vec4((newPos.xz - uCausticCenter) / (0.5 * uCausticSize), 0.0, 1.0);
  }
`;

const CAUSTICS_FRAG = /* glsl */ `
  uniform vec4 uRtSwimmer;
  varying vec3 oldPos;
  varying vec3 newPos;
  varying vec3 refractedLight;
  void main() {
    // If the triangle gets smaller, it gets brighter, and vice versa.
    float oldArea = length(dFdx(oldPos)) * length(dFdy(oldPos));
    float newArea = length(dFdx(newPos)) * length(dFdy(newPos));
    float intensity = min(oldArea / max(newArea, 1e-7), 30.0);

    // Soft blob shadow of the swimmer along the refracted sun ray; the
    // penumbra widens with distance (renderer.js's sphere shadow).
    float shadow = 1.0;
    if (uRtSwimmer.w > 0.0) {
      vec3 dir = (uRtSwimmer.xyz - newPos) / uRtSwimmer.w;
      vec3 area = cross(dir, refractedLight);
      float s = dot(area, area);
      float dist = dot(dir, -refractedLight);
      s = 1.0 + (s - 1.0) / (0.05 + dist * 0.025);
      s = clamp(1.0 / (1.0 + exp(-s)), 0.0, 1.0);
      shadow = mix(1.0, s, clamp(dist * 2.0, 0.0, 1.0));
    }
    gl_FragColor = vec4(intensity * shadow, 0.0, 0.0, 1.0);
  }
`;

export type RaytracedWaterFrame = {
  dt: number;
  /** The scene camera — the caustics pass evaluates the waves with its
   *  position so distance-based wave fades match what's on screen. */
  camera: THREE.Camera;
  sunDir: THREE.Vector3;
  /** World y of the still-water level (the ocean mesh's y). */
  level: number;
  /** Seafloor depth below `level`. */
  depth: number;
  /** World y of the analytic wave surface under the camera. */
  surfaceY: number;
  /** Whether the swimmer sphere (at the camera) is in/at the water. */
  swimmerOn: boolean;
};

export class RaytracedWater {
  readonly uniforms: RaytracedWaterUniforms;
  /** False when the GPU can't render to half-float textures — the material
   *  still raytraces reflections/refractions, just without sim/caustics. */
  readonly supported: boolean;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly quadScene = new THREE.Scene();
  private readonly quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quad: THREE.Mesh;
  private simA: THREE.WebGLRenderTarget | null = null;
  private simB: THREE.WebGLRenderTarget | null = null;
  private readonly updateMat: THREE.ShaderMaterial;
  private readonly normalMat: THREE.ShaderMaterial;
  private readonly dropMat: THREE.ShaderMaterial;
  private readonly sphereMat: THREE.ShaderMaterial;
  private caustic: THREE.WebGLRenderTarget | null = null;
  private causticMat: THREE.ShaderMaterial | null = null;
  private causticGeo: THREE.PlaneGeometry | null = null;
  private readonly causticScene = new THREE.Scene();
  private readonly causticCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  private simCenter: THREE.Vector2 | null = null;
  private accum = 0;
  private dropTimer = 0;
  private oldSwimmer: THREE.Vector3 | null = null;
  private readonly tmpColor = new THREE.Color();
  private readonly tmpSize = new THREE.Vector2();
  // Frame copies for captureBackground(): one per framebuffer pixel type
  // (the canvas is 8-bit; EffectComposer's targets are half-float).
  private bgByte: THREE.FramebufferTexture | null = null;
  private bgHalf: THREE.FramebufferTexture | null = null;
  private captured = false;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    const ext = renderer.extensions;
    this.supported =
      renderer.capabilities.isWebGL2 &&
      (ext.has("EXT_color_buffer_float") || ext.has("EXT_color_buffer_half_float"));

    this.uniforms = {
      uRtMix: { value: 0 },
      uRtSim: { value: null },
      uRtSimCenter: { value: new THREE.Vector2() },
      uRtSimSize: { value: RT_SIM_SIZE },
      uRtSimOn: { value: 0 },
      uRtCaustic: { value: null },
      uRtCausticCenter: { value: new THREE.Vector2() },
      uRtCausticSize: { value: RT_CAUSTIC_SIZE },
      uRtCausticOn: { value: 0 },
      uRtSwimmer: { value: new THREE.Vector4(0, 0, 0, 0) },
      uRtLevel: { value: 0 },
      uRtFloorOn: { value: 0 },
      uRtFloorTextured: { value: 0 },
      uRtSandTex: { value: null },
      uRtScene: { value: null },
      uRtSceneOn: { value: 0 },
      uRtProjection: { value: new THREE.Matrix4() },
    };

    const delta = new THREE.Vector2(1 / RT_SIM_RES, 1 / RT_SIM_RES);
    const simMat = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>) =>
      new THREE.ShaderMaterial({
        uniforms: { uTex: { value: null }, ...uniforms },
        vertexShader: FULLSCREEN_VERT,
        fragmentShader,
        depthTest: false,
        depthWrite: false,
        blending: THREE.NoBlending,
      });
    this.updateMat = simMat(SIM_UPDATE_FRAG, {
      uDelta: { value: delta },
      uShift: { value: new THREE.Vector2() },
      uCoupling: { value: RT_SIM_COUPLING },
      uDamping: { value: RT_SIM_DAMPING },
    });
    this.normalMat = simMat(SIM_NORMAL_FRAG, {
      uDelta: { value: delta },
      uTexelWorld: { value: RT_SIM_SIZE / RT_SIM_RES },
    });
    this.dropMat = simMat(SIM_DROP_FRAG, {
      uCenter: { value: new THREE.Vector2() },
      uRadius: { value: 0.01 },
      uStrength: { value: 0 },
    });
    this.sphereMat = simMat(SIM_SPHERE_FRAG, {
      uOldCenter: { value: new THREE.Vector3() },
      uNewCenter: { value: new THREE.Vector3() },
      uRadius: { value: RT_SWIMMER_RADIUS },
      uWindow: { value: RT_SIM_SIZE },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.updateMat);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);

    if (this.supported) {
      const simTarget = () =>
        new THREE.WebGLRenderTarget(RT_SIM_RES, RT_SIM_RES, {
          type: THREE.HalfFloatType,
          format: THREE.RGBAFormat,
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
          wrapS: THREE.ClampToEdgeWrapping,
          wrapT: THREE.ClampToEdgeWrapping,
          depthBuffer: false,
          stencilBuffer: false,
        });
      this.simA = simTarget();
      this.simB = simTarget();
      this.caustic = new THREE.WebGLRenderTarget(RT_CAUSTIC_RES, RT_CAUSTIC_RES, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
        stencilBuffer: false,
      });
      this.uniforms.uRtSim.value = this.simA.texture;
      this.uniforms.uRtCaustic.value = this.caustic.texture;
    }
  }

  /**
   * Builds the caustics pass from the ocean's own wave GLSL. `waveGlsl` must
   * declare the ocean's wave uniforms and define
   * `vec3 oceanOffset(vec3 worldBase, out vec3 normal, out float laplacian)`
   * (the mesh displacement), and `waveUniforms` must hold those uniforms'
   * live IUniform objects so the pass tracks every wave dial for free.
   */
  initCaustics(waveGlsl: string, waveUniforms: Record<string, THREE.IUniform>) {
    if (!this.supported || this.causticMat) return;
    this.causticGeo = new THREE.PlaneGeometry(1, 1, RT_CAUSTIC_GRID, RT_CAUSTIC_GRID);
    this.causticMat = new THREE.ShaderMaterial({
      uniforms: {
        ...waveUniforms,
        ...this.uniforms,
        uCausticCenter: this.uniforms.uRtCausticCenter,
        uCausticSize: this.uniforms.uRtCausticSize,
        uGridSize: { value: RT_CAUSTIC_SIZE * RT_CAUSTIC_GRID_OVERSCAN },
        uGridCenter: { value: new THREE.Vector2() },
        uFloorY: { value: -14 },
      },
      vertexShader: `${waveGlsl}\n${RT_SIM_GLSL}\nuniform float uRtLevel;\n${CAUSTICS_VERT}`,
      fragmentShader: CAUSTICS_FRAG,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
    });
    const mesh = new THREE.Mesh(this.causticGeo, this.causticMat);
    mesh.frustumCulled = false;
    this.causticScene.add(mesh);
  }

  /** Adds a water.js-style drop at a world position (metres). */
  addDrop(x: number, z: number, radius: number, strength: number) {
    if (!this.simA || !this.simCenter) return;
    const u = this.dropMat.uniforms;
    u.uCenter.value.set(
      (x - this.simCenter.x) / RT_SIM_SIZE + 0.5,
      (z - this.simCenter.y) / RT_SIM_SIZE + 0.5,
    );
    u.uRadius.value = radius / RT_SIM_SIZE;
    u.uStrength.value = strength;
    this.simPass(this.dropMat);
  }

  /** Advances the sim and re-renders the caustics. Call once per frame
   *  while the material is visible (uRtMix > 0). */
  update(f: RaytracedWaterFrame) {
    const u = this.uniforms;
    u.uRtLevel.value = f.level;
    u.uRtProjection.value.copy(f.camera.projectionMatrix);
    this.captured = false;
    const cam = f.camera.position;
    u.uRtSwimmer.value.set(cam.x, cam.y, cam.z, f.swimmerOn ? RT_SWIMMER_RADIUS : 0);
    if (!this.supported || !this.simA) return;

    const r = this.renderer;
    const prevTarget = r.getRenderTarget();
    const prevAutoClear = r.autoClear;
    r.getClearColor(this.tmpColor);
    const prevClearAlpha = r.getClearAlpha();
    r.autoClear = false;
    r.setClearColor(0x000000, 0);

    // simCenter is the world centre the sim texture's content represents;
    // the window only scrolls (by whole texels) inside a sim step, below.
    const texel = RT_SIM_SIZE / RT_SIM_RES;
    const want = new THREE.Vector2(
      Math.round(cam.x / texel) * texel,
      Math.round(cam.z / texel) * texel,
    );
    if (
      !this.simCenter ||
      Math.abs(want.x - this.simCenter.x) > RT_SIM_SIZE / 2 ||
      Math.abs(want.y - this.simCenter.y) > RT_SIM_SIZE / 2
    ) {
      // First frame, or teleported: the old ripples are nowhere near any more.
      this.simCenter = want.clone();
      this.clear(this.simA);
      this.clear(this.simB!);
      this.oldSwimmer = null;
    }
    const center = this.simCenter;

    // The swimmer's wake (positions relative to window centre/water level).
    const swimmer = new THREE.Vector3(cam.x - center.x, cam.y - f.surfaceY, cam.z - center.y);
    if (f.swimmerOn && this.oldSwimmer) {
      const s = this.sphereMat.uniforms;
      s.uOldCenter.value.copy(this.oldSwimmer);
      s.uNewCenter.value.copy(swimmer);
      this.simPass(this.sphereMat);
    }
    this.oldSwimmer = f.swimmerOn ? swimmer : null;

    this.dropTimer += f.dt;
    while (this.dropTimer > RT_AMBIENT_DROP_INTERVAL) {
      this.dropTimer -= RT_AMBIENT_DROP_INTERVAL;
      this.addDrop(
        center.x + (Math.random() - 0.5) * RT_SIM_SIZE * 0.9,
        center.y + (Math.random() - 0.5) * RT_SIM_SIZE * 0.9,
        0.3 + Math.random() * 0.4,
        (Math.random() < 0.5 ? 1 : -1) * RT_AMBIENT_DROP_STRENGTH,
      );
    }

    this.accum = Math.min(this.accum + f.dt, RT_SIM_MAX_STEPS / RT_SIM_HZ);
    const shift = this.updateMat.uniforms.uShift.value as THREE.Vector2;
    while (this.accum >= 1 / RT_SIM_HZ) {
      this.accum -= 1 / RT_SIM_HZ;
      shift.set((want.x - center.x) / RT_SIM_SIZE, (want.y - center.y) / RT_SIM_SIZE);
      this.simPass(this.updateMat);
      if (this.oldSwimmer) {
        this.oldSwimmer.x -= want.x - center.x;
        this.oldSwimmer.z -= want.y - center.y;
      }
      center.copy(want);
    }
    this.simPass(this.normalMat);
    u.uRtSim.value = this.simA.texture;
    u.uRtSimCenter.value.copy(center);
    u.uRtSimOn.value = 1;

    this.renderCaustics(f);

    r.setRenderTarget(prevTarget);
    r.setClearColor(this.tmpColor, prevClearAlpha);
    r.autoClear = prevAutoClear;
  }

  private renderCaustics(f: RaytracedWaterFrame) {
    if (!this.caustic || !this.causticMat) return;
    const u = this.uniforms;
    const cam = f.camera.position;
    const texel = RT_CAUSTIC_SIZE / RT_CAUSTIC_RES;
    const cx = Math.round(cam.x / texel) * texel;
    const cz = Math.round(cam.z / texel) * texel;
    u.uRtCausticCenter.value.set(cx, cz);

    // Centre the refracted surface grid "upstream" of the floor window so
    // its rays land on it (refracted light is never flatter than ~49°).
    const L = f.sunDir.clone().normalize();
    const eta = 1 / 1.333;
    // refract(-L, up, eta): xz scale by eta, y = -sqrt(1 - eta²(1 - L.y²)).
    const rx = -eta * L.x;
    const rz = -eta * L.z;
    const ry = -Math.sqrt(Math.max(1 - eta * eta * (1 - L.y * L.y), 0));
    const mu = f.depth / Math.max(-ry, 0.05);
    const cm = this.causticMat.uniforms;
    cm.uGridCenter.value.set(cx - rx * mu, cz - rz * mu);
    cm.uFloorY.value = f.level - f.depth;

    // oceanOffset() fades waves by distance from cameraPosition.
    this.causticCamera.position.copy(cam);
    this.causticCamera.updateMatrixWorld();

    this.renderer.setRenderTarget(this.caustic);
    this.renderer.clear(true, false, false);
    this.renderer.render(this.causticScene, this.causticCamera);
    u.uRtCausticOn.value = L.y > -0.1 ? 1 : 0;
  }

  private simPass(mat: THREE.ShaderMaterial) {
    if (!this.simA || !this.simB) return;
    mat.uniforms.uTex.value = this.simA.texture;
    this.quad.material = mat;
    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.simB);
    this.renderer.render(this.quadScene, this.quadCamera);
    this.renderer.setRenderTarget(prev);
    const t = this.simA;
    this.simA = this.simB;
    this.simB = t;
    this.uniforms.uRtSim.value = this.simA.texture;
  }

  private clear(target: THREE.WebGLRenderTarget) {
    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(target);
    this.renderer.clear(true, false, false);
    this.renderer.setRenderTarget(prev);
  }

  /**
   * Copies the frame drawn so far — everything behind the water — for the
   * refracted rays. Hook it to the ocean meshes' onBeforeRender: the
   * transparent ocean draws after the opaque scene, so the copy holds the
   * backdrop, floor, models and sky exactly as they reach the screen. Runs
   * at most once per update(), and only while the material is visible.
   */
  captureBackground() {
    const u = this.uniforms;
    if (this.captured || u.uRtMix.value <= 0.001) return;
    this.captured = true;
    const r = this.renderer;
    const target = r.getRenderTarget();
    let w: number;
    let h: number;
    let half = false;
    if (target) {
      w = target.width;
      h = target.height;
      half = target.texture.type !== THREE.UnsignedByteType;
    } else {
      r.getDrawingBufferSize(this.tmpSize);
      w = this.tmpSize.x;
      h = this.tmpSize.y;
    }
    let tex = half ? this.bgHalf : this.bgByte;
    if (!tex || tex.image.width !== w || tex.image.height !== h) {
      tex?.dispose();
      tex = new THREE.FramebufferTexture(w, h);
      if (half) tex.type = THREE.HalfFloatType;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      if (half) this.bgHalf = tex;
      else this.bgByte = tex;
    }
    r.copyFramebufferToTexture(tex);
    u.uRtScene.value = tex;
    u.uRtSceneOn.value = 1;
  }

  /** Drops the sim/caustic state when the material is switched off, so it
   *  starts from calm water next time instead of a stale window. */
  sleep() {
    this.uniforms.uRtSimOn.value = 0;
    this.uniforms.uRtCausticOn.value = 0;
    this.uniforms.uRtSceneOn.value = 0;
    this.simCenter = null;
    this.oldSwimmer = null;
    this.accum = 0;
  }

  dispose() {
    this.simA?.dispose();
    this.simB?.dispose();
    this.caustic?.dispose();
    this.bgByte?.dispose();
    this.bgHalf?.dispose();
    this.causticGeo?.dispose();
    this.causticMat?.dispose();
    this.quad.geometry.dispose();
    this.updateMat.dispose();
    this.normalMat.dispose();
    this.dropMat.dispose();
    this.sphereMat.dispose();
  }
}
