// Which Picture-in-Picture (if any) is showing right now, shared by the
// native bridge, the web windows, the render loop's frame source and the UI.

export type PipKind =
  /** Android: the whole activity shrank into a system PiP window. */
  | "native"
  /** Desktop Chrome: the scene moved into a Document Picture-in-Picture window. */
  | "document"
  /** Elsewhere: the 3D canvas streamed into a <video> in video Picture-in-Picture. */
  | "video";

export type PipStatus = {
  kind: PipKind | null;
  /** The window the scene is drawn in while in Document PiP (its rAF drives the loop). */
  frameWindow: Window | null;
};

const INACTIVE: PipStatus = { kind: null, frameWindow: null };
let status: PipStatus = INACTIVE;
const listeners = new Set<(s: PipStatus) => void>();

/** Marks the page while the native PiP window shows it, so CSS hides the HUD. */
export const PIP_ACTIVE_ATTR = "data-pip-active";

export function pipStatus(): PipStatus {
  return status;
}

export function setPipStatus(next: PipStatus): void {
  if (next.kind === status.kind && next.frameWindow === status.frameWindow) return;
  status = next.kind ? next : INACTIVE;
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    if (status.kind === "native") root.setAttribute(PIP_ACTIVE_ATTR, "native");
    else root.removeAttribute(PIP_ACTIVE_ATTR);
  }
  for (const fn of listeners) fn(status);
}

export function onPipStatus(fn: (s: PipStatus) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
