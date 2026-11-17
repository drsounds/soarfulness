import type { AppFlagChange, AppFlags } from "./flags";
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
 * Which apps run is up to an AppFlags store (see flags.ts): runtimes of
 * disabled apps are created but never framed, and the host calls their
 * startup() / shutdown() as the flags change.
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
  private readonly flags: AppFlags | undefined;
  private readonly unsubscribe: (() => void) | undefined;

  /**
   * `flags` says which apps are on (default: all). Every runtime is created
   * either way, so the host's typed handles always resolve; a disabled app
   * is just not run: it gets shutdown() once now, and no frame() calls until
   * it is turned on (which calls its startup()).
   */
  constructor(registry: AppRegistry, ctx: SceneAppContext, flags?: AppFlags) {
    this.flags = flags;
    for (const app of AppHost.startOrder(registry)) {
      if (!app.createRuntime) continue;
      const runtime = app.createRuntime(ctx) as AppRuntime<object>;
      this.entries.push({ id: app.manifest.id, runtime });
      this.byId.set(app.manifest.id, runtime);
    }
    // Put every runtime into the state its flag asks for.
    for (const { id, runtime } of this.entries) {
      if (this.isOn(id)) runtime.startup?.();
      else runtime.shutdown?.();
    }
    this.unsubscribe = flags?.subscribe((changes) => this.applyChanges(changes));
  }

  /** True while the app is switched on (apps without a flag store are always on). */
  isOn(id: string): boolean {
    return this.flags ? this.flags.isEnabled(id) : true;
  }

  private applyChanges(changes: readonly AppFlagChange[]) {
    for (const { id, enabled } of changes) {
      const runtime = this.byId.get(id);
      if (!runtime) continue;
      if (enabled) runtime.startup?.();
      else runtime.shutdown?.();
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
      if (runtime.frame && this.isOn(id)) runtime.frame(frame, settings(id) ?? {});
    }
  }

  /** Disposes every runtime, last started first. */
  dispose() {
    this.unsubscribe?.();
    for (let i = this.entries.length - 1; i >= 0; i--) this.entries[i].runtime.dispose();
    this.entries.length = 0;
    this.byId.clear();
  }
}
