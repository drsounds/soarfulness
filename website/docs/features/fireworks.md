---
title: Fireworks (FYRVERKERI)
description: CPU-simulated rockets and bursts with synthesized sound and coloured lights on the scene and the water.
---

# Fireworks (FYRVERKERI)

| Setting | UI | Default |
| --- | --- | --- |
| `fireworksOn` | FYRVERKERI | off |
| `fireworksIntensity` | INTENSITET: burst size, star count, brightness (EXTREME max 4) | 1 |
| `fireworksRate` | RAKETER/MIN (EXTREME max 240) | 12 |
| `fireworksDistance` | AVSTÅND (m) | 250 |
| `fireworksLightsOn`, `fireworksLightStrength` | FYRVERKERILJUS, LJUSSTYRKA | on, 1 |
| `fireworksSoundOn`, `fireworksVolume` | FYRVERKERILJUD, LJUDVOLYM (also needs LJUD) | on, 0.7 |

**Files:** `src/apps/fireworks/Fireworks.ts` (`Fireworks`, `FireworksAudio`).

**How it works:**

- **Visuals:** one `THREE.Points` cloud of up to `FIREWORKS_MAX_PARTICLES`
  CPU-simulated particles (rockets, stars, trail sparks, crackle) drawn
  additively, plus halo sprites for the burst flash. Rockets launch from the
  water surface some way in front of the camera.
- **Lights:** `FIREWORKS_LIGHTS` (4) flash slots follow the latest bursts. They
  feed a pool of `THREE.PointLight`s (added lazily, once, for lit `.glb`
  scenes) and the ocean uniforms `uFwLightPos` / `uFwLightCol` so bursts glint
  on the waves.
- **Sound:** `FireworksAudio` synthesizes whoosh, whistle, boom with echo and
  crackle in its own `AudioContext`; no audio files. Each sound is delayed by
  distance / 343 m/s, panned and attenuated, and muffled under water.

**Status:** soarfulness #28 (merged), `events` group. aqua-wave-dream #237 (open).
Not gated on experimental mode.
