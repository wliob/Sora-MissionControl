/**
 * Canonical board-state models for the Phase 4 backbone.
 *
 * These are the single source of truth for Kanban board shape inside
 * Sora-MissionControl. Both remote (Hermes dashboard REST/WS) and local
 * runtime sources normalize into these types, so downstream consumers
 * (office FSM, Kanban UI, chat status) never branch on source.
 *
 * The shapes are derived from the verified Hermes Kanban API in
 * docs/api-reference.md (runtime-observed response shape and task card keys),
 * NOT from the v2 standalone's simplified `Task`/`Board`/`WsEvent` types.
 * The v2 types are intentionally narrower (4 columns, subset of fields);
 * adapters are responsible for mapping both into these canonical models.
 *
 * Invariants:
 *  - IDs are stable strings. Task ids are `t_<hex>`; profile ids match the
 *    AgentId union in index.ts. Adapters must not synthesize new ids.
 *  - Timestamps are ISO 8601 strings when set, null when absent. The API
 *    returns epoch seconds for `created_at`/`completed_at`/`now`; adapters
 *    convert to ISO strings at normalization time so UI never parses epochs.
 *  - `status` is exactly the 8-value KanbanStatus union verified at runtime.
 *    Adapters reject unknown statuses rather than coercing them.
 *  - Every entity can be wrapped in Tracked<> for provenance; the board
 *    snapshot itself always carries provenance so UI can show staleness.
 */

import type { Tracked } from './provenance';
import { tracked } from './provenance';

// ── Status ──────────────────────────────────────────────────────────────

/**
 * The exact 8 Kanban columns verified at runtime on the local Hermes host.
 * Source: docs/api-reference.md "Observed columns on local runtime".
 *
 * Adapters MUST reject unknown status strings rather than coercing them to
 * a default — an unknown status is a schema drift signal, not a 'todo'.
 */
export type KanbanStatus =
  | 'triage'
  | 'todo'
  | 'scheduled'
  | 'ready'
  | 'running'
  | 'blocked'
  | 'review'
  | 'done';

/** Ordered list for consistent column rendering. */
export const KANBAN_COLUMN_ORDER: KanbanStatus[] = [
  'triage',
  'todo',
  'scheduled',
  'ready',
  'running',
  'blocked',
  'review',
  'done',
];

/**
 * Runtime type guard for KanbanStatus. Adapters use this to validate
 * upstream payloads; unknown values produce a normalization error instead
 * of a silent default.
 */
export function isKanbanStatus(value: unknown): value is KanbanStatus {
  return (
    typeof value === 'string' &&
    (KANBAN_COLUMN_ORDER as string[]).includes(value)
  );
}

// ── Workspace ─────────────────────────────────────────────────────────────

/**
 * Where a task's working files live. Matches the Kanban dispatcher's
 * `workspace_kind` values. Adapters coerce the API's `workspace_kind` string
 * into this union; unknown values fall back to 'scratch' with a note.
 */
export type WorkspaceKind = 'scratch' | 'dir' | 'worktree';

// ── Task ──────────────────────────────────────────────────────────────────

/**
 * A canonical Kanban task card. This is the normalized shape both the REST
 * adapter (from /api/plugins/kanban/board) and the WS event adapter produce.
 *
 * Field-by-field provenance (from docs/api-reference.md observed keys):
 *  - id, title, body, assignee, status, priority, created_by, created_at,
 *    started_at, completed_at, workspace_kind, workspace_path, tenant,
 *    branch_name, result, idempotency_key, consecutive_failures,
 *    worker_pid, last_failure_error, max_runtime_seconds, last_heartbeat_at,
 *    current_run_id, workflow_template_id, current_step_key, skills,
 *    model_override, max_retries, goal_mode, goal_max_turns, session_id,
 *    age, latest_summary, link_counts, comment_count, progress,
 *    diagnostics, warnings
 *
 * Invariants:
 *  - `id` is always present and non-empty.
 *  - `status` is always a valid KanbanStatus (validated by isKanbanStatus).
 *  - `assignee` is null when unassigned; when set it MUST be a known AgentId
 *    OR a free-form string (the API returns arbitrary profile names; UI
 *    renders unknown assignees as-is, not as errors).
 *  - Epoch-second fields from the API (created_at, completed_at, etc.) are
 *    converted to ISO 8601 strings at normalization; null stays null.
 *  - `priority` is a number; the API uses it as a dispatcher tiebreaker.
 *  - `skills` is a string array; never null (default []).
 *  - `progress` is 0..1 when present; null when the task has no progress info.
 */
export interface KanbanTaskCard {
  id: string;
  title: string;
  body: string;
  /** Assignee profile name; null when unassigned. May be outside the AgentId union. */
  assignee: string | null;
  status: KanbanStatus;
  priority: number;
  /** Profile name that created the task; null if unknown. */
  createdBy: string | null;
  /** ISO 8601 creation timestamp; null if not set. */
  createdAt: string | null;
  /** ISO 8601 start timestamp; null if not started. */
  startedAt: string | null;
  /** ISO 8601 completion timestamp; null if not completed. */
  completedAt: string | null;
  workspaceKind: WorkspaceKind;
  /** Absolute path when workspaceKind is dir/worktree; null for scratch. */
  workspacePath: string | null;
  /** Tenant namespace; null when no tenant. */
  tenant: string | null;
  /** Git branch name for worktree workspaces; null otherwise. */
  branchName: string | null;
  /** Free-form result/handoff string; null until the task completes. */
  result: string | null;
  /** Dedup key; null if not set. */
  idempotencyKey: string | null;
  /** Count of consecutive dispatch failures; 0 when healthy. */
  consecutiveFailures: number;
  /** OS pid of the active worker process; null when no active run. */
  workerPid: number | null;
  /** Non-secret last failure error message; null when no failure. */
  lastFailureError: string | null;
  /** Per-task runtime cap in seconds; null when using the default. */
  maxRuntimeSeconds: number | null;
  /** ISO 8601 timestamp of the last worker heartbeat; null when no active run. */
  lastHeartbeatAt: string | null;
  /** Active run id; null when no run is in flight. */
  currentRunId: string | null;
  /** Workflow template id when the task is part of a workflow; null otherwise. */
  workflowTemplateId: string | null;
  /** Current workflow step key; null when not in a workflow. */
  currentStepKey: string | null;
  /** Skills force-loaded for the task; never null (default []). */
  skills: string[];
  /** Per-task model override; null when using the profile default. */
  modelOverride: string | null;
  /** Max retry count; null when using the default. */
  maxRetries: number | null;
  /** Whether the task runs in goal-loop mode. */
  goalMode: boolean;
  /** Turn budget for goal-mode tasks; null when not in goal mode. */
  goalMaxTurns: number | null;
  /** Chat session id associated with the run; null when none. */
  sessionId: string | null;
  /** Age in seconds since creation (API-provided convenience field). */
  age: number | null;
  /** Latest run summary; null when no run has completed. */
  latestSummary: string | null;
  /** Counts of parent/child links; { parents: n, children: n } when present. */
  linkCounts: { parents: number; children: number } | null;
  /** Number of comments on the task thread; 0 when none. */
  commentCount: number;
  /** 0..1 progress fraction when the task reports progress; null otherwise. */
  progress: number | null;
  /** Board health diagnostics blob; null when not provided. */
  diagnostics: Record<string, unknown> | null;
  /** Advisory warnings array; never null (default []). */
  warnings: string[];
}

// ── Board snapshot ────────────────────────────────────────────────────────

/**
 * A board column in canonical form. `name` is the KanbanStatus; `tasks` is
 * the normalized task list for that column.
 */
export interface KanbanColumn {
  name: KanbanStatus;
  tasks: KanbanTaskCard[];
}

/**
 * The canonical board snapshot. This is what the REST adapter returns from
 * `/api/plugins/kanban/board` and what the WS event reducer updates in place.
 *
 * Invariants:
 *  - `columns` always contains exactly the 8 KanbanStatus columns in
 *    KANBAN_COLUMN_ORDER, even if some are empty. Adapters fill missing
 *    columns with empty task arrays rather than omitting them.
 *  - `assignees` and `tenants` are the rosters reported by the API; they may
 *    contain profile names outside the AgentId union (UI renders as-is).
 *  - `latestEventId` is the WS event cursor; null when no events have been
 *    received. Used for reconnect resume.
 *  - `serverNow` is the server's wall clock as an ISO 8601 string (the API
 *    returns epoch seconds in `now`); adapters convert at normalization.
 */
export interface KanbanBoardSnapshot {
  columns: KanbanColumn[];
  /** All assignee profile names seen across tasks; may include non-AgentId names. */
  assignees: string[];
  /** All tenant namespaces seen across tasks; may be empty. */
  tenants: string[];
  /** Highest WS event id received; null when no events yet. */
  latestEventId: number | null;
  /** Server wall clock at snapshot time (ISO 8601). */
  serverNow: string;
}

// ── WS events ─────────────────────────────────────────────────────────────

/**
 * Kanban websocket event types, verified from v2 code and the Hermes Kanban
 * plugin source. The office FSM branches on these to drive agent activity.
 *
 * Source: shared/phase0-biscuit-v2-reuse.md §4 event-type table.
 */
export type KanbanWsEventType =
  | 'task.created'
  | 'task.claimed'
  | 'task.started'
  | 'task.blocked'
  | 'task.unblocked'
  | 'task.review_requested'
  | 'task.completed'
  | 'task.archived'
  | 'task.reassigned'
  // Forward-compat: the Hermes plugin may emit event types the v2 code did
  // not enumerate. Adapters normalize known types and pass unknown types
  // through with the raw string so UI can surface drift.
  | (string & {});

/**
 * A single normalized WS event from `/api/plugins/kanban/events`.
 *
 * Invariants:
 *  - `eventId` is the monotonic event id from the server, used for resume.
 *  - `type` is one of the known KanbanWsEventType values OR a raw string for
 *    unknown event types (forward-compat).
 *  - `task` is the canonical KanbanTaskCard at the time of the event. For
 *    events that only carry an id, the adapter fetches the full task or
 *    carries the last-known snapshot.
 *  - `previousAssignee`/`newAssignee` are present only for reassignment.
 *  - `timestamp` is ISO 8601 (the server may send epoch seconds; adapters
 *    convert).
 */
export interface KanbanWsEvent {
  /** Monotonic server event id; used for reconnect resume. */
  eventId: number;
  type: KanbanWsEventType;
  task: KanbanTaskCard;
  previousAssignee?: string | null;
  newAssignee?: string | null;
  /** ISO 8601 event timestamp. */
  timestamp: string;
}

/**
 * Narrowing guard for the known WS event types. Returns false for unknown
 * strings so the reducer can route them to a default branch.
 */
export function isKnownKanbanWsEventType(
  value: unknown,
): value is Exclude<KanbanWsEventType, string & {}> {
  const known: string[] = [
    'task.created',
    'task.claimed',
    'task.started',
    'task.blocked',
    'task.unblocked',
    'task.review_requested',
    'task.completed',
    'task.archived',
    'task.reassigned',
  ];
  return typeof value === 'string' && known.includes(value);
}

// ── Provenance-wrapped board value ─────────────────────────────────────────

/** The canonical board store value: the snapshot plus provenance. */
export type KanbanBoardState = Tracked<KanbanBoardSnapshot>;

/** Convenience factory for the pre-load board state. */
export function initialBoardState(): KanbanBoardState {
  const empty: KanbanBoardSnapshot = {
    columns: KANBAN_COLUMN_ORDER.map((name) => ({ name, tasks: [] })),
    assignees: [],
    tenants: [],
    latestEventId: null,
    serverNow: new Date().toISOString(),
  };
  return tracked(empty, {
    source: 'unknown',
    freshness: 'missing',
    confidence: 'unknown',
  });
}

// ── Active workers (ops surface) ──────────────────────────────────────────

/**
 * An active worker row from `/api/plugins/kanban/workers/active`. Used by
 * the ops/admin modules to show what is running right now.
 */
export interface ActiveWorker {
  /** Task id the worker is running. */
  taskId: string;
  /** Profile name running the task. */
  assignee: string;
  /** OS pid of the worker process. */
  pid: number;
  /** Run id; null if not yet assigned. */
  runId: string | null;
  /** ISO 8601 start timestamp; null if unknown. */
  startedAt: string | null;
  /** ISO 8601 timestamp of the last heartbeat; null if none. */
  lastHeartbeatAt: string | null;
}

/** A list of active workers wrapped in provenance. */
export type ActiveWorkerReport = Tracked<ActiveWorker[]>;

// ── Board list (admin surface) ─────────────────────────────────────────────

/**
 * A board summary from `/api/plugins/kanban/boards`. Used by the admin
 * module's board switcher.
 */
export interface KanbanBoardSummary {
  /** Board slug identifier. */
  slug: string;
  /** Human-readable board name. */
  name: string;
  /** Whether this is the currently active board. */
  isActive: boolean;
  /** Task count on the board; null if unknown. */
  taskCount: number | null;
}

/** A list of boards wrapped in provenance. */
export type KanbanBoardList = Tracked<KanbanBoardSummary[]>;

// ── Profile roster (shared profile store) ─────────────────────────────────

/**
 * A profile roster entry from `/api/plugins/kanban/profiles`. Shared by the
 * chat, office, and admin modules.
 *
 * Invariants:
 *  - `name` is the canonical profile name (matches AgentId when it's a
 *    known department lead; may be other names for custom profiles).
 *  - `gatewayStatus`/`modelStatus` are non-secret presence/status strings.
 *  - `skillCount` is advisory; -1 when unknown.
 */
export interface ProfileRosterEntry {
  name: string;
  /** Human-readable description; null if not set. */
  description: string | null;
  /** Gateway status string (non-secret); null if unknown. */
  gatewayStatus: string | null;
  /** Configured model summary (non-secret); null if unknown. */
  modelSummary: string | null;
  /** Count of installed skills; -1 when unknown. */
  skillCount: number;
}

/** The profile roster wrapped in provenance. */
export type ProfileRoster = Tracked<ProfileRosterEntry[]>;

// ── Re-export for convenience ──────────────────────────────────────────────

export type { AgentId } from './agents';
export type { Provenance, Tracked } from './provenance';