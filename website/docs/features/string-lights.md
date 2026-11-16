---
title: String lights (LJUSSLINGOR)
description: Decorative festoon lights hung per scene, with their own store, renderer and optional real lights.
---

# String lights (LJUSSLINGOR)

Off by default, in the `effects` area right after NEONACCENT.

Unlike most features, string lights are **not** in `Persisted`/`DEFAULTS`,
presets or bath links. They have their own external store:

```ts
// localStorage aquafulness:stringLights:v1
{ on, emitters, dayGlow, scenes: { [sceneId or "__none__"]: StringLight[] } }
```

Each scene keeps its own strings.

**Files:**

| File | Role |
| --- | --- |
| `src/lib/stringLights.ts` | Types, defaults, sanitizer, the store (`useStringLights()`), per-scene lists |
| `src/lib/sceneFx/stringLights.ts` | `StringLightsFx` renderer |
| `src/components/StringLightsSettings.tsx` | Prop-free settings UI (reads the store) |
| `src/lib/stringLights.test.ts` | Tests |

`index.tsx` only constructs, updates and disposes `StringLightsFx`, and keeps
`stringLightsSceneRef`; `SettingsPanel` only mounts `<StringLightsSettings />`.
Locale strings are the top-level `stringLights` block.

**Per string:** position (x, z), RIKTNING, SPÄNNVIDD, HÖJD START / SLUT,
HÄNGKURVA, NEDHÄNG, DRAPERINGAR, GUNGNING I VINDEN, SLADDFÄRG, ANTAL LAMPOR,
LAMPTYP, LAMPSTORLEK, HÄNGLÄNGD, LJUSSTYRKA, glow and animation. Anchor heights
are measured from the water surface (`ocean.position.y`), so strings stay above
the water when its level moves. LÄGG TILL FRAMFÖR MIG uses `stringLightsView`,
written by the renderer each frame.

**Renderer:** per string, a frame group at anchor A turned toward B with a
sway pivot (nothing rebuilt per frame), a tube wire plus drop wires, an
`InstancedMesh` for bulbs and one for sockets, and additive glow sprites. Only
colours are written per frame; geometry is rebuilt when a string's shape key
changes. **Real light** (SKAPAR LJUS) uses a shared `PointLight` pool capped
by LJUSKÄLLOR (max 8), created on first use and rebuilt only when the cap
changes.

**Status:** soarfulness #50 (merged). aqua-wave-dream #249 (open).

**Screenshot tip:** the first-start camera sits under the Strandpark2 pier.
For open-water shots set `sceneId` to `null` and seed strings under `"__none__"`.
