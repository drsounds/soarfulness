---
title: Open-water drift (HAVSDRIFT)
description: An endless horizontal drift in a circle or a random wander, applied as a velocity in every mode.
---

# Open-water drift (HAVSDRIFT)

Keeps carrying the bather around the way open water moves a swimmer or a
boat, even with every stick at rest.

| Setting | UI | Default |
| --- | --- | --- |
| `openDriftOn` | HAVSDRIFT | off |
| `openDriftCurve` | DRIFTKURVA: CIRKEL / SLUMPVIS (`"circle"` / `"wander"`) | circle |
| `openDriftRadius` | CIRKELRADIE (m, EXTREME max 2000) | 10 |
| `openDriftDirection` | RIKTNING (`cw` / `ccw`) | cw |
| `openDriftCycleSpeed` | CYKELTEMPO (laps or course changes per minute) | 0.5 |
| `openDriftMagnitude` | DRIFTSTYRKA (EXTREME max 4) | 1 |

**Files:** `src/lib/openDrift.ts` (`OpenDrift` class, types, constants),
`src/lib/openDrift.test.ts`. UI in the `drift` settings group (it was in the
VÅGOR tab right after SVALL, not under MILJÖ).

**How it works:** the drift is a **velocity** (m/s, world x/z), not an
offset, so it never pulls back to where it started. It is applied to
`posRef` and `camX/camZ` together just before the VÄRLDSGRÄNS wrap block in
`animate()`, in every mode (in soarfulness GUNGA with a swing hook is
skipped). In "circle" the speed is eased, not the velocity vector, so the
radius stays true; DRIFTSTYRKA scales the circle at a fixed lap time. Wander
speed is 0.6 m/s × STYRKA with smooth value noise in the turn rate. Toggling
and slider changes are eased.

**Status:** soarfulness #31 (merged). aqua-wave-dream #240 (open).

**Gotcha:** headless SwiftShader runs in slow motion (`dt` is capped at
0.1 s), so measured drift speed there is far below the setting.
