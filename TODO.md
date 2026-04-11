# Yazd TODO

Priorities are ordered to match the vision: user-facing workflow setup and publishing UX live in Yazd, while source runtimes stay external and boring.

## P0

- [x] Add a minimal Tauri shell so Yazd has a real local-first desktop surface.
- [x] Persist only essential setup state locally: knowledge-base target, agent selection, and optional Gran runtime endpoint.

## P1

- [x] Build a focused UI around setup, review queue, publish planning, and a short roadmap.
- [x] Replace mocked dashboard data with plugin-backed source, review, and publish pipelines.
- [x] Implement an operational `PI Agent` adapter behind `YazdAgentPlugin` so the selected agent produces a reviewable draft.

## P2

- [x] Validate vault and folder targets against real filesystem/plugin checks before saving.
- [x] Turn review rows into real actions: approve, reject, publish, rerun.
- [x] Add real Gran runtime discovery and ingestion through local seams, while keeping a local sample fallback when no runtime is configured:
  - local HTTP for fetch/index status
  - event streams or polling for change notifications
  - runtime-owned Granola auth and sync, with Yazd consuming normalized artifacts
- [x] Promote the desktop bootstrap/state contract into a stable shared module once the runtime shape stops moving.
