# Native app (iOS/Android) — status

This directory is an Expo + [`react-native-webgpu`](https://wcandillon.github.io/react-native-webgpu/)
port of the web app's ocean scene, so it can build as a real iOS/Android app
instead of running in a browser. **Read this whole file before trusting
anything in here** — it was written under real constraints that shaped what
"ported" means below.

## The constraint that shapes everything here

This was authored in a sandboxed environment with **no GPU and no iOS/Android
device or emulator**. Nothing in `src/three/` has been compiled or run.
Everything in the shader/scene/rendering code is a best-effort,
code-reading-level translation — expect to spend real time debugging it the
first time it actually runs on a device.

`npm install` **has** now been run for real in this directory (resolved
cleanly, 956 packages, no conflicts — `package-lock.json` is committed), so
the dependency versions listed in `package.json` are confirmed to actually
co-exist. That's a lower bar than "it builds" or "it runs", but it does rule
out an entire category of failure.

Two more things partly de-risk the unverified parts:

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

1. ✅ `cd native && npm install` — done, resolves cleanly (see above).
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

`.github/workflows/native-android-build.yml` builds Android **directly on
the GitHub Actions runner** — `expo prebuild` + `./gradlew assembleDebug` —
rather than delegating to EAS Build. It triggers on push to `main` or PRs
touching `native/**`, or manually via `workflow_dispatch`, and uploads the
resulting unsigned debug APK as a workflow artifact. It caches `npm` against
the committed `package-lock.json` and installs via `npm ci`.

This is a deliberate choice, not the default/obvious option — see "EAS Build
vs. GitHub Actions" below for why.

`eas.json` and the `EXPO_TOKEN` repo secret are still in place (unused by CI
right now) in case EAS Build becomes viable again later — e.g. on a paid
Expo plan, or if the actual resource bottleneck gets tracked down and worked
around. There's no iOS CI job (would need a macOS runner + code signing);
Android was the one explicitly asked for.

### EAS Build vs. GitHub Actions

CI originally used EAS Build (`eas build --platform android`). That's
gone through several iterations:

1. **Metro couldn't resolve `three`'s package.json** (fixed) — `three`'s
   `"exports"` map doesn't expose `./package.json`, so
   `require.resolve("three/package.json")` threw. Fixed in `metro.config.js`
   by resolving `three`'s main entry (covered by `exports`) and walking up
   to the nearest `package.json` via `fs.existsSync` instead.
2. **Gradle build killed with no error** — the first real EAS Android build
   got through the entire Gradle task graph (all 254 tasks executed) but
   never printed `BUILD SUCCESSFUL` before EAS reported "Gradle build failed
   with unknown error" — the signature of the build machine being killed
   rather than an actual Gradle-reported failure. The initial guess was that
   `react-native-webgpu` compiling Dawn from source via CMake was the
   culprit — that guess was **wrong in its specifics**: Dawn actually ships
   *prebuilt* per-ABI (`libwebgpu_dawn.so`, linked via CMake's
   `IMPORTED_LOCATION`, see
   `node_modules/react-native-webgpu/android/CMakeLists.txt`); only a small
   ~30-file JNI wrapper compiles from source. The real source of the
   resource pressure (Kotlin compilation across the many
   `expo-dev-client`/`expo-dev-launcher`/`expo-dev-menu` modules, the
   dexing/linking step, or something else) is still unconfirmed.
3. Tried `resourceClass: "large"` on all Android profiles in `eas.json` as
   a mitigation — **reverted**. Expo confirmed the free EAS plan doesn't
   have the capacity to build this project *at all*, regardless of resource
   class, so the bump didn't fix anything.
4. **Current state**: CI builds directly on the GitHub Actions runner
   instead, sidestepping EAS's build machine (and Expo's plan tier)
   entirely — GitHub's `ubuntu-latest` runners are a separate resource pool.
   This is untested (see the constraint note at the top of this file), but
   it's the same recipe the very first version of this CI workflow used,
   before it was switched to EAS Build in the first place.

A precompiled-binary approach (compile `react-native-webgpu`'s native
module once, elsewhere, and vendor the resulting `.so`/AAR instead of
building it in CI at all) was considered but not pursued from this sandbox
specifically: it has no way to fetch an Android NDK/SDK toolchain here
(`dl.google.com`/`googleapis.com` are blocked by this sandbox's network
policy, confirmed via direct connectivity test) to do the compile.
