---
title: Apps — plugin architecture
description: The plugin-based src/apps/<id> structure with manifests, settings slices, defineApp and AppRuntime.
---

# Apps: the plugin architecture

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
    host.ts                  AppHost: starts every app's runtime, runs frame(), disposes
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
| `clouds-3d` | 3D-MOLN | scene-fx | clouds | | `clouds3d.ts`, `Clouds3dRuntime.ts` |
| `confetti` | KONFETTI | scene-fx | events | | `Confetti.ts` |
| `day-night` | DYGNSBYTE | environment | time | | `dayNightBackdrop.ts`, `daylightTint.ts` |
| `decorations` | DEKORATIONER | content | place | | `decorations.ts`, `DecorationLayer.ts`, `DecorationPanel.tsx`, `useDecorations.ts` |
| `fireworks` | FYRVERKERI | scene-fx | events | | `Fireworks.ts`, `FireworksAudio.ts` |
| `hood` | HUVA | bather | bather | | `Hood.ts`, `hoodLayers.ts`, `HoodPanel.tsx` |
| `neon` | NEON | scene-fx | effects | | `NeonEdges.ts`, `neonAccent.ts` (edge filter: `lib/edgeSelect.ts`) |
| `open-drift` | HAVSDRIFT | motion | drift | | `OpenDrift.ts` |
| `retro` | RETRO | screen-fx | graphics | | `retroShader.ts` |
| `rain` | REGN | scene-fx | weather | day-night, wind | `Rainfall.ts`, `RainAudio.ts` |
| `sky-puffs` | MOLNPUFFAR | scene-fx | clouds | | `SkyPuffsRuntime.ts` |
| `snow` | SNÖ | scene-fx | weather | day-night | `Snowfall.ts`, `SnowCover.ts`, `snowLight.ts` |
| `string-lights` | LJUSSLINGOR | scene-fx | effects | | `StringLightsFx.ts`, `EdgeLightsFx.ts`, `stringLights.ts` (own store), `StringLightsPanel.tsx`, `EdgeLightsPanel.tsx` |
| `torus-rings` | BADRINGAR | scene-fx | effects | | `TorusRingField.ts`, `TorusRingsRuntime.ts` |
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
| `order` | where the runtime sits in the start and frame order (lower first, default 0); dependencies always come first |

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
type FrameContext = {
  time: number; dt: number; camera: THREE.PerspectiveCamera;
  night: number; underwater: number; waterLevel: number; eyeAboveWater: number;
  model: THREE.Object3D | null; sceneId: string | null;
  extraRoots: THREE.Object3D[]; lowEnd: boolean;
  pixelRatio: number; pixelHeight: number; viewportHeight: number; audioOn: boolean;
  light: { skyColor; horizonColor; waterColor; waterShallowColor; sunColor; sunDir };
};
```

`createRuntime({ scene })` is called once when the 3D scene is built. The
host calls `frame()` every frame with the app's current settings slice, and
`dispose()` on teardown. The runtime owns its three.js objects and turns its
settings into whatever its classes need. Values the host needs back (for
example `AuroraRuntime.glow`, which the ocean shader reflects) are exposed as
getters.

### The app host

`AppHost` (`core/apps/host.ts`) runs the registered apps inside the scene.
`routes/index.tsx` creates it once when the scene is built:

```ts
const apps = new AppHost(appRegistry, { scene });   // createRuntime() for every app
// each frame:
apps.frame(appFrame, appSettings);                  // frame() on every runtime
// on teardown:
apps.dispose();
```

Runtimes start and run in `manifest.order` (lower first), with an app's
dependencies always before it. Scene objects are added in that order too,
so it also decides which of two overlapping transparent effects draws on
top (the hood is last, at 80).

An app that only draws needs nothing in `index.tsx` beyond an entry in
`appSettingsRefs` for its settings slice. For the rest, the host takes a
typed handle:

```ts
const wind = apps.runtime(windApp);        // WindRuntime
const aurora = apps.runtime(auroraApp);    // AuroraRuntime
```

The host builds one `FrameContext` per frame (`appFrame` in
`routes/index.tsx`) and passes it to every runtime. When an app needs more
from the host, add a field to `FrameContext` instead of reaching into
`index.tsx`.

The settings slice reaches the render loop through one ref per app,
refreshed on every render:

```ts
const snowSettings: SnowSettings = { snowOn, snowAmount, /* ... */ };
const snowSettingsRef = useRef(snowSettings);
snowSettingsRef.current = snowSettings;
// in the frame:
snow.frame(appFrame, snowSettingsRef.current);
```

Runtimes so far:

| app | runtime | extra surface the host uses |
| --- | --- | --- |
| `aurora` | `AuroraRuntime` | `glow`, `glowElevation` (water reflection) |
| `snow` | `SnowRuntime` | `updateCover()` early in the frame, `cover` (backdrop dome uniforms) |
| `confetti` | `ConfettiRuntime` | |
| `fireworks` | `FireworksRuntime` | `lightPos`, `lightCol` (ocean shader lights) |
| `neon` | `NeonRuntime` | `setResolution()` on resize |
| `hood` | `HoodRuntime` | |
| `rain` | `RainRuntime` | reads the live wind from `apps/wind` |
| `string-lights` | `StringLightsRuntime` | no settings slice (own store) |
| `underwater-fog` | `UnderwaterFogRuntime` | `setElement()` with the overlay DOM element |
| `wind` | `WindRuntime` | `update()`, `waveDirection()`, `current()`, `sound()`, `swayOffset`, `steersWaves` |
| `open-drift` | `OpenDriftRuntime` | `step()` in the physics step |

`frame()` covers apps that only draw. Wind and open drift feed the host's
physics (wave heading, sway, player position), so their runtimes expose
their own methods that the host calls at the right point of the frame
instead of a single `frame()`.

Still constructed directly in `routes/index.tsx`: `decorations` (a React
hook, `useDecorations`) and the `retro` post-processing pass.

## Shared helpers for light effects

- `lib/edgeSelect.ts` detects and caches mesh edges, filters them by direction
  and clips them to an x/y/z range. NEON and LJUSSLINGOR's KANTLJUS use it with
  `components/EdgeFilterSettings.tsx` as their shared UI.
- `lib/waterPass.ts` splits additive glows into passes on either side of the
  water surface, preventing the ocean's depth write from clipping them when
  seen through the waves. Use `applyWaterPass` / `GlowPoints` for similar
  effects that can sit above or below the water.

## Adding a new app

1. Create `src/apps/<id>/` with `manifest.json`, `settings.ts`, `app.ts`.
2. Put each class in its own file named after the class. Keep three.js,
   WebAudio and DOM work in classes. Keep pure math in plain functions you can
   test with `bun test`.
3. Add `& <Name>Settings` to `Persisted` in `lib/settingsShared.ts`,
   `...<ID>_DEFAULTS` to `DEFAULTS` in `routes/index.tsx`, and
   `...<ID>_SETTING_KEYS` to the right `PRESET_TAB_FIELDS` tab.
4. Implement an `AppRuntime` and return it from `createRuntime` in `app.ts`.
   The `AppHost` starts it and calls `frame()`; add the app's settings ref to
   `appSettingsRefs` in `routes/index.tsx` and set `order` in the manifest if
   draw order matters.
5. Put the dials in a `<Name>Panel.tsx` in the app folder and render it
   inside the right `<G id="...">` in `components/SettingsPanel.tsx`.
6. Add `settings.groups.*` / dial labels to all five locales (`src/locales/`).
7. Run `bun test` and `npx tsc --noEmit`.

## Turning apps on and off (feature flags and SKUs)

Every app can be switched on or off. `core/apps/flags.ts` holds the
`AppFlags` store with two layers:

- **available**: what this build ships. Set by a SKU (`core/apps/skus.ts`)
  and the env variables `VITE_APP_SKU`, `VITE_APPS_ENABLED` (allow list) and
  `VITE_APPS_DISABLED` (deny list). An available app also pulls in the apps
  it depends on.
- **on**: available apps minus the ones the user switched off. The user's
  choices are kept in `localStorage` (`aquafulness:apps:disabled`).

Turning an app on turns on its dependencies; turning one off turns off its
dependents. `setEnabled(id, enabled)` returns the changes, shutdowns first.

Runtimes may implement `startup()` and `shutdown()` (see `AppRuntime`).
`AppHost` calls `startup()` on enabled and `shutdown()` on disabled runtimes
when the scene is built, then again on every flag change, and skips `frame()`
for disabled apps. `shutdown()` hides the app's objects and stops its sound
and timers; both must be safe to call repeatedly. All runtimes are still
created, so typed handles keep working. Code the host drives itself (wind,
open drift, 3D clouds, sky puffs, snow cover, the retro pass) asks
`apps.isOn(id)` and feeds the app "everything off" settings when it is off.
The settings group **Apps** (`core/apps/AppsPanel.tsx`) lists one on/off row
per app; a manifest can opt out with `"switchable": false` (day-night and
decorations, which core code depends on). React code reads the flags with
`useAppFlags` / `useAppEnabled` (`core/apps/useAppFlags.ts`).

## Migration status

The refactor goes in small, behavior-preserving steps, so open feature work
can keep merging.

- [x] **Step 1:** the `core/apps` contract, registry and tests; 12 features
  moved to `src/apps/` (14 with string lights and rain), one class per file; each app owns its settings
  type, defaults and preset keys; `aurora` runs through `AppRuntime`.
- [x] **Step 2:** the apps' frame code moved out of `routes/index.tsx`
  into runtimes (aurora, snow, rain, confetti, fireworks, neon, hood, string
  lights, underwater fog, wind, open drift). Left for step 3: decorations
  and the retro pass.
- [ ] **Step 3:** a generic host loop and per-app settings.
  - [x] `AppHost` creates every registered runtime and calls `frame()` in
    manifest order; `index.tsx` no longer constructs or disposes apps one by
    one.
  - [x] `core/apps/useAppSettings(defaults, initial, normalize?)` returns
    `{ values, setters, reset, patch }` and replaces the per-key `useState`
    lines and the reset/patch lists of an app. Used by every app except wind
    (its list of winds) and decorations (own hook).
  - [ ] decorations and the retro pass as runtimes.
- [ ] **Step 4:** move each app's dials out of `SettingsPanel.tsx` into its
  own `<Name>Panel.tsx`, registered with its `settingsGroup`. A panel takes
  the app's settings handle (`useAppSettings`) as one prop and reads
  `values` and `setters` from it. Done: snow, rain, aurora, underwater fog,
  confetti, fireworks, neon, open drift, retro (`apps/<id>/<Name>Panel.tsx`),
  plus hood, wind, string lights and decorations. Left: the water glow and
  daylight tint dials.
- [ ] **Step 5:** split the core app itself (waves, water material, camera
  modes, clouds, scenes, sound, watercraft) into apps, one subsystem per PR.
  - [x] 3D clouds (`apps/clouds-3d`): the puff layers and their three
    settings. The host feeds them the flat decks' state through
    `Clouds3dRuntime.update(inputs, settings)`.
  - [x] sky puffs (`apps/sky-puffs`): the puff pool, its shader and its five
    settings, with `SkyPuffsRuntime.update(inputs, settings)` and a unit test.
  - [x] bath rings (`apps/torus-rings`): the ring field and its eleven
    settings; the host pushes settings with `configure(settings,
    lowGraphicsMode)` and the app host runs `frame()`.
  - The rest (flat cloud decks, waves, water material, camera modes, scenes,
    sound, watercraft) stays in the core app by decision.
- [ ] **Step 6:** code-split the app code (keeps the main bundle small).
  - [x] The settings dialog and every app panel in it load as their own
    chunk (`React.lazy` in `routes/index.tsx`): the main chunk went from
    1.86 MB to 1.37 MB, and the dialog chunk is 0.49 MB.
  - [ ] Runtimes with dynamic `import()`: measured and not worth it yet. The
    app runtimes are small next to three.js and the render code, and loading
    them asynchronously would make scene setup wait on them.

## Docs pages to update as the migration proceeds

| Page | What changes |
| --- | --- |
| [Overview](overview.md) | Folder map gains `src/core/apps` and `src/apps/<id>` |
| [Settings pipeline](settings-pipeline.md) | `Persisted` becomes core keys `&` each app's settings type; `DEFAULTS` and `PRESET_TAB_FIELDS` spread each app's defaults and keys |
| [Render loop](render-loop.md) | Apps run through `AppRuntime.frame()` (every app except decorations and retro; a generic host loop in step 3) |
| [Settings UI](settings-ui.md) | Each app's dials in its own `<Name>Panel.tsx` (step 4) |
| [Add a setting](../guides/add-a-setting.md), [Add a scene effect](../guides/add-a-scene-effect.md) | Point to "Adding a new app" |
| [Content apps](content-apps.md) | Content packs in `public/apps/` are a different thing from code apps in `src/apps/` |

When a migration step lands, update `docs/architecture/apps.md` first, then
the table above and the pages it names.
