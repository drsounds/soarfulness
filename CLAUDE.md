# Repo instructions for Claude Code

- Whenever you push commits to a branch in this repo, always open a pull request for it (unless one already exists for that branch) — don't wait to be asked. Use `main` as the base branch unless told otherwise.
- Features live as apps under `src/apps/<id>/` (manifest.json, settings.ts, app.ts, one class per file). Read `docs/architecture/apps.md` before adding or moving a feature; put new features in a new app folder, not in `src/lib/sceneFx/`.
