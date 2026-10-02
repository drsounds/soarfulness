// Best-effort, UNVERIFIED port of the web app's ocean water ShaderMaterial
// (src/routes/index.tsx, ~lines 2061-2533) from raw WebGL GLSL to Three.js
// Shading Language (TSL) node graphs, which is what THREE.WebGPURenderer
// (react-native-webgpu's Three.js backend) requires instead of GLSL.
//
// This has NOT been compiled or run on a real device/simulator — this
// sandbox has no GPU. The wave math (kAliasFade/fftHeight/dyingHeight/shp/
// wave) is translated 1:1 from the GLSL so it should stay numerically
// consistent with src/lib/ocean/waveHeight.ts (the camera buoyancy physics'
// JS mirror of the same functions), but expect to need on-device debugging —
// see NATIVE_APP.md for what "best-effort" means here.
import * as THREE from "three/webgpu";
import {
  Fn,
  If,
  Loop,
  float,
  vec2,
  vec3,
  vec4,
  uniform,
  uniformArray,
  varyingProperty,
  positionLocal,
  modelWorldMatrix,
  cameraPosition,
  cameraViewMatrix,
  cameraProjectionMatrix,
  mix,
  clamp,
  smoothstep,
  pow,
  sin,
  cos,
  atan,
  dot,
  length,
  normalize,
  reflect,
  min,
  max,
  select,
  fract,
  floor,
  texture,
} from "three/tsl";
import { FFT_WAVE_COUNT, DYING_WAVE_COUNT } from "@/lib/ocean/fftOceanSpectrum";

// Keep in sync with K_ALIAS_FADE_START/END in src/lib/ocean/fftOceanSpectrum.ts.
const K_ALIAS_FADE_START = 1.4;
const K_ALIAS_FADE_END = 1.75;

export type OceanUniforms = ReturnType<typeof createOceanUniforms>;

function createOceanUniforms() {
  return {
    uTime: uniform(0),
    uAmp: uniform(1),
    uFft: uniform(0),
    uFftWave: uniformArray(new Array(FFT_WAVE_COUNT).fill(0).map(() => new THREE.Vector4())),
    uFftPhase: uniformArray(new Array(FFT_WAVE_COUNT).fill(0)),
    uDying: uniform(0),
    uDyingAmp: uniform(0),
    uDyingTime: uniform(0),
    uDyingWave: uniformArray(new Array(DYING_WAVE_COUNT).fill(0).map(() => new THREE.Vector4())),
    uDyingPhase: uniformArray(new Array(DYING_WAVE_COUNT).fill(0)),
    uSunDir: uniform(new THREE.Vector3(0, 1, 0)),
    uSkyColor: uniform(new THREE.Color(0x88aacc)),
    uHorizonColor: uniform(new THREE.Color(0xffddaa)),
    uWaterDeep: uniform(new THREE.Color(0x022244)),
    uWaterShallow: uniform(new THREE.Color(0x2a89b8)),
    uSunColor: uniform(new THREE.Color(0xffe6b0)),
    uWaterColor: uniform(new THREE.Vector3(1, 1, 1)),
    uOpacity: uniform(1),
    uWaterColorAlpha: uniform(0),
    uTintHue: uniform(0),
    uTintSat: uniform(1),
    uTintBright: uniform(1),
    uSurfBright: uniform(1),
    uSurfSat: uniform(1),
    uUnderwater: uniform(0),
    uRegular: uniform(0),
    uCross: uniform(1),
    uPeriod: uniform(1),
    uFreq: uniform(1),
    uPeak: uniform(1),
    uQuality: uniform(0),
    uDir: uniform(0),
    uVortex: uniform(0),
    uVortexOpening: uniform(14),
    uVortexCenter: uniform(new THREE.Vector2(0, 0)),
    uReflMix: uniform(0),
    uSphereMix: uniform(0),
    uTrochoid: uniform(0),
    uTurbidity: uniform(0),
  };
}

// hueRotate(): rotate an RGB color around the gray axis by `angle` radians —
// mirrors the mat3 built in the original fragment shader.
const hueRotate = Fn(([col, angle]: [ReturnType<typeof vec3>, ReturnType<typeof float>]) => {
  const c = cos(angle);
  const s = sin(angle);
  const oneThird = float(1.0 / 3.0);
  const root3inv = float(0.57735026919);
  const r = c
    .add(oneThird.mul(float(1.0).sub(c)))
    .mul(col.x)
    .add(root3inv.negate().mul(s).add(oneThird.mul(float(1.0).sub(c))).mul(col.y))
    .add(root3inv.mul(s).add(oneThird.mul(float(1.0).sub(c))).mul(col.z));
  const g = root3inv
    .mul(s)
    .add(oneThird.mul(float(1.0).sub(c)))
    .mul(col.x)
    .add(c.add(oneThird.mul(float(1.0).sub(c))).mul(col.y))
    .add(root3inv.negate().mul(s).add(oneThird.mul(float(1.0).sub(c))).mul(col.z));
  const b = root3inv
    .negate()
    .mul(s)
    .add(oneThird.mul(float(1.0).sub(c)))
    .mul(col.x)
    .add(root3inv.mul(s).add(oneThird.mul(float(1.0).sub(c))).mul(col.y))
    .add(c.add(oneThird.mul(float(1.0).sub(c))).mul(col.z));
  return vec3(r, g, b);
});

const hash2 = Fn(([p]: [ReturnType<typeof vec2>]) => {
  return fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453123));
});

const vnoise = Fn(([p]: [ReturnType<typeof vec2>]) => {
  const i = floor(p);
  const f = fract(p);
  const a = hash2(i);
  const b = hash2(i.add(vec2(1.0, 0.0)));
  const c = hash2(i.add(vec2(0.0, 1.0)));
  const d = hash2(i.add(vec2(1.0, 1.0)));
  const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0)));
  return mix(a, b, u.x).add(c.sub(a).mul(u.y).mul(float(1.0).sub(u.x))).add(d.sub(b).mul(u.x).mul(u.y));
});

// 3-octave fbm, matching the ocean fragment shader's micro-chop/foam noise
// (the seafloor shader below uses its own 5-octave variant).
const fbm3 = Fn(([pIn]: [ReturnType<typeof vec2>]) => {
  const p = vec2(pIn).toVar();
  const v = float(0.0).toVar();
  const a = float(0.5).toVar();
  Loop(3, () => {
    v.addAssign(a.mul(vnoise(p)));
    p.mulAssign(2.02);
    a.mulAssign(0.5);
  });
  return v;
});

/**
 * Builds the ocean water NodeMaterial + its live uniform handles.
 *
 * `reflectionTexture` is optional — pass a THREE.Texture to enable the
 * "selectable photo reflection" feature (uReflMix); a 1x1 white texture is
 * used as a harmless default otherwise, mirroring the web app's fallback.
 */
export function createOceanMaterial(reflectionTexture?: THREE.Texture) {
  const u = createOceanUniforms();

  const whiteTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
  whiteTex.needsUpdate = true;
  const reflTexNode = texture(reflectionTexture ?? whiteTex);

  // kAliasFade(k): fade out components whose (FREKVENS-scaled) wavenumber
  // would alias against the mesh's vertex spacing. Mirrors kAliasFade() in
  // src/lib/ocean/fftOceanSpectrum.ts.
  const kAliasFade = Fn(([k]: [ReturnType<typeof vec2>]) => {
    return float(1.0).sub(smoothstep(K_ALIAS_FADE_START, K_ALIAS_FADE_END, length(k)));
  });

  const fftHeight = Fn(([xz, t]: [ReturnType<typeof vec2>, ReturnType<typeof float>]) => {
    const h = float(0.0).toVar();
    Loop(FFT_WAVE_COUNT, ({ i }) => {
      const w = u.uFftWave.element(i);
      const k = w.xy.mul(u.uFreq);
      h.addAssign(
        w.z
          .mul(kAliasFade(k))
          .mul(cos(k.x.mul(xz.x).add(k.y.mul(xz.y)).sub(w.w.mul(t)).add(u.uFftPhase.element(i)))),
      );
    });
    return h;
  });

  const dyingHeight = Fn(([xz, t]: [ReturnType<typeof vec2>, ReturnType<typeof float>]) => {
    const h = float(0.0).toVar();
    Loop(DYING_WAVE_COUNT, ({ i }) => {
      const w = u.uDyingWave.element(i);
      const k = w.xy.mul(u.uFreq);
      h.addAssign(
        w.z
          .mul(kAliasFade(k))
          .mul(cos(k.x.mul(xz.x).add(k.y.mul(xz.y)).sub(w.w.mul(t)).add(u.uDyingPhase.element(i)))),
      );
    });
    return h;
  });

  // shp(theta): rounded Gaussian crest boost, reading uPeak straight from the
  // closure (mirrors the GLSL global-uniform version, not the JS
  // shapedWave(theta, p) helper which takes p as a parameter).
  const shp = Fn(([theta]: [ReturnType<typeof float>]) => {
    const k = clamp(u.uPeak.sub(1.0).div(5.0), 0.0, 1.0);
    const amount = max(0.0, u.uPeak.sub(1.0)).mul(0.08);
    const wrapped = atan(sin(theta.sub(1.57079632679)), cos(theta.sub(1.57079632679)));
    const width = mix(0.72, 0.6, k);
    const crestExp = wrapped.mul(wrapped).div(width.mul(width).mul(2.0)).negate().exp();
    const mean = width.mul(0.3989);
    const base = sin(theta);
    const peakBoost = pow(max(base, 0.0), mix(1.0, 1.8, k)).sub(float(0.3183).mul(mix(0.0, 1.0, k)));
    const stokes = cos(theta.mul(2.0)).negate().mul(k).mul(0.01);
    return base
      .add(stokes)
      .add(amount.mul(crestExp.sub(mean)))
      .add(k.mul(0.55).mul(peakBoost))
      .div(float(1.0).add(amount.mul(0.28)).add(k.mul(0.35)).add(k.mul(0.01)));
  });

  const wave = Fn(
    ([pIn, t, amp, rippleFade, dyingAmp]: [
      ReturnType<typeof vec3>,
      ReturnType<typeof float>,
      ReturnType<typeof float>,
      ReturnType<typeof float>,
      ReturnType<typeof float>,
    ]) => {
      const cd = sin(u.uDir).negate();
      const sd = cos(u.uDir).negate();
      const p = vec3(cd.mul(pIn.x).add(sd.mul(pIn.z)), pIn.y, sd.negate().mul(pIn.x).add(cd.mul(pIn.z)));

      const regX = shp(p.x.mul(float(0.12).mul(u.uFreq).div(u.uPeriod)).add(t.mul(0.9))).mul(2.6).mul(amp);
      const regZ = shp(p.z.mul(float(0.09).mul(u.uFreq).div(u.uPeriod)).add(t.mul(0.9)).add(1.1))
        .mul(1.4)
        .mul(amp)
        .mul(u.uCross);
      const reg = regX.add(regZ);

      const w1 = shp(p.x.mul(0.12).mul(u.uFreq).add(t.mul(0.9))).mul(1.0);
      const w2 = shp(p.z.mul(0.17).mul(u.uFreq).add(t.mul(0.7)).add(1.3)).mul(0.75);
      const w3 = shp(p.x.mul(0.22).add(p.z.mul(0.19)).mul(u.uFreq).add(t.mul(1.4)).add(2.1)).mul(0.5);
      const w4 = shp(p.x.mul(0.31).sub(p.z.mul(0.11)).mul(u.uFreq).add(t.mul(1.8)).add(0.4)).mul(0.35);
      const big = w1.add(w2).add(w3).add(w4).mul(amp);

      const r1 = sin(p.x.mul(0.85).add(p.z.mul(0.42)).add(t.mul(2.6))).mul(0.06);
      const r2 = sin(p.x.mul(0.55).sub(p.z.mul(0.95)).add(t.mul(3.1)).add(1.7)).mul(0.05);
      const r3 = sin(p.x.mul(1.35).add(p.z.mul(1.15)).add(t.mul(3.8)).add(0.6)).mul(0.035);
      const r4 = sin(p.x.mul(1.9).sub(p.z.mul(1.6)).add(t.mul(4.7)).add(2.3)).mul(0.022);
      const ripples = r1.add(r2).add(r3).add(r4).mul(float(1.0).sub(u.uRegular)).mul(rippleFade);

      const base = mix(big.add(ripples), reg, u.uRegular).toVar();
      If(u.uFft.greaterThan(0.001), () => {
        const fft = fftHeight(p.xz, t).mul(amp);
        base.assign(mix(base, fft, u.uFft));
      });
      If(u.uDying.greaterThan(0.001), () => {
        const dying = dyingHeight(p.xz, u.uDyingTime).mul(dyingAmp);
        base.assign(mix(base, dying, u.uDying));
      });
      return base;
    },
  );

  const vWorldPos = varyingProperty("vec3");
  const vNormalOut = varyingProperty("vec3");

  const vertexNode = Fn(() => {
    const p = positionLocal.toVar();
    const wpBase = modelWorldMatrix.mul(vec4(p, 1.0));

    const distXZ = length(wpBase.xz.sub(cameraPosition.xz));
    const fadeNear = mix(40.0, 180.0, u.uVortex);
    const fadeFar = mix(180.0, 500.0, u.uVortex);
    const ampFade = float(1.0).sub(smoothstep(fadeNear, fadeFar, distXZ));
    const rippleNear = mix(18.0, 60.0, u.uVortex);
    const rippleFar = mix(70.0, 220.0, u.uVortex);
    const rippleFadeV = float(1.0).sub(smoothstep(rippleNear, rippleFar, distXZ));
    const ampF = u.uAmp.mul(ampFade);
    const dyingAmpF = u.uDyingAmp.mul(ampFade);

    const h = wave(wpBase.xyz, u.uTime, ampF, rippleFadeV, dyingAmpF).toVar();
    p.y.addAssign(h);

    const e = float(0.22);
    const hx = wave(wpBase.xyz.add(vec3(e, 0.0, 0.0)), u.uTime, ampF, rippleFadeV, dyingAmpF).toVar();
    const hz = wave(wpBase.xyz.add(vec3(0.0, 0.0, e)), u.uTime, ampF, rippleFadeV, dyingAmpF).toVar();
    const n = normalize(vec3(h.sub(hx), e, h.sub(hz))).toVar();

    If(u.uTrochoid.greaterThan(0.001), () => {
      const dhdx = h.sub(hx).div(e);
      const dhdz = h.sub(hz).div(e);
      const steepness = min(ampF, 3.0).mul(0.7).mul(u.uTrochoid);
      p.x.addAssign(dhdx.mul(steepness));
      p.z.addAssign(dhdz.mul(steepness));
    });

    If(u.uVortex.greaterThan(0.001), () => {
      const rvec = wpBase.xz.sub(u.uVortexCenter);
      const r = length(rvec);
      const op = max(1.0, u.uVortexOpening);
      const g = r.mul(r).div(op.mul(op)).negate().exp();
      const pit = op.mul(-1.6).mul(g);
      const kR = float(0.12).mul(u.uFreq).div(u.uPeriod);
      const phase = r.mul(kR).sub(u.uTime.mul(0.9));
      const hR = sin(phase).mul(2.6).mul(ampF);
      const dHr = cos(phase).mul(kR).mul(2.6).mul(ampF);
      const pyRad = pit.add(hR.mul(float(1.0).sub(g.mul(0.85))));
      p.y.assign(mix(p.y, pyRad, u.uVortex));

      const dg = g.mul(-2.0).div(op.mul(op));
      const rn = select(r.greaterThan(0.0001), rvec.div(r), vec2(0.0, 0.0));
      const slopeR = dHr.mul(float(1.0).sub(g.mul(0.85))).add(op.mul(-1.6).mul(dg).mul(r));
      const nv = normalize(vec3(rn.x.negate().mul(slopeR), 1.0, rn.y.negate().mul(slopeR)));
      n.assign(normalize(mix(n, nv, u.uVortex)));
    });

    const wp = modelWorldMatrix.mul(vec4(p, 1.0));
    vWorldPos.assign(wp.xyz);
    vNormalOut.assign(n);
    return cameraProjectionMatrix.mul(cameraViewMatrix).mul(wp);
  })();

  const sphereMapShade = Fn(([Nsh, baseCol]: [ReturnType<typeof vec3>, ReturnType<typeof vec3>]) => {
    const viewN = normalize(cameraViewMatrix.mul(vec4(Nsh, 0.0)).xyz);
    const muv = viewN.xy.mul(0.5).add(0.5);
    const hiCore = smoothstep(0.16, 0.0, length(muv.sub(vec2(0.32, 0.68))));
    const hiSoft = smoothstep(0.55, 0.0, length(muv.sub(vec2(0.32, 0.68))));
    const rim = pow(clamp(float(1.0).sub(viewN.z), 0.0, 1.0), 3.0);
    const body = mix(baseCol.mul(0.32), baseCol.mul(0.95), hiSoft);
    return body.add(vec3(1.0, 1.0, 1.0).mul(hiCore).mul(0.95)).add(u.uSkyColor.mul(rim).mul(0.6));
  });

  const shaded = Fn(() => {
    const N = normalize(vNormalOut);
    const V = normalize(cameraPosition.sub(vWorldPos));
    const L = normalize(u.uSunDir);

    let tint: ReturnType<typeof vec3> = u.uWaterColor.mul(u.uTintBright);
    tint = hueRotate(tint, u.uTintHue);
    const gray = vec3(dot(tint, vec3(0.299, 0.587, 0.114)));
    tint = mix(gray, tint, u.uTintSat);

    const NdotV = clamp(dot(N, V), 0.0, 1.0);
    const F0 = float(0.02);
    const fres = F0.add(float(1.0).sub(F0).mul(pow(float(1.0).sub(NdotV), 5.0)));

    const shimDist = length(vWorldPos.xz.sub(cameraPosition.xz));
    const shimFade = float(1.0).sub(smoothstep(10.0, 40.0, shimDist)).mul(smoothstep(0.02, 0.15, NdotV));
    const shim = sin(vWorldPos.x.mul(3.7).add(vWorldPos.z.mul(4.3))).mul(
      sin(vWorldPos.x.mul(5.1).sub(vWorldPos.z.mul(6.2))),
    ).mul(shimFade);
    const Nshim = normalize(N.add(vec3(shim.mul(0.06), 0.0, shim.mul(0.05)))).toVar();

    const foam = float(0.0).toVar();
    If(u.uQuality.greaterThan(0.5), () => {
      const microFade = float(1.0).sub(smoothstep(20.0, 90.0, shimDist)).mul(smoothstep(0.02, 0.15, NdotV));
      const n1 = fbm3(vWorldPos.xz.mul(0.6).add(vec2(u.uTime.mul(0.05), u.uTime.mul(0.03))));
      const n2 = fbm3(vWorldPos.xz.mul(2.3).sub(vec2(u.uTime.mul(0.08), u.uTime.mul(0.11))));
      const microBump = n1.sub(0.5).mul(0.05).add(n2.sub(0.5).mul(0.025)).mul(microFade);
      Nshim.assign(normalize(Nshim.add(vec3(microBump, 0.0, microBump.mul(0.7)))));

      const slope = float(1.0).sub(N.y);
      const crestF = smoothstep(u.uAmp.mul(0.55), u.uAmp.mul(1.3), vWorldPos.y);
      const foamNoise = fbm3(vWorldPos.xz.mul(0.8).add(vec2(u.uTime.mul(0.12), u.uTime.mul(-0.09))));
      foam.assign(clamp(crestF.mul(float(0.35).add(slope.mul(1.8))).mul(smoothstep(0.3, 0.75, foamNoise)), 0.0, 1.0));
    });

    const R = reflect(V.negate(), Nshim);
    const rUp = clamp(R.y, 0.0, 1.0);
    const skyRef = mix(u.uHorizonColor, u.uSkyColor, pow(rUp, 0.65)).toVar();

    If(u.uReflMix.greaterThan(0.001), () => {
      const reflUv = vec2(atan(R.z, R.x).mul(0.15915494).add(0.5), clamp(float(1.0).sub(rUp), 0.0, 1.0));
      const photo = reflTexNode.sample(reflUv).rgb;
      const daylight = clamp(u.uSunDir.y.add(0.35), 0.12, 1.15);
      const envRefl = mix(skyRef, photo.mul(daylight), 0.75);
      skyRef.assign(mix(skyRef, envRefl, u.uReflMix));
    });

    const deepT = u.uWaterDeep.mul(tint);
    const shalT = u.uWaterShallow.mul(tint);
    const refrMix = mix(0.15, 0.85, pow(float(1.0).sub(NdotV), 1.6));
    const water = mix(deepT, shalT, refrMix).toVar();

    const height = clamp(vWorldPos.y.add(1.0).div(3.0), 0.0, 1.0);
    const sss = u.uSunColor.mul(pow(height, 2.0)).mul(0.35).mul(clamp(u.uSunDir.y.add(0.2), 0.0, 1.0));
    water.addAssign(sss.mul(tint));

    const H = normalize(L.add(V));
    const sunElev = clamp(u.uSunDir.y, 0.0, 1.0);
    const shin = mix(220.0, 80.0, sunElev);
    const spec = pow(max(dot(Nshim, H), 0.0), shin);
    const grazeBoost = float(1.0).add(float(1.0).sub(NdotV).mul(1.5));
    const sun = u.uSunColor
      .mul(spec)
      .mul(clamp(u.uSunDir.y.add(0.2), 0.0, 1.0))
      .mul(2.8)
      .mul(grazeBoost)
      .mul(float(1.0).sub(u.uUnderwater));

    const col = mix(water, skyRef, fres.mul(float(1.0).sub(u.uUnderwater.mul(0.85)))).add(sun).toVar();

    If(u.uSphereMix.greaterThan(0.001), () => {
      col.assign(mix(col, sphereMapShade(Nshim, water), u.uSphereMix));
    });

    // Water color overlay (Super Mario Sunshine-style) — see the matching
    // block in the web app's GLSL fragment shader (src/routes/index.tsx).
    col.assign(mix(col, water, clamp(u.uWaterColorAlpha, 0.0, 1.0)));

    // Whitecap foam is applied *after* the color overlay above so it stays
    // visible at any uWaterColorAlpha — the tint dial recolors the water
    // body, not the foam sitting on top of it.
    col.assign(mix(col, vec3(0.95, 0.98, 1.0), foam.mul(0.85).mul(float(1.0).sub(u.uUnderwater))));

    col.mulAssign(u.uSurfBright);
    const sg = dot(col, vec3(0.299, 0.587, 0.114));
    col.assign(mix(vec3(sg, sg, sg), col, u.uSurfSat));

    If(u.uUnderwater.greaterThan(0.0), () => {
      const g = dot(col, vec3(0.299, 0.587, 0.114));
      const muted = mix(vec3(g, g, g), deepT.mul(1.1), 0.55).mul(float(1.0).sub(float(0.35).mul(u.uUnderwater)));
      col.assign(mix(col, muted, clamp(u.uUnderwater, 0.0, 1.0)));
    });

    If(u.uTurbidity.greaterThan(0.001).and(u.uUnderwater.greaterThan(0.001)), () => {
      const distC = length(cameraPosition.sub(vWorldPos));
      const murk = clamp(
        float(1.0).sub(distC.mul(u.uTurbidity).mul(-0.01).exp()),
        0.0,
        0.95,
      ).mul(u.uUnderwater);
      col.assign(mix(col, deepT.mul(0.55), murk));
    });

    const baseAlpha = clamp(
      float(0.65).add(fres.mul(0.35)).sub(height.mul(0.35)).add(foam.mul(0.25)),
      0.4,
      1.0,
    );
    const alpha = float(1.0).sub(float(1.0).sub(baseAlpha.mul(u.uOpacity)).mul(float(1.0).sub(u.uOpacity)));

    return vec4(col, alpha);
  })();

  const material = new THREE.NodeMaterial();
  material.transparent = true;
  material.depthWrite = true;
  material.side = THREE.DoubleSide;
  material.vertexNode = vertexNode;
  material.colorNode = shaded.rgb;
  material.opacityNode = shaded.a;

  return { material, uniforms: u, reflectionWhiteTexture: whiteTex };
}
