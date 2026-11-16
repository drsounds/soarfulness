import type { AppRuntime, FrameContext, SceneAppContext } from "@/core/apps/types";
import { isUserSceneId } from "@/lib/userScenes";
import { StringLightsFx } from "./StringLightsFx";

/**
 * LJUSSLINGOR inside the render loop: the current scene's string lights,
 * animated. The strings come from the app's own store (stringLights.ts), not
 * from the persisted settings, so frame() takes no settings slice.
 */
export class StringLightsRuntime implements AppRuntime {
  readonly fx: StringLightsFx;

  constructor(ctx: SceneAppContext) {
    this.fx = new StringLightsFx(ctx.scene);
  }

  frame(f: FrameContext) {
    this.fx.update(f.time, f.camera, {
      sceneId: f.sceneId,
      waterY: f.waterLevel,
      night: f.night,
      viewportHeight: f.viewportHeight,
      model: f.model,
      modelImported: isUserSceneId(f.sceneId),
      extraRoots: f.extraRoots,
    });
  }

  dispose() {
    this.fx.dispose();
  }
}
