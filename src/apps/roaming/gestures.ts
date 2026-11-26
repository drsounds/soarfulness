// ROAMING gestures: which Roaming motion (a "gesture") drives which action
// here, and how that mapping is stored. Like the GAMEPAD button mapping it is
// one string setting (roamingGestureMap), kept on this device:
//
//   "walking=move;raising:up=waveHeightUp;squatting=none;..."
//
// A gesture is a Roaming motion_type, plus the direction for the ones where
// the direction is the point (leaning left/right and the camera-mode
// "raising" gestures up/down/left/right). See the Roaming README:
// https://github.com/drsounds/roaming-android-app#camera-gestures-raising-up-down-left-and-right

import type { RoamingMotionEvent } from "./RoamingMotion";

export const ROAMING_GESTURES = [
  "step",
  "walking",
  "running",
  "leaning:left",
  "leaning:right",
  "jumping",
  "squatting",
  "arms_raised",
  "raising:up",
  "raising:down",
  "raising:left",
  "raising:right",
] as const;

export type RoamingGesture = (typeof ROAMING_GESTURES)[number];

/**
 * What a gesture can do. `move` follows the motion's own direction (walking
 * and running go forward or steer, leaning sidesteps), the other move* go one
 * way at the motion's intensity; these last while the motion lasts. The rest
 * are one-shot actions: fired when the gesture starts and repeated every
 * roamingRepeat seconds while it is held.
 */
export const ROAMING_ACTIONS = [
  "none",
  "move",
  "moveForward",
  "moveBack",
  "moveLeft",
  "moveRight",
  "waveHeightUp",
  "waveHeightDown",
  "waveDirLeft",
  "waveDirRight",
  "swayMore",
  "swayLess",
  "swayDirLeft",
  "swayDirRight",
] as const;

export type RoamingAction = (typeof ROAMING_ACTIONS)[number];

/** Actions that move the bather while the motion lasts. */
export const ROAMING_MOVE_ACTIONS: readonly RoamingAction[] = [
  "move",
  "moveForward",
  "moveBack",
  "moveLeft",
  "moveRight",
];

/** One-shot actions (everything but none and the move actions). */
export type RoamingPressAction = Exclude<
  RoamingAction,
  "none" | "move" | "moveForward" | "moveBack" | "moveLeft" | "moveRight"
>;

export function isPressAction(a: RoamingAction): a is RoamingPressAction {
  return a !== "none" && !ROAMING_MOVE_ACTIONS.includes(a);
}

/** Groups for the action picker, in display order. */
export const ROAMING_ACTION_GROUPS: { id: "move" | "waves" | "sway"; actions: RoamingAction[] }[] =
  [
    { id: "move", actions: ["move", "moveForward", "moveBack", "moveLeft", "moveRight"] },
    { id: "waves", actions: ["waveHeightUp", "waveHeightDown", "waveDirLeft", "waveDirRight"] },
    { id: "sway", actions: ["swayMore", "swayLess", "swayDirLeft", "swayDirRight"] },
  ];

/** Groups for the gesture list, in display order. */
export const ROAMING_GESTURE_GROUPS: {
  id: "walk" | "body" | "raise";
  gestures: RoamingGesture[];
}[] = [
  { id: "walk", gestures: ["step", "walking", "running", "leaning:left", "leaning:right"] },
  { id: "body", gestures: ["jumping", "squatting", "arms_raised"] },
  { id: "raise", gestures: ["raising:up", "raising:down", "raising:left", "raising:right"] },
];

export type RoamingGestureMap = Record<RoamingGesture, RoamingAction>;

/**
 * Defaults: walking, running and leaning move you as before; the camera
 * gestures raise / lower the waves (arm up / hands down) and turn them (arm
 * out left / right); both arms up adds sway and a squat takes it away.
 */
export const DEFAULT_ROAMING_GESTURE_MAP: RoamingGestureMap = {
  step: "move",
  walking: "move",
  running: "move",
  "leaning:left": "move",
  "leaning:right": "move",
  jumping: "none",
  squatting: "swayLess",
  arms_raised: "swayMore",
  "raising:up": "waveHeightUp",
  "raising:down": "waveHeightDown",
  "raising:left": "waveDirLeft",
  "raising:right": "waveDirRight",
};

export function encodeGestureMap(map: RoamingGestureMap): string {
  return ROAMING_GESTURES.map((g) => `${g}=${map[g] ?? "none"}`).join(";");
}

/**
 * Lenient decode: unknown gestures and actions are dropped, and a gesture
 * missing from the string keeps its default (so a map saved by an older
 * version picks up gestures added since).
 */
export function decodeGestureMap(raw: unknown): RoamingGestureMap {
  const out: RoamingGestureMap = { ...DEFAULT_ROAMING_GESTURE_MAP };
  if (typeof raw !== "string" || raw.trim() === "") return out;
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const g = part.slice(0, eq).trim() as RoamingGesture;
    const a = part.slice(eq + 1).trim() as RoamingAction;
    if (!(ROAMING_GESTURES as readonly string[]).includes(g)) continue;
    if (!(ROAMING_ACTIONS as readonly string[]).includes(a)) continue;
    out[g] = a;
  }
  return out;
}

export const DEFAULT_ROAMING_GESTURE_MAP_CODE = encodeGestureMap(DEFAULT_ROAMING_GESTURE_MAP);

/** Change one gesture's action in a stored map string. */
export function setGestureAction(code: string, g: RoamingGesture, a: RoamingAction): string {
  return encodeGestureMap({ ...decodeGestureMap(code), [g]: a });
}

/** The gesture an event is, or null (idle, or a direction that isn't one). */
export function gestureFor(e: RoamingMotionEvent): RoamingGesture | null {
  switch (e.motionType) {
    case "idle":
      return null;
    case "leaning":
      return e.direction === "left" || e.direction === "right" ? `leaning:${e.direction}` : null;
    case "raising":
      return e.direction === "up" ||
        e.direction === "down" ||
        e.direction === "left" ||
        e.direction === "right"
        ? `raising:${e.direction}`
        : null;
    default:
      return e.motionType;
  }
}
