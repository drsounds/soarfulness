---
title: Testing and screenshots
description: Unit tests, headless Chromium screenshots, localStorage seeds and timing caveats.
---

# Testing and screenshots

## Unit tests

`bun test` runs `src/**/*.test.ts`. Existing suites: `wind.test.ts`,
`openDrift.test.ts`, `decorations.test.ts`, `stringLights.test.ts`,
`userScenes.test.ts`, `spacifySync.test.ts`, `sceneFx/underwaterFog.test.ts`.
Put pure logic (curves, sanitizers, merges) in a module without three.js
dependencies so it is testable.

## Headless screenshots

Run `vite dev`, then drive it with Playwright's Chromium (SwiftShader, no
GPU).

**Before navigating**, seed localStorage to skip overlays and set the scene:

```js
await page.addInitScript(() => {
  localStorage.setItem("aquafulness:cookie-consent:v1", "declined");
  localStorage.setItem("aquafulness:appBannerDismissed:v1", "1");
  localStorage.setItem("aquafulness:settings:v1", JSON.stringify({
    resolutionScale: 0.5,
    cameraMode: "noclip",
    snowOn: true,
  }));
  localStorage.setItem("aquafulness:camera:v1", JSON.stringify({
    x: 0, y: 25, z: 0, yaw: 0, pitch: -0.6,
  }));
});
```

Then click **Start bath** on the splash screen.

Tips collected from earlier work:

- Use a small viewport (480×320 to 640×400) and `resolutionScale` 0.5;
  SwiftShader is slow.
- The default first-start view floats at the water line and sits under the
  Strandpark2 pier. For water shots use `cameraMode: "noclip"` with y 25 and
  pitch −0.6, or set `sceneId: null` for open water.
- noclip ignores the pose `y` in some paths; in float mode use `heightOffset`
  ±1.5 to put the camera just above or below the water.
- Frame `dt` is capped at 0.1 s, so the scene runs in slow motion headless.
  Measured speeds are far below the settings.
- Reloading under SwiftShader can hang; open a new page in the same context.
- To test bath-link seeding, open the link in a **new tab**, not a reload.
- `src/assets/*.asset.json` URLs 404 off Lovable hosting, so the Vänern
  backdrop and the recorded water sound won't load locally.
- `vite dev` regenerates `src/routeTree.gen.ts`; revert it before committing.

Save screenshots people will look at with `deviceScaleFactor: 2`.
