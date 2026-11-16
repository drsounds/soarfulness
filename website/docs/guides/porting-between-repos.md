---
title: Port a feature between the repos
description: How features are mirrored between soarfulness and aqua-wave-dream with anchor-based patch scripts, and how to resolve the usual conflicts.
---

# Port a feature between the repos

Most features ship as twin PRs with the same branch name in
`drsounds/soarfulness` and `drsounds/aqua-wave-dream`.

## 1. Check the target first

- Does the target `main` already have the feature, or its prerequisites?
  Aqua-wave-dream lags; for example its `main` lacked confetti/fireworks when
  NORRSKEN and HUVA were ported, so their render hooks anchored on other lines.
- Is the feature an advanced mode? In aqua-wave-dream gate it on
  EXPERIMENTELLT LÄGE.

## 2. Copy the self-contained files

New files under `src/lib/`, `src/lib/sceneFx/`, `src/components/` usually
copy over byte for byte (`rain.ts` is identical in both repos). Keep it that
way, so later fixes also copy.

## 3. Apply the `index.tsx` / `SettingsPanel.tsx` / locale changes with an anchor script

Rather than hand-editing 10+ places twice, write a small script (Python or
Node) that, for each list in [the settings pipeline](../architecture/settings-pipeline.md),
finds an **anchor line** that exists in both repos and inserts the new lines
after it:

```python
import re, pathlib
p = pathlib.Path("src/routes/index.tsx")
s = p.read_text()

def after(anchor_regex, insert, count=1):
    global s
    m = list(re.finditer(anchor_regex, s, re.M))
    assert len(m) >= count, f"anchor not found: {anchor_regex}"
    for match in reversed(m[:count]):
        end = s.index("\n", match.end()) + 1
        s = s[:end] + insert + s[end:]

after(r"^  snowCoverStrength: [\d.]+,$", "  rainbowOn: false,\n  rainbowStrength: 1,\n")   # DEFAULTS
# … state, refs, snapshot, deps, reset, applySettingsPatch, props …
p.write_text(s)
```

Anchors that have worked well: the `snowCoverStrength` / `snowGrayBackdropOn`
lines (weather), `neonAccentColor` lines, `surgeRotationSpeed` lines,
`new Aurora(scene)`, the `NeonEdges` import, the VATTENGLÖD uniforms, the
VÄRLDSGRÄNS wrap comment, `extremeLimits` in the clamp effect.

Choose anchors **that open PRs don't also insert after**, or the two PRs
conflict on the same line. (NORRSKEN moved its insertions off the lines
KONFETTI and FYRVERKERI touched for this reason.)

## 4. Merge, don't rebase

When `main` moves under an open branch, `git merge origin/main` into it.
Never rebase or force-push (Lovable sync). If a merge conflicts badly in
`index.tsx`, take `main`'s version of the conflicted file and re-run your
anchor script, possibly with different anchors.

## 5. Twin PRs

Name both PRs the same, reference each other's number, and keep the
descriptions in step. Record the PR numbers in the
[feature index](../reference/feature-index.md).

## Soartify/soarfulness

Work in the old `Soartify/soarfulness` repo can't be in the same cloud session
as `drsounds/soarfulness`. Move commits with `git format-patch` into a shared
folder and `git am` them in a session holding the target.
