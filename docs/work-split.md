# Sora-MissionControl Work Split

Status: Phases 0-3 complete. Phase 4 ready for Biscuit handoff.

## Phase 1 - Visual System + Shell

Owner: Korra acceptance, Biscuit implementation.

Deliverables:
1. `src/styles/theme.css` or token module with dark premium mission-control tokens, incorporating Gundam 00 Exia mecha/HUD influences (sharp angular lines, GN drive green accents, visor-style highlights) while preserving clarity.
2. Shell layout for first-screen trio: office center, chat command surface, live ops telemetry.
3. Shared primitives: panel, status pill, alert strip, command input, profile selector.
4. Design review checklist against `shared/phase0-korra-visual-contract.md`.

Verify:
- Build passes.
- Static shell screenshot/review shows no generic AI dashboard patterns.
- Reduced-motion styles present.

## Phase 2 - 3D Office Embed

Owner: Biscuit.

Deliverables:
1. Copy reusable v2 engine/assets into `src/modules/office/`.
2. Implement `<OfficeCanvas/>` embed wrapper, no `window.__*` globals.
3. Make `assetBaseUrl` configurable.
4. Implement `OfficeModuleApi` methods and event callbacks.
5. Smoke tests for init/render/destroy/FSM.

Verify:
- Office renders in 600x400 and full-screen containers.
- 5 agents render and animate.
- FPS event reports > 0.
- FSM tests pass.

## Phase 3 - Data/Auth/Live Sync Backbone

Owner: Cloud.

Deliverables:
1. Trusted local adapter for dashboard token/session handling.
2. REST client for `/api/plugins/kanban/board` and task routes.
3. WS client for `/api/plugins/kanban/events` with reconnect/backoff.
4. Shared stores: connection, board, profile, usage, admin.
5. Adapter test fixtures from real API shapes.

Verify:
- Unauth board request returns 401; auth request returns 200.
- Board columns match `triage,todo,scheduled,ready,running,blocked,review,done`.
- WS smoke test receives event or clean reconnect state.

## Phase 4 - Chat Module

Owner: Biscuit UI, Cloud transport.

Deliverables:
1. Profile selector and command-console chat surface.
2. `ChatTransport` implementation or explicit mock until real transport verified.
3. Agent status shown consistently with office/ops.
4. Thread navigation without consumer-chat styling.
5. Floating chat bubble overlay from the Hermes dashboard TUI plugin, integrated into Mission Control.

Verify:
- Can send a test message through verified transport or mock clearly labeled demo mode.
- No browser direct CLI spawn.
- Phase 2 bug sweep completed before Phase 5 starts.

## Phase 5 - Live Ops / Usage

Owner: Cloud data, Biscuit UI, Korra acceptance.

Deliverables:
1. Usage snapshots from `hermes insights` or verified API.
2. Connection/source health panel.
3. Rate-limit fields with `unknown` state until verified.
4. Alert strip with severity/freshness/confidence.

Verify:
- Unknown states render as unknown, not healthy.
- No fake quota data.

## Phase 6 - Admin Controls

Owner: Cloud.

Deliverables:
1. Models/fallback summary and safe switch flow.
2. Cron manager.
3. Webhook manager.
4. Skills/MCP manager.
5. Credential status only.

Verify:
- Destructive/high-risk actions require confirm.
- Secret values never appear in UI payloads/logs.

## Phase 7 - Kanban / Project Control

Owner: Biscuit UI, Cloud adapter.

Deliverables:
1. Ownership/status overview.
2. Task drawer/actions via Cloud adapter.
3. Selected agent cross-link with office/chat.
4. Dispatch/decompose controls are user-confirmed.

Verify:
- Board actions route through `/api/plugins/kanban` or CLI adapter, not duplicate DB code.
- Auto-dispatch surprises prevented.

## Phase 8 - Polish / Performance / Cohesion

Owner: Korra acceptance, Biscuit implementation, Cloud health checks.

Deliverables:
1. Motion/spacing/empty-state polish.
2. Office FPS and memory tuning.
3. Accessibility/reduced-motion pass.
4. Final first-screen cohesion review.

Verify:
- Build passes.
- Performance budget checked.
- Visual checklist passes.