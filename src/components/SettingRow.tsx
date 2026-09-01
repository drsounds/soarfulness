import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

// Android-Settings-style replacement for the old compact PadDial pill
// (src/components/PadDial.tsx): each setting renders as a full-width list
// row — larger label text, the current value shown as a summary, and a
// trailing chevron — and tapping it opens the actual +/- / slider / option
// list controller in a modal sheet instead of inline. Deliberately kept
// prop-compatible with PadDial (same label/value/onDec/onInc/mode/rawValue/
// onSet/min/max/step/options/selectedIndex/onSelectIndex) so every existing
// call site in SettingsPanel.tsx only needed its tag name swapped, not its
// logic rewritten.
export type SettingRowMode = "number" | "cycle";

export function SettingRow({
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
  mode?: SettingRowMode;
  min?: number;
  max?: number;
  step?: number;
  // When all three are given, the modal renders an Android-style radio list
  // of every option instead of the numeric slider/stepper.
  options?: string[];
  selectedIndex?: number;
  onSelectIndex?: (i: number) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const isSelect =
    options !== undefined && selectedIndex !== undefined && onSelectIndex !== undefined;
  const isNumber =
    mode === "number" &&
    rawValue !== undefined &&
    onSet !== undefined &&
    min !== undefined &&
    max !== undefined;

  // Pushes a throwaway history entry while the modal is open so the
  // browser/Android back gesture closes just the modal, not the whole
  // settings dialog — the "routed modal" behavior this list is built around.
  useEffect(() => {
    if (!open) return;
    history.pushState({ aquaSettingModal: true }, "");
    const onPopState = () => setOpen(false);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [open]);

  const close = () => {
    setOpen(false);
    if ((history.state as { aquaSettingModal?: boolean } | null)?.aquaSettingModal) {
      history.back();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="ui-focus-line ui-focus-surface flex w-full items-center justify-between gap-3 border-b px-1 py-3.5 text-left outline-none transition active:opacity-70"
        style={{ borderColor: "var(--ui-line-1)" }}
      >
        <span className="ui-ink text-sm font-medium leading-snug">{label}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="ui-ink-muted max-w-[9rem] truncate text-xs font-light tabular-nums tracking-wide">
            {value}
          </span>
          <span className="ui-ink-faint text-base leading-none" aria-hidden="true">
            ›
          </span>
        </span>
      </button>
      {open && (
        <SettingModal label={label} onClose={close}>
          {isSelect ? (
            <OptionList
              options={options}
              selectedIndex={selectedIndex}
              onSelect={(i) => {
                onSelectIndex(i);
                close();
              }}
            />
          ) : isNumber ? (
            <NumberControl
              label={label}
              value={value}
              rawValue={rawValue}
              min={min}
              max={max}
              step={step ?? Math.max((max - min) / 100, 0.01)}
              onSet={onSet}
              onDec={onDec}
              onInc={onInc}
            />
          ) : (
            <StepperControl label={label} value={value} onDec={onDec} onInc={onInc} />
          )}
        </SettingModal>
      )}
    </>
  );
}

function SettingModal({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className="ui-surface-solid flex w-full max-w-sm flex-col gap-4 rounded-t-3xl border p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl backdrop-blur-xl sm:rounded-3xl sm:pb-5"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="ui-ink text-base font-semibold leading-snug">{label}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="ui-tint-1 ui-ink ui-press flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-base transition active:scale-95"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Android-style single-choice list: every option shown at once (rather than
// stepped one at a time) with the active one checked — used whenever the
// dial passed a static options/selectedIndex/onSelectIndex triple.
function OptionList({
  options,
  selectedIndex,
  onSelect,
}: {
  options: string[];
  selectedIndex: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div role="radiogroup" className="-mx-1.5 flex max-h-[60vh] flex-col overflow-y-auto">
      {options.map((opt, i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={i === selectedIndex}
          onClick={() => onSelect(i)}
          className={`flex items-center justify-between gap-3 rounded-xl px-3 py-3 text-left text-sm transition active:scale-[0.99] ${
            i === selectedIndex ? "ui-tint-2 ui-ink font-medium" : "ui-ink-muted"
          }`}
        >
          <span>{opt}</span>
          {i === selectedIndex && <span aria-hidden="true">✓</span>}
        </button>
      ))}
    </div>
  );
}

// Large slider + tap-to-type readout + +/- steppers for any numeric dial —
// the slider's min/max/step are exactly what each call site already passed
// to the old PadDial (which declared but never actually used `step`).
function NumberControl({
  label,
  value,
  rawValue,
  min,
  max,
  step,
  onSet,
  onDec,
  onInc,
}: {
  label: string;
  value: string;
  rawValue: number;
  min: number;
  max: number;
  step: number;
  onSet: (v: number) => void;
  onDec: () => void;
  onInc: () => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const input = inputRef.current;
    if (input) {
      const parsed = parseFloat(input.value.replace(/,/g, "."));
      if (!Number.isNaN(parsed)) onSet(Math.max(min, Math.min(max, parsed)));
    }
    setEditing(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center">
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            defaultValue={rawValue}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            autoFocus
            className="ui-ink w-36 border-b bg-transparent text-center text-2xl font-semibold tracking-wide outline-none"
            style={{ borderColor: "var(--ui-line-3)" }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="ui-ink text-2xl font-semibold tracking-wide underline decoration-[var(--ui-line-3)] underline-offset-4"
          >
            {value}
          </button>
        )}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={rawValue}
        onChange={(e) => onSet(Number(e.target.value))}
        aria-label={label}
        aria-valuetext={value}
        className="h-6 w-full cursor-pointer accent-[var(--ui-accent)]"
      />
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={onDec}
          aria-label={t("common.decreaseAria", { label })}
          className="ui-tint-1 ui-ink ui-press flex h-12 w-12 items-center justify-center rounded-full border text-xl transition active:scale-95"
        >
          −
        </button>
        <button
          type="button"
          onClick={onInc}
          aria-label={t("common.increaseAria", { label })}
          className="ui-tint-1 ui-ink ui-press flex h-12 w-12 items-center justify-center rounded-full border text-xl transition active:scale-95"
        >
          +
        </button>
      </div>
    </div>
  );
}

// Large +/- stepper for anything that isn't a numeric range or a static
// option list — mainly on/off toggles and small cyclical values (direction,
// waveform shape, etc.) that only ever expose two step functions.
function StepperControl({
  label,
  value,
  onDec,
  onInc,
}: {
  label: string;
  value: string;
  onDec: () => void;
  onInc: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center gap-5 py-2">
      <button
        type="button"
        onClick={onDec}
        aria-label={t("common.decreaseAria", { label })}
        className="ui-tint-1 ui-ink ui-press flex h-14 w-14 items-center justify-center rounded-full border text-2xl transition active:scale-95"
      >
        −
      </button>
      <span className="ui-ink min-w-[7ch] text-center text-xl font-semibold tracking-wide">
        {value}
      </span>
      <button
        type="button"
        onClick={onInc}
        aria-label={t("common.increaseAria", { label })}
        className="ui-tint-1 ui-ink ui-press flex h-14 w-14 items-center justify-center rounded-full border text-2xl transition active:scale-95"
      >
        +
      </button>
    </div>
  );
}
