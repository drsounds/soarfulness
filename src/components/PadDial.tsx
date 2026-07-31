import { useRef, useState } from "react";

// Shared between the main HUD's settings dialog (routes/index.tsx) and its
// clone rendered as the "Inställningar" app inside the virtual phone's bathOS
// shell (SettingsPanel.tsx) — a stateless value+dec/inc control, plus an
// optional tap-to-type numeric entry mode.

export type PadDialMode = "number" | "cycle";

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
  options,
  selectedIndex,
  onSelectIndex,
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
  // When all three are given, the label renders as a true <select> dropdown
  // (in addition to the existing +/- buttons) instead of a plain readout —
  // lets a multi-option dial be jumped to directly instead of only stepped
  // one at a time.
  options?: string[];
  selectedIndex?: number;
  onSelectIndex?: (i: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSelect =
    options !== undefined && selectedIndex !== undefined && onSelectIndex !== undefined;

  const commit = () => {
    const input = inputRef.current;
    if (!input || min === undefined || max === undefined || !onSet) {
      setEditing(false);
      return;
    }
    const parsed = parseFloat(input.value.replace(/,/g, "."));
    if (!Number.isNaN(parsed)) {
      // Manual entry only clamps to [min, max] — it doesn't snap to the
      // nearest +/- step, so precise values (e.g. well below a coarse step
      // size) can actually be typed in instead of silently rounding away.
      onSet(Math.max(min, Math.min(max, parsed)));
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
        ) : isSelect ? (
          <select
            value={selectedIndex}
            onChange={(e) => onSelectIndex!(Number(e.target.value))}
            aria-label={label}
            tabIndex={-1}
            className="w-full max-w-[110px] cursor-pointer appearance-none bg-transparent text-xs font-medium tracking-wider text-white outline-none"
          >
            {options!.map((opt, i) => (
              <option key={i} value={i} className="bg-black text-white">
                {opt}
              </option>
            ))}
          </select>
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
