/**
 * Board adapter — normalizes Hermes Kanban REST API payloads into the
 * canonical KanbanBoardSnapshot and KanbanTaskCard models.
 *
 * Source: GET /api/plugins/kanban/board
 * Target: KanbanBoardSnapshot (src/types/board.ts)
 *
 * Key transformations:
 *   - Snake_case → camelCase field names
 *   - Epoch-second timestamps → ISO 8601 strings (invariant B4/X5)
 *   - Unknown KanbanStatus values → NormalizationError (invariant B1)
 *   - Missing columns → filled with empty task arrays (invariant B2)
 *   - Null arrays → empty arrays (invariant B6)
 *   - Progress rollup → 0..1 fraction or null (invariant B6)
 *
 * Determinism: calling normalizeBoardSnapshot with the same raw payload
 * always produces the same canonical output (no Date.now() or random
 * values). Provenance is set by the caller at the store layer.
 */

import type {
  KanbanTaskCard,
  KanbanBoardSnapshot,
  KanbanColumn,
  KanbanStatus,
} from '@/types/board';
import { KANBAN_COLUMN_ORDER } from '@/types/board';
import type { Tracked, Freshness } from '@/types/provenance';
import { tracked } from '@/types/provenance';
import type { DataSource } from '@/types/provenance';
import {
  epochToIso,
  validateKanbanStatus,
  coerceWorkspaceKind,
  ensureArray,
  normalizeProgress,
  nullableString,
  nullableNumber,
  normalizeBoolean,
  NormalizationError,
  type RawApiTask,
  type RawBoardResponse,
} from './helpers';

// ── Task normalization ──────────────────────────────────────────────────

/**
 * Normalize a single raw API task into a canonical KanbanTaskCard.
 *
 * This is the core per-task mapping. Every field is validated or
 * defaulted. The function is pure: same input → same output.
 *
 * @throws NormalizationError if `status` is not a valid KanbanStatus
 *   (invariant B1: reject unknown statuses rather than coercing).
 * @throws NormalizationError if `id` is missing (invariant B3: adapters
 *   must not synthesize new ids).
 */
export function normalizeTask(raw: RawApiTask): KanbanTaskCard {
  // id is required — adapters must not synthesize new ids (B3)
  if (!raw.id || typeof raw.id !== 'string') {
    throw new NormalizationError(
      `Task missing required id field: ${JSON.stringify(raw).slice(0, 200)}`,
      'id',
    );
  }

  // status is required and must be a valid KanbanStatus (B1)
  const status: KanbanStatus = validateKanbanStatus(raw.status);

  // Normalize progress: the API returns { done, total } for parent tasks;
  // convert to a 0..1 fraction. Null when not applicable.
  let progress: number | null = null;
  if (raw.progress && typeof raw.progress === 'object' && 'done' in raw.progress && 'total' in raw.progress) {
    const total = raw.progress.total;
    const done = raw.progress.done;
    if (typeof total === 'number' && total > 0 && typeof done === 'number') {
      progress = normalizeProgress(done / total);
    }
  }

  // age: the API returns either a number (seconds) or an object with
  // sub-fields. For the canonical model, we store the creation age in
  // seconds as a single number.
  let age: number | null = null;
  if (typeof raw.age === 'number' && Number.isFinite(raw.age)) {
    age = raw.age;
  } else if (raw.age && typeof raw.age === 'object' && 'created_age_seconds' in raw.age) {
    age = nullableNumber(raw.age.created_age_seconds);
  }

  return {
    id: raw.id,
    title: raw.title ?? '',
    body: raw.body ?? '',
    assignee: nullableString(raw.assignee),
    status,
    priority: typeof raw.priority === 'number' ? raw.priority : 0,
    createdBy: nullableString(raw.created_by),
    createdAt: epochToIso(raw.created_at),
    startedAt: epochToIso(raw.started_at),
    completedAt: epochToIso(raw.completed_at),
    workspaceKind: coerceWorkspaceKind(raw.workspace_kind),
    workspacePath: nullableString(raw.workspace_path),
    tenant: nullableString(raw.tenant),
    branchName: nullableString(raw.branch_name),
    result: nullableString(raw.result),
    idempotencyKey: nullableString(raw.idempotency_key),
    consecutiveFailures: typeof raw.consecutive_failures === 'number' ? raw.consecutive_failures : 0,
    workerPid: nullableNumber(raw.worker_pid),
    lastFailureError: nullableString(raw.last_failure_error),
    maxRuntimeSeconds: nullableNumber(raw.max_runtime_seconds),
    lastHeartbeatAt: epochToIso(raw.last_heartbeat_at),
    currentRunId: raw.current_run_id != null ? String(raw.current_run_id) : null,
    workflowTemplateId: nullableString(raw.workflow_template_id),
    currentStepKey: nullableString(raw.current_step_key),
    skills: ensureArray<string>(raw.skills),
    modelOverride: nullableString(raw.model_override),
    maxRetries: nullableNumber(raw.max_retries),
    goalMode: normalizeBoolean(raw.goal_mode),
    goalMaxTurns: nullableNumber(raw.goal_max_turns),
    sessionId: nullableString(raw.session_id),
    age,
    latestSummary: nullableString(raw.latest_summary),
    linkCounts: raw.link_counts ?? null,
    commentCount: typeof raw.comment_count === 'number' ? raw.comment_count : 0,
    progress,
    diagnostics: raw.diagnostics ?? null,
    warnings: ensureArray<string>(raw.warnings),
  };
}

// ── Board snapshot normalization ────────────────────────────────────────

/**
 * Result of normalizing a board response. Carries both the canonical
 * snapshot and any non-fatal normalization errors encountered per-task.
 */
export interface BoardNormalizationResult {
  /** The canonical board snapshot. Always valid even if some tasks had errors. */
  snapshot: KanbanBoardSnapshot;
  /**
   * Non-fatal errors encountered while normalizing individual tasks.
   * Tasks that fail normalization are omitted from their column (not
   * silently coerced). The store can surface these as warnings.
   */
  taskErrors: Array<{ taskId: string | null; error: NormalizationError }>;
}

/**
 * Normalize a raw REST board response into a canonical KanbanBoardSnapshot.
 *
 * Invariant B2: the result always contains exactly 8 columns in
 * KANBAN_COLUMN_ORDER, even if some are empty.
 *
 * Invariant B8: serverNow is the server wall clock as ISO 8601
 * (the API returns epoch seconds in `now`).
 *
 * Individual task normalization errors are collected but do not prevent
 * the board from being produced. Failed tasks are omitted from their
 * column rather than silently replaced with placeholders.
 */
export function normalizeBoardSnapshot(raw: RawBoardResponse): BoardNormalizationResult {
  const taskErrors: Array<{ taskId: string | null; error: NormalizationError }> = [];

  // Build a column map from the raw response
  const columnMap: Partial<Record<KanbanStatus, KanbanTaskCard[]>> = {};

  if (raw.columns && Array.isArray(raw.columns)) {
    for (const col of raw.columns) {
      const name = col.name;
      if (!name || typeof name !== 'string') continue;

      let status: KanbanStatus;
      try {
        status = validateKanbanStatus(name);
      } catch {
        // Unknown column status — skip the entire column per B1
        // (unknown status is schema drift, not a valid column)
        continue;
      }

      const tasks: KanbanTaskCard[] = [];
      if (col.tasks && Array.isArray(col.tasks)) {
        for (const rawTask of col.tasks) {
          try {
            tasks.push(normalizeTask(rawTask));
          } catch (err) {
            if (err instanceof NormalizationError) {
              taskErrors.push({
                taskId: rawTask?.id ?? null,
                error: err,
              });
            }
            // Skip the task — don't include malformed data
          }
        }
      }
      columnMap[status] = tasks;
    }
  }

  // Ensure all 8 canonical columns exist (B2)
  const columns: KanbanColumn[] = KANBAN_COLUMN_ORDER.map((name) => ({
    name,
    tasks: columnMap[name] ?? [],
  }));

  const snapshot: KanbanBoardSnapshot = {
    columns,
    assignees: Array.isArray(raw.assignees) ? raw.assignees.filter((a): a is string => typeof a === 'string') : [],
    tenants: Array.isArray(raw.tenants) ? raw.tenants.filter((t): t is string => typeof t === 'string') : [],
    latestEventId: typeof raw.latest_event_id === 'number' ? raw.latest_event_id : null,
    serverNow: epochToIso(raw.now) ?? new Date().toISOString(),
  };

  return { snapshot, taskErrors };
}

/**
 * Normalize a raw board response and wrap it in Tracked<> provenance.
 * Convenience function for the common case where the store needs a
 * Tracked<KanbanBoardSnapshot>.
 */
export function normalizeBoardSnapshotTracked(
  raw: RawBoardResponse,
  source: DataSource,
): { board: Tracked<KanbanBoardSnapshot>; taskErrors: BoardNormalizationResult['taskErrors'] } {
  const { snapshot, taskErrors } = normalizeBoardSnapshot(raw);
  const freshness: Freshness = taskErrors.length > 0 ? 'stale' : 'live';
  const board = tracked(snapshot, {
    source,
    freshness,
    confidence: source === 'dashboard-api' ? 'verified' : 'unverified',
  });
  return { board, taskErrors };
}
