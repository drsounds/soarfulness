---
title: The settings pipeline
description: How one setting is typed, defaulted, stored, rendered in the UI, read by the render loop, saved, reset, exported and shared.
---

# The settings pipeline

Almost every feature is a handful of settings plus code that reads them every
frame. A setting is enumerated by hand in **many lists**; forgetting one
gives subtle bugs (the value doesn't autosave, isn't reset, isn't in share
links, or the render loop never sees a change). This page lists every list.
The [Add a setting](../guides/add-a-setting.md) guide turns it into a
checklist.

We'll follow `snowAmount` (SNÖMÄNGD) through the code.

## 1. Type: the app's slice, intersected into `Persisted`

For a feature app, the settings type lives in `src/apps/<id>/settings.ts`:

```ts
// src/apps/snow/settings.ts
export type SnowSettings = {
  snowOn: boolean;
  snowAmount: number;
  // …
};
export const SNOW_DEFAULTS: SnowSettings = { snowOn: false, snowAmount: 4000, /* … */ };
export const SNOW_SETTING_KEYS = Object.keys(SNOW_DEFAULTS) as (keyof SnowSettings)[];
```

`Persisted` in `src/lib/settingsShared.ts` is the core app's own keys
intersected with every app's slice:

```ts
export type Persisted = { waveAmp: number; /* …core keys… */ } &
  SnowSettings & AuroraSettings & HoodSettings & /* … */;
```

Settings that belong to the core app (waves, water, camera modes, clouds…)
are still declared directly in `Persisted`.

`Persisted` is the full shape stored under `aquafulness:settings:v1` and what
presets, state files and bath links carry. Option lists for enum-like
settings live in the same file (`AURORA_PALETTES`, `CONFETTI_PALETTES`,
`UNDERWATER_FOG_BLENDS`, `CAMERA_MODES`, …), each with a `*_LABEL_KEYS` map to
i18n keys when the UI shows them. `settingsShared.ts` exists so that both
`index.tsx` and `SettingsPanel.tsx` can import these without importing each
other.

## 2. Default: `DEFAULTS` in `src/routes/index.tsx`

```ts
const DEFAULTS: Persisted = {
  // …core defaults…
  ...SNOW_DEFAULTS,
  ...AURORA_DEFAULTS,
  // …
};
```

App defaults are spread in from each `settings.ts`; core defaults are written
inline.

`DEFAULTS` mirrors the owner's exported "Strandpark" state (see
[Defaults](../features/defaults.md)). New features are **off by default**
unless the owner asked otherwise.

`loadSettings()` returns `{ ...DEFAULTS, ...saved }`, so a new field
automatically gets its default for everyone who saved before it existed. It
also runs a few one-off migrations (torus scale and gaps, the old
`whirlpool` camera mode, legacy tornado fields). Migrations use literal
values, not `DEFAULTS`, so changing a default later doesn't rewrite old saves.

## 3. State and ref in `Aquafulness()`

```ts
const [snowAmount, setSnowAmount] = useState(initial.snowAmount);
// …
const snowSettings: SnowSettings = {
  snowOn, snowAmount, snowIntensity, snowCoverOn, snowCoverStrength, snowGrayBackdropOn,
};
const snowSettingsRef = useRef(snowSettings);
snowSettingsRef.current = snowSettings;   // refreshed on every render
```

Each setting is still its own `useState` in the host (a per-app settings hook
is migration step 3). The three.js scene is built once in a mount effect with
`[]` deps, so the render loop can't see React state directly: an app's whole
slice is handed to it through one ref. Core settings still use one ref per
value (`fooRef` + a sync `useEffect`).

## 4. The render loop reads the ref

```ts
snow.frame(appFrame, snowSettingsRef.current);   // snow = new SnowRuntime({ scene })
```

The runtime turns the slice into what its classes need (`Snowfall`,
`SnowCover`), including hiding itself when `snowOn` is false.

See [The render loop](render-loop.md).

## 5. Snapshot and autosave

`buildPersistedSnapshot(): Persisted` lists **every** field. The autosave
effect right below it writes that snapshot to `STORAGE_KEY` and has **every
field in its dependency array**. If you forget the dependency, the value is
saved only when something else changes.

The same snapshot feeds preset save/export (`exportSettingsFile`,
`savePresetAs`) and the full state file (`buildFullStateSnapshot`).

## 6. Reset: `resetToDefaults()`

ÅTERSTÄLL calls `resetToDefaults()`, which calls every setter with its
`DEFAULTS` value (`setSnowAmount(DEFAULTS.snowAmount)`). It also resets
`sceneId`/`spawnLocationId`. It deliberately does **not** clear
`decorations` (the player's placed models).

## 7. Apply a patch: `applySettingsPatch(patch)`

Loading a preset, importing a file, loading a scenery and applying a full
state all go through:

```ts
if (patch.snowAmount !== undefined) setSnowAmount(patch.snowAmount);
```

Every field needs its line here or it silently won't load from presets.
Validate/sanitize structured values (arrays and objects) here or in the
feature's own module (`sanitizeWinds`, `sanitizeHoodLayers`, decorations'
sanitizer).

## 8. Preset scope: `PRESET_TAB_FIELDS` in `settingsShared.ts`

```ts
export const PRESET_TAB_FIELDS: Record<SettingsTab, (keyof Persisted)[]> = {
  vagor: [ … ], kamera: [ … ], vatten: [ … ],
  miljo: [ …, "snowOn", "snowAmount", … ],
  ljud: [ … ], tema: [],
};
export const PRESET_ALL_FIELDS = Object.values(PRESET_TAB_FIELDS).flat();
```

The preset scopes are the **old six settings tabs** (`vagor`, `kamera`,
`vatten`, `miljo`, `ljud`, `tema`), even though the UI now shows 18 groups.
`PRESET_ALL_FIELDS` decides what goes into:

- the "all" preset and exported preset files,
- **bath links**: `buildCurrentBathPayload()` and DELA BADLÄNK pick
  `PRESET_ALL_FIELDS` from the settings.

A field missing from `PRESET_TAB_FIELDS` autosaves but never travels in a
preset or a shared link.

## 9. UI: `SettingsPanelProps` and `SettingsPanel.tsx`

- Add the value and setter to `export type SettingsPanelProps` and destructure
  them in `SettingsPanel(props)`.
- Add them to `settingsPanelProps` near the end of `Aquafulness()`.
- Render a `<SettingRow>` inside the right `<G id="…">` group. See
  [Settings UI](settings-ui.md).

## 10. Limits: EXTREME and typed values

If the setting is a strength, size, speed or count that can get very large:

- Add it to `EXTREME_MAX` in `src/lib/extremeLimits.ts` (the everyday max is
  `NORMAL_FRACTION` = 25 % of it).
- Use `max={mx("snowAmount")}` in the panel (`mx = (c) => limitMax(c, extremeLimits)`).
- Add a `clamp("snowAmount", snowAmount, setSnowAmount)` line and dependency
  to the EXTREME clamp effect in `index.tsx`. It only clamps when EXTREME is
  turned off.

Typed values override slider limits: a number typed into a row's readout is
stored as-is, even past `min`/`max`. So **don't clamp in `onSet`**, except for
hard floors where 0 or a negative value would break rendering (counts, fps,
near/far plane, the RIDE camera seat). See
[Limits and typed values](../features/limits-and-typed-values.md).

## 11. Text: five locale files

Labels live in `src/locales/{sv,en,no,da,fi}.json`, mostly under
`dial.<area>.<name>`. Add the key to all five. See [i18n](i18n.md).

## Settings that are *not* in `Persisted`

Some state is the visitor's own and must not change when a preset or link is
loaded. These use a small external store (`useSyncExternalStore`) with their
own key:

| Store | File | Key |
| --- | --- | --- |
| UI chrome theme, blur, Liquid Glass | `lib/uiTheme.ts` | `aquafulness:ui-theme:v1` |
| EXTREME | `lib/extremeLimits.ts` | `aquafulness:extremeLimits:v1` |
| EXPERIMENTELLT LÄGE (aqua only) | `lib/experimentalModes.ts` | `aquafulness:experimentalModes:v1` |
| LJUSSLINGOR string lights | `src/apps/string-lights/stringLights.ts` | `aquafulness:stringLights:v1` |
| Settings layout list/tabs | `components/settingsNav.tsx` | `aquafulness:settingsLayout:v1` |
| Language | `lib/i18n.ts` | `aquafulness:lang:v1` |

The camera pose is separate from settings too: `aquafulness:camera:v1`
(`loadCameraPose` / `saveCameraPose`, saved continuously and on `pagehide`).
