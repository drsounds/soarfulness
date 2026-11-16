---
title: Underwater fog (UNDERVATTENDIS)
description: A DOM gradient overlay docked to the on-screen waterline that fills the view as you dive.
---

# Underwater fog (UNDERVATTENDIS)

| Setting | UI | Default |
| --- | --- | --- |
| `underwaterFogOn` | UNDERVATTENDIS | off |
| `underwaterFogColor`, `underwaterFogOpacity` | DISFÄRG, DISOPACITET (top of the gradient) | `#a8d8e8`, 0.45 |
| `underwaterFogWaterColorAuto`, `underwaterFogWaterColor`, `underwaterFogWaterOpacity` | VATTENFÄRG (auto or EGEN), VATTENOPACITET | auto, `#0e4a6e`, 0.55 |
| `underwaterFogIntensity` | DISSTYRKA | 1 |
| `underwaterFogSpread` | GRADIENTLÄNGD | 0.7 |
| `underwaterFogCurve` | GRADIENTKURVA | 1 |
| `underwaterFogFeather` | MJUK KANT | 0.04 |
| `underwaterFogDistance` | VATTENLINJEAVSTÅND (m) | 12 |
| `underwaterFogOffset` | FÖRSKJUTNING | 0 |
| `underwaterFogSubmergedOnly` | BARA UNDER YTAN | off |
| `underwaterFogBlend` | BLANDNINGSLÄGE: `UNDERWATER_FOG_BLENDS` | normal |

**Files:** `src/lib/sceneFx/underwaterFog.ts` (`UnderwaterFogOverlay`),
`underwaterFog.test.ts`.

**How it works:**

- A DOM `div` over the canvas, placed just before `GogglesOverlay` in the JSX,
  so it is below the droplets and the HUD.
- The render loop styles it imperatively (no React state), reading all settings
  from one `underwaterFogSettingsRef`, and only touches the DOM when something
  visibly changed.
- The gradient's top edge is the point on the water **VATTENLINJEAVSTÅND m
  straight ahead** (`ocean.position.y`), projected through the real camera.
  Above the water it sinks toward the bottom of the screen; diving, it climbs
  until it fills the screen.
- Auto water colour = 0.45 · `uWaterShallow` + 0.55 · `uWaterDeep`.

**Status:** soarfulness #33 (merged). aqua-wave-dream #242 (open).

**Testing tip:** noclip ignores the pose `y`. Use `heightOffset` ±1.5 in float
mode to put the camera just above or below the water.
