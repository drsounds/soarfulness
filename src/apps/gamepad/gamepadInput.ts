// GAMEPAD browser side: reads the pads through the Gamepad API
// (navigator.getGamepads), tracks connects / disconnects, and runs the
// "press a button to bind" capture for the settings panel. Everything here
// is a no-op where the API is missing (old webviews, SSR).

import type { GamepadBinding } from "./bindings";
import type { PadSnapshot } from "./GamepadMapper";

export type PadInfo = PadSnapshot & {
  index: number;
  id: string;
  /** "standard" when the browser knows the layout (the default bindings assume it). */
  mapping: string;
};

export function gamepadApiAvailable(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.getGamepads === "function";
}

/** Every connected pad right now. Browsers only expose a pad after one of its buttons is pressed. */
export function readPads(): PadInfo[] {
  if (!gamepadApiAvailable()) return [];
  let list: (Gamepad | null)[];
  try {
    list = Array.from(navigator.getGamepads());
  } catch {
    // Firefox throws outside a secure context, some webviews behind a permissions policy.
    return [];
  }
  const out: PadInfo[] = [];
  for (const gp of list) {
    if (!gp || !gp.connected) continue;
    out.push({
      index: gp.index,
      id: gp.id,
      mapping: gp.mapping,
      axes: gp.axes.slice(),
      buttons: gp.buttons.map((btn) => ({ pressed: btn.pressed, value: btn.value })),
    });
  }
  return out;
}

/** Calls `cb` with the connected pads whenever one connects or disconnects. */
export function onPadsChanged(cb: (pads: PadInfo[]) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const fire = () => cb(readPads());
  window.addEventListener("gamepadconnected", fire);
  window.addEventListener("gamepaddisconnected", fire);
  return () => {
    window.removeEventListener("gamepadconnected", fire);
    window.removeEventListener("gamepaddisconnected", fire);
  };
}

// ---- Capture ("press a button to bind") ----------------------------------

const CAPTURE_BUTTON = 0.5;
const CAPTURE_AXIS = 0.6;
const RESTING_AXIS = 0.4;

/**
 * While a capture runs, and afterwards until every input is let go again,
 * the runtime ignores the pads — so the button you're binding doesn't also
 * trigger its old action (or open/close settings) on the way.
 */
let captureState: "idle" | "capturing" | "draining" = "idle";

function anythingHeld(pads: readonly PadSnapshot[]): boolean {
  return pads.some(
    (p) =>
      p.buttons.some((btn) => btn.pressed || btn.value >= 0.3) ||
      p.axes.some((v) => Math.abs(v) >= RESTING_AXIS),
  );
}

/** True while the runtime should ignore the pads (see captureState). */
export function gamepadInputSuppressed(pads: readonly PadSnapshot[]): boolean {
  if (captureState === "draining" && !anythingHeld(pads)) captureState = "idle";
  return captureState !== "idle";
}

/** The first input pushed in `pad` that wasn't already pushed in `base`. */
export function newlyPushed(
  base: PadSnapshot | undefined,
  pad: PadSnapshot,
): GamepadBinding | null {
  for (let i = 0; i < pad.buttons.length; i++) {
    const was = base?.buttons[i];
    const wasDown = !!was && (was.pressed || was.value >= CAPTURE_BUTTON);
    const btn = pad.buttons[i];
    if (!wasDown && (btn.value >= CAPTURE_BUTTON || (btn.pressed && btn.value === 0)))
      return { kind: "button", index: i };
  }
  for (let i = 0; i < pad.axes.length; i++) {
    const was = Math.abs(base?.axes[i] ?? 0);
    const v = pad.axes[i];
    if (was < RESTING_AXIS && Math.abs(v) >= CAPTURE_AXIS)
      return { kind: "axis", index: i, dir: v > 0 ? 1 : -1 };
  }
  return null;
}

/**
 * Waits for the next button press or stick push on any pad and hands it to
 * `onCaptured`. Inputs already held when the capture starts are ignored
 * until released. Returns a cancel function.
 */
export function captureNextInput(
  onCaptured: (binding: GamepadBinding, pad: PadInfo) => void,
): () => void {
  if (typeof window === "undefined" || !gamepadApiAvailable()) return () => {};
  captureState = "capturing";
  const base = new Map<number, PadSnapshot>();
  for (const p of readPads()) base.set(p.index, p);
  let raf = 0;
  let done = false;
  const finish = () => {
    done = true;
    cancelAnimationFrame(raf);
    captureState = "draining";
  };
  const tick = () => {
    if (done) return;
    for (const pad of readPads()) {
      const hit = newlyPushed(base.get(pad.index), pad);
      if (hit) {
        finish();
        onCaptured(hit, pad);
        return;
      }
      // A pad that wasn't there at the start: anything it rests on is its baseline.
      if (!base.has(pad.index)) base.set(pad.index, pad);
      // Let go of something held at the start → it counts as fresh from now on.
      const b = base.get(pad.index)!;
      base.set(pad.index, {
        axes: b.axes.map((v, i) => (Math.abs(pad.axes[i] ?? 0) < RESTING_AXIS ? 0 : v)),
        buttons: b.buttons.map((btn, i) =>
          pad.buttons[i]?.pressed ? btn : { pressed: false, value: 0 },
        ),
      });
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => {
    if (!done) finish();
  };
}
