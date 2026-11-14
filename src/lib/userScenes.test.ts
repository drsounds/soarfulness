import { describe, expect, test } from "bun:test";
import { UserSceneError, isUserSceneId, sceneNameFromFile, validateGlb } from "./userScenes";

// Builds a minimal binary glTF: 12-byte header + one JSON chunk.
function glb(json: unknown, { version = 2, magic = 0x46546c67, lengthDelta = 0 } = {}) {
  let text = JSON.stringify(json);
  while (text.length % 4) text += " ";
  const jsonBytes = new TextEncoder().encode(text);
  const total = 12 + 8 + jsonBytes.length;
  const buf = new ArrayBuffer(total);
  const view = new DataView(buf);
  view.setUint32(0, magic, true);
  view.setUint32(4, version, true);
  view.setUint32(8, total + lengthDelta, true);
  view.setUint32(12, jsonBytes.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(buf, 20).set(jsonBytes);
  return buf;
}

const codeOf = (fn: () => void) => {
  try {
    fn();
    return null;
  } catch (err) {
    return err instanceof UserSceneError ? err.code : "other";
  }
};

describe("validateGlb", () => {
  test("accepts a glTF 2.0 binary", () => {
    expect(codeOf(() => validateGlb(glb({ asset: { version: "2.0" } })))).toBeNull();
  });
  test("rejects empty and non-glb data", () => {
    expect(codeOf(() => validateGlb(new ArrayBuffer(0)))).toBe("empty");
    expect(codeOf(() => validateGlb(new TextEncoder().encode("{}".padEnd(40)).buffer))).toBe(
      "notGlb",
    );
    expect(codeOf(() => validateGlb(glb({ asset: { version: "2.0" } }, { magic: 1 })))).toBe(
      "notGlb",
    );
  });
  test("rejects glTF 1.0", () => {
    expect(codeOf(() => validateGlb(glb({ asset: { version: "2.0" } }, { version: 1 })))).toBe(
      "unsupportedVersion",
    );
    expect(codeOf(() => validateGlb(glb({ asset: { version: "1.0" } })))).toBe(
      "unsupportedVersion",
    );
  });
  test("rejects truncated files", () => {
    expect(
      codeOf(() => validateGlb(glb({ asset: { version: "2.0" } }, { lengthDelta: 100 }))),
    ).toBe("corrupt");
  });
});

describe("helpers", () => {
  test("sceneNameFromFile strips the extension and path", () => {
    expect(sceneNameFromFile("My Beach.glb")).toBe("My Beach");
    expect(sceneNameFromFile("C:\\models\\pier.GLB")).toBe("pier");
    expect(sceneNameFromFile(".glb")).toBe("GLB");
  });
  test("isUserSceneId", () => {
    expect(isUserSceneId("user:abc")).toBe(true);
    expect(isUserSceneId("Strandpark2")).toBe(false);
    expect(isUserSceneId(null)).toBe(false);
  });
});
