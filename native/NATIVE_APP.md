# Native app (iOS/Android) — status

This directory is an Expo + [`react-native-webgpu`](https://wcandillon.github.io/react-native-webgpu/)
port of the web app's ocean scene, so it can build as a real iOS/Android app
instead of running in a browser. **Read this whole file before trusting
anything in here** — it was written under real constraints that shaped what
"ported" means below.

## The constraint that shapes everything here

This was authored in a sandboxed environment with **no GPU and no iOS/Android
device or emulator**. Nothing in `src/three/` has been compiled or run.
`npm install` was never even executed in this directory. Everything here is a
best-effort, code-reading-level translation — expect to spend real time
debugging it the first time it actually runs on a device.

Two things partly de-risk this:

- The renderer setup (`src/three/webgpuRenderer.ts`, `metro.config.js`) and
  the Canvas/device wiring (`src/components/OceanCanvas.tsx`) follow
  react-native-webgpu's own documented patterns and code examples closely
  (see [docs](https://wcandillon.github.io/react-native-webgpu/docs/integrations/three-js)).
- The shader materials (`src/three/materials/*.ts`) were translated from
  three.js's own TSL example modules' idioms (`WaterMesh.js`, `SkyMesh.js`
  from `three/examples/jsm/objects/`), not guessed from scratch.

Still: budget real device-testing time before this is usable.

## What "ported" means, concretely

| Area | Status |
| --- | --- |
| Ocean wave math (`src/lib/ocean/*.ts`) | **Copied verbatim / near-verbatim.** Pure TypeScript, platform-agnostic, same code as the web app. Low risk. |
| Ocean water shader | **Translated GLSL → TSL**, 1:1 where possible (`src/three/materials/oceanMaterial.ts`). Unverified — see above. |
| Seafloor/cloud/sky shaders | **Translated GLSL → TSL**, with one known simplification: turbidity fog uses world-position distance instead of the original's `gl_FragCoord.z`-reconstructed view depth (commented in `groundCloudMaterial.ts`). |
| Camera buoyancy physics | **Simplified**, not a full port. The web app's `animate()` loop has an elaborate anticipatory-velocity/feed-forward spring system (~150 lines) for the vertical bob, plus drift/sway pads, vortex/swing camera modes, and audio-depth sync. `scene.ts` implements a plain critically-damped spring toward `waveHeight()` and camera-relative NAV walking + LOOK yaw/pitch — recognizable, not identical. |
| Controls | NAV + LOOK joysticks only (`src/components/Joystick.tsx`, RN `PanResponder`). No STRÖM/SVAJ drift/sway pads. |
| Settings | A **small fraction** of the web app's ~2000-line `SettingsPanel.tsx`: wave amplitude, frequency, and a "realistic waves" toggle (`src/components/ControlsOverlay.tsx`). Everything else (water tint, camera modes, environments, presets, audio, interval sessions, torus rings, TV panel…) is not exposed. |
| Textures | Sand texture is a **4×4 procedural placeholder**, not the real photo asset — the web app's asset pipeline (`*.asset.json` + Lovable CDN URLs) wasn't ported. |
| Sun/time-of-day | A fixed default sun direction, not the web app's full day-cycle system. |

## Not ported at all

These features exist in the web app (`src/routes/index.tsx` and friends) and
have **no equivalent here yet**:

- **CSS3D "TV" panel with YouTube embed** (`src/lib/tv/CSS3DTVManager.ts`,
  1600+ lines). This is fundamentally a browser technique — rendering an
  `<iframe>` positioned in 3D space via `CSS3DRenderer` — with no native
  equivalent. A native version would need a different approach entirely
  (e.g. a `WebView` positioned/masked to approximate the effect, or a native
  video texture instead of a live YouTube embed). Out of scope here.
- GLTF scene loading / scene selector, torus ring field, presets
  import/export, spatial audio, interval sessions, environments/skyboxes,
  the virtual-phone remote-control UI (`VirtualPhone.tsx`).

## Before this can actually run

1. `cd native && npm install` — this has never been run; expect dependency
   resolution issues on the first try (version pins above are best-guess,
   not verified against the real dependency graph).
2. `npx expo prebuild` to generate the `android`/`ios` projects (not
   committed — see `.gitignore` — this repo uses Continuous Native
   Generation, so `app.json`/`metro.config.js` are the source of truth).
3. Run on a **physical device** if possible — WebGPU on Android emulators
   commonly falls back to a slow software adapter (see
   react-native-webgpu's own troubleshooting docs).
4. Expect to debug the TSL shaders first. Likely trouble spots: whether
   `uniformArray` element mutation (`src/three/scene.ts`'s `packWaveUniform`)
   actually re-uploads each frame the way it's assumed to; whether
   `NodeMaterial.vertexNode` returning a full clip-space `vec4` behaves
   exactly like the SkyMesh/WaterMesh examples imply; and general TSL
   type/argument-order mismatches that only surface at build time.

## CI

`.github/workflows/native-android-build.yml` builds an unsigned debug APK via
`expo prebuild` + `./gradlew assembleDebug` on every change under `native/`.
It has no `package-lock.json` to cache against yet (see above) — add one (and
enable `actions/setup-node`'s npm cache) once dependencies have actually been
installed and pinned for real. There's no iOS CI job yet (would need a
macOS runner + code signing setup); Android was the one explicitly asked for.
