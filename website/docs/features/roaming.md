---
title: Move with your body (ROAMING)
description: The Android app listens to the Roaming app's motion broadcasts and swims you forward when you walk or run, accelerating with the motion and gliding to a stop.
---

# Move with your body (ROAMING)

In the Android app, Aquafulness can listen to
[Roaming](https://github.com/drsounds/roaming-android-app), a separate
Android app that detects steps and body motion (step sensor and/or camera)
and publishes them as `se.spacify.app.roaming.event.MOTION` broadcasts.
Walk or run in place and the bather swims forward; lean (or tilt the phone)
to sidestep.

| Setting | UI | Default |
| --- | --- | --- |
| `roamingOn` | ROAMING (RÖR DIG MED KROPPEN) | off |
| `roamingStrength` | ROAMING-FART: top speed at full intensity, as a share of NAV speed | 100 % |
| `roamingAccel` | ACCELERATIONSTID: time constant when speeding up (s) | 0.8 |
| `roamingGlide` | GLIDTID: time constant when slowing down (s) | 2.5 |
| `roamingSideways` | LUTA FÖR SIDLED: leaning / left-right moves sideways | on |

The settings are in the `drift` group, right after HAVSDRIFT. While ROAMING
is on, a line under the switch shows the last motion received, or says that
it only works in the Android app.

## Using it

1. Install Roaming on the same phone, pick its inputs (step sensor, camera)
   and tap **Start tracking**.
2. In Aquafulness, open settings → drift and switch ROAMING on.
3. Walk or run in place. Stop and you glide to a halt.

## How the motion becomes speed

Every broadcast sets a **target velocity**: the event's direction from the
user's point of view (forward/backward/left/right) × its `intensity`
(0..1) × top speed (NAV speed × ROAMING-FART). It is camera-relative, like
the NAV stick.

| `motion_type` | Effect |
| --- | --- |
| `step`, `walking`, `running` | Forward (or the event's direction) at intensity × top speed. `none`/`up`/`down` count as forward. |
| `leaning` left/right | Sideways at half that, when LUTA FÖR SIDLED is on |
| `idle`, `jumping`, `squatting`, `arms_raised` | Target 0 |

The actual velocity chases the target:

- **Speeding up** it closes the gap with ACCELERATIONSTID, so the
  acceleration is proportional to how much faster the motion asks you to
  go: break into a run and you surge, keep the pace and you settle.
- **Slowing down** it uses the longer GLIDTID, so when the motion eases off
  the deceleration starts gentle and keeps easing out, like gliding through
  water.

Roaming sends an event per detected step, so steady walking keeps the
target fresh. With no event for 2.5 s (tracking stopped, a missed
broadcast) the target falls to zero as if `idle` had arrived.

**Files:** `src/apps/roaming/RoamingMotion.ts` (the physics, unit tested in
`RoamingMotion.test.ts`), `roamingBridge.ts` (Capacitor plugin wrapper and
event parsing), `RoamingRuntime.ts` (`step()` in the physics step, right
after HAVSDRIFT; moves `posRef` and the camera together), `RoamingPanel.tsx`.
Native side: `android/.../RoamingMotionPlugin.java`.

## Native plugin

`RoamingMotionPlugin` (hand-registered in `MainActivity`) registers a
runtime `BroadcastReceiver` (`RECEIVER_EXPORTED`, since the broadcast comes
from another app) only while ROAMING is on **and** the app is visible
(`onStart`/`onStop`), as Roaming's README recommends; Android 8+ doesn't
deliver implicit broadcasts to manifest receivers anyway. Each broadcast is
forwarded to the WebView as a `motion` event with Roaming's flat extras
(`motion_type`, `direction`, `intensity`, `source`, `timestamp`).

On the web and in the PWA the plugin doesn't exist, so nothing native runs.
For testing in a browser you can feed events by hand:

```js
window.dispatchEvent(new CustomEvent("roaming:motion", {
  detail: { motion_type: "running", direction: "forward", intensity: 0.8 },
}));
```

**Gotcha:** headless SwiftShader runs in slow motion, so measured speeds
there are below the setting.
