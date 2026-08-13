import { useMemo } from "react";

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
//  - a scatter of static water droplets, each a small radial-gradient
//    "blob" with its own subtle backdrop-filter blur so it slightly
//    distorts whatever's behind it, the way a real droplet refracts light

type Droplet = {
  id: number;
  left: number; // %
  top: number; // %
  size: number; // px
  elongated: boolean; // teardrop with a short trail vs. a plain round drop
  rotate: number; // deg
  drift: boolean; // slow slide-and-fade, then restart
  driftDelay: number; // s
  driftDuration: number; // s
};

function makeDroplets(count: number): Droplet[] {
  const out: Droplet[] = [];
  for (let i = 0; i < count; i++) {
    const size = 6 + Math.random() * 30;
    out.push({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size,
      elongated: size > 18 && Math.random() < 0.5,
      rotate: (Math.random() - 0.5) * 24,
      drift: Math.random() < 0.3,
      driftDelay: Math.random() * 20,
      driftDuration: 16 + Math.random() * 18,
    });
  }
  return out;
}

export function GogglesOverlay({ blur }: { blur: number }) {
  // Regenerated only when the overlay mounts (i.e. when GOGGLES is turned
  // on), not on every render — droplet layout should hold still.
  const droplets = useMemo(() => makeDroplets(22), []);
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
      <style>{`
        @keyframes aq-droplet-slide {
          0%   { transform: translate(-50%, -50%) translateY(0); opacity: 0.95; }
          80%  { opacity: 0.8; }
          100% { transform: translate(-50%, -50%) translateY(40px); opacity: 0; }
        }
      `}</style>
      {droplets.map((d) => (
        <div
          key={d.id}
          className="absolute"
          style={{
            left: `${d.left}%`,
            top: `${d.top}%`,
            width: d.size,
            height: d.elongated ? d.size * 1.7 : d.size,
            transform: `translate(-50%, -50%) rotate(${d.rotate}deg)`,
            borderRadius: d.elongated ? "50% 50% 45% 45% / 62% 62% 38% 38%" : "50%",
            background:
              "radial-gradient(circle at 32% 26%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.12) 10%, rgba(255,255,255,0.02) 45%, rgba(190,220,255,0.1) 75%, transparent 100%)",
            boxShadow:
              "inset 0 -2px 3px rgba(0,0,0,0.18), inset 0 2px 2px rgba(255,255,255,0.45), 0 1px 2px rgba(0,0,0,0.12)",
            backdropFilter: "blur(1.5px)",
            WebkitBackdropFilter: "blur(1.5px)",
            animation: d.drift
              ? `aq-droplet-slide ${d.driftDuration}s ease-in ${d.driftDelay}s infinite`
              : undefined,
          }}
        />
      ))}
    </div>
  );
}
