import {
  GAMEPAD_ACTIONS,
  GAMEPAD_PRESS_ACTIONS,
  type GamepadAction,
  type GamepadBinding,
  type GamepadBindings,
} from "./bindings";

/** What one pad reports in a frame (a plain copy of a browser `Gamepad`). */
export type PadSnapshot = {
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value: number }[];
};

export type MapperOptions = {
  deadZone: number;
  moveSensitivity: number;
  lookSensitivity: number;
  invertLookY: boolean;
  boost: number;
};

export type Stick = { x: number; y: number };

/** The result of one frame: what the host feeds into the HUD sticks. */
export type GamepadFrame = {
  /** At least one pad is connected (and the app is on). */
  connected: boolean;
  /** NAV: x = right, y = forward, like the NAV wheel. Can exceed 1 while boosting. */
  move: Stick;
  /** LOOK: x = turn right, y = look up, like the LOOK pad. */
  look: Stick;
  /** HÖJD / DRIVA Y: +1 rise, −1 sink. */
  rise: number;
  boost: boolean;
  /** Button actions that went down this frame. */
  pressed: GamepadAction[];
  /** Every action's value 0–1 (debug window). */
  values: Record<GamepadAction, number>;
};

/** Press above this, release below RELEASE (hysteresis for analog triggers). */
const PRESS = 0.5;
const RELEASE = 0.3;
/** Analog buttons (triggers) report a little noise at rest. */
const BUTTON_FLOOR = 0.05;

export function zeroValues(): Record<GamepadAction, number> {
  const out = {} as Record<GamepadAction, number>;
  for (const act of GAMEPAD_ACTIONS) out[act] = 0;
  return out;
}

export const IDLE_GAMEPAD_FRAME: GamepadFrame = {
  connected: false,
  move: { x: 0, y: 0 },
  look: { x: 0, y: 0 },
  rise: 0,
  boost: false,
  pressed: [],
  values: zeroValues(),
};

/** 0–1 for a button's value (digital buttons report only `pressed`). */
export function buttonValue(btn: { pressed: boolean; value: number } | undefined): number {
  if (!btn) return 0;
  const v = Number.isFinite(btn.value) ? btn.value : 0;
  const out = v > 0 ? v : btn.pressed ? 1 : 0;
  return out < BUTTON_FLOOR ? 0 : Math.min(1, out);
}

/** One half of an axis, dead zone removed and the rest rescaled to 0–1. */
export function axisValue(raw: number | undefined, dir: 1 | -1, deadZone: number): number {
  const v = (Number.isFinite(raw) ? (raw as number) : 0) * dir;
  const dz = Math.min(0.9, Math.max(0, deadZone));
  if (v <= dz) return 0;
  return Math.min(1, (v - dz) / (1 - dz));
}

export function bindingValue(x: GamepadBinding, pad: PadSnapshot, deadZone: number): number {
  return x.kind === "button"
    ? buttonValue(pad.buttons[x.index])
    : axisValue(pad.axes[x.index], x.dir, deadZone);
}

/** Limit a stick vector to length 1 (two pushed bindings shouldn't add up). */
function unit(x: number, y: number): Stick {
  const len = Math.hypot(x, y);
  return len > 1 ? { x: x / len, y: y / len } : { x, y };
}

/**
 * Turns raw pad snapshots into action values and HUD stick values, and
 * reports button actions once per press. Pure: the browser reading lives in
 * gamepadInput.ts, so this is unit-tested without a pad.
 */
export class GamepadMapper {
  private held = new Set<GamepadAction>();

  reset() {
    this.held.clear();
  }

  map(pads: readonly PadSnapshot[], bindings: GamepadBindings, opt: MapperOptions): GamepadFrame {
    if (pads.length === 0) {
      this.held.clear();
      return IDLE_GAMEPAD_FRAME;
    }
    const values = zeroValues();
    for (const act of GAMEPAD_ACTIONS) {
      let v = 0;
      for (const binding of bindings[act] ?? []) {
        for (const pad of pads) v = Math.max(v, bindingValue(binding, pad, opt.deadZone));
      }
      values[act] = v;
    }

    const pressed: GamepadAction[] = [];
    for (const act of GAMEPAD_PRESS_ACTIONS) {
      const v = values[act];
      if (this.held.has(act)) {
        if (v < RELEASE) this.held.delete(act);
      } else if (v >= PRESS) {
        this.held.add(act);
        pressed.push(act);
      }
    }

    const boost = values.boost >= PRESS;
    const moveScale = Math.max(0, opt.moveSensitivity) * (boost ? Math.max(1, opt.boost) : 1);
    const m = unit(values.moveRight - values.moveLeft, values.moveForward - values.moveBack);
    const l = unit(values.lookRight - values.lookLeft, values.lookUp - values.lookDown);
    const lookScale = Math.max(0, opt.lookSensitivity);
    return {
      connected: true,
      move: { x: m.x * moveScale, y: m.y * moveScale },
      look: { x: l.x * lookScale, y: l.y * lookScale * (opt.invertLookY ? -1 : 1) },
      rise: Math.max(-1, Math.min(1, values.rise - values.sink)),
      boost,
      pressed,
      values,
    };
  }
}
