# Sora-MissionControl Migration Notes

Status: Phase 0 reuse map.

Primary source: `/home/wliob/projects/Sora-MissionControl/shared/phase0-biscuit-v2-reuse.md`.

## Reuse boundary

Reuse the Hermes 3D Office v2 engine and assets. Do not reuse the standalone app shell.

## Copy with minimal changes

- `/home/wliob/projects/hermes-3d-office-v2/src/engine/iso.ts`
- `/home/wliob/projects/hermes-3d-office-v2/src/engine/pathfinding.ts`
- `/home/wliob/projects/hermes-3d-office-v2/src/engine/AgentStateMachine.ts`
- `/home/wliob/projects/hermes-3d-office-v2/src/entities/Agent.ts`
- `/home/wliob/projects/hermes-3d-office-v2/src/entities/AgentController.ts`
- `/home/wliob/projects/hermes-3d-office-v2/src/engine/GameRuntime.ts`
- `/home/wliob/projects/hermes-3d-office-v2/public/assets/atlases/`
- FSM tests and mock event stream where useful.

## Required changes

1. Replace hardcoded `ATLAS_BASE = '/assets/atlases/'` with `assetBaseUrl` config.
2. Rebuild React wrapper as MissionControl `<OfficeCanvas/>` using refs/callback props.
3. Keep FSM inside office module; shared backbone calls `applyBoardSnapshot(board)` and `applyWsEvent(event)`.
4. Add dev warnings for failed spritesheet fetches; v2 silently falls back to static sprites.
5. Verify embedded panel sizes, not just full viewport.
6. Pin compatible runtime deps: PixiJS v8, XState v5, `@use-gesture/react` v10 if reused.

## Do not copy

- `src/components/OfficeShell.tsx`
- `src/components/CanvasHost.tsx` as-is because it uses `window.__*` globals.
- `src/components/AuthGate.tsx`, `TokenEntryScreen.tsx`, `SplashValidator.tsx`.
- `src/components/TopBar.tsx`, `ConnectionPill.tsx`, `ReconnectBanner.tsx`, `ToastStack.tsx`, `RoomTabs.tsx`, `DebugHUD.tsx`.
- `src/stores/authStore.ts`, `connectionStore.ts`, standalone `boardStore.ts` as-is.
- `src/api/client.ts`, `src/api/ws.ts`, `src/hooks/useAgentSync.ts`.
- `server/index.ts` token-scraping/proxy pattern.
- `src/main.tsx`, `src/App.tsx`.

## Known v2 plan-vs-code divergence

- Plan says GSAP drives movement; code uses manual per-tick lerp.
- Plan describes smooth reconnect catch-up; code does not implement it.
- Long-press/follow exists partially, but embedding must verify behavior.
- v2 API client uses same-origin proxy paths; MissionControl must use Cloud-owned verified adapters.

## Verification checklist before Phase 2

1. Asset path: `fetch(assetBaseUrl + 'furniture-0.json')` returns 200 in Vite dev.
2. Type compatibility: v2 `Task`, `Board`, `WsEvent` match real Kanban API shape from `docs/api-reference.md`.
3. FSM tests pass in office module without stores/API.
4. GameRuntime smoke: init in a bare div, render floor/furniture/5 agents, FPS > 0, destroy cleanly.
5. Embedded render: 600x400 and full-screen panels fit/resize correctly.
6. Activity injection: Cloud moves between workstations and break room without REST/WS.
7. Reduced motion: teleport/fade behavior works.
8. Memory leak: init/destroy 10x without orphaned textures/DOM.
9. Version pin: PixiJS/XState/use-gesture install cleanly.
10. Contract freeze: `OfficeModuleApi` from `docs/section-contracts.md` is the binding interface.
