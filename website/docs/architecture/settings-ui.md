---
title: Settings UI
description: SettingsPanel, the grouped navigator with search and tabs, SettingRow, and where to put a new control.
---

# Settings UI

## Files

| File | Role |
| --- | --- |
| `components/SettingsPanel.tsx` | Every settings control in one component (`SettingsPanel(props: SettingsPanelProps)`). It builds one JSX `body` and hands it to `SettingsNavigator`. |
| `components/settingsNav.tsx` | `SETTINGS_GROUPS`, `<G id>`, `<Findable>`, `matchesQuery`, `useSettingsLayout`, `SettingsNavigator` |
| `components/SettingRow.tsx` | One Android-Settings-style row: label, value summary, chevron; tapping opens a sheet with slider, +/- and typed entry (`mode="number"`) or an option list (`mode="cycle"` / `options`) |
| `components/PadDial.tsx` | The older compact dial; same props as `SettingRow` |
| Feature panels | `WindPanel.tsx` (`WindSettings`, `WindHudPanel`), `HoodSettings.tsx`, `DecorationPanel.tsx` (`DecorationSettings` + the PLACERA bar), `StringLightsSettings.tsx` (prop-free, reads its own store) |

`SettingsPanel` is rendered **twice** with the same `settingsPanelProps`: in
the HUD's settings dialog (`routes/index.tsx`) and as the Inställningar app
inside the virtual phone (`VirtualPhone.tsx`). Anything with its own store
(`useUiTheme`, `useStringLights`, EXTREME) stays in sync between the two
through `useSyncExternalStore`.

## Groups, search and tabs

Since soarfulness #46 (aqua-wave-dream #245, open) the panel is split into
18 groups in five categories:

| Category | Groups (`SettingsGroupId`) |
| --- | --- |
| top | `state` (save, load, sceneries, share, restore, reset) |
| scene | `time`, `place`, `weather`, `clouds`, `events`, `effects` |
| sea | `waves`, `drift`, `water`, `bottom` |
| bather | `mode`, `camera`, `bather`, `interval` |
| system | `graphics`, `sound`, `app` |

The English and Swedish names and one-line descriptions are in the locales
under `settings.groups.<id>.label` / `.desc`.

How it works:

- Every control in `SettingsPanel.tsx` is wrapped in `<G id="group">` **where it
  already sits in the file**; the file was not reordered.
- `SettingsNavigator` renders the whole `body` tree once per *scope* (an open
  sub view, a carousel page, or one search result section). `<G>` renders its
  children only when the scope's group matches.
- Search: `SettingRow` hides itself when its label doesn't match the query
  (`matchesQuery` ignores case and accents and needs every term). Controls that
  aren't a `SettingRow` (color pickers, pill rows, section titles) need
  `<Findable label={…}>` to be searchable.
- Layout: a list of groups that open as sub views (default), or a tabs
  carousel. Stored in `aquafulness:settingsLayout:v1`.

## Adding a control

```tsx
<G id="weather">
  {/* … */}
  <SettingRow
    label={t("dial.env.snowAmount")}
    mode="number"
    value={`${Math.round(snowAmount)}`}
    rawValue={snowAmount}
    onSet={(v) => setSnowAmount(Math.max(0, Math.round(v)))}
    min={0}
    max={mx("snowAmount")}
    step={500}
    onDec={() => setSnowAmount((v) => Math.max(0, Math.round(v - 500)))}
    onInc={() => setSnowAmount((v) => Math.min(mx("snowAmount"), Math.round(v + 500)))}
  />
</G>
```

Rules of thumb:

- Pick the group by meaning: weather effects in `weather`, celebratory effects
  in `events`, things around the bather's head in `bather`, rendering cost in
  `graphics`.
- Show sub-rows only while the feature is on (`{snowOn && (<>…</>)}`).
- `min`/`max` bound the **slider only**. Typed values may exceed them; don't
  clamp in `onSet` except for hard floors.
- Use `mx("<control>")` for any max that is in `EXTREME_MAX`.
- For a new group, add it to `SETTINGS_GROUPS` with a lucide icon and add
  `settings.groups.<id>.label/desc` to all five locales.
- In aqua-wave-dream, `SettingsPanel` filters out the `events` group while
  confetti and fireworks aren't merged there. Drop that filter when they land.
- In aqua-wave-dream, gate controls for advanced modes on the experimental flag.

Before #46 the panel had six tabs (`SettingsTab`: VÅGOR, KAMERA, VATTEN,
MILJÖ, LJUD, TEMA). Those tab ids survive as preset scopes
(`PRESET_TAB_FIELDS`) and in older PR descriptions ("under MILJÖ").
