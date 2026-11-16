---
title: Time of day and backdrops
description: TIMEOFDAY, time travel, environment skyboxes, day/night blending, sunset tint, daylight tint and night backdrops.
---

# Time of day and backdrops

## Time

- `timeOfDay` (TID, 0..1: 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 =
  sunset) drives `palette()` in `index.tsx`: sky, horizon, water, sun colour and
  direction.
- **Clock and time travel:** `clockOn` (KLOCKA) shows a clock. The
  `TimeTravelDialog` pins a simulated "now" (`timeTravelBaseMs`,
  `timeTravelSetAtMs`) that keeps ticking; `timeSeasonalSync` maps that date's
  local time to TIMEOFDAY with a northern-hemisphere sunrise/sunset
  approximation (`lib/timeTravel.ts`, Stockholm-ish latitude; there is no GPS).
  Years ≥ 2100 count as "futuristic".
- `liveMode` (LIVE) shows a playful live-broadcast overlay (`LiveBroadcast` at
  the end of `index.tsx`).

## Environments (skyboxes)

`envId` / `envEra` / `envTime` select a skybox from `public/apps/*/environments/`
(see [Content apps](../architecture/content-apps.md)). The default is the
`sky` environment. `backdropIdx` (BAKGRUND) is the older flat DOM backdrop
behind a transparent canvas (`BACKDROPS`: off, Vänern).

The environment dome (`envDomeMat`) is only drawn when something has to
change the photo: `useEnvDome = envTex && (envTintOn || envBlending || sunTint > 0 || snowCover > 0)`.
Any new effect that alters the backdrop must join that condition.

| Feature | Setting | UI | Default | Code |
| --- | --- | --- | --- | --- |
| Daylight tint | `envDaylightTintOn`, `envDaylightTintStrength` | DYGNSTONING, TONINGSSTYRKA | off | `src/apps/day-night/daylightTint.ts`: tint relative to the skybox's own `timeOfDay` |
| Day/night blend | `envDayNightAutoOn` | DYGNSBYTE | **on** | `src/apps/day-night/dayNightBackdrop.ts`: `nightBackdropMix(tod)` cross-fades the day and night skybox about two hours either side of sunrise/sunset. Only for eras that list both `day` and `night`. |
| Sunset tint | `envSunTintOn` | SOLTONING | **on** | `sunsetTintAmount()`: warm tint on the env dome, the water reflection, and a multiply overlay on the flat DOM backdrop |
| Cloud surface | `waterCloudsOn` | MOLNYTA | off | see [Waves and water](waves-and-water.md) |

`nightBackdropMix()` is reused all over: aurora visibility, snow-cover light,
rain brightness, string-light glow.

## Night backdrops

Since soarfulness #23 / aqua-wave-dream #232 every environment has a night
time. The night images for Stockholm, Bucharest, Vänern nutid,
Strandpark/Framnäs nutid and Himmel were generated **procedurally** from the
day photos (PIL/numpy/scipy: stars, moon, moonlit clouds, floodlit facades,
lit windows), not by an image model. Stockholm/Bucharest day images were
remapped so the photo waterline sits on row H/2, the scene horizon.

**Status:** DYGNSBYTE soarfulness #16 / aqua #226; SOLTONING + MOLNYTA
soarfulness #19 / aqua #229 (MOLNYTA in aqua is #231, open); night backdrops
soarfulness #23 / aqua #232. All merged except aqua #231.
