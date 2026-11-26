import {
  gestureFor,
  isPressAction,
  type RoamingAction,
  type RoamingGesture,
  type RoamingGestureMap,
  type RoamingPressAction,
} from "./gestures";
import {
  targetFor,
  targetToward,
  type RoamingMotionEvent,
  type RoamingSpeeds,
} from "./RoamingMotion";

/** How one event is handled: its gesture, the mapped action and the movement target. */
export type RoamingRoute = {
  gesture: RoamingGesture | null;
  action: RoamingAction;
  /** Body-frame target as a share of top speed (zero unless a move action). */
  target: { x: number; z: number };
};

/** Resolve one event through the gesture map. */
export function routeEvent(
  e: RoamingMotionEvent,
  map: Readonly<RoamingGestureMap>,
  sideways: boolean,
  speeds: RoamingSpeeds,
): RoamingRoute {
  const gesture = gestureFor(e);
  const action: RoamingAction = gesture ? map[gesture] : "none";
  let target = { x: 0, z: 0 };
  if (action === "move") target = targetFor(e, sideways, speeds);
  else if (action === "moveForward") target = targetToward(e, "forward", speeds);
  else if (action === "moveBack") target = targetToward(e, "back", speeds);
  else if (action === "moveLeft") target = targetToward(e, "left", speeds);
  else if (action === "moveRight") target = targetToward(e, "right", speeds);
  return { gesture, action, target };
}

/** A gesture held longer than this without any new event is dropped (missed broadcast). */
export const HOLD_STALE_AFTER = 15;

/**
 * The one-shot side of the gesture map: fires a gesture's action when the
 * gesture starts and, while it is held (Roaming sends nothing new until the
 * motion changes), again every `repeat` seconds. A new event for the same
 * gesture (its intensity changed) keeps the hold going without firing again.
 */
export class RoamingGestures {
  private held: { gesture: RoamingGesture; action: RoamingPressAction } | null = null;
  private sinceFire = 0;
  private sinceEvent = 0;
  private queue: RoamingPressAction[] = [];

  /** The gesture currently held with a one-shot action, if any. */
  get holding(): RoamingGesture | null {
    return this.held?.gesture ?? null;
  }

  /** Feed one routed event. Returns true when it fired its action right away. */
  onEvent(route: RoamingRoute): boolean {
    this.sinceEvent = 0;
    const { gesture, action } = route;
    if (!gesture || !isPressAction(action)) {
      this.held = null;
      return false;
    }
    if (this.held && this.held.gesture === gesture && this.held.action === action) return false;
    this.held = { gesture, action };
    this.sinceFire = 0;
    this.queue.push(action);
    return true;
  }

  /** Advance the hold clock; queues repeats. `repeat` <= 0 means no repeat. */
  tick(dt: number, repeat: number) {
    if (!this.held || !(dt > 0)) return;
    this.sinceEvent += dt;
    if (this.sinceEvent > HOLD_STALE_AFTER) {
      this.held = null;
      return;
    }
    if (!(repeat > 0)) return;
    this.sinceFire += dt;
    // Repeat at most a few times per tick, so a long frame doesn't flood.
    for (let n = 0; this.sinceFire >= repeat && n < 4; n++) {
      this.sinceFire -= repeat;
      this.queue.push(this.held.action);
    }
    if (this.sinceFire >= repeat) this.sinceFire = 0;
  }

  /** The actions fired since the last call (oldest first). */
  take(): RoamingPressAction[] {
    if (this.queue.length === 0) return [];
    const out = this.queue;
    this.queue = [];
    return out;
  }

  reset() {
    this.held = null;
    this.sinceFire = 0;
    this.sinceEvent = 0;
    this.queue = [];
  }
}
