import type { ReactNode } from "react";
import { Bird, Sailboat, Waves, Wind } from "lucide-react";
import type { CameraMode } from "@/lib/settingsShared";

// Round icon button for the controller-style HUD's right-hand column (the
// camera modes and quick toggles), with a tiny caption underneath so the
// icon never has to be guessed.
export function HudIconButton({
  label,
  ariaLabel,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  ariaLabel?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <div className="pointer-events-none flex w-16 flex-col items-center gap-0.5 select-none">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={active}
        aria-label={ariaLabel ?? label}
        title={label}
        className={`pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md transition active:scale-95 disabled:active:scale-100 ${
          active ? "ui-line-3 ui-tint-2 ui-ink" : "ui-line-2 ui-surface ui-ink-muted ui-press"
        } ${disabled && !active ? "opacity-50" : ""}`}
      >
        {children}
      </button>
      <span
        className={`max-w-full whitespace-nowrap text-center text-[7px] font-light leading-tight tracking-[0.1em] ${
          active ? "ui-ink" : "ui-ink-muted"
        }`}
        aria-hidden="true"
      >
        {label}
      </span>
    </div>
  );
}

// Swing seat hanging from a bar: no stock icon fits GUNGA.
function SwingIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 3h18" />
      <path d="M8 3l2 14M16 3l-2 14" />
      <path d="M8 17h8" />
      <path d="M5 21c2-1.5 4-2 7-2s5 .5 7 2" opacity="0.5" />
    </svg>
  );
}

export function CameraModeIcon({ mode }: { mode: CameraMode }) {
  const cls = "h-5 w-5";
  switch (mode) {
    case "float":
      return <Waves className={cls} strokeWidth={1.6} aria-hidden="true" />;
    case "swing":
      return <SwingIcon className={cls} />;
    case "noclip":
      return <Bird className={cls} strokeWidth={1.6} aria-hidden="true" />;
    case "bodyflight":
      return <Wind className={cls} strokeWidth={1.6} aria-hidden="true" />;
    case "watercraft":
      return <Sailboat className={cls} strokeWidth={1.6} aria-hidden="true" />;
  }
}
