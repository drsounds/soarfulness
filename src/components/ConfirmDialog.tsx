import { useEffect, useRef } from "react";

// Minimal confirm modal for destructive/overwriting actions (reset to
// defaults, loading a saved preset/state over unsaved changes) — styled to
// match the dark glassy dialog chrome used throughout the settings UI.
// Cancel is the visually primary button and receives focus on open, so
// Enter/Space (and a stray tap) defaults to the safe, non-destructive choice.
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="ui-surface-solid w-full max-w-xs rounded-2xl border p-4 text-center shadow-2xl backdrop-blur-xl"
      >
        <p className="ui-ink mb-1 text-[11px] font-medium tracking-wide">{title}</p>
        <p className="ui-ink-muted mb-4 text-[10px] font-light leading-relaxed">{message}</p>
        <div className="flex justify-center gap-2">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="ui-btn rounded-full border px-4 py-1.5 text-[9px] font-medium tracking-wider transition active:scale-95"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="ui-tint-1 ui-ink-muted ui-press rounded-full border px-4 py-1.5 text-[9px] font-light tracking-wider transition active:scale-95"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
