# Mission Control Potential Upgrade

## Summary

Build "adapted parity": add the official Hermes Web Dashboard and Kanban capabilities that make sense for Sora-MissionControl while preserving the current premium shell, 3D office, chat surface, ops panel, provenance rules, and secret-safety behavior.

Sources:
- Official Hermes Web Dashboard docs: https://hermes-agent.nousresearch.com/docs/user-guide/features/web-dashboard
- Official Hermes Kanban docs: https://hermes-agent.nousresearch.com/docs/user-guide/features/kanban
- Local `OVERVIEW.md`
- Local `docs/api-reference.md`

## Current Gap Map

Mission Control already has:
- Custom responsive shell, mission bar, office scene, floating chat overlay, source health, ops usage cards, unknown-safe quota behavior.
- Board/profile/workers adapters for `/api/plugins/kanban/board`, `/profiles`, `/workers/active`, and Kanban WS event plumbing.
- Partial admin scaffolding for models, API keys, and MCP, with destructive confirmations and redaction guards.

Missing or partial versus official Hermes:
- Dashboard management pages: config editor, sessions browser, logs, analytics detail, cron, profiles, skills/toolsets/hub, webhooks, pairing, channels, system operations, memory, credential pool, checkpoints, shell hooks, portal/update/curator/gateway controls.
- Official chat parity: real PTY/TUI-backed chat, session resume/switching, model picker, tool-call/approval fidelity. Mission Control currently keeps an honest demo fallback because direct `/api/plugins/chat/*` is unavailable locally.
- Kanban UI: real Kanban route, board switcher, board create/archive, filters, lanes by profile, task drawer, editable metadata/body, dependencies, comments, run history, events, logs, worker actions, triage specify/decompose, dispatcher nudge, orchestration settings.
- Office/Kanban reflection: the office already consumes board snapshots, but it collapses rich Kanban state into a small task/status model. The upgrade should make board changes visibly affect the office: task reassignment, blocking, review, completion, decomposition, dependencies, comments, and run events should all have readable office-side consequences.
- Adapter completeness: many official endpoints exist in docs, but Mission Control only wraps the current board/profile/workers/stats subset.

## Implementation Plan

### 1. Foundation: Adapter And Capability Registry

- Extend `HermesDashboardClient` into typed endpoint groups: `status`, `config`, `env`, `sessions`, `logs`, `analytics`, `cron`, `profiles`, `skills`, `mcp`, `messaging`, `webhooks`, `pairing`, `system`, and `kanban`.
- Add a capability registry that probes each endpoint and records `available | unavailable | unauthorized | degraded`, so missing official routes render unavailable instead of mock data.
- Keep current provenance model: every panel shows source, freshness, confidence, and last error where useful.
- Preserve current auth behavior from `docs/api-reference.md`: use `X-Hermes-Session-Token`, never store or render tokens.

### 2. Admin Parity Without Overlap

- Expand `UnifiedAdminSurface` tabs to: Models, Config, Keys, MCP, Skills, Cron, Webhooks, Channels, Pairing, Profiles, System.
- Replace mock `adminKeyMcpStore` seed data with adapter-backed real state; raw secrets may appear only in one-time create/regenerate results.
- Add official config editor using `/api/config`, `/api/config/defaults`, and `/api/config/schema`; render dropdowns/toggles/text inputs from schema.
- Add API key/env management using `/api/env`, grouped by provider/tool/messaging/settings, with advanced keys hidden by default.
- Add skills/toolsets/hub: installed skill search/filter/toggle, toolset status, hub search/install/update logs.
- Add MCP parity: list/add HTTP/SSE/stdio, enable/disable, test, remove, catalog install with redacted env values.
- Add cron/webhook/channel/pairing surfaces with confirmations for delete, revoke, gateway restart, trigger-now, and any action that writes credentials.
- Add System admin: host stats, update check, portal status, curator pause/run, gateway lifecycle, memory provider/reset, credential pool, operations log runner, checkpoints, and shell hooks with explicit consent warnings.

### 3. Sessions, Logs, Analytics, And Status

- Fold official Status page data into MissionBar/Ops instead of adding a duplicate landing page: agent version, release date, gateway status/PID, active sessions, recent sessions.
- Add a Sessions view: searchable recent sessions, stats bar, expanded message history, tool calls, rename, archive, export, prune, delete, and "resume in chat" action where transport allows it.
- Add Logs view: file selector, level/component filters, line count, live refresh, severity coloring.
- Expand Ops analytics beyond the current summary cards: 7/30/90 day selector, daily token/cost chart, daily table, per-model breakdown.
- Continue treating real-time provider quota/rate-limit data as `unknown` until a verified source exists.

### 4. Chat Parity, Mission-Control Style

- Keep the existing Mission Control chat UI and floating overlay; do not replace it with a literal official xterm page unless needed.
- Add a real transport layer only through a verified path: hardened local CLI proxy or official `/api/pty` compatibility bridge.
- Add session list/resume/new chat behavior matching official dashboard intent, mapped into the existing per-profile thread model.
- If full PTY fidelity is selected later, mount it as an optional "Terminal TUI" mode beside the native chat, not as a replacement.

### 5. Kanban Project-Control Route

- Replace `EmptyView label="kanban"` in `src/components/shell/ShellLayout.tsx` with a full Kanban module.
- Add board switcher, `+ New board`, archive board, tenant filter, assignee filter, search, show archived, lanes-by-profile toggle, and dispatcher nudge.
- Render official statuses from local canonical model: `triage`, `todo`, `scheduled`, `ready`, `running`, `blocked`, `review`, `done`.
- Add task cards with assignee, priority, tenant, workspace, failure/heartbeat/run hints, comment count, dependency count, and warning badges.
- Add task drawer backed by `/api/plugins/kanban/tasks/:id`: editable title/body/assignee/priority/status, dependency editor, comments, result, events, runs, logs, diagnostics.
- Add safe task mutations only through `/api/plugins/kanban` adapter: create, patch, comments, links, bulk actions, reclaim, terminate, archive, delete.
- Add triage controls: Specify and Decompose, with LLM-cost warning and clear returned reason/fanout/child IDs.
- Add orchestration settings: auto/manual, orchestrator profile, default assignee, auto-decompose, and profile description editor.
- Group run/event history by attempt; update the open drawer when WS events arrive for the selected task.

### 6. Kanban-To-Office Live Reflection

- Expand the office adapter boundary so `KanbanTaskCard` data can carry status, priority, warnings, comments, dependency counts, run id, heartbeat, progress, tenant, workspace, and latest summary into office-friendly metadata without coupling PixiJS directly to dashboard API shapes.
- Reflect task status changes in agent behavior:
  - `triage`, `todo`, `scheduled`, and `ready`: agent stays idle or moves to a "planning" posture only when a task is assigned and ready.
  - `running`: agent moves to their workstation and shows active work state.
  - `blocked`: agent remains visible at workstation with a blocker badge/pulse and appears in the office status bar as needing attention.
  - `review`: agent moves to the collaboration zone; reviewer/assignee relationships should be visible when dependency data is available.
  - `done`: agent moves to archive/celebration briefly, then returns to break room if no active work remains.
- Reflect task reassignment immediately: old assignee returns to idle/break room if no other active work exists; new assignee moves toward the task's correct zone.
- Reflect dependencies and decomposition: parent/child task links show as subtle task-chain indicators in the selected agent panel and, when multiple assigned agents are involved, can pull them toward collaboration.
- Reflect comments and warnings: new comments add a nonintrusive "message" pulse on the assigned agent; warnings/failures add an amber/red risk marker that clears when the task recovers.
- Reflect run lifecycle: active `currentRunId`, stale heartbeat, termination, reclaim, and run completion should update the selected agent panel and office status bar.
- Add cross-navigation hooks: selecting an agent with a task can open the Kanban task drawer; selecting a Kanban task can focus the assigned agent in the office.

### 7. Three 3D Office Level-Ups

1. Live Kanban Wall
   - Turn the existing central kanban prop into a living miniature board: eight tiny columns, glowing task chips, animated status transitions, and an attention pulse for blocked/review tasks.
   - Clicking the wall should switch to the Kanban route with the same filters/context, while hovering or selecting an agent highlights that agent's task chips.

2. Agent Collaboration Scenes
   - Add choreographed micro-scenes for real workflow moments: review pairing at the collaboration table, blocker escalation near the whiteboard, decomposed child tasks fanning out from the parent, and completion handoff to archive.
   - These should be event-driven from Kanban WS/task detail data, not decorative random animation, so the office feels alive because the work is alive.

3. Event Replay And Focus Trails
   - Add a short recent-history replay mode for Kanban events: ghost trails show where agents moved, task chips animate through statuses, and the user can scrub the last N events without mutating live state.
   - Add a "focus trail" when selecting a task or agent: dim the rest of the room, draw a subtle route/path from agent to relevant zone, and show the task's latest run/comment/status moments in the side panel.

### 8. Cross-Module Cohesion

- Cross-link profile selection between Office, Chat, Admin Profiles, and Kanban assignee filters.
- From an office agent, show current task/run and jump to task drawer or chat.
- From Kanban task drawer, jump to profile chat and highlight matching office agent.
- Keep Mission Control's design language: no duplicate official landing pages, no raw YAML-first workflows where schema forms exist, no fake healthy states.

## Test Plan

- Unit tests for every new adapter normalizer: happy path, missing payload, malformed payload, unauthorized, unavailable, stale/degraded provenance.
- Secret-safety tests: no raw API keys/tokens/HMAC secrets in persistent stores, rendered text, logs, errors, snapshots, or local storage.
- Confirmation tests for destructive/high-risk actions: delete/archive/prune/revoke/reset/update/gateway restart/dispatch/reclaim/terminate/decompose.
- Kanban tests: board switcher, filters, task drawer loading, comments, dependency edits, status transitions, run history grouping, WS refresh of selected drawer.
- Office reflection tests: status/reassignment/comment/warning/run events update agent zone, selected-agent panel metadata, office status bar indicators, Kanban wall state, and cross-navigation targets without breaking existing demo mode.
- Admin tests: config schema widgets, env key set/delete, MCP test/catalog, cron pause/resume/trigger/edit/delete, webhook one-time secret, channel credential redaction.
- Integration smoke tests against a live local dashboard where available; unavailable endpoints must render `unavailable`, not mock data.
- Final verification: `npm run test`, `npm run lint`, `npm run build`, then browser checks for desktop/tablet/mobile layout.

## Assumptions And Defaults

- Use adapted parity: implement useful official capabilities inside Mission Control's existing product shape, not a literal official dashboard clone.
- Do not reimplement Hermes backend logic or write directly to SQLite/config files from the browser; use official REST endpoints or a trusted local proxy for CLI-only gaps.
- Keep existing features intact: 3D office, floating chat, current ops unknown-safe behavior, admin redaction, and mission-control layout remain first-class.
- Treat the 3D office as a live operational view of Kanban, not a separate toy scene. Office animations and indicators should come from normalized board/task/run events and degrade gracefully when details are unavailable.
- Official docs describe some security behavior differently from the locally verified runtime; local runtime/auth docs remain authoritative for this repo until reverified.
