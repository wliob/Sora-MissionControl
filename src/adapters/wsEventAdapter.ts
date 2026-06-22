/**
 * WS event adapter — normalizes Hermes Kanban WebSocket event payloads
 * into the canonical KanbanWsEvent model.
 *
 * Source: /api/plugins/kanban/events (WebSocket stream)
 * Target: KanbanWsEvent (src/types/board.ts)
 *
 * The WS stream delivers batches of raw event rows. Each row has:
 *   - id (monotonic event id)
 *   - task_id
 *   - run_id (optional)
 *   - kind (short string like "created", "claimed", "blocked")
 *   - payload (JSON object with event-specific data)
 *   - created_at (epoch seconds)
 *
 * The adapter maps these to the canonical KanbanWsEvent which carries
 * a full KanbanTaskCard. For events that don't carry a full task, the
 * adapter uses a partial task built from the event payload, or falls
 * back to a placeholder that downstream consumers can resolve.
 *
 * Invariants enforced:
 *   - B9: Known event kinds map to dot-namespaced types; unknown kinds
 *     pass through as raw strings for forward-compat.
 *   - B10: KanbanWsEvent.task is a KanbanTaskCard. For id-only events,
 *     the adapter builds a minimal card with status 'todo' as placeholder.
 *   - B11: Timestamp is ISO 8601 (epoch seconds converted).
 *   - B3: Task ids are never synthesized; they come from task_id.
 */

import type { KanbanWsEvent, KanbanWsEventType, KanbanTaskCard } from '@/types/board';
import {
  epochToIso,
  nullableString,
  NormalizationError,
  mapEventKind,
  type RawWsEvent,
  type RawWsMessage,
  type RawApiTask,
} from './helpers';
import { normalizeTask } from './boardAdapter';

// ── Event normalization ─────────────────────────────────────────────────

/**
 * Result of normalizing a WS event batch. Carries both the canonical
 * events and any non-fatal errors encountered.
 */
export interface WsEventNormalizationResult {
  /** Successfully normalized events. */
  events: KanbanWsEvent[];
  /**
   * Non-fatal errors encountered while normalizing individual events.
   * Failed events are omitted from the events array.
   */
  errors: Array<{ eventId: number | null; error: NormalizationError }>;
}

/**
 * Build a minimal placeholder KanbanTaskCard for events that carry
 * only a task_id without a full task object. The placeholder has:
 *   - The correct id from the event
 *   - status 'todo' (safe default — the store will overlay the real
 *     task from the board snapshot when available)
 *   - Empty strings/nulls for everything else
 *
 * This satisfies invariant B10 (event always carries a KanbanTaskCard)
 * while being honest that the card is partial (confidence would be
 * 'inferred' at the store layer).
 */
function placeholderTask(taskId: string): KanbanTaskCard {
  return {
    id: taskId,
    title: '',
    body: '',
    assignee: null,
    status: 'todo',
    priority: 0,
    createdBy: null,
    createdAt: null,
    startedAt: null,
    completedAt: null,
    workspaceKind: 'scratch',
    workspacePath: null,
    tenant: null,
    branchName: null,
    result: null,
    idempotencyKey: null,
    consecutiveFailures: 0,
    workerPid: null,
    lastFailureError: null,
    maxRuntimeSeconds: null,
    lastHeartbeatAt: null,
    currentRunId: null,
    workflowTemplateId: null,
    currentStepKey: null,
    skills: [],
    modelOverride: null,
    maxRetries: null,
    goalMode: false,
    goalMaxTurns: null,
    sessionId: null,
    age: null,
    latestSummary: null,
    linkCounts: null,
    commentCount: 0,
    progress: null,
    diagnostics: null,
    warnings: [],
  };
}

/**
 * Try to extract a task from the event payload. Some event kinds
 * (especially "completed") carry a full task dict in the payload.
 * Returns null if no task can be extracted.
 */
function tryExtractTaskFromPayload(
  payload: Record<string, unknown> | null | undefined,
): RawApiTask | null {
  if (!payload || typeof payload !== 'object') return null;
  // Check for common payload field names that carry task data
  if ('task' in payload && payload.task && typeof payload.task === 'object') {
    return payload.task as RawApiTask;
  }
  return null;
}

/**
 * Normalize a single raw WS event into a canonical KanbanWsEvent.
 *
 * @param raw - The raw event from the WS stream
 * @param taskResolver - Optional function to resolve a full task card
 *   by task_id. Used when the event doesn't carry a full task. If not
 *   provided, a placeholder task is used.
 */
export function normalizeWsEvent(
  raw: RawWsEvent,
  taskResolver?: (taskId: string) => KanbanTaskCard | null,
): KanbanWsEvent {
  const eventId = typeof raw.id === 'number' ? raw.id : 0;
  const taskId = nullableString(raw.task_id);

  if (!taskId) {
    throw new NormalizationError(
      'WS event missing task_id',
      'task_id',
    );
  }

  // Map the short kind to dot-namespaced canonical type
  const rawKind = raw.kind ?? 'unknown';
  const type: KanbanWsEventType = mapEventKind(rawKind) as KanbanWsEventType;

  // Resolve the task card
  let task: KanbanTaskCard;

  // Try to get a full task from the payload first
  const rawTaskFromPayload = tryExtractTaskFromPayload(raw.payload);
  if (rawTaskFromPayload && rawTaskFromPayload.id) {
    try {
      task = normalizeTask(rawTaskFromPayload);
    } catch {
      // Payload task normalization failed — fall through to resolver/placeholder
      task = taskResolver?.(taskId) ?? placeholderTask(taskId);
    }
  } else if (taskResolver) {
    // Use the resolver (e.g. board snapshot lookup)
    task = taskResolver(taskId) ?? placeholderTask(taskId);
  } else {
    // No resolver, no payload task — use placeholder
    task = placeholderTask(taskId);
  }

  // Extract reassignment fields from payload for task.reassigned events
  let previousAssignee: string | null | undefined;
  let newAssignee: string | null | undefined;
  if (raw.payload && typeof raw.payload === 'object') {
    if ('previous_assignee' in raw.payload) {
      previousAssignee = nullableString(raw.payload.previous_assignee);
    } else if ('old_assignee' in raw.payload) {
      previousAssignee = nullableString(raw.payload.old_assignee);
    }
    if ('new_assignee' in raw.payload) {
      newAssignee = nullableString(raw.payload.new_assignee);
    } else if ('assignee' in raw.payload) {
      newAssignee = nullableString(raw.payload.assignee);
    }
  }

  return {
    eventId,
    type,
    task,
    ...(previousAssignee !== undefined ? { previousAssignee } : {}),
    ...(newAssignee !== undefined ? { newAssignee } : {}),
    timestamp: epochToIso(raw.created_at) ?? new Date().toISOString(),
  };
}

/**
 * Normalize a batch of WS events from a single WS message.
 *
 * The WS stream delivers messages like:
 *   { events: [...], cursor: 42 }
 *
 * This normalizes each event independently. Errors in individual events
 * don't prevent other events from being normalized.
 */
export function normalizeWsEventBatch(
  raw: RawWsMessage,
  taskResolver?: (taskId: string) => KanbanTaskCard | null,
): WsEventNormalizationResult {
  const events: KanbanWsEvent[] = [];
  const errors: Array<{ eventId: number | null; error: NormalizationError }> = [];

  const rawEvents = raw.events;
  if (!Array.isArray(rawEvents)) {
    return { events, errors };
  }

  for (const rawEvent of rawEvents) {
    try {
      events.push(normalizeWsEvent(rawEvent, taskResolver));
    } catch (err) {
      if (err instanceof NormalizationError) {
        errors.push({
          eventId: typeof rawEvent?.id === 'number' ? rawEvent.id : null,
          error: err,
        });
      }
    }
  }

  return { events, errors };
}

/**
 * Extract the cursor (last event id) from a raw WS message.
 * Used for reconnect resume (invariant B7).
 */
export function extractCursor(raw: RawWsMessage): number | null {
  if (typeof raw.cursor === 'number') {
    return raw.cursor;
  }
  return null;
}
