---
title: Deployment and CI
description: Where the app runs, what each GitHub Actions workflow does, and how this docs site is published.
---

# Deployment and CI

## Where the app runs

| Target | How |
| --- | --- |
| Lovable hosting (`soarfulness.lovable.app`, `aqua-wave-dream.lovable.app`) | Lovable builds from the connected branch. Only Lovable's hosting serves the `/__l5e/assets-v1/…` URLs that `src/assets/*.asset.json` point at. |
| Self-hosted soarfulness (`soarfulness.app.spacify.se`) | `.github/workflows/deploy.yml`, below |
| Docker | `Dockerfile` / `docker-compose.yml`, Nitro `node-server` preset; `docker-image.yml` publishes multi-arch images to GHCR when run by hand |
| Android | Capacitor app in `android/`, see [Native and offline](../architecture/native-and-offline.md) |

## Workflows (soarfulness)

| Workflow | Trigger | What it does |
| --- | --- | --- |
| `deploy.yml` (**Deploy**) | push to `main`, manual | Runs on a self-hosted runner labelled `soarfulness` on the server. Resets the checkout at `/www/docs/soarfulness` to `origin/main`, `bun install --frozen-lockfile`, `bun run build:prod`, restarts `soarfulness.service` and checks the port answers. "GitHub build error" reports usually mean this run. |
| `docs.yml` (**Docs**) | push to `main` touching `website/**`, `docs/**` or the workflow, manual | Builds this Docusaurus site and publishes it to GitHub Pages. Does not touch the app deploy. |
| `docker-image.yml` | `workflow_dispatch` only | Builds and publishes the multi-arch container image to GHCR (the README still says it runs on every push; it no longer does) |
| `capacitor-android-build.yml`, `publish-capacitor-web-bundle.yml`, `native-android-build.yml` | `workflow_dispatch` only | Android builds and the offline web bundle release. Kept manual to save Actions minutes (decided 2026-10-23). |
| `build-capacitor-web-bundle.yml` | `workflow_call` | Reusable job the two Capacitor workflows call to build the offline web bundle |

aqua-wave-dream has the same Android/Docker workflows but no Deploy. The only
automatic PR check seen there is "GitGuardian Security Checks", which comes
from the GitGuardian GitHub App (turned off in GitHub's installed-apps
settings, not in code).

### PWA precache limit

`vite-plugin-pwa` (injectManifest) refuses to precache files over 2 MiB by
default. On 2026-11-16 the main chunk reached 2.12 MB and the Deploy build
failed; soarfulness PR #51 raised
`injectManifest.maximumFileSizeToCacheInBytes` to 8 MiB in `vite.config.ts`.
aqua-wave-dream's `vite.config.ts` still has the default and will hit the same
error as its bundle grows.

## Publishing this docs site

`.github/workflows/docs.yml` builds `website/` with Node 20 and `npm ci`, then
deploys `website/build` with `actions/deploy-pages`. The site is served at
`https://drsounds.github.io/soarfulness/` (`baseUrl: "/soarfulness/"` in
`website/docusaurus.config.ts`).

One-time setup in the repository: **Settings → Pages → Build and deployment →
Source: GitHub Actions**. Until that is set the deploy job fails with a
"Pages not enabled" error while the build job still passes.
