import { parseVersion, satisfies } from "./semver";
import type { AnyAppDefinition, AppManifest } from "./types";

// Holds every app, checks the manifests against each other and gives them
// out in dependency order. Pure (no React, no three.js), so it is unit
// tested with `bun test` (registry.test.ts).

export class AppRegistryError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid apps:\n  - ${problems.join("\n  - ")}`);
    this.name = "AppRegistryError";
  }
}

const ID_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export class AppRegistry {
  private readonly apps = new Map<string, AnyAppDefinition>();
  private ordered: AnyAppDefinition[] | null = null;

  constructor(apps: Iterable<AnyAppDefinition> = []) {
    for (const a of apps) this.register(a);
  }

  register(app: AnyAppDefinition): this {
    const id = app.manifest.id;
    if (this.apps.has(id)) throw new AppRegistryError([`duplicate app id "${id}"`]);
    this.apps.set(id, app);
    this.ordered = null;
    return this;
  }

  has(id: string): boolean {
    return this.apps.has(id);
  }

  get(id: string): AnyAppDefinition | undefined {
    return this.apps.get(id);
  }

  manifests(): AppManifest[] {
    return this.list().map((a) => a.manifest);
  }

  /** Every problem with the set of apps; empty when it is consistent. */
  validate(): string[] {
    const problems: string[] = [];
    const owner = new Map<string, string>();
    for (const [id, app] of this.apps) {
      const m = app.manifest;
      if (!ID_RE.test(id)) problems.push(`${id}: id must be kebab-case`);
      if (!parseVersion(m.version)) problems.push(`${id}: version "${m.version}" is not x.y.z`);
      if (!m.name || !m.title || !m.description)
        problems.push(`${id}: name, title and description are required`);
      for (const [dep, range] of Object.entries(m.dependencies ?? {})) {
        const d = this.apps.get(dep);
        if (!d) problems.push(`${id}: depends on missing app "${dep}"`);
        else if (!satisfies(d.manifest.version, range))
          problems.push(`${id}: needs ${dep}@${range}, found ${d.manifest.version}`);
      }
      for (const [dep, range] of Object.entries(m.optionalDependencies ?? {})) {
        const d = this.apps.get(dep);
        if (d && !satisfies(d.manifest.version, range))
          problems.push(`${id}: works with ${dep}@${range}, found ${d.manifest.version}`);
      }
      if (app.settings) {
        const keys = Object.keys(app.settings.defaults);
        const listed = app.settings.keys.map(String);
        if (keys.length !== listed.length || keys.some((k) => !listed.includes(k)))
          problems.push(`${id}: settings.keys must list exactly the keys of settings.defaults`);
        for (const k of keys) {
          const prev = owner.get(k);
          if (prev) problems.push(`${id}: settings key "${k}" is already owned by ${prev}`);
          else owner.set(k, id);
        }
      }
    }
    const cycle = this.findCycle();
    if (cycle) problems.push(`dependency cycle: ${cycle.join(" → ")}`);
    return problems;
  }

  /** Throws AppRegistryError listing every problem, if any. */
  assertValid(): this {
    const problems = this.validate();
    if (problems.length) throw new AppRegistryError(problems);
    return this;
  }

  /** Apps in load order: every app after the apps it depends on. Ties keep
   *  alphabetical order so the order is stable. */
  list(): AnyAppDefinition[] {
    if (this.ordered) return this.ordered;
    const out: AnyAppDefinition[] = [];
    const done = new Set<string>();
    const visit = (id: string, stack: Set<string>) => {
      if (done.has(id) || stack.has(id)) return;
      const app = this.apps.get(id);
      if (!app) return;
      stack.add(id);
      const deps = Object.keys({
        ...app.manifest.dependencies,
        ...app.manifest.optionalDependencies,
      });
      for (const dep of deps.sort()) visit(dep, stack);
      stack.delete(id);
      done.add(id);
      out.push(app);
    };
    for (const id of [...this.apps.keys()].sort()) visit(id, new Set());
    this.ordered = out;
    return out;
  }

  /** Every app's default settings merged into one object. */
  settingsDefaults(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const app of this.list()) if (app.settings) Object.assign(out, app.settings.defaults);
    return out;
  }

  /** Which app owns a settings key (undefined = the core app). */
  ownerOfSetting(key: string): string | undefined {
    for (const app of this.apps.values())
      if (app.settings && key in app.settings.defaults) return app.manifest.id;
    return undefined;
  }

  /** Apps that (directly) depend on `id`. */
  dependents(id: string): string[] {
    return [...this.apps.values()]
      .filter((a) => a.manifest.dependencies && id in a.manifest.dependencies)
      .map((a) => a.manifest.id)
      .sort();
  }

  private findCycle(): string[] | null {
    const state = new Map<string, 1 | 2>();
    const path: string[] = [];
    const dfs = (id: string): string[] | null => {
      state.set(id, 1);
      path.push(id);
      const app = this.apps.get(id)!;
      for (const dep of Object.keys(app.manifest.dependencies ?? {})) {
        if (!this.apps.has(dep)) continue;
        if (state.get(dep) === 1) return [...path.slice(path.indexOf(dep)), dep];
        if (!state.has(dep)) {
          const c = dfs(dep);
          if (c) return c;
        }
      }
      path.pop();
      state.set(id, 2);
      return null;
    };
    for (const id of this.apps.keys()) {
      if (state.has(id)) continue;
      const c = dfs(id);
      if (c) return c;
    }
    return null;
  }
}
