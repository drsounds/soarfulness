import * as THREE from "three";
import type { AppRuntime, SceneAppContext } from "@/core/apps/types";
import { createCloud3DLayer, type Cloud3DLayer } from "./clouds3d";
import type { Clouds3dSettings } from "./settings";

/**
 * What the host tells the puff layers each frame. The flat decks the puffs
 * sit on (and the water column they sit in) belong to the core app, so the
 * host reads them off its own state and hands them over here.
 */
export type Clouds3dInputs = {
  /** Seconds since the page loaded (animation clock). */
  time: number;
  dt: number;
  /** Fade speed shared with the flat decks (MOLN TONING). */
  fadeSpeed: number;
  /** Camera position; the layers follow it in x/z. */
  camX: number;
  camZ: number;
  /** Water column: depth in meters and the surface's world y. */
  effectiveDepth: number;
  levelY: number;
  /** Mid deck height as a 0..1 fraction of the water column. */
  midHeight: number;
  /** World y of the flat sky cloud deck. */
  skyY: number;
  /** Which flat decks are on (the bottom one only while BOTTEN is MOLN). */
  bottomDeckOn: boolean;
  midDeckOn: boolean;
  skyDeckOn: boolean;
  sunDir: THREE.Vector3;
  turbidity: number;
  underwater: number;
  /** Deep-water color the puffs fog into. */
  fogColor: THREE.Color;
};

/**
 * 3D-MOLN: three volumetric puff layers (seafloor, mid-water, sky), each
 * following its flat deck's altitude and on/off state. The two underwater
 * layers are meter-scale (the water column is only tens of meters deep); the
 * sky layer is kilometer-scale.
 */
export class Clouds3dRuntime implements AppRuntime<Clouds3dSettings> {
  private readonly scene: THREE.Scene;
  private readonly sunDir = new THREE.Vector3(0, 1, 0);
  private readonly bottom: Cloud3DLayer;
  private readonly mid: Cloud3DLayer;
  private readonly sky: Cloud3DLayer;
  private readonly layers: Cloud3DLayer[];
  private readonly fade = [0, 0, 0];

  constructor(ctx: SceneAppContext) {
    this.scene = ctx.scene;
    this.bottom = createCloud3DLayer(
      {
        tileSize: 600,
        clusterCount: 260,
        puffsPerCluster: 9,
        clusterRadius: [2, 7],
        puffRadius: [1.2, 3.5],
        seed: 11,
      },
      this.sunDir,
    );
    this.mid = createCloud3DLayer(
      {
        tileSize: 600,
        clusterCount: 220,
        puffsPerCluster: 9,
        clusterRadius: [2, 6],
        puffRadius: [1, 3],
        seed: 23,
      },
      this.sunDir,
    );
    this.sky = createCloud3DLayer(
      {
        tileSize: 16000,
        clusterCount: 260,
        puffsPerCluster: 10,
        clusterRadius: [120, 420],
        puffRadius: [45, 150],
        seed: 37,
      },
      this.sunDir,
    );
    this.sky.uniforms.uThickness.value = 260;
    this.layers = [this.bottom, this.mid, this.sky];
    for (const layer of this.layers) this.scene.add(layer.mesh);
  }

  update(i: Clouds3dInputs, s: Readonly<Clouds3dSettings>) {
    const targets = [
      i.bottomDeckOn && s.bottomClouds3d,
      i.midDeckOn && s.midClouds3d,
      i.skyDeckOn && s.skyClouds3d,
    ];
    const fadeStep = Math.min(1, i.dt * i.fadeSpeed);
    this.sunDir.copy(i.sunDir);
    // Underwater puffs: base on the floor / mid deck, height a fraction of
    // the water column so they never poke through the surface.
    const midFrac = Math.max(0.05, Math.min(0.95, i.midHeight));
    const d = i.effectiveDepth;
    this.bottom.uniforms.uCenter.value.set(i.camX, -d + i.levelY, i.camZ);
    this.bottom.uniforms.uThickness.value = d * 0.25;
    this.bottom.uniforms.uRadiusScale.value = Math.min(1, d / 20);
    this.mid.uniforms.uCenter.value.set(i.camX, -d + d * midFrac - d * 0.06 + i.levelY, i.camZ);
    this.mid.uniforms.uThickness.value = d * 0.12;
    this.mid.uniforms.uRadiusScale.value = Math.min(1, d / 20);
    this.sky.uniforms.uCenter.value.set(i.camX, i.skyY - 60, i.camZ);
    this.bottom.uniforms.uScroll.value.set(i.time * 0.6, i.time * 0.4);
    this.mid.uniforms.uScroll.value.set(i.time * 1.6, i.time * 1.0);
    this.sky.uniforms.uScroll.value.set(i.time * 0.8, i.time * 0.52);
    for (let n = 0; n < this.layers.length; n++) {
      const layer = this.layers[n];
      this.fade[n] += ((targets[n] ? 1 : 0) - this.fade[n]) * fadeStep;
      const lu = layer.uniforms;
      lu.uOpacity.value = this.fade[n];
      lu.uTurbidity.value = i.turbidity;
      lu.uUnderwater.value = i.underwater;
      lu.uFogColor.value.copy(i.fogColor);
      layer.mesh.visible = this.fade[n] > 0.003;
    }
  }

  dispose() {
    for (const layer of this.layers) {
      this.scene.remove(layer.mesh);
      layer.dispose();
    }
  }
}
