import { describe, expect, test } from "bun:test";
import { createAppFlags, readAppFlagConfig, APP_FLAGS_STORAGE_KEY } from "./appFlags";
import { AppFlags } from "./flags";
import { AppHost } from "./host";
import { AppRegistry } from "./registry";
import type { AnyAppDefinition, AppManifest, AppRuntime, SceneAppContext } from "./types";

function app(
  id: string,
  deps: string[] = [],
  createRuntime?: AnyAppDefinition["createRuntime"],
): AnyAppDefinition {
  const manifest: AppManifest = {
    id,
    name: id.toUpperCase(),
    title: id,
    version: "1.0.0",
    description: id,
    kind: "scene-fx",
    dependencies: Object.fromEntries(deps.map((d) => [d, "^1.0.0"])),
  };
  return { manifest, createRuntime };
}

const registry = () =>
  new AppRegistry([app("wind"), app("rain", ["wind"]), app("snow"), app("storm", ["rain"])]);

describe("AppFlags", () => {
  test("everything is on by default", () => {
    const f = new AppFlags(registry());
    expect(f.enabledIds()).toEqual(["wind", "rain", "snow", "storm"]);
    expect(f.availableIds()).toEqual(f.enabledIds() as string[]);
  });

  test("turning an app off turns off what depends on it, and back on brings dependencies", () => {
    const f = new AppFlags(registry());
    expect(f.setEnabled("wind", false)).toEqual([
      { id: "storm", enabled: false },
      { id: "rain", enabled: false },
      { id: "wind", enabled: false },
    ]);
    expect(f.isEnabled("rain")).toBe(false);
    expect(f.isEnabled("snow")).toBe(true);
    // Rain needs wind, so wind comes back first; storm stays off.
    expect(f.setEnabled("rain", true)).toEqual([
      { id: "wind", enabled: true },
      { id: "rain", enabled: true },
    ]);
    expect(f.isEnabled("storm")).toBe(false);
  });

  test("no-op calls and unknown ids change nothing and notify nobody", () => {
    const f = new AppFlags(registry());
    let calls = 0;
    f.subscribe(() => calls++);
    expect(f.setEnabled("snow", true)).toEqual([]);
    expect(f.setEnabled("nope", false)).toEqual([]);
    expect(calls).toBe(0);
    f.setEnabled("snow", false);
    expect(calls).toBe(1);
    expect(f.getVersion()).toBe(1);
  });

  test("a SKU can leave apps out; those cannot be turned on", () => {
    const f = new AppFlags(
      registry(),
      { sku: "lite" },
      { skus: { lite: { id: "lite", description: "", enabled: ["rain"] } } },
    );
    // The allow list pulls in rain's dependency.
    expect(f.availableIds()).toEqual(["wind", "rain"]);
    expect(f.setEnabled("snow", true)).toEqual([]);
    expect(f.isEnabled("snow")).toBe(false);
    expect(f.isAvailable("snow")).toBe(false);
  });

  test("a deny list drops the app and its dependents", () => {
    const f = new AppFlags(registry(), { disabled: ["wind"] });
    expect(f.availableIds()).toEqual(["snow"]);
  });

  test("user choices are restored and persisted", () => {
    const saved: string[][] = [];
    const f = new AppFlags(
      registry(),
      {},
      { userDisabled: ["snow"], persist: (ids) => saved.push([...ids]) },
    );
    expect(f.isEnabled("snow")).toBe(false);
    expect(f.isAvailable("snow")).toBe(true);
    f.setEnabled("storm", false);
    expect(saved.at(-1)).toEqual(["snow", "storm"]);
  });

  test("config comes from the environment and storage", () => {
    expect(readAppFlagConfig({ VITE_APP_SKU: "lite", VITE_APPS_DISABLED: "snow, rain" })).toEqual({
      sku: "lite",
      enabled: undefined,
      disabled: ["snow", "rain"],
    });
    const store = new Map<string, string>([[APP_FLAGS_STORAGE_KEY, JSON.stringify(["snow"])]]);
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    const f = createAppFlags(registry(), {}, storage);
    expect(f.isEnabled("snow")).toBe(false);
    f.setEnabled("wind", false);
    expect((JSON.parse(store.get(APP_FLAGS_STORAGE_KEY)!) as string[]).sort()).toEqual(
      ["wind", "rain", "storm", "snow"].sort(),
    );
  });
});

describe("AppHost lifecycle", () => {
  function logging(id: string, log: string[]): AnyAppDefinition["createRuntime"] {
    return () =>
      ({
        startup: () => log.push(`start ${id}`),
        shutdown: () => log.push(`stop ${id}`),
        frame: () => log.push(`frame ${id}`),
        dispose: () => log.push(`dispose ${id}`),
      }) satisfies AppRuntime;
  }
  const ctx = {} as SceneAppContext;
  const frameCtx = {} as never;

  test("starts enabled apps, shuts disabled ones down, and frames only the enabled", () => {
    const log: string[] = [];
    const reg = new AppRegistry([app("a", [], logging("a", log)), app("b", [], logging("b", log))]);
    const flags = new AppFlags(reg, { disabled: ["b"] });
    const host = new AppHost(reg, ctx, flags);
    expect(log).toEqual(["start a", "stop b"]);
    log.length = 0;
    host.frame(frameCtx, () => ({}));
    expect(log).toEqual(["frame a"]);
  });

  test("calls startup and shutdown as the flags change, dependents first on the way down", () => {
    const log: string[] = [];
    const reg = new AppRegistry([
      app("wind", [], logging("wind", log)),
      app("rain", ["wind"], logging("rain", log)),
    ]);
    const flags = new AppFlags(reg);
    const host = new AppHost(reg, ctx, flags);
    log.length = 0;
    flags.setEnabled("wind", false);
    expect(log).toEqual(["stop rain", "stop wind"]);
    log.length = 0;
    host.frame(frameCtx, () => ({}));
    expect(log).toEqual([]);
    flags.setEnabled("rain", true);
    expect(log).toEqual(["start wind", "start rain"]);
  });

  test("without a flag store every app runs; dispose stops listening", () => {
    const log: string[] = [];
    const reg = new AppRegistry([app("a", [], logging("a", log))]);
    const flags = new AppFlags(reg);
    const host = new AppHost(reg, ctx, flags);
    host.dispose();
    log.length = 0;
    flags.setEnabled("a", false);
    expect(log).toEqual([]);
    const plain = new AppHost(reg, ctx);
    log.length = 0;
    plain.frame(frameCtx, () => ({}));
    expect(log).toEqual(["frame a"]);
  });
});
