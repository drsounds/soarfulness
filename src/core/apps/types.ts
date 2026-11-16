import type * as THREE from "three";

// The app ("plugin") contract. Every feature that can be switched on, tuned
// or left out lives in its own folder under src/apps/<id>/ with:
//
//   manifest.json  who the app is and what it depends on (AppManifest)
//   settings.ts    its slice of the persisted settings + defaults
//   app.ts         defineApp({ manifest, settings, createRuntime? })
//   *.ts / *.tsx   one class / component / hook per file
//
// The registry (registry.ts) validates every manifest, resolves the
// dependency graph and hands the apps out in load order. See
// docs/architecture/apps.md for the full guide.

/** What kind of feature an app is; used for grouping in docs and tooling. */
export type AppKind =
  /** Draws something in the 3D scene (snow, aurora, fireworks, ...). */
  | "scene-fx"
  /** Full-screen post-processing or screen overlays (retro, fog overlay). */
  | "screen-fx"
  /** Moves the camera / bather (drift, wind current). */
  | "motion"
  /** Lighting, sky and time of day. */
  | "environment"
  /** Things the bather wears or holds (hood). */
  | "bather"
  /** User content placed in the world (decorations). */
  | "content";

export type AppManifest = {
  /** kebab-case, equal to the folder name under src/apps/. */
  id: string;
  /** The in-app (Swedish) label, e.g. "NORRSKEN". */
  name: string;
  /** Plain English title for docs and tooling. */
  title: string;
  /** Semantic version of the app's own contract (settings keys, exports). */
  version: string;
  description: string;
  kind: AppKind;
  /** Settings sub view the app's dials live in (SETTINGS_GROUPS id). */
  settingsGroup?: string;
  /** Other apps this one needs, id → semver range ("^1.0.0", "1.x", "*"). */
  dependencies?: Record<string, string>;
  /** Apps it works with when present but doesn't need. */
  optionalDependencies?: Record<string, string>;
  /** Off-by-default apps say so; the defaults in settings.ts are the truth. */
  defaultEnabled?: boolean;
};

/** An app's slice of the persisted settings snapshot (`Persisted`). */
export type AppSettingsSlice<S extends object> = {
  defaults: Readonly<S>;
  keys: readonly (keyof S)[];
};

/** Handed to createRuntime once, when the 3D scene is built. */
export type SceneAppContext = {
  scene: THREE.Scene;
};

/** Handed to AppRuntime.frame every rendered frame. */
export type FrameContext = {
  /** Seconds since the last frame. */
  dt: number;
  camera: THREE.Camera;
  /** 0 (day) .. 1 (night), DYGNSBYTE's curve (apps/day-night). */
  night: number;
  /** 0 (above) .. 1 (under water), eased. */
  underwater: number;
};

/** The live part of an app inside the render loop. */
export interface AppRuntime<S extends object = object> {
  frame?(frame: FrameContext, settings: Readonly<S>): void;
  dispose(): void;
}

export type AppDefinition<S extends object = object, R extends AppRuntime<S> = AppRuntime<S>> = {
  manifest: AppManifest;
  settings?: AppSettingsSlice<S>;
  createRuntime?: (ctx: SceneAppContext) => R;
};

/** Identity helper that keeps the settings/runtime types of an app. */
export function defineApp<S extends object, R extends AppRuntime<S> = AppRuntime<S>>(
  def: AppDefinition<S, R>,
): AppDefinition<S, R> {
  return def;
}

/** Any app, whatever its settings and runtime types (registry storage). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyAppDefinition = AppDefinition<any, any>;
