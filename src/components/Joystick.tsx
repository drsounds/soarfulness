import { useRef } from "react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const baseRef = useRef<HTMLDivElement>(null);
  const activeId = useRef<number | null>(null);

  // No deadzone: sticky pads used to snap to (0,0) whenever a drag or tap
  // landed within ~2% of center, which made it impossible to hold a small,
  // deliberate value right next to the middle. Full, uninterrupted travel is
  // reported now; sticky pads get an explicit reset button below instead of
  // relying on that implicit snap to get back to zero.
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
    onChange({ x: dx / radius, y: -dy / radius });
  };

  return (
    <div
      ref={baseRef}
      onPointerDown={(e) => {
        if (activeId.current !== null) return;
        activeId.current = e.pointerId;
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        setFromPointer(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (activeId.current !== e.pointerId) return;
        setFromPointer(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (activeId.current !== e.pointerId) return;
        activeId.current = null;
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
      {sticky && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onChange({ x: 0, y: 0 })}
          aria-label={t("common.resetAria", { label })}
          tabIndex={-1}
          className="pointer-events-auto absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full border border-white/25 bg-black/50 text-white/70 transition hover:border-white/50 hover:text-white active:scale-95"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3 w-3"
          >
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <path d="M3 4v5h5" />
          </svg>
        </button>
      )}
    </div>
  );
}

// Floating, fixed-position variant used directly over the 3D view (NAV/LOOK
// on the main HUD) — a thin positioning wrapper around JoystickPad.
export function Joystick({
  onChange,
  value,
  label = "NAV",
  positionClass = "bottom-8 left-8",
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
