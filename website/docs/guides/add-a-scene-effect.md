---
title: Add a feature app
description: How to build a new feature as an app in src/apps/<id> with a manifest, settings slice and runtime, and wire it into the host.
---

# Add a feature app

Since soarfulness #52, new features go in a **new app folder**,
`src/apps/<id>/`, never in the old `src/lib/sceneFx/` (repo `CLAUDE.md`). The
contract is in [Apps: the plugin architecture](../architecture/plugin-refactor.md);
this page is the practical walk-through. Good templates: `snow` (GPU particles
+ material patching), `rain` (depends on `wind`), `aurora` (sky ribbons),
`fireworks` (CPU particles + lights + WebAudio), `hood` (full-screen pass),
`underwater-fog` (DOM overlay).

We'll add a rainbow, app id `rainbow`, UI name REGNBÅGE.

## 1. The folder

```text
src/apps/rainbow/
  manifest.json       { id, name: "REGNBÅGE", title, version, kind, settingsGroup, dependencies… }
  settings.ts         RainbowSettings, RAINBOW_DEFAULTS, RAINBOW_SETTING_KEYS
  app.ts              export default defineApp({ manifest, settings, createRuntime })
  Rainbow.ts          the three.js class (one class per file)
  RainbowRuntime.ts   AppRuntime: turns the settings slice into what Rainbow needs
  rainbowMath.ts      pure functions, with rainbowMath.test.ts next to it
```

`core/apps/catalog.ts` discovers `app.ts` with `import.meta.glob`;
`registry.test.ts` checks the manifest (dependencies, ranges, cycles,
duplicate settings keys, a valid `settingsGroup`).

## 2. Settings slice

```ts
// src/apps/rainbow/settings.ts
export type RainbowSettings = {
  // REGNBÅGE: a rainbow arc opposite the sun. rainbowStrength 0..~4.
  rainbowOn: boolean;
  rainbowStrength: number;
};
export const RAINBOW_DEFAULTS: RainbowSettings = { rainbowOn: false, rainbowStrength: 1 };
export const RAINBOW_SETTING_KEYS = Object.keys(RAINBOW_DEFAULTS) as (keyof RainbowSettings)[];
```

Prefix every key with the app name; keys are a public format (saves, presets,
links). Don't import runtime code from `lib/settingsShared.ts` here.

## 3. The class and the runtime

```ts
// src/apps/rainbow/Rainbow.ts
// REGNBÅGE: <explain the technique: what is drawn, how, which uniforms it reads>.
export class Rainbow {
  constructor(scene: THREE.Scene) { /* allocate once at max size; hidden */ }
  update(/* … */) { /* write uniforms only */ }
  hide() { /* … */ }
  dispose() { /* remove from scene, dispose geometry/material/textures */ }
}

// src/apps/rainbow/RainbowRuntime.ts
export class RainbowRuntime implements AppRuntime<RainbowSettings> {
  private rainbow: Rainbow;
  constructor({ scene }: { scene: THREE.Scene }) { this.rainbow = new Rainbow(scene); }
  frame(f: FrameContext, s: Readonly<RainbowSettings>) {
    if (!s.rainbowOn) return this.rainbow.hide();
    this.rainbow.update(f.time, f.dt, f.camera, { strength: s.rainbowStrength, night: f.night });
  }
  dispose() { this.rainbow.dispose(); }
}
```

If the runtime needs something from the host that `FrameContext` doesn't
carry, add a field to `FrameContext` (and to `appFrame` in `index.tsx`)
rather than reaching into `index.tsx`. Values the host needs back (like
`AuroraRuntime.glow` or `FireworksRuntime.lightPos`) are getters.

Conventions the existing apps follow:

- **Header comment** with the Swedish UI name and the technique.
- **Allocate once**: max-size buffers + `setDrawRange`; lights created lazily
  once so lit materials don't recompile.
- **Camera-following boxes** for endless particle fields (positions from seed +
  time + camera in the vertex shader).
- **Hide under water** (`f.underwater`) and honour `f.lowEnd`.
- **Sound** in its own lazily created `AudioContext`, gated on `f.audioOn` and
  the app's own toggle.

## 4. Wire it into the host (`src/routes/index.tsx` and friends)

Until the generic host loop (migration step 3) exists:

1. `& RainbowSettings` in `Persisted` (`lib/settingsShared.ts`),
   `...RAINBOW_SETTING_KEYS` in the right `PRESET_TAB_FIELDS` tab,
   `...RAINBOW_DEFAULTS` in `DEFAULTS`.
2. The per-setting host plumbing from [Add a setting](add-a-setting.md)
   (state, snapshot, autosave deps, reset, `applySettingsPatch`, panel props,
   EXTREME, locales).
3. Build the slice and its ref:
   `const rainbowSettings: RainbowSettings = { rainbowOn, rainbowStrength };`
   `const rainbowSettingsRef = useRef(rainbowSettings); rainbowSettingsRef.current = rainbowSettings;`
4. In the mount effect: `const rainbow = new RainbowRuntime({ scene });`, in
   `animate()`: `rainbow.frame(appFrame, rainbowSettingsRef.current);`, in the
   cleanup: `rainbow.dispose();`.
5. If it **changes the water**, add ocean shader uniforms; if it **changes
   the env backdrop**, add it to the `useEnvDome` condition; if it is a **DOM
   overlay**, render a `div` between the canvas and the HUD and style it from
   the loop.
6. Put its dials in `src/apps/rainbow/RainbowPanel.tsx` and render that inside
   the right `<G id="…">` in `SettingsPanel.tsx`.
7. Run `bun test` and `npx tsc --noEmit`, add a row to the
   [feature index](../reference/feature-index.md) and a feature page here.

## Apps that own their store

If the state shouldn't travel in presets or links, or is a per-scene list,
give the app an external store like `string-lights`
(`src/apps/string-lights/stringLights.ts`, `useSyncExternalStore`, its own
localStorage key) and a prop-free panel. Then the host only constructs,
updates and disposes it.
