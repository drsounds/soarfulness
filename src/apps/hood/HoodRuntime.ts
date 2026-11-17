import type { AppRuntime, FrameContext, SceneAppContext } from "@/core/apps/types";
import * as THREE from "three";
import { setClothingBuoyancyOffset } from "./buoyancy";
import { FloatSuit } from "./FloatSuit";
import { Hood, HOOD_STYLE_AIR, type HoodConfig } from "./Hood";
import { HoodMesh3D } from "./HoodMesh";
import { HOOD_MAX_LAYERS, type HoodLayer } from "./hoodLayers";
import type { HoodSettings } from "./settings";

/** Layer 1 of the hood, from the flat hood* settings. */
export function hoodLayerFromSettings(s: Readonly<HoodSettings>): HoodLayer {
  return {
    on: s.hoodLayer1On,
    height: s.hoodHeight,
    opening: s.hoodOpening,
    openingWidth: s.hoodOpeningWidth,
    color: s.hoodColor,
    metallic: s.hoodMetallic,
    motion: s.hoodMotion,
    lowerOn: s.hoodLowerOn,
    lowerHeight: s.hoodLowerHeight,
    zipperOn: s.hoodZipperOn,
    waterOn: s.hoodWaterOn,
    waterLevel: s.hoodWaterLevel,
    drop: s.hoodDrop,
    weight: s.hoodWeight,
    wrinkles: s.hoodWrinkles,
    darkness: s.hoodDarkness,
    roundness: s.hoodRoundness,
    style: s.hoodStyle,
    puffSize: s.hoodPuffSize,
    puffHeight: s.hoodPuffHeight,
    cuff: s.hoodCuffOn,
    cuffHeight: s.hoodCuffHeight,
    cuffSize: s.hoodCuffSize,
    real3d: s.hoodReal3d,
    separate: s.hoodSeparate,
    waterTint: s.hoodWaterTint,
    dripping: s.hoodDripping,
    pullBack: s.hoodPullBack,
    neckBack: s.hoodNeckBack,
    lengthOn: s.hoodLengthOn,
    length: s.hoodLength,
    puff3d: s.hoodPuff3d,
    zipperOpen: s.hoodZipperOpen,
    floating: s.hoodFloating,
    hoodTop: s.hoodTopPart,
    collarUp: s.hoodCollarUp,
    viewShadow: s.hoodViewShadow,
    cuffCustom: s.hoodCuffCustom,
    cuffColor: s.hoodCuffColor,
    cuffMetallic: s.hoodCuffMetallic,
    cuffMaterial: s.hoodCuffMaterial,
    hanging: s.hoodHanging,
    waterCalm: s.hoodWaterCalm,
    cuffTop: s.hoodCuffTop,
    zipperFixed: s.hoodZipperFixed,
    zipperPullOut: s.hoodZipperPullOut,
    reflectLight: s.hoodReflectLight,
    puffThickness: s.hoodPuffThickness,
    puffInflate: s.hoodPuffInflate,
  };
}

/** Hood-wide values every layer's HoodConfig shares this frame. */
export type HoodShared = { rotateHead: number; floatThreshold: number; suitColor: string };

/** What one Hood mesh needs this frame to draw layer `l`. */
export function hoodConfigFromLayer(l: HoodLayer, f: FrameContext, g: HoodShared): HoodConfig {
  return {
    rotateHead: g.rotateHead,
    floatThreshold: g.floatThreshold,
    suitColor: g.suitColor,
    height: l.height,
    opening: l.opening,
    openingWidth: l.openingWidth,
    color: l.color,
    metallic: l.metallic,
    motion: l.motion,
    lower: l.lowerOn,
    lowerHeight: l.lowerHeight,
    zipper: l.zipperOn,
    waterInside: l.waterOn,
    waterInsideLevel: l.waterLevel,
    drop: l.drop,
    weight: l.weight,
    wrinkles: l.wrinkles,
    darkness: l.darkness,
    roundness: l.roundness,
    style: l.style,
    puffSize: l.puffSize,
    puffHeight: l.puffHeight,
    cuff: l.cuff,
    cuffHeight: l.cuffHeight,
    cuffSize: l.cuffSize,
    real3d: l.real3d,
    separate: l.separate,
    waterTint: l.waterTint,
    dripping: l.dripping,
    pullBack: l.pullBack,
    neckBack: l.neckBack,
    lengthOn: l.lengthOn,
    length: l.length,
    puff3d: l.puff3d,
    zipperOpen: l.zipperOpen,
    floating: l.floating,
    hoodTop: l.hoodTop,
    collarUp: l.collarUp,
    viewShadow: l.viewShadow,
    cuffCustom: l.cuffCustom,
    cuffColor: l.cuffColor,
    cuffMetallic: l.cuffMetallic,
    cuffMaterial: l.cuffMaterial,
    hanging: l.hanging,
    waterCalm: l.waterCalm,
    cuffTop: l.cuffTop,
    zipperFixed: l.zipperFixed,
    zipperPullOut: l.zipperPullOut,
    reflectLight: l.reflectLight,
    puffThickness: l.puffThickness,
    puffInflate: l.puffInflate,
    eyeAboveWater: f.eyeAboveWater,
    skyColor: f.light.skyColor,
    horizonColor: f.light.horizonColor,
    waterColor: f.light.waterColor,
    sunColor: f.light.sunColor,
    sunDir: f.light.sunDir,
    underwater: f.underwater,
  };
}

/**
 * HUVA inside the render loop: a hood around the bather, framing the view.
 * One Hood mesh per possible layer; layer 1 comes from the flat hood*
 * settings, layers 2+ from hoodExtraLayers.
 */
export class HoodRuntime implements AppRuntime<HoodSettings> {
  readonly hoods: Hood[];
  /** 3D-TYG: the same layers as real geometry, used instead of the flat Hood. */
  readonly meshes: HoodMesh3D[];
  /** FLYTDRÄKT: always worn innermost while HUVA is on. */
  readonly suit: FloatSuit;
  private buoy = 0;
  private readonly fwd = new THREE.Vector3();

  constructor(ctx: SceneAppContext) {
    this.suit = new FloatSuit(ctx.scene);
    this.hoods = Array.from({ length: HOOD_MAX_LAYERS }, (_, i) => new Hood(ctx.scene, i));
    this.meshes = Array.from({ length: HOOD_MAX_LAYERS }, (_, i) => new HoodMesh3D(ctx.scene, i));
  }

  frame(f: FrameContext, s: Readonly<HoodSettings>) {
    const layers: HoodLayer[] = s.hoodOn ? [hoodLayerFromSettings(s), ...s.hoodExtraLayers] : [];
    // ROTERA HUVUD: how far the head looks down (the body stays level).
    let rotateHead = 0;
    if (s.hoodOn && s.hoodRotateHead) {
      this.fwd.set(0, 0, -1).applyQuaternion(f.camera.quaternion);
      rotateHead = Math.min(1.3, Math.max(0, -Math.asin(THREE.MathUtils.clamp(this.fwd.y, -1, 1))));
    }
    const shared: HoodShared = {
      rotateHead,
      floatThreshold: s.hoodFloatThreshold,
      suitColor: s.hoodSuitColor,
    };
    this.hoods.forEach((h, i) => {
      const l = layers[i];
      const mesh = this.meshes[i];
      if (!l || !l.on) {
        h.hide();
        mesh.hide();
      } else if (l.real3d) {
        h.hide();
        mesh.update(f.time, f.camera, hoodConfigFromLayer(l, f, shared), {
          bodyFrame: s.hoodRotateHead,
          suitColor: s.hoodSuitColor,
        });
      } else {
        mesh.hide();
        h.update(f.time, f.dt, f.camera, hoodConfigFromLayer(l, f, shared));
      }
    });
    if (s.hoodOn) {
      this.suit.update(f.camera, {
        color: s.hoodSuitColor,
        leg: s.hoodSuitLeg,
        rotateHead,
        skyColor: f.light.skyColor,
        horizonColor: f.light.horizonColor,
        sunColor: f.light.sunColor,
        waterColor: f.light.waterColor,
        underwater: f.underwater,
      });
    } else this.suit.hide();

    // KLÄDER PÅVERKAR FLYTFÖRMÅGA: the float suit lifts, each worn layer
    // drags down by its weight (more with water inside), padded styles hold
    // a little air. Eased so changes settle in over a couple of seconds.
    let target = 0;
    if (s.hoodOn && s.hoodClothesBuoyancy) {
      target = 0.03;
      for (const l of layers) {
        if (!l.on) continue;
        const air = HOOD_STYLE_AIR[l.style] ?? 0.35;
        target -= 0.012 + 0.035 * l.weight - 0.02 * air + (l.waterOn ? 0.01 : 0);
      }
    }
    this.buoy += (target - this.buoy) * (1 - Math.exp(-Math.max(f.dt, 0) / 1.5));
    setClothingBuoyancyOffset(this.buoy);
  }

  shutdown() {
    for (const h of this.hoods) h.hide();
    for (const m of this.meshes) m.hide();
    this.suit.hide();
    this.buoy = 0;
    setClothingBuoyancyOffset(0);
  }

  dispose() {
    for (const h of this.hoods) h.dispose();
    for (const m of this.meshes) m.dispose();
    this.suit.dispose();
    setClothingBuoyancyOffset(0);
  }
}
