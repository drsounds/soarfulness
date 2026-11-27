---
title: Picture-in-Picture (PIP)
description: Keep the bath running in a small floating window when you leave the app, like a video.
---

# Picture-in-Picture (PIP)

When you leave the app the bath keeps going in a small floating window, the
way a video does. The HUD, settings and every other control are hidden in the
small window, so only the scene shows. Sound keeps playing.

| Where | What happens | How |
| --- | --- | --- |
| Android app (Capacitor) | Press Home or swipe up: the whole app shrinks into Android's PiP window. Tap it to come back. | `PictureInPicturePlugin.java`. Android 12+ auto-enters from the activity's PiP params (`setAutoEnterEnabled`); Android 8 to 11 enters from `MainActivity.onUserLeaveHint`. |
| Desktop Chrome / Edge 116+ | **SHOW IN PIP NOW** moves the scene into a [Document Picture-in-Picture](https://developer.chrome.com/docs/web-platform/document-picture-in-picture) window. With **WHEN LEAVING THE APP** on, Chrome can also open it by itself when you switch tab while sound plays (`navigator.mediaSession` action `enterpictureinpicture`). | `DocumentPipWindow.ts` moves `<main data-pip-root>` into the PiP window and back when it closes. |
| Other browsers (Safari, Firefox, Chrome on Android) | **SHOW IN PIP NOW** streams the 3D canvas into a hidden `<video>` and puts that in video PiP. | `VideoPip.ts` (`canvas.captureStream`). Only the WebGL canvas is captured: no flat backdrop photo, no fog or goggles overlays. Browsers may slow it down once the tab is hidden. |

## Settings

Group **Bild i bild** (system), shown while the app is on under APPS. All keys
belong to the device: they are left out of presets and share links.

| Key | UI label (sv) | Default | |
| --- | --- | --- | --- |
| `pipOn` | BILD I BILD | on | Off: Home leaves the app as before. |
| `pipAuto` | NÄR DU LÄMNAR APPEN | on | Enter PiP by itself on Home / tab switch. Off: only the button. |
| `pipAspect` | FÖNSTRETS FORM | `screen` | `screen`, `16:9`, `9:16`, `4:3`, `3:4`, `1:1`. Android clamps to 1:2.39 … 2.39:1. |
| `pipFps` | BILDFREKVENS I BILD I BILD | 30 | Frame rate cap while in PiP (0 = only the normal cap), to save battery. |

## Files

- `src/apps/pip/`: `settings.ts`, `pipState.ts` (which PiP is showing),
  `pipFrames.ts` (the render loop's frame source and PiP frame cap),
  `PipController.ts` (picks native / document / video), `DocumentPipWindow.ts`,
  `VideoPip.ts`, `pipNative.ts` (Capacitor bridge), `usePictureInPicture.ts`,
  `PipPanel.tsx`.
- `src/styles.css`: `html[data-pip-active]` hides everything in `<main>` that
  isn't a `data-pip-scene` layer, and every other body child (dialogs, toasts).
- `android/.../PictureInPicturePlugin.java`, `MainActivity.java`
  (`onUserLeaveHint`, `onPictureInPictureModeChanged`, `startActivityForResult`),
  `AndroidManifest.xml` (`supportsPictureInPicture`, `resizeableActivity`).

## How it works

- The render loop asks `requestSceneFrame` instead of `requestAnimationFrame`.
  In Document PiP the frames come from the PiP window, because the page it
  came from may be hidden behind another tab, where the browser stops its
  frames. Waiting frames move over when a PiP window opens or closes.
- The scene's `handleResize` reads the mount's size, so the renderer follows
  the PiP window (a `resize` event is fired on every move and PiP resize).
- On Android the activity keeps running in PiP (it's paused, not stopped), so
  the WebView keeps drawing; the window is small, so the GPU load drops with it,
  and `pipFps` caps the frame rate on top.
- Opening a share sheet, file picker or speech input from the app also calls
  `onUserLeaveHint` on Android 8 to 11; `MainActivity.startActivityForResult`
  marks those so they don't open PiP.

## Status per repo

- soarfulness: this page.
- aqua-wave-dream: same app and native plugin; the panel sits at the bottom of
  the KAMERA tab (aqua has no settings groups).

## Gotchas

- Not tested on a phone yet (no Android SDK in the cloud sandbox): the Java
  was written against the API docs, not compiled.
- Android lets the user switch PiP off per app (Settings › Apps › Special app
  access › Picture-in-picture); the panel then says so.
- Closing the PiP window on Android stops the activity like any other
  background app; ambient sound follows its normal background rules.
- Chrome only auto-enters Document PiP for pages that play sound, and the user
  can turn it off in the site settings ("Automatic picture-in-picture").
