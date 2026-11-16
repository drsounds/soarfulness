---
title: Northern lights (NORRSKEN)
description: Aurora curtains as rings around the camera, drawn at the far plane, with a cheap reflection on the water.
---

# Northern lights (NORRSKEN)

| Setting | UI | Default |
| --- | --- | --- |
| `auroraOn` | NORRSKEN | off |
| `auroraIntensity` | NORRSKENSSTYRKA (EXTREME max 4) | 1 |
| `auroraAmount` | NORRSKENSMÄNGD (0..1 → 1–7 bands) | 0.5 |
| `auroraSpeed` | RÖRELSE | 1 |
| `auroraHeight` | HÖJD PÅ HIMLEN (0 = low on the horizon all around, 1 = corona overhead) | 0.35 |
| `auroraPalette` | NORRSKENSFÄRGER: `AURORA_PALETTES` classic / green / red / violet / blue / rainbow / custom | classic |
| `auroraColorMain`, `auroraColorTop` | HUVUDFÄRG, TOPPFÄRG (custom palette) | `#3dff8c`, `#c23a9e` |
| `auroraDaylightOn` | SYNS PÅ DAGEN | off |

**Files:** `src/lib/sceneFx/aurora.ts` (`Aurora`).

**How it works:**

- Up to `AURORA_MAX_BANDS` thin vertical curtains, one ribbon mesh each. The
  vertex shader computes the wavy course, folds and ragged top; the fragment
  shader adds vertical rays, drifting brightness patches and colour layering
  (pink lower fringe, main colour, faint top colour).
- Each band is a **ring around the camera** (`RING_TURNS` 1.12, ends cross-fade,
  whole wave counts per turn so the seam doesn't show), so the aurora shows in
  all directions.
- Ribbons live in a camera-following group and every vertex is pushed to the
  far plane (`clip.z = w * 0.999999`): scene objects and clouds draw in front,
  while the aurora draws over the sky dome, skyboxes and (with additive
  blending) the DOM backdrop.
- Visibility follows `nightBackdropMix(tod)` unless SYNS PÅ DAGEN is on.
- The water reflection is an analytic band in the ocean shader
  (`uAuroraGlow`, `uAuroraElev`, `uAuroraHeight`), not a real reflection.

**Status:** soarfulness #29, #30 (merged). aqua-wave-dream #238 merged;
all-directions follow-up #239 open.

**Gotcha:** `active` is a reserved word in WebGL GLSL, and don't name a local
variable `main`.
