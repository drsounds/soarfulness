---
title: The bather — hood and goggles
description: HUVA, a hoodie hood drawn as a full-screen shaded pass with layers, cuffs, zipper and water inside; and SIMGLASÖGON swimming goggles.
---

# The bather: hood and goggles

Both live in the `bather` settings group (formerly the KAMERA tab, after
SIMGLASÖGON).

## HUVA (hood)

A hoodie hood around the bather, seen from inside. Off by default; not
gated on experimental mode.

### Settings (layer 1)

| Setting | UI | Default |
| --- | --- | --- |
| `hoodOn` | HUVA | off |
| `hoodHeight` | HÖJD FRÅN BOTTEN (where the sides end; hidden while MUN OCH HALS is on) | 0.3 |
| `hoodOpening` | ÖPPNING | 0.5 |
| `hoodOpeningWidth` | ÖPPNINGSBREDD in screen widths, 0 = AUTO (EXTREME max 12) | 0 |
| `hoodColor` | HUVFÄRG | `#2b3a55` |
| `hoodMetallic` | METALLGLANS (wet metallic sheen) | 0.5 |
| `hoodReflectLight` | REFLEKTERAR LJUS (sheen reflects sky, not dark water) | on |
| `hoodMotion` | RÖRELSE (spring sway + cloth flutter) | 0.5 |
| `hoodHanging` | HÄNGER FRÅN TOPPEN (sway scales with height, twists about the top) | on |
| `hoodDrop`, `hoodWeight`, `hoodWrinkles`, `hoodDarkness` | HUVHÖJD, TYNGD, VÅTA VECK, MÖRKHET | 0, 0.4, 0, 0 |
| `hoodRoundness` | RUNDHET (superellipse exponent 6 → 2) | 0.85 |
| `hoodStyle` | STIL: classic / puffy / quilted / shell (SKALJACKA) / down (DUN) | classic |
| `hoodPuffSize`, `hoodPuffHeight`, `hoodPuffThickness`, `hoodPuffInflate` | PUFFSTORLEK, PUFFHÖJD, PUFFTJOCKLEK, UPPBLÅSNING I VATTEN (padded styles only, `HOOD_PADDED_STYLES`) | 0.4, 0.5, 0.5, 0 |
| `hoodLowerOn`, `hoodLowerHeight` | MUN OCH HALS, TÄCKHÖJD (close the hood under the face) | off, 0.45 |
| `hoodZipperOn`, `hoodZipperFixed`, `hoodZipperPullOut` | BLIXTLÅS, BLIXTLÅS FÄST I TYGET, DRAGARE PÅ UTSIDAN | off, on, on |
| `hoodCuffOn`, `hoodCuffHeight`, `hoodCuffSize`, `hoodCuffTop` | MUDD, MUDDHÖJD, RIBBSTORLEK, MUDD VID HALSKANT | off, 0.3, 0.5, on |
| `hoodCuffCustom`, `hoodCuffColor`, `hoodCuffMetallic`, `hoodCuffMaterial` | EGEN MUDD, MUDDFÄRG, MUDDGLANS, MUDDMATERIAL (knit / smooth / rubber) | off |
| `hoodWaterOn`, `hoodWaterLevel`, `hoodWaterCalm` | VATTEN I HUVAN, VATTENNIVÅ, VATTENLUGN | off, 0.3, 0.6 |

### Layers

Layer 1 is the flat `hood*` fields (so old saves keep working). Layers 2+
are `hoodExtraLayers: HoodLayer[]` (max 4, sanitized), defined in
`src/apps/hood/hoodLayers.ts` with per-layer keys (`openingWidth`, `roundness`,
`style`, `cuff`, `reflectLight`, `waterCalm`, `hanging`, …). The UI is
`src/apps/hood/HoodPanel.tsx` (+ LAGER, TA BORT LAGER). Saved layer sets
live in `aquafulness:hoodLayerSets:v1` and export as `aquafulness-hood-layers`
files. One `Hood` object per layer, `renderOrder` 1e6 + i.

### How it renders (`src/apps/hood/Hood.ts`)

- A single **clip-space quad** drawn last in the 3D scene: depth test off,
  highest render order. It is over water and sky, under every DOM control, and
  still goes through RETRO and chromatic aberration.
- The fabric is a **height field** (hem roll, gathers running out from the
  opening, curving away to the screen edges). Its normals are shaded with the
  sun and an analytic sky/horizon/water environment from the ocean uniforms
  (`uSkyColor`, `uHorizonColor`, `uWaterDeep`, `uSunColor`, `uSunDir`), so the
  hood follows time of day.
- RÖRELSE lags the hood behind head turns on a damped spring; HÄNGER FRÅN
  TOPPEN warps the sway by height (`hangWarp()`, `uTwist` spring).
- Water inside: fabric below a per-pixel waterline (eye height minus surface,
  plus ray.y × 0.3 m) shows as under water. VATTENLUGN makes the level follow
  `eyeAboveWater` on a damped spring with capped speed, which fixed a
  lightning-like flicker at high wave speed. `Hood.soak` drives UPPBLÅSNING.

**Status:** soarfulness #32, #34–#42, #45 (merged). aqua-wave-dream #241
(open, carries all of it).

## SIMGLASÖGON (goggles)

`gogglesOn`, `gogglesBlur` (LINSOSKÄRPA), `gogglesLoop` (DROPPLOOP),
`gogglesIntensity`, `gogglesFpsCap` (BILDFREKVENS). `components/GogglesOverlay.tsx`
draws water droplets on the lens and an optional whole-screen blur, as a DOM
layer above the canvas and below the HUD.
