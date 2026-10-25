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

**The web build's output is not committed to git** — ~120 MB landing in
git on every change that touches it would bloat this repo's history
forever. CI builds it instead, in one reusable workflow,
`.github/workflows/build-capacitor-web-bundle.yml`:

```sh
bun install --frozen-lockfile
bun run build:capacitor   # → .output/public (static, offline-ready)
bunx cap sync android     # copies it into android/app/src/main/assets
```

(run the same commands to reproduce it locally). It tars up
`android/app/src/main/assets` and uploads it as the run's
`capacitor-web-bundle` **build artifact** (kept 1 day — it's only for the
later jobs of that run). Dependencies are installed with bun because
`bun.lock` is the lockfile kept in sync with `package.json`; `npm ci` fails
against a missing or drifted `package-lock.json`.

Two workflows call it:

- **Capacitor Android build** (`capacitor-android-build.yml`):
  `web-bundle` → `debug-apk` → `release-aab` → `play-submit`. The Gradle
  jobs download and extract the artifact into `android/app/src/main/assets`,
  then `bun install` (fast — Gradle needs `node_modules/@capacitor/android`
  present; `android/capacitor.settings.gradle` points the
  `:capacitor-android` project straight at it), then run Gradle. So every
  APK/AAB always contains the web app from the same commit — nothing to
  remember to republish first. Runs manually (`workflow_dispatch` only — no
  automatic push/PR trigger, matching `native-android-build.yml`'s stance),
  and builds+publishes a signed release AAB when the signing secrets below
  are configured.
- **Publish Capacitor web bundle** (`publish-capacitor-web-bundle.yml`,
  `workflow_dispatch`, optional `source_ref` input — defaults to the branch
  it's run on): attaches the artifact to the `capacitor-web-bundle` GitHub
  Release, which always holds the most recently published bundle
  (republished in place, not versioned per-change) for anyone who wants it
  outside a single run. The Android build doesn't depend on it.

## Live updates: newer web app without a new APK

The APK's bundled web app is only the starting point. Once installed, the
app keeps itself in sync with the version deployed at
`https://soarfulness.app.spacify.se` (`plugins.LiveUpdate.url` in
`capacitor.config.ts`), so web-only changes reach installed apps without a
Play Store release, and the updated version works offline just like the
bundled one. No third-party update service is involved: the deployed site
itself is the update server.

**How a bundle gets published.** Every build (the Lovable/Cloudflare
deploy included) writes `/capacitor-live-update.json` next to the built
files (`scripts/vite-plugin-live-update-manifest.ts`, wired into
`vite.config.ts`): every file of the build with its size and SHA-256, a
`version` derived from those hashes, and the handful of `/__l5e/...`
assets from `src/assets/*.asset.json` (see the known limitation below).
Deploying the site is publishing the update; there's nothing else to run.
The APK carries the same file for its own bundle, which is how the app
knows what it already has.

**How the app picks it up** (`android/.../LiveUpdatePlugin.java`,
`LiveUpdater.java`, `LiveUpdateStore.java`):

1. On launch, and on resume at most every 30 minutes, a background thread
   fetches the manifest. If its `version` differs from what the app is
   serving, it snapshots `/` from the site as `index.html` (the site
   renders it per request, exactly what `capacitor-snapshot-shell.mjs` does
   for the APK) and checks that every `/assets/...` file the HTML references
   is in the manifest, which catches a deploy caught halfway.
2. It builds the new bundle in `files/live-update/bundles/<version>.partial`:
   files whose hash the device already has are hard-linked from the bundle
   being served or copied out of the APK, and only the rest are downloaded.
   Every file is verified against its SHA-256. An interrupted download
   resumes where it stopped on the next attempt.
3. Once complete, the directory is renamed to `<version>` and marked
   pending. On the **next launch** `MainActivity` switches Capacitor to it
   (Capacitor's own `serverBasePath` mechanism) before the WebView starts,
   so a session in progress is never reloaded under the user.
4. The web app calls `LiveUpdate.notifyReady()` once it has booted
   (`src/lib/liveUpdate.ts`, from `__root.tsx`). A bundle that doesn't
   within 30 seconds, or across two launches, is rolled back to the last
   good one (ultimately the APK's own) and that version is never tried
   again.

Offline, on a failed or partial download, or if the device is short on
space, nothing changes: the app keeps serving what it has, which is always
a complete, verified bundle or the APK's own. Installing a new APK discards
every downloaded bundle, since the APK ships its own newer copy.

Inside the app the service worker is now disabled (`src/lib/register-sw.ts`):
every file is already on the device, and its precache would otherwise keep
serving the previous version's files after a switch. The native ambient
audio player reads tracks from the served bundle first, so audio added in an
update plays too.

The plugin also exposes `check()`, `apply()` (switch right away, reloading
the app), `reset()` (back to the APK's bundle), `getState()` and an
`updateReady` event to JS, should the app ever want a "restart to update"
prompt. `plugins.LiveUpdate.autoCheck: false` turns the background checks
off.

**Things to know:**

- Native code doesn't update this way, only the web app. A change that
  needs a new native plugin or permission still needs an APK, and web code
  must keep working on the oldest APK still in use (it can check
  `Capacitor.isPluginAvailable`).
- The first update after installing copies the unchanged files out of the
  APK, so the app's storage grows by about one bundle's size; later
  updates hard-link unchanged files and cost only what changed.
- Only APKs built with this change update themselves, and only once the
  site has been deployed with it (before that, the manifest URL 404s and
  the app just keeps its bundled copy).

## Deep links (Android App Links)

Links to `https://soarfulness.app.spacify.se` (a shared badlänk, for example)
open in the app instead of the browser, on the same page.
`AndroidManifest.xml` has an `autoVerify` intent filter for that host, and
`AppLinksPlugin.java` hands the tapped URL to the web app
(`src/lib/appLinks.ts`, wired up in `__root.tsx`), which routes to it. Both the
link the app was started from and links tapped while it's running are
handled. Every shared link is built from `PUBLIC_APP_URL` in
`src/lib/appLinks.ts`, never from `window.location.origin`, which inside the
app is the WebView's own `https://localhost`.

Android only opens verified links in the app without asking, and verifies
them against `public/.well-known/assetlinks.json` on the deployed site. **That
file needs the SHA-256 fingerprint of the key Google Play signs the app
with**: Play Console → the app → Test and release → App integrity → App
signing → "App signing key certificate" → SHA-256. Replace the placeholder
with it (add the upload key's fingerprint too to have sideloaded release
builds verify), deploy the site, and check that
`https://soarfulness.app.spacify.se/.well-known/assetlinks.json` serves it.
Until then, links still open the app once it's enabled under the app's
Android settings → Open by default → Add links.

The website shows a small "get the app" banner (`AppInstallBanner.tsx`)
that's hidden inside the app and on iOS. On Android its button is an
`intent://` link that opens the current page in the app when it's
installed, and the Play Store listing when it isn't.

## Saving and opening files

The WebView can't save the web app's exports (it has no download handler,
so a blob `<a download>` does nothing) and its file chooser greys out most
`.json` files (it filters on MIME types those files usually aren't labelled
with). `DeviceFilesPlugin.java` opens Android's own "save as" and "open"
document pickers instead (no storage permission needed), and
`src/lib/deviceFiles.ts` uses it in the app and the usual browser path
everywhere else. Every export/import in the app (presets, states, the
"export everything" file, the watercraft `.glb`) goes through it.

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

A live-updated bundle (see "Live updates" above) doesn't have this gap:
the updater downloads those five files from the deployed site, where the
proxy exists, into the bundle itself, so they work offline from then on.

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
