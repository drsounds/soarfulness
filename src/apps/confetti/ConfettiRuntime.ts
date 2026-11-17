import type { AppRuntime, FrameContext, SceneAppContext } from "@/core/apps/types";
import { Confetti } from "./Confetti";
import type { ConfettiSettings } from "./settings";

/** KONFETTI inside the render loop: pieces follow the camera like snow. */
export class ConfettiRuntime implements AppRuntime<ConfettiSettings> {
  readonly confetti: Confetti;

  constructor(ctx: SceneAppContext) {
    this.confetti = new Confetti(ctx.scene);
  }

  frame(f: FrameContext, s: Readonly<ConfettiSettings>) {
    if (!s.confettiOn) {
      this.confetti.hide();
      return;
    }
    this.confetti.setPixelRatio(f.pixelRatio);
    this.confetti.update(f.time, f.dt, f.camera.position, {
      amount: s.confettiAmount * (f.lowEnd ? 0.5 : 1),
      intensity: s.confettiIntensity,
      flutter: s.confettiFlutter,
      palette: s.confettiPalette,
      waterLevel: f.waterLevel,
      underwater: f.underwater,
    });
  }

  shutdown() {
    this.confetti.hide();
  }

  dispose() {
    this.confetti.dispose();
  }
}
