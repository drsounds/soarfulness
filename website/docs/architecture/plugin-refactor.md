---
title: Plugin refactor (in progress)
description: Status of the move to a plugin-based apps/ folder with manifests, and how to update these docs when it lands.
---

# Plugin refactor (in progress)

:::caution Work in progress
As of 2026-11-16 a separate thread is refactoring the code into a
**plugin-based structure**: each distinct feature becomes an "app" in an
`apps` folder with its own manifest and declared dependencies, split into
app / feature / function modules in isolated class files, while staying in
this single repository and interlinked.

Until that work is merged, the rest of the Architecture section describes
`main` accurately. When it merges, this page should become the architecture
overview, and the pages below need updating.
:::

## What the refactor targets

The current pain points it addresses, for context:

- `src/routes/index.tsx` holds ~350 `useState` and ~370 `useRef` hooks and the
  whole render loop; every feature touches it at 8–10 places (see
  [The settings pipeline](settings-pipeline.md)).
- `src/components/SettingsPanel.tsx` holds every control in one function.
- Features are already *partly* modular: most effects are classes in
  `src/lib/sceneFx/` with a constructor / `update()` / `dispose()` shape, and a
  few features (LJUSSLINGOR, UI theme, EXTREME) already own their settings in
  an external store. Those are the natural seams for plugins.

## Pages to update when it lands

| Page | What changes |
| --- | --- |
| [Overview](overview.md) | Folder map, the `apps/` tree, manifest format |
| [Settings pipeline](settings-pipeline.md) | Where a plugin declares its settings, defaults, preset scope and locale strings |
| [Render loop](render-loop.md) | How plugins register per-frame updates and dispose |
| [Settings UI](settings-ui.md) | How a plugin contributes rows to a settings group |
| [Add a setting](../guides/add-a-setting.md), [Add a scene effect](../guides/add-a-scene-effect.md) | Replace the checklists with "create an app" |
| [Content apps](content-apps.md) | Clarify the difference between content packs in `public/apps/` and code apps |
| [Feature index](../reference/feature-index.md) | Add the app id for each feature |

Agents working on the refactor: put the architecture write-up in
`website/docs/architecture/` (or link it from here) so this site stays the
single entry point.
