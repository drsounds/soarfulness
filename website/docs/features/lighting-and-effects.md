---
title: Lighting and effects
description: Better lighting (IBL), shadows, neon edges, neon accent, retro and chromatic aberration post passes, and the bath-ring torus field.
---

# Lighting and effects

These came to `drsounds/soarfulness` from `Soartify/soarfulness` PR #82 as
one port (soarfulness #7), via a `git format-patch` file.

| Feature | Settings | UI | Default | Code |
| --- | --- | --- | --- | --- |
| Better light | `betterLightingOn`, `lightingReflStrength` | BÄTTRE LJUS, REFLEKTIONSSTYRKA | on | IBL for glTF materials from the sky or skybox through `PMREMGenerator`, plus the skybox reflected in the water |
| Shadows | `shadowsOn` | SKUGGOR | on | Sun shadow map fitted around the loaded model each frame (`SHADOW_MAX_HALF_SIZE`). Low graphics mode forces it off. |
| Neon edges | `neonOn`, `neonMode` (`NEON_MODES` solid / alternate / fade / hue), `neonPrimary`, `neonSecondary`, `neonTint`, `neonTintAmount`, `neonStrength`, `neonWidth`, `neonFrequency` | NEONKANTER, NEONLÄGE, PRIMÄRFÄRG, … | off | `lib/sceneFx/NeonEdges.ts`: `EdgesGeometry` (creases sharper than `EDGE_THRESHOLD_DEG`) drawn as `LineSegments2` with one additive material, in their own group that copies each mesh's world matrix |
| Neon accent | `neonAccentColor` | NEONACCENT | `#ff2bd6` | `lib/sceneFx/neonAccent.ts`: every scene material whose name ends in `-neon` (Blender `.001` suffix allowed) takes the colour as tint and emission at intensity 1 |
| Water glow | `waterGlow*` | VATTENGLÖD | off | see [Waves and water](waves-and-water.md) |
| Retro 90s | `retroOn`, `retroPalette` (`rgb332` / `websafe` / `ega` / `gray`), `retroPixelSize`, `retroDither`, `retroScanlines` | RETRO 90-TAL, RETROPALETT, … | off | `lib/sceneFx/retroShader.ts`: pixelate, Bayer dither, snap to palette, scanlines. A post pass in the `EffectComposer`. |
| Chromatic aberration | `chromaticAberrationOn`, `chromaticAberrationAmount` | KROMATISK ABERRATION | off | `CHROMATIC_ABERRATION_SHADER` in `index.tsx`, a post pass |

When a post pass is on, the frame goes through `composer.render()`; otherwise
`renderer.render()` directly.

## Bath rings (BADRINGAR)

`torusRingsOn` and `torus*` settings (RADIE, TJOCKLEK, STORLEK, OPACITET,
TEXTUR, MELLANRUM XZ/Y, RINGAR/KOLONN, RÄCKVIDD, TONING) fill the space around
the camera with floating torus rings on an invisible grid
(`lib/torusRings/TorusRingField.ts`). Spacing derives from the ring size, so
rings never intersect. A HUD toggle and a `torus` tab in the camera drawer.
Old saves are migrated once (`aquafulness:torusScaleV3`, `aquafulness:torusGapsV1`).
