---
title: Content apps (public/apps)
description: How scenes, skyboxes, water surfaces, audio and shipped sceneries are packaged under public/apps and discovered by appCatalog.ts.
---

# Content apps (`public/apps/`)

"Apps" already exist in the codebase as **content packs**: folders under
`public/apps/` that ship 3D scenes, environment skyboxes, water-surface
reflections, audio tracks and scenery presets. They are a packaging unit
only; at runtime all their scenes, environments and surfaces are mixed into
flat lists. (The upcoming code refactor uses the word "apps" for code
plugins too; see [Plugin refactor](plugin-refactor.md).)

## Layout

```text
public/apps/apps.json                         { apps: [{ id, name, description?, icon? }] }
public/apps/<appId>/manifest.json             { scenes?, environments?, surfaces?, audio? }
public/apps/<appId>/scenes/<sceneId>/<sceneId>.glb   (+ manifest.json, .bin, textures)
public/apps/<appId>/environments/<envId>/<eraId>/<timeId>/{ manifest.json, skybox.png|jpg }
public/apps/<appId>/surfaces/<surfaceId>/{ manifest.json, surface.png }
public/apps/<appId>/scenary/manifest.json     shipped scenery presets
public/apps/<appId>/audio/*                   per-app audio tracks
```

Installed packs on soarfulness `main`: `strandpark`, `lisch`, `coordlux`,
`stockholm`, `bucharest`, `vanern`, `futuristic`, `sky`, `romanium`, plus
`suit` (the bathing suit model used by RIDE seats, not listed in `apps.json`).

`src/lib/appCatalog.ts` is the single source of truth for walking this tree:
`fetchApps()`, `appDir()`, `sceneDir()`, `environmentDir()`, `surfaceDir()`,
`scenaryManifestUrl()`. The live loaders in `index.tsx` and the offline
precache walker (`lib/offlineAssets.ts`) both use it. Malformed manifest
entries are dropped instead of crashing the picker.

## Manifests

**App manifest** (`public/apps/strandpark/manifest.json`):

```json
{
  "scenes": [
    { "id": "Strandpark", "name": "Strandpark" },
    { "id": "Strandpark2", "name": "Strandpark2" }
  ],
  "environments": [
    {
      "id": "strandpark",
      "name": "Strandpark",
      "eras": [
        { "id": "present", "name": "Nutid",
          "times": [{ "id": "day", "name": "Dag" }, { "id": "night", "name": "Natt" }] },
        { "id": "future", "name": "Framtid",
          "times": [{ "id": "day", "name": "Dag" }, { "id": "night", "name": "Natt" }] }
      ]
    }
  ]
}
```

**Scene manifest** (`SceneManifest` in `index.tsx`), next to the `.glb`:

```json
{
  "name": "Strandpark2",
  "position": [30, 9, 0],
  "rotation": [0, 180, 0],
  "scale": 4,
  "bob": { "follow": false },
  "locations": [
    { "id": "spawn", "name": "Spawn", "x": 0, "y": 0, "z": 0 },
    { "id": "beach", "name": "Beach", "x": 15, "y": 0, "z": 5 }
  ]
}
```

`rotation` is in degrees. `bob` only moves the model when `amp` is given
(`{ follow: true, amp }` rides the waves, `{ follow: false, amp, speed }` is a
sine bob). `locations` (or `places`) are respawn points.

**Environment manifest** (`EnvManifest`), one per era/time leaf:

```json
{ "name": "Vänern – nutid, dag", "timeOfDay": 0.5, "rotationY": 0, "image": "skybox.png" }
```

`timeOfDay` (0..1, 0 = midnight, 0.5 = noon) snaps the water/light palette;
`rotationY` turns the panorama; `image` defaults to `skybox.png`.

**Surface manifest** (`SurfaceManifest`): `{ "id", "name", "strength": 0.6, "image"? }`.
The photo is sampled along the reflection vector on the water.

## Scenes in the app

- The selected scene is `sceneId` (+ `spawnLocationId`) in settings; the
  environment is `envId` / `envEra` / `envTime`; the surface is `surfaceId`.
- `scenes` in `index.tsx` merges the catalog scenes with the player's
  imported scenes (EGNA SCENER, ids `user:<uuid>`, appId `__user__`).
- A **scene material named `…-neon`** takes the NEON ACCENT color
  (`lib/sceneFx/neonAccent.ts`).
- Skybox backdrops need their waterline exactly at the image's vertical middle
  (row H/2), the scene horizon, or they look sunk in the water.
- To give an environment a night look, add a `night` time to its era and set
  `timeOfDay` to about 0.0 in the night manifest. Day/night blending
  ([DYGNSBYTE](../features/time-and-backdrops.md)) only applies to eras that list
  both `day` and `night`.

See [Add content](../guides/add-content.md) for a step-by-step guide.
