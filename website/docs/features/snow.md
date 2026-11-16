---
title: Snow (SNÖ, SNÖTÄCKE)
description: GPU snowfall around the camera and optional whitening of the scene and backdrop.
---

# Snow (SNÖ, SNÖTÄCKE)

| Setting | UI | Default |
| --- | --- | --- |
| `snowOn` | SNÖ | off |
| `snowAmount` | SNÖMÄNGD (flakes, EXTREME max 40 000) | 4000 |
| `snowIntensity` | SNÖSTYRKA: fall speed, size, wind (EXTREME max 4) | 0.5 |
| `snowCoverOn` | SNÖTÄCKE | off |
| `snowCoverStrength` | TÄCKNINGSGRAD | 0.8 |
| `snowGrayBackdropOn` | GRÅ BAKGRUND (the old grey look) | off |

**Files:** `src/apps/snow/Snowfall.ts` (`Snowfall`, `SnowCover`).

**How it works:**

- `Snowfall` is one `THREE.Points` cloud of `SNOW_MAX_FLAKES`; only the first
  `amount` are drawn (`setDrawRange`), so changing SNÖMÄNGD never reallocates.
  Each flake's position is computed in the vertex shader from its seed, the
  time and the camera position, wrapped into a camera-following box, so the
  snow is endless at no CPU cost. Hidden below the water level and while the
  camera is under water.
- A `uSink` uniform carries flakes down with a descending camera, so they never
  appear to rise. Confetti uses the same trick.
- `SnowCover` patches the loaded model's materials with `onBeforeCompile`.
  `snowCover.update()` eases the cover in over a few seconds.
- The environment dome has a `uSnowCover` term and is forced on while the cover
  is above 0 (part of the `useEnvDome` condition). It adds snow to the ground
  lit by `SnowCover.uLight`: white by day, moonlit blue at night
  (`1 - nightBackdropMix`), keeping photo lights. Unlit materials scale their
  snow by that light.

**Status:** soarfulness #18, #26 (merged). aqua-wave-dream #228 merged; the
night cover / grey backdrop / sinking fix (#235) is open.

Future weather effects should follow `snow.ts`; rain did.
