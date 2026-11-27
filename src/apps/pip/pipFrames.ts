import { capFpsForPip } from "./settings";
import { onPipStatus, pipStatus } from "./pipState";

// The render loop's frame source. Normally the page's own
// requestAnimationFrame, but in Document Picture-in-Picture the scene lives
// in the PiP window, and the page it came from may be hidden (another tab in
// front), where the browser stops its animation frames. So frames come from
// the window the scene is shown in. In video PiP the page is hidden too and
// has no animation frames at all: a timer keeps the stream moving (browsers
// may slow it down in the background).

type Pending = { cb: () => void; cancel: () => void };
const pending = new Map<number, Pending>();
let seq = 0;
let pipCap = 0;

const VIDEO_FALLBACK_MS = 1000 / 30;

function schedule(id: number, cb: () => void): () => void {
  const run = () => {
    pending.delete(id);
    cb();
  };
  const { kind, frameWindow } = pipStatus();
  if (kind === "document" && frameWindow && !frameWindow.closed) {
    const win = frameWindow;
    const h = win.requestAnimationFrame(run);
    return () => win.cancelAnimationFrame(h);
  }
  if (kind === "video" && typeof document !== "undefined" && document.hidden) {
    const h = window.setTimeout(run, VIDEO_FALLBACK_MS);
    return () => window.clearTimeout(h);
  }
  const h = window.requestAnimationFrame(run);
  return () => window.cancelAnimationFrame(h);
}

/** requestAnimationFrame for the scene, from whichever window shows it. */
export function requestSceneFrame(cb: () => void): number {
  const id = ++seq;
  pending.set(id, { cb, cancel: schedule(id, cb) });
  return id;
}

export function cancelSceneFrame(id: number): void {
  const p = pending.get(id);
  if (!p) return;
  p.cancel();
  pending.delete(id);
}

/** Moves waiting frames to the current frame source (a PiP window opened or closed). */
export function rescheduleSceneFrames(): void {
  for (const [id, p] of [...pending]) {
    p.cancel();
    p.cancel = schedule(id, p.cb);
  }
}

if (typeof window !== "undefined") {
  onPipStatus(rescheduleSceneFrames);
  document.addEventListener("visibilitychange", rescheduleSceneFrames);
}

/** PIP FRAME RATE (pipFps) while any PiP shows, kept by usePictureInPicture. */
export function setPipFpsCap(cap: number): void {
  pipCap = cap;
}

/** The scene's frame rate cap, lowered to PIP FRAME RATE while in Picture-in-Picture. */
export function sceneFpsCap(sceneCap: number): number {
  return pipStatus().kind ? capFpsForPip(sceneCap, pipCap) : sceneCap;
}
