import type { AppRuntime, FrameContext, SceneAppContext } from "@/core/apps/types";
import { SnowCover } from "./SnowCover";
import { Snowfall } from "./Snowfall";
import type { SnowSettings } from "./settings";

/**
 * SNÖ inside the render loop: the falling flakes and SNÖTÄCKE.
 *
 * The cover is eased early in the frame (updateCover) because the host's
 * backdrop dome reads `cover.cover` / `cover.uLight` before the scene
 * objects are updated; the flakes and the model patching run in frame().
 */
export class SnowRuntime implements AppRuntime<SnowSettings> {
  readonly snowfall: Snowfall;
  readonly cover = new SnowCover();

  constructor(ctx: SceneAppContext) {
    this.snowfall = new Snowfall(ctx.scene);
  }

  /** SNÖTÄCKE settles over a few seconds; `night` is 0 (day) .. 1 (night). */
  updateCover(dt: number, night: number, s: Readonly<SnowSettings>) {
    this.cover.update(dt, s.snowCoverOn ? s.snowCoverStrength : 0);
    this.cover.setDaylight(1 - night);
  }

  frame(f: FrameContext, s: Readonly<SnowSettings>) {
    // Flakes follow the camera.
    if (s.snowOn) {
      this.snowfall.setPixelRatio(f.pixelRatio);
      this.snowfall.update(f.time, f.dt, f.camera.position, {
        amount: s.snowAmount * (f.lowEnd ? 0.5 : 1),
        intensity: s.snowIntensity,
        waterLevel: f.waterLevel,
        underwater: f.underwater,
      });
    } else {
      this.snowfall.hide();
    }
    // SNÖTÄCKE patches the loaded scene's materials once per model (the
    // shared uniform does the rest).
    const model = this.cover.cover > 0.001 ? f.model : null;
    if (model && model !== this.cover.attachedTo) this.cover.attach(model);
    else if (!f.model && this.cover.attachedTo) this.cover.detach();
  }

  dispose() {
    this.snowfall.dispose();
  }
}
