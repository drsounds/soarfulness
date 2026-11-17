import type * as THREE from "three";
import type { AppRuntime, FrameContext, SceneAppContext } from "@/core/apps/types";
import { Fireworks } from "./Fireworks";
import type { FireworksSettings } from "./settings";

/**
 * FYRVERKERI inside the render loop: launches, simulates and sounds the
 * show. The host copies `lightPos` / `lightCol` (FIREWORKS_LIGHTS entries)
 * into the ocean shader so the bursts reflect on the waves; the scene
 * lights are the Fireworks' own.
 */
export class FireworksRuntime implements AppRuntime<FireworksSettings> {
  readonly fireworks: Fireworks;

  constructor(ctx: SceneAppContext) {
    this.fireworks = new Fireworks(ctx.scene);
  }

  get lightPos(): readonly THREE.Vector4[] {
    return this.fireworks.lightPos;
  }

  get lightCol(): readonly THREE.Vector3[] {
    return this.fireworks.lightCol;
  }

  frame(f: FrameContext, s: Readonly<FireworksSettings>) {
    const on = s.fireworksOn;
    // Keeps running after it is switched off until the last burst has faded.
    if (!on && !this.fireworks.busy) {
      this.fireworks.audio.update(false, 0, 0);
      return;
    }
    this.fireworks.update(f.dt, f.camera, on, {
      intensity: s.fireworksIntensity,
      rate: s.fireworksRate,
      distance: s.fireworksDistance,
      lightStrength: s.fireworksLightsOn ? s.fireworksLightStrength : 0,
      waterLevel: f.waterLevel,
      underwater: f.underwater,
      pixelHeight: f.pixelHeight,
      lowEnd: f.lowEnd,
      soundOn: s.fireworksSoundOn && f.audioOn,
      volume: s.fireworksVolume,
    });
  }

  shutdown() {
    this.fireworks.clear();
    this.fireworks.audio.update(false, 0, 0);
  }

  dispose() {
    this.fireworks.dispose();
  }
}
