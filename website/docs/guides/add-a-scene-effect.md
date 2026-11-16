---
title: Add a scene effect
description: How to build a self-contained three.js effect in src/lib/sceneFx and wire it into the mount effect and the render loop.
---

# Add a scene effect

Most features since November 2026 follow the same pattern: a class in
`src/lib/sceneFx/<name>.ts` that owns its three.js objects, plus a few anchor
lines in `index.tsx`. Use `snow.ts` (GPU particles), `aurora.ts` (sky
ribbons), `fireworks.ts` (CPU particles + lights + WebAudio), `hood.ts`
(full-screen pass) or `underwaterFog.ts` (DOM overlay) as a template.

## The class

```ts
// src/lib/sceneFx/rainbow.ts
// REGNBÅGE: a rainbow arc opposite the sun. <Explain the technique here:
// what is drawn, how, and which uniforms it reads. Future readers rely on it.>
import * as THREE from "three";

export type RainbowConfig = {
  /** 0..~4: brightness (REGNBÅGSSTYRKA). */
  strength: number;
  /** 0 = day only … 1 = always (from nightBackdropMix). */
  night: number;
};

export class Rainbow {
  private mesh: THREE.Mesh;
  constructor(scene: THREE.Scene) {
    // allocate geometry/material ONCE at max size; hide until used
    this.mesh = new THREE.Mesh(/* … */);
    this.mesh.visible = false;
    scene.add(this.mesh);
  }
  update(time: number, dt: number, camera: THREE.Camera, cfg: RainbowConfig) {
    this.mesh.visible = cfg.strength > 0;
    // write uniforms only; don't rebuild geometry per frame
  }
  hide() { this.mesh.visible = false; }
  dispose() { /* remove from scene, dispose geometry, material, textures */ }
}
```

Conventions the existing effects follow:

- **Header comment** with the Swedish UI name and an explanation of the
  technique. These comments are the main documentation of the code.
- **Allocate once.** Particle effects allocate their maximum buffer and use
  `setDrawRange` for the amount. Lights are created lazily on first use and
  kept, so lit materials don't recompile.
- **Camera-following boxes** make particle fields endless at no CPU cost:
  positions are computed in the vertex shader from a seed, the time and the
  camera, then wrapped.
- **Hide under water** with the `uUnderwater` uniform value, and respect
  `lowEnd` (halve counts, skip expensive passes).
- **Sound** gets its own small `AudioContext`, created lazily, suspended when
  silent, and gated on `audioOn` (LJUD) as well as the feature's own toggle.
- **Pure logic** that can be tested (curves, sanitizers) goes in a plain
  module with a `*.test.ts` next to it (`openDrift.ts`, `wind.ts`,
  `underwaterFog.ts`).

## Wiring it in `index.tsx`

1. **Import** next to the other `sceneFx` imports.
2. **Construct** in the mount effect next to the others
   (`const rainbow = new Rainbow(scene);` after `new Confetti(scene)`).
3. **Update** in `animate()` near related effects, reading refs only:

   ```ts
   // REGNBÅGE: <one line on what happens here>.
   if (rainbowOnRef.current) {
     rainbow.update(now / 1000, dt, camera, {
       strength: rainbowStrengthRef.current,
       night: nightBackdropMix(todRef.current),
     });
   } else {
     rainbow.hide();
   }
   ```

4. **Dispose** in the mount effect's cleanup (`rainbow.dispose();`).
5. If it **changes the water**, add uniforms to the ocean shader. If it
   **changes the env backdrop**, add it to the `useEnvDome` condition.
6. If it is a **DOM overlay**, render a `div` in the JSX at the right layer
   (above the canvas, below the HUD) and style it imperatively from the loop.

Then do the settings with [Add a setting](add-a-setting.md).

## Effects that own their settings

If the effect's state shouldn't travel in presets or links, or is a list
edited per scene, give it an external store like LJUSSLINGOR
(`lib/stringLights.ts` with `useSyncExternalStore` and its own key), a
prop-free settings component, and only construct/update/dispose in
`index.tsx`. This keeps `index.tsx` and `SettingsPanelProps` untouched and is
closest to the coming plugin structure.
