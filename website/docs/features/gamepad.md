---
title: Gamepad (GAMEPAD)
description: Play with a game controller through the browser Gamepad API, with every action rebindable by pressing the button you want.
---

# Gamepad (GAMEPAD)

Any controller the browser sees through the
[Gamepad API](https://developer.mozilla.org/docs/Web/API/Gamepad_API)
(Xbox, PlayStation, Switch Pro, most Bluetooth/USB pads) can drive the
bather: in desktop browsers, on phones, and in the Capacitor app's webview.
Browsers only expose a pad after one of its buttons has been pressed, so
press any button once after connecting.

The pad feeds the same controls as the on-screen HUD, so every movement
mode works without changes:

| Pad (standard layout) | Action | Feeds |
| --- | --- | --- |
| Left stick, D-pad | Forward / back / left / right | NAV wheel |
| Right stick | Look up / down, turn left / right | LOOK pad |
| RT / R2, LT / L2 | Rise, sink | HÖJD / DRIVA Y (FLYG, FARKOST) |
| A / ✕ or L3 (hold) | Boost | NAV × BOOST SPEED |
| RB / R1, LB / L1 | Next / previous camera mode | the mode buttons on the right |
| R3 | Level the view | pitch back to 0 |
| Start / Options | Open / close settings | the settings dialog |

The pad's share is added on top of the on-screen sticks every frame
(`stickRef = HUD + pad` in `routes/index.tsx`), so touch and pad work
together and the HUD knobs keep showing only the touch input. With no pad
connected, or the app off, the render loop leaves the sticks alone.

## Settings

The app has its own settings page, **Gamepad** (controller icon, in the
bather section), listed while the app is on under APPS.

| Setting | UI | Default |
| --- | --- | --- |
| `gamepadOn` | GAMEPAD | on |
| `gamepadDeadZone` | STICK DEAD ZONE: stick travel ignored around center (the rest is rescaled to 0–1) | 15 % |
| `gamepadMoveSensitivity` | MOVE SENSITIVITY: NAV strength, 100 % = a fully pushed NAV wheel | 100 % |
| `gamepadLookSensitivity` | LOOK SENSITIVITY | 100 % |
| `gamepadInvertLookY` | INVERT LOOK UP/DOWN | off |
| `gamepadBoost` | BOOST SPEED: NAV multiplier while BOOST is held | ×2 |
| `gamepadBindings` | BUTTON MAPPING (see below) | the table above |
| `gamepadDebug` | DEBUG WINDOW | off |

Under GAMEPAD the page lists the connected pads by name, and warns when the
browser doesn't know a pad's layout (`mapping !== "standard"`), since the
defaults assume the standard one.

The gamepad settings are saved with the rest of the settings, but they
belong to the device, not to a bath: they are not part of presets or
bath links (`PRESET_TAB_FIELDS`), and the bathe route keeps the visitor's
own `gamepad*` values when it seeds settings from a link.

## Button mapping

Each action row shows its inputs as chips. **+ BIND** waits for the next
button press or stick push on any pad and adds it (up to three per action);
**×** removes one. An input drives one action only, so binding it moves it
off the action that had it. Inputs already held when BIND is tapped are
ignored until released, Esc cancels, and the pads are ignored until every
input is let go again after a capture, so the button you bind doesn't also
fire its old action. **RESET TO DEFAULTS** restores the standard mapping.

The mapping is stored as one string so it persists like any other setting:

```
moveForward=a1-,b12;moveBack=a1+,b13;...;boost=b0,b10;toggleSettings=b9
```

`bN` is button N, `aN+` / `aN-` axis N pushed to its plus / minus side.
Decoding is lenient: unknown actions and malformed inputs are dropped, an
action missing from the string keeps its default (so actions added later
show up bound), and `action=` with nothing after it stays unbound.

## Debug window

DEBUG WINDOW opens a floating panel at the top left
(`GamepadDebugWindow.tsx`, updated about 15 times a second) with:

- whether the app is on, the scene is running and how many pads are seen,
  and "binding…" while a capture holds the pads;
- what the pads produce right now: NAV, LOOK, rise/sink and BOOST;
- every pad's id and layout, its axes as bars, and its buttons lit while
  pressed (hover a button for its standard name);
- every action's current value.

## Code

`src/apps/gamepad/`:

- `bindings.ts`: the action list, default mapping, string format, bind /
  unbind, readable input names.
- `GamepadMapper.ts`: pure mapping from pad snapshots to action values and
  the NAV / LOOK / rise output, dead zone, boost, once-per-press button
  actions (hysteresis 0.5 / 0.3 for analog triggers). Unit tested in
  `GamepadMapper.test.ts`.
- `gamepadInput.ts`: `navigator.getGamepads()` reading, connect events, the
  press-to-bind capture.
- `GamepadRuntime.ts`: `poll()` once per frame from the render loop.
- `GamepadPanel.tsx`, `GamepadDebugWindow.tsx`: the settings page and the
  debug window.
