---
title: UI theme, blur and Liquid Glass
description: The UI chrome themes (aqua, scifi, spa, glass), the blur-off default, and the Liquid Glass settings.
---

# UI theme, blur and Liquid Glass

The look of the app's own controls (settings panel, dialogs, sticks, phone)
is separate from the scene settings.

- `src/lib/uiTheme.ts`: a store under `aquafulness:ui-theme:v1`,
  `useUiTheme()`. It is applied to `<html>` as `data-ui-theme`,
  `data-ui-blur` and CSS custom properties. `styles.css` has the
  "UI chrome design tokens" section.
- Themes: **aqua** (classic dark glass), **scifi** (glowing diode lines, own
  accent hue), **spa** (minimal white or black, turquoise gradient buttons,
  light/dark), **glass** (Liquid Glass).
- **Blur is off by default** for performance (GLASEFFEKT toggle).
- **Liquid Glass** sets `data-ui-blur="glass"` so the blur-off switch doesn't
  match it, and has its own blur, refraction (an SVG `url()` backdrop filter,
  Chromium only), tint, opacity, highlight and corner radius settings in
  `glass`.

:::warning CSS minifier trap
lightningcss collapses a `backdrop-filter` + `-webkit-backdrop-filter` pair in
one rule into whichever comes **last**. Put the `-webkit-` one first, or
Chrome loses the unprefixed declaration. This is why "blur off" silently did
nothing before soarfulness #47.
:::

Verify blur state headlessly by counting elements whose computed
`backdropFilter` isn't `none`.

**Status:** soarfulness #47 (merged). aqua-wave-dream #246 (open).
