// GAMEPAD bindings: which pad input drives which action, and how a mapping
// is stored. A mapping is kept as one string setting (gamepadBindings) so it
// persists, exports and shares like every other setting:
//
//   "moveForward=a1-,b12;moveBack=a1+,b13;boost=b0;..."
//
// `bN` is button N, `aN+` / `aN-` is axis N pushed to the plus / minus side.
// Indexes follow the W3C "standard" gamepad layout (Xbox / PlayStation /
// Switch Pro pads in Chrome, Safari, Firefox and the Android webview).

/** A single pad input: a button, or one half of an axis. */
export type GamepadBinding =
  { kind: "button"; index: number } | { kind: "axis"; index: number; dir: 1 | -1 };

/**
 * Every action a pad can drive. The half-axis actions pair up into the HUD
 * sticks (moveForward − moveBack = NAV y, and so on); the rest are buttons.
 */
export const GAMEPAD_ACTIONS = [
  "moveForward",
  "moveBack",
  "moveLeft",
  "moveRight",
  "lookUp",
  "lookDown",
  "lookLeft",
  "lookRight",
  "rise",
  "sink",
  "boost",
  "nextMode",
  "prevMode",
  "recenterLook",
  "toggleSettings",
] as const;

export type GamepadAction = (typeof GAMEPAD_ACTIONS)[number];

/** Actions that fire once per press (edge-triggered) rather than while held. */
export const GAMEPAD_PRESS_ACTIONS: readonly GamepadAction[] = [
  "nextMode",
  "prevMode",
  "recenterLook",
  "toggleSettings",
];

/** Settings-panel sections, in display order. */
export const GAMEPAD_ACTION_GROUPS: {
  id: "move" | "look" | "height" | "buttons";
  actions: GamepadAction[];
}[] = [
  { id: "move", actions: ["moveForward", "moveBack", "moveLeft", "moveRight", "boost"] },
  { id: "look", actions: ["lookUp", "lookDown", "lookLeft", "lookRight", "recenterLook"] },
  { id: "height", actions: ["rise", "sink"] },
  { id: "buttons", actions: ["nextMode", "prevMode", "toggleSettings"] },
];

export type GamepadBindings = Record<GamepadAction, GamepadBinding[]>;

/** At most this many inputs per action. */
export const MAX_BINDINGS_PER_ACTION = 3;

const b = (index: number): GamepadBinding => ({ kind: "button", index });
const a = (index: number, dir: 1 | -1): GamepadBinding => ({ kind: "axis", index, dir });

/**
 * Defaults for a standard-layout pad: left stick (and D-pad) moves, right
 * stick looks, triggers rise and sink, A boosts, bumpers step the camera
 * mode, right stick click levels the view, Start opens settings.
 */
export const DEFAULT_GAMEPAD_BINDINGS: GamepadBindings = {
  moveForward: [a(1, -1), b(12)],
  moveBack: [a(1, 1), b(13)],
  moveLeft: [a(0, -1), b(14)],
  moveRight: [a(0, 1), b(15)],
  lookUp: [a(3, -1)],
  lookDown: [a(3, 1)],
  lookLeft: [a(2, -1)],
  lookRight: [a(2, 1)],
  rise: [b(7)],
  sink: [b(6)],
  boost: [b(0), b(10)],
  nextMode: [b(5)],
  prevMode: [b(4)],
  recenterLook: [b(11)],
  toggleSettings: [b(9)],
};

export function bindingCode(x: GamepadBinding): string {
  return x.kind === "button" ? `b${x.index}` : `a${x.index}${x.dir > 0 ? "+" : "-"}`;
}

export function sameBinding(x: GamepadBinding, y: GamepadBinding): boolean {
  return bindingCode(x) === bindingCode(y);
}

function parseBinding(code: string): GamepadBinding | null {
  const m = /^(?:b(\d{1,2})|a(\d{1,2})([+-]))$/.exec(code.trim());
  if (!m) return null;
  if (m[1] !== undefined) return b(Number(m[1]));
  return a(Number(m[2]), m[3] === "+" ? 1 : -1);
}

export function encodeBindings(bindings: GamepadBindings): string {
  return GAMEPAD_ACTIONS.map(
    (act) => `${act}=${(bindings[act] ?? []).map(bindingCode).join(",")}`,
  ).join(";");
}

/**
 * Lenient decode: unknown actions and malformed inputs are dropped, and an
 * action missing from the string keeps its default (so a mapping saved by an
 * older version picks up actions added since). An action listed with nothing
 * after `=` stays unbound on purpose.
 */
export function decodeBindings(raw: unknown): GamepadBindings {
  const out = cloneBindings(DEFAULT_GAMEPAD_BINDINGS);
  if (typeof raw !== "string" || raw.trim() === "") return out;
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const act = part.slice(0, eq).trim() as GamepadAction;
    if (!(GAMEPAD_ACTIONS as readonly string[]).includes(act)) continue;
    const list: GamepadBinding[] = [];
    for (const code of part.slice(eq + 1).split(",")) {
      const parsed = code.trim() ? parseBinding(code) : null;
      if (parsed && !list.some((x) => sameBinding(x, parsed))) list.push(parsed);
    }
    out[act] = list.slice(0, MAX_BINDINGS_PER_ACTION);
  }
  return out;
}

export function cloneBindings(src: GamepadBindings): GamepadBindings {
  const out = {} as GamepadBindings;
  for (const act of GAMEPAD_ACTIONS) out[act] = (src[act] ?? []).map((x) => ({ ...x }));
  return out;
}

/** The stored default mapping string. */
export const DEFAULT_GAMEPAD_BINDINGS_CODE = encodeBindings(DEFAULT_GAMEPAD_BINDINGS);

/** Add `binding` to `act` (moving it off any other action that had it). */
export function bindInput(
  bindings: GamepadBindings,
  act: GamepadAction,
  binding: GamepadBinding,
): GamepadBindings {
  const out = cloneBindings(bindings);
  for (const other of GAMEPAD_ACTIONS)
    out[other] = out[other].filter((x) => !sameBinding(x, binding));
  out[act] = [...out[act], binding].slice(-MAX_BINDINGS_PER_ACTION);
  return out;
}

export function unbindInput(
  bindings: GamepadBindings,
  act: GamepadAction,
  binding: GamepadBinding,
): GamepadBindings {
  const out = cloneBindings(bindings);
  out[act] = out[act].filter((x) => !sameBinding(x, binding));
  return out;
}

// Names for the standard layout's buttons, Xbox first with the PlayStation
// name after it where they differ.
const STANDARD_BUTTON_NAMES = [
  "A / ✕",
  "B / ○",
  "X / □",
  "Y / △",
  "LB / L1",
  "RB / R1",
  "LT / L2",
  "RT / R2",
  "Back / Share",
  "Start / Options",
  "L3",
  "R3",
  "D-pad ↑",
  "D-pad ↓",
  "D-pad ←",
  "D-pad →",
  "Home / PS",
];

const STANDARD_AXIS_NAMES: Record<string, string> = {
  "0-": "L stick ←",
  "0+": "L stick →",
  "1-": "L stick ↑",
  "1+": "L stick ↓",
  "2-": "R stick ←",
  "2+": "R stick →",
  "3-": "R stick ↑",
  "3+": "R stick ↓",
};

/** A readable label for a binding (standard layout names, else the raw index). */
export function bindingLabel(x: GamepadBinding): string {
  if (x.kind === "button") return STANDARD_BUTTON_NAMES[x.index] ?? `Button ${x.index}`;
  const key = `${x.index}${x.dir > 0 ? "+" : "-"}`;
  return STANDARD_AXIS_NAMES[key] ?? `Axis ${x.index} ${x.dir > 0 ? "+" : "−"}`;
}
