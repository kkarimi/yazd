# Yazd

Local-first knowledge automation building blocks.

This repo starts with `@kkarimi/yazd-core`, a small TypeScript package that defines:

- source plugin contracts
- knowledge-base plugin contracts
- agent plugin contracts
- artifact bundles
- publish preview/result models

The goal is to let tools like Gran plug into a generic PKM automation runtime instead of owning the entire automation stack themselves.

## Desktop app

This repo now also includes a minimal Tauri desktop shell for Yazd.

- `npm run tauri:build -- --debug` builds the desktop app locally.
- `npm run tauri:dev` runs the desktop app against the local frontend dev server.
- `TODO.md` tracks the current prioritized rollout, including the near-term `PI Agent` adapter and the longer-term Gran runtime seam.

The desktop UX is intentionally small:

- choose the knowledge-base target
- choose the agent
- inspect the review queue and publish plan
- keep Gran integration behind a local runtime seam instead of direct source coupling

The current desktop runtime also supports:

- local filesystem validation before saving knowledge-base paths
- actionable review rows for approve, reject, rerun, and publish
- local publish writes into the selected vault or folder
- Gran runtime discovery over local HTTP, with event-stream or polling refresh when available
