# Korra Phase 7 Kanban / Project Control UX Acceptance — smc-p7-korra-kanban-ux

Owner: Korra / Creative & Media
Date: 2026-06-21
Scope: Phase 7 Kanban/project-control acceptance prep for ownership/status overview, task drawer/actions, blocker visibility, selected-agent cross-links, dispatch/decompose controls, mobile/touch behavior, empty/error/stale states, and anti-generic dashboard rules.

## Executive acceptance direction

Phase 7 is not yet implemented. The current app exposes the `kanban` primary nav item, but the route renders only a reserved `EmptyView` in `src/components/shell/ShellLayout.tsx`. That is honest and preferable to fake project-control data, but it is not accepted for Phase 7.

Phase 7 is accepted only when Kanban becomes one tactical decision surface for:
- who owns what,
- what is moving now,
- what is blocked or stale,
- which agent/profile is involved,
- what actions are safe to take next,
- and where the user can jump between office presence, chat, and task detail without losing context.

No code edits were made in this pass. Biscuit should implement after the Phase 6 TypeScript/build repair and Cloud adapter work are stable enough to expose safe task mutations. Do not backfill with mock tasks or generic dashboard cards.

## Sources audited

Project guidance:
- `AGENTS.md`
- `OVERVIEW.md`
- `docs/work-split.md`
- `docs/section-contracts.md`
- `docs/api-reference.md`
- `docs/canonical-model-invariants.md`
- `shared/README.md`
- `shared/korra-phase6-admin-ux.md`
- `shared/lelouch-phase6-admin-workflow-copy.md`
- `shared/tifa-phase6-risk-approval-audit.md`

Current implementation inspected:
- `src/components/shell/ShellLayout.tsx`
- `src/components/shell/MissionBar.tsx`
- `src/state/shellStore.ts`
- `src/state/boardStore.ts`
- `src/types/board.ts`
- `src/types/agents.ts`
- `src/types/provenance.ts`
- `src/services/hermes/dashboardClient.ts`
- `package.json`

Design guidance loaded:
- `ui-ux-pro-max`, UX search for mission-control Kanban/project-control states.
- Relevant hard requirements from that search: 44x44px mobile touch targets, at least 8px spacing between adjacent touch targets, accessible names for icon-only controls, keyboard access for all functionality, tab order matching visual order.

## Current surface audit

### What exists

1. Navigation reservation exists.
   - `MissionBar` includes `{ id: 'kanban', label: 'Kanban' }`.
   - Mobile segmented nav also includes Kanban.

2. Route body is placeholder-only.
   - Wide, medium, and narrow layouts route `view === 'kanban'` to `EmptyView label="kanban"`.
   - Copy: `KANBAN control surface is reserved for a wider tactical frame`.

3. Data backbone exists.
   - `boardStore` owns normalized board snapshots, WS events, profile roster, and active workers.
   - `KanbanTaskCard` already includes fields needed for a real drawer: status, assignee, priority, timestamps, workspace, current run, heartbeat, failure, comments, progress, diagnostics, warnings, skills, model override, link counts, summary, and result.
   - `HermesDashboardClient` exposes read calls for board, profiles, active workers, usage/stats, and WS event URLs.

4. Verified endpoint map exists.
   - `docs/api-reference.md` lists Phase 7-safe routes under `/api/plugins/kanban`, including board, task detail, comments, links, logs, runs, reclaim, terminate, dispatch, and decompose.

5. Office/chat cross-link primitives partially exist.
   - `shellStore.selectedAgent` exists and office selection can set selected agent.
   - Chat already has profile-aware surface and profile activity hints.
   - Phase 7 needs to consume and update these shared selection primitives rather than inventing a parallel selection store.

### What does not exist yet

1. No Kanban UI module or component directory was found.
   - No `src/modules/kanban/` or `src/components/kanban/` implementation exists.

2. No task drawer exists.
   - No comments/runs/logs/diagnostics/detail drawer surface exists for task drill-down.

3. No task mutation adapter exists in the UI layer.
   - `dashboardClient` currently has read methods for board/profiles/workers and generic `requestJson`, but no typed safe adapter for PATCH task, comment, link, reclaim, terminate, dispatch, or decompose actions.

4. No blocker-specific visibility exists outside office status text and raw board status.
   - `blocked`, `lastFailureError`, `warnings`, stale heartbeat, and consecutive failure signals are not combined into a blocker queue.

5. No selected-agent cross-link experience exists across Kanban, office, and chat.
   - The selected-agent state exists, but Kanban has no owner rows, task filters, focus actions, or chat jump buttons.

## Phase 7 planned deliverables interpreted as UX requirements

The planned Phase 7 deliverables are correct but need sharper acceptance gates:

1. Ownership/status overview.
   - Must show the real board grouped by owner and operational state, not a decorative card grid.

2. Task drawer/actions through verified Cloud adapter.
   - Must expose one task at a time with detail, timeline, comments, run/log access, and action eligibility.

3. Selected-agent cross-link with office/chat.
   - Must keep the same agent/profile selected across Kanban, office, and chat.

4. Dispatch/decompose controls are user-confirmed.
   - Must prevent surprise agent work, LLM spend, duplicate dispatches, and unsafe run termination.

5. No direct DB writes.
   - All actions must route through `/api/plugins/kanban` or a Cloud-owned trusted adapter. Browser UI must not duplicate Kanban persistence logic.

## Acceptance criteria

### 1. Ownership/status overview

Accepted when:
- The Kanban route replaces `EmptyView` with a real `ProjectControlSurface` fed by `boardStore`, `profileStore`, `activeWorkers`, and `connectionStore`/provenance.
- The first scan answers:
  - active owners/profiles,
  - running tasks,
  - blocked tasks,
  - review-needed tasks,
  - stale/inactive running work,
  - unassigned/triage backlog,
  - and latest board freshness.
- Board columns follow the canonical order: `triage`, `todo`, `scheduled`, `ready`, `running`, `blocked`, `review`, `done`.
- Overview supports two primary groupings without duplicate state:
  - by owner/profile, for command decisions;
  - by status lane, for board integrity checks.
- Counts never imply health by themselves. A count of `0 blocked` is only calm if board provenance is fresh/verified; stale/missing board data must show as unknown.
- Rows show compact provenance: `source`, `freshness`, `confidence`, and `receivedAt/last checked`.
- Unknown/custom assignees render as text with `unknown profile` treatment; they are not dropped or treated as errors.
- `selectedAgent`/owner focus is visible in overview and can be cleared.

Rejected if:
- The page is mostly KPI cards, decorative charts, or generic dashboard tiles.
- It shows fake trend arrows, fake velocity, fake SLA, or fake completion-rate analytics.
- It hides blocked/review/stale work below marketing-style summary cards.

Recommended layout:
- Header strip: board source/freshness/confidence, last event id, latest received time, refresh/reconnect state.
- Left/primary: owner rows with task chips by state and one selected-owner detail lane.
- Right/secondary: blocker/review/stale queues with the most actionable items first.
- Bottom/optional on desktop: compact event timeline from `boardStore.events`.

### 2. Task drawer/actions

Accepted when:
- Selecting a task opens a drawer or detail pane with one clear task record, not a modal stack.
- Drawer content includes:
  - task id, title, body/goal,
  - status, assignee, priority,
  - created/started/completed timestamps,
  - workspace kind/path/branch when present,
  - current run id, worker pid, session id, heartbeat,
  - failure/error summary, warnings, diagnostics,
  - comments count and comments when loaded,
  - parent/child link counts and dependency list when loaded,
  - latest summary/result,
  - skills and model override,
  - source/freshness/confidence.
- Drawer has tabs or stacked sections for `Details`, `Activity`, `Comments`, `Run/Logs`, and `Links`, but does not nest tabs more than one level deep.
- Every action button has an explicit enabled/disabled reason. Disabled must not silently disappear.
- Keyboard path works: open from task row, move through drawer controls, close with Escape, return focus to the originating row.
- Drawer uses `role="dialog"` or a clearly labeled complementary region depending on implementation; labels/aria are present for close and icon-only controls.
- Only one drawer/confirmation surface is active at a time.

Action hierarchy:
- Safe actions: focus owner, open chat with owner, copy task id/path, refresh detail, add comment if adapter is verified.
- Risk actions: reassign, status change, priority change, dependency changes, request review.
- Danger actions: delete/archive, reclaim active task, terminate run.
- Cost/LLM actions: dispatch and decompose. Treat these as high-risk even when not destructive because they can trigger agent work, token spend, and rate limits.

Rejected if:
- The drawer contains raw JSON as the primary UI.
- Action buttons execute optimistically against local UI state without a verified adapter response.
- Failed actions leave the task looking successful.

### 3. Blocker visibility

Accepted when:
- Blocked work has a dedicated queue visible above ordinary backlog.
- Blocker rows combine at least these signals when available:
  - `status === 'blocked'`,
  - `lastFailureError`,
  - `warnings[]`,
  - `consecutiveFailures > 0`,
  - running task with stale/missing heartbeat,
  - worker active without matching running task,
  - task current run id with unavailable run detail/log.
- Blockers use labels and icons/shapes in addition to red/amber color. No color-only meaning.
- Each blocker row names the owner/profile, task id/title, symptom, age/heartbeat if known, and next safe action.
- Blockers are sorted by severity and recency, not by random board order:
  1. active run heartbeat stale/missing,
  2. explicit blocked status,
  3. repeated failures,
  4. warnings/diagnostics,
  5. old review or triage age.
- Stale blocker data is visually distinct from live blocker data. If provenance is stale, the UI says `blocker data stale`, not `all clear`.

Rejected if:
- The only blocker affordance is a red count card.
- Blocked work can be hidden by default filters with no persistent global indicator.
- `blocked` and `review` are treated as interchangeable.

### 4. Selected-agent cross-links with office/chat

Accepted when:
- Selecting an owner/profile in Kanban updates the shared selected-agent state when it is one of the canonical department leads: `cloud`, `biscuit`, `korra`, `lelouch`, `tifa`.
- Selecting an office avatar can focus that owner in Kanban when the Kanban view is active or when the user clicks a `View work` action.
- Selecting a profile in chat can expose a `View current work` action that opens Kanban filtered to that profile.
- Kanban task rows include owner actions:
  - `Focus in office` for known department leads.
  - `Open chat` for profiles where chat surface exists; if chat transport is demo/unavailable, the action is labeled honestly.
  - `Show all tasks by owner`.
- Custom/unknown profiles do not break the cross-link system. They render as non-office profiles and skip `Focus in office` while keeping task filtering and chat if profile metadata exists.
- The selected owner/agent visual treatment is identical in tone across Office, Chat, and Kanban: same profile name, accent, status labels, and unknown/unavailable wording.

Rejected if:
- Kanban creates its own unrelated selected-profile state that can drift from office/chat.
- Cross-link buttons navigate to fake chat endpoints or imply live chat when the current transport is demo/unavailable.

### 5. Dispatch/decompose controls

Accepted when:
- Dispatch and decompose are not header-primary actions. They sit near the relevant task/board context with explicit warnings.
- Dispatch uses verified `POST /api/plugins/kanban/dispatch` or a Cloud-owned adapter only.
- Decompose uses verified `POST /api/plugins/kanban/tasks/{task_id}/decompose` or a Cloud-owned adapter only.
- Both require confirmation before execution.
- Confirmation copy includes:
  - operation,
  - target task or board scope,
  - affected profile/owner if known,
  - whether an LLM/API call may run,
  - cost/rate-limit state or `unknown`,
  - current source/freshness/confidence,
  - duplicate/active-run risk,
  - expected result,
  - rollback/cancel note if any.
- Confirmation default focus is the safe cancel action, matching Phase 6 Korra guidance.
- Enter key must not globally confirm danger/cost actions.
- Dispatch/decompose are disabled when the relevant source is `mock`, `missing`, `stale`, `unknown`, unauthenticated, or adapter-unavailable unless Sora explicitly enables a read-only/demo mode.
- After action completion, the UI waits for adapter response and/or next board event before declaring success. It may show `request sent` separately from `board updated`.
- Duplicate submissions are prevented while a request is pending.

Rejected if:
- A single click can dispatch/decompose work.
- The UI auto-dispatches as a side effect of opening the route or selecting a task.
- Cost/rate-limit state is omitted or shown as healthy without a verified source.

Suggested confirmation language:

```text
Dispatch board work?
Target: <board or task scope>
Source: /api/plugins/kanban · freshness <freshness> · confidence <confidence>
Risk: may start agent work and LLM/API calls. Provider quota is <known value or unknown>.
Duplicate guard: <idempotency key / active run status / unknown>
Default action: Cancel
Confirm action: Dispatch once
```

```text
Decompose task <task_id>?
This may call an LLM to create child tasks.
Owner: <assignee or unassigned>
Cost/rate-limit: <known value or unknown>
Current task state: <status> · <freshness> · <confidence>
Default action: Cancel
Confirm action: Decompose task
```

### 6. Mobile/touch behavior

Accepted when:
- At 375px width, Kanban has no horizontal page scroll.
- Mobile uses a focused mode rather than desktop columns squeezed into tiny cards.
- Recommended mobile structure:
  1. sticky source/freshness/risk strip,
  2. segmented filter: Owners / Blockers / Status / Events,
  3. single-column task rows,
  4. bottom sheet drawer for task detail/actions.
- Touch targets are at least 44x44px for row actions, tabs, segmented controls, drawer close, and confirmation buttons.
- Adjacent touch targets have at least 8px spacing or are separated by an overflow/action sheet.
- Dense desktop row actions collapse into a labeled `Actions` button on mobile; do not create five tiny inline buttons.
- Destructive/danger actions are never adjacent to safe primary actions without spacing and confirmation.
- Drawer/bottom sheet respects safe areas and can be dismissed with Close, Escape, and backdrop where appropriate. Backdrop dismiss must cancel, never confirm.
- Long task titles, paths, and error strings wrap or truncate with accessible full text. They must not force horizontal scroll.
- Reduced motion users get no sweeping drawer animations; use opacity/transform only for others.

Rejected if:
- The route relies on hover-only affordances.
- Task actions require precision tapping on tiny icons.
- Desktop board columns are simply scaled down to phone width.

### 7. Empty, error, stale, unauthorized, and partial states

Accepted when:
- Empty state distinguishes between:
  - no tasks on a verified empty board,
  - filters returning no results,
  - source missing/unavailable,
  - unauthorized session,
  - stale board snapshot,
  - partial task detail load failure.
- Empty copy names the scope, following Lelouch's ambiguity guidance:
  - `No blocked tasks found on verified board snapshot received at <time>.`
  - `No results for owner <profile> with filter <filter>. Clear filters?`
  - `Kanban source unavailable. Last checked <time>. Actions disabled.`
- Stale state never renders as healthy/all clear.
- Unauthorized state routes to auth/session recovery; it does not show an empty board.
- Partial task drawer failures keep loaded safe fields visible and mark missing sections unavailable.
- Event-stream disconnected state says whether REST snapshot is still fresh and whether live updates are paused.
- Unknown action capability is visible near controls, not buried in console logs.

Rejected if:
- A failed board fetch renders as `0 tasks`.
- A stale source shows green all-clear blocker state.
- Action controls remain enabled when source provenance is missing or adapter capability is unknown.

### 8. No generic dashboard/card spam

Accepted when:
- The page feels like Sora Mission Control: dark, dense, precise, operational, and cross-linked to the office scene.
- Visual language uses existing tokens and mission-control primitives: strips, rows, compact status pills, mono metadata, quiet dividers, and focused drawers.
- One primary action is visible per context; dangerous/cost actions are secondary and confirmed.
- Charts are avoided unless they answer an operational question from real data. If added later, every chart needs a table/text fallback and provenance.
- No fake performance/velocity charts, no gradient hero, no generic AI neural motif, no stock admin template card grid.
- Status colors remain semantic and restrained:
  - cyan/green for live/verified movement,
  - amber for stale/warning/cost uncertainty,
  - red for blocked/danger/failure,
  - violet for review/control context.
- No rainbow agent UI beyond existing profile accent tokens.

Rejected if:
- The route opens with a generic KPI grid.
- Visual weight goes to decoration instead of active work, blockers, and safe controls.
- It duplicates the office/chat/ops panels instead of cross-linking to them.

## Exact Biscuit implementation guidance

1. Add `src/components/kanban/ProjectControlSurface.tsx` or `src/modules/kanban/ProjectControlSurface.tsx` and route `view === 'kanban'` to it in all three Shell layouts.
2. Start read-only. Use `boardStore`, `profiles`, `activeWorkers`, and `connectionStore`/provenance first. Do not implement mutations before the Cloud adapter shape is explicit.
3. Build selectors/helpers before visual components:
   - tasks by status,
   - tasks by owner,
   - blocker queue,
   - stale running tasks,
   - review-needed tasks,
   - selected owner task set,
   - task by id.
4. Add a task drawer in read-only mode first. Wire actions only after adapter support is known.
5. Reuse the Phase 6 shared confirmation behavior for any risk/danger/cost action:
   - Cancel focused by default.
   - No global Enter-to-confirm.
   - One confirmation at a time.
   - Detail panel with target, operation, impact, reversibility, cost/rate-limit state, and source confidence.
6. Keep unknown/stale source states as visible strips at the top of the Kanban surface and inside the drawer.
7. Cross-link through shared shell/profile state rather than a private Kanban selection store.
8. For mobile, implement list + bottom sheet; do not squeeze all board columns into one screen.
9. Add tests for selector behavior and empty/stale/unavailable rendering before adding mutation tests.
10. After Phase 6 TypeScript repair, run the narrowest new Kanban tests first, then `npm run lint` when shared types/routes are touched.

## Exact Cloud adapter guidance

1. Provide a typed Kanban action adapter around verified `/api/plugins/kanban` routes. UI should never assemble direct DB writes.
2. Each adapter method must return capability/provenance metadata or a typed unavailable state.
3. Required read methods:
   - board snapshot,
   - task detail `/tasks/{task_id}`,
   - comments,
   - events/timeline,
   - links,
   - run detail and log when `currentRunId` exists,
   - diagnostics,
   - active workers.
4. Required mutation methods, with capability flags and confirmation requirements:
   - patch task fields,
   - append comment,
   - reassign,
   - add/remove dependency,
   - reclaim active task,
   - terminate run,
   - dispatch,
   - decompose.
5. Adapter errors must be sanitized before entering UI state. Error strings can contain paths and task ids, but not secrets/tokens.
6. Dispatch/decompose responses must distinguish `request accepted` from `task actually changed`.
7. Provider quota/cost state must remain `unknown` unless a verified source exists. Do not infer safety from historical usage.

## Suggested acceptance tests

Read-only tests:
- Fresh verified empty board renders verified empty state, not source error.
- Missing board source renders unavailable state and disables actions.
- Stale board source renders stale warning and does not show all-clear blockers.
- Unknown custom assignee renders without crashing and without office focus button.
- Known assignee renders `Focus in office`, `Open chat`, and owner filter actions.
- Blocker queue includes explicit blocked tasks, failure tasks, warning tasks, and stale heartbeat tasks.
- Drawer closes with Escape and returns focus to source row.
- Mobile layout renders action sheet/bottom drawer with 44px controls.

Mutation/control tests after adapter exists:
- Dispatch requires confirmation and Cancel is initially focused.
- Decompose requires confirmation with cost/rate-limit `unknown` shown when unverified.
- Reclaim/terminate/delete require danger confirmation and cannot be confirmed by stray Enter.
- Pending action disables duplicate submission.
- Failed adapter response keeps task state unchanged and shows sanitized error.
- Successful request shows `request sent` until board event/snapshot confirms change.

## Verification note for this Korra pass

Docs-only pass. No runtime UI/code changes were made because the current route is honestly reserved and Phase 6 TypeScript/build repair is documented as a blocker for safe UI implementation. Verification should be file readback only.

## Phase status note

No root project phase status change recommended from this audit. Phase 7 remains not started, but now has Korra acceptance criteria ready for Biscuit/Cloud implementation.
