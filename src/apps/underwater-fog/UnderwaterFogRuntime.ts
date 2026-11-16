import type { AppRuntime, FrameContext } from "@/core/apps/types";
import { UnderwaterFogOverlay } from "./UnderwaterFogOverlay";
import type { UnderwaterFogSettings } from "./settings";
import { waterlineScreenFraction } from "./underwaterFog";

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return [0.6, 0.55, 0.45];
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * UNDERVATTENDIS inside the render loop: the fog gradient over the 3D view,
 * its top edge docked to the on-screen waterline VATTENLINJEAVSTÅND meters
 * ahead — it sinks as the camera rises above the water and climbs as it
 * dives. The overlay is a DOM element the host renders; hand it over with
 * setElement().
 */
export class UnderwaterFogRuntime implements AppRuntime<UnderwaterFogSettings> {
  readonly overlay = new UnderwaterFogOverlay();
  private el: HTMLElement | null = null;

  /** The overlay element (null while it isn't mounted). */
  setElement(el: HTMLElement | null) {
    if (el === this.el) return;
    this.el = el;
    this.overlay.reset();
  }

  frame(f: FrameContext, s: Readonly<UnderwaterFogSettings>) {
    const el = this.el;
    if (!s.underwaterFogOn || !el) return;
    const topFrac =
      waterlineScreenFraction(f.camera, f.waterLevel, s.underwaterFogDistance) +
      s.underwaterFogOffset;
    const ws = f.light.waterShallowColor;
    const wd = f.light.waterColor;
    const waterRgb: [number, number, number] = s.underwaterFogWaterColorAuto
      ? [ws.r * 0.45 + wd.r * 0.55, ws.g * 0.45 + wd.g * 0.55, ws.b * 0.45 + wd.b * 0.55]
      : hexToRgb(s.underwaterFogWaterColor);
    this.overlay.update(el, f.dt, topFrac, s.underwaterFogBlend, {
      fogColor: s.underwaterFogColor,
      fogOpacity: s.underwaterFogOpacity,
      waterColor: waterRgb,
      waterOpacity: s.underwaterFogWaterOpacity,
      intensity: s.underwaterFogIntensity,
      spread: s.underwaterFogSpread,
      curve: s.underwaterFogCurve,
      feather: s.underwaterFogFeather,
      visibility: s.underwaterFogSubmergedOnly ? Math.min(1, f.underwater * 3) : 1,
    });
  }

  dispose() {}
}
