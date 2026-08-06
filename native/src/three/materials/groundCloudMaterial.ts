// Best-effort, UNVERIFIED TSL port of the web app's shared seafloor/cloud
// ShaderMaterial (src/routes/index.tsx, ~lines 2580-2702) — used for the
// sand seafloor, the mid-water drifting cloud layer, and the sky cloud deck,
// exactly like the original reuses one GLSL material for all three. See
// oceanMaterial.ts for the broader porting caveats (unverified, no device
// testing done in this sandbox).
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
  varyingProperty,
  positionLocal,
  modelWorldMatrix,
  cameraProjectionMatrix,
  cameraViewMatrix,
  cameraPosition,
  mix,
  clamp,
  smoothstep,
  sin,
  dot,
  pow,
  max,
  length,
  fract,
  floor,
  mat2,
  texture,
  Discard,
} from "three/tsl";

export type GroundCloudUniforms = ReturnType<typeof createGroundCloudUniforms>;

function createGroundCloudUniforms() {
  return {
    uColor: uniform(new THREE.Color(0xd8c078)),
    uTextured: uniform(0),
    uClouds: uniform(0),
    uCloudScroll: uniform(new THREE.Vector2(0, 0)),
    uTime: uniform(0),
    uSandScale: uniform(0.35),
    uTurbidity: uniform(0),
    uUnderwater: uniform(0),
    uFogColor: uniform(new THREE.Color(0x0a2a3a)),
  };
}

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
  const uu = f.mul(f).mul(float(3.0).sub(f.mul(2.0)));
  return mix(a, b, uu.x).add(c.sub(a).mul(uu.y).mul(float(1.0).sub(uu.x))).add(d.sub(b).mul(uu.x).mul(uu.y));
});

// 5-octave fbm — the seafloor/cloud shader's own variant (vs. the ocean
// shader's 3-octave fbm3 in oceanMaterial.ts).
const fbm5 = Fn(([pIn]: [ReturnType<typeof vec2>]) => {
  const p = vec2(pIn).toVar();
  const v = float(0.0).toVar();
  const a = float(0.5).toVar();
  Loop(5, () => {
    v.addAssign(a.mul(vnoise(p)));
    p.mulAssign(2.02);
    a.mulAssign(0.5);
  });
  return v;
});

/**
 * Builds the shared seafloor/cloud NodeMaterial. `sandTexture` is required
 * when this instance will ever have uTextured > 0 (the seafloor use case);
 * the cloud-layer instances never sample it (uTextured stays 0), but the
 * texture node is still built unconditionally since colorNode is a single
 * static graph shared by every draw call of this material.
 *
 * NOTE: the original shader reconstructs linear view-space depth from
 * gl_FragCoord.z for its turbidity fog (see applyTurbidity() in
 * routes/index.tsx), because the 900,000-unit seafloor plane's sparse
 * vertices make a world-space varying inaccurate for distance there. TSL's
 * depth/screen helpers differ enough from raw gl_FragCoord.z that this port
 * instead approximates "distance from camera" from the interpolated world
 * position — a known, deliberate simplification (slightly less accurate at
 * extreme grazing angles over the huge seafloor plane) rather than an
 * oversight. Revisit once this can be tested on-device.
 */
export function createGroundCloudMaterial(sandTexture: THREE.Texture) {
  const u = createGroundCloudUniforms();
  const sandTexNode = texture(sandTexture);

  const vWorld = varyingProperty("vec3");

  const vertexNode = Fn(() => {
    const wp = modelWorldMatrix.mul(vec4(positionLocal, 1.0));
    vWorld.assign(wp.xyz);
    return cameraProjectionMatrix.mul(cameraViewMatrix).mul(wp);
  })();

  function applyTurbidity(colIn: ReturnType<typeof vec3>) {
    const col = vec3(colIn).toVar();
    If(u.uTurbidity.greaterThan(0.001), () => {
      const distC = length(vWorld.sub(cameraPosition));
      const density = u.uTurbidity.mul(float(0.0012).add(float(0.006).mul(u.uUnderwater)));
      const fogAmt = clamp(float(1.0).sub(distC.mul(density).negate().exp()), 0.0, 0.92).toVar();
      const patchy = fbm5(vWorld.xz.mul(0.06).add(u.uTime.mul(0.015)));
      fogAmt.mulAssign(float(0.75).add(float(0.35).mul(patchy)));
      const muted = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), u.uFogColor, 0.6);
      col.assign(mix(col, muted, u.uTurbidity.mul(0.3)));
      col.assign(mix(col, u.uFogColor, fogAmt));
    });
    return col;
  }

  const shaded = Fn(() => {
    const finalColor = vec3(0.0, 0.0, 0.0).toVar();
    const finalAlpha = float(1.0).toVar();

    If(u.uClouds.greaterThan(0.5), () => {
      const p = vWorld.xz.mul(0.025).add(u.uCloudScroll);
      const n = fbm5(p);
      const cloud = smoothstep(0.45, 0.78, n);
      If(cloud.lessThan(0.01), () => {
        Discard();
      });
      const shade = float(0.85).add(fbm5(p.mul(2.3).add(5.0)).mul(0.25));
      finalColor.assign(applyTurbidity(u.uColor.mul(shade)));
      finalAlpha.assign(cloud);
    }).Else(() => {
      const base = vec3(u.uColor).toVar();
      If(u.uTextured.greaterThan(0.001), () => {
        const uv0 = vWorld.xz.mul(u.uSandScale);
        const s1 = sandTexNode.sample(uv0).rgb;
        const rot = mat2(0.8, -0.6, 0.6, 0.8);
        const s2 = sandTexNode.sample(rot.mul(uv0.mul(0.25)).add(0.13)).rgb;
        const sand = s1.add(s2).mul(0.5).toVar();
        sand.assign(sand.sub(0.5).mul(1.15).add(0.55));
        sand.assign(sand.mul(u.uColor).mul(1.9));
        sand.assign(clamp(sand, 0.0, 1.6));
        const p = vWorld.xz;
        const causticSum = sin(p.x.mul(0.9).add(u.uTime.mul(0.7)).add(vnoise(p.mul(0.4)).mul(4.0))).add(
          sin(p.y.mul(0.85).sub(u.uTime.mul(0.55)).add(vnoise(p.mul(0.35).add(3.1)).mul(4.0))),
        );
        const caustic = pow(max(causticSum.mul(0.5).add(0.5), 0.0), 3.0);
        sand.addAssign(vec3(0.95, 0.88, 0.7).mul(caustic).mul(0.22));
        base.assign(mix(u.uColor, sand, clamp(u.uTextured, 0.0, 1.0)));
      });
      finalColor.assign(applyTurbidity(base));
      finalAlpha.assign(1.0);
    });

    return vec4(finalColor, finalAlpha);
  })();

  const material = new THREE.NodeMaterial();
  material.side = THREE.DoubleSide;
  material.transparent = true;
  material.vertexNode = vertexNode;
  material.colorNode = shaded.rgb;
  material.opacityNode = shaded.a;

  return { material, uniforms: u };
}
