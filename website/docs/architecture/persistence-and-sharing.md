---
title: Persistence, files and sharing
description: Autosave, camera pose, presets, full state files, scenery presets, bath links, IndexedDB libraries and Spacify sync.
---

# Persistence, files and sharing

## What is saved where

| Data | Where | Code |
| --- | --- | --- |
| All `Persisted` settings (autosave) | localStorage `aquafulness:settings:v1` | autosave effect after `buildPersistedSnapshot()` in `index.tsx` |
| Camera pose (x, y, z, yaw, pitch) | `aquafulness:camera:v1` | `loadCameraPose` / `saveCameraPose`, also on `pagehide` |
| Named settings presets (scoped) | `aquafulness:presets:v1` | `lib/presets.ts` |
| Named full states (settings + runtime) | `aquafulness:states:v1` | `lib/presets.ts`, `buildFullStateSnapshot` / `applyFullState` |
| Scenery presets (scene + environment + era + time + surface) | `aquafulness:sceneryPresets:v1`, plus shipped ones in `public/apps/<app>/scenary/manifest.json` | `lib/sceneryPresets.ts`, `ScenerySelectorDialog.tsx` |
| Imported `.glb` scenes (EGNA SCENER) | IndexedDB `aquafulness-user-scenes` | `lib/userScenes.ts` |
| Decoration models (DEKORATIONER) | IndexedDB `aquafulness-decorations` | `createGlbLibrary` in `lib/userScenes.ts`, used by `lib/decorations.ts` |
| Hood layer sets | `aquafulness:hoodLayerSets:v1` | `lib/hoodLayers.ts` |
| Watercraft builds (FARKOST) | exported/imported as `.glb` files tagged `kind: "aquafulness-watercraft"` | `lib/watercraft/glbIO.ts` |

The full list of keys is in [Storage keys](../reference/storage-keys.md).

## Runtime state

Some values change every frame and are not settings: drift offsets, sway,
the water level, the surge direction. `buildRuntimeSnapshot(): RuntimeState`
and `applyRuntimeState()` capture these for full state files, so loading a
state puts you back exactly where you were.

## Export and import files

Every export or import goes through `src/lib/deviceFiles.ts`
(`saveFileToDevice`, `pickFileFromDevice`). In a browser it uses a blob
download and `<input type="file">`; inside the Android app it calls the
native DeviceFiles plugin, because the WebView ignores blob downloads and
greys out `.json` files in its picker. **Don't add a new `<a download>`**.

File kinds are recognised by their `app` field:

| `app` | Contents |
| --- | --- |
| `aquafulness-preset` | `{scope, data}`: a settings preset (scope = a `SettingsTab` or `"all"`) |
| `aquafulness-state` | full state: settings + runtime + camera |
| `aquafulness-library` | ALLA SPARADE: every saved preset, state and scenery; import merges by id |
| `aquafulness-hood-layers` | HUVA layer sets |

The offline caches (`aquafulness-html`, `aquafulness-content`, `aquafulness-assets`) are Cache API names, see [Native and offline](native-and-offline.md).

`extractPresetData` also accepts a bare settings object, so hand-edited JSON
imports work.

## Bath links (DELA BADLÄNK)

A bath link puts the whole state in the URL; there is no server storage.

1. `buildBathLink(title, description)` (in-app) or `buildCurrentBathPayload()`
   (the splash screen's "Start bath") builds a `BathPayload`:

   ```ts
   type BathPayload = {
     v: 1;
     s: Record<string, unknown>;          // pickFields(settings, PRESET_ALL_FIELDS)
     c?: { x; y; z; yaw; pitch };          // camera pose, only when y is known
     t?: string; d?: string;               // title and description
   };
   ```

2. `lib/shareState.ts` gzips the JSON (`CompressionStream`) and encodes it as
   base62: `encodeStateToBase62`.
3. The URL is `${PUBLIC_APP_URL}/bathing/<payload>` (`lib/appLinks.ts`). Inside
   the app `window.location.origin` is `https://localhost`, so links are always
   built from `PUBLIC_APP_URL`.
4. `/bathing/$payload` decodes once in its loader and validates with
   `isValidBathPayload`. `/bathing/$payload/` shows a preview;
   `/bathing/$payload/bathe` **seeds `aquafulness:settings:v1` and
   `aquafulness:camera:v1`** and mounts the normal app.

:::warning Seeding trap
Because the bathe route writes the payload into localStorage on mount, and
the address bar stays on that URL, reopening the link used to reset all
settings to the snapshot. The fix is a list of already-seeded payloads in
`aquafulness:seededBathPayloads:v1` (`SEEDED_PAYLOAD_KEY`, last 20). Anything
new that writes `STORAGE_KEY` from a URL must check that list. Test it with a
**new tab** at the same URL, not a reload.
:::

Decorations ride along in links only when their model is embedded
(≤ 32 KB each, ≤ 128 KB per link); device-local models are dropped. Imported
scene ids (`user:<uuid>`) don't resolve on another device and fall back to no
scene.

Android App Links open bath links in the app (`AppLinks` plugin,
`public/.well-known/assetlinks.json`, whose SHA-256 fingerprint is still a
placeholder until the Play App Signing key is filled in).

## Spacify sync (optional)

"Sign in with Spacify" (`lib/spacify.ts`, OAuth 2 with PKCE, callback route
`/auth/spacify`) syncs saved states, presets and scenery presets to the
user's Spacify account. `lib/spacifySync.ts` is pure merge logic with a
"synced" fingerprint map per kind (`aquafulness:spacify:synced:v1`), so it can
tell an edit from an untouched copy and a deletion from a new item;
`hooks/use-spacify-sync.ts` runs it. Everything works without signing in.
