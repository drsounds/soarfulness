---
title: First start and defaults
description: The Strandpark first-start state, FIRST_START_POSE, the splash screen's Start bath, and how to change defaults safely.
---

# First start and defaults

The first-start state is the owner's exported **Strandpark** state
(`strandpark.json`, an `aquafulness-state` v1 file, scene `Strandpark2`).

- `DEFAULTS` in `src/routes/index.tsx` mirror that export: scene
  `Strandpark2`, spawn `spawn`, environment `sky`, clouds bottom, 8× cloud
  scales, `resolutionScale` 0.5, `targetFps` 25, better lighting and shadows on,
  DYGNSBYTE and SOLTONING on, water over the whole world, every newer effect
  off.
- `FIRST_START_POSE` and `FIRST_START_SURGE_DIR` hold the camera pose and surge
  direction from the export.
- `isFirstStart` = no settings key **and** no camera key in localStorage.

:::warning The splash trap
The splash screen's "Start bath" goes through `/bathing/<payload>/bathe`,
which seeds `STORAGE_KEY` before the app mounts, so `isFirstStart` is false
there. `buildCurrentBathPayload()` therefore adds `FIRST_START_POSE` itself
when nothing is saved yet (soarfulness #9 / aqua-wave-dream #220).
:::

**Changing a default:** update `DEFAULTS` (and `FIRST_START_POSE` if the pose
changes) in both repos. Existing users keep their saved value, because
`loadSettings()` spreads saved settings over `DEFAULTS`. Migrations use
literal values, not `DEFAULTS`.

**Verify** with headless Chromium on an empty profile: click Start bath, then
read `aquafulness:settings:v1` and `aquafulness:camera:v1`.

ÅTERSTÄLL (`resetToDefaults`) resets every setting, `sceneId` and
`spawnLocationId`, but keeps decorations.

History: Strandpark default soarfulness #8/#9, aqua-wave-dream via #219/#220;
8× cloud scales soarfulness #11 / aqua #223.
