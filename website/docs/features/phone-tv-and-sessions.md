---
title: Phone, TVs, sessions and other extras
description: The virtual phone, in-scene TV panels, interval sessions, the watercraft builder, live mode, wake lock, sound and languages.
---

# Phone, TVs, sessions and other extras

| Feature | What | Code |
| --- | --- | --- |
| Virtual phone (bathOS) | An in-scene phone with apps: Fjärrkontroll (remote sticks), Inställningar (the settings panel), casting to screens | `components/VirtualPhone.tsx`, `aquafulness:phone:v1` |
| TV panels | Landscape TV or portrait phone panels placed in 3D, rendering a page (for example a YouTube embed) through CSS3D | `lib/tv/CSS3DTVManager.ts`, `lib/tv/youtubeEmbed.ts`, `aquafulness:tvs:v1` |
| Interval sessions | INTERVALLPASS: timed intervals that switch modes (`intervalSessionOn`, `intervalDuration`, `intervalSessionType` infinite/fixed, `intervalCount`, `intervalShowStats`, `intervalIncludeFloat/Swing`) | `index.tsx`, `formatClock` in `settingsShared.ts` |
| Watercraft builder | FARKOST: a raft with a voxel block grid and a sculptable clay pad, export/import `.glb` | `lib/watercraft/`, `components/watercraft/WatercraftHud.tsx` |
| Live mode | LIVE: a playful broadcast overlay with viewers and reactions | `LiveBroadcast` in `index.tsx` |
| Wake lock | VAKEN (`wakeLock`, default on) keeps the screen awake | `index.tsx` |
| Water sound | VATTENLJUD (`waterSoundIdx`), LJUDSYNK, SPATIAL; recorded tracks in `public/audio/` and per-app audio | `index.tsx` Web Audio graph; `lib/ambientAudio.ts` on Android |
| Languages | Svenska, English, Norsk, Dansk, Suomi | [i18n](../architecture/i18n.md) |
| Cookie consent | `CookieConsent.tsx`, `aquafulness:cookie-consent:v1` | |
| Spacify sign-in | Optional sync of saved items | [Persistence](../architecture/persistence-and-sharing.md#spacify-sync-optional) |
