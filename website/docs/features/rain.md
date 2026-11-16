---
title: Rain (REGN)
description: Instanced rain streaks, splash rings on the water and a synthesized rain sound. Open PR in both repos.
---

# Rain (REGN)

:::info Not on `main` yet
Rain is in soarfulness PR #44 and aqua-wave-dream PR #244 (branch
`claude/project-thread-uwup1m`), both open on 2026-11-16. `rain.ts` is
identical in both.
:::

| Setting | UI | Default |
| --- | --- | --- |
| `rainOn` | REGN | off |
| `rainAmount` | drops (EXTREME max 40 000) | 8000 |
| `rainIntensity` | REGNSTYRKA (EXTREME max 4) | 0.6 |
| `rainDropLength`, `rainDropSize` | drop length and size | 1, 1 |
| `rainOpacity` | | 0.5 |
| `rainColor` | REGNFÄRG: `RAIN_COLORS` silver / white / blue / gray | silver |
| `rainSplashesOn` | STÄNK | on |
| `rainSoundOn`, `rainVolume` | rain sound (also needs LJUD `audioOn`) | on, 0.6 |

UI sits right after the snow rows (the `weather` group).

**Files:** `src/lib/sceneFx/rain.ts`: `Rainfall`, `RainAudio`,
`rainLightColor()`, `RainConfig`.

**How it works:**

- Like `Snowfall`: one instanced draw of `RAIN_MAX_DROPS` (40 000), first
  `amount` drawn, positions computed in the vertex shader inside a
  camera-following box. Each drop is a thin quad **stretched along its
  velocity** (fall + wind), so heavy rain in wind slants correctly.
- Splashes are `Points` rings at the water level near the camera.
- `RainAudio` has its own `AudioContext` with a hiss and a patter.
- Brightness follows daylight `1 - nightBackdropMix(tod)`.
- **Wind hook:** `Rainfall.update` takes `cfg.wind {x, z}` (m/s). The PR
  passes `null`, so rain makes its own gentle turning wind. Now that VIND is
  merged in soarfulness, pass `getWindVector()` from `lib/wind.ts` in.
