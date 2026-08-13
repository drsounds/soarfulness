import { useEffect, useRef } from "react";
import type { RefObject } from "react";

// Optional "swimming goggles" effect — see gogglesOn/gogglesBlur in
// settingsShared.ts's Persisted type, dialed in from the KAMERA settings
// tab (SettingsPanel.tsx). Rendered in routes/index.tsx right above the
// three.js canvas and below every HUD element, so it reads as something
// sitting on the camera lens rather than smearing the on-screen controls.
//
// Two independent layers:
//  - a whole-screen backdrop blur standing in for slightly fogged/misted
//    goggles (skipped entirely when gogglesBlur is 0, so "blur" really is
//    optional on top of the droplets)
//  - a scatter of water droplets that spawn above the on-screen waterline,
//    slide straight down like gravity, and vanish once they reach it —
//    driven by an imperative rAF loop (not React state) so 20-odd elements
//    can move every frame without triggering a re-render each time.

const DROPLET_COUNT = 22;
// Percent of screen height fallen per second — kept slow for the app's
// generally calm feel, with enough spread that drops don't look lockstep.
const FALL_PCT_MIN = 3;
const FALL_PCT_MAX = 11;

type Droplet = {
  el: HTMLDivElement | null;
  xPct: number;
  yPct: number;
  size: number;
  elongated: boolean;
  rotate: number;
  fallPctPerSec: number;
  visible: boolean;
};

function randomSize() {
  return 6 + Math.random() * 30;
}

// Vertical screen fraction (0 = top, 1 = bottom) where the level horizon —
// i.e. the water's surface line — falls, given the camera's up/down look
// pitch (radians, positive = looking up) and its vertical field of view
// (degrees). routes/index.tsx always builds the camera's orientation from
// an exactly-level lookAt() and then applies rotateX(pitch) on top of that,
// so pitch alone is the tilt away from a level, horizon-centered view.
function horizonFraction(pitchRad: number, fovDeg: number): number {
  const halfFovRad = (fovDeg * Math.PI) / 360;
  const t = Math.tan(halfFovRad);
  if (t <= 0.0001) return 0.5;
  const ndcY = -Math.tan(pitchRad) / t;
  return Math.max(0, Math.min(1, (1 - ndcY) / 2));
}

// (Re)randomizes a droplet and places it somewhere in the on-screen region
// that's currently above the waterline.
function respawnAboveSurface(d: Droplet, horizonPct: number) {
  d.size = randomSize();
  d.elongated = d.size > 18 && Math.random() < 0.5;
  d.rotate = (Math.random() - 0.5) * 24;
  d.fallPctPerSec = FALL_PCT_MIN + Math.random() * (FALL_PCT_MAX - FALL_PCT_MIN);
  d.xPct = Math.random() * 100;
  // Stay a little clear of the waterline so it doesn't vanish the instant
  // it appears.
  d.yPct = Math.random() * Math.max(0, horizonPct - 4);
  d.visible = true;
}

function applyDropletShape(d: Droplet) {
  if (!d.el) return;
  const height = d.elongated ? d.size * 1.7 : d.size;
  d.el.style.display = "block";
  d.el.style.width = `${d.size}px`;
  d.el.style.height = `${height}px`;
  d.el.style.borderRadius = d.elongated ? "50% 50% 45% 45% / 62% 62% 38% 38%" : "50%";
  d.el.style.transform = `translate(-50%, -50%) rotate(${d.rotate}deg)`;
  d.el.style.left = `${d.xPct}%`;
  d.el.style.top = `${d.yPct}%`;
}

export function GogglesOverlay({
  blur,
  pitchRef,
  camFovRef,
  underwaterRef,
}: {
  blur: number;
  pitchRef: RefObject<number>;
  camFovRef: RefObject<number>;
  underwaterRef: RefObject<Record<string, { value: unknown }> | null>;
}) {
  // Droplet state lives in a ref, not React state — it's mutated every
  // animation frame and must never itself trigger a re-render. Lazily
  // seeded once per mount (i.e. once per GOGGLES toggle-on).
  const dropletsRef = useRef<Droplet[]>([]);
  if (dropletsRef.current.length === 0) {
    for (let i = 0; i < DROPLET_COUNT; i++) {
      dropletsRef.current.push({
        el: null,
        xPct: 0,
        yPct: 0,
        size: randomSize(),
        elongated: false,
        rotate: 0,
        fallPctPerSec: FALL_PCT_MIN,
        visible: false, // first tick places each one once the horizon is known
      });
    }
  }

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const pitch = pitchRef.current ?? 0;
      const fov = camFovRef.current ?? 65;
      const underwaterVal =
        (underwaterRef.current?.uUnderwater?.value as number | undefined) ?? 0;
      // Fully submerged: there's no "above the surface" left on screen at
      // all, so no droplets — matches the goggles just showing open water.
      const horizonPct = underwaterVal > 0.85 ? 0 : horizonFraction(pitch, fov) * 100;

      for (const d of dropletsRef.current) {
        if (!d.el) continue;
        if (d.visible) {
          d.yPct += d.fallPctPerSec * dt;
          if (d.yPct >= horizonPct) {
            d.visible = horizonPct > 4;
            if (d.visible) {
              respawnAboveSurface(d, horizonPct);
              applyDropletShape(d);
            } else {
              d.el.style.display = "none";
            }
          } else {
            d.el.style.top = `${d.yPct}%`;
          }
        } else if (horizonPct > 4) {
          respawnAboveSurface(d, horizonPct);
          applyDropletShape(d);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pitchRef, camFovRef, underwaterRef]);

  const blurPx = blur * 5;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {blur > 0 && (
        <div
          className="absolute inset-0"
          style={{
            backdropFilter: `blur(${blurPx.toFixed(2)}px) saturate(1.05)`,
            WebkitBackdropFilter: `blur(${blurPx.toFixed(2)}px) saturate(1.05)`,
          }}
        />
      )}
      {dropletsRef.current.map((d, i) => (
        <div
          key={i}
          ref={(el) => {
            d.el = el;
          }}
          className="absolute"
          style={{
            display: "none",
            background:
              "radial-gradient(circle at 32% 26%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.12) 10%, rgba(255,255,255,0.02) 45%, rgba(190,220,255,0.1) 75%, transparent 100%)",
            boxShadow:
              "inset 0 -2px 3px rgba(0,0,0,0.18), inset 0 2px 2px rgba(255,255,255,0.45), 0 1px 2px rgba(0,0,0,0.12)",
            backdropFilter: "blur(1.5px)",
            WebkitBackdropFilter: "blur(1.5px)",
          }}
        />
      ))}
    </div>
  );
}
