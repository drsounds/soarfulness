import type * as THREE from "three";
import type { AppRuntime, FrameContext, SceneAppContext } from "@/core/apps/types";
import { Aurora } from "./Aurora";
import type { AuroraSettings } from "./settings";

/**
 * NORRSKEN inside the render loop: owns the Aurora curtains, turns the
 * persisted settings into an AuroraConfig every frame and hides them while
 * off. The host (routes/index.tsx) copies `glow` / `glowElevation` into the
 * ocean shader so the aurora is reflected in the water.
 */
export class AuroraRuntime implements AppRuntime<AuroraSettings> {
  readonly aurora: Aurora;

  constructor(ctx: SceneAppContext) {
    this.aurora = new Aurora(ctx.scene);
  }

  /** Average glow color × brightness, for the water's reflection. */
  get glow(): THREE.Color {
    return this.aurora.glow;
  }

  get glowElevation(): number {
    return this.aurora.glowElevation;
  }

  frame(f: FrameContext, s: Readonly<AuroraSettings>) {
    // Fades in with the night (DYGNSBYTE's curve) unless SYNS PÅ DAGEN is on.
    if (!s.auroraOn) {
      this.aurora.hide();
      return;
    }
    this.aurora.update(f.dt, f.camera.position, {
      intensity: s.auroraIntensity,
      amount: s.auroraAmount,
      speed: s.auroraSpeed,
      height: s.auroraHeight,
      palette: s.auroraPalette,
      customMain: s.auroraColorMain,
      customTop: s.auroraColorTop,
      night: f.night,
      showInDaylight: s.auroraDaylightOn,
      underwater: f.underwater,
    });
  }

  dispose() {
    this.aurora.dispose();
  }
}
