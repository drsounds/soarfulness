import * as THREE from "three";

// 3D-MOLN: volumetric-looking cloud layers built from camera-facing "puff"
// impostors (one instanced quad per puff, shaded like a soft sphere) grouped
// into cumulus clusters. Used in addition to the flat fbm cloud decks for the
// bottom (seafloor clouds), mid-water and sky layers.
//
// Every layer is one draw call: a single InstancedBufferGeometry whose puff
// offsets live inside a square tile of `tileSize` meters. The vertex shader
// wraps each puff into the tile centered on the camera (uCenter), so the
// field is effectively infinite in x/z without ever moving CPU-side data —
// the same "recenter on the camera" trick the flat decks use. Puffs fade out
// toward the tile's edge (vEdge) so the wrap itself is never visible.

export type Cloud3DLayerOptions = {
  // Width/depth (meters) of the square tile the clusters repeat over.
  tileSize: number;
  clusterCount: number;
  puffsPerCluster: number;
  // Horizontal radius (meters) a cluster's puffs scatter over.
  clusterRadius: [number, number];
  // Billboard radius (meters) of a single puff.
  puffRadius: [number, number];
  // Deterministic seed so every load builds the same cloud field.
  seed: number;
};

export type Cloud3DLayer = {
  mesh: THREE.Mesh;
  uniforms: {
    uCenter: { value: THREE.Vector3 };
    uTile: { value: number };
    uThickness: { value: number };
    uRadiusScale: { value: number };
    uScroll: { value: THREE.Vector2 };
    uSunDir: { value: THREE.Vector3 };
    uOpacity: { value: number };
    uTurbidity: { value: number };
    uUnderwater: { value: number };
    uFogColor: { value: THREE.Color };
    uLitColor: { value: THREE.Color };
    uShadowColor: { value: THREE.Color };
  };
  dispose: () => void;
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createCloud3DLayer(opts: Cloud3DLayerOptions, sunDir: THREE.Vector3): Cloud3DLayer {
  const rand = mulberry32(opts.seed);
  const lerp = (r: [number, number], k: number) => r[0] + (r[1] - r[0]) * k;
  const count = opts.clusterCount * opts.puffsPerCluster;
  // aOffset.y is normalized height inside the layer (0 = base, 1 = top);
  // the shader scales it by uThickness so one geometry serves any depth.
  const offsets = new Float32Array(count * 3);
  const radii = new Float32Array(count);
  const shades = new Float32Array(count);
  let n = 0;
  for (let c = 0; c < opts.clusterCount; c++) {
    const cx = (rand() - 0.5) * opts.tileSize;
    const cz = (rand() - 0.5) * opts.tileSize;
    const cr = lerp(opts.clusterRadius, rand());
    // Bigger clusters tower higher, like real cumulus.
    const clusterTop = 0.45 + 0.55 * rand();
    for (let p = 0; p < opts.puffsPerCluster; p++) {
      const ang = rand() * Math.PI * 2;
      const dist = Math.sqrt(rand()) * cr;
      // Puffs near the cluster's center are larger and rise higher; edge
      // puffs stay low and small — a flat base with a rounded crown.
      const centerness = 1 - dist / Math.max(cr, 1e-6);
      offsets[n * 3] = cx + Math.cos(ang) * dist;
      offsets[n * 3 + 1] = Math.min(1, rand() * clusterTop * (0.35 + 0.65 * centerness));
      offsets[n * 3 + 2] = cz + Math.sin(ang) * dist * 0.75;
      radii[n] = lerp(opts.puffRadius, rand()) * (0.6 + 0.6 * centerness);
      shades[n] = rand();
      n++;
    }
  }

  const quad = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute("position", quad.getAttribute("position"));
  geo.setAttribute("aOffset", new THREE.InstancedBufferAttribute(offsets, 3));
  geo.setAttribute("aRadius", new THREE.InstancedBufferAttribute(radii, 1));
  geo.setAttribute("aShade", new THREE.InstancedBufferAttribute(shades, 1));
  geo.instanceCount = count;

  const uniforms: Cloud3DLayer["uniforms"] = {
    uCenter: { value: new THREE.Vector3() },
    uTile: { value: opts.tileSize },
    uThickness: { value: 1 },
    uRadiusScale: { value: 1 },
    uScroll: { value: new THREE.Vector2() },
    uSunDir: { value: sunDir },
    uOpacity: { value: 0 },
    uTurbidity: { value: 0 },
    uUnderwater: { value: 0 },
    uFogColor: { value: new THREE.Color(0x0a2a3a) },
    uLitColor: { value: new THREE.Color(0xffffff) },
    uShadowColor: { value: new THREE.Color(0xd6dce6) },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      attribute vec3 aOffset;
      attribute float aRadius;
      attribute float aShade;
      uniform vec3 uCenter;
      uniform float uTile;
      uniform float uThickness;
      uniform float uRadiusScale;
      uniform vec2 uScroll;
      uniform vec3 uSunDir;
      varying vec2 vUv;
      varying float vShade;
      varying float vHeight;
      varying float vEdge;
      varying float vDist;
      varying vec3 vSunView;
      void main() {
        // Wrap the puff into the tile centered on the camera (GLSL mod is
        // floor-based, so negative offsets wrap correctly too).
        vec2 rel = aOffset.xz + uScroll - uCenter.xz;
        rel = mod(rel + 0.5 * uTile, uTile) - 0.5 * uTile;
        vEdge = 1.0 - smoothstep(0.3 * uTile, 0.5 * uTile, length(rel));
        float r = aRadius * uRadiusScale;
        vec3 world = vec3(uCenter.x + rel.x, uCenter.y + aOffset.y * uThickness + r * 0.35, uCenter.z + rel.y);
        vec4 mv = viewMatrix * vec4(world, 1.0);
        mv.xy += position.xy * r * 2.0;
        vUv = position.xy * 2.0;
        vShade = aShade;
        vHeight = aOffset.y;
        vDist = -mv.z;
        vSunView = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform float uTurbidity;
      uniform float uUnderwater;
      uniform vec3 uFogColor;
      uniform vec3 uLitColor;
      uniform vec3 uShadowColor;
      uniform vec3 uSunDir;
      varying vec2 vUv;
      varying float vShade;
      varying float vHeight;
      varying float vEdge;
      varying float vDist;
      varying vec3 vSunView;
      void main() {
        float r2 = dot(vUv, vUv);
        if (r2 > 1.0) discard;
        // Shade the quad as the sphere it stands in for.
        vec3 nrm = vec3(vUv, sqrt(1.0 - r2));
        float lambert = clamp(dot(nrm, vSunView) * 0.5 + 0.5, 0.0, 1.0);
        // Night/dusk: dim the lit side as the sun sinks.
        float day = clamp(uSunDir.y * 3.0 + 0.6, 0.35, 1.0);
        vec3 col = mix(uShadowColor, uLitColor, 0.3 + 0.7 * lambert) * day;
        // Cloud bases read darker than their sunlit crowns.
        col *= mix(0.78, 1.0, vHeight) * (0.9 + 0.1 * vShade);
        // Same grumlighet (turbidity) haze the flat decks get.
        float density = uTurbidity * (0.0012 + 0.006 * uUnderwater);
        float fogAmt = clamp(1.0 - exp(-vDist * density), 0.0, 0.92);
        col = mix(col, uFogColor, fogAmt);
        float alpha = pow(1.0 - r2, 1.5) * 0.85;
        alpha *= uOpacity * vEdge;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  // Puff positions come from the shader, so CPU-side bounds are meaningless.
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.renderOrder = -1;

  return {
    mesh,
    uniforms,
    dispose: () => {
      quad.dispose();
      geo.dispose();
      mat.dispose();
    },
  };
}
