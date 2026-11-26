import { describe, expect, test } from "bun:test";
import {
  DEFAULT_GAMEPAD_BINDINGS,
  DEFAULT_GAMEPAD_BINDINGS_CODE,
  bindInput,
  decodeBindings,
  encodeBindings,
  unbindInput,
} from "./bindings";
import { newlyPushed } from "./gamepadInput";
import { GamepadMapper, axisValue, type MapperOptions, type PadSnapshot } from "./GamepadMapper";

const opt: MapperOptions = {
  deadZone: 0.15,
  moveSensitivity: 1,
  lookSensitivity: 1,
  invertLookY: false,
  boost: 2,
};

function pad(
  axes: number[] = [0, 0, 0, 0],
  pressed: number[] = [],
  values: Record<number, number> = {},
): PadSnapshot {
  return {
    axes,
    buttons: Array.from({ length: 17 }, (_, i) => ({
      pressed: pressed.includes(i) || (values[i] ?? 0) > 0.5,
      value: values[i] ?? (pressed.includes(i) ? 1 : 0),
    })),
  };
}

describe("bindings", () => {
  test("default mapping round-trips", () => {
    expect(decodeBindings(DEFAULT_GAMEPAD_BINDINGS_CODE)).toEqual(DEFAULT_GAMEPAD_BINDINGS);
    expect(decodeBindings("")).toEqual(DEFAULT_GAMEPAD_BINDINGS);
    expect(decodeBindings(42)).toEqual(DEFAULT_GAMEPAD_BINDINGS);
  });

  test("missing actions keep their defaults, empty ones stay unbound, junk is dropped", () => {
    const b = decodeBindings("boost=b3,zz,a9+;rise=;nope=b1");
    expect(b.boost).toEqual([
      { kind: "button", index: 3 },
      { kind: "axis", index: 9, dir: 1 },
    ]);
    expect(b.rise).toEqual([]);
    expect(b.sink).toEqual(DEFAULT_GAMEPAD_BINDINGS.sink);
  });

  test("binding an input moves it off the action that had it", () => {
    const b = bindInput(DEFAULT_GAMEPAD_BINDINGS, "rise", { kind: "button", index: 0 });
    expect(b.rise.map((x) => x.kind === "button" && x.index)).toEqual([7, 0]);
    expect(b.boost).toEqual([{ kind: "button", index: 10 }]);
    const c = unbindInput(b, "rise", { kind: "button", index: 7 });
    expect(c.rise).toEqual([{ kind: "button", index: 0 }]);
    expect(decodeBindings(encodeBindings(c))).toEqual(c);
  });
});

describe("mapper", () => {
  test("no pads: idle", () => {
    const f = new GamepadMapper().map([], DEFAULT_GAMEPAD_BINDINGS, opt);
    expect(f.connected).toBe(false);
    expect(f.move).toEqual({ x: 0, y: 0 });
  });

  test("dead zone and rescale", () => {
    expect(axisValue(0.1, 1, 0.15)).toBe(0);
    expect(axisValue(-0.1, -1, 0.15)).toBe(0);
    expect(axisValue(1, 1, 0.15)).toBe(1);
    expect(axisValue(0.575, 1, 0.15)).toBeCloseTo(0.5);
    expect(axisValue(-1, 1, 0.15)).toBe(0);
  });

  test("left stick up moves forward, right stick looks, triggers rise and sink", () => {
    const m = new GamepadMapper();
    const f = m.map(
      [pad([0.05, -1, 1, -1], [], { 7: 0.8, 6: 0.2 })],
      DEFAULT_GAMEPAD_BINDINGS,
      opt,
    );
    expect(f.connected).toBe(true);
    expect(f.move.x).toBe(0);
    expect(f.move.y).toBeCloseTo(1);
    expect(f.look.x).toBeCloseTo(Math.SQRT1_2);
    expect(f.look.y).toBeCloseTo(Math.SQRT1_2);
    expect(f.rise).toBeCloseTo(0.6);
  });

  test("D-pad and stick together don't exceed 1; boost multiplies", () => {
    const m = new GamepadMapper();
    expect(m.map([pad([0, -1, 0, 0], [12])], DEFAULT_GAMEPAD_BINDINGS, opt).move.y).toBeCloseTo(1);
    const f = m.map([pad([0, -1, 0, 0], [0])], DEFAULT_GAMEPAD_BINDINGS, opt);
    expect(f.boost).toBe(true);
    expect(f.move.y).toBeCloseTo(2);
  });

  test("invert look Y and sensitivity", () => {
    const f = new GamepadMapper().map([pad([0, 0, 0, -1])], DEFAULT_GAMEPAD_BINDINGS, {
      ...opt,
      invertLookY: true,
      lookSensitivity: 0.5,
    });
    expect(f.look.y).toBeCloseTo(-0.5);
  });

  test("button actions fire once per press", () => {
    const m = new GamepadMapper();
    expect(m.map([pad([0, 0, 0, 0], [5])], DEFAULT_GAMEPAD_BINDINGS, opt).pressed).toEqual([
      "nextMode",
    ]);
    expect(m.map([pad([0, 0, 0, 0], [5])], DEFAULT_GAMEPAD_BINDINGS, opt).pressed).toEqual([]);
    expect(m.map([pad()], DEFAULT_GAMEPAD_BINDINGS, opt).pressed).toEqual([]);
    expect(m.map([pad([0, 0, 0, 0], [5, 9])], DEFAULT_GAMEPAD_BINDINGS, opt).pressed).toEqual([
      "nextMode",
      "toggleSettings",
    ]);
  });

  test("two pads: the stronger input wins", () => {
    const f = new GamepadMapper().map(
      [pad([0, -0.5, 0, 0]), pad([0, -1, 0, 0])],
      DEFAULT_GAMEPAD_BINDINGS,
      opt,
    );
    expect(f.move.y).toBeCloseTo(1);
  });
});

describe("capture", () => {
  test("picks the first new button or stick push, ignoring what was already held", () => {
    expect(newlyPushed(pad([0, 0, 0, 0], [3]), pad([0, 0, 0, 0], [3]))).toBeNull();
    expect(newlyPushed(pad([0, 0, 0, 0], [3]), pad([0, 0, 0, 0], [3, 6]))).toEqual({
      kind: "button",
      index: 6,
    });
    expect(newlyPushed(pad(), pad([0, 0, 0.9, 0]))).toEqual({ kind: "axis", index: 2, dir: 1 });
    expect(newlyPushed(pad(), pad([0, -0.7, 0, 0]))).toEqual({ kind: "axis", index: 1, dir: -1 });
    expect(newlyPushed(undefined, pad([0.3, 0, 0, 0]))).toBeNull();
  });
});
