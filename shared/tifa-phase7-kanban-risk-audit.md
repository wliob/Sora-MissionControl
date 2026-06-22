# Tifa Phase 7 Kanban / Project Control Risk Audit

Owner: Tifa / Finance & Trading risk lead
Scope: Phase 7 Kanban / Project Control planning audit. Docs-only review. No trading actions taken.
Reviewed at: 2026-06-21T19:12:47-04:00

## Executive risk call

Phase 7 can proceed, but only as a verified-control surface over the existing Hermes Kanban API/adapter path. The Kanban/project-control UI must not become an independent dispatcher, direct database client, or optimistic green status board. It should surface ownership, active work, blockers, stale workers, and risky actions with provenance and explicit confirmations.

Required approval stance:
- Read/status surfaces may render from verified `/api/plugins/kanban` REST/WS stores with source/freshness/confidence visible.
- Mutating actions must route through Cloud-owned verified adapters that call `/api/plugins/kanban` or a reviewed CLI/local proxy path. Browser app code must not write directly to a database, filesystem ledger, worker PID, or Hermes profile state.
- Dispatch, decompose, reclaim, terminate, reassign, done, and archive actions must be no-surprise operations: user/operator-visible, explicitly confirmed, auditable, and blocked or degraded when source state is stale, unknown, mock, unauthorized, or adapterless.
- Cost/quota unknown remains visible for LLM-triggering task actions. Unknown is not a pass.

Finance/trading-specific dashboard surface: no-op for Phase 7. No finance/trading surface is needed unless the project later adds trading controls. This audit took no trading actions. If any future trading controls appear, they must be separate from Kanban project controls, paper-first, platform-isolated, and live-disabled unless deterministic approval gates allow them.

## Sources reviewed

Required context:
- `AGENTS.md`
- `OVERVIEW.md`
- `docs/work-split.md`
- `docs/section-contracts.md`
- `shared/README.md`
- `shared/tifa-phase6-risk-approval-audit.md`
- `shared/lelouch-phase6-admin-workflow-copy.md`
- `shared/korra-phase6-admin-ux.md`

Additional Phase 7/API context inspected:
- `docs/api-reference.md`
- `src/types/board.ts`
- `src/adapters/boardAdapter.ts`
- `src/adapters/runtimeAdapter.ts`
- `src/state/backbone.ts`
- `src/types/provenance.ts`
- `src/components/shell/ShellLayout.tsx`

Current observed state:
- Phase 7 route is currently a reserved empty Kanban view in `ShellLayout.tsx`.
- Canonical board, worker, event, profile, and provenance types already exist.
- Verified Kanban surfaces are documented under `/api/plugins/kanban`, including board, task detail, bulk task mutation, workers, run terminate, task reclaim, dispatch, profile auto-description, task decompose, board archive/delete, and events.
- Provider quota/rate-limit source remains unverified and must remain visible as `unknown` when an action can trigger LLM/API spend.

## Risk inventory

### R1 — Auto-dispatch surprise / unintended agent work

Risk: a project-control dashboard could start work, duplicate edits, spawn profiles, or consume model budget just because a task moved columns or a page refreshed.

Required controls:
- No auto-dispatch from page load, route change, drag/drop, selection, filter changes, websocket reconnect, or stale-state reconciliation.
- Dispatch must be an explicit action with visible target task(s), assignee/scope, expected behavior, and confirmation.
- If the UI offers a batch dispatch or dispatcher nudge, it must show how many ready tasks may be affected and must not imply a single-task operation when it can trigger broader dispatcher behavior.
- A successful dispatch request must not be treated as completion; it only means the dispatch request was accepted. Worker heartbeat/run status remains separate.

### R2 — Direct DB writes / app-side orchestration drift

Risk: duplicate board mutation paths can corrupt status, bypass plugin locks/idempotency, miss events, and diverge from Hermes Kanban state.

Required controls:
- The app must use `/api/plugins/kanban` or a verified Cloud adapter only.
- No browser-side direct SQLite, filesystem, profile directory, PID, or Hermes internal DB writes.
- No custom duplicate reducer that becomes a second source of truth. UI state is view/filter/drawer only; board truth stays in shared stores backed by verified adapters.
- Optimistic UI may show `pending` but must roll back or reconcile from the server/event stream; it must not present unconfirmed local mutation as final.

### R3 — Hidden worker termination or reclaim

Risk: terminating a run or reclaiming an active task can lose work, kill a real process, orphan files, duplicate work, or break another agent's session.

Required controls:
- Terminate and reclaim must always be explicit, confirmed, and audited.
- No hidden termination as part of archive, done, reassign, board switch, route change, stale worker cleanup, or bulk action.
- Confirmation must show task id/title, current assignee, run id, PID if known, last heartbeat, age/runtime, workspace path if present, and whether logs/artifacts are available.
- If worker state is stale/unknown, the UI must say so and escalate confirmation severity. It must not show a green safe-to-kill state.

### R4 — False green worker / board state

Risk: active work can look healthy when WS is disconnected, REST is stale, profiles endpoint is slow/unavailable, worker heartbeat is old, or source confidence is unknown.

Required controls:
- Worker rows and task cards need freshness/confidence labels for REST board, WS stream, and active-worker source.
- Unknown, missing, stale, mock, unverified, unauthorized, or degraded worker sources cannot render as green/healthy.
- A task in `running` with no fresh active worker or no fresh heartbeat should be shown as `unknown/stale`, not `active healthy`.
- A worker row without a matching board task should be shown as `orphan/unknown` until reconciled, not silently hidden.

### R5 — LLM cost / quota blind spots

Risk: decompose, specify, profile auto-description, dispatcher nudges, and repeated failed dispatches can trigger LLM/API use while live quota/rate-limit remains unverified.

Required controls:
- Any action that may trigger LLM/API work must show cost/quota/rate-limit state before confirmation.
- If real-time quota is unverified, display `quota unknown` / `rate limit unknown`; do not infer safety from historical `hermes insights` usage or credential presence.
- For repeated/batch actions, show count, recurrence, or estimated blast radius. If estimates are unavailable, say `unknown` and keep it visible.
- Do not hide unknown cost behind a green overall status badge.

### R6 — Credential/process-control bleed-through

Risk: Phase 7 task controls may indirectly use profile credentials, model overrides, MCP tools, workspaces, or skills. The dashboard could give a false sense that those dependencies are verified.

Required controls:
- Task drawer must display model override, skills, workspace kind/path, assignee, and source confidence when present.
- Missing model/provider/key/MCP status should stay unknown/unavailable, not healthy.
- Reassign must warn when the target assignee's profile/model/credential state is unavailable or stale.
- Decompose/dispatch must warn when the task specifies skills, MCP/tool use, model override, worktree/dir workspace, or goal mode that could increase blast radius.

### R7 — Done/archive masking unfinished or failed work

Risk: marking done/archive can bury failed, unreviewed, running, or blocked work and hide handoff evidence.

Required controls:
- Done must require a result/handoff or explicit reason if no result exists.
- Archive must not silently terminate workers or hide active runs.
- Archive/delete/hard-delete must be visually distinct from `done`; archive is record-hiding/cleanup, not task success.
- Bulk done/archive must show selected count and individual risk exceptions: running, blocked, stale, unknown worker, failed dispatch count, missing result.

## Required gates by Phase 7 action

All gates below are minimum requirements before enabling the action in an operational UI. If a gate cannot be evaluated, render the action unavailable or require elevated Sora/operator confirmation with the unknown clearly displayed; never silently proceed as healthy.

| Action | Allowed adapter path | Required preflight | Confirmation content | Must block or degrade when | Post-action verification |
|---|---|---|---|---|---|
| Dispatch / dispatcher nudge | `POST /api/plugins/kanban/dispatch` or verified CLI adapter | Fresh board source; selected scope clear; task status eligible; assignee/profile visible when applicable; no pending duplicate action; cost/quota state fetched or marked unknown | Scope, target tasks/count, assignee, model/skills/goal mode if present, cost/quota/rate-limit state or `unknown`, idempotency/dedup note, rollback/stop path | Board/worker source stale or unknown; adapter unavailable/mock; ambiguous scope; auth invalid; task already running unless explicit reclaim/terminate flow is used | Show request accepted/failed separately from actual run start; refresh board/workers; watch WS/REST for run/heartbeat; display failures |
| Decompose | `POST /api/plugins/kanban/tasks/{task_id}/decompose` | Task exists and is fresh; user can see parent body; no active worker unless explicitly supported; cost/quota state visible; resulting child-task behavior known or marked unknown | Parent id/title, expected child-task creation, LLM/API cost warning, quota/rate-limit state or `unknown`, whether children may auto-dispatch | Task stale/missing; body unavailable; cost/quota hidden; adapter mock/unavailable; source unauthorized | Fetch task detail/board after action; show child count or unknown; no green success until children/events verified |
| Reclaim | `POST /api/plugins/kanban/tasks/{task_id}/reclaim` | Task has active/stale claim; current run/worker info fetched; last heartbeat and claim age visible; logs/artifacts availability checked or unknown | Task id/title, assignee, run id, PID, last heartbeat, why reclaim is needed, risk of duplicate/lost work | Fresh active worker heartbeat unless operator explicitly confirms; worker source unknown; adapter unavailable; task not in claimable state | Refresh board/workers; show new status/claim state; do not auto-dispatch unless separately confirmed |
| Terminate run | `POST /api/plugins/kanban/runs/{run_id}/terminate` | Run id known; task/assignee/PID/heartbeat visible; termination target matches active worker; artifact/log link available or unavailable | Run id, task id/title, PID, assignee, runtime, last heartbeat, workspace path, data-loss warning, whether task status changes after terminate | Run id missing; worker source stale/unknown without elevated confirmation; target mismatch; adapter mock/unavailable | Confirm termination result; refresh active workers/task detail/log; show non-green if worker remains or state unknown |
| Reassign | `POST /api/plugins/kanban/tasks/{task_id}/reassign` or `PATCH /tasks/{task_id}` through adapter | Source and target assignees visible; target profile exists or is explicitly free-form; current status/run checked; target profile/model/credential state visible or unknown | From/to assignee, task status, active run/claim state, target profile health, skills/model override compatibility, cost/quota unknown if reassign may dispatch later | Active running task unless reassign semantics are verified safe; target profile unavailable/stale; adapter mock/unavailable; source state stale | Refresh task; show WS event `task.reassigned` if received; no automatic dispatch unless confirmed |
| Mark done | `PATCH /api/plugins/kanban/tasks/{task_id}` setting status/result through adapter | Task not actively running; result/handoff present or explicit reason captured; review/blocker state visible | Task id/title, result summary, whether linked children are complete, whether worker/run is still active, audit note | Active worker present; worker source unknown/stale without warning; no result and no explicit reason; task blocked/failed unless overridden | Refresh board; show completed timestamp/result; if event/REST disagreement occurs, show stale/degraded |
| Archive / delete | `DELETE /tasks/{task_id}`, `POST /tasks/bulk`, or board archive endpoint through adapter only | Task/board identity verified; selected count visible; active runs checked; done/result state checked; hard-delete vs archive clarified | Exact target(s), archive vs delete, reversibility, active-worker warning, artifact/log retention, typed phrase for destructive delete/board archive | Active worker unless terminate/reclaim separately confirmed; stale/unknown source; bulk selection contains exceptions not individually shown; adapter mock/unavailable | Refresh board; show archive/delete result and any per-item failures; no silent hiding of failed items |

## No-surprise automation rules

1. No auto-dispatch without clear confirmation.
   - Confirmation must be a deliberate UI/operator action. Drag/drop, opening a drawer, changing filters, reconnecting WS, or viewing a ready task cannot dispatch work.

2. No direct DB writes by app.
   - The React app and browser-side stores may not mutate Kanban persistence directly. All mutations go through verified adapter/API paths.

3. No hidden worker termination.
   - Terminate is never a side effect of done/archive/reassign/route change/stale cleanup. If a worker will be stopped, the confirmation must say `terminate` and name the run/PID when known.

4. No green state for stale/unknown workers.
   - Worker health requires fresh active-worker data plus matching board/run state. Unknown, stale, missing, mock, unauthorized, degraded, or mismatched data must render warning/unknown.

5. Cost/quota unknown remains visible for LLM-triggering actions.
   - Decompose, specify, profile auto-description, dispatch modes that can start LLM workers, and any future task action that calls models must show quota/rate-limit/cost as verified values or `unknown`. Unknown must not be hidden inside an overall healthy panel.

6. Explicit audit trail for mutating actions.
   - Every mutation should produce or surface an event/result with action, actor, target, timestamp, adapter/source, confirmation id or nonce, and failure details. UI should show pending/completed/failed states separately.

7. Unknown is not empty.
   - Empty board, no workers, no profiles, no cost data, no logs, or no events must distinguish true empty from unavailable/stale/unauthorized/unknown.

8. Batch actions must disclose blast radius.
   - Bulk dispatch/reassign/done/archive must show count, target statuses, active/stale exceptions, and per-item failures after execution.

## Acceptance checklist for Phase 7 implementation

Adapter/source discipline:
- [ ] Kanban read state comes from shared `boardStore` / `kanbanEventBus` / `profileStore` / `connectionStore` or equivalent typed stores.
- [ ] Mutations route only through verified Cloud adapter calling `/api/plugins/kanban` or a reviewed CLI/local proxy path.
- [ ] No direct DB, filesystem, PID, or profile-state writes from app code.
- [ ] Optimistic UI never becomes final without server/event reconciliation.

Freshness/false-certainty discipline:
- [ ] Board, worker, profile, and event stream states show source/freshness/confidence.
- [ ] Stale/unknown workers cannot render green.
- [ ] Running tasks without matching fresh worker/heartbeat render stale/unknown.
- [ ] WS disconnect or REST failure downgrades visible state instead of freezing the last green snapshot.

Confirmation/process-control discipline:
- [ ] Dispatch requires explicit confirmation and clear scope.
- [ ] Decompose requires explicit confirmation and LLM cost/quota warning.
- [ ] Reclaim requires explicit confirmation with worker/heartbeat context.
- [ ] Terminate requires explicit confirmation with run/PID/task context.
- [ ] Reassign requires explicit confirmation when task is running, stale, target profile unknown, or target profile capability is unavailable.
- [ ] Done requires result/handoff or explicit reason and blocks/flags active workers.
- [ ] Archive/delete requires destructive confirmation and does not terminate workers as a hidden side effect.
- [ ] Modal/confirmation behavior follows Phase 6 lessons: safe default focus, no Enter-to-confirm for destructive actions, no modal stacking, clear target/impact/reversibility fields.

Cost/quota/credential discipline:
- [ ] LLM-triggering actions show cost/rate-limit/quota status or `unknown` before execution.
- [ ] Historical `hermes insights` is labeled historical, not live quota.
- [ ] Target profile model/provider/credential/MCP status is unavailable/unknown when not verified.
- [ ] Skill/model/workspace/goal-mode fields are surfaced when they raise cost, tool, or process risk.

Trading/finance lane:
- [ ] No trading controls are introduced in Phase 7.
- [ ] No Tifa finance/trading dashboard surface is required for Phase 7 project control.
- [ ] If future trading controls are proposed, they are separate, paper-first, platform-isolated, and live-disabled unless deterministic approval flags permit them.

## Final recommendation

Proceed with Phase 7 implementation only behind the adapter and confirmation gates above. The most important non-negotiables are: no app direct DB writes, no auto-dispatch surprise, no hidden worker termination, no green state for stale/unknown workers, and visible cost/quota unknown for any LLM-triggering task action. Phase 7 should make project-control uncertainty obvious rather than cosmetically clean.