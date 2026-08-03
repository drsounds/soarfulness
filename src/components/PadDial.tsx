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

// How the slider's travel maps onto its value range:
//   1        linear (the plain default)
//   n > 1    power curve — value = min + range·pos^n, so the low end of the
//            range gets most of the travel
//   "log"    geometric — value = min·(max/min)^pos, equal travel per equal
//            ratio; for multipliers around 1, needs min > 0
// Several of these ranges are deliberately huge at the top (VÅG goes to 100m)
// but are actually used down at the bottom (its default is 0.5m). Mapped
// linearly, the whole usable range collapses into the first pixel or two of
// travel, so the very first drag jumps the sea from a ripple to a wall of
// water. The curves below spend the travel where the values are.
export type PadSliderCurve = number | "log";

// Slider position (0..1) -> value.
function padSliderValue(pos: number, min: number, max: number, curve: PadSliderCurve): number {
  if (curve === "log") return min * Math.pow(max / min, pos);
  return min + (max - min) * Math.pow(pos, curve);
}

// Inverse of padSliderValue() — where the thumb sits for a given value.
function padSliderPos(value: number, min: number, max: number, curve: PadSliderCurve): number {
  const v = Math.max(min, Math.min(max, value));
  if (curve === "log") return Math.log(v / min) / Math.log(max / min);
  return Math.pow((v - min) / (max - min), 1 / curve);
}

// A drag slider for the same numeric range a neighboring PadDial's +/- steps
// through — sits beside it for quick coarse adjustment instead of repeated
// taps. Deliberately a plain native <input type="range"> tinted via
// accent-color rather than the shadcn/Radix Slider in
// components/ui/slider.tsx (that one is styled off the app-wide light/dark
// CSS theme tokens this dark glass HUD doesn't use) — and rather than
// stripping the native appearance, which removes the browser's own
// track/thumb rendering entirely unless every ::-webkit-slider-thumb /
// ::-moz-range-thumb pseudo-element is hand-styled to replace it.
export function PadSlider({
  label,
  value,
  min,
  max,
  step,
  curve = 1,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  curve?: PadSliderCurve;
  // Readout beside the label. Worth passing whenever `curve` isn't linear —
  // the thumb's position no longer reads as a proportion of the range, so the
  // number is the only cue for where the value actually is.
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const curved = curve !== 1;
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 backdrop-blur-md">
      <span className="whitespace-nowrap text-[9px] font-light tracking-[0.28em] text-white/60">
        {label}
      </span>
      <input
        type="range"
        // A curved slider drags in position space (0..1) and converts on the
        // way out, so `step` — an increment in *value* space — no longer
        // applies; a fine, uniform position step plus 2-decimal rounding
        // keeps the low end precise without quantizing the top end coarsely.
        min={curved ? 0 : min}
        max={curved ? 1 : max}
        step={curved ? 0.002 : step}
        value={curved ? padSliderPos(value, min, max, curve) : value}
        onChange={(e) => {
          const raw = Number(e.target.value);
          onChange(curved ? +padSliderValue(raw, min, max, curve).toFixed(2) : raw);
        }}
        aria-label={label}
        aria-valuetext={format ? format(value) : undefined}
        className="h-4 w-32 cursor-pointer accent-white"
      />
      {format && (
        <span className="w-12 shrink-0 text-right text-[10px] font-medium tabular-nums tracking-wider text-white/80">
          {format(value)}
        </span>
      )}
    </div>
  );
}
