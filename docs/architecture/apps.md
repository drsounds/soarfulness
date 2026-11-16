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
| `neon` | NEON | scene-fx | effects | | `NeonEdges.ts`, `neonAccent.ts` (edge filter: `lib/edgeSelect.ts`) |
| `open-drift` | HAVSDRIFT | motion | drift | | `OpenDrift.ts` |
| `retro` | RETRO | screen-fx | graphics | | `retroShader.ts` |
| `snow` | SNÖ | scene-fx | weather | day-night | `Snowfall.ts`, `SnowCover.ts`, `snowLight.ts` |
| `string-lights` | LJUSSLINGOR | scene-fx | effects | | `StringLightsFx.ts`, `EdgeLightsFx.ts`, `stringLights.ts` (own store), `StringLightsPanel.tsx`, `EdgeLightsPanel.tsx` |
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
type FrameContext = {
  time: number; dt: number; camera: THREE.PerspectiveCamera;
  night: number; underwater: number; waterLevel: number; eyeAboveWater: number;
  model: THREE.Object3D | null; lowEnd: boolean;
  pixelRatio: number; pixelHeight: number; audioOn: boolean;
  light: { skyColor; horizonColor; waterColor; sunColor; sunDir };
};
```

`createRuntime({ scene })` is called once when the 3D scene is built. The
host calls `frame()` every frame with the app's current settings slice, and
`dispose()` on teardown. The runtime owns its three.js objects and turns its
settings into whatever its classes need. Values the host needs back (for
example `AuroraRuntime.glow`, which the ocean shader reflects) are exposed as
getters.

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

Still constructed directly in `routes/index.tsx`: `wind` (WindField,
WindAudio), `open-drift`, `underwater-fog`, `string-lights`, `decorations`,
and the `retro` pass. Wind and open drift feed the physics step, not just
the frame, so they need a `step()` hook first.

## Shared helpers for light effects

- `lib/edgeSelect.ts`: which mesh edges a light effect follows. Detection
  (cached per geometry), direction filter (X / Y / Z / other) and an x/y/z range
  that clips edges. NEON and the string lights' edge mode (KANTLJUS) both use
  it, with `components/EdgeFilterSettings.tsx` as the shared UI.
- `lib/waterPass.ts`: additive glows (neon lines, bulb glow) must be drawn in
  two passes split by which side of the water they are on, or the ocean's depth
  write clips them when seen through the waves. Use `applyWaterPass` /
  `GlowPoints` for any new additive effect that can sit above or below the water.

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
  moved to `src/apps/` (13 with string lights), one class per file; each app owns its settings
  type, defaults and preset keys; `aurora` runs through `AppRuntime`.
- [ ] **Step 2:** move the apps' frame code out of `routes/index.tsx` into
  runtimes. Done: aurora, snow, confetti, fireworks, neon, hood. Left: wind,
  open drift, underwater fog, string lights, decorations, retro.
- [ ] **Step 3:** a generic host loop that creates every registered runtime
  and calls `frame()` in registry order, plus a per-app settings hook
  (`useAppSettings(app)`) to replace the per-key `useState` lines.
- [ ] **Step 4:** move each app's dials out of `SettingsPanel.tsx` into its
  own `<Name>Panel.tsx`, registered with its `settingsGroup`.
- [ ] **Step 5:** split the core app itself (waves, water material, camera
  modes, clouds, scenes, sound, watercraft) into apps.
- [ ] **Step 6:** load app runtimes with dynamic `import()` so each one is
  its own chunk (keeps the main bundle under the PWA precache limit).

REGN (rain, PR #44) is still open and adds `lib/sceneFx/rain.ts`. When it
merges, move it to `src/apps/rain/` (it depends on `wind`).
