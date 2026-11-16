---
title: Rain (REGN)
description: Instanced rain streaks, splash rings on the water and a synthesized rain sound. Merged in soarfulness, open in aqua-wave-dream.
---

# Rain (REGN)

:::info Status
Merged in soarfulness (#44) and moved into the `rain` app by #52.
aqua-wave-dream #244 is still open.
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

**Files:** `src/apps/rain/`: `Rainfall.ts` (`Rainfall`, `rainLightColor()`, `RainConfig`), `RainAudio.ts`, `RainRuntime.ts`, `settings.ts` (`RAIN_DEFAULTS`, `RAIN_COLORS`), `manifest.json`.

**How it works:**

- Like `Snowfall`: one instanced draw of `RAIN_MAX_DROPS` (40 000), first
  `amount` drawn, positions computed in the vertex shader inside a
  camera-following box. Each drop is a thin quad **stretched along its
  velocity** (fall + wind), so heavy rain in wind slants correctly.
- Splashes are `Points` rings at the water level near the camera.
- `RainAudio` has its own `AudioContext` with a hiss and a patter.
- Brightness follows daylight `1 - nightBackdropMix(tod)`.
- **Wind:** the `rain` app depends on `wind`. `RainRuntime` passes `getWindVector()` (from `src/apps/wind/wind.ts`) as `RainConfig.wind`, so drops slant with the combined VIND winds; with no wind on, the rain makes its own gentle turning wind.
  passes `getWindVector()` from `src/apps/wind/wind.ts` while any VIND wind is on, so
  the drops slant with it; with no wind on (and in aqua until VIND lands
  there) it passes `null` and the rain makes its own gentle turning wind.
