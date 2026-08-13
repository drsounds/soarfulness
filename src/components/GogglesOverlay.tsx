import { useEffect, useRef } from "react";
import type { RefObject } from "react";

// Optional "swimming goggles" effect — see gogglesOn/gogglesBlur/gogglesLoop
// in settingsShared.ts's Persisted type, dialed in from the KAMERA settings
// tab (SettingsPanel.tsx). Rendered in routes/index.tsx right above the
// three.js canvas and below every HUD element, so it reads as something
// sitting on the camera lens rather than smearing the on-screen controls.
//
// Two independent layers:
//  - a whole-screen backdrop blur standing in for slightly fogged/misted
//    goggles (skipped entirely when gogglesBlur is 0, so "blur" really is
//    optional on top of the droplets)
//  - a scatter of water droplets that fall straight down like gravity,
//    driven by an imperative rAF loop (not React state) so ~20 elements can
//    move every frame without triggering a re-render each time. By default
//    each droplet fades out as it nears the on-screen waterline and is only
//    recycled once fully invisible, so nothing visibly pops; with
//    gogglesLoop on, the waterline is ignored entirely and droplets just
//    keep falling, wrapping from the top once safely off-screen, for an
//    unbroken continuous stream.

const DROPLET_COUNT = 22;
// Percent of screen height fallen per second — kept slow for the app's
// generally calm feel, with enough spread that drops don't look lockstep.
const FALL_PCT_MIN = 3;
const FALL_PCT_MAX = 11;
// How many percentage-points of screen height a droplet spends fading from
// fully opaque to invisible before it reaches the waterline (non-loop only).
const FADE_ZONE_PCT = 14;
// Underwater uniform value (0-1) at which droplets are fully faded out —
// ramped smoothly rather than an on/off cutoff, so diving/surfacing never
// pops the whole scatter of droplets at once.
const UNDERWATER_FADE_RANGE = 0.6;

type Droplet = {
  el: HTMLDivElement | null;
  xPct: number;
  yPct: number;
  size: number;
  elongated: boolean;
  rotate: number;
  fallPctPerSec: number;
};

function randomSize() {
  return 6 + Math.random() * 30;
}

// Re-rolls everything about a droplet except its current vertical position.
function randomizeShape(d: Droplet) {
  d.size = randomSize();
  d.elongated = d.size > 18 && Math.random() < 0.5;
  d.rotate = (Math.random() - 0.5) * 24;
  d.fallPctPerSec = FALL_PCT_MIN + Math.random() * (FALL_PCT_MAX - FALL_PCT_MIN);
  d.xPct = Math.random() * 100;
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

function applyDropletShape(d: Droplet) {
  if (!d.el) return;
  const height = d.elongated ? d.size * 1.7 : d.size;
  d.el.style.width = `${d.size}px`;
  d.el.style.height = `${height}px`;
  d.el.style.borderRadius = d.elongated ? "50% 50% 45% 45% / 62% 62% 38% 38%" : "50%";
  d.el.style.transform = `translate(-50%, -50%) rotate(${d.rotate}deg)`;
  d.el.style.left = `${d.xPct}%`;
  d.el.style.top = `${d.yPct}%`;
}

export function GogglesOverlay({
  blur,
  loop,
  pitchRef,
  camFovRef,
  underwaterRef,
}: {
  blur: number;
  loop: boolean;
  pitchRef: RefObject<number>;
  camFovRef: RefObject<number>;
  underwaterRef: RefObject<Record<string, { value: unknown }> | null>;
}) {
  // Droplet state lives in a ref, not React state — it's mutated every
  // animation frame and must never itself trigger a re-render. Lazily
  // seeded once per mount (i.e. once per GOGGLES toggle-on), scattered
  // across the whole screen so it reads as already-in-progress rather than
  // raining in from an empty screen.
  const dropletsRef = useRef<Droplet[]>([]);
  if (dropletsRef.current.length === 0) {
    for (let i = 0; i < DROPLET_COUNT; i++) {
      const d: Droplet = {
        el: null,
        xPct: Math.random() * 100,
        yPct: Math.random() * 100,
        size: randomSize(),
        elongated: false,
        rotate: 0,
        fallPctPerSec: FALL_PCT_MIN,
      };
      randomizeShape(d);
      dropletsRef.current.push(d);
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
      const globalFade = Math.max(0, 1 - underwaterVal / UNDERWATER_FADE_RANGE);
      const horizonPct = horizonFraction(pitch, fov) * 100;

      for (const d of dropletsRef.current) {
        if (!d.el) continue;
        d.yPct += d.fallPctPerSec * dt;

        if (loop) {
          // Waterline ignored entirely: keep falling, wrap from above once
          // safely off-screen so the recycle is never visible.
          if (d.yPct > 108) {
            randomizeShape(d);
            d.yPct = -8 - Math.random() * 20;
            applyDropletShape(d);
          } else {
            d.el.style.top = `${d.yPct}%`;
          }
          d.el.style.opacity = globalFade.toFixed(3);
        } else {
          if (d.yPct >= horizonPct) {
            randomizeShape(d);
            d.yPct = Math.random() * Math.max(0, horizonPct - 4);
            applyDropletShape(d);
          } else {
            d.el.style.top = `${d.yPct}%`;
          }
          const surfaceFade = Math.max(0, Math.min(1, (horizonPct - d.yPct) / FADE_ZONE_PCT));
          d.el.style.opacity = (surfaceFade * globalFade).toFixed(3);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loop, pitchRef, camFovRef, underwaterRef]);

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
            opacity: 0,
            left: `${d.xPct}%`,
            top: `${d.yPct}%`,
            width: d.size,
            height: d.elongated ? d.size * 1.7 : d.size,
            borderRadius: d.elongated ? "50% 50% 45% 45% / 62% 62% 38% 38%" : "50%",
            transform: `translate(-50%, -50%) rotate(${d.rotate}deg)`,
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
