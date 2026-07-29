import { useRef, useState } from "react";

// Shared between the main HUD's settings dialog (routes/index.tsx) and its
// clone rendered as the "Inställningar" app inside the virtual phone's bathOS
// shell (SettingsPanel.tsx) — a stateless value+dec/inc control, plus an
// optional tap-to-type numeric entry mode.

export type PadDialMode = "number" | "cycle";

export function clampStep(v: number, min: number, max: number, step: number) {
  const rounded = Math.round(v / step) * step;
  return Math.max(min, Math.min(max, +rounded.toFixed(10)));
}

export function PadDial({
  label,
  value,
  rawValue,
  onDec,
  onInc,
  onSet,
  mode = "cycle",
  min,
  max,
  step,
}: {
  label: string;
  value: string;
  rawValue?: number;
  onDec: () => void;
  onInc: () => void;
  onSet?: (v: number) => void;
  mode?: PadDialMode;
  min?: number;
  max?: number;
  step?: number;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const input = inputRef.current;
    if (!input || min === undefined || max === undefined || step === undefined || !onSet) {
      setEditing(false);
      return;
    }
    const parsed = parseFloat(input.value.replace(/,/g, "."));
    if (!Number.isNaN(parsed)) {
      onSet(clampStep(parsed, min, max, step));
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editing) {
      if (e.key === "Enter") commit();
      if (e.key === "Escape") setEditing(false);
      return;
    }
    if (e.key === "ArrowUp" || e.key === "ArrowRight" || e.key === "+") {
      e.preventDefault();
      onInc();
    } else if (e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "-") {
      e.preventDefault();
      onDec();
    }
  };

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="flex items-center gap-1 rounded-full border border-white/15 bg-black/40 p-1 pl-3 backdrop-blur-md outline-none focus:border-white/40 focus:bg-black/50"
    >
      <div className="flex min-w-[86px] flex-col items-start leading-tight text-white">
        <span className="text-[9px] font-light tracking-[0.28em] text-white/60">{label}</span>
        {mode === "number" && editing ? (
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            defaultValue={rawValue ?? value}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            autoFocus
            className="w-20 bg-transparent text-xs font-medium tracking-wider text-white outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => mode === "number" && setEditing(true)}
            className={`text-xs font-medium tracking-wider ${mode === "number" ? "cursor-text underline decoration-white/30 underline-offset-2" : "cursor-default"}`}
            tabIndex={-1}
          >
            {value}
          </button>
        )}
      </div>
      <button
        onClick={onDec}
        className="h-7 w-7 rounded-full border border-white/20 bg-white/5 text-white/90 transition active:scale-95 active:bg-white/15"
        aria-label={`${label} minska`}
        tabIndex={-1}
      >
        −
      </button>
      <button
        onClick={onInc}
        className="h-7 w-7 rounded-full border border-white/20 bg-white/5 text-white/90 transition active:scale-95 active:bg-white/15"
        aria-label={`${label} öka`}
        tabIndex={-1}
      >
        +
      </button>
    </div>
  );
}
