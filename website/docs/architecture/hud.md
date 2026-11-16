---
title: HUD and controls
description: The game-controller style HUD, on-screen sticks, the mode column, the camera drawer, and the virtual phone.
---

# HUD and controls

The HUD is JSX at the end of `Aquafulness()` in `routes/index.tsx`, drawn
over the canvas. Since soarfulness #15 (aqua-wave-dream #225, open) it is laid
out like a game controller:

| Place | What | Code |
| --- | --- | --- |
| Bottom left | **NAV** steering wheel (move) | `<Joystick size="lg" variant="wheel">` |
| Bottom centre | Lever console: STRÖM / SVAJ / VÅGRIKT / LOOK (SYNVINKEL). Swapped per mode: DRIFT XZ / DRIFT Y + HOPP in FLYG, LUFTSTRÖM / KROPP in BODYFLIGHT | `JoystickPad size="sm"` pads |
| Above the console | Camera drawer (the "bottom menu"): tabs for the current mode plus `tornado`, `freakout`, `torus`, `sky`, `level`, swipeable | `cameraDrawerTab` (`CameraDrawerTab` type) |
| Right edge | Mode column: SIMMARE / GUNGA / FLYG / BODYFLIGHT icons, then TORNADO, RIDE, BADRINGAR, VIND toggles; wraps with `flex-wrap-reverse` | `HudIconButton`, `CameraModeIcon` in `components/HudControls.tsx`; order in `CAMERA_MODE_TAB_ORDER` |
| Bottom right | Level regulator: NIVÅ DRIFT + RESET | |
| Top | Settings, share, time travel, fullscreen, sound, phone buttons | |

Sticks emit a normalized `(-1..1, -1..1)` vector. STRÖM and SVAJ represent a
**real world direction**: `padToWorldXZ()` converts the pad to world x/z at
the moment it is set, and `worldXZToPad()` rotates the knob back every frame
so it keeps pointing the same way as the camera turns
(`src/lib/settingsShared.ts`). The RIKTNING dials (`worldXZBearing`,
`bearingToWorldXZ`) give a precise alternative.

In aqua-wave-dream without EXPERIMENTELLT LÄGE, the mode column and drawer
only offer SIMMARE and FARKOST (`isCameraModeAvailable`). Aqua's main
branch still has the older layout until #225 merges.

## The virtual phone (bathOS)

`components/VirtualPhone.tsx` is an in-scene phone with its own small app
launcher ("bathOS"). Two of its apps reuse the HUD:

- **Fjärrkontroll** (remote control): every stick except NAV and LOOK,
  including HÖJD (noclip's vertical stick, which only lives here). It gets
  `remoteControllerProps` from `index.tsx`.
- **Inställningar**: the same `SettingsPanel` with the same props.

The phone can also cast pages to in-scene TV panels (`lib/tv/CSS3DTVManager.ts`,
`aquafulness:tvs:v1`). Phone state is in `aquafulness:phone:v1`.
