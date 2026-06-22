# Phase 0 — Hermes 3D Office v2 Reuse Analysis

> Owner: Biscuit (Automation & Coding Lead)
> Date: 2026-06-18
> Source repo: `/home/wliob/projects/hermes-3d-office-v2`
> Target: `Sora-MissionControl/src/modules/office/`

This doc is the frozen reuse map and contract for the embedded 3D office.
It is derived from reading every source file in the v2 repo, not from the
PLAN.md alone. The plan and the code diverge in several places (noted below).

---

## 1. Reusable modules / files / assets

These are self-contained, have no coupling to the standalone app shell, and
can be copied into `src/modules/office/` with minimal changes.

### 1A. Engine core (copy as-is, zero changes expected)

| File | LOC | What it is | Dependencies | Reuse notes |
|------|-----|------------|--------------|-------------|
| `src/engine/iso.ts` | 183 | Isometric projection math, grid constants (16×12, 128×64 tiles), zone definitions, agent desk positions, furniture prop placements, world bounds | None (pure TS) | Copy verbatim. This is the single source of truth for the office layout. |
| `src/engine/pathfinding.ts` | 146 | A* pathfinder over the 16×12 grid with furniture obstacles | `iso.ts` only | Copy verbatim. Module-level `blockedGrid` cache is fine. |
| `src/engine/AgentStateMachine.ts` | 332 | Per-agent XState FSM: idle/moving/working/blocked/reviewing/celebrating. Consumes `SNAPSHOT` and `WS_EVENT`, emits zone + activity. | `xstate`, `types.ts` (Task, WsEvent) | Copy verbatim. This is office-domain logic and belongs to the office module. |

### 1B. Pixi rendering layer (copy with path fixups)

| File | LOC | What it is | Dependencies | Reuse notes |
|------|-----|------------|--------------|-------------|
| `src/entities/Agent.ts` | 465 | Pixi Container wrapper: shadow, body (AnimatedSprite), selection halo, speech bubbles, blocked FX, on-demand spritesheet loading, long-press/tap | `pixi.js`, `iso.ts` | Copy. **Fix:** hardcoded `ATLAS_BASE = '/assets/atlases/'` must become a constructor option or a module-level config set by GameRuntime. |
| `src/entities/AgentController.ts` | 312 | Drives movement (GSAP-free, uses per-tick lerp), wires FSM transitions to animations + speech bubbles, manages walk paths, reduced-motion teleport | `Agent`, `pathfinding`, `iso`, `AgentStateMachine` | Copy. Movement is done with manual per-tick interpolation (not GSAP tweens despite the plan claiming GSAP). Self-contained. |
| `src/engine/GameRuntime.ts` | 602 | The Pixi `Application` owner. Scene graph (floor/decor/agent/fx/label layers), atlas loading, floor/prop/label painting, camera (pan/zoom/fit/follow), resize observer, FPS counter, ticker-driven controller updates. `connectEvents()` is a no-op — event wiring is external. | `pixi.js`, `iso`, `Agent`, `AgentController` | Copy. **Fix:** hardcoded `ATLAS_BASE` must be configurable. The class already accepts `GameRuntimeOptions` (container, width, height, onSelectAgent, prefersReducedMotion) — good embed boundary. |

### 1C. Types (copy subset)

| File | What to copy | What to drop |
|------|--------------|--------------|
| `src/types.ts` | `Task`, `Column`, `Board`, `WsEventType`, `WsEvent`, `AgentName`, `AGENT_NAMES`, `AGENT_ACCENTS` | `AuthStatus`, `ConnectionStatus` — these belong to the shared state backbone, not the office module. |

### 1D. Assets (copy directly)

All assets are pre-generated and committed. No runtime MCP dependency.

| Path | Contents | Size |
|------|----------|------|
| `public/assets/atlases/furniture-0.{json,png,webp}` | Furniture atlas 0 (round table, couch, bookshelf, plant, rug, etc.) | ~280 KB webp |
| `public/assets/atlases/furniture-1.{json,png,webp}` | Furniture atlas 1 (desk, chair, monitor, coffee machine, whiteboard, kanban prop, etc.) | — |
| `public/assets/atlases/agents.{json,png,webp}` | Agent base + block frames for all 5 agents | ~420 KB webp |
| `public/assets/atlases/fx.{json,png,webp}` | FX atlas (emote_block, emote_sparkle, emote_thought) | ~80 KB webp |
| `public/assets/atlases/{agent}_{idle,walk,work,cheer}.{json,webp}` | Per-agent animation spritesheets (5 agents × 4 anims = 20 sheets) | included above |
| `public/assets/raw/*.png` | Raw source sprites (optional, for re-packing) | — |

Copy `public/assets/atlases/` into `src/modules/office/assets/atlases/` (or keep in `public/` if Vite serves it at the same path). The `ATLAS_BASE` path must point to wherever they land.

### 1E. Mock data (copy for dev/test)

| File | Reuse |
|------|-------|
| `src/mocks/handlers.ts` | MSW mock board (12 tasks, 5 agents, 4 columns) + scripted WS event stream cycling through all FSM transitions over ~3 min. Copy into `src/modules/office/mocks/` for offline dev and Playwright smoke tests. |
| `src/mocks/browser.ts` | MSW worker setup + patched WebSocket for mock event stream. Copy. |

### 1F. Tests (copy as reference)

| File | Reuse |
|------|-------|
| `src/engine/AgentStateMachine.test.ts` | FSM transition tests. Copy verbatim — tests the pure machine logic. |

---

## 2. Code to avoid copying

These are coupled to the standalone app shell, the standalone auth flow, or
the same-origin proxy server. Do NOT copy them into the office module.
Rebuild or consume from the shared state backbone instead.

| File | Why avoid | What to do instead |
|------|-----------|-------------------|
| `src/components/OfficeShell.tsx` | Full-screen standalone shell: TopBar, RoomTabs, CanvasHost, bottom status bar, ToastStack, DebugHUD. This IS the standalone app. | Build MissionControl's own shell. Embed the office as a module panel, not as the whole app. |
| `src/components/CanvasHost.tsx` | Bootstraps GameRuntime but communicates via `window.__gameRuntime`, `window.__followAgentId`, `window.__focusZone` globals. Fragile, not embed-safe. | Rebuild a thin `<OfficeCanvas/>` React wrapper that uses refs/callbacks, not window globals. The GameRuntime class itself is reusable (§1B). |
| `src/components/AuthGate.tsx` | Standalone token-entry auth flow. | MissionControl auth is Cloud-owned via the shared `authStore`. Office module must be auth-agnostic. |
| `src/components/TokenEntryScreen.tsx` | Standalone auth UI. | Same as above. |
| `src/components/SplashValidator.tsx` | Standalone splash + token validation. | Same. |
| `src/components/TopBar.tsx` | Standalone top bar with brand + connection pill + user menu. | MissionControl builds its own app-level chrome. |
| `src/components/ConnectionPill.tsx` | Standalone connection indicator. | Consume shared `connectionStore` in MissionControl's own status component. |
| `src/components/ReconnectBanner.tsx` | Standalone reconnect overlay. | MissionControl shell owns this. |
| `src/components/ToastStack.tsx` | Standalone toast system. | MissionControl should have a shared toast system. |
| `src/components/RoomTabs.tsx` | Standalone room navigation tabs. | Rebuild as an office-module-internal control or dashboard-level control per the visual system. |
| `src/components/DebugHUD.tsx` | Standalone debug overlay. | Rebuild if needed; not part of the embed. |
| `src/stores/authStore.ts` | Coupled to `localStorage` token + standalone dashboard URL + `browserSession.ts`. | Use MissionControl's shared `authStore` (Cloud-owned, Phase 3). Office module must not import auth. |
| `src/stores/connectionStore.ts` | Minimal but standalone-owned. | Use MissionControl's shared `connectionStore`. |
| `src/stores/boardStore.ts` | Board snapshot + `applyEvent` reducer. Coupled to `api/client.ts` via `fetchBoard`. | **Decision needed (see §4):** either (a) shared backbone owns boardStore and office consumes it, or (b) office owns boardStore and shared backbone pushes events to it. Recommendation: shared backbone owns it; office receives a derived agent-activity view. |
| `src/stores/agentStore.ts` | Owns FSM actors, imports `AGENT_DESKS` from `iso.ts`. This is office-domain. | **Copy into the office module** but strip the Zustand wrapper if the shared backbone is the event source. The FSM actor management is reusable; the store shape may change. |
| `src/api/client.ts` | Hardcoded to same-origin `/api/board` + `/api/auth` + `/api/auth-url`. Standalone proxy-specific. | Do not copy. MissionControl's data backbone builds its own API adapters per verified Hermes endpoints. |
| `src/api/ws.ts` | Hardcoded to same-origin `ws://{host}/api/events?token=`. Imports authStore, boardStore, connectionStore directly. | Do not copy. Shared backbone owns the WS connection. Office receives events via the contract in §4. |
| `src/hooks/useAgentSync.ts` | Orchestrates auth + board + ws + agent stores. Ties together standalone-specific stores and the WS client. | Do not copy. Build a new sync adapter at the shared-backbone level that feeds the office module via the §4 contract. |
| `src/lib/browserSession.ts` | Standalone SPA diagnostic/reset/clear-cache utilities. | Not needed in embedded context. |
| `server/index.ts` | Fastify server: scrapes dashboard HTML for session token, local password auth, same-origin REST + WS proxy. Standalone-deploy-specific. | Reference only. MissionControl's optional Fastify proxy (if any) is a separate concern owned by Cloud. The token-scraping trick is a workaround for the standalone deploy and should not be replicated — MissionControl should use proper auth. |
| `src/main.tsx`, `src/App.tsx` | Standalone app entry points. | MissionControl has its own app entry. |

---

## 3. Office module contract

The office module is a self-contained, embeddable 3D scene. It owns its
rendering and agent FSM logic. It does NOT own data transport, auth, or
connection health.

### 3A. Inputs

```
interface OfficeModuleInputs {
  // Mount target
  container: HTMLElement;
  width: number;
  height: number;

  // Asset location (replaces hardcoded ATLAS_BASE)
  assetBaseUrl: string;  // e.g. '/modules/office/assets/atlases/'

  // Accessibility
  prefersReducedMotion: boolean;

  // Live agent activity (the ONLY data input — see §4)
  agentActivity: AgentActivitySnapshot[];

  // Optional callbacks
  onSelectAgent?: (agentId: string | null) => void;
  onZoneFocus?: (zoneId: string | null) => void;
  onFpsUpdate?: (fps: number) => void;
}

interface AgentActivitySnapshot {
  agentId: string;        // 'cloud', 'biscuit', 'korra', 'lelouch', 'tifa'
  name: string;
  activity: 'idle' | 'moving' | 'working' | 'blocked' | 'reviewing' | 'celebrating';
  zone: 'home' | 'workstations' | 'collaboration' | 'break_room' | 'archive';
  task: { id: string; title: string; status: string; updatedAt: string } | null;
}
```

The office module receives agent activity as a pre-derived snapshot. It does
NOT receive raw Kanban board state or WS events directly. The shared
backbone (or a dedicated reducer) is responsible for computing
`AgentActivitySnapshot[]` from board state. This keeps the office module
free of board-store and WS-client dependencies.

Alternative (if FSM ownership stays in the office): the shared backbone
pushes raw `Board` snapshots and `WsEvent` events, and the office module's
internal `AgentStateMachine` actors derive activity. This is closer to the
v2 architecture. **Decision needed — see §4.**

### 3B. Outputs (emitted events)

| Event | Payload | When |
|-------|---------|------|
| `agentSelected` | `agentId: string \| null` | User taps an agent sprite or taps empty space. |
| `zoneFocused` | `zoneId: string \| null` | Camera focuses a zone (via room tabs or programmatic call). |
| `fpsUpdate` | `fps: number` | Once per second from the Pixi ticker. For the dashboard perf monitor. |
| `ready` | `void` | GameRuntime finished init + atlas load + first paint. |
| `error` | `message: string` | Pixi init failure (e.g. no WebGL). |

### 3C. Owned state

The office module exclusively owns:
- The Pixi `Application` instance and all scene graph layers (floor, decor, agent, fx, label)
- All `Agent` sprite containers and `AgentController` instances
- All `AgentStateMachine` XState actors (if FSM ownership is in the office)
- Camera state (x, y, zoom, follow target)
- Texture/spritesheet cache
- ResizeObserver lifecycle
- FPS counter

The office module does NOT own:
- Auth tokens or session state
- Board snapshot state
- WebSocket connection
- Connection health status
- Toast/notification state

### 3D. Forbidden dependencies

The office module MUST NOT import or reference:
- `authStore` or any auth-related store/service
- `connectionStore` or connection-health state
- `boardStore` (if the §4 decision is that the shared backbone owns board state)
- `api/client.ts`, `api/ws.ts`, or any HTTP/WS transport
- `localStorage`, `sessionStorage`, or browser session utilities
- `window.__*` globals for cross-component communication (the v2 CanvasHost does this — must be eliminated)
- Any other MissionControl module (chat, ops, admin, kanban) — the office is a leaf module
- The standalone `server/index.ts` or any server-side code

The office module MAY depend on:
- `pixi.js` (v8+)
- `xstate` (v5+) — if FSM ownership is in the office
- `@use-gesture/react` — for pinch/pan (or the dashboard shell handles gestures and calls `runtime.pan()`/`runtime.zoom()`)
- Shared type definitions (`Task`, `WsEvent`, `Board`) from `src/types/` or a shared types package

---

## 4. Data / event contract with Kanban and live state

### Current v2 flow (standalone)

```
Hermes REST /api/plugins/kanban/board
  → boardStore.fetchBoard(token, url)
  → agentStore.applySnapshot(board)  [sends SNAPSHOT to each FSM]
  → FSM derives zone + activity
  → AgentController subscribes → walks agent + plays animation

Hermes WS /api/plugins/kanban/events?token=…
  → WsClient.onEvent(event)
  → boardStore.applyEvent(event)  [updates board snapshot]
  → agentStore.applyEvent(event)  [sends WS_EVENT to relevant FSMs]
  → FSM transitions → AgentController → Pixi renders
```

### Proposed MissionControl flow

```
Shared backbone (Cloud-owned, Phase 3):
  Hermes REST + WS → api adapters → shared boardStore → connectionStore

Office module (Biscuit-owned):
  shared boardStore/boardEvents → office-internal reducer → AgentActivitySnapshot[]
    → GameRuntime.applyActivity(snapshots) → agent movement + animation
```

### Decision point: where does the FSM live?

**Option A — FSM in the office module (recommended, closest to v2):**
- The office module owns `AgentStateMachine` actors internally.
- The shared backbone pushes `Board` snapshots and `WsEvent` events to the office module via two methods: `applyBoardSnapshot(board)` and `applyWsEvent(event)`.
- The office module's internal reducer (moved from `agentStore.ts`) feeds the FSMs.
- Pros: office-domain logic stays together; zone/activity mapping is the office's concern; less coupling to shared store shape.
- Cons: the office module needs `Task`/`WsEvent`/`Board` types from the shared layer.

**Option B — FSM in the shared backbone:**
- The shared backbone computes `AgentActivitySnapshot[]` and pushes it to the office.
- The office module just renders: `GameRuntime.applyActivity(snapshots)`.
- Pros: office module is fully data-agnostic; could be reused for non-Kanban activity sources.
- Cons: zone/activity mapping logic (which is office-specific: "in_progress → workstations") leaks into the shared layer; the FSM transition timing (celebrate after done, etc.) would need to be replicated outside the office.

**Recommendation: Option A.** The FSM is office-domain logic. The shared
backbone owns transport and board state; the office owns the
board→activity→animation pipeline. The interface is two methods:

```
class OfficeModule {
  // Called by shared backbone on initial load and reconnect
  applyBoardSnapshot(board: Board): void;

  // Called by shared backbone on each WS event
  applyWsEvent(event: WsEvent): void;
}
```

### Event types (verified from v2 code, not assumed)

The WS event types are defined in `src/types.ts` and handled in
`boardStore.ts` and `AgentStateMachine.ts`:

| Event type | Board effect | Agent FSM effect |
|------------|--------------|------------------|
| `task.created` | Insert into `todo` column | No agent movement (unassigned) |
| `task.claimed` | Move to `in_progress` | Assignee → workstations (working) |
| `task.started` | Move to `in_progress` | Assignee → working animation |
| `task.blocked` | Stay in `in_progress` | Assignee → blocked (red ! emote) |
| `task.unblocked` | Stay in `in_progress` | Assignee → working |
| `task.review_requested` | Move to `review` | Assignee → collaboration zone (reviewing) |
| `task.completed` | Move to `done` | Assignee → celebrate → archive → break room (idle) |
| `task.archived` | Move to `done` | No agent movement |
| `task.reassigned` | Reassign in board | Old assignee → idle; new assignee → workstations |

### Column ID mapping (verified from `boardStore.getTargetColumn`)

```
todo, in_progress, review, done
```

The board has exactly 4 columns with these IDs. The FSM's
`STATUS_ZONE_MAP` maps `in_progress`/`blocked` → workstations, `review` →
collaboration, `done` → archive. `todo` → no agent movement.

### Reconnect/catch-up contract

On reconnect, the shared backbone must:
1. Re-fetch the REST board snapshot
2. Call `officeModule.applyBoardSnapshot(freshBoard)`
3. Re-subscribe to WS

The office module's FSMs handle the snapshot diff internally (they accept
`SNAPSHOT` events in any state). The v2 code does NOT do the "1-second
smooth catch-up with teleport-fade" described in the plan — that is
unimplemented. If MissionControl wants it, it is new work.

---

## 5. Migration risks and verification steps

### Risks

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| R1 | **`window.__*` globals in CanvasHost** — v2 uses `window.__gameRuntime`, `__followAgentId`, `__focusZone` for cross-component communication. These are fragile, not embed-safe, and will break if multiple office instances exist or if the dashboard uses the same global names. | High | Rebuild `CanvasHost` as `<OfficeCanvas/>` with React refs and callback props. GameRuntime already has clean method APIs (`selectAgent`, `followAgent`, `focusZone`, `pan`, `zoom`) — just call them via ref, not via window. |
| R2 | **Hardcoded `ATLAS_BASE = '/assets/atlases/'`** in both `GameRuntime.ts` and `Agent.ts`. In MissionControl, assets may be served from a different path (e.g. `/modules/office/assets/`). | High | Add `assetBaseUrl` to `GameRuntimeOptions` and pass it through to `Agent`. Replace all `fetch(`${ATLAS_BASE}...`)` calls. |
| R3 | **Full-viewport assumption** — v2's `OfficeShell` is `h-dvh w-dvw`. The office must work inside a sized panel in MissionControl. `GameRuntime` already accepts `width`/`height` and has a `ResizeObserver`, so the runtime is fine, but `fitCameraToWorld()` padding (40px) may need tuning for smaller panels. | Medium | Test with panel sizes from 400×300 to full-screen. Adjust `fitCameraToWorld` padding if letterboxing looks wrong in small panels. |
| R4 | **GSAP is listed as a dependency but NOT used** — the plan says GSAP drives walk tweens, but `AgentController.update()` uses manual per-tick lerp (`MOVE_SPEED = 3.5 px/tick`). `package.json` includes `gsap` but the code doesn't import it. | Low | Drop `gsap` from MissionControl's deps unless other modules need it. The manual lerp is simpler and works. |
| R5 | **XState v5 API** — `AgentStateMachine.ts` uses `createActor`/`createMachine`/`assign` from xstate v5. If MissionControl uses a different XState version, the FSM code will break. | Medium | Pin `xstate@^5.19.0` in MissionControl's `package.json` (same as v2). |
| R6 | **PixiJS v8 API** — `GameRuntime` and `Agent` use Pixi v8 APIs (`Application.init()`, `Spritesheet` constructor, `eventMode: 'static'`, `Graphics.circle().fill()`). These are v8-specific and do not work on v7. | High | Pin `pixi.js@^8.4.0`. Verify WebGL2 + Canvas2D fallback works in the dashboard's target browsers. |
| R7 | **WS endpoint divergence** — v2's `ws.ts` connects to same-origin `/api/events?token=` (proxied by the Fastify server). MissionControl may connect directly to `ws://192.168.0.85:9119/api/plugins/kanban/events?token=` or via a different proxy. The office module must NOT own the WS connection. | High | The office module only exposes `applyBoardSnapshot` and `applyWsEvent`. The shared backbone owns the WS client and calls these methods. |
| R8 | **Token scraping in server** — v2's `server/index.ts` scrapes `__HERMES_SESSION_TOKEN__` from the dashboard HTML. This is a fragile workaround. MissionControl should use proper auth (token from config or auth flow). | Medium | Do not replicate the token-scraping. Route auth to the shared backbone (Cloud-owned, Phase 3). |
| R9 | **`AGENT_DESKS` hardcodes 5 agents** — the office is built for exactly Cloud, Biscuit, Korra, Lelouch, Tifa. If MissionControl needs to show different or additional agents, the desk positions, zone layout, and spritesheets must change. | Medium | For Phase 0, keep the 5-agent assumption (matches Hermes departments). Document as a constraint. If agent roster changes, `iso.ts` + asset generation must be revisited. |
| R10 | **Plan vs code divergence** — the PLAN.md describes GSAP tweens, `@use-gesture/react` follow camera, 24fps idle downshift, reduced-motion teleport-fade. The code implements: manual lerp (no GSAP), `@use-gesture/react` for pinch/wheel/drag, 24fps idle downshift (in `AgentController.onActiveChange`), reduced-motion teleport in `AgentController.moveTo`. The "1-second catch-up on reconnect" and "long-press follow camera" are partially implemented (follow exists, catch-up does not). | Low | Trust the code, not the plan. Document the actual behavior. Any plan-described features that are missing are new work for MissionControl, not reuse. |
| R11 | **Status bar overlap** — v2's `OfficeShell` has a fixed bottom status bar (`z-50`) that overlaps the canvas. In an embedded panel, this could conflict with MissionControl's own status chrome. | Low | The status bar is part of `OfficeShell` (which we're not copying). The office module should emit `agentSelected` and let the dashboard render agent info in its own panel layout. |
| R12 | **Spritesheet loading is async and fallible** — `Agent.loadAnimSheet()` silently catches errors and falls back to the base texture. If assets are missing or paths are wrong, agents will render as static base sprites with no animation. This is hard to notice visually. | Medium | Add a dev-mode warning log when spritesheet fetch fails. Verify all 20 animation sheets load in the embedded context. |

### Verification steps (before Phase 2 implementation)

1. **Asset path verification:** Copy `public/assets/atlases/` to the target
   location in MissionControl. Verify that `fetch(`${assetBaseUrl}furniture-0.json`)`
   returns 200 in the Vite dev server. Do this before any code integration.

2. **Type compatibility check:** Confirm that `Task`, `WsEvent`, and `Board`
   types from v2 match the actual Hermes Kanban API response shape. The v2
   `isBoard()` and `isWsEvent()` guards in `api/client.ts` and `api/ws.ts`
   define the expected shape — use them as the contract.

3. **FSM standalone test:** Copy `AgentStateMachine.test.ts` and run it
   against the office module in isolation. All transitions must pass without
   any store or API dependencies.

4. **GameRuntime smoke test:** Instantiate `GameRuntime` in a bare HTML div
   (not the full shell), call `init()`, add 5 agents, and verify:
   - Floor tiles render
   - Furniture props render
   - Agents render at desks with idle animation
   - `currentFps` reports > 0
   - `destroy()` cleans up without errors

5. **Embedded render test:** Mount `GameRuntime` inside a 600×400 panel
   (not full viewport). Verify `fitCameraToWorld()` letterboxes correctly
   and the office is fully visible. Resize the panel and verify the
   `ResizeObserver` triggers `resize()` and the camera re-fits.

6. **Activity injection test:** Call `runtime.moveAgentByName('Cloud', 'workstations')`
   and verify Cloud walks to the workstations zone. Call
   `runtime.moveAgentByName('Cloud', 'break_room')` and verify the walk
   back. This tests the movement pipeline without WS/REST.

7. **Reduced-motion test:** Instantiate with `prefersReducedMotion: true`.
   Verify agents teleport (fade) instead of walking, idle animations slow,
   and the blocked FX does not pulse.

8. **Memory leak test:** Init + destroy the GameRuntime 10 times in
   sequence. Verify no accumulating GPU textures (check via
   `app.renderer.destroy` cleanup) and no orphaned DOM nodes.

9. **Version pin verification:** Confirm `pixi.js@8.4+`, `xstate@5.19+`,
   `@use-gesture/react@10.3+` all install cleanly in MissionControl's
   `package.json` and don't conflict with other deps.

10. **Contract freeze:** Once the above pass, freeze the
    `OfficeModuleInputs` interface (§3A) and the
    `applyBoardSnapshot`/`applyWsEvent` methods (§4) as the binding
    contract between the office module and the shared backbone.

---

## Summary

The v2 office has a clean engine core (`iso.ts`, `pathfinding.ts`,
`AgentStateMachine.ts`, `Agent.ts`, `AgentController.ts`, `GameRuntime.ts`)
that is reusable with two fixups: make `ATLAS_BASE` configurable and
eliminate `window.__*` globals from the React wrapper. All pre-generated
assets (atlases, spritesheets) copy directly.

The standalone shell (`OfficeShell`, `AuthGate`, `TopBar`, `CanvasHost`,
stores, API clients, server) is coupled to the standalone deploy and must
not be copied. MissionControl builds its own shell and shared state
backbone; the office module is a leaf that receives board snapshots and WS
events via two methods and emits selection/focus/FPS events.

The biggest integration work is rebuilding the React wrapper (`<OfficeCanvas/>`)
to be embed-safe, and wiring the shared backbone to call
`applyBoardSnapshot`/`applyWsEvent` instead of the v2 standalone's tightly
coupled store+WS+auth orchestration.