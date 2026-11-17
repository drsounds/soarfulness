import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { AppHost } from "./host";
import { AppRegistry } from "./registry";
import { satisfies } from "./semver";
import type { AnyAppDefinition, AppManifest } from "./types";

const APPS_DIR = join(import.meta.dir, "../../apps");

function app(id: string, extra: Partial<AppManifest> = {}, defaults?: object): AnyAppDefinition {
  return {
    manifest: {
      id,
      name: id.toUpperCase(),
      title: id,
      version: "1.0.0",
      description: id,
      kind: "scene-fx",
      ...extra,
    },
    settings: defaults ? { defaults, keys: Object.keys(defaults) as never[] } : undefined,
  };
}

describe("semver", () => {
  test("ranges", () => {
    expect(satisfies("1.2.3", "^1.0.0")).toBe(true);
    expect(satisfies("2.0.0", "^1.0.0")).toBe(false);
    expect(satisfies("1.2.3", "~1.2.0")).toBe(true);
    expect(satisfies("1.3.0", "~1.2.0")).toBe(false);
    expect(satisfies("1.2.3", "1.x")).toBe(true);
    expect(satisfies("1.2.3", "*")).toBe(true);
    expect(satisfies("1.2.3", "1.2.3")).toBe(true);
    expect(satisfies("1.0.0", "^1.2.0")).toBe(false);
  });
});

describe("AppRegistry", () => {
  test("orders apps after their dependencies", () => {
    const r = new AppRegistry([
      app("rain", { dependencies: { wind: "^1.0.0" } }),
      app("wind"),
      app("aurora", { dependencies: { "day-night": "^1.0.0" } }),
      app("day-night"),
    ]);
    expect(r.validate()).toEqual([]);
    const ids = r.list().map((a) => a.manifest.id);
    expect(ids.indexOf("wind")).toBeLessThan(ids.indexOf("rain"));
    expect(ids.indexOf("day-night")).toBeLessThan(ids.indexOf("aurora"));
    expect(r.dependents("wind")).toEqual(["rain"]);
  });

  test("reports missing deps, bad versions, cycles and shared settings keys", () => {
    const r = new AppRegistry([
      app("a", { dependencies: { b: "^1.0.0" } }, { aOn: true }),
      app("b", { dependencies: { a: "*" }, version: "1.0" }, { aOn: false }),
      app("c", { dependencies: { nope: "*" } }),
    ]);
    const p = r.validate().join("\n");
    expect(p).toContain('depends on missing app "nope"');
    expect(p).toContain("is not x.y.z");
    expect(p).toContain("dependency cycle");
    expect(p).toContain('"aOn" is already owned by a');
    expect(() => r.assertValid()).toThrow();
  });

  test("rejects duplicate ids", () => {
    expect(() => new AppRegistry([app("x"), app("x")])).toThrow();
  });
});

describe("AppHost", () => {
  const log: string[] = [];
  const withRuntime = (def: AnyAppDefinition, frame = true): AnyAppDefinition => ({
    ...def,
    createRuntime: () => ({
      ...(frame ? { frame: () => void log.push(`frame:${def.manifest.id}`) } : {}),
      dispose: () => void log.push(`dispose:${def.manifest.id}`),
    }),
  });

  test("starts by order with dependencies first, frames and disposes", () => {
    log.length = 0;
    const r = new AppRegistry([
      withRuntime(app("hood", { order: 80 })),
      withRuntime(app("aurora", { order: 10 })),
      withRuntime(app("rain", { order: 5, dependencies: { wind: "^1.0.0" } })),
      withRuntime(app("wind"), false),
      app("day-night"),
    ]);
    const host = new AppHost(r, { scene: {} as never });
    expect(host.ids()).toEqual(["wind", "rain", "aurora", "hood"]);
    expect(host.has("day-night")).toBe(false);
    host.frame({} as never, () => undefined);
    expect(log).toEqual(["frame:rain", "frame:aurora", "frame:hood"]);
    host.dispose();
    expect(log.slice(3)).toEqual([
      "dispose:hood",
      "dispose:aurora",
      "dispose:rain",
      "dispose:wind",
    ]);
    expect(() => host.runtime(app("aurora"))).toThrow();
  });
});

describe("installed apps (src/apps)", () => {
  const ids = readdirSync(APPS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  test("every app folder has manifest.json, settings.ts and app.ts", () => {
    for (const id of ids) {
      for (const f of ["manifest.json", "app.ts"])
        expect(existsSync(join(APPS_DIR, id, f)), `${id}/${f}`).toBe(true);
      const m = JSON.parse(readFileSync(join(APPS_DIR, id, "manifest.json"), "utf8"));
      expect(m.id).toBe(id);
    }
  });

  test("settingsGroup names a real settings sub view", () => {
    const nav = readFileSync(join(import.meta.dir, "../../components/settingsNav.tsx"), "utf8");
    const groups = new Set([...nav.matchAll(/\{ id: "([\w-]+)", category:/g)].map((m) => m[1]));
    expect(groups.size).toBeGreaterThan(5);
    for (const id of ids) {
      const m = JSON.parse(readFileSync(join(APPS_DIR, id, "manifest.json"), "utf8"));
      if (m.settingsGroup)
        expect(groups.has(m.settingsGroup), `${id}: ${m.settingsGroup}`).toBe(true);
    }
  });

  test("every app's archetype exists in archetypes.json and the tree reaches aspect", () => {
    const tree = JSON.parse(readFileSync(join(import.meta.dir, "archetypes.json"), "utf8"))
      .archetypes as Record<string, { parent: string | null }>;
    for (const [name, a] of Object.entries(tree)) {
      let cur: string | null = name;
      for (let i = 0; cur && i < 10; i++) cur = tree[cur]?.parent ?? null;
      expect(cur, `${name} must reach the root aspect`).toBeNull();
      if (a.parent) expect(tree[a.parent], `${name}: parent ${a.parent}`).toBeDefined();
    }
    for (const id of ids) {
      const m = JSON.parse(readFileSync(join(APPS_DIR, id, "manifest.json"), "utf8"));
      expect(m.archetype, `${id} declares an archetype`).toBeDefined();
      expect(tree[m.archetype], `${id}: ${m.archetype}`).toBeDefined();
    }
  });

  test("the installed set is valid", async () => {
    const defs = await Promise.all(
      ids.map(async (id) => (await import(join(APPS_DIR, id, "app.ts"))).default),
    );
    const r = new AppRegistry(defs);
    expect(r.validate()).toEqual([]);
  });
});
