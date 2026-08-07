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

### `minSdkVersion` must be 26+

The first real Android build (on GitHub Actions, not EAS) failed with the
native `react-native-webgpu` module refusing to compile:

```
error: 'AHardwareBuffer_acquire' is unavailable: introduced in Android 26
```

This looked at first like it might be another resource/capacity problem
(same shape of surprise as the earlier EAS free-plan issue) — it wasn't.
It's a plain API-level mismatch: Expo SDK 54 defaults `minSdkVersion` to
24 (Android 7.0), but `react-native-webgpu` calls `AHardwareBuffer_*` APIs
that only exist from API 26 (Android 8.0) onward — confirmed by
`react-native-webgpu`'s own example app, which explicitly sets
`react.minSdkVersion=26` in its `gradle.properties`. Not a memory/CPU
issue at all; the build was rejecting the code at compile time regardless
of how much horsepower was behind it.

Fixed by adding the `expo-build-properties` plugin
(`app.json` → `plugins`) with `android.minSdkVersion: 26`. Verified the
same way as the release-signing plugin — by actually running
`expo prebuild` here and confirming `android/gradle.properties` comes out
with `android.minSdkVersion=26`, not just reading the fix from source.

One practical consequence: this raises the app's minimum supported Android
version to 8.0 (released 2017) — should be a non-issue for virtually all
real devices at this point, but worth knowing it's a real constraint
`react-native-webgpu` imposes, not an arbitrary choice made here.

### Runner ran out of disk space

The next CI attempt (after the `minSdkVersion` fix) got much further —
into actually building the native module across all 4 default Android
ABIs — before failing with two errors:

```
Execution failed for task ':react-native-webgpu:bundleDebugAar'.
> Could not add file '.../jni/x86_64/libreactnative.so' to ZIP '.../react-native-webgpu-debug.aar'.
...
Execution failed for task ':app:mergeDebugNativeLibs'.
> A failure occurred while executing ...MergeNativeLibsTaskWorkAction
   > No space left on device
```

The second error is the real one; the first (a ZIP write failing
mid-file) is a downstream symptom of the same disk-full condition, not an
independent bug. This is a genuinely different failure mode from
everything earlier in this file — not GitHub Actions infrastructure
flakiness, not EAS's plan-tier compute limit, not an API-level mismatch —
GitHub-hosted `ubuntu-latest` runners have limited free disk by default
(~14GB after preinstalled tooling), and building 4 CPU architectures of a
project that bundles `react-native-webgpu` (which ships prebuilt Dawn
binaries per-ABI inside an already-176MB-unpacked npm package) plus the
Android SDK/NDK plus Gradle's caches pushed past that.

Two-part fix, both in this repo (not a plan/infra limitation like the EAS
issue was — this one was actually fixable):

1. **`android.buildArchs: ["arm64-v8a", "x86_64"]`** added to the
   `expo-build-properties` plugin config, cutting the default 4 ABIs
   (`armeabi-v7a`, `arm64-v8a`, `x86`, `x86_64`) down to the two that
   actually matter: `arm64-v8a` covers essentially all real devices (Play
   Store requires 64-bit support), `x86_64` covers the standard Android
   Studio emulator. Dropped `armeabi-v7a` (legacy 32-bit ARM) and `x86`
   (legacy 32-bit emulator) - add `armeabi-v7a` back if you specifically
   need to support very old 32-bit-only devices. Verified the same way as
   the other build-properties change: ran `expo prebuild` here and
   confirmed `android/gradle.properties` comes out with
   `reactNativeArchitectures=arm64-v8a,x86_64`.
2. **A "Free disk space" CI step** (`.github/workflows/native-android-build.yml`,
   before any other setup) that removes large preinstalled toolchains the
   runner ships but this project never uses (.NET, GHC, CodeQL, Boost) plus
   the *contents* of the runner's pre-baked `/usr/local/lib/android`. Logs
   `df -h /` before and after for visibility if this needs revisiting.

   Getting `/usr/local/lib/android` right took three tries:
   1. Deleting the directory itself (not just its contents) broke the next
      step: `android-actions/setup-android` tries to recreate that exact
      path as the unprivileged `runner` user, and only the pre-existing
      directory (not its root-owned parent, `/usr/local/lib`) was writable
      by that user. Deleting it lost that writable ownership:
      `EACCES: permission denied, mkdir '/usr/local/lib/android'`.
   2. Clearing just the contents (`rm -rf /usr/local/lib/android/*`)
      relocated the exact same problem one level down — the special
      writable ownership turned out to belong to the `sdk` subdirectory
      specifically, not the top-level `android` directory, so deleting
      *its* directory entry hit the identical failure one level deeper:
      `EACCES: permission denied, mkdir '/usr/local/lib/android/sdk'`.
   3. Fixed properly by `chown -R` of the whole tree to the runner user
      *before* clearing it (`sudo chown -R "$(id -u):$(id -g)"
      /usr/local/lib/android && rm -rf /usr/local/lib/android/*`) — this
      sidesteps needing to know which exact directory level carries the
      special ownership, since after the chown every level does, so
      whatever `setup-android` recreates afterward (at any depth) is
      already owned by the same user doing the recreating.

Halving the ABI count also roughly halves native build time, so this
should make the whole job noticeably faster too, not just fix the disk
error.

### Repo hit its Actions artifact storage quota

Once the disk-space and `EACCES` issues above were fixed, a run got all the
way through `./gradlew assembleDebug` successfully and then failed anyway —
not in the build, but in the "Upload APK artifact" step:

```
##[error]Failed to CreateArtifact: Artifact storage quota has been hit.
Unable to upload any new artifacts. Usage is recalculated every 6-12 hours.
```

Private repos get a limited GitHub Actions artifact storage allowance, and
the many debug-APK and signed-release-AAB uploads produced while iterating
on the fixes above (each one kept for the default 90-day retention period)
used it up. Not a code or workflow-logic bug — re-running immediately would
hit the identical wall. Mitigated two ways in the workflow:

- The debug APK is now only uploaded when no signed release build is also
  happening (`if: env.HAS_ANDROID_SIGNING != 'true'`) — it only exists to
  prove forks/PRs without the signing secret still compile, so there's no
  reason to also store it alongside the AAB on signed runs.
- Both artifact uploads now set `retention-days: 3` instead of the 90-day
  default, so iterating on CI fixes doesn't keep accumulating stored build
  output indefinitely.

This reduces how fast the quota fills up going forward, but doesn't free
already-consumed quota — that still needs either the ~6-12 hour automatic
recalculation GitHub mentions, or manually deleting old artifacts/caches
from the repo's Actions tab.

**Manually deleting old artifacts did not immediately unblock uploads.**
After deleting a batch of old failed-run artifacts through the Actions tab,
the very next run (and a second, redundant run — see below) still hit the
identical `Artifact storage quota has been hit` error on the AAB upload,
even though the build itself succeeded both times. GitHub's own error text
— "usage is recalculated every 6-12 hours" — reads as literal: the quota
gate appears to check a periodically-recalculated usage snapshot rather
than live storage, so a manual deletion doesn't necessarily take effect
right away. Two changes followed from this:

- **Removed the `push` trigger on `main` entirely** (workflow now only runs
  on `pull_request` or manual `workflow_dispatch`). Merging PR #95 had
  triggered a second, redundant build of the exact same commit alongside
  the manually-dispatched one already in flight — both raced for the same
  quota and both lost. One trigger path removes the race, not just the
  waste.
- **The signed release AAB is now published as a GitHub Release asset**
  (`softprops/action-gh-release`, tagged `native-android-build-<run
  number>`) instead of an Actions artifact. Release assets are billed
  against the repo's general storage, a separate pool from the Actions
  artifact quota that kept getting exhausted, so this sidesteps the
  problem rather than continuing to manage around it. It also means the
  AAB no longer expires after `retention-days` - it stays attached to the
  release until deleted. The debug APK (only uploaded on unsigned runs -
  see above) still goes through `actions/upload-artifact`, since it's
  low-volume and disposable by nature.

## CI

`.github/workflows/native-android-build.yml` builds Android **directly on
the GitHub Actions runner** — `expo prebuild` + `./gradlew assembleDebug` —
rather than delegating to EAS Build. It triggers on PRs touching
`native/**`, or manually via `workflow_dispatch` (no `push` trigger on
`main` - see above), and uploads the resulting unsigned debug APK as a
workflow artifact when no signed build is also happening. It caches `npm`
against the committed `package-lock.json` and installs via `npm ci`. When
the Play Store signing secrets below are configured, it also builds a
signed release `.aab` and publishes it as a GitHub Release asset.

This is a deliberate choice, not the default/obvious option — see "EAS Build
vs. GitHub Actions" below for why.

`eas.json` and the `EXPO_TOKEN` repo secret are still in place (unused by CI
right now) in case EAS Build becomes viable again later — e.g. on a paid
Expo plan, or if the actual resource bottleneck gets tracked down and worked
around. There's no iOS CI job (would need a macOS runner + code signing);
Android was the one explicitly asked for.

### Play Store signing

`plugins/withAndroidReleaseSigning.js` is an Expo config plugin (registered
in `app.json`) that patches the generated `android/app/build.gradle` on
every `expo prebuild` so the `release` build type signs with a real upload
keystore instead of the RN/Expo template's default (which silently signs
release builds with the debug keystore). It reads the actual key material
from environment variables **at Gradle build time** — nothing is baked into
the generated (gitignored, regenerated-every-time) `build.gradle` itself —
and transparently falls back to the debug keystore when those env vars
aren't set, so local/dev builds are unaffected. Verified by actually running
`expo prebuild` in this environment and inspecting the generated
`build.gradle` (Node-only; doesn't need the Android SDK), not just read from
source.

Required GitHub Actions repo secrets (Settings → Secrets and variables →
Actions):

| Secret | Value |
| --- | --- |
| `ANDROID_UPLOAD_KEYSTORE_BASE64` | `base64 -w0 your-upload-keystore.jks` |
| `ANDROID_UPLOAD_STORE_PASSWORD` | keystore password |
| `ANDROID_UPLOAD_KEY_ALIAS` | key alias inside the keystore |
| `ANDROID_UPLOAD_KEY_PASSWORD` | key password (PKCS12 keystores use the same value as the store password) |

**Approach: Google Play App Signing.** The keystore this generates is an
*upload key* only — it authenticates your uploads to Play Console. Google
holds and manages the real app signing key, so a lost/compromised upload key
is recoverable (via Google Play support), unlike a fully self-managed
signing key. This project's very first upload to Play Console had not
happened yet as of this key's generation (confirmed before generating it —
generating a new upload key when one is *already* registered with Play
Console would break all future uploads), so Play Console's standard
first-upload flow will handle enrolling into Play App Signing automatically.

**⚠️ The generated keystore file and its passwords are not in this repo**
(and must never be committed) — they were handed to you directly as a
download when this was set up, since this is the only copy outside of
whatever GitHub secrets get configured from it. If that download is gone,
you'll need to regenerate a new upload key and go through Play Console's
"lost upload key" reset flow (Play App Signing makes this recoverable, but
it's real friction — keep a backup somewhere durable, e.g. a password
manager).

### Play Store submission (automated)

CI can also submit the signed `.aab` straight to Play Console, via
[`r0adkll/upload-google-play`](https://github.com/r0adkll/upload-google-play)
(uses the Google Play Developer API v3). This needs one more secret:

| Secret | Value |
| --- | --- |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | the full contents of a Google Cloud service account JSON key (see setup below) |

**⚠️ Hard prerequisite, not optional: you must manually upload one release
through the Play Console web UI first.** The Play Developer API rejects
uploads for a `packageName` it has never seen a release for — this is a
Google-side restriction with no API workaround, confirmed in the action's
own docs/FAQ ("Package not found" → "make sure you upload an apk or aab
manually first"). So the sequence has to be: (1) download the
`aqua-wave-dream-release-aab` CI artifact once and upload it by hand through
Play Console, creating at least an internal-testing release; only after
that will step 2 work. (2) From then on, CI can submit automatically.

**Setup, all of which needs your Google Cloud / Play Console access (none
of this can be done from this sandbox — same class of restriction as
everything else in this file that touches `googleapis.com`):**

1. Enable the Google Play Android Developer API on a Google Cloud project
   (console.cloud.google.com → APIs & Services → Library → search "Google
   Play Android Developer API" → Enable).
2. Create a service account in that project (IAM & Admin → Service accounts
   → Create). It doesn't need any Google Cloud IAM roles/permissions —
   access is granted entirely on the Play Console side in the next step.
3. Create a JSON key for that service account (Keys tab → Add key → JSON) —
   downloads a `.json` file. Paste its full contents into the
   `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` GitHub secret.
4. In Play Console → Users and permissions → Invite new user, invite the
   service account's email address (looks like
   `...@<project>.iam.gserviceaccount.com`), and grant it permission to
   manage `se.aquafulness.app.gen7`'s releases (at minimum: release to
   testing tracks; add production-release permission only once you actually
   want CI able to do that).

**First automated attempt hit `This edit has expired, please create a new
Edit.`** After the manual-first-upload prerequisite above was satisfied
(Play Console showed an `.aab` uploaded for version code 1), CI's first
automated submission still failed with this error from the Play Developer
API, right after the AAB upload step logged as complete. Play Console
nonetheless showed the bundle as uploaded for that version code - the
binary transfer succeeded, but the "edit" (the API's transaction object
covering the upload + track assignment + commit) expired before the whole
operation could finalize into a released build, so nothing actually got
attached to a track. Net effect either way: version code 1 is now
permanently claimed on Google's side (Play rejects any future upload that
reuses a version code, whether or not it was ever released), so
`app.json`'s `android.versionCode` is now set explicitly (starting at `2`)
to guarantee every subsequent CI build ships a code Google hasn't seen yet,
regardless of whether that first edit-expiry error turns out to be a
one-off runner/network fluke or a recurring issue.

**Track defaults to `internal`, never `production`, on automatic
(push-triggered) runs** — that's a deliberate safety choice: continuous
internal-testing distribution is reasonable to fully automate, but pushing
to production shouldn't be an accidental side effect of merging a PR. Use
`workflow_dispatch` (with the `track` input) to deliberately target
`alpha`/`beta`/`production` when you actually want that. Play Console also
enforces its own progression — per the action's FAQ, you generally can't
target `production` until at least one release has gone through an earlier
track, which the `internal`-by-default behavior here naturally satisfies.

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
