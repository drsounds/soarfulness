import { useRef } from "react";

export type StickValue = { x: number; y: number };

// The draggable circular pad itself — pointer/touch drag within a radius,
// emitting a normalized (-1..1, -1..1) vector. Shared between the main HUD's
// fixed-position on-screen sticks (see Joystick below) and the bathOS
// "Fjärrkontroll" (remote controller) app (VirtualPhone.tsx), which lays
// several of these out inline inside a scrollable phone screen instead of
// floating them over the 3D view.
export function JoystickPad({
  onChange,
  value,
  label = "NAV",
  sticky = false,
  radius = 42,
}: {
  onChange: (v: StickValue) => void;
  value: StickValue;
  label?: string;
  sticky?: boolean;
  radius?: number;
}) {
  const baseRef = useRef<HTMLDivElement>(null);
  const activeId = useRef<number | null>(null);
  const startPt = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  // Sticky joysticks only snap right at the center, so a release/tap there
  // reliably zeroes them out — everything past that is left alone for full,
  // fine-grained control instead of being squeezed into a smaller range.
  const deadzone = sticky ? 0.02 : 0;

  const emit = (nx: number, ny: number) => {
    if (deadzone > 0 && Math.hypot(nx, ny) < deadzone) {
      onChange({ x: 0, y: 0 });
    } else {
      onChange({ x: nx, y: ny });
    }
  };

  const setFromPointer = (clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > radius) {
      dx = (dx / dist) * radius;
      dy = (dy / dist) * radius;
    }
    emit(dx / radius, -dy / radius);
  };

  return (
    <div
      ref={baseRef}
      onDoubleClick={() => {
        if (sticky) onChange({ x: 0, y: 0 });
      }}
      onPointerDown={(e) => {
        if (activeId.current !== null) return;
        activeId.current = e.pointerId;
        startPt.current = { x: e.clientX, y: e.clientY };
        moved.current = false;
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        setFromPointer(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (activeId.current !== e.pointerId) return;
        if (startPt.current) {
          const d = Math.hypot(e.clientX - startPt.current.x, e.clientY - startPt.current.y);
          if (d > 4) moved.current = true;
        }
        setFromPointer(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (activeId.current !== e.pointerId) return;
        activeId.current = null;
        // Sticky: a tap without meaningful movement clears the stick
        // (so grazing/pressing lightly doesn't leave a stuck drift).
        if (sticky && !moved.current) onChange({ x: 0, y: 0 });
        if (!sticky) onChange({ x: 0, y: 0 });
      }}
      onPointerCancel={() => {
        activeId.current = null;
        if (!sticky) onChange({ x: 0, y: 0 });
      }}
      className="pointer-events-auto relative h-24 w-24 touch-none select-none rounded-full border border-white/20 bg-black/35 backdrop-blur-md"
      style={{ boxShadow: "inset 0 0 40px rgba(255,255,255,0.05)" }}
    >
      <div className="pointer-events-none absolute inset-3 rounded-full border border-white/10" />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-9 w-9 rounded-full border border-white/30 bg-white/80 shadow-[0_0_24px_rgba(255,255,255,0.35)]"
        style={{
          transform: `translate(calc(-50% + ${value.x * radius}px), calc(-50% + ${-value.y * radius}px))`,
        }}
      />
      <span className="pointer-events-none absolute inset-x-0 top-1 text-center text-[8px] font-light tracking-[0.28em] text-white/60">
        {label}
      </span>
    </div>
  );
}

// Floating, fixed-position variant used directly over the 3D view (NAV/LOOK
// on the main HUD) — a thin positioning wrapper around JoystickPad.
export function Joystick({
  onChange,
  value,
  label = "NAV",
  positionClass = "bottom-6 left-6",
  sticky = false,
}: {
  onChange: (v: StickValue) => void;
  value: StickValue;
  label?: string;
  positionClass?: string;
  sticky?: boolean;
}) {
  return (
    <div className={`pointer-events-none absolute z-10 select-none ${positionClass}`}>
      <JoystickPad onChange={onChange} value={value} label={label} sticky={sticky} />
    </div>
  );
}
