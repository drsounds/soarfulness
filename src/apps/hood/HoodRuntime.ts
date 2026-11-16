import type { AppRuntime, FrameContext, SceneAppContext } from "@/core/apps/types";
import { Hood, type HoodConfig } from "./Hood";
import { HOOD_MAX_LAYERS, type HoodLayer } from "./hoodLayers";
import type { HoodSettings } from "./settings";

/** Layer 1 of the hood, from the flat hood* settings. */
export function hoodLayerFromSettings(s: Readonly<HoodSettings>): HoodLayer {
  return {
    on: true,
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

/** What one Hood mesh needs this frame to draw layer `l`. */
export function hoodConfigFromLayer(l: HoodLayer, f: FrameContext): HoodConfig {
  return {
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

  constructor(ctx: SceneAppContext) {
    this.hoods = Array.from({ length: HOOD_MAX_LAYERS }, (_, i) => new Hood(ctx.scene, i));
  }

  frame(f: FrameContext, s: Readonly<HoodSettings>) {
    const layers: HoodLayer[] = s.hoodOn ? [hoodLayerFromSettings(s), ...s.hoodExtraLayers] : [];
    this.hoods.forEach((h, i) => {
      const l = layers[i];
      if (!l || !l.on) h.hide();
      else h.update(f.time, f.dt, f.camera, hoodConfigFromLayer(l, f));
    });
  }

  dispose() {
    for (const h of this.hoods) h.dispose();
  }
}
