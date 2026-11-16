---
title: Scenes, imported GLB and decorations
description: Catalog scenes, EGNA SCENER imported .glb scenes, and DEKORATIONER placed .glb models with a gizmo.
---

# Scenes, imported GLB and decorations

## Scenes (SCEN)

`sceneId` and `spawnLocationId` (SPAWN-PLATS) choose a 3D scene from the
content catalog (default `Strandpark2`, spawn `spawn`). The loader effect is
keyed on `[sceneId, sceneAppId]`, loads the `.glb`, applies its manifest
placement (`applyManifest`), and swaps it into `modelRef`; the old model is
freed with `disposeObject`. See [Content apps](../architecture/content-apps.md).
RUMSSTORLEK (`surfaceArea`) and VÄRLDSGRÄNS live in the same `place` group.

## Imported scenes (EGNA SCENER)

IMPORTERA GLB / TA BORT under SCEN. The player imports a `.glb` as a scene.

- `src/lib/userScenes.ts`: IndexedDB `aquafulness-user-scenes` with a `meta`
  store (names, sizes) and a `data` store (bytes). Ids are `user:<uuid>`,
  app id `__user__`.
- Only glTF 2.0 binary is accepted. Limit 300 MB on the web, 64 MB in the
  Android app (bytes cross the native bridge as base64, ~4× memory at peak).
  `DeviceFilesPlugin.openFile` takes `maxBytes` and rejects with `TOO_LARGE`.
- `scenes` in `index.tsx` merges catalog and user scenes. A shared link or
  preset that names a user scene falls back to no scene on another device.
- soarfulness #20 / aqua-wave-dream #230 (both merged).

## Decorations (DEKORATIONER)

Place your own `.glb` models in the current scene, right after EGNA SCENER in
the settings, with a PLACERA bar in the HUD.

**Setting:** `decorations` (in `Persisted`, preset scope `miljo`):
scene key (`sceneId`, or `"__ocean__"` for no scene) → `Decoration[]`:

```ts
{ src, position, rotation /* degrees XYZ */, scale /* XYZ */,
  repeat: { count /* XYZ */, spacing /* XYZ */, stepRotY, stepScale },
  visible }
```

`src` is either `"local:deco:<uuid>"` (bytes in IndexedDB
`aquafulness-decorations`, using `createGlbLibrary` from `userScenes.ts`) or
`"data:model/gltf-binary;base64,…"` for models up to
`DECORATION_EMBED_MAX_BYTES` (32 KB). Bath links carry only the current
scene's embedded models, up to 128 KB in total; the bathe route merges link
decorations over the visitor's other scenes.

**Files:**

| File | Role |
| --- | --- |
| `src/lib/decorations.ts` | Types, sanitizer, link helpers, limits |
| `src/lib/sceneFx/decorations.ts` | `DecorationLayer`: a group per decoration with repeated copies, three.js `TransformControls` gizmo (move / rotate / scale) |
| `src/hooks/use-decorations.ts` | Wires the layer to React state and the scene |
| `src/components/DecorationPanel.tsx` | `DecorationSettings` and the PLACERA HUD bar |

`index.tsx` is touched only at a few anchor points. `resetToDefaults()` does
**not** clear decorations, on purpose.

**Status:** soarfulness #49 (merged). aqua-wave-dream #248 (open).
