---
title: Waves and water
description: Wave presets and waveforms, realistic FFT waves, the RAYTRACED material, water colour, foam, glow, the water plane size and the cloud surface.
---

# Waves and water

The ocean is one `ShaderMaterial` built in the mount effect of `index.tsx`
(its uniforms are listed in [The render loop](../architecture/render-loop.md)).
The CPU computes the same wave height (`waveHeight()`, `shapedWave()`,
`sawtoothWave()`, `whirlpoolSurfaceHeight()` at the top of `index.tsx`) so the
floating camera matches the surface the shader draws.

## Waves

| Setting | UI | Notes |
| --- | --- | --- |
| `wavePreset` | VÅGPRESET | `standard` (= `DEFAULTS`) or `legacy` (the original tall, fast, crossed waves). `applyWavePreset()` re-derives every field from `WAVE_PRESETS`; "standard" must match `DEFAULTS` exactly or touching the dial fights other toggles. |
| `waveAmp`, `waveSpeed`, `waveFreq`, `wavePeak` | VÅG, TEMPO, FREKVENS, SPETS | VÅG has EXTREME max 100 m |
| `waveDir` | VÅGRIKTNING | Compass bearing; can be steered by [wind](wind.md) |
| `regularWaves`, `regularPeriod`, `regularCross`, `standingWaves`, `sloshWaves` | REGELBUNDEN, VÅGPERIOD, KORSVÅG, … | Waveform family toggles |
| `realisticWaves` | REALISTISKA VÅGOR | JONSWAP spectrum ported from drsounds/OceanDemo (FFT-Ocean), re-implemented as an analytic sum of sinusoids in `lib/ocean/fftOceanSpectrum.ts`. Expensive; off by default. |
| `dyingWave*` | DÖENDE VÅG | Long, slow, dying swell overlay |
| `trochoid`, `heaveSkew` | TROKOID, VÅGSKEVHET | Shape of the crest |
| `randomizeWaves` | SLUMPA VÅGOR | |
| `waveHighQuality` | KVALITET | |
| `bobSpeed`, `buoyAmp`, `floatLift`, `submergeAmp`, `waveAnticipation` | GUPP TEMPO, GUPP, FLYT, DYK, FÖRUTSEENDE | How the floating camera rides the surface |

## Water look

| Setting | UI | Notes |
| --- | --- | --- |
| `waterColorIdx` | VATTEN | `WATER_COLORS` presets (nordic, tropical, caribbean, …) |
| `waterHue/Sat/Bright`, `waterColorAlpha` | TON, MÄTTNAD, LJUSSTYRKA, FÄRGSTYRKA | Picker tint and a flat colour overlay |
| `waveBgCustomColor`, `waveBgOpacity` | VÅGBAKGRUND, BAKGRUNDENS OPACITET | The water body behind the wave texture |
| `foamAmount/Coverage/Scale/Color` | SKUM… | Foam |
| `detailWaves`, `detailScale` | DETALJVÅGOR | Per-pixel wind waves on top of the swell |
| `surfaceId`, `reflStrength` | VATTENYTA, STYRKA | A photo sampled along the reflection vector (`public/apps/*/surfaces/`) |
| `sphereMaterial`, `raytracedMaterial` (+ strengths) | VÅGMATERIAL | Alternative water materials. RAYTRACED is a port of Evan Wallace's WebGL Water (`lib/raytracedWater/RaytracedWater.ts`, MIT) with offscreen passes skipped in low graphics mode. |
| `causticsOn` | ÄKTA KAUSTIK | |
| `turbidity` | GRUMLIGHET | |
| `waterGlowOn`, `waterGlowColor`, `waterGlowStrength`, `waterGlowEveningOnly` | VATTENGLÖD, GLÖDFÄRG, GLÖDSTYRKA, BARA PÅ KVÄLLEN | Glowing water (`uGlow`, `uGlowColor`); "evenings only" follows how far the sun is down |
| `waterCloudsOn` | MOLNYTA | Shades the water surface as clouds (`uCloudSurface`). Off by default. |
| `hideWater` | | Hides the ocean |

## Water plane size

`waterFullWorld` (VATTEN ÖVER HELA VÄRLDEN, default **on**): the flat far
ocean ring is `2 × worldBoundarySize × WATER_WORLD_SCALE (1.25)` wide (see
`waterPlaneExtent()`). Off restores the older, cheaper clipping at
`surfaceArea` (RUMSSTORLEK, default 1000 m). The near 1200 m wave tier is
unchanged either way. Added in soarfulness #24 / aqua-wave-dream #233 (open).

## Bottom

`bottomIdx` (BOTTEN: off, sand, light sand, stone, coral, dark, clouds,
custom) with `bottomColor`, `floorDepth` (DJUP), `floorTexture` (TEXTUR) and
`floorCloudsAnimated`. Default is the clouds bottom. The sand photo is a
Lovable pointer that 404s off Lovable hosting; `lib/sandTexture.ts` provides
a procedural fallback so the floor isn't black (soarfulness #25 /
aqua-wave-dream #234).
