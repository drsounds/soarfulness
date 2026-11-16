---
title: Add a scene, skybox or surface
description: Adding content to public/apps without touching code.
---

# Add a scene, skybox or surface

Content needs no code changes; `appCatalog.ts` discovers it from manifests.
Layout and manifest formats: [Content apps](../architecture/content-apps.md).

## A new 3D scene in an existing app

1. Export the scene as **glTF 2.0 binary** (`.glb`).
2. Put it at `public/apps/<appId>/scenes/<SceneId>/<SceneId>.glb`.
3. Add `manifest.json` next to it with `position`, `rotation` (degrees),
   `scale`, optional `bob` and `locations`.
4. Add `{ "id": "<SceneId>", "name": "…" }` to `scenes` in
   `public/apps/<appId>/manifest.json`.
5. Name neon tubes' materials `…-neon` to let NEONACCENT recolour them.

## A new skybox (environment)

1. Put the image at
   `public/apps/<appId>/environments/<envId>/<eraId>/<timeId>/skybox.png`
   (or `.jpg` with `"image"`). The **waterline must be on the middle row**
   (H/2) of the image.
2. Add `manifest.json` there: `name`, `timeOfDay` (0.5 for day, about 0.0 for
   night), `rotationY`.
3. List the environment, era and time in the app's `manifest.json`. List both
   `day` and `night` for DYGNSBYTE to blend them.

## A new app (content pack)

1. Create `public/apps/<appId>/manifest.json`.
2. Add `{ "id", "name", "description" }` to `public/apps/apps.json`.
3. Optionally ship sceneries in `public/apps/<appId>/scenary/manifest.json`.

Everything under `public/apps/` is precached for offline use by
`offlineAssets.ts`, so keep files small. Large single files can exceed the
PWA precache limit; see [Deployment](../getting-started/deployment.md#pwa-precache-limit).

Do it in both repos.
