---
title: Clouds
description: Flat cloud decks, 3D cloud layers, sky puffs, the tornado cloud, and the 8x scale defaults.
---

# Clouds

| Setting | UI | Default |
| --- | --- | --- |
| `bottomIdx` = clouds | BOTTEN: MOLN (seafloor of clouds) | clouds |
| `floorCloudsAnimated` | ANIMERA MOLN | off |
| `midCloudsOn`, `midCloudsHeight` | MELLAN-MOLN, MOLNHÖJD | off |
| `skyCloudsOn`, `skyCloudsAltitude` | HIMMEL-MOLN, HIMMEL-MOLNHÖJD (100–5000 m) | off, 1000 |
| `bottomCloudsScale`, `skyCloudsScale` | BOTTENMOLN SKALA, HIMMELSMOLN SKALA (0.25–8) | **8**, **8** |
| `bottomClouds3d`, `midClouds3d`, `skyClouds3d` | BOTTENMOLN 3D (only with BOTTEN = MOLN), MELLANMOLN 3D, HIMMELSMOLN 3D | |
| `skyPuffsOn`, `skyPuffsCount/Size/Freq/Opacity` | ENSKILDA MOLN | off |
| `cloudFadeSpeed` | MOLN-TONINGSHASTIGHET | 3 |
| `worldBoundaryYExtend` | OÄNDLIGA MOLNLAGER | off |

**Files:** flat decks are `ShaderMaterial`s in the mount effect of `index.tsx`
(`midCloudMat`, `skyCloudMat`, `tornadoCloudMat`, the floor). 3D layers are
`lib/clouds3d.ts`: instanced camera-facing "puff" impostors in cumulus clusters,
one draw call per layer, wrapped in a tile around the camera in the vertex
shader so the field is endless.

**How it works:** every deck recentres on the camera; MOLN TONING eases
opacity instead of popping. Sky puffs run their own fade-in/hold/fade-out
timers. With OÄNDLIGA MOLNLAGER, more copies of the sky layer are stacked
every `EXTEND_CLOUD_LAYER_SPACING` (500 m) as you climb.

The 8× scale defaults came from soarfulness #11 / aqua-wave-dream #223
(both merged); see [Defaults](defaults.md).
