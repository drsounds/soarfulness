---
title: Apps — the plugin architecture
description: Where the plugin app contract (src/apps/<id>, manifest.json, settings slices, defineApp, AppRuntime) is documented, and what it changes in these pages.
---

# Apps: the plugin architecture

Since soarfulness **PR #52** (merged 2026-11-16; aqua-wave-dream #250) every
feature that can be switched on, tuned or left out is an **app**: a folder
`src/apps/<id>/` with a `manifest.json`, a `settings.ts` slice, an `app.ts`
(`defineApp`) and one class per file, discovered and checked by
`src/core/apps/` (registry, semver ranges, manifest schema, tests).

**The contract lives in one place: [`docs/architecture/apps.md`](/theory/architecture/apps)**
(rendered on this site under Theory → architecture). The repo's `CLAUDE.md`
points agents there. It covers the folder layout, the installed apps table,
`manifest.json` fields, settings slices, `app.ts`, runtimes and
`FrameContext`, adding a new app, and the migration status (steps 1–6).

The host is still `src/routes/index.tsx`: it holds every setting's React
state, builds the scene, and calls each app runtime's `frame()` every frame.
So the other Architecture pages still apply, with these changes:

| Page | What the apps structure changes |
| --- | --- |
| [Overview](overview.md) | Folder map has `src/core/apps` and `src/apps/<id>` |
| [Settings pipeline](settings-pipeline.md) | `Persisted` = core keys `&` each app's settings type; `DEFAULTS` and `PRESET_TAB_FIELDS` spread each app's defaults and keys; an app's slice reaches the loop through one ref |
| [Render loop](render-loop.md) | Runtimes get `frame(appFrame, settings)`; wind, open drift, underwater fog, string lights, decorations and retro are still constructed directly |
| [Add a feature app](../guides/add-a-scene-effect.md) | The walk-through for a new app |
| [Content apps](content-apps.md) | Content packs in `public/apps/` are a different thing from code apps in `src/apps/` |

When a migration step lands, update `docs/architecture/apps.md` first, then
the table above and the pages it names.
