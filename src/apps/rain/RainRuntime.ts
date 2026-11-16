import { getWindVector } from "@/apps/wind/wind";
import type { AppRuntime, FrameContext, SceneAppContext } from "@/core/apps/types";
import { Rainfall } from "./Rainfall";
import type { RainSettings } from "./settings";

/**
 * REGN inside the render loop: drops follow the camera like the snowflakes;
 * the sound keeps playing (muffled) under water.
 */
export class RainRuntime implements AppRuntime<RainSettings> {
  readonly rainfall: Rainfall;

  constructor(ctx: SceneAppContext) {
    this.rainfall = new Rainfall(ctx.scene);
  }

  frame(f: FrameContext, s: Readonly<RainSettings>) {
    if (!s.rainOn) {
      this.rainfall.hide();
      return;
    }
    // VIND: the drops slant with the scene's combined wind; with no winds
    // on, the rain makes its own gentle wind.
    const wind = getWindVector();
    this.rainfall.setViewport(f.pixelRatio, f.pixelHeight);
    this.rainfall.update(
      f.time,
      f.dt,
      f.camera.position,
      {
        amount: s.rainAmount * (f.lowEnd ? 0.5 : 1),
        intensity: s.rainIntensity,
        dropLength: s.rainDropLength,
        dropSize: s.rainDropSize,
        opacity: s.rainOpacity,
        color: s.rainColor,
        daylight: 1 - f.night,
        splashes: s.rainSplashesOn,
        waterLevel: f.waterLevel,
        underwater: f.underwater,
        wind: wind.speed > 0.01 ? wind : null,
      },
      { on: s.rainSoundOn && f.audioOn, volume: s.rainVolume },
    );
  }

  dispose() {
    this.rainfall.dispose();
  }
}
