---
title: Local development
description: Installing, running, building and testing the app, plus the quirks of the cloud sandbox.
---

# Local development

## Stack

| Piece | What it is |
| --- | --- |
| Framework | [TanStack Start](https://tanstack.com/start) (React 19, file-based routing in `src/routes/`, SSR via Nitro) |
| Bundler | Vite 8 with `@lovable.dev/vite-tanstack-config`, Tailwind CSS 4, `vite-plugin-pwa` (injectManifest, service worker in `src/sw.ts`) |
| 3D | three.js 0.185 (`WebGLRenderer`, `EffectComposer` post-processing, custom `ShaderMaterial`s) |
| UI kit | shadcn/ui on Radix (`src/components/ui/`), lucide icons |
| i18n | i18next with five locales in `src/locales/` |
| Tests | `bun test` (`*.test.ts` next to the code they test, for example `src/lib/wind.test.ts`) |
| Native | Capacitor 8 Android project in `android/`; an experimental Expo port in `native/` |

## Commands

```bash
bun install            # or npm install, see below
bun run dev            # vite dev server
bun run build          # default build (Cloudflare Workers target, used by Lovable)
bun run build:prod     # NITRO_PRESET=standard, the self-hosted build that serve.mjs runs
bun run start          # bun serve.mjs, PORT (3000) and HOST (0.0.0.0)
bun run build:capacitor  # node-server build + offline shell snapshot for the Android app
bun test               # unit tests
bun run lint
```

`tsconfig.json` only includes `src/`, `vite.config.ts` and `eslint.config.js`,
and excludes `*.test.ts` (bun's test types aren't installed). Expect some
pre-existing `tsc` errors from missing modules when dependencies only
partly installed; compare error counts before and after a change instead of
aiming for zero.

## Installing in the cloud sandbox

The cloud sandbox's proxy blocks some package sources:

- soarfulness's `bun.lock` points at a private `*-npm.pkg.dev` mirror that is
  blocked. Workaround: temporarily `sed` those URLs to `registry.npmjs.org`,
  run `bun install --frozen-lockfile`, then `git checkout bun.lock`.
  Plain `npm install` (no lockfile) also works.
- aqua-wave-dream's `package-lock.json` is out of sync: use
  `npm install --no-save --package-lock=false`.
- Shared code can be tested in either repo; aqua-wave-dream is usually the
  easier one to install.

## Running headless

A headless Chromium with SwiftShader can drive the app for screenshots and
checks. See [Testing and screenshots](../guides/testing-and-screenshots.md)
for the localStorage seeds that skip the cookie banner and put the camera
where you need it.

## The docs site

This site lives in `website/` and has its own `package.json`
(Docusaurus 3, npm):

```bash
cd website
npm ci
npm start        # live preview at http://localhost:3000/soarfulness/
npm run build    # static site in website/build
```

It is independent of the app's dependencies and build.
