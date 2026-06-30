# Biscuit reset 03 — shell rebuild report

Date: 2026-06-22
Focus card: `smc-reset-03-biscuit-shell-rebuild`
Project root: `/home/wliob/llm-brain/Projects/Active/Sora-MissionControl`

## Summary
Rebuilt the Mission Control app shell around the Hermes dashboard `/kanban` contract:
- left rail now mirrors the Hermes IA/profile roster
- top header now shows only active page context/status
- `/kanban` now renders a dedicated Hermes-style board surface with the built-in Office panel docked on the right on desktop
- live data/auth states stay honest; no fake board snapshot is injected when the Hermes bridge is unavailable or unauthorized
- Mission Control now defaults dashboard API traffic to the local proxy bridge instead of assuming direct `:9119` browser access
- the Node proxy now forwards `/api/plugins/kanban*` requests to Hermes so the app can use same-host bridge semantics
- package-manager truth is now explicit in `package.json` via `"packageManager": "pnpm@11.7.0"`; I did not speculate on `pnpm-workspace.yaml` package globs because the root-level pnpm repro no longer fails in the current tree

## Contract reconciliation implemented
1. Shell IA
   - Added Hermes brand lockup (`HERMES` / `AGENT`)
   - Added profile roster order:
     `this dashboard (default)`, `biscuit`, `cloud`, `korra`, `lelouch`, `rain`, `tifa`
   - Added core nav order:
     `CHAT`, `SESSIONS`, `FILES`, `MODELS`, `LOGS`, `CRON`, `SKILLS`, `PLUGINS`, `MCP`, `CHANNELS`, `WEBHOOKS`, `PAIRING`, `PROFILES`, `CONFIG`, `KEYS`, `SYSTEM`, `DOCUMENTATION`
   - Added plugin nav order:
     `KANBAN`, `ACHIEVEMENTS`
   - Added footer labels:
     `Gateway Status`, `Active Sessions`, `Theme Switch`, `Language Switch`

2. `/kanban` surface
   - Added dedicated `HermesKanbanPage` surface with:
     - `Board` header
     - `Default` board selector
     - docs `?` link
     - `+ New board` button
     - `Orchestration: Auto`
     - `SEARCH`, `TENANT`, `ASSIGNEE`
     - `Show archived`, `Lanes by profile`
     - `Nudge dispatcher`, `Refresh`, `Clear filters`
   - Lane stack preserves first Hermes lane order and keeps the board honest even when empty/unavailable.
   - Office panel is embedded as a right-hand desktop rail instead of a separate full-page mode.

3. Honest live-state handling
   - REST status text now explicitly differentiates live / unauthorized / offline / waiting states.
   - WebSocket bridge handling no longer mislabels every missing-event-path condition as auth failure.
   - `/kanban` explicitly states that no demo board is shown when auth/bridge is missing.

4. Proxy/auth wiring
   - `dashboardClient` now resolves to the Mission Control proxy bridge by default.
   - `missionControlProxy.js` now proxies `/api/plugins/kanban*` to Hermes dashboard upstream.
   - Browser-side event URL creation now refuses the Mission Control proxy path instead of pretending a websocket bridge exists there.

## Files changed for this reset slice
- `src/components/kanban/HermesKanbanPage.tsx`
- `src/components/shell/ShellLayout.tsx`
- `src/components/shell/MissionBar.tsx`
- `src/styles/theme.css`
- `src/services/hermes/dashboardClient.ts`
- `src/state/backbone.ts`
- `missionControlProxy.js`
- `src/components/shell/ShellLayout.kanban.test.tsx`
- `src/components/shell/MissionBar.test.tsx`
- `src/services/hermes/dashboardClient.test.ts`
- `src/services/hermes/missionControlProxy.test.ts`
- `tests/e2e/mission-control.spec.ts`
- `package.json`

## Verification
### Package-manager truth check
Current root config files:
- `pnpm-workspace.yaml`
  ```yaml
  allowBuilds:
    esbuild: true
  ```
- `package.json`
  - now pins `"packageManager": "pnpm@11.7.0"`

Why this follow-up did not edit `pnpm-workspace.yaml`:
- Sora reported a prior root-level pnpm failure: `ERROR packages field missing or empty`.
- I could not reproduce that failure in the current tree from the project root.
- Adding a speculative workspace `packages:` glob without a live failing repro would change workspace membership semantics for no demonstrated gain.
- Instead, I pinned the verified pnpm version in `package.json` and re-ran the exact pnpm commands from root.

Command:
`pnpm --version`

Output:
```text
11.7.0
```

### Targeted pnpm Vitest rerun
Command:
`pnpm exec vitest run src/components/shell/ShellLayout.kanban.test.tsx src/components/shell/MissionBar.test.tsx src/services/hermes/dashboardClient.test.ts src/services/hermes/missionControlProxy.test.ts`

Output:
```text
RUN  v4.1.9 /home/wliob/llm-brain/Projects/Active/Sora-MissionControl

 ✓ src/services/hermes/missionControlProxy.test.ts (25 tests) 20ms
 ✓ src/components/shell/MissionBar.test.tsx (1 test) 79ms
 ✓ src/services/hermes/dashboardClient.test.ts (4 tests) 14ms
 ✓ src/components/shell/ShellLayout.kanban.test.tsx (2 tests) 183ms

 Test Files  4 passed (4)
      Tests  32 passed (32)
   Duration  2.48s
```

Cross-check against Sora's alternate invocation:
Command:
`npx vitest run src/components/shell/ShellLayout.kanban.test.tsx src/components/shell/MissionBar.test.tsx src/services/hermes/dashboardClient.test.ts src/services/hermes/missionControlProxy.test.ts`

Output:
```text
RUN  v4.1.9 /home/wliob/llm-brain/Projects/Active/Sora-MissionControl

 Test Files  4 passed (4)
      Tests  32 passed (32)
   Duration  2.46s
```

### pnpm build rerun
Command:
`pnpm build`

Output:
```text
$ tsc -b && vite build
vite v6.4.3 building for production...
✓ 822 modules transformed.
dist/assets/index-CY2XUeYp.js               676.26 kB │ gzip: 209.47 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 7.71s
```

### Additional npm / npx corroboration
These are relevant because Sora's verification used npm/npx rather than pnpm.

Command:
`npx tsc --noEmit`

Output:
```text
(no stdout/stderr; exit 0)
```

Command:
`npm run build`

Output:
```text
> sora-missioncontrol@0.1.0 build
> tsc -b && vite build

✓ built in 7.77s
```

Command:
`npm test -- --run`

Output summary:
```text
> sora-missioncontrol@0.1.0 test
> vitest run --run

 Test Files  41 passed (41)
      Tests  648 passed (648)
   Duration  14.28s
```

Notes from the real full-suite output:
- Existing office regression stderr still appears for atlas URL parsing guardrails.
- Existing `OfficeErrorBoundary` stderr still appears in the dedicated error-boundary tests.
- Existing multi-instance guard warning still appears in `instanceGuard.test.ts`.
- None of those stderr lines failed the suite.

Command:
`npm run test:e2e`

Output summary:
```text
> sora-missioncontrol@0.1.0 test:e2e
> playwright test

  2 skipped
  2 passed (23.1s)
```

Why 2 skipped:
- desktop-only proof is skipped on the mobile project
- mobile-only proof is skipped on the desktop project

Artifacts:
- `/home/wliob/llm-brain/Projects/Active/Sora-MissionControl/shared/e2e-chromium-desktop-kanban-shell-proof.png`
- `/home/wliob/llm-brain/Projects/Active/Sora-MissionControl/shared/e2e-chromium-mobile-kanban-mobile-proof.png`

## Current observed live-state behavior in browser proof
In the captured desktop proof, the page rendered the non-demo Hermes shell correctly and showed an honest unauthorized Kanban REST state through the proxy bridge. That is acceptable for this reset slice because the UI does not fabricate board data when live auth is unavailable.

## Repo-state note
The repository already had many unrelated modified/untracked files before this reset slice. The file list above is the focused set touched for this shell rebuild work.
