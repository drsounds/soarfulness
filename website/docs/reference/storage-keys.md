---
title: Storage keys
description: Every localStorage key, IndexedDB database, Cache API name and file kind the app uses.
---

# Storage keys

## localStorage

| Key | Owner | Contents |
| --- | --- | --- |
| `aquafulness:settings:v1` | `routes/index.tsx` (`STORAGE_KEY`) | All `Persisted` settings (autosave) |
| `aquafulness:camera:v1` | `routes/index.tsx` (`CAMERA_STORAGE_KEY`) | Camera pose `{x, z, yaw, pitch, y?}` |
| `aquafulness:seededBathPayloads:v1` | `routes/index.tsx` (`SEEDED_PAYLOAD_KEY`) | Last 20 bath-link payloads already seeded |
| `aquafulness:presets:v1` | `lib/presets.ts` | Named settings presets |
| `aquafulness:states:v1` | `lib/presets.ts` | Named full states |
| `aquafulness:sceneryPresets:v1` | `lib/sceneryPresets.ts` | Saved sceneries |
| `aquafulness:hoodLayerSets:v1` | `lib/hoodLayers.ts` | Saved HUVA layer sets |
| `aquafulness:stringLights:v1` | `lib/stringLights.ts` | LJUSSLINGOR store |
| `aquafulness:ui-theme:v1` | `lib/uiTheme.ts` | UI chrome theme, blur, Liquid Glass |
| `aquafulness:extremeLimits:v1` | `lib/extremeLimits.ts` | EXTREME on/off |
| `aquafulness:experimentalModes:v1` | `lib/experimentalModes.ts` (aqua only) | EXPERIMENTELLT LÄGE |
| `aquafulness:settingsLayout:v1` | `components/settingsNav.tsx` | `list` or `tabs` |
| `aquafulness:lang:v1` | `lib/i18n.ts` | UI language |
| `aquafulness:phone:v1` | `VirtualPhone.tsx` | Virtual phone state |
| `aquafulness:tvs:v1` | `lib/tv/CSS3DTVManager.ts` | Placed TV panels |
| `aquafulness:offline-ready:v1` | `hooks/use-offline-precache.ts` | Offline precache finished |
| `aquafulness:cookie-consent:v1` | `CookieConsent.tsx` | Consent choice |
| `aquafulness:appBannerDismissed:v1` | `AppInstallBanner.tsx` (soar only) | Install banner dismissed |
| `aquafulness:spacify:session:v1`, `:pending:v1`, `:synced:v1` | `lib/spacify.ts`, `lib/spacifySync.ts` | Spacify tokens, PKCE state, sync fingerprints |
| `aquafulness:torusScaleV3`, `aquafulness:torusGapsV1` | `routes/index.tsx` | One-off migration markers |

## IndexedDB

| Database | Owner | Contents |
| --- | --- | --- |
| `aquafulness-user-scenes` | `lib/userScenes.ts` | EGNA SCENER (`meta` + `data` stores) |
| `aquafulness-decorations` | `lib/decorations.ts` via `createGlbLibrary` | DEKORATIONER models |

## Cache API

| Cache | Owner | Contents |
| --- | --- | --- |
| `aquafulness-html` | `sw.ts` | Pages, network-first |
| `aquafulness-content` | `sw.ts`, `lib/offlineAssets.ts` | `apps.json` and manifests |
| `aquafulness-assets` | `sw.ts`, `lib/offlineAssets.ts` | Scenes, skyboxes, surfaces, audio |

## File kinds (`app` / `kind` field)

| Value | Written by |
| --- | --- |
| `aquafulness-preset` | `lib/presets.ts` |
| `aquafulness-state` | `lib/presets.ts` |
| `aquafulness-library` | ALLA SPARADE export |
| `aquafulness-hood-layers` | `lib/hoodLayers.ts` |
| `aquafulness-watercraft` | `lib/watercraft/glbIO.ts` (`.glb` extras) |
