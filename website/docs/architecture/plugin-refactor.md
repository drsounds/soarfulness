---
title: Apps — plugin architecture (PR #52)
description: The plugin-based src/apps/<id> structure with manifests, settings slices, defineApp and AppRuntime, being introduced by soarfulness PR #52 / aqua-wave-dream PR #250.
---

# Apps: the plugin architecture

:::caution Not on `main` yet
This page describes the structure introduced by **soarfulness PR #52** and
**aqua-wave-dream PR #250** (branch `claude/project-thread-szbtkg`), open on
2026-11-16. Until they merge, the rest of the Architecture section (which
describes `main`) is what the code looks like. After they merge, files such as
`src/lib/sceneFx/aurora.ts` move to `src/apps/aurora/Aurora.ts`, and the
[Add a setting](../guides/add-a-setting.md) and
[Add a scene effect](../guides/add-a-scene-effect.md) guides should be read
together with "Adding a new app" below.

The source of this page is `docs/architecture/apps.md` on that branch; this
copy is the one to keep up to date once both PRs are merged.
:::

Every feature you can switch on, tune or leave out is an **app**: a folder
under `src/apps/<id>/` with its own manifest, its own settings slice, and one
class, component or hook per file. Apps stay in this repository and are
linked to each other through normal imports, but each one declares what it
depends on, and a registry checks those declarations.

This page is the contract. Agents and humans adding or changing a feature
should read it first.

## Folder layout

```
src/
  core/apps/                 the plugin system itself (no feature code)
    types.ts                 AppManifest, AppDefinition, AppRuntime, FrameContext, defineApp
    registry.ts              AppRegistry: validate, dependency order, settings ownership
    semver.ts                tiny semver range check for manifest dependencies
    catalog.ts               appRegistry: every src/apps/*/app.ts via import.meta.glob
    manifest.schema.json     JSON schema for manifest.json (editor validation)
    registry.test.ts         bun test: registry rules + checks every installed app
  apps/
    <id>/
      manifest.json          who the app is and what it needs
      settings.ts            <Name>Settings type, <ID>_DEFAULTS, <ID>_SETTING_KEYS
      app.ts                 export default defineApp({ manifest, settings, createRuntime? })
      <Class>.ts             one class per file (Aurora.ts, Snowfall.ts, SnowCover.ts, ...)
      <Name>Panel.tsx        the app's own settings UI, when it has one
      use<Name>.ts           React hooks, when it has any
      *.test.ts              bun tests next to the code they test
  lib/                       shared, feature-agnostic code (settingsShared, i18n, presets, ocean, ...)
  components/                shared UI (SettingsPanel, settingsNav, SettingRow, ui/*)
  routes/index.tsx           the host: scene setup, render loop, React state for every setting
```

The `id` is kebab-case and equals the folder name. The in-app label (mostly
Swedish, like `NORRSKEN`) goes in the manifest's `name`.

## Installed apps

| id | name | kind | settings group | depends on | main files |
| --- | --- | --- | --- | --- | --- |
| `aurora` | NORRSKEN | scene-fx | weather | day-night | `Aurora.ts`, `AuroraRuntime.ts` |
| `confetti` | KONFETTI | scene-fx | events | | `Confetti.ts` |
| `day-night` | DYGNSBYTE | environment | time | | `dayNightBackdrop.ts`, `daylightTint.ts` |
| `decorations` | DEKORATIONER | content | place | | `decorations.ts`, `DecorationLayer.ts`, `DecorationPanel.tsx`, `useDecorations.ts` |
| `fireworks` | FYRVERKERI | scene-fx | events | | `Fireworks.ts`, `FireworksAudio.ts` |
| `hood` | HUVA | bather | bather | | `Hood.ts`, `hoodLayers.ts`, `HoodPanel.tsx` |
| `neon` | NEON | scene-fx | effects | | `NeonEdges.ts`, `neonAccent.ts` |
| `open-drift` | HAVSDRIFT | motion | drift | | `OpenDrift.ts` |
| `retro` | RETRO | screen-fx | graphics | | `retroShader.ts` |
| `snow` | SNÖ | scene-fx | weather | day-night | `Snowfall.ts`, `SnowCover.ts`, `snowLight.ts` |
| `underwater-fog` | UNDERVATTENDIS | screen-fx | weather | | `underwaterFog.ts`, `UnderwaterFogOverlay.ts` |
| `wind` | VIND | environment | weather | | `wind.ts`, `WindAudio.ts`, `WindPanel.tsx` |

Everything not listed here (waves, water material, camera modes, clouds,
scenes, sound, the settings panel itself) is still the **core app**, in
`routes/index.tsx`, `components/` and `lib/`. See "Migration status" below.

## manifest.json

```json
{
  "$schema": "../../core/apps/manifest.schema.json",
  "id": "aurora",
  "name": "NORRSKEN",
  "title": "Northern lights",
  "version": "1.0.0",
  "description": "Aurora curtains in the night sky, ...",
  "kind": "scene-fx",
  "settingsGroup": "weather",
  "defaultEnabled": false,
  "dependencies": { "day-night": "^1.0.0" }
}
```

| field | meaning |
| --- | --- |
| `id` | kebab-case, same as the folder |
| `name` | the label users see in the app |
| `title`, `description` | plain English, for docs and tooling |
| `version` | `x.y.z`. Bump the major when you rename or remove a settings key or an export other apps use |
| `kind` | `scene-fx`, `screen-fx`, `motion`, `environment`, `bather` or `content` |
| `settingsGroup` | the settings sub view (an id from `SETTINGS_GROUPS` in `components/settingsNav.tsx`) its dials live in |
| `dependencies` | apps it needs, `id → range` (`^1.0.0`, `~1.2.0`, `1.x`, `*`) |
| `optionalDependencies` | apps it works with when present |
| `defaultEnabled` | `false` for features that are off on a fresh install |

`registry.test.ts` fails when a dependency is missing, a version range is not
met, there is a dependency cycle, two apps claim the same settings key, or a
`settingsGroup` does not exist.

## settings.ts: the app's slice of the settings

All persisted settings form one flat object, `Persisted`
(`lib/settingsShared.ts`). It is saved to localStorage, exported in presets
and encoded into bath links, so **key names are a public format**: never
rename one without a migration.

`Persisted` is the core app's own keys intersected with every app's slice:

```ts
// src/apps/aurora/settings.ts
export type AuroraSettings = {
  auroraOn: boolean;
  auroraIntensity: number;
  // ...
};
export const AURORA_DEFAULTS: AuroraSettings = { auroraOn: false, auroraIntensity: 1, /* ... */ };
export const AURORA_SETTING_KEYS = Object.keys(AURORA_DEFAULTS) as (keyof AuroraSettings)[];
```

```ts
// src/lib/settingsShared.ts
export type Persisted = { /* core keys */ } & AuroraSettings & HoodSettings & /* ... */;
export const PRESET_TAB_FIELDS = { miljo: [/* core keys */, ...AURORA_SETTING_KEYS, /* ... */] };
```

```ts
// src/routes/index.tsx
const DEFAULTS: Persisted = { /* core defaults */, ...AURORA_DEFAULTS, /* ... */ };
```

Rules:

- Prefix every key with the app's name (`aurora*`, `snow*`, `wind*`) so the
  owner is obvious and keys never collide.
- Enum-like option types (`AuroraPalette`, `NeonMode`, ...) and their option
  lists live in the app's `settings.ts`. `settingsShared.ts` re-exports them
  so older imports keep working.
- `settings.ts` must not import runtime code from `lib/settingsShared.ts`
  (it would create an import cycle). Type-only imports from the app's own
  files are fine.

## app.ts: the definition

```ts
import { defineApp, type AppManifest } from "@/core/apps/types";
import { AuroraRuntime } from "./AuroraRuntime";
import manifest from "./manifest.json";
import { AURORA_DEFAULTS, AURORA_SETTING_KEYS } from "./settings";

export default defineApp({
  manifest: manifest as AppManifest,
  settings: { defaults: AURORA_DEFAULTS, keys: AURORA_SETTING_KEYS },
  createRuntime: (ctx) => new AuroraRuntime(ctx),
});
```

`core/apps/catalog.ts` picks up every `src/apps/*/app.ts` with
`import.meta.glob`, so adding an app is adding a folder. In development it
logs any registry problem to the console.

## Runtimes: an app in the render loop

An app that draws or moves something implements `AppRuntime<S>`:

```ts
interface AppRuntime<S> {
  frame?(frame: FrameContext, settings: Readonly<S>): void;
  dispose(): void;
}
type FrameContext = { dt: number; camera: THREE.Camera; night: number; underwater: number };
```

`createRuntime({ scene })` is called once when the 3D scene is built. The
host calls `frame()` every frame with the app's current settings slice, and
`dispose()` on teardown. The runtime owns its three.js objects and turns its
settings into whatever its classes need. Values the host needs back (for
example `AuroraRuntime.glow`, which the ocean shader reflects) are exposed as
getters.

The settings slice reaches the render loop through one ref per app, updated
from React state:

```ts
const auroraSettingsRef = useRef<AuroraSettings>({ auroraOn, /* ... */ });
useEffect(() => { auroraSettingsRef.current = { auroraOn, /* ... */ }; }, [auroraOn, /* ... */]);
// in the frame:
aurora.frame({ dt, camera, night, underwater }, auroraSettingsRef.current);
```

`aurora` is the first app migrated this way (`AuroraRuntime.ts`). The others
still construct their classes directly in `routes/index.tsx`.

## Adding a new app

1. Create `src/apps/<id>/` with `manifest.json`, `settings.ts`, `app.ts`.
2. Put each class in its own file named after the class. Keep three.js,
   WebAudio and DOM work in classes. Keep pure math in plain functions you can
   test with `bun test`.
3. Add `& <Name>Settings` to `Persisted` in `lib/settingsShared.ts`,
   `...<ID>_DEFAULTS` to `DEFAULTS` in `routes/index.tsx`, and
   `...<ID>_SETTING_KEYS` to the right `PRESET_TAB_FIELDS` tab.
4. Implement an `AppRuntime` and call it from the render loop, or, until the
   host has a generic loop, construct your class next to the others in
   `routes/index.tsx`.
5. Put the dials in a `<Name>Panel.tsx` in the app folder and render it
   inside the right `<G id="...">` in `components/SettingsPanel.tsx`.
6. Add `settings.groups.*` / dial labels to all five locales (`src/locales/`).
7. Run `bun test` and `npx tsc --noEmit`.

## Migration status

The refactor goes in small, behavior-preserving steps, so open feature work
can keep merging.

- [x] **Step 1:** the `core/apps` contract, registry and tests; 12 features
  moved to `src/apps/`, one class per file; each app owns its settings
  type, defaults and preset keys; `aurora` runs through `AppRuntime`.
- [ ] **Step 2:** move the remaining apps' frame code out of
  `routes/index.tsx` into runtimes (snow, confetti, fireworks, neon, hood,
  underwater fog, open drift, wind), one PR per app or two.
- [ ] **Step 3:** a generic host loop that creates every registered runtime
  and calls `frame()` in registry order, plus a per-app settings hook
  (`useAppSettings(app)`) to replace the per-key `useState` lines.
- [ ] **Step 4:** move each app's dials out of `SettingsPanel.tsx` into its
  own `<Name>Panel.tsx`, registered with its `settingsGroup`.
- [ ] **Step 5:** split the core app itself (waves, water material, camera
  modes, clouds, scenes, sound, watercraft) into apps.
- [ ] **Step 6:** load app runtimes with dynamic `import()` so each one is
  its own chunk (keeps the main bundle under the PWA precache limit).

Features still in open pull requests (REGN rain, LJUSSLINGOR string lights)
add files under `lib/sceneFx/`. When they merge, move them to
`src/apps/rain/` and `src/apps/string-lights/` (rain depends on `wind`).

## Docs pages to update as the migration proceeds

| Page | What changes |
| --- | --- |
| [Overview](overview.md) | Folder map gains `src/core/apps` and `src/apps/<id>` |
| [Settings pipeline](settings-pipeline.md) | `Persisted` becomes core keys `&` each app's settings type; `DEFAULTS` and `PRESET_TAB_FIELDS` spread each app's defaults and keys |
| [Render loop](render-loop.md) | Apps run through `AppRuntime.frame()` (aurora first; a generic host loop in step 3) |
| [Settings UI](settings-ui.md) | Each app's dials in its own `<Name>Panel.tsx` (step 4) |
| [Add a setting](../guides/add-a-setting.md), [Add a scene effect](../guides/add-a-scene-effect.md) | Point to "Adding a new app" |
| [Content apps](content-apps.md) | Content packs in `public/apps/` are a different thing from code apps in `src/apps/` |
| [Feature index](../reference/feature-index.md) | Add each feature's app id |
