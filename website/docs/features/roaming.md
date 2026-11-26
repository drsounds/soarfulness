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
to sidestep. In Roaming's camera mode, arm gestures (raise up, down, left,
right) raise or lower the waves, turn them, or change the sway, and every
motion can be remapped to another action.

| Setting | UI | Default |
| --- | --- | --- |
| `roamingOn` | ROAMING (RÖR DIG MED KROPPEN) | off |
| `roamingStrength` | ROAMING-FART: top speed at full intensity, as a share of NAV speed | 100 % |
| `roamingAccel` | ACCELERATIONSTID: time constant when speeding up (s) | 0.8 |
| `roamingGlide` | GLIDTID: time constant when slowing down (s) | 2.5 |
| `roamingSideways` | LUTA FÖR SIDLED: leaning / left-right moves sideways | on |
| `roamingWalkSpeed` | GÅNGFART: `step` / `walking` at full intensity, share of ROAMING-FART | 100 % |
| `roamingRunSpeed` | LÖPFART: `running` at full intensity, share of ROAMING-FART | 100 % |
| `roamingLeanSpeed` | SIDLEDSFART: `leaning` at full intensity, share of ROAMING-FART | 50 % |
| `roamingGestureMap` | GESTMAPPNING: which motion does what (see below). Device-local | see below |
| `roamingRepeat` | GESTUPPREPNING: seconds between repeats while a one-shot gesture is held (0 = once) | 0.75 |
| `roamingWaveAmpStep` | VÅGSTEG PER GEST: WAVE (`waveAmp`) change per step, m | 0.25 |
| `roamingWaveDirStep` | VÅGVRIDNING PER GEST: VÅGRIKTNING (`waveDir`) change per step, ° | 15 |
| `roamingSwayStep` | SVAJSTEG PER GEST: SWAY (`swayAmp`) change per step, m | 0.5 |
| `roamingSwayDirStep` | SVAJVRIDNING PER GEST: SWAY DIRECTION change per step, ° | 15 |
| `roamingDebug` | FELSÖKNINGSFÖNSTER: the floating debug window | off |

The app has its own settings page, **Roaming** (footprints icon, in the
bather section). It is listed only while the app is switched on under
APPS, where it can be turned off entirely like any other app. While ROAMING
is on, a line under the switch shows the last motion received, or says that
it only works in the Android app.

## Gestures and the gesture mapping

A **gesture** is a Roaming `motion_type`, plus the direction where the
direction is the point: `leaning:left/right` and the camera-mode
`raising:up/down/left/right` (one arm up, both hands down, left arm out,
right arm out; see the
[Roaming README](https://github.com/drsounds/roaming-android-app#camera-gestures-raising-up-down-left-and-right)).
GESTMAPPNING on the Roaming page lists every gesture with a picker for its
action. The row of the motion Roaming sees right now is marked with ●, so
you can try a gesture and see which row it is. ÅTERSTÄLL STANDARD restores
the defaults.

| Gesture | Default action |
| --- | --- |
| `step`, `walking`, `running`, `leaning:left`, `leaning:right` | Move (follow the motion, as before) |
| `jumping` | Nothing |
| `squatting` | Less sway |
| `arms_raised` (both arms up) | More sway |
| `raising:up` (one arm up) | Wave height up |
| `raising:down` (hands down) | Wave height down |
| `raising:left` (left arm out) | Turn waves left |
| `raising:right` (right arm out) | Turn waves right |

Actions:

- **Move actions** last while the motion lasts: *Move* follows the motion's
  own direction (walking forward / steering, leaning sideways), *Move
  forward / back / left / right* go one way at the motion's intensity ×
  GÅNGFART (LÖPFART while running). Any other action means the motion
  doesn't move you.
- **One-shot actions** fire when the gesture starts and repeat every
  GESTUPPREPNING seconds while it is held (Roaming sends nothing new until
  the motion changes; `idle` or another motion ends the hold, as does
  15 s without any event):
  - *Wave height up / down*: WAVE (`waveAmp`) ± VÅGSTEG, clamped to 0..its
    limit.
  - *Turn waves left / right*: VÅGRIKTNING (`waveDir`) ∓/± VÅGVRIDNING
    (left = counter-clockwise). When the wind steers the waves, the wind
    wins.
  - *More / less sway*: SWAY (`swayAmp`) ± SVAJSTEG.
  - *Turn sway left / right*: SWAY DIRECTION ∓/± SVAJVRIDNING, through
    `setStickBearing`, so with "sync waves with sway" on the waves turn too.

The map is one string setting, `roamingGestureMap`
(`"walking=move;raising:up=waveHeightUp;..."`, `apps/roaming/gestures.ts`).
Decoding is lenient: unknown entries are dropped and missing gestures keep
their default. Like the gamepad mapping it belongs to the device: it is
left out of presets and bath links (`ROAMING_PRESET_KEYS`) and survives a
link seeding the settings (`ROAMING_DEVICE_KEYS` in
`bathing.$payload.bathe.tsx`).

How it runs: `RoamingRuntime` routes each event through the map
(`routeEvent()` in `RoamingGestures.ts`: gesture, action, movement target),
feeds the target to `RoamingMotion` and the action to `RoamingGestures`
(start / hold / repeat, ticked in the physics step). The host drains
`roamingRt.takeActions()` each step and applies them in
`roamingActionsRef` (`routes/index.tsx`). Nothing fires while a mode holds
the player (GUNGA with the cord).

## Debug window

DEBUG WINDOW (`roamingDebug`) opens a floating panel at the top left
(`RoamingDebugWindow.tsx`) to trace whether broadcasts arrive and how they
are handled:

- **Status:** whether the native plugin exists (Android app only), whether
  its receiver is registered, whether the app is on, whether ROAMING is on
  (or held by a mode such as GUNGA with the cord), and the top speed.
- **Live motion:** the target and current velocity (forward ↑ / right →,
  m/s, body frame) and the seconds since the last event, updated 10 times a
  second, plus the gesture being held and the last fired one-shot actions.
- **Event log:** the last 60 events, newest first, with time (ms), source
  (`step_sensor`, `camera`, or `TEST`), the raw `motion_type`, `direction`
  and `intensity`, the gesture and the action it maps to, and for move
  actions the target it sets (share of top speed). Unknown
  values are flagged ⚠ with what they fell back to.
- **Test buttons** (WALK, RUN, LEAN ←, RAISE ↑ ↓ ← →, ARMS ↑, IDLE) feed fake events through the
  same path, and CLEAR empties the log.

While the window is open it keeps the receiver registered even with ROAMING
off, so you can see events arrive before letting them move you. The log and
status live in `roamingBridge.ts` (`roamingLog()`, `roamingStatus()`,
`onRoamingLog()`); the runtime's last step is `RoamingRuntime.lastStep`.

## Using it

1. Install Roaming on the same phone, pick its inputs (step sensor, camera)
   and tap **Start tracking**.
2. In Aquafulness, open settings → Roaming and switch ROAMING on.
3. Walk or run in place. Stop and you glide to a halt.

## How the motion becomes speed

Every broadcast sets a **target velocity**: the event's direction from the
user's point of view (forward/backward/left/right) × its `intensity`
(0..1) × top speed (NAV speed × ROAMING-FART). It is camera-relative, like
the NAV stick.

| `motion_type` | Effect |
| --- | --- |
| `step`, `walking` | Forward (or the event's direction) at intensity × GÅNGFART × top speed. `none`/`up`/`down` count as forward. |
| `running` | The same at LÖPFART |
| `leaning` left/right | Sideways at SIDLEDSFART (default half), when LUTA FÖR SIDLED is on |
| `idle`, `jumping`, `squatting`, `arms_raised`, `raising` | Target 0 |

That is with the default gesture map; a gesture mapped to something else
follows its action (see above).

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
`RoamingMotion.test.ts`), `gestures.ts` + `RoamingGestures.ts` (gesture map,
routing, hold / repeat; `RoamingGestures.test.ts`), `roamingBridge.ts` (Capacitor plugin wrapper, event
parsing and the debug log), `RoamingRuntime.ts` (`step()` in the physics step, right
after HAVSDRIFT; moves `posRef` and the camera together), `RoamingPanel.tsx`, `RoamingDebugWindow.tsx`.
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
