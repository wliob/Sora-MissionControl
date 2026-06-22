# Sora-MissionControl — Canonical Data Contract Invariants

> Task: t_9aa34f09 — Define canonical auth and board state models
> Status: Phase 4 data-contract freeze
> Scope: auth/session, connection health, board state, provenance
> Owners: Biscuit (models), Cloud (adapter implementations), Rain (backbone integration)

This document is the authoritative invariant list for the canonical models in
`src/types/`. Adapters (Cloud-owned, Phase 4) MUST satisfy these invariants
when normalizing Hermes dashboard API data and local runtime data. UI modules
consume the typed stores and rely on these invariants holding.

---

## 1. Provenance — `src/types/provenance.ts`

Every data item exposed to UI carries provenance (docs/section-contracts.md
§Global rules #4). Provenance is how the app distinguishes remote from local
data and how it renders unknown states honestly.

| # | Invariant | Rationale |
|---|-----------|-----------|
| P1 | `source` is always set; never omit it. Use `'unknown'` rather than leaving it undefined. | Consumers branch on source to pick render rules; undefined would be treated as a bug, not as unknown. |
| P2 | `freshness` defaults to `'missing'` until the adapter emits the first real value. UI must not assume `'live'`. | Prevents a stale-but-green render on first paint. |
| P3 | `confidence` is `'verified'` only for Phase-0-verified surfaces (docs/api-reference.md). New/unconfirmed endpoints start at `'unverified'`. | Stops unverified endpoints from being presented as trusted. |
| P4 | `receivedAt` is set by the adapter at normalization time (ISO 8601), not the upstream timestamp. | Separates "when did Hermes emit this" from "when did we process it" — needed for staleness math. |
| P5 | `tracked(value, { source })` defaults freshness to `'missing'` and confidence to `'unknown'` so callers must consciously upgrade them. | Fail-safe: never silently assume live/verified. |

---

## 2. Auth / Session — `src/types/auth.ts`

The shared auth store owns auth state as a single source of truth. Office,
chat, ops, and admin modules consume the typed session and must not maintain
parallel auth state.

| # | Invariant | Rationale |
|---|-----------|-----------|
| A1 | No secret values appear in `AuthSession` or store payloads. `hasToken` is presence-only; the token value lives in the trusted local process / httpOnly cookie. | docs/section-contracts.md §Forbidden dependencies: "No secret values in returned payloads." |
| A2 | `AuthSessionStatus` transitions are owned by the shared auth store. The transition graph is: idle → validating → authenticated; validating → unauthenticated (401) or auth_error (network/parse); authenticated → refreshing → authenticated or unauthenticated; any → idle (logout). | Centralizes the auth lifecycle so UI never infers auth state from side effects. |
| A3 | `validatedAt` / `expiresAt` are null until the adapter has actually validated. UI treats null as "unknown", not "infinite session". | Prevents showing a session as permanent when its expiry is simply unknown. |
| A4 | `invalidationReason` is set on unauthenticated/auth_error transitions so UI can show the right prompt (re-auth vs network retry vs parse error). | Avoids generic "auth failed" banners that hide the actionable cause. |
| A5 | `CredentialStatus` is presence-only (`configured` / `missing` / `error` / `unknown`). It never carries the credential value. | docs/api-reference.md §Gaps: "Credential management must remain status-only." |
| A6 | `emptyCredentialReport()` returns an empty array wrapped in provenance, not null. Consumers iterate without null-guarding. | Array-valued reports are always arrays; null is reserved for "not yet loaded" at the Tracked.value level. |

---

## 3. Connection Health — `src/types/connection.ts`

Health is per-source, never a single global flag. Different Hermes surfaces
(REST board, WS events, profile CLI, usage) can be healthy or down
independently.

| # | Invariant | Rationale |
|---|-----------|-----------|
| C1 | `ConnectionState.sources` always contains an entry for every known `HealthSourceId`. Missing sources default to `unknownSourceHealth` (state `'unknown'`), never omitted. | Omission would let UI accidentally render a missing source as healthy. |
| C2 | `'unknown'` is a first-class `TransportState`. UI MUST render it as unknown, never as green/healthy. | docs/section-contracts.md §Live ops forbidden: "Unknown must display as `unknown`, not green." |
| C3 | `unauthorized` is distinct from `offline` so UI can prompt re-auth rather than show a generic offline banner. | 401 and network-down need different user actions. |
| C4 | `lastOkAt` is null until a successful probe; it is NOT set on degraded/offline/unauthorized transitions. `lastCheckedAt` is null only before the first probe. | Keeps "last known good" honest — a degraded source does not update lastOkAt. |
| C5 | `latencyMs` is optional and only meaningful when state is `connected` or `degraded`. UI must not display latency for offline/unknown. | Latency on a dead source is meaningless and misleading. |
| C6 | `ReconnectState` is tracked separately from `TransportState` so UI can show "reconnecting in 3s" without conflating it with transport up/down. | Backoff is a sub-state of offline/reconnecting, not a transport state. |
| C7 | `reconnect.attempt` resets to 0 on a successful connect. `nextAttemptAt` is null when phase is idle/connected/backoff-disabled. | Prevents the UI from showing a stale "reconnecting in Ns" after recovery. |
| C8 | `SyncIndicator.lastSyncAt` is null until real data has been received and normalized — distinct from transport health. A source can be connected but stale. | Transport up ≠ data fresh. The ops panel needs both signals. |
| C9 | `overall` is a derived rollup (`rollupOverall`): the worst non-unknown state across sources, or `'unknown'` if all are unknown. UI must not use it to mask per-source detail in ops panels. | Shell chrome needs one value; ops panels need the per-source breakdown. |
| C10 | `error` on `SourceHealth` is a non-secret human-readable string; never include tokens, response bodies, or stack traces. | Errors are visible in UI/logs; secrets must not leak through them. |

---

## 4. Board State — `src/types/board.ts`

The canonical board shape that both remote (Hermes dashboard REST/WS) and
local runtime sources normalize into. Downstream consumers (office FSM,
Kanban UI, chat status) never branch on source.

| # | Invariant | Rationale |
|---|-----------|-----------|
| B1 | `KanbanStatus` is exactly the 8-value union verified at runtime (triage, todo, scheduled, ready, running, blocked, review, done). Adapters reject unknown statuses via `isKanbanStatus` rather than coercing to a default. | An unknown status is schema drift, not a `'todo'`. Silent coercion would hide drift. |
| B2 | `KanbanBoardSnapshot.columns` always contains exactly the 8 columns in `KANBAN_COLUMN_ORDER`, even if some are empty. Adapters fill missing columns with empty task arrays. | UI can render a stable column layout without guarding for missing columns. |
| B3 | Task ids are stable strings (`t_<hex>`). Adapters must not synthesize new ids. | The office FSM, Kanban drawer, and WS reducer all key on task id; synthesized ids break idempotency. |
| B4 | Epoch-second fields from the API (`created_at`, `completed_at`, `now`, etc.) are converted to ISO 8601 strings at normalization; null stays null. UI never parses epochs. | One timestamp format across the app; UI doesn't need to know which fields are epochs vs ISO. |
| B5 | `assignee` is null when unassigned; when set it MAY be outside the `AgentId` union (the API returns arbitrary profile names). UI renders unknown assignees as-is, not as errors. | The API can return custom profiles; treating them as errors would break rendering. |
| B6 | `skills` and `warnings` are never null (default `[]`). `progress` is 0..1 when present, null when the task has no progress info. | Array fields are always arrays so UI can `.map()` without null guards. |
| B7 | `latestEventId` is the WS event cursor; null when no events received. Used for reconnect resume. | Reconnect must resume from the last event id, not re-fetch the whole board. |
| B8 | `serverNow` is the server wall clock as ISO 8601 (the API returns epoch seconds in `now`); adapters convert at normalization. | UI clock-skew math needs a comparable server timestamp. |
| B9 | `KanbanWsEvent.type` is one of the known 9 event types OR a raw string (forward-compat). `isKnownKanbanWsEventType` narrows; unknown types pass through so UI can surface drift. | The Hermes plugin may emit new event types; the reducer must not silently drop them. |
| B10 | `KanbanWsEvent.task` is the canonical `KanbanTaskCard` at event time. For events carrying only an id, the adapter fetches the full task or carries the last-known snapshot. | The office FSM and reducer need a full task, not just an id, to transition correctly. |
| B11 | `KanbanWsEvent.timestamp` is ISO 8601; the server may send epoch seconds and adapters convert. | Consistent with B4. |
| B12 | `initialBoardState()` returns an empty-but-valid snapshot (8 empty columns) wrapped in provenance `source: 'unknown', freshness: 'missing'`. UI can render the board layout before any data arrives. | No null-board special case in UI. |

---

## 5. Agents — `src/types/agents.ts`

The canonical agent roster. Kept in its own module so auth/board/connection
can import it without a circular dependency on `index.ts`.

| # | Invariant | Rationale |
|---|-----------|-----------|
| G1 | `AgentId` is the 5 department-lead profile ids. Custom profiles are represented as free-form strings elsewhere (e.g. `KanbanTaskCard.assignee`), not by extending this union. | Extending the union would require regenerating office assets/desks; custom profiles are a UI-string concern. |
| G2 | `AgentActivity` is a derived value computed by the office module from board snapshots and WS events, not a stored field. | The FSM owns activity derivation; stores should not cache a parallel activity map. |
| G3 | `isAgentId` validates assignee fields that may contain arbitrary profile names. | Adapters use it to decide whether to map an assignee to a known agent or render it as a free-form string. |

---

## 6. Cross-cutting invariants

| # | Invariant | Rationale |
|---|-----------|-----------|
| X1 | Every canonical model file is the single source of truth for its domain. `index.ts` re-exports for convenience; it does not define new types (except the Phase 1 shell-facing aliases kept for backwards compatibility). | One definition per concept; no shadow types in the barrel. |
| X2 | The Phase 1 `ConnectionState` enum alias in `index.ts` maps to `TransportState`. The full per-source record is `ConnectionStateRecord` (or import from `@/types/connection` directly). | Avoids a name clash between the old shell enum and the new per-source record without breaking existing imports. |
| X3 | `Tracked<T>` wraps any value with `Provenance`. Stores expose `Tracked<T>` selectors; UI reads `.value` and `.provenance`. | Uniform shape for "value + where it came from" across all stores. |
| X4 | No model file imports from `index.ts` (only from sibling `./` modules). This prevents circular imports. | The barrel is a consumer, not a dependency of the canonical modules. |
| X5 | All timestamp fields are ISO 8601 strings or null. No epoch numbers, no `Date` objects, no "relative" strings in the models. | UI formatters convert to display strings; models carry one wire format. |
| X6 | No secret values anywhere in the model layer. Tokens/keys are presence-only (`hasToken`, `CredentialPresence`) or masked display strings. The trusted local process holds the real values. | docs/section-contracts.md §Global rules #3: "Secrets never leave the backend/trusted local process." |
| X7 | Models support both remote and local sources without ambiguity via the `DataSource` union on `Provenance`. Adapters tag every normalized value; UI never guesses the source from heuristics. | The acceptance criterion: "can support both remote and local sources without ambiguity." |

---

## 7. Acceptance criteria traceability

From task t_9aa34f09 body:

| Criterion | Where satisfied |
|-----------|-----------------|
| "documented canonical schema or type set exists" | `src/types/{provenance,auth,connection,board,agents}.ts` + this doc |
| "covers all required entities" | auth/session (auth.ts), connection-health (connection.ts), board state (board.ts), provenance (provenance.ts), agents (agents.ts) |
| "specify fields, IDs, timestamps, loading/error states" | field-level JSDoc in each file; timestamp invariants §X5; loading/error via `Tracked<T>` + `Provenance.freshness`/`.confidence`; status enums for auth (A2) and connection (C1-C3) |
| "invariants needed to keep dashboard API data and local runtime data consistent" | §1-6 above; X7 directly addresses remote-vs-local ambiguity |
| "can support both remote and local sources without ambiguity" | `DataSource` union (P1, X7); adapters tag every value |

---

## 8. File map

| File | Domain | LOC | Exports |
|------|--------|-----|---------|
| `src/types/provenance.ts` | Provenance envelope | ~95 | DataSource, Freshness, Confidence, Provenance, Tracked, tracked() |
| `src/types/auth.ts` | Auth/session + credentials | ~150 | AuthSession, AuthSessionStatus, AuthInvalidationReason, CredentialStatus, CredentialStatusReport, initialAuthSession, emptyCredentialReport, initialAuthSessionState |
| `src/types/connection.ts` | Connection health | ~250 | TransportState, SourceHealth, HealthSourceId, ReconnectState, SyncIndicator, ConnectionState, unknownSourceHealth, idleReconnectState, missingSyncIndicator, initialConnectionState, rollupOverall, initialConnectionStateValue |
| `src/types/board.ts` | Board state + WS events | ~400 | KanbanStatus, WorkspaceKind, KanbanTaskCard, KanbanColumn, KanbanBoardSnapshot, KanbanWsEventType, KanbanWsEvent, ActiveWorker, KanbanBoardSummary, ProfileRosterEntry, KANBAN_COLUMN_ORDER, isKanbanStatus, isKnownKanbanWsEventType, initialBoardState |
| `src/types/agents.ts` | Agent roster | ~65 | AgentId, AgentMeta, AgentActivity, AGENTS, ACTIVITY_META, isAgentId |
| `src/types/index.ts` | Barrel + Phase 1 aliases | ~150 | re-exports + ConnectionState (alias), PrimaryView, STATUS_META |
| `docs/canonical-model-invariants.md` | This document | — | Invariant list |

Sibling-worker files (NOT owned by this task, consume the models above):
- `src/types/admin.ts` — admin/control models (task t_50060e60)
- `src/types/admin-keymcp.ts` — keys/MCP models (task t_b6340e92)
- `src/types/workState.ts` — work-state projection (task t_b6340e92)