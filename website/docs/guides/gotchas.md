---
title: Gotchas
description: Traps earlier work fell into, collected in one place.
---

# Gotchas

| Trap | What happens | Do this |
| --- | --- | --- |
| Setting missing from one of the lists | Doesn't autosave, reset, load from presets or travel in links | Follow [Add a setting](add-a-setting.md) |
| Setting not in `PRESET_TAB_FIELDS` | Autosaves but never appears in presets or bath links | Add it to the right tab list |
| Reading React state in `animate()` | Stale forever (mount effect has `[]` deps) | Read a ref |
| Bath link reseeding | Reopening `/bathing/…/bathe` reverts settings | Check `aquafulness:seededBathPayloads:v1` before writing `STORAGE_KEY` from a URL; test in a new tab |
| Splash "Start bath" on first start | First-start pose lost | `buildCurrentBathPayload` adds `FIRST_START_POSE` |
| `<a download>` / `<input type=file>` | Does nothing in the Android WebView | Use `lib/deviceFiles.ts` |
| `window.location.origin` in shared links | Is `https://localhost` in the app | Use `PUBLIC_APP_URL` from `lib/appLinks.ts` |
| `src/assets/*.asset.json` textures | 404 off Lovable hosting, three.js samples black | Provide a fallback (see `lib/sandTexture.ts`) |
| `backdrop-filter` + `-webkit-backdrop-filter` in one rule | Minifier keeps only the last one | Put `-webkit-` first |
| GLSL names `active`, `main` | Compile errors in WebGL | Pick other names |
| New backdrop effect | Doesn't show on skyboxes | Add it to the `useEnvDome` condition |
| Skybox waterline off-centre | Scene looks sunk | Waterline on row H/2 |
| Clamping in `onSet` | Breaks typed-value overrides | Clamp only hard floors |
| New strength control without `EXTREME_MAX` | No EXTREME gating | Add to `EXTREME_MAX`, `mx()`, clamp effect |
| `prettier --write src/routes/index.tsx` | Giant diff, conflicts with every open PR | Format only your lines |
| Rebase / force-push | Lovable loses history | Merge `main` into the branch |
| Committed `routeTree.gen.ts` changes | Noise | Revert unless routes changed |
| Wave preset "standard" drifting from `DEFAULTS` | Touching VÅGPRESET flips other toggles | Keep them identical |
| Advanced mode UI in aqua-wave-dream | Shows even with EXPERIMENTELLT LÄGE off | Gate on the flag |
| Main bundle over 2 MiB | PWA build fails | Raise `maximumFileSizeToCacheInBytes` (done in soarfulness), or split |
| `bun install` in the cloud sandbox | 403 on the private mirror | See [Local development](../getting-started/local-dev.md#installing-in-the-cloud-sandbox) |
| Imported scene id in a link | Doesn't resolve elsewhere | Falls back to no scene; don't rely on it |
| Changing `DEFAULTS` | Existing users keep saved values | Expected; migrations use literals |
