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
      className="ui-surface pointer-events-auto relative h-24 w-24 touch-none select-none rounded-full border backdrop-blur-md"
      style={{ boxShadow: "inset 0 0 40px rgba(255,255,255,0.05)" }}
    >
      <div className="ui-line-1 pointer-events-none absolute inset-3 rounded-full border" />
      <div
        className="ui-thumb pointer-events-none absolute left-1/2 top-1/2 h-9 w-9 rounded-full border"
        style={{
          transform: `translate(calc(-50% + ${value.x * radius}px), calc(-50% + ${-value.y * radius}px))`,
        }}
      />
      <span className="ui-ink-muted pointer-events-none absolute inset-x-0 top-1 text-center text-[8px] font-light tracking-[0.28em]">
        {label}
      </span>
      {sticky && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onChange({ x: 0, y: 0 })}
          aria-label={t("common.resetAria", { label })}
          tabIndex={-1}
          className="ui-icon-btn pointer-events-auto absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full border transition active:scale-95"
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

export type VerticalMode = "rise" | "still" | "fall";

// A vertical 3-position slider — drag (or tap) into the top/middle/bottom
// third to pick "rise"/"still"/"fall". Used by noclip's JUMP control: a
// single control for what used to be two separate toggle buttons (FRITT
// FALL/OMVÄND STIGNING), with "still" as the natural middle ground between
// them. Sticky like JoystickPad's sticky mode — it holds whatever position
// it's set to rather than springing back — since the caller (routes/
// index.tsx) already eases the actual applied vertical rate toward whatever
// this picks, so snapping the *selection* here doesn't make the resulting
// motion feel abrupt.
export function VerticalModeSlider({
  value,
  onChange,
  label = "JUMP",
  height = 132,
}: {
  value: VerticalMode;
  onChange: (v: VerticalMode) => void;
  label?: string;
  height?: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const activeId = useRef<number | null>(null);

  const zoneFromPointer = (clientY: number): VerticalMode => {
    const track = trackRef.current;
    if (!track) return "still";
    const rect = track.getBoundingClientRect();
    const rel = (clientY - rect.top) / rect.height;
    if (rel < 1 / 3) return "rise";
    if (rel > 2 / 3) return "fall";
    return "still";
  };

  const thumbFrac = value === "rise" ? 1 / 6 : value === "fall" ? 5 / 6 : 0.5;

  return (
    <div className="pointer-events-auto flex flex-col items-center gap-1 select-none">
      <span className="ui-ink-muted text-[8px] font-light tracking-[0.28em]">{label}</span>
      <div
        ref={trackRef}
        onPointerDown={(e) => {
          if (activeId.current !== null) return;
          activeId.current = e.pointerId;
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          onChange(zoneFromPointer(e.clientY));
        }}
        onPointerMove={(e) => {
          if (activeId.current !== e.pointerId) return;
          onChange(zoneFromPointer(e.clientY));
        }}
        onPointerUp={(e) => {
          if (activeId.current !== e.pointerId) return;
          activeId.current = null;
        }}
        onPointerCancel={() => {
          activeId.current = null;
        }}
        className="ui-surface relative w-10 touch-none rounded-full border backdrop-blur-md"
        style={{ height, boxShadow: "inset 0 0 30px rgba(255,255,255,0.05)" }}
      >
        <div className="ui-ink-faint pointer-events-none absolute inset-x-0 top-1.5 text-center text-[9px] leading-none">
          ▲
        </div>
        <div className="ui-ink-faint pointer-events-none absolute inset-x-0 bottom-1.5 text-center text-[9px] leading-none">
          ▼
        </div>
        <div
          className="ui-thumb pointer-events-none absolute left-1/2 h-7 w-7 -translate-x-1/2 rounded-full border transition-[top] duration-200 ease-out"
          style={{ top: `calc(${thumbFrac * 100}% - 14px)` }}
        />
      </div>
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
