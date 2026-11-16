---
slug: /
sidebar_position: 1
title: Start here
description: What Aquafulness and Soarfulness are, how the two repositories relate, and where to look first.
---

# Aquafulness developer docs

Aquafulness is a calming WebGL ocean. The camera is a bather floating in
warm water and rocking on the waves; everything else (weather, clouds,
fireworks, rides, a hood around the face) is layered on top of that one
floating camera. It is built with **three.js**, **React 19** and
**TanStack Start**, started in Lovable, and ships as a web app/PWA and as a
Capacitor Android app.

These docs are written for the next person, or agent, who has to change the
code. They describe the code as it is on `main`, name real files and
functions, and list the traps that earlier work ran into.

## Two repositories, one codebase

The same app lives in two repositories that are kept in sync feature by
feature:

| Repo | App name | Public URL | Notes |
| --- | --- | --- | --- |
| [`drsounds/soarfulness`](https://github.com/drsounds/soarfulness) | Soarfulness | `soarfulness.app.spacify.se` (self-hosted), `soarfulness.lovable.app` | Usually ahead. New features land here first. This docs site lives here. |
| [`drsounds/aqua-wave-dream`](https://github.com/drsounds/aqua-wave-dream) | Aquafulness ("Aquafulness Core") | `aqua-wave-dream.lovable.app` | Same `src/` plus an **EXPERIMENTELLT LÄGE** gate on the advanced modes. Many features are still in open PRs. |

See [Repositories and branches](getting-started/repos.md) for exactly how
they differ.

## Read in this order

1. [Repositories and branches](getting-started/repos.md): which repo to touch, PR rules, Lovable.
2. [Architecture overview](architecture/overview.md): the folder map and the one big component.
3. [The settings pipeline](architecture/settings-pipeline.md): how a setting goes from
   `DEFAULTS` to the render loop, localStorage, presets and share links. Almost every
   feature is "some settings + a scene effect", so this is the page that matters most.
4. [The render loop](architecture/render-loop.md): the three.js scene, the `animate()` frame and
   how scene effects in `src/lib/sceneFx/` plug into it.
5. [Add a setting](guides/add-a-setting.md) and [Add a scene effect](guides/add-a-scene-effect.md):
   step-by-step checklists that follow the existing features.
6. [Feature index](reference/feature-index.md): every feature, its Swedish UI name, its
   setting ids, its files and its status in each repo.

## The shape of the code in one paragraph

Nearly all runtime state lives in **one React component**, `Aquafulness()` in
`src/routes/index.tsx` (about 16 000 lines). It holds every setting as a
`useState`, mirrors each into a `useRef` for the render loop, builds the
three.js scene once in a mount effect and runs a single `animate()` loop.
Settings are typed by `Persisted` in `src/lib/settingsShared.ts`; their first-start
values are `DEFAULTS` in `index.tsx`. The settings UI is one large
`SettingsPanel.tsx` (about 6 000 lines) split into groups by
`settingsNav.tsx`. Self-contained effects (snow, aurora, fireworks, hood, string
lights, …) live as classes in `src/lib/sceneFx/` and are constructed in the
mount effect, updated once per frame and disposed on unmount. Content such as
3D scenes and skyboxes is data under `public/apps/<appId>/` with JSON
manifests.

:::caution A refactor is under way
A separate piece of work is moving features into a plugin-based `apps/`
folder with per-app manifests. When it lands, the architecture pages here
change. See [Apps: the plugin architecture](architecture/plugin-refactor.md) for the new structure (soarfulness PR #52, aqua-wave-dream PR #250).
:::

## Naming conventions you will see everywhere

- **Swedish UI labels in capitals** (`SNÖ`, `NORRSKEN`, `HAVSDRIFT`, `HUVA`) are how
  features are named in the UI, in code comments and in PR titles. Grep for the
  label to find every place a feature touches. The [glossary](reference/glossary.md)
  translates them.
- **Setting ids** are camelCase English with a feature prefix (`snowAmount`,
  `auroraPalette`, `hoodCuffColor`). Ids are never renamed once shipped, because
  saved settings, presets and share links store them. (RIDE is still
  `freakOut*` internally for that reason.)
- **localStorage keys** look like `aquafulness:<name>:v1`. See
  [Storage keys](reference/storage-keys.md).

## The theory docs

The background of the project (digital bathing, seeding, the sine
oscillation, optic flow and vection) is in the repo's top-level `docs/`
folder and is published here under [Theory](/theory). It is
the "why"; these developer docs are the "how".
