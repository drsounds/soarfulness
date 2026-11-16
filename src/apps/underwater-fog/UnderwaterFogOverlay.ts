import {
  underwaterFogGradient,
  type UnderwaterFogBlend,
  type UnderwaterFogParams,
} from "./underwaterFog";

// UNDERVATTENDIS: the overlay element driver. The gradient math and the
// waterline projection live in underwaterFog.ts.

/** Drives the overlay element; only writes styles when they changed. */
export class UnderwaterFogOverlay {
  private lastBg = "";
  private lastBlend = "";
  private smoothedTop: number | null = null;

  update(
    el: HTMLElement,
    dt: number,
    targetTopFrac: number,
    blend: UnderwaterFogBlend,
    params: UnderwaterFogParams,
  ) {
    // A light smoothing so bobbing on waves doesn't make the edge jitter,
    // while still tracking dives and look changes closely.
    if (this.smoothedTop === null || Math.abs(targetTopFrac - this.smoothedTop) > 0.5) {
      this.smoothedTop = targetTopFrac;
    } else {
      this.smoothedTop += (targetTopFrac - this.smoothedTop) * Math.min(1, dt * 18);
    }
    // Quantize to avoid restyling for sub-pixel movement.
    const top = Math.round(this.smoothedTop * 2000) / 2000;
    const bg = underwaterFogGradient(top, params);
    if (bg !== this.lastBg) {
      el.style.background = bg;
      this.lastBg = bg;
    }
    if (blend !== this.lastBlend) {
      el.style.mixBlendMode = blend;
      this.lastBlend = blend;
    }
  }

  reset() {
    this.lastBg = "";
    this.lastBlend = "";
    this.smoothedTop = null;
  }
}
