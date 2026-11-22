import { describe, expect, test } from "bun:test";
import { buildLibraryFilePayload, downloadJsonFile, type SavedState } from "./presets";

describe("saved library export", () => {
  test("includes every saved state in the library file", () => {
    const states: SavedState[] = [
      { id: "first", name: "First", savedAt: "2026-01-01T00:00:00.000Z", data: { value: 1 } },
      { id: "second", name: "Second", savedAt: "2026-01-02T00:00:00.000Z", data: { value: 2 } },
    ];

    expect(
      buildLibraryFilePayload({ presets: [], states, scenery: [] }).states,
    ).toEqual(states);
  });

  test("returns failure instead of throwing when saved data cannot be serialized", async () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(await downloadJsonFile("saved.json", circular)).toBe(false);
  });
});
