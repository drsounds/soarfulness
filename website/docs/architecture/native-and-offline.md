---
title: Native app, PWA and offline
description: The Capacitor Android app and its native plugins, live updates, the service worker and the offline precache.
---

# Native app, PWA and offline

The detailed guide is `CAPACITOR_APP.md` in the repo root. This page is the
map.

## Capacitor Android app

- `capacitor.config.ts` + `android/`. `bun run build:capacitor` builds the
  node-server bundle and snapshots an offline shell.
- Hand-registered plugins in `MainActivity` (Java), each with a JS side in
  `src/lib/`. The JS always checks `Capacitor.isPluginAvailable` first:

| Plugin | JS side | Purpose |
| --- | --- | --- |
| AppLinks | `lib/appLinks.ts` | Launch URL, `appUrlOpen` events for Android App Links (bath links open in the app), the share sheet |
| DeviceFiles | `lib/deviceFiles.ts` | Android "save as" / "open" pickers. `openFile` accepts `maxBytes` and rejects with `TOO_LARGE`. Files cross the bridge as base64. |
| LiveUpdate | `lib/liveUpdate.ts` | Downloads newer web bundles from the deployed site and switches on next launch |
| RoamingMotion | `apps/roaming/roamingBridge.ts` | Receives the Roaming app's `se.spacify.app.roaming.event.MOTION` broadcasts while ROAMING is on and the app is visible, and forwards them as `motion` events. See [Move with your body](../features/roaming.md) |
| VoiceRecognition | `apps/voice/speechEngines.ts` | Continuous on-device speech recognition (`createOnDeviceSpeechRecognizer`, Android 12+, never a cloud recognizer) (needs `RECORD_AUDIO`) while VOICE is on and the app is in the foreground; `partial`, `result` and `status` events. See [Voice control](../features/voice.md) |
| AmbientAudio | `lib/ambientAudio.ts` | Plays the water track with Android `MediaPlayer` so it survives audio-focus loss |

- There is no iOS project.
- `native/` is a separate experimental Expo + react-native-webgpu port; see
  `native/NATIVE_APP.md`. It has never run on a device and isn't built in CI.

## Lovable asset pointers

`src/assets/*.asset.json` (sand texture, Vänern backdrop, water sound, font,
app icon) point at `/__l5e/assets-v1/…` URLs that **only Lovable's hosting
serves**. The self-hosted deploy, `vite dev` and Capacitor builds get 404s.
Code must not assume they load: the seafloor sand has a procedural fallback
(`lib/sandTexture.ts`), and the app icon is a real file
(`src/assets/AppIconBlack.png`). Any new texture fed from these pointers needs a
fallback.

## Service worker and offline

- `src/sw.ts` (Workbox, built by `vite-plugin-pwa` in injectManifest mode)
  caches HTML network-first (`aquafulness-html`) and serves app content and
  assets cache-first (`aquafulness-content`, `aquafulness-assets`), including
  audio tracks.
- `lib/offlineAssets.ts` enumerates every scene, environment, surface and audio
  file through `appCatalog.ts`; `hooks/use-offline-precache.ts` downloads them
  once on first launch (`aquafulness:offline-ready:v1`) and
  `OfflineDownloadOverlay.tsx` shows progress.
- The precache has a per-file size limit; see
  [Deployment](../getting-started/deployment.md#pwa-precache-limit).
