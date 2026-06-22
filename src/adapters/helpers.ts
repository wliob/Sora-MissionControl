/**
 * Shared adapter helpers for normalizing Hermes dashboard API payloads
 * and local runtime objects into the canonical Phase 4 models.
 *
 * All adapters use these helpers so the normalization logic is consistent:
 *   - Epoch seconds → ISO 8601 strings (invariant B4/X5)
 *   - Snake_case → camelCase field mapping
 *   - Safe defaults for missing/partial fields
 *   - Deterministic output (no Date.now() calls; timestamps come from
 *     `receivedAt` set via `tracked()`)
 *
 * See docs/canonical-model-invariants.md for the invariants these helpers
 * enforce.
 */

import type { KanbanStatus, WorkspaceKind } from '@/types/board';
import { isKanbanStatus, KANBAN_COLUMN_ORDER } from '@/types/board';

// ── Timestamp conversion ────────────────────────────────────────────────

/**
 * Convert an epoch-second timestamp to an ISO 8601 string.
 * Returns null if the input is null, undefined, 0, or not a finite number.
 *
 * Invariant B4: "Epoch-second fields from the API are converted to ISO 8601
 * strings at normalization; null stays null."
 * Invariant X5: "All timestamp fields are ISO 8601 strings or null."
 */
export function epochToIso(epoch: number | null | undefined): string | null {
  if (epoch == null || !Number.isFinite(epoch) || epoch === 0) {
    return null;
  }
  return new Date(epoch * 1000).toISOString();
}

/**
 * Convert an epoch-millisecond timestamp to an ISO 8601 string.
 * Returns null if the input is null, undefined, 0, or not a finite number.
 */
export function epochMsToIso(epochMs: number | null | undefined): string | null {
  if (epochMs == null || !Number.isFinite(epochMs) || epochMs === 0) {
    return null;
  }
  return new Date(epochMs).toISOString();
}

// ── Status validation ───────────────────────────────────────────────────

/**
 * Validate a KanbanStatus value from an upstream payload.
 *
 * Invariant B1: "Adapters reject unknown statuses via isKanbanStatus rather
 * than coercing to a default." Unknown statuses produce a normalization
 * error, not a silent default.
 *
 * @returns The validated KanbanStatus.
 * @throws NormalizationError if the value is not a valid KanbanStatus.
 */
export function validateKanbanStatus(value: unknown): KanbanStatus {
  if (isKanbanStatus(value)) {
    return value;
  }
  throw new NormalizationError(
    `Invalid KanbanStatus: ${JSON.stringify(value)}. ` +
    `Expected one of: ${KANBAN_COLUMN_ORDER.join(', ')}`,
    'status',
  );
}

/**
 * Coerce a workspace_kind string into the canonical WorkspaceKind union.
 * Unknown values fall back to 'scratch' with a note, matching the
 * board.ts invariant that unknown workspace kinds default safely.
 */
export function coerceWorkspaceKind(value: unknown): WorkspaceKind {
  if (value === 'scratch' || value === 'dir' || value === 'worktree') {
    return value;
  }
  // Default to scratch for unknown values — safe, non-destructive.
  return 'scratch';
}

// ── Error class ─────────────────────────────────────────────────────────

/**
 * Error thrown when an adapter cannot normalize a payload field.
 *
 * Carries the field name so downstream consumers (store ingest logic,
 * error surfaces) can report which field failed without parsing the
 * message string.
 */
export class NormalizationError extends Error {
  /** The field that failed normalization. */
  readonly field: string;

  constructor(message: string, field: string) {
    super(message);
    this.name = 'NormalizationError';
    this.field = field;
  }
}

// ── Column normalization ────────────────────────────────────────────────

/**
 * Ensure all 8 canonical columns exist in the columns map, filling
 * missing ones with empty task arrays.
 *
 * Invariant B2: "KanbanBoardSnapshot.columns always contains exactly the
 * 8 columns in KANBAN_COLUMN_ORDER, even if some are empty."
 */
export function ensureAllColumns<T>(
  columns: Partial<Record<KanbanStatus, T[]>>,
  _empty: () => T,
): Array<{ name: KanbanStatus; tasks: T[] }> {
  return KANBAN_COLUMN_ORDER.map((name) => ({
    name,
    tasks: columns[name] ?? [],
  }));
}

// ── Array safety ────────────────────────────────────────────────────────

/**
 * Ensure a value is an array. Returns [] for null/undefined/non-array.
 *
 * Invariant B6: "skills and warnings are never null (default [])."
 */
export function ensureArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  return [];
}

/**
 * Clamp a progress value to 0..1, or null if not a valid fraction.
 *
 * Invariant B6: "progress is 0..1 when present, null when the task has
 * no progress info."
 */
export function normalizeProgress(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.min(1, value));
}

// ── Nullable string ─────────────────────────────────────────────────────

/**
 * Normalize a nullable string field. Empty strings become null.
 * Non-string values become null.
 */
export function nullableString(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return null;
}

/**
 * Normalize a nullable number field. Non-finite values become null.
 */
export function nullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return null;
}

/**
 * Normalize a boolean field. Defaults to false for non-boolean values.
 */
export function normalizeBoolean(value: unknown, defaultValue = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  return defaultValue;
}

// ── Raw API task type ───────────────────────────────────────────────────

/**
 * The raw task shape from the Hermes Kanban REST API
 * (GET /api/plugins/kanban/board and GET /api/plugins/kanban/tasks/:id).
 *
 * Field names are snake_case (matching the Python dataclass and JSON
 * serialization). Timestamps are epoch seconds. Optional fields may be
 * null or absent.
 *
 * This type is intentionally loose (all optional) so the adapter can
 * handle partial payloads without TypeScript narrowing noise. The adapter
 * validates and fills defaults for every field.
 */
export interface RawApiTask {
  id?: string;
  title?: string;
  body?: string | null;
  assignee?: string | null;
  status?: string;
  priority?: number;
  created_by?: string | null;
  created_at?: number | null;
  started_at?: number | null;
  completed_at?: number | null;
  workspace_kind?: string;
  workspace_path?: string | null;
  tenant?: string | null;
  branch_name?: string | null;
  result?: string | null;
  idempotency_key?: string | null;
  consecutive_failures?: number;
  worker_pid?: number | null;
  last_failure_error?: string | null;
  max_runtime_seconds?: number | null;
  last_heartbeat_at?: number | null;
  current_run_id?: number | null;
  workflow_template_id?: string | null;
  current_step_key?: string | null;
  skills?: string[] | null;
  model_override?: string | null;
  max_retries?: number | null;
  goal_mode?: boolean;
  goal_max_turns?: number | null;
  session_id?: string | null;
  age?: number | { created_age_seconds?: number | null; started_age_seconds?: number | null; time_to_complete_seconds?: number | null } | null;
  latest_summary?: string | null;
  link_counts?: { parents: number; children: number } | null;
  comment_count?: number;
  progress?: { done: number; total: number } | null;
  diagnostics?: Record<string, unknown> | null;
  warnings?: string[] | null;
  // claim_lock and claim_expires are API fields but not in the canonical model
  claim_lock?: string | null;
  claim_expires?: number | null;
}

/**
 * The raw board response from GET /api/plugins/kanban/board.
 */
export interface RawBoardResponse {
  columns?: Array<{ name?: string; tasks?: RawApiTask[] }>;
  tenants?: string[];
  assignees?: string[];
  latest_event_id?: number | null;
  now?: number;
}

/**
 * The raw WS event from /api/plugins/kanban/events.
 * Each event row has: id, task_id, run_id, kind, payload, created_at (epoch).
 */
export interface RawWsEvent {
  id?: number;
  task_id?: string;
  run_id?: number | null;
  kind?: string;
  payload?: Record<string, unknown> | null;
  created_at?: number;
}

/**
 * Raw WS batch message from the event stream.
 */
export interface RawWsMessage {
  events?: RawWsEvent[];
  cursor?: number;
}

/**
 * Raw active worker from GET /api/plugins/kanban/workers/active.
 */
export interface RawActiveWorker {
  run_id?: number | null;
  task_id?: string;
  task_title?: string;
  task_status?: string;
  task_assignee?: string | null;
  profile?: string;
  worker_pid?: number | null;
  started_at?: number | null;
  claim_lock?: string | null;
  claim_expires?: number | null;
  last_heartbeat_at?: number | null;
  max_runtime_seconds?: number | null;
}

/**
 * Raw active workers response.
 */
export interface RawActiveWorkersResponse {
  workers?: RawActiveWorker[];
  count?: number;
  checked_at?: number;
}

/**
 * Raw board summary from GET /api/plugins/kanban/boards.
 */
export interface RawBoardSummary {
  slug?: string;
  name?: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  is_current?: boolean;
  counts?: Record<string, number>;
  total?: number;
}

/**
 * Raw boards list response.
 */
export interface RawBoardsResponse {
  boards?: RawBoardSummary[];
  current?: string;
}

/**
 * Raw profile from GET /api/plugins/kanban/profiles.
 */
export interface RawProfile {
  name?: string;
  is_default?: boolean;
  model?: string;
  provider?: string;
  description?: string;
  description_auto?: boolean;
  skill_count?: number;
}

/**
 * Raw profiles response.
 */
export interface RawProfilesResponse {
  profiles?: RawProfile[];
}

/**
 * Map WS event `kind` strings to canonical KanbanWsEventType values.
 *
 * The Hermes backend uses short kind strings (e.g. "created", "claimed",
 * "blocked"). The canonical model uses dot-namespaced event types
 * (e.g. "task.created", "task.claimed") per the v2 code's convention.
 * Unknown kinds pass through as raw strings for forward-compat (B9).
 */
export function mapEventKind(kind: string | undefined | null): string {
  if (!kind || typeof kind !== 'string') {
    return 'unknown';
  }
  // Map known short kinds to dot-namespaced canonical types
  const knownMap: Record<string, string> = {
    created: 'task.created',
    claimed: 'task.claimed',
    spawned: 'task.started',
    started: 'task.started',
    blocked: 'task.blocked',
    unblocked: 'task.unblocked',
    completed: 'task.completed',
    archived: 'task.archived',
    assigned: 'task.reassigned',
    // Non-task events (pass through as-is for forward-compat)
    commented: 'commented',
    linked: 'linked',
    unlinked: 'unlinked',
    promoted: 'promoted',
    scheduled: 'scheduled',
    reclaimed: 'reclaimed',
  };
  return knownMap[kind] ?? kind;
}
