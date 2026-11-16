---
title: Add a setting
description: Step-by-step checklist for adding a persisted setting so it autosaves, resets, loads from presets, travels in links and shows in the UI.
---

# Add a setting

Follow this for every new `Persisted` field. Each step names the exact list
to extend; missing one gives a quiet bug. Background:
[The settings pipeline](../architecture/settings-pipeline.md).

Let's say we add `rainbowOn: boolean` and `rainbowStrength: number`.

:::tip Find the neighbours first
Pick an existing setting that sits where yours belongs (for a weather effect,
`snowCoverStrength` or the newest weather setting) and grep for it. Every hit is
a place you need a line. `grep -n "snowCoverStrength" -r src` shows the full
list for that feature.
:::

## Checklist

1. **Type** — `src/lib/settingsShared.ts`, `export type Persisted`: add the
   fields with a comment naming the UI label and what the value means. Put any
   option list (`export const RAINBOW_STYLES = [...] as const`) and its
   `*_LABEL_KEYS` here too.
2. **Preset scope** — same file, `PRESET_TAB_FIELDS`: add the ids to the right
   old tab (`miljo` for environment and weather, `vatten`, `vagor`, `kamera`,
   `ljud`). This also puts them in **bath links** via `PRESET_ALL_FIELDS`.
3. **Default** — `src/routes/index.tsx`, `const DEFAULTS: Persisted`. New
   features default **off**.
4. **State** — in `Aquafulness()`:
   `const [rainbowOn, setRainbowOn] = useState(initial.rainbowOn);`
5. **Ref + sync effect** (if the render loop reads it):
   `const rainbowOnRef = useRef(rainbowOn);` and a `useEffect` that copies the
   values into the refs with them in the deps array. Grouping the feature's
   values in one ref object is fine.
6. **Snapshot** — `buildPersistedSnapshot()`: add both fields.
7. **Autosave deps** — the `useEffect` right after it that writes
   `STORAGE_KEY`: add both to the dependency array.
8. **Reset** — `resetToDefaults()`: `setRainbowOn(DEFAULTS.rainbowOn)`, …
9. **Apply** — `applySettingsPatch()`:
   `if (patch.rainbowOn !== undefined) setRainbowOn(patch.rainbowOn);`
   Sanitize arrays/objects here or in the feature module.
10. **Panel props** — `SettingsPanelProps` in `SettingsPanel.tsx` (value and
    setter types), the destructuring in `SettingsPanel(props)`, and the
    `settingsPanelProps` object near the end of `Aquafulness()`.
11. **UI** — a `<SettingRow>` inside the right `<G id="…">` in
    `SettingsPanel.tsx`. Sub-rows only while the feature is on. `min`/`max`
    are for the slider only; don't clamp in `onSet` (except hard floors).
    Non-row controls need `<Findable label>`.
12. **Limits** (strength, size, count, speed) — `EXTREME_MAX` in
    `lib/extremeLimits.ts`, `max={mx("rainbowStrength")}`, and a
    `clamp("rainbowStrength", …)` line + dependency in the EXTREME clamp effect.
13. **Locales** — the label (and option labels) in all five
    `src/locales/*.json`, usually under `dial.env.*`.
14. **Render loop** — read `rainbowOnRef.current` in `animate()` (see
    [Add a scene effect](add-a-scene-effect.md)).
15. **aqua-wave-dream** — repeat in the twin PR. If the setting belongs to an
    advanced mode, gate its UI on the experimental flag there.

## Don't

- Don't rename or remove a shipped setting id; old saves, presets and links
  store it. Rename only the UI string.
- Don't put visitor preferences (theme, accessibility, EXTREME-like switches)
  in `Persisted`. Use an external store with its own key, like
  `lib/uiTheme.ts` or `lib/stringLights.ts`.
- Don't run prettier on the whole of `index.tsx`.

## Self-check

```bash
# every place the new id appears; compare against a neighbour feature's count
grep -rn "rainbowStrength" src | wc -l
grep -rn "snowCoverStrength" src | wc -l
# all five locales have the key
grep -l "rainbowStrength" src/locales/*.json | wc -l   # expect 5
```
