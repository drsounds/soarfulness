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
        className="w-full max-w-xs rounded-2xl border border-white/15 bg-black/85 p-4 text-center shadow-2xl backdrop-blur-xl"
      >
        <p className="mb-1 text-[11px] font-medium tracking-wide text-white/90">{title}</p>
        <p className="mb-4 text-[10px] font-light leading-relaxed text-white/60">{message}</p>
        <div className="flex justify-center gap-2">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-[9px] font-medium tracking-wider text-white transition active:scale-95 active:bg-white/20"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-[9px] font-light tracking-wider text-white/70 transition active:scale-95 active:bg-white/15"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
