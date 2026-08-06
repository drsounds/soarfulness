// Best-effort, UNVERIFIED TSL port of the web app's procedural sky dome
// ShaderMaterial (src/routes/index.tsx, ~lines 2786-2833). See
// oceanMaterial.ts for the broader porting caveats.
import * as THREE from "three/webgpu";
import {
  Fn,
  If,
  float,
  vec4,
  uniform,
  varyingProperty,
  positionLocal,
  cameraProjectionMatrix,
  modelViewMatrix,
  mix,
  clamp,
  smoothstep,
  dot,
  pow,
  max,
  normalize,
} from "three/tsl";

export type SkyUniforms = ReturnType<typeof createSkyUniforms>;

function createSkyUniforms() {
  return {
    uTop: uniform(new THREE.Color(0x88aacc)),
    uBottom: uniform(new THREE.Color(0xffddaa)),
    uSunDir: uniform(new THREE.Vector3(0, 1, 0)),
    uSunColor: uniform(new THREE.Color(0xffe6b0)),
    uUnderwater: uniform(0),
    uTurbidity: uniform(0),
    uFogColor: uniform(new THREE.Color(0x0a2a3a)),
  };
}

export function createSkyMaterial() {
  const u = createSkyUniforms();

  const vDir = varyingProperty("vec3");

  const vertexNode = Fn(() => {
    vDir.assign(normalize(positionLocal));
    return cameraProjectionMatrix.mul(modelViewMatrix).mul(vec4(positionLocal, 1.0));
  })();

  const colorNode = Fn(() => {
    const t = clamp(vDir.y.mul(0.5).add(0.5), 0.0, 1.0);
    const col = mix(u.uBottom, u.uTop, smoothstep(0.35, 0.75, t)).toVar();
    const sd = max(dot(normalize(vDir), normalize(u.uSunDir)), 0.0);
    col.addAssign(u.uSunColor.mul(pow(sd, 180.0)).mul(3.0));
    col.addAssign(u.uSunColor.mul(pow(sd, 8.0)).mul(0.15));
    If(u.uUnderwater.greaterThan(0.001), () => {
      const murk = clamp(u.uUnderwater.mul(float(0.25).add(u.uTurbidity.mul(0.7))), 0.0, 1.0);
      col.assign(mix(col, u.uFogColor, murk));
    });
    return col;
  })();

  const material = new THREE.NodeMaterial();
  material.side = THREE.BackSide;
  material.vertexNode = vertexNode;
  material.colorNode = colorNode;

  return { material, uniforms: u };
}
