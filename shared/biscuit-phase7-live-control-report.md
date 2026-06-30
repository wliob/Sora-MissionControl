# Biscuit Phase 7 — Live Project Control Rerun Report

Date: 2026-06-21
Project: Sora-MissionControl
Workdir: `/home/wliob/projects/Active/Sora-MissionControl`
Mode: Biscuit native Hermes tools/model only (no Codex, no Claude Code, no OpenCode)

## Scope completed

This rerun finished the feasible Phase 7 live-read and safe-mutation work without reworking the existing Phase 6 admin proxy.

Completed:
1. Verified current Phase 7 source files before editing:
   - `OVERVIEW.md`
   - `AGENTS.md`
   - `src/types/project-control.ts`
   - `src/state/projectControlStore.ts`
   - `src/services/hermes/dashboardClient.ts`
   - `src/services/hermes/projectControlAdapter.ts`
   - `src/components/kanban/ProjectControlSurface.tsx`
2. Extended the project-control domain model to carry real run metadata and task-log metadata.
3. Upgraded `HermesProjectControlAdapter` so verified `/api/plugins/kanban` task detail/run/log routes now normalize:
   - comment threads
   - run records (including nested `/runs/{id}` payload shape)
   - log payloads that return `content`, `path`, `exists`, and `size_bytes`
   - diagnostics from live task detail payloads
4. Fixed timestamp normalization so the adapter handles both epoch-seconds and epoch-milliseconds honestly.
5. Updated `projectControlStore` to preserve adapter-supplied diagnostics/log metadata while keeping unavailable/default states explicit.
6. Upgraded `ProjectControlSurface` selected-task drawer from counts-only placeholders to real live detail rendering for:
   - comments
   - run history/status
   - log preview + file metadata
   - diagnostics payloads
7. Kept all mutations inside verified adapter routes only:
   - `POST /api/plugins/kanban/dispatch`
   - `POST /api/plugins/kanban/tasks/{task_id}/decompose`
   - `POST /api/plugins/kanban/tasks/{task_id}/reclaim`
   - `POST /api/plugins/kanban/runs/{run_id}/terminate`
8. Preserved honesty rules:
   - no direct browser DB/filesystem writes
   - disabled states remain explicit when adapter/source health/id requirements are missing
   - unsupported/unknown payloads stay unavailable or unknown instead of looking healthy
9. Added regression coverage for adapter normalization, verified mutation route binding, store hydration, and mutation provenance.

## Files changed

Code/tests:
- `src/components/kanban/ProjectControlSurface.tsx`
- `src/services/hermes/projectControlAdapter.ts`
- `src/services/hermes/projectControlAdapter.test.ts`
- `src/state/projectControlStore.ts`
- `src/state/projectControlStore.test.ts`
- `src/types/project-control.ts`

Project docs/reporting:
- `AGENTS.md`
- `OVERVIEW.md`
- `shared/biscuit-phase7-live-control-report.md`

## Verification

Commands run:

```bash
npm run lint
npm test -- --run
npm run build
```

Results:
- `npm run lint` ✅
  - `tsc --noEmit` clean
- `npm test -- --run` ✅
  - `29 passed` test files
  - `591 passed` tests
- `npm run build` ✅
  - `tsc -b && vite build`
  - production build completed successfully

Build note:
- Vite still reports the pre-existing large chunk warning for `dist/assets/index-*.js` (>500 kB after minification). Build still succeeded.

## Kanban update

Posted a verified Kanban comment to:
- `smc-phase8-kanban-control`

Comment summary:
- Native Biscuit rerun landed live task-detail reads and guarded supported mutation bindings.
- Reported verification results (`lint`, full test run, build).
- Noted remaining follow-up: selected-agent cross-links and any additional mutations still need explicit verification.

No task status change was forced in this pass because the broader Phase 7 card still has remaining follow-up work.

## Remaining blockers / follow-up

1. Selected-agent cross-links are still not wired between Kanban, office presence, and chat/current-work surfaces.
2. Additional Kanban mutations beyond dispatch/decompose/reclaim/terminate were not added because they were not explicitly verified in scope for this rerun.
3. Large-chunk Vite warning remains an existing build follow-up, not a blocker for this pass.

## Notes

- The earlier `shared/biscuit-phase7-kanban-readonly-report.md` is now historically superseded by this live-control rerun report.
- This pass intentionally did not use any external coding agent or CLI coding assistant.
