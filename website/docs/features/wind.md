---
title: Wind (VIND)
description: Any number of winds that can steer waves, add sway, push a current, and drive a synthesized wind sound; HÖJDLJUD altitude audio.
---

# Wind (VIND)

A VIND button in the main view opens `WindHudPanel` (a `HudIconButton` in
soarfulness's right column). The same `WindSettings` render in the `weather`
settings group just before SNÖ.

| Setting | UI | Default |
| --- | --- | --- |
| `winds: WindSource[]` | VIND 1…n: RIKTNING, VINDSTYRKA, BYIGHET | `[]` |
| `windWavesOn`, `windWaveStrength` | VIND → VÅGRIKTNING, VÅGSTYRNING | on, 1 |
| `windSwayOn`, `windSwayStrength` | VIND → SVAJ, SVAJSTYRKA | on, 1 |
| `windCurrentOn`, `windCurrentStrength` | VIND → STRÖM, STRÖMSTYRKA | on, 1 |
| `windSoundOn`, `windSoundVolume` | VINDLJUD | on, 0.6 |
| `windAltitudeAudioOn` | HÖJDLJUD | on |

The effects default on, but nothing happens until a wind is added.

`WindSource = { id, bearing, speed, gust, on }`: `bearing` is where the wind
blows **toward**, same convention as `waveDir` and STRÖM (x = sin, z = cos);
the UI also shows the "from" side and MOT MIG / MED MIG. `speed` is m/s at
10 m above the water. Arrays are cleaned with `sanitizeWinds`.

**Files:** `src/lib/wind.ts` (`WindField`, `getWindVector()`,
`getWindAt(height)`, `sanitizeWinds`), `src/lib/windSound.ts` (`WindAudio`),
`src/components/WindPanel.tsx`, `src/lib/wind.test.ts`.

**How it works:**

- `WindField` is updated **first** in each frame. Its sum is published as a
  module-level live vector, so other effects (rain, snow) read
  `getWindVector()` / `getWindAt(h)` without touching settings.
- When the wind steers the waves, the CPU wave direction uses
  `uniforms.uDir.value` (`windSteersWaves`) so buoyancy matches the shader.
- VIND STRÖM is a wind-driven surface current (about 3.5 % of the wind).
- `WindAudio` has its own `AudioContext` (like fireworks): a band-passed rush
  that rises with apparent wind, a resonant whistle at speed, and a broadband
  surface noise. Created lazily, suspended when silent.
- HÖJDLJUD multiplies the ambient water track's gain by `altitudeMix(h).water`,
  so above the water it fades out by about 30 m and the breeze takes over.

**Status:** soarfulness #43 (merged). aqua-wave-dream #243 (open; there it is
a pill after BADRINGAR and uses its own `windAudioOnRef`).
