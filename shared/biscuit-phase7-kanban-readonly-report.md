# Biscuit Phase 7a — Kanban / Project Control Read-only Report

Date: 2026-06-21
Project: Sora-MissionControl
Workdir: `/home/wliob/projects/Active/Sora-MissionControl`

## Scope completed

Phase 7a delivered a tight read-only Project Control surface in place of the reserved Kanban EmptyView route.

Completed:
1. Replaced the shell Kanban placeholder with a real `ProjectControlSurface` on wide/medium/narrow layouts.
2. Added read-only overview, ownership, status-lane, blocker, source-health, and selected-task drawer-shell panels.
3. Added typed read-only boundary:
   - `src/types/project-control.ts`
   - `src/state/projectControlStore.ts`
4. Preserved honesty rules:
   - unavailable/unknown/stale states never render as healthy
   - comments/runs/logs stay explicitly unavailable until a verified read adapter exists
   - no dispatch/decompose/reclaim/terminate mutations were implemented
   - action placeholders remain disabled with confirmation-copy stubs only
5. Added tests for route replacement, unhealthy-state honesty, read-only API surface, and mobile-safe shell rendering.

## Files changed

- `src/components/shell/ShellLayout.tsx`
- `src/components/kanban/ProjectControlSurface.tsx`
- `src/state/projectControlStore.ts`
- `src/types/project-control.ts`
- `src/types/index.ts`
- `src/state/projectControlStore.test.ts`
- `src/components/shell/ShellLayout.kanban.test.tsx`
- `AGENTS.md`
- `OVERVIEW.md`

## Verification

Commands run:

```bash
npm run test -- src/state/projectControlStore.test.ts src/components/shell/ShellLayout.kanban.test.tsx
npm run test
npm run build
```

Results:
- Targeted Phase 7a tests: passed
- Full test suite: `584 passed`
- Build: passed (`tsc -b && vite build`)

Notable build note:
- Vite still reports an existing large-chunk warning on the production bundle; build completed successfully.

## Read-only boundary notes

`projectControlStore` intentionally exposes read-only state sync and selection only.
It does not expose browser DB/filesystem mutation paths, and it does not implement Kanban mutations.

Task-detail behavior in this checkpoint:
- Board snapshot data is shown when available.
- Comments/runs/logs remain `unavailable` without a verified read adapter.
- Adapter failures flow into `lastError` and keep the drawer visibly unhealthy.

## Remaining follow-up

1. Bind verified read adapters for task comments/runs/logs.
2. Add office/chat/current-work cross-links.
3. Add confirmation-gated Kanban mutations through verified backend paths only.

## Notes

- Repository folder is not currently a Git repository, so verification relied on direct file inspection plus test/build execution rather than git diff/status.
- Attempted external Codex review was blocked by CLI auth (`401 Unauthorized`), so final verification relied on local test/build results and manual inspection.
