import { describe, expect, test } from "bun:test";
import {
  DECORATION_DATA_PREFIX,
  DECORATION_EMBED_MAX_BYTES,
  DECORATION_MAX_COPIES,
  clampRepeatCount,
  decorationsForLink,
  mergeLinkedDecorations,
  sanitizeDecorations,
  type Decoration,
} from "./decorations";

const deco = (id: string, src: string, size = 100): Decoration => ({
  id,
  name: id,
  src,
  size,
  visible: true,
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  repeat: { count: [1, 1, 1], spacing: [2, 2, 2], stepRotY: 0, stepScale: 1 },
});
const embedded = (id: string, size = 100) => deco(id, `${DECORATION_DATA_PREFIX}AAAA`, size);
const local = (id: string) => deco(id, `local:deco:${id}`, 5_000_000);

describe("sanitizeDecorations", () => {
  test("keeps valid entries and drops junk", () => {
    const out = sanitizeDecorations({
      a: [embedded("x"), { src: "https://evil/x.glb" }, null, local("y")],
      b: "nope",
    });
    expect(out.a.map((d) => d.id)).toEqual(["x", "y"]);
    expect(out.b).toBeUndefined();
  });
  test("refuses oversized embedded models", () => {
    const big = "A".repeat(Math.ceil((DECORATION_EMBED_MAX_BYTES * 4) / 3) + 400);
    expect(sanitizeDecorations({ a: [deco("x", DECORATION_DATA_PREFIX + big)] })).toEqual({});
  });
  test("clamps repeat counts to the copy cap", () => {
    const c = clampRepeatCount([50, 50, 50]);
    expect(c[0] * c[1] * c[2]).toBeLessThanOrEqual(DECORATION_MAX_COPIES);
  });
});

describe("links", () => {
  test("carry only the scene's embedded models", () => {
    const r = decorationsForLink({ s1: [embedded("e"), local("l")], s2: [embedded("o")] }, "s1");
    expect(Object.keys(r.decorations)).toEqual(["s1"]);
    expect(r.decorations.s1.map((d) => d.id)).toEqual(["e"]);
    expect(r.droppedLocal).toBe(1);
  });
  test("keep the visitor's other scenes when opened", () => {
    const merged = mergeLinkedDecorations(
      { s1: [local("mine")], s2: [local("keep")] },
      {
        s1: [embedded("theirs")],
      },
    );
    expect(merged.s1.map((d) => d.id)).toEqual(["theirs"]);
    expect(merged.s2.map((d) => d.id)).toEqual(["keep"]);
  });
});
