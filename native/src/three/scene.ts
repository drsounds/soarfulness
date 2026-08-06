// Assembles the ocean scene graph (water + seafloor + drifting clouds + sky
// dome) and drives its per-frame animation + a simplified version of the web
// app's wave-following camera buoyancy. This file is ordinary Three.js
// object/scene-graph code (not TSL), so it carries much less porting risk
// than the shader materials in ./materials — the main open question is
// whether THREE.NodeMaterial + WebGPURenderer behaves exactly like the
// standard renderer for things like fog, double-sided transparency and
// render order, which this hasn't been able to verify on-device either.
//
// Ported/simplified from src/routes/index.tsx's mount effect + animate()
// loop in the web app. NOT ported: drift/sway pads, spatial audio, GLTF
// scene loading, torus rings, the CSS3D TV embed, vortex/swing camera modes,
// interval sessions. See NATIVE_APP.md for the full status.
import * as THREE from "three/webgpu";
import { createOceanMaterial } from "./materials/oceanMaterial";
import { createGroundCloudMaterial } from "./materials/groundCloudMaterial";
import { createSkyMaterial } from "./materials/skyMaterial";
import {
  generateOceanWaveComponents,
  generateDyingWaveComponents,
  packOceanWaveComponents,
  createSeededRandom,
  type OceanWaveComponent,
} from "@/lib/ocean/fftOceanSpectrum";
import { waveHeight } from "@/lib/ocean/waveHeight";

const OCEAN_BASE_SIZE = 600;
const CLOUD_BASE_SIZE = 200000;
const FFT_WAVE_SEED = 20260108;
const DYING_WAVE_SEED = 19700101;

// Small procedural stand-in for the web app's real sand photo texture
// (src/assets/sand_cc0_512.jpg via Lovable's asset pipeline, not ported —
// bundle a real texture asset here for visual parity).
function createPlaceholderSandTexture(): THREE.Texture {
  const size = 4;
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data[i * 4 + 0] = 216;
    data[i * 4 + 1] = 192;
    data[i * 4 + 2] = 120;
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function packWaveUniform(
  uniformWave: { array: THREE.Vector4[] },
  uniformPhase: { array: number[] },
  components: OceanWaveComponent[],
) {
  const { wave, phase } = packOceanWaveComponents(components);
  for (let i = 0; i < components.length; i++) {
    uniformWave.array[i].set(wave[i * 4 + 0], wave[i * 4 + 1], wave[i * 4 + 2], wave[i * 4 + 3]);
    uniformPhase.array[i] = phase[i];
  }
}

export type NavInput = { x: number; y: number };
export type LookInput = { x: number; y: number };

export class OceanScene {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;

  private ocean: THREE.Mesh;
  private floor: THREE.Mesh;
  private midClouds: THREE.Mesh;
  private skyClouds: THREE.Mesh;
  private sky: THREE.Mesh;

  private oceanUniforms: ReturnType<typeof createOceanMaterial>["uniforms"];
  private floorUniforms: ReturnType<typeof createGroundCloudMaterial>["uniforms"];
  private midCloudUniforms: ReturnType<typeof createGroundCloudMaterial>["uniforms"];
  private skyCloudUniforms: ReturnType<typeof createGroundCloudMaterial>["uniforms"];
  private skyUniforms: ReturnType<typeof createSkyMaterial>["uniforms"];

  private fftWaveComponents: OceanWaveComponent[];
  private dyingWaveComponents: OceanWaveComponent[];

  private elapsed = 0;
  private camX = 0;
  private camZ = 0;
  private camY = 0;
  private camVY = 0;
  private prevSurfaceY: number | null = null;
  private yaw = 0;
  private pitch = 0;

  // Live-tunable dials (subset of the web app's settings panel — see
  // NATIVE_APP.md for what's exposed vs. hardcoded to sensible defaults).
  waveAmp = 1;
  waveFreq = 1;
  waveSpeed = 1;
  wavePeriod = 1;
  wavePeak = 1;
  waveDirDeg = 0;
  realistic = false;
  dying = false;
  dyingAmp = 0.6;

  constructor(width: number, height: number) {
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 3000);
    this.scene.fog = new THREE.FogExp2(0x88aacc, 0);

    const random = createSeededRandom(FFT_WAVE_SEED);
    this.fftWaveComponents = generateOceanWaveComponents(random);
    const dyingRandom = createSeededRandom(DYING_WAVE_SEED);
    this.dyingWaveComponents = generateDyingWaveComponents(dyingRandom);

    const oceanGeo = new THREE.PlaneGeometry(OCEAN_BASE_SIZE, OCEAN_BASE_SIZE, 320, 320);
    oceanGeo.rotateX(-Math.PI / 2);
    const { material: oceanMat, uniforms: oceanUniforms } = createOceanMaterial();
    this.oceanUniforms = oceanUniforms;
    packWaveUniform(oceanUniforms.uFftWave, oceanUniforms.uFftPhase, this.fftWaveComponents);
    packWaveUniform(oceanUniforms.uDyingWave, oceanUniforms.uDyingPhase, this.dyingWaveComponents);
    this.ocean = new THREE.Mesh(oceanGeo, oceanMat);
    this.scene.add(this.ocean);

    const sandTex = createPlaceholderSandTexture();

    const floorGeo = new THREE.PlaneGeometry(900000, 900000, 32, 32);
    floorGeo.rotateX(-Math.PI / 2);
    const { material: floorMat, uniforms: floorUniforms } = createGroundCloudMaterial(sandTex);
    this.floorUniforms = floorUniforms;
    floorUniforms.uTextured.value = 1;
    this.floor = new THREE.Mesh(floorGeo, floorMat);
    this.floor.position.y = -14;
    this.floor.renderOrder = -2;
    this.scene.add(this.floor);

    const midCloudGeo = new THREE.PlaneGeometry(CLOUD_BASE_SIZE, CLOUD_BASE_SIZE, 8, 8);
    midCloudGeo.rotateX(-Math.PI / 2);
    const { material: midCloudMat, uniforms: midCloudUniforms } = createGroundCloudMaterial(sandTex);
    this.midCloudUniforms = midCloudUniforms;
    midCloudUniforms.uClouds.value = 1;
    midCloudUniforms.uColor.value.set(0xffffff);
    this.midClouds = new THREE.Mesh(midCloudGeo, midCloudMat);
    this.midClouds.position.y = -7;
    this.midClouds.visible = false;
    this.midClouds.renderOrder = -1;
    this.scene.add(this.midClouds);

    const skyCloudGeo = new THREE.PlaneGeometry(CLOUD_BASE_SIZE, CLOUD_BASE_SIZE, 8, 8);
    skyCloudGeo.rotateX(-Math.PI / 2);
    const { material: skyCloudMat, uniforms: skyCloudUniforms } = createGroundCloudMaterial(sandTex);
    this.skyCloudUniforms = skyCloudUniforms;
    skyCloudUniforms.uClouds.value = 1;
    skyCloudUniforms.uColor.value.set(0xffffff);
    this.skyClouds = new THREE.Mesh(skyCloudGeo, skyCloudMat);
    this.skyClouds.position.y = 150;
    this.skyClouds.visible = false;
    this.skyClouds.renderOrder = -1;
    this.scene.add(this.skyClouds);

    const skyGeo = new THREE.SphereGeometry(800, 32, 32);
    const { material: skyMat, uniforms: skyUniforms } = createSkyMaterial();
    this.skyUniforms = skyUniforms;
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.sky.scale.setScalar(1);
    (this.sky.material as THREE.Material).side = THREE.BackSide;
    this.scene.add(this.sky);

    this.setSunElevation(0.55);
  }

  setSunElevation(t: number) {
    // t in [0,1]: simple day-arc sun direction, matching the web app's
    // default gradient look closely enough for a first pass (the web app's
    // full sun/time-of-day system is not ported).
    const angle = Math.PI * t;
    const dir = new THREE.Vector3(Math.cos(angle) * 0.4, Math.sin(angle), 0.3).normalize();
    this.oceanUniforms.uSunDir.value.copy(dir);
    this.skyUniforms.uSunDir.value.copy(dir);
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /** Advance the simulation by `dt` seconds. `nav`/`look` are -1..1 stick vectors. */
  update(dt: number, nav: NavInput, look: LookInput) {
    dt = Math.min(dt, 1 / 20);
    this.elapsed += dt;
    const t = this.elapsed;

    // --- Look (yaw/pitch) ---
    const rotSpeed = 1.6;
    this.yaw -= look.x * rotSpeed * dt;
    this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch + look.y * rotSpeed * dt));

    // --- Horizontal walk, camera-relative (matches the web app's NAV stick) ---
    const walkSpeed = 8;
    const fwdX = -Math.sin(this.yaw);
    const fwdZ = -Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);
    const walkX = nav.x * rightX + nav.y * fwdX;
    const walkZ = nav.x * rightZ + nav.y * fwdZ;
    this.camX += walkX * walkSpeed * dt;
    this.camZ += walkZ * walkSpeed * dt;

    // Recenter the (finite) water/floor/cloud planes under the camera so the
    // wave field reads as infinite, exactly like the web app.
    this.ocean.position.set(this.camX, 0, this.camZ);
    this.floor.position.x = this.camX;
    this.floor.position.z = this.camZ;
    this.midClouds.position.x = this.camX;
    this.midClouds.position.z = this.camZ;
    this.skyClouds.position.x = this.camX;
    this.skyClouds.position.z = this.camZ;

    // --- Simplified buoyancy spring (see routes/index.tsx's animate() in
    // the web app for the full anticipatory-velocity version this
    // simplifies) ---
    const dirRad = (this.waveDirDeg * Math.PI) / 180;
    const surfaceY = waveHeight(
      this.camX,
      this.camZ,
      t,
      this.waveAmp,
      false,
      true,
      this.wavePeriod,
      this.wavePeak,
      dirRad,
      this.realistic,
      this.fftWaveComponents,
      this.dying,
      this.dyingWaveComponents,
      this.dyingAmp,
      t,
      this.waveFreq,
    );
    if (this.prevSurfaceY === null) this.prevSurfaceY = surfaceY;
    this.prevSurfaceY = surfaceY;

    const targetY = surfaceY + 1.6; // eye height above the surface
    const k = 18;
    const zeta = 0.9;
    const c = 2 * zeta * Math.sqrt(k);
    const ay = k * (targetY - this.camY) - c * this.camVY;
    this.camVY += ay * dt;
    this.camY += this.camVY * dt;

    this.camera.position.set(this.camX, this.camY, this.camZ);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.yaw);
    this.camera.rotateX(this.pitch);

    // --- Feed the shader uniforms ---
    this.oceanUniforms.uTime.value = t * this.waveSpeed;
    this.oceanUniforms.uAmp.value = this.waveAmp;
    this.oceanUniforms.uFreq.value = this.waveFreq;
    this.oceanUniforms.uPeriod.value = this.wavePeriod;
    this.oceanUniforms.uPeak.value = this.wavePeak;
    this.oceanUniforms.uDir.value = dirRad;
    this.oceanUniforms.uFft.value = this.realistic ? 1 : 0;
    this.oceanUniforms.uDying.value = this.dying ? 1 : 0;
    this.oceanUniforms.uDyingAmp.value = this.dyingAmp;
    this.oceanUniforms.uDyingTime.value = t;

    const depth = surfaceY - this.camY;
    const uw = depth > 0 ? Math.min(depth / 2.5, 1) : 0;
    this.oceanUniforms.uUnderwater.value += (uw - this.oceanUniforms.uUnderwater.value) * Math.min(1, dt * 6);
    this.floorUniforms.uUnderwater.value = this.oceanUniforms.uUnderwater.value;
    this.midCloudUniforms.uUnderwater.value = this.oceanUniforms.uUnderwater.value;
    this.skyCloudUniforms.uUnderwater.value = this.oceanUniforms.uUnderwater.value;
    this.skyUniforms.uUnderwater.value = this.oceanUniforms.uUnderwater.value;

    this.floorUniforms.uTime.value = t;
    this.midCloudUniforms.uTime.value = t;
    this.skyCloudUniforms.uTime.value = t;

    this.sky.position.copy(this.camera.position);

    const fog = this.scene.fog as THREE.FogExp2;
    fog.density = this.floorUniforms.uTurbidity.value * this.oceanUniforms.uUnderwater.value * 0.05;
  }

  dispose() {
    for (const mesh of [this.ocean, this.floor, this.midClouds, this.skyClouds, this.sky]) {
      mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material;
      mat.dispose();
    }
  }
}
