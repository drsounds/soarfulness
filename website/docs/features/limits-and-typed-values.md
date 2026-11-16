---
title: EXTREME limits and typed values
description: The EXTREME toggle that unlocks high maximums, and typed numbers that bypass slider limits.
---

# EXTREME limits and typed values

## EXTREME

`src/lib/extremeLimits.ts`:

- `EXTREME_MAX` lists the full maximum of every limited control (VÅG 100 m,
  SVAJ 60, SVALL 60, NAV 16 m/s, STRÖM 132 m/s, TORNADO radius 2000 / tempo 20,
  GUNGA, RIDE, SNÖ 40 000 / 4, KONFETTI, FYRVERKERI, NORRSKEN, HAVSDRIFT,
  hood opening width, …).
- `NORMAL_FRACTION` = 0.25: without EXTREME the max is 25 % of that
  (`limitMax(control, extreme)`).
- The toggle is the visitor's own preference (`aquafulness:extremeLimits:v1`,
  `useExtremeLimits()`), so presets and links never flip it. Shown always in
  soarfulness, only in EXPERIMENTELLT LÄGE in aqua-wave-dream.
- A clamp effect in `index.tsx` lowers values above the everyday max **when
  EXTREME is turned off**.

**Adding a limited control:** add it to `EXTREME_MAX`, use `mx("name")` for the
max in `SettingsPanel.tsx` and index's HUD, and add a `clamp(…)` line plus its
dependency to the clamp effect.

soarfulness #10 / aqua-wave-dream #222 (both merged).

## Typed values override limits

Every scalar setting can be set beyond its slider range by typing a number
into the readout (`SettingRow` `NumberControl`, `PadDial`). The value is stored
as-is; the slider keeps its range and pins at the nearest end.
`parseTypedNumber` in `SettingRow.tsx` ignores empty, NaN and infinite input.

**Rule:** `onSet` handlers don't clamp, except for hard floors where 0 or a
negative value would break rendering (counts, fps, near/far plane, the RIDE
camera seat). Pass `min`/`max` for the slider only.

soarfulness #48 (merged) / aqua-wave-dream #247 (open).
