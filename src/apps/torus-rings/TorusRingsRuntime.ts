import type { AppRuntime, FrameContext, SceneAppContext } from "@/core/apps/types";
import { TorusRingField } from "./TorusRingField";
import { TORUS_RING_TEXTURES, type TorusRingsSettings } from "./settings";

/**
 * BADRINGAR in the render loop: owns the ring field. The host pushes settings
 * into it with `configure` whenever they (or LOW GRAPHICS MODE) change, and
 * frame() recomputes the active grid cells around the camera.
 */
export class TorusRingsRuntime implements AppRuntime<TorusRingsSettings> {
  private readonly field: TorusRingField;
  private on = true;
  private last: { s: Readonly<TorusRingsSettings>; low: boolean } | null = null;

  constructor(ctx: SceneAppContext) {
    // Placeholder config: the host calls configure() right after creation.
    this.field = new TorusRingField(ctx.scene, {
      enabled: false,
      radius: 0.6,
      tube: 0.02,
      scale: 20,
      opacity: 0.5,
      color: 0xffffff,
      textureUrl: null,
      gapXZ: 2,
      gapY: 13.58,
      verticalCount: 5,
      viewDistance: 26,
      fadeDistance: 8,
    });
  }

  /**
   * LOW GRAPHICS MODE turns the whole field off (extra geometry + lit
   * MeshStandardMaterial draw calls, plus its own optional texture).
   */
  configure(s: Readonly<TorusRingsSettings>, lowGraphicsMode: boolean) {
    this.last = { s, low: lowGraphicsMode };
    this.field.setConfig({
      enabled: this.on && s.torusRingsOn && !lowGraphicsMode,
      radius: s.torusRadius,
      tube: s.torusTube,
      scale: s.torusScale,
      opacity: s.torusOpacity,
      textureUrl: lowGraphicsMode ? null : (TORUS_RING_TEXTURES[s.torusTextureIdx]?.url ?? null),
      gapXZ: s.torusCellSize,
      gapY: s.torusVerticalSpacing,
      verticalCount: s.torusVerticalCount,
      viewDistance: s.torusViewDistance,
      fadeDistance: s.torusFadeDistance,
    });
  }

  startup() {
    this.on = true;
    if (this.last) this.configure(this.last.s, this.last.low);
  }

  shutdown() {
    this.on = false;
    if (this.last) this.configure(this.last.s, this.last.low);
  }

  frame(f: FrameContext) {
    this.field.update(f.camera.position, f.dt);
  }

  dispose() {
    this.field.dispose();
  }
}
