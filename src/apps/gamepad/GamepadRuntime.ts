import type { AppRuntime } from "@/core/apps/types";
import { decodeBindings, type GamepadBindings } from "./bindings";
import { gamepadInputSuppressed, readPads, type PadInfo } from "./gamepadInput";
import { GamepadMapper, IDLE_GAMEPAD_FRAME, type GamepadFrame } from "./GamepadMapper";
import type { GamepadSettings } from "./settings";

const live = new Set<GamepadRuntime>();

/** The live runtime (or null before the scene starts), read by the debug window. */
export function currentGamepadRuntime(): GamepadRuntime | null {
  let last: GamepadRuntime | null = null;
  for (const rt of live) last = rt;
  return last;
}

/**
 * GAMEPAD inside the render loop: `poll()` once per frame reads the pads and
 * returns what to mix into the HUD sticks plus the button actions pressed
 * this frame. With the app off or no pad connected it returns an idle frame
 * and touches nothing.
 */
export class GamepadRuntime implements AppRuntime<GamepadSettings> {
  private readonly mapper = new GamepadMapper();
  private bindingsCode: string | null = null;
  private bindings: GamepadBindings = decodeBindings("");
  /** Last poll's result and pads, for the debug window. */
  lastFrame: GamepadFrame = IDLE_GAMEPAD_FRAME;
  lastPads: PadInfo[] = [];
  suppressed = false;

  constructor() {
    live.add(this);
  }

  poll(settings: Readonly<GamepadSettings>, enabled = true): GamepadFrame {
    if (!enabled || !settings.gamepadOn) {
      this.mapper.reset();
      this.lastPads = [];
      this.suppressed = false;
      return (this.lastFrame = IDLE_GAMEPAD_FRAME);
    }
    if (settings.gamepadBindings !== this.bindingsCode) {
      this.bindingsCode = settings.gamepadBindings;
      this.bindings = decodeBindings(settings.gamepadBindings);
    }
    const pads = readPads();
    this.lastPads = pads;
    this.suppressed = gamepadInputSuppressed(pads);
    if (this.suppressed) {
      this.mapper.reset();
      return (this.lastFrame = { ...IDLE_GAMEPAD_FRAME, connected: pads.length > 0 });
    }
    this.lastFrame = this.mapper.map(pads, this.bindings, {
      deadZone: settings.gamepadDeadZone,
      moveSensitivity: settings.gamepadMoveSensitivity,
      lookSensitivity: settings.gamepadLookSensitivity,
      invertLookY: settings.gamepadInvertLookY,
      boost: settings.gamepadBoost,
    });
    return this.lastFrame;
  }

  shutdown() {
    this.mapper.reset();
    this.lastFrame = IDLE_GAMEPAD_FRAME;
  }

  dispose() {
    live.delete(this);
  }
}
