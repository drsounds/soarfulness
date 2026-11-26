// Gamepad settings: this app's slice of the persisted settings snapshot
// (lib/settingsShared.ts `Persisted` is the intersection of every app's
// slice). The defaults are spread into DEFAULTS in routes/index.tsx.

import { DEFAULT_GAMEPAD_BINDINGS_CODE } from "./bindings";

export type GamepadSettings = {
  // GAMEPAD: drive the HUD sticks and a few buttons from a game controller
  // (browser Gamepad API, also inside the Capacitor webview). On by default:
  // it does nothing until a pad is connected and a button is pressed.
  gamepadOn: boolean;
  /** Stick travel (0–0.9) ignored around center, so a worn stick doesn't drift. */
  gamepadDeadZone: number;
  /** NAV (move) strength, 1 = same as a fully pushed NAV wheel. */
  gamepadMoveSensitivity: number;
  /** LOOK (turn) strength, 1 = same as a fully pushed LOOK pad. */
  gamepadLookSensitivity: number;
  /** Flip the look stick's up/down. */
  gamepadInvertLookY: boolean;
  /** NAV multiplier while the BOOST button is held. */
  gamepadBoost: number;
  /** The button mapping, see apps/gamepad/bindings.ts for the format. */
  gamepadBindings: string;
  /** Show the floating window with the live pad state. */
  gamepadDebug: boolean;
};

export const GAMEPAD_DEFAULTS: GamepadSettings = {
  gamepadOn: true,
  gamepadDeadZone: 0.15,
  gamepadMoveSensitivity: 1,
  gamepadLookSensitivity: 1,
  gamepadInvertLookY: false,
  gamepadBoost: 2,
  gamepadBindings: DEFAULT_GAMEPAD_BINDINGS_CODE,
  gamepadDebug: false,
};

/** Every key GamepadSettings owns, in declaration order (presets, sharing). */
export const GAMEPAD_SETTING_KEYS = Object.keys(GAMEPAD_DEFAULTS) as (keyof GamepadSettings)[];
