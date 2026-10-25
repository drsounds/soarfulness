import { describe, expect, test } from "bun:test";
import {
  fingerprint,
  mergeRemote,
  pendingChanges,
  type LocalItem,
  type RemoteSave,
} from "./spacifySync";

const item = (id: string, name = id, data: Record<string, unknown> = { v: 1 }): LocalItem => ({
  id,
  name,
  savedAt: "2026-10-25T10:00:00.000Z",
  data,
});
// What Postgres hands back: another timestamp format and reordered keys.
const remote = (i: LocalItem, patch: Partial<RemoteSave> = {}): RemoteSave => ({
  local_id: i.id,
  kind: "state",
  name: i.name,
  scope: i.scope ?? null,
  saved_at: "2026-10-25T10:00:00+00:00",
  data: Object.fromEntries(Object.entries(i.data as Record<string, unknown>).reverse()),
  ...patch,
});
const syncedOf = (...items: LocalItem[]) =>
  Object.fromEntries(items.map((i) => [i.id, fingerprint(i)]));

describe("mergeRemote + pendingChanges", () => {
  test("first sign-in: local items are pushed, remote ones added", () => {
    const a = item("a");
    const b = item("b");
    const merged = mergeRemote([a], [remote(b)], {});
    expect(merged.list.map((i) => i.id)).toEqual(["a", "b"]);
    expect(pendingChanges(merged.list, merged.synced)).toEqual({ puts: [a], deletes: [] });
  });

  test("the same item on both sides is in sync despite key order and timestamp format", () => {
    const a = item("a", "a", { x: 1, y: { b: 2, a: 1 } });
    const merged = mergeRemote([a], [remote(a)], {});
    expect(merged.changed).toBe(false);
    expect(pendingChanges(merged.list, merged.synced)).toEqual({ puts: [], deletes: [] });
  });

  test("deleted elsewhere: removed here", () => {
    const a = item("a");
    const merged = mergeRemote([a], [], syncedOf(a));
    expect(merged.list).toEqual([]);
    expect(pendingChanges(merged.list, merged.synced)).toEqual({ puts: [], deletes: [] });
  });

  test("deleted here while offline: deleted there", () => {
    const a = item("a");
    const merged = mergeRemote([], [remote(a)], syncedOf(a));
    expect(merged.list).toEqual([]);
    expect(pendingChanges(merged.list, merged.synced)).toEqual({ puts: [], deletes: ["a"] });
  });

  test("renamed elsewhere: taken here", () => {
    const a = item("a");
    const merged = mergeRemote([a], [remote(a, { name: "Renamed" })], syncedOf(a));
    expect(merged.list[0].name).toBe("Renamed");
    expect(pendingChanges(merged.list, merged.synced)).toEqual({ puts: [], deletes: [] });
  });

  test("changed here only: pushed", () => {
    const a = item("a");
    const edited = { ...a, name: "Edited" };
    const merged = mergeRemote([edited], [remote(a)], syncedOf(a));
    expect(merged.list[0].name).toBe("Edited");
    expect(pendingChanges(merged.list, merged.synced).puts).toEqual([edited]);
  });

  test("changed on both sides: Spacify's wins", () => {
    const a = item("a");
    const merged = mergeRemote(
      [{ ...a, name: "Here" }],
      [remote(a, { name: "There" })],
      syncedOf(a),
    );
    expect(merged.list[0].name).toBe("There");
    expect(pendingChanges(merged.list, merged.synced)).toEqual({ puts: [], deletes: [] });
  });

  test("an empty save made in Spacify's UI isn't added", () => {
    const merged = mergeRemote([], [remote(item("e", "Empty", {}))], {});
    expect(merged.list).toEqual([]);
  });

  test("a preset keeps its scope", () => {
    const p = { ...item("p"), scope: "waves" };
    const merged = mergeRemote<LocalItem>([], [{ ...remote(p), kind: "preset" }], {});
    expect(merged.list[0].scope).toBe("waves");
  });
});
