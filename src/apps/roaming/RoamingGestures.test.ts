import { describe, expect, test } from "bun:test";
import {
  DEFAULT_ROAMING_GESTURE_MAP,
  DEFAULT_ROAMING_GESTURE_MAP_CODE,
  ROAMING_GESTURES,
  decodeGestureMap,
  encodeGestureMap,
  gestureFor,
  setGestureAction,
} from "./gestures";
import { RoamingGestures, routeEvent } from "./RoamingGestures";
import { DEFAULT_ROAMING_SPEEDS, type RoamingMotionEvent } from "./RoamingMotion";
import { parseRoamingMotion } from "./roamingBridge";

const ev = (motionType: string, direction = "none", intensity = 0.8): RoamingMotionEvent =>
  parseRoamingMotion({ motion_type: motionType, direction, intensity });

describe("gesture map", () => {
  test("default round-trips and covers every gesture", () => {
    const decoded = decodeGestureMap(DEFAULT_ROAMING_GESTURE_MAP_CODE);
    expect(decoded).toEqual(DEFAULT_ROAMING_GESTURE_MAP);
    for (const g of ROAMING_GESTURES) expect(DEFAULT_ROAMING_GESTURE_MAP_CODE).toContain(`${g}=`);
  });

  test("decode is lenient: junk dropped, missing gestures keep defaults", () => {
    const m = decodeGestureMap("raising:up=swayMore;bogus=move;walking=flyAway;;jumping");
    expect(m["raising:up"]).toBe("swayMore");
    expect(m.walking).toBe("move");
    expect(m.jumping).toBe(DEFAULT_ROAMING_GESTURE_MAP.jumping);
    expect(decodeGestureMap(42)).toEqual(DEFAULT_ROAMING_GESTURE_MAP);
  });

  test("setGestureAction changes one gesture", () => {
    const code = setGestureAction(DEFAULT_ROAMING_GESTURE_MAP_CODE, "jumping", "waveHeightUp");
    expect(decodeGestureMap(code)).toEqual({
      ...DEFAULT_ROAMING_GESTURE_MAP,
      jumping: "waveHeightUp",
    });
    expect(encodeGestureMap(decodeGestureMap(code))).toBe(code);
  });

  test("gestureFor uses the direction for leaning and raising", () => {
    expect(gestureFor(ev("idle"))).toBeNull();
    expect(gestureFor(ev("walking", "left"))).toBe("walking");
    expect(gestureFor(ev("leaning", "right"))).toBe("leaning:right");
    expect(gestureFor(ev("leaning", "none"))).toBeNull();
    expect(gestureFor(ev("raising", "up"))).toBe("raising:up");
    expect(gestureFor(ev("raising", "down"))).toBe("raising:down");
    expect(gestureFor(ev("raising", "forward"))).toBeNull();
  });

  test("the bridge knows the new raising type", () => {
    expect(ev("raising", "left").motionType).toBe("raising");
  });
});

describe("routeEvent", () => {
  const S = DEFAULT_ROAMING_SPEEDS;

  test("defaults: walking moves, camera gestures drive waves", () => {
    const walk = routeEvent(ev("walking", "forward", 0.5), DEFAULT_ROAMING_GESTURE_MAP, true, S);
    expect(walk.action).toBe("move");
    expect(walk.target.z).toBeCloseTo(0.5);
    const up = routeEvent(ev("raising", "up"), DEFAULT_ROAMING_GESTURE_MAP, true, S);
    expect(up).toEqual({ gesture: "raising:up", action: "waveHeightUp", target: { x: 0, z: 0 } });
    expect(routeEvent(ev("raising", "left"), DEFAULT_ROAMING_GESTURE_MAP, true, S).action).toBe(
      "waveDirLeft",
    );
  });

  test("walk / run / lean speeds scale the target", () => {
    const speeds = { walk: 0.5, running: 2, lean: 1 };
    const m = DEFAULT_ROAMING_GESTURE_MAP;
    expect(routeEvent(ev("walking", "forward", 1), m, true, speeds).target.z).toBeCloseTo(0.5);
    expect(routeEvent(ev("running", "forward", 1), m, true, speeds).target.z).toBeCloseTo(2);
    expect(routeEvent(ev("leaning", "left", 0.6), m, true, speeds).target.x).toBeCloseTo(-0.6);
  });

  test("a gesture can be mapped to a fixed move direction", () => {
    const m = decodeGestureMap("raising:left=moveLeft;jumping=moveForward");
    expect(routeEvent(ev("raising", "left", 0.5), m, true, S).target).toEqual({ x: -0.5, z: 0 });
    expect(routeEvent(ev("jumping", "up", 1), m, true, S).target).toEqual({ x: 0, z: 1 });
  });

  test("walking mapped to none doesn't move", () => {
    const m = decodeGestureMap("walking=none");
    expect(routeEvent(ev("walking", "forward", 1), m, true, S).target).toEqual({ x: 0, z: 0 });
  });
});

describe("RoamingGestures", () => {
  const route = (e: RoamingMotionEvent) =>
    routeEvent(e, DEFAULT_ROAMING_GESTURE_MAP, true, DEFAULT_ROAMING_SPEEDS);

  test("fires once at the start of a gesture, not again for the same gesture", () => {
    const g = new RoamingGestures();
    expect(g.onEvent(route(ev("raising", "up", 0.5)))).toBe(true);
    expect(g.onEvent(route(ev("raising", "up", 0.9)))).toBe(false); // intensity update
    expect(g.take()).toEqual(["waveHeightUp"]);
    expect(g.take()).toEqual([]);
  });

  test("repeats while held, stops when released", () => {
    const g = new RoamingGestures();
    g.onEvent(route(ev("raising", "right")));
    for (let i = 0; i < 100; i++) g.tick(0.01, 0.5); // 1 s
    expect(g.take()).toEqual(["waveDirRight", "waveDirRight", "waveDirRight"]);
    g.onEvent(route(ev("idle")));
    expect(g.holding).toBeNull();
    for (let i = 0; i < 100; i++) g.tick(0.01, 0.5);
    expect(g.take()).toEqual([]);
  });

  test("repeat 0 fires only once", () => {
    const g = new RoamingGestures();
    g.onEvent(route(ev("arms_raised", "up")));
    g.tick(5, 0);
    expect(g.take()).toEqual(["swayMore"]);
  });

  test("a move gesture ends the hold", () => {
    const g = new RoamingGestures();
    g.onEvent(route(ev("squatting", "down")));
    expect(g.holding).toBe("squatting");
    g.onEvent(route(ev("walking", "forward")));
    expect(g.holding).toBeNull();
    expect(g.take()).toEqual(["swayLess"]);
  });

  test("switching gestures fires the new one", () => {
    const g = new RoamingGestures();
    g.onEvent(route(ev("raising", "up")));
    g.onEvent(route(ev("raising", "down")));
    expect(g.take()).toEqual(["waveHeightUp", "waveHeightDown"]);
  });

  test("a hold with no events for a long time is dropped", () => {
    const g = new RoamingGestures();
    g.onEvent(route(ev("raising", "up")));
    g.take();
    g.tick(16, 0);
    expect(g.holding).toBeNull();
  });
});
