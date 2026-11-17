import type { AppRegistry } from "./registry";

// Feature flags for apps: which of the registered apps are switched on.
// The set starts from an AppFlagConfig (a SKU, an allow list, a deny list)
// and can change at runtime with setEnabled(). Dependencies are respected:
// turning an app on turns on what it depends on, and turning an app off
// turns off whatever depends on it.

/** A named bundle of apps, e.g. one product edition. */
export type Sku = {
  id: string;
  description: string;
  /** Only these apps (plus what they depend on) are on. Omit = all apps. */
  enabled?: readonly string[];
  /** These apps are off, even when listed in `enabled`. */
  disabled?: readonly string[];
};

/** Where the starting set comes from. All parts are optional. */
export type AppFlagConfig = {
  /** Id of one of the known SKUs; unknown ids fall back to "full". */
  sku?: string;
  /** Allow list: only these apps (plus their dependencies) start on. */
  enabled?: readonly string[];
  /** Deny list: these apps (and their dependents) start off. */
  disabled?: readonly string[];
};

export type AppFlagsOptions = {
  /** Extra SKUs next to the built-in ones (see skus.ts). */
  skus?: Readonly<Record<string, Sku>>;
  /** Apps the user switched off earlier (restored from storage). */
  userDisabled?: readonly string[];
  /** Called with the ids the user has switched off after every change. */
  persist?: (userDisabled: readonly string[]) => void;
};

/** What changed in one setEnabled() call, in start order (dependencies first). */
export type AppFlagChange = { id: string; enabled: boolean };

export type AppFlagListener = (changes: readonly AppFlagChange[]) => void;

export class AppFlags {
  /** Apps this build offers at all (the SKU); they can never be turned on otherwise. */
  private readonly available = new Set<string>();
  /** Apps currently running: available and not switched off by the user. */
  private readonly on = new Set<string>();
  private readonly listeners = new Set<AppFlagListener>();
  private version = 0;
  private snapshot: readonly string[] = [];

  constructor(
    private readonly registry: AppRegistry,
    config: AppFlagConfig = {},
    private readonly options: AppFlagsOptions = {},
  ) {
    const sku = config.sku ? options.skus?.[config.sku] : undefined;
    const allow = config.enabled ?? sku?.enabled;
    const deny = new Set([...(sku?.disabled ?? []), ...(config.disabled ?? [])]);
    for (const app of registry.list()) {
      const id = app.manifest.id;
      if (!allow || allow.includes(id)) this.available.add(id);
    }
    // An allow list also pulls in the dependencies of what it lists.
    if (allow)
      for (const id of [...this.available]) for (const d of this.depsOf(id)) this.available.add(d);
    // A deny list also drops everything that depends on what it lists.
    for (const id of deny) {
      if (!this.registry.has(id)) continue;
      this.available.delete(id);
      for (const d of this.dependentsOf(id)) this.available.delete(d);
    }
    for (const id of this.available) this.on.add(id);
    for (const id of options.userDisabled ?? []) if (this.on.has(id)) this.turnOff(id);
    this.snapshot = this.compute();
  }

  /** True when this build offers the app (it may still be switched off). */
  isAvailable(id: string): boolean {
    return this.available.has(id);
  }

  /** The ids of the apps this build offers, in the registry's load order. */
  availableIds(): string[] {
    return this.registry
      .list()
      .flatMap((a) => (this.available.has(a.manifest.id) ? [a.manifest.id] : []));
  }

  isEnabled(id: string): boolean {
    return this.on.has(id);
  }

  /** The ids of the enabled apps, in the registry's load order. */
  enabledIds(): readonly string[] {
    return this.snapshot;
  }

  /** Available apps the user has switched off, in load order. */
  disabledIds(): string[] {
    return this.availableIds().filter((id) => !this.on.has(id));
  }

  /** Bumps on every change; handy as a change token for external stores. */
  getVersion(): number {
    return this.version;
  }

  /**
   * Turns an available app on or off and returns what changed. Turning one
   * on also turns on its dependencies; turning one off also turns off its
   * dependents. Unknown or unavailable ids and no-op calls change nothing.
   */
  setEnabled(id: string, enabled: boolean): AppFlagChange[] {
    if (!this.available.has(id)) return [];
    const before = new Set(this.on);
    if (enabled) this.turnOn(id);
    else this.turnOff(id);
    const order = this.registry.list().map((a) => a.manifest.id);
    const changed = order.filter((x) => before.has(x) !== this.on.has(x));
    if (!changed.length) return [];
    // Shut down first (dependents before what they depend on), then start
    // (dependencies first).
    const turnedOn = changed.filter((x) => this.on.has(x));
    const turnedOff = changed.filter((x) => !this.on.has(x)).reverse();
    const changes: AppFlagChange[] = [
      ...turnedOff.map((x) => ({ id: x, enabled: false })),
      ...turnedOn.map((x) => ({ id: x, enabled: true })),
    ];
    this.snapshot = this.compute();
    this.version++;
    this.options.persist?.(this.disabledIds());
    for (const l of [...this.listeners]) l(changes);
    return changes;
  }

  /** Calls `listener` after every change; returns the unsubscribe function. */
  subscribe(listener: AppFlagListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private compute(): readonly string[] {
    return this.registry.list().flatMap((a) => (this.on.has(a.manifest.id) ? [a.manifest.id] : []));
  }

  private depsOf(id: string): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    const visit = (x: string) => {
      const app = this.registry.get(x);
      if (!app) return;
      for (const dep of Object.keys(app.manifest.dependencies ?? {})) {
        if (seen.has(dep) || !this.registry.has(dep)) continue;
        seen.add(dep);
        out.push(dep);
        visit(dep);
      }
    };
    visit(id);
    return out;
  }

  private dependentsOf(id: string): string[] {
    const out: string[] = [];
    const seen = new Set<string>([id]);
    const queue = [id];
    while (queue.length) {
      const x = queue.shift()!;
      for (const d of this.registry.dependents(x)) {
        if (seen.has(d)) continue;
        seen.add(d);
        out.push(d);
        queue.push(d);
      }
    }
    return out;
  }

  private turnOn(id: string) {
    this.on.add(id);
    for (const dep of this.depsOf(id)) if (this.available.has(dep)) this.on.add(dep);
  }

  private turnOff(id: string) {
    this.on.delete(id);
    for (const d of this.dependentsOf(id)) this.on.delete(d);
  }
}
