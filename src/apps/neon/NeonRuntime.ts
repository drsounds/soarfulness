import type { AppRuntime, FrameContext, SceneAppContext } from "@/core/apps/types";
import { NeonEdges } from "./NeonEdges";
import { setWaterPass } from "@/lib/waterPass";
import type { NeonSettings } from "./settings";

/**
 * NEON inside the render loop: (re)builds the edge lines whenever the loaded
 * scene changes, drops them when turned off, and recolors them every frame.
 * NEONACCENT (neonAccent.ts) is applied by the host when a scene loads.
 */
export class NeonRuntime implements AppRuntime<NeonSettings> {
  readonly edges: NeonEdges;

  constructor(ctx: SceneAppContext) {
    this.edges = new NeonEdges(ctx.scene);
  }

  /** The line material needs the viewport size in px. */
  setResolution(width: number, height: number) {
    this.edges.setResolution(width, height);
  }

  frame(f: FrameContext, s: Readonly<NeonSettings>) {
    const model = s.neonOn ? f.model : null;
    this.edges.setFilter(s.neonEdgeFilter);
    setWaterPass(f.waterLevel, f.camera.position.y);
    if (model !== this.edges.attachedTo) {
      if (model) this.edges.attach(model);
      else this.edges.detach();
    }
    if (!model) return;
    this.edges.update(f.time, {
      mode: s.neonMode,
      primary: s.neonPrimary,
      secondary: s.neonSecondary,
      tint: s.neonTint,
      tintAmount: s.neonTintAmount,
      strength: s.neonStrength,
      width: s.neonWidth,
      frequency: s.neonFrequency,
    });
  }

  dispose() {
    this.edges.dispose();
  }
}
