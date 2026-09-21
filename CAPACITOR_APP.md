# Capacitor Android app — offline distribution for Google Play

This wraps the **actual web app** (everything under `src/`, `public/`, the
full feature set — not a partial reimplementation) in
[Capacitor](https://capacitorjs.com/) as an installable, offline-first
Android app, for distribution through Google Play. It's a different, much
simpler path to the same Play Store destination as `native/`'s
`react-native-webgpu` port — see ["Why this instead of (or alongside)
`native/`"](#why-this-instead-of-or-alongside-native) below.

## How it works

Capacitor bundles a static `webDir` straight into the APK and points an
Android `WebView` at it — no server involved at runtime. This app is
normally a TanStack Start SSR app (Cloudflare Workers by default, node-server
for the Dockerfile — see `vite.config.ts`), which renders every route on
request and has no static `index.html` at all, so it can't be used as a
Capacitor `webDir` directly.

`npm run build:capacitor` produces one:

1. `NITRO_PRESET=node-server vite build` — the same Nitro preset the
   Dockerfile deploys with (a supported, already-exercised combination),
   producing a real `.output/server/index.mjs` Node server plus
   `.output/public` (JS/CSS bundles and everything from `public/`, copied in
   as usual).
2. `scripts/capacitor-snapshot-shell.mjs` boots that server on a local port,
   fetches `/` once, and writes the response straight into
   `.output/public/index.html`. This app has no per-request server data (no
   `createServerFn`/cookie/header-dependent loaders — see
   `src/routes/__root.tsx` and friends), so the HTML for `/` is the same for
   everyone; capturing it once gives a genuine static shell. Client-side
   routing (TanStack Router) handles in-app navigation to `/about`, `/docs`,
   etc. from there — no per-route prerendering needed for an installed app
   that never receives a direct request for those paths from outside itself.

   (TanStack Start does ship its own built-in `spa`/prerender pipeline for
   exactly this static-shell use case — tried first, but its
   `preview-server-plugin` assumes a plain `dist/server/<entry>.js` output
   layout that doesn't match this repo's Nitro/Cloudflare-adapter build, so
   it can't find the server bundle it just built. The hand-rolled snapshot
   script above sidesteps that entirely and is simple enough to not be
   worth re-litigating unless a future TanStack Start release fixes the
   adapter mismatch.)

`capacitor.config.ts` points `webDir` at `.output/public` with no
`server.url`, so Capacitor copies that whole directory — app shell **and**
every scene/environment/skybox/audio asset under `public/` — now a
multi-app catalog (`public/apps/*`), so this is large and will keep growing
as more apps/scenes are added (`android/app/src/main/assets/public`,
~120 MB as of this writing — `capacitor-snapshot-shell.mjs` also strips the
GIMP `.xcf` skybox sources that `public/apps/strandpark/` carries alongside
the `.png` the app actually fetches, tens of MB nothing ever loads) — into
the APK. The app launches and runs fully offline from a cold install, no
network required.

## Ambient audio survives audio-focus loss

Chromium's WebView pauses/ducks HTML5 `<audio>`/Web Audio playback on its own
whenever Android audio focus is lost or reduced (a notification sound,
another app's short clip, even some system sounds) — this is internal to
`org.chromium.media.AudioManagerAndroid` and there's no public Capacitor or
WebView toggle to disable it.

So on native (Android) builds, the looping ocean/water sound in
`src/routes/index.tsx` is played by a small native plugin instead of the
Web Audio graph it uses in the browser/PWA build:
`android/app/src/main/java/se/soarfulness/app/gen7/AmbientAudioPlugin.java`
is a thin JS-facing bridge — the actual `android.media.MediaPlayer`
(entirely outside the WebView's own media pipeline) lives in
`AmbientAudioService`, a real foreground `Service` the plugin binds to.
It requests `AUDIOFOCUS_GAIN` once and then simply never reacts to
focus-change callbacks, so playback is never interrupted. `src/lib/
ambientAudio.ts` is the JS-side wrapper (`registerPlugin("AmbientAudio")`);
`MainActivity.java` registers the plugin by hand since it isn't an
npm-published Capacitor plugin `cap sync` would pick up on its own.

Playback runs in a genuine foreground `Service` (not just plugin-held
state) for two reasons: a plain background process with nothing marking
it as doing user-requested work is a prime target for the OS to kill to
reclaim memory, which would stop "uninterruptible" ambient audio far more
thoroughly than any audio-focus event — a foreground service with an
active notification tells the OS not to do that; and the notification
itself (`AmbientAudioService.showPlayingNotification`, a low-priority
`NotificationCompat` with a Stop action, channel `ambient_audio`) is a
visible, always-current "yes, it's really still playing" signal, both for
the user's convenience and to make future audio bugs easier to diagnose
without adb/logcat — if the notification's gone, the service died; if
it's there but silent, the bug is in MediaPlayer/Equalizer, not process
lifecycle. Needs `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`
(Android 14+, matching this app's `foregroundServiceType="mediaPlayback"`)
and `POST_NOTIFICATIONS` (Android 13+, or the notification silently
doesn't show — playback itself is unaffected either way) permissions,
declared in `AndroidManifest.xml`.

The plugin approximates the web graph's depth-based effects (louder +
more muffled the deeper the camera goes) too — gain via `MediaPlayer
.setVolume`, muffling via an `android.media.audiofx.Equalizer` pulling down
the top bands, both best-effort (wrapped so a device without Equalizer
support just skips the muffle, never fails playback). It only handles
sources it can resolve to either a bundled asset path or a plain http(s)
URL (see `resolveNativeAudioSource` in `ambientAudio.ts`) — covers every
built-in `WATER_SOUNDS` entry and every installed app's own audio track
too, since those are also relative `public/apps/<appId>/...` paths bundled
into the same APK (see `appCatalog.ts`). Any future source shape it can't
resolve falls back to the original Web Audio graph, same as on the
browser/PWA build.

## Building the offline web bundle

**The web build is not done in CI, and its output is not committed to
git** — `npm ci` + `npm run build:capacitor` (a ~1900-module TanStack Start
build) plus `cap sync android` (copying a 100MB+ asset bundle) is too heavy
to redo on every CI run, and that same ~50 MB landing in git on every
change that touches it would bloat this repo's history forever. Instead:

1. Build and sync locally:

   ```sh
   npm ci
   npm run build:capacitor   # → .output/public (static, offline-ready)
   npx cap sync android      # copies it into android/app/src/main/assets
   ```

2. Package it and publish it as the `capacitor-web-bundle` GitHub Release
   asset — that release always holds the *current* bundle (this republishes
   it in place, it isn't versioned per-change):

   ```sh
   npm run capacitor:package-bundle   # → capacitor-android-assets.tar.gz.part-*
   ```

   This tars up `android/app/src/main/assets` and splits it into <100MB
   chunks (`.part-000`, `.part-001`, ...) — a single 100MB+ file would be
   rejected by a plain `git push`, and this bundle only grows as more
   apps/scenes are added.

   Then push those part files to a throwaway branch and run the
   **Publish Capacitor web bundle** workflow (`workflow_dispatch`, input
   `source_ref` = that branch) from the Actions tab — it just reassembles
   them and attaches the result to the release, no build step. Delete the
   throwaway branch once the run succeeds.

`.github/workflows/capacitor-android-build.yml`'s jobs (`debug-apk` →
`release-aab` → `play-submit`) each start by downloading and extracting
that release asset (`gh release download capacitor-web-bundle`, already
authenticated via the runner's default token — a few seconds, not a build),
then `npm ci` (fast — Gradle needs `node_modules/@capacitor/android`
present; `android/capacitor.settings.gradle` points the `:capacitor-android`
project straight at it), then run Gradle. Runs manually (`workflow_dispatch`
only — no automatic push/PR trigger, matching `native-android-build.yml`'s
stance), and builds+publishes a signed release AAB when the signing
secrets below are configured.

**If you forget step 2, CI keeps building whatever bundle was last
published** — it has no way to know `src/`/`public/` changed underneath it.
Republishing the bundle is on you, same as remembering to bump a version
number.

## Play Store signing

**This app needs its own upload keystore, separate from `native/`'s.**
`native/`'s `se.aquafulness.app.gen7` and this app's `se.soarfulness.app.gen7`
are two different Play Store listings — a Play Console upload key is
registered against one specific `packageName` on first upload, and even
where reuse would be technically possible, mixing two distinct apps'
signing identity under one key is exactly the kind of blast-radius
sharing worth avoiding. Generate a fresh keystore for `se.soarfulness.app.gen7`
(same command `native/NATIVE_APP.md`'s "Play Store signing" section
gives) and store it under its own set of repo secrets — the mechanism is
otherwise identical to `native/`'s:

| Secret | Value |
| --- | --- |
| `ANDROID_UPLOAD_KEYSTORE_BASE64` | `base64 -w0 your-upload-keystore.jks` |
| `ANDROID_UPLOAD_STORE_PASSWORD` | keystore password |
| `ANDROID_UPLOAD_KEY_ALIAS` | key alias inside the keystore |
| `ANDROID_UPLOAD_KEY_PASSWORD` | key password |

`android/app/build.gradle`'s `release` signing config reads these from the
environment at Gradle build time (`ANDROID_UPLOAD_STORE_FILE` — a decoded
keystore file path — plus the three secrets above); when unset, `release`
falls back to the auto-generated debug keystore, so local/dev release
builds still produce an installable (if Play-unsuitable) APK.
`defaultConfig.versionCode` reads `GITHUB_RUN_NUMBER` the same way
`native/app.config.js` does, for the same reason: a hardcoded version code
that collides with one Google has already seen (even from a failed upload)
permanently blocks every future upload at that number.

**⚠️ Never commit the keystore file itself** — `android/.gitignore` ignores
`*.jks`/`*.keystore`.

Automated Play Console submission (`r0adkll/upload-google-play`, gated on
`GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` and only run on manual `workflow_dispatch`)
has the same hard prerequisite `native/NATIVE_APP.md` documents: **you must
upload one release through the Play Console web UI by hand first** — the
Play Developer API rejects uploads for a `packageName` it's never seen a
release for. See that file's "Play Store submission (automated)" section
for the full service-account setup steps; they're identical here.

## App icon & splash

Generated from `resources/icon.png` (the existing `public/pwa-512.png` app
mark) via `@capacitor/assets`:

```sh
npx capacitor-assets generate --android \
  --iconBackgroundColor "#eafff2" --iconBackgroundColorDark "#0b3d5c" \
  --splashBackgroundColor "#eafff2" --splashBackgroundColorDark "#050b16"
```

Re-run this after replacing `resources/icon.png` with a higher-resolution
source (1024×1024+ recommended; the current source is 512×512, upscaled).

## Known limitation: a handful of assets need one online visit

Five assets (`src/assets/*.asset.json`: the app-icon mark used inside the
splash screen's start button, the sand texture, the Vänern backdrop, the
"advanced" water sound, and a font) are fetched at runtime from
`/__l5e/assets-v1/...` — same-origin CDN URLs that Lovable's hosting
platform proxies to actual storage *outside this repo* (see
`src/lib/offlineAssets.ts`'s own comment on this). That proxying only
exists on the app's real deployed domain; a Capacitor build has no server of
its own, so on first launch — same as the very first, offline visit to the
installable web PWA — those five requests simply fail and are skipped
(`src/lib/offlineAssets.ts` / `OfflineDownloadOverlay` already handle this
gracefully: missing assets degrade silently, and the overlay's own
download flow retries them once the device is online). Everything else —
the entire app shell, all scenes/environments/skyboxes/audio under
`public/` — ships inside the APK and needs no network, ever.

If you want those five assets to always be available offline from a cold
install too, download them once (their permanent URLs are the `url` field
in each `src/assets/*.asset.json` file, proxied through your real deployed
domain) and vendor them as ordinary local files under `public/`, swapping
the `.asset.json` imports at their handful of call sites
(`src/routes/index.tsx`, `src/lib/settingsShared.ts`) for direct imports.
Not done here since it touches shared app code used by every build target,
not just this one.

## Why this instead of (or alongside) `native/`

`native/` is a hand-ported `react-native-webgpu` reimplementation, built
because — at the time — Capacitor wasn't evaluated. Its own doc
(`native/NATIVE_APP.md`) is candid about the cost: months of CI fighting
NDK/CMake compilation across 4 ABIs, disk-space exhaustion, EAS plan-tier
limits, and — more fundamentally — it's a **partial port**: no CSS3D TV
panel, no GLTF scene loading/selector, no presets import/export, no spatial
audio, no interval sessions, no virtual-phone remote control, a fraction of
`SettingsPanel.tsx`'s ~2000 lines, and shaders translated GLSL→TSL by hand
without ever having run on a real GPU.

This Capacitor build has none of that risk or gap: it's a `WebView` around
the exact same code that already runs in every user's browser today,
feature-complete by construction, with no native compilation step at all —
`assembleDebug`/`bundleRelease` just package the already-built web assets.
The tradeoff is WebView rendering overhead vs. `react-native-webgpu`'s
native WebGPU — worth checking on a real device before treating either as
the final answer, but for a WebGL (not WebGPU) three.js scene like this
one, Android's WebView (Chromium-based) is a well-trodden path.

Both can coexist — they're different Gradle/Xcode projects
(`native/android` vs `android/`), and (unlike this repo's own earlier
history) deliberately ship under **different** `applicationId`s
(`se.aquafulness.app.gen7` vs `se.soarfulness.app.gen7`) with their own signing
keys, since they're two separate Play Store listings — see "Play Store
signing" above. If you only want to maintain one going forward, this one
carries far less risk.
