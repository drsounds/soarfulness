---
title: Feature index
description: Every feature with its Swedish UI name, setting ids, main files, PR numbers and status in each repo.
---

# Feature index

Status as of **2026-11-16**. Since soarfulness #52 the feature code lives in `src/apps/<id>/`; see [Apps](../architecture/plugin-refactor.md) for the app id of each. ✅ merged on `main`, 🟡 open PR, — not present.
PR numbers are in `drsounds/soarfulness` (soar) and
`drsounds/aqua-wave-dream` (aqua). Older numbers marked *(S)* are in
`Soartify/soarfulness`.

| Feature | UI (sv) | Setting ids | Main files | soar | aqua |
| --- | --- | --- | --- | --- | --- |
| [Floating bather](../features/movement-modes.md) | SIMMARE | `cameraMode: "float"`, `bobSpeed`, `buoyAmp`, `floatLift`, `waveAnticipation` | `routes/index.tsx` | ✅ | ✅ |
| [Free flight](../features/movement-modes.md) | FLYG | `noclip*` | `routes/index.tsx`, `VirtualPhone.tsx` | ✅ | ✅ (experimental) |
| [Swing](../features/movement-modes.md) | GUNGA, GUNGKROK | `swing*` | `routes/index.tsx` | ✅ | ✅ (experimental) |
| [Watercraft](../features/phone-tv-and-sessions.md) | FARKOST | `cameraMode: "watercraft"` | `lib/watercraft/` | ✅ | ✅ |
| [Bodyflight](../features/movement-modes.md#bodyflight) | BODYFLIGHT, LUFTSTRÖM, KROPP | `bodyflight*` | `routes/index.tsx` | ✅ #74 *(S)* | ✅ via #219 (#215 🟡) |
| [Tornado / whirlpool](../features/movement-modes.md#tornado--virvel) | TORNADO, VIRVEL | `tornado*` | `routes/index.tsx` | ✅ | ✅ (differs) |
| [Ride](../features/movement-modes.md#ride-formerly-freak-out) | RIDE (FREAK OUT) | `freakOut*` | `routes/index.tsx` | ✅ #12 | ✅ base; rename + kick #224 🟡 |
| [Controller HUD layout](../architecture/hud.md) | NAV, SYNVINKEL, mode column | — | `routes/index.tsx`, `HudControls.tsx`, `Joystick.tsx` | ✅ #15 | 🟡 #225 |
| [Level drift](../features/movement-modes.md#water-level-depth-sine-and-level-drift) | NIVÅ DRIFT, DRIFT SINUS | `depthDrift*` | `routes/index.tsx` | ✅ #52–#56 *(S)* | ✅ via #219 |
| [EXTREME](../features/limits-and-typed-values.md) | EXTREME | own store | `lib/extremeLimits.ts` | ✅ #10 | ✅ #222 |
| [Typed values beyond limits](../features/limits-and-typed-values.md#typed-values-override-limits) | — | — | `SettingRow.tsx`, `PadDial.tsx` | ✅ #48 | 🟡 #247 |
| [Strandpark first start](../features/defaults.md) | — | `DEFAULTS`, `FIRST_START_POSE` | `routes/index.tsx` | ✅ #8, #9 | ✅ #219, #220 |
| [Cloud scale defaults 8×](../features/clouds.md) | BOTTENMOLN/HIMMELSMOLN SKALA | `bottomCloudsScale`, `skyCloudsScale` | | ✅ #11 | ✅ #223 |
| [Lighting, shadows, neon, retro, water glow](../features/lighting-and-effects.md) | BÄTTRE LJUS, SKUGGOR, NEONKANTER, NEONACCENT, RETRO 90-TAL, VATTENGLÖD | `betterLightingOn`, `shadowsOn`, `neon*`, `retro*`, `waterGlow*` | `src/apps/neon/NeonEdges.ts`, `neonAccent.ts`, `retroShader.ts` | ✅ #7 | ✅ |
| [Day/night skybox blend](../features/time-and-backdrops.md) | DYGNSBYTE | `envDayNightAutoOn` | `src/apps/day-night/dayNightBackdrop.ts` | ✅ #16 | ✅ #226 |
| [Sunset tint](../features/time-and-backdrops.md) | SOLTONING | `envSunTintOn` | `dayNightBackdrop.ts` | ✅ #19 | ✅ #229 |
| [Cloud water surface](../features/waves-and-water.md) | MOLNYTA | `waterCloudsOn` | ocean shader | ✅ #19, #21 | 🟡 #231 |
| [Night backdrops](../features/time-and-backdrops.md#night-backdrops) | — | — | `public/apps/*/environments/*/*/night/` | ✅ #23 | ✅ #232 |
| [Water over whole world](../features/waves-and-water.md#water-plane-size) | VATTEN ÖVER HELA VÄRLDEN | `waterFullWorld` | `waterPlaneExtent()` | ✅ #24 | 🟡 #233 |
| [Sand fallback](../features/waves-and-water.md#bottom) | — | — | `lib/sandTexture.ts` | ✅ #25 | ✅ #234 |
| [Imported scenes](../features/scenes-and-decorations.md#imported-scenes-egna-scener) | EGNA SCENER | `sceneId: "user:…"` | `lib/userScenes.ts` | ✅ #20 | ✅ #230 |
| [Decorations](../features/scenes-and-decorations.md#decorations-dekorationer) | DEKORATIONER, PLACERA | `decorations` | `src/apps/decorations/decorations.ts`, `src/apps/decorations/DecorationLayer.ts`, `src/apps/decorations/useDecorations.ts`, `DecorationPanel.tsx` | ✅ #49 | 🟡 #248 |
| [Snow](../features/snow.md) | SNÖ, SNÖTÄCKE | `snow*` | `src/apps/snow/Snowfall.ts` | ✅ #18 | ✅ #228 |
| [Snow at night, grey backdrop, sinking](../features/snow.md) | GRÅ BAKGRUND | `snowGrayBackdropOn` | `snow.ts` | ✅ #26 | 🟡 #235 |
| [Confetti](../features/confetti.md) | KONFETTI | `confetti*` | `src/apps/confetti/Confetti.ts` | ✅ #27 | 🟡 #236 |
| [Fireworks](../features/fireworks.md) | FYRVERKERI | `fireworks*` | `src/apps/fireworks/Fireworks.ts` | ✅ #28 | 🟡 #237 |
| [Northern lights](../features/aurora.md) | NORRSKEN | `aurora*` | `src/apps/aurora/Aurora.ts` | ✅ #29, #30 | ✅ #238; 🟡 #239 |
| [Open-water drift](../features/open-drift.md) | HAVSDRIFT | `openDrift*` | `src/apps/open-drift/OpenDrift.ts` | ✅ #31 | 🟡 #240 |
| [Move with your body](../features/roaming.md) | ROAMING | `roaming*` | `src/apps/roaming/RoamingMotion.ts` | ✅ #110 | ✅ #254 |
| [Gamepad](../features/gamepad.md) | GAMEPAD | `gamepad*` | `src/apps/gamepad/GamepadMapper.ts` | 🟡 | 🟡 |
| [Hood](../features/bather-hood-and-goggles.md) | HUVA | `hood*`, `hoodExtraLayers` | `src/apps/hood/Hood.ts`, `src/apps/hood/hoodLayers.ts`, `HoodPanel.tsx` | ✅ #32, #34–#42, #45 | 🟡 #241 |
| [Underwater fog](../features/underwater-fog.md) | UNDERVATTENDIS | `underwaterFog*` | `src/apps/underwater-fog/underwaterFog.ts` | ✅ #33 | 🟡 #242 |
| [Wind](../features/wind.md) | VIND, VINDLJUD, HÖJDLJUD | `winds`, `wind*` | `src/apps/wind/wind.ts`, `src/apps/wind/WindAudio.ts`, `WindPanel.tsx` | ✅ #43 | 🟡 #243 |
| [Rain](../features/rain.md) | REGN | `rain*` | `src/apps/rain/Rainfall.ts` | ✅ #44 | 🟡 #244 |
| [Settings groups, search, tabs](../architecture/settings-ui.md) | — | — | `settingsNav.tsx`, `SettingsPanel.tsx` | ✅ #46 | 🟡 #245 |
| [UI blur-off + Liquid Glass](../features/ui-theme.md) | GLASEFFEKT, LIQUID GLASS | own store | `lib/uiTheme.ts`, `styles.css` | ✅ #47 | 🟡 #246 |
| [String lights](../features/string-lights.md) | LJUSSLINGOR | own store | `src/apps/string-lights/stringLights.ts`, `src/apps/string-lights/StringLightsFx.ts`, `StringLightsPanel.tsx` | ✅ #50 | 🟡 #249 |
| PWA precache limit | — | — | `vite.config.ts` | ✅ #51 | — |
| [Deep links, file export](../architecture/persistence-and-sharing.md) | DELA BADLÄNK, EXPORTERA | — | `lib/appLinks.ts`, `lib/deviceFiles.ts`, `lib/shareState.ts` | ✅ #77 *(S)* | ✅ #216 |
| [Bath link seeding fix](../architecture/persistence-and-sharing.md#bath-links-dela-badlänk) | — | — | `bathing.$payload.bathe.tsx` | ✅ #73 *(S)* | ✅ via #219 |
| [Experimental mode](../getting-started/repos.md#what-is-different-in-aqua-wave-dream) | EXPERIMENTELLT LÄGE | own store | `lib/experimentalModes.ts` | — | ✅ #219 |
| [Plugin apps structure](../architecture/plugin-refactor.md) | — | — | `src/core/apps/`, `src/apps/<id>/` | ✅ #52 | 🟡 #250 |
| [Spacify sync](../architecture/persistence-and-sharing.md#spacify-sync-optional) | Logga in med Spacify | — | `lib/spacify.ts`, `lib/spacifySync.ts` | ✅ #3 | ✅ |

Keep this table up to date when you open or merge a twin PR.
