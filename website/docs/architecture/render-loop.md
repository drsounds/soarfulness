---
title: The render loop
description: The three.js scene built in the mount effect, the animate() frame, shader uniforms, and how sceneFx effects plug in.
---

# The render loop

## The mount effect

The whole three.js world is built once, in a `useEffect(() => { … }, [])` in
`Aquafulness()` that starts with:

```ts
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
// …
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(/* … */);
const composer = new EffectComposer(renderer); // chromatic aberration + RETRO passes
const uniforms = { uTime, uAmp, uSunDir, uSkyColor, uWaterDeep, … };  // the ocean shader's
```

In order, it creates: lights (sun `DirectionalLight` + hemisphere), the
post-processing composer, the **ocean** (`ShaderMaterial` with the big
uniform set above, a near wave tier of `OCEAN_BASE_SIZE` = 1200 m plus a flat
far ring sized by `waterPlaneExtent()`), the seafloor (`floorMat`), mid, sky
and tornado cloud decks, 3D cloud layers (`lib/clouds3d.ts`), sky puffs, the
sky dome, the environment dome (`envDomeMat`, for skybox photos), and then
the scene effects:

```ts
const aurora = new Aurora(scene);
const windField = new WindField();
const windAudio = new WindAudio();
const underwaterFog = new UnderwaterFogOverlay();
const openDrift = new OpenDrift();
const neonEdges = new NeonEdges(scene);
const stringLights = new StringLightsFx(scene);
const snowfall = new Snowfall(scene);
const snowCover = new SnowCover();
const fireworks = new Fireworks(scene);
const confetti = new Confetti(scene);
const hoods = Array.from({ length: HOOD_MAX_LAYERS }, (_, i) => new Hood(scene, i));
```

Then `animate()` runs every frame through `requestAnimationFrame`. The
cleanup function cancels the frame, saves the camera pose and disposes
every geometry, material, texture and effect.

Because this effect never re-runs, **the loop reads settings only through
refs** (`snowAmountRef.current`), never through React state. See
[The settings pipeline](settings-pipeline.md#3-state-and-ref-in-aquafulness).

Things that load asynchronously (the selected `.glb` scene, the environment
skybox, the water surface reflection) are handled by separate effects keyed
on their ids (for example the scene loader on `[sceneId, sceneAppId]`). They
put the result in refs (`modelRef`, env textures) that the loop picks up.

## One frame: `animate()`

`animate` is very long. Its blocks are marked by comments with the feature's
UI name in capitals, so grep for the name. The rough order is:

1. **Frame setup**: `LOW GRAPHICS MODE` flag (`lowEnd`), resolution scale,
   camera lens (FOV/near/far).
2. **VIND**: update the live wind first (`windField`), because wave direction,
   sway, current and rain read it.
3. **SKUGGOR** (shadows): fit the sun's shadow camera around the loaded model.
4. **Backdrop and time of day**: DYGNSTONING (env tint), DYGNSBYTE (day/night
   skybox blend, `nightBackdropMix`), SOLTONING (sunset tint), SNÖTÄCKE on
   the env dome, then the `useEnvDome` decision.
5. **BÄTTRE LJUS** (IBL from the sky or skybox), **VATTENGLÖD** (water glow),
   water color and shader uniforms.
6. **Water level**: DEPTH SINE, LEVEL DRIFT (NIVÅ DRIFT), DRIFT SINUS.
7. **Clouds**: MOLN TONING fades, cloud deck recentering.
8. **Movement** for the current camera mode: GUNGA (swing) pendulum, NAV and
   STRÖM sticks, TORNADO, RIDE (`FREAK OUT` in code), BODYFLIGHT, HAVSDRIFT,
   VIND STRÖM, then **VÄRLDSGRÄNS** wraps x/z/y to the world boundary.
9. **Camera pose**: buoyancy on the wave, sway, surge, lean, look target.
10. **Audio**: HÖJDLJUD (altitude fade of the water track), wind sound.
11. **Scene effects**: NORRSKEN, UNDERVATTENDIS, sky puffs, string lights,
    snow, confetti, fireworks, hoods, neon edges.
12. **Render**: `composer.render()` when a post pass (chromatic aberration,
    RETRO) is on, otherwise `renderer.render(scene, camera)`.

`dt` is capped (0.1 s), so a slow headless renderer runs in slow motion
rather than jumping. Keep that in mind when you measure speeds in tests.

## Shader uniforms are the integration surface

The ocean `ShaderMaterial`'s uniforms (`uniforms` in the mount effect, also
exposed as `waterUniformsRef`) are shared state between the water and other
effects. For example:

| Uniforms | Written by | Read by |
| --- | --- | --- |
| `uSkyColor`, `uHorizonColor`, `uWaterDeep`, `uWaterShallow`, `uSunColor`, `uSunDir` | time-of-day palette | ocean, hood shading (`hood.ts` takes them to shade the fabric), auto water color for UNDERVATTENDIS |
| `uAuroraGlow`, `uAuroraElev`, `uAuroraHeight` | NORRSKEN | ocean (cheap analytic reflection band) |
| `uFwLightPos`, `uFwLightCol` | FYRVERKERI | ocean (burst flashes on the waves) |
| `uGlow`, `uGlowColor` | VATTENGLÖD | ocean |
| `uEnvTex`, `uEnvTexNight`, `uEnvNightMix`, `uEnvSunTint` | backdrop | ocean reflection |
| `uCloudSurface` | MOLNYTA | ocean |
| `uVortex*` | TORNADO / VIRVEL | ocean surface vortex |
| `uUnderwater` | camera vs. water level | snow, rain, fireworks sound, hood |

When a new effect needs to change the water, add a uniform to `uniforms`, to
the ocean shader source, and set it in `animate()`.

## Render order and layers

- Background decks use negative `renderOrder` (floor −2, clouds −1).
- NORRSKEN pushes its vertices to the far plane (`clip.z = w * 0.999999`) in a
  camera-following group, so every scene object draws in front of it while it
  still draws over the sky.
- HUVA is one clip-space quad with depth test off and `renderOrder` 1e6 (+ layer
  index), so it frames the view over everything 3D but stays below the DOM HUD
  and still goes through the post passes.
- UNDERVATTENDIS and the goggles are **DOM overlays** above the canvas and below
  the HUD, styled imperatively from the loop, not React state.
- The canvas is transparent (`alpha: true`); a flat DOM backdrop image can sit
  behind it. Additive effects (aurora, fireworks) also show over that backdrop.
- Any effect that changes the env backdrop has to be added to the
  `useEnvDome` condition, or it won't show for flat skyboxes.

## Performance switches

- `lowGraphicsMode` (`lowEnd` in the loop) halves particle counts, skips the
  shadow pass, live noise layers and RAYTRACED offscreen passes.
- `resolutionScale` multiplies the pixel ratio.
- `targetFps` caps the frame rate.
- Effects allocate their maximum buffers once and change only the draw range
  (`setDrawRange`) when an amount changes, and point lights are created lazily
  once (FYRVERKERI, LJUSSLINGOR) so lit materials don't recompile.
