---
title: Movement modes
description: SIMMARE (float), FLYG (noclip), GUNGA (swing), FARKOST (watercraft), BODYFLIGHT, plus TORNADO/VIRVEL, RIDE, sway, surge, current and water-level drift.
---

# Movement modes

The bather is the camera. `cameraMode: CameraMode` (`settingsShared.ts`)
chooses how it moves:

| Id | UI (sv / en) | What it is |
| --- | --- | --- |
| `float` | SIMMARE / SWIMMER | Default. Floats at the water line on a buoyancy spring that rides the wave height (GUPP, FLYT, DYK, FÖRUTSEENDE). |
| `noclip` | FLYG / FLY | Free flight. DRIFT XZ / DRIFT Y sticks, FRITT FALL / OMVÄND STIGNING, AUTO VÄXLING. `noclipSpeed`, `noclipFallRiseSpeed`, `noclipVertEaseTime`. |
| `swing` | GUNGA / SWING | A giant pendulum swing over the water (`swingIntensity`, `swingSpeed`, `swingHeight`, `swingYWaveform`, presets water/clouds/custom, GUNGKROK hook with a rope `swingCord*`, GUNGA BEHÅLL TEMPO `swingKeepSpeed`). |
| `watercraft` | FARKOST / WATERCRAFT | A raft at a fixed spot with a voxel block grid and a sculptable clay pad (`lib/watercraft/`, `components/watercraft/WatercraftHud.tsx`). Builds export as `.glb`. |
| `bodyflight` | BODYFLIGHT | Wind-tunnel flight in an updraft. |

The HUD mode column offers `CAMERA_MODE_TAB_ORDER` = float, swing, noclip,
bodyflight. In aqua-wave-dream only float and watercraft are offered unless
EXPERIMENTELLT LÄGE is on.

## BODYFLIGHT

Added in soarfulness #74 (Soartify) / aqua-wave-dream #215 (open; aqua's
`main` already has it via the parity copy).

- `bodyflightAirflow` LUFTSTRÖM (m/s, default 120, decays over
  `BODYFLIGHT_AIR_FALLOFF` = 150 m), `bodyflightGravity` GRAVITATION (g),
  `bodyflightHoverHeight` SVÄVHÖJD (air cushion).
- The **KROPP** stick (sticky, right side above LOOK): |y| = upright, which
  means less drag and falling; x = bank and slide with view roll. Drag
  coefficients `BODYFLIGHT_CD_FLAT/UPRIGHT/HEAD_DOWN`.
- Updraft particles: a `THREE.Points` pool of `BODYFLIGHT_MAX_PARTICLES` = 2400,
  draw count scales with the airflow.

## TORNADO / VIRVEL

`tornadoOn` spins the bather around a centre (`tornadoRadius`,
`tornadoSpeed`, `tornadoDirection`, `tornadoOpening`, FÖLJ CENTRUM
`tornadoFollowCenter`), with an optional funnel cloud (`tornadoCloudOn`) and
an automatic TORNADOSEKVENS (drag in, stay, exit outward or lift, pause).
The water surface gets a vortex through the `uVortex*` uniforms. In
soarfulness one TORNADO toggle serves FRI/GUNGA/FLYG and reads VIRVEL in
BODYFLIGHT; aqua-wave-dream keeps GUNGA's `swingTornado*` and a separate
VIRVEL mode. Old saves are migrated in `loadSettings()`.

## RIDE (formerly FREAK OUT)

A carousel / chair-swing ride layered on GUNGA. Renamed to RIDE only in the
locales; **ids stay `freakOut*`**.

- Swing arm and ring: `freakOutSwingAxis/Angle/Speed/Length`,
  `freakOutRingRadius`, rotation on/axis/speed/direction, ROTATION VID TOPPEN
  (`freakOutRotationPeakSpeed`) and ACCELERATION PÅ TILLBAKAVÄGEN
  (`freakOutRotationRecovery`), alternate direction.
- **SNURR VID TOPPEN** (`freakOutRotationKickOn` / `freakOutRotationKick`):
  extra spin = strength · sin²(swing phase), eased. It must accelerate
  gradually toward the peak and slow on the way down; the owner rejected an
  impulse/jolt version.
- Seats hang from a seat ring above the riders, facing the centre
  (`freakOutSeatsOn/SeatCount/CameraSeat/SeatPostLength` + colours). The
  bathing-suit model is `public/apps/suit`.
- TORNADO + RIDE = chair swing. `freakOutFloatYOffset` lifts the ride 10 m in
  SIMMARE; `freakOutOverlayOn` shows on-screen RIDE controls at the left edge.
- Rig code: `buildFreakOutRig`, `freakOutPose`, `layoutFreakOutSeats` at the top
  of `index.tsx`. aqua-wave-dream's scene had no lights, so the rig uses
  emissive materials (`freakOutTint`).

## Currents, sway and surge

| Setting | UI | Notes |
| --- | --- | --- |
| STRÖM stick / STRÖM RIKTNING | current | A constant world-space drift. Not a `Persisted` setting: the direction is runtime state (`driftWorldRef`, saved in full state files as `driftDir`), set with `padToWorldXZ`. EXTREME max 132 m/s. |
| `swayAmp`, `swaySpeed`, `swayBias` | SVAJ | Side-to-side sway; its world-fixed direction is runtime state (`swayWorldRef` / `swayDir`) |
| `surgeAmp`, `surgeSpeed`, `surgeRotationMode/Speed` | SVALL | Slow back-and-forth current; its direction (`surgeWorldRef` / `surgeDir`) can rotate |
| `syncWaveWithSway` | | Couples waves and sway |
| `openDrift*` | HAVSDRIFT | See [Open-water drift](open-drift.md) |
| `windCurrentOn` | VIND → STRÖM | See [Wind](wind.md) |

## Water level: depth sine and level drift

- **DJUP-SINUS** (`depthSineOn`, `depthSineAmp/Freq/Speed/Interval/Peak/Waveform`):
  the water level oscillates.
- **NIVÅ DRIFT** (`depthDriftSpeed`): an unbounded rise or sink of the water
  level, with **DRIFT SINUS** (`depthDriftSine*`) swinging the drift itself.
  The camera follows the whole water level. NIVÅ RESET and a NIVÅ tab in the
  camera drawer; the level regulator sits at the bottom right of the HUD.

## World boundary

**VÄRLDSGRÄNS** (`worldBoundaryOn`, `worldBoundarySize` 20 000 m,
`worldBoundaryHeight` 3 000 m) wraps the camera to the opposite edge on x/z
and y, so travel feels endless. OÄNDLIGA MOLNLAGER (`worldBoundaryYExtend`)
tiles extra sky-cloud layers when climbing. Drift and current are applied
before the wrap block.
