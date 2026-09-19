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
every scene/environment/skybox/audio asset under `public/`
(`android/app/src/main/assets/public`, ~100 MB) — into the APK. The app
launches and runs fully offline from a cold install, no network required.

## Building

```sh
npm ci
npm run build:capacitor   # → .output/public (static, offline-ready)
npx cap sync android      # copies it into android/app/src/main/assets/public
```

Then either open `android/` in Android Studio, or build from the CLI:

```sh
cd android
./gradlew assembleDebug     # unsigned debug APK
./gradlew bundleRelease     # release AAB — see "Play Store signing" below
```

`.github/workflows/capacitor-android-build.yml` runs the same steps in CI,
manually (`workflow_dispatch` only — no automatic push/PR trigger, matching
`native-android-build.yml`'s stance), and builds+publishes a signed release
AAB when the signing secrets below are configured.

## Play Store signing

Same approach and same secret names as `native/`'s (see
`native/NATIVE_APP.md`'s "Play Store signing" section for the full
rationale) — one upload keystore covers both apps if you want it to,
since they currently share the same `applicationId`
(`se.aquafulness.app.gen7`):

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
(`native/android` vs `android/`) that happen to currently share an
`applicationId`. If you only want to maintain one going forward, this one
carries far less risk.
