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

`.github/workflows/native-eas-build.yml` builds Android via
[EAS Build](https://docs.expo.dev/build/introduction/) (`eas build --platform
android --profile preview`) instead of building locally on the runner. It
triggers on push to `main` under `native/**`, or manually via
`workflow_dispatch` (pick `development` / `preview` / `production` from
`eas.json`). It caches `npm` against the committed `package-lock.json` and
installs via `npm ci`. There's no iOS build job yet; Android was the one
explicitly asked for, and the same `eas build --platform ios` command would
need Apple credentials configured on the EAS project first.

**Setup status:**

1. ✅ Done — `app.json`'s `expo.extra.eas.projectId` points at a real EAS
   project (`0bbc297b-1ee1-46d3-a1b4-292c34d47cd7`, created at expo.dev).
2. ⬜ **Still needed**: generate an
   [Expo access token](https://docs.expo.dev/accounts/programmatic-access/)
   for that account and add it as a repository secret named `EXPO_TOKEN`
   (Settings → Secrets and variables → Actions). The workflow reads
   `secrets.EXPO_TOKEN` and will fail authentication without it — this can't
   be done from this sandbox (no Expo credentials here).
3. The `preview`/`development` profiles in `eas.json` build an installable
   `.apk` directly (no Play Store signing needed); `production` is set up for
   an `.aab` Play Store submission and will need real signing credentials
   (EAS can generate/manage an Android keystore for you on first build).
