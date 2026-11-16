---
title: Confetti (KONFETTI)
description: Coloured paper pieces that spin and tumble down around the camera, built like the snowfall.
---

# Confetti (KONFETTI)

| Setting | UI | Default |
| --- | --- | --- |
| `confettiOn` | KONFETTI | off |
| `confettiAmount` | KONFETTIMÄNGD (EXTREME max 40 000) | 3000 |
| `confettiIntensity` | KONFETTISTYRKA (EXTREME max 4) | 0.5 |
| `confettiPalette` | KONFETTIFÄRGER: `CONFETTI_PALETTES` rainbow / pastel / gold / white | rainbow |
| `confettiFlutter` | FLADDER (0..2) | 0.6 |

**Files:** `src/apps/confetti/Confetti.ts` (`Confetti`).

**How it works:** the same technique as `Snowfall`: one `THREE.Points` cloud of
`CONFETTI_MAX_PIECES`, first `amount` drawn, positions from seed + time +
camera in the vertex shader inside a camera-following box. Each point sprite
is cut into a rotated rectangle in the fragment shader; its short side shrinks
and grows with the tumble and its shade changes as it shows its back. Palettes
can add a `shine` glint (foil). `uSink` keeps pieces falling while the camera
descends.

**Status:** soarfulness #27 (merged), `events` settings group. aqua-wave-dream
#236 (open; aqua's settings filter out the `events` group until it lands).

Keep `snow.ts` and `confetti.ts` behaviour in sync when one changes.
