import type { AppRegistry } from "./registry";
import type {
  AnyAppDefinition,
  AppDefinition,
  AppRuntime,
  FrameContext,
  SceneAppContext,
} from "./types";

/** Looks up an app's current settings slice by app id (undefined = none). */
export type AppSettingsLookup = (appId: string) => object | undefined;

type Entry = { id: string; runtime: AppRuntime<object> };

/**
 * Runs the registered apps inside one 3D scene: creates every app's runtime
 * when the scene is built, calls frame() on each every rendered frame and
 * disposes them on teardown.
 *
 * Order: an app starts and runs after the apps it depends on; otherwise by
 * `manifest.order` (lower first), ties keeping the registry's order.
 *
 * The host (routes/index.tsx) still reaches individual runtimes through
 * runtime(app) for the things that are not a plain frame(): values it reads
 * back (aurora glow, fireworks lights) and hooks into its physics (wind,
 * open drift).
 */
export class AppHost {
  private readonly entries: Entry[] = [];
  private readonly byId = new Map<string, AppRuntime<object>>();

  constructor(registry: AppRegistry, ctx: SceneAppContext) {
    for (const app of AppHost.startOrder(registry)) {
      if (!app.createRuntime) continue;
      const runtime = app.createRuntime(ctx) as AppRuntime<object>;
      this.entries.push({ id: app.manifest.id, runtime });
      this.byId.set(app.manifest.id, runtime);
    }
  }

  /** The apps in start/frame order (see the class comment). */
  static startOrder(registry: AppRegistry): AnyAppDefinition[] {
    const base = registry.list();
    const index = new Map(base.map((a, i) => [a.manifest.id, i]));
    const byOrder = [...base].sort(
      (a, b) =>
        (a.manifest.order ?? 0) - (b.manifest.order ?? 0) ||
        index.get(a.manifest.id)! - index.get(b.manifest.id)!,
    );
    const out: AnyAppDefinition[] = [];
    const done = new Set<string>();
    const visit = (app: AnyAppDefinition, stack: Set<string>) => {
      const id = app.manifest.id;
      if (done.has(id) || stack.has(id)) return;
      stack.add(id);
      for (const dep of Object.keys(app.manifest.dependencies ?? {})) {
        const d = registry.get(dep);
        if (d) visit(d, stack);
      }
      stack.delete(id);
      done.add(id);
      out.push(app);
    };
    for (const app of byOrder) visit(app, new Set());
    return out;
  }

  /** Ids of the running apps, in frame order. */
  ids(): string[] {
    return this.entries.map((e) => e.id);
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  /** The running runtime of `app`, typed as the app defines it. */
  runtime<S extends object, R extends AppRuntime<S>>(app: AppDefinition<S, R>): R {
    const r = this.byId.get(app.manifest.id);
    if (!r) throw new Error(`App "${app.manifest.id}" has no running runtime`);
    return r as unknown as R;
  }

  /** Calls frame() on every runtime that has one, in order. */
  frame(frame: FrameContext, settings: AppSettingsLookup) {
    for (const { id, runtime } of this.entries) {
      if (runtime.frame) runtime.frame(frame, settings(id) ?? {});
    }
  }

  /** Disposes every runtime, last started first. */
  dispose() {
    for (let i = this.entries.length - 1; i >= 0; i--) this.entries[i].runtime.dispose();
    this.entries.length = 0;
    this.byId.clear();
  }
}
