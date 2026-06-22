/**
 * Runtime adapter — normalizes local runtime API payloads (active workers,
 * profiles, board summaries) into canonical Phase 4 models.
 *
 * Sources:
 *   - GET /api/plugins/kanban/workers/active → ActiveWorker[]
 *   - GET /api/plugins/kanban/profiles       → ProfileRosterEntry[]
 *   - GET /api/plugins/kanban/boards          → KanbanBoardSummary[]
 *
 * These endpoints share the same dashboard API transport but are
 * conceptually "runtime" data (process state, profile config, board
 * metadata) rather than board state. The adapter normalizes them into
 * the same canonical shapes so consumers don't branch on source.
 *
 * Key transformations:
 *   - Snake_case → camelCase field names
 *   - Epoch-second timestamps → ISO 8601 strings (invariant X5)
 *   - Missing/partial fields → safe defaults (null, empty, 0)
 *   - Provenance tagging: source is 'dashboard-api' for REST data,
 *     'profile-cli' or 'admin-cli' for CLI-proxy data
 */

import type { ActiveWorker } from '@/types/board';
import type { KanbanBoardSummary, ProfileRosterEntry } from '@/types/board';
import type { Tracked } from '@/types/provenance';
import { tracked } from '@/types/provenance';
import type { DataSource } from '@/types/provenance';
import {
  epochToIso,
  nullableString,
  type RawActiveWorker,
  type RawActiveWorkersResponse,
  type RawProfile,
  type RawProfilesResponse,
  type RawBoardSummary,
  type RawBoardsResponse,
} from './helpers';

// ── Active workers ──────────────────────────────────────────────────────

/**
 * Normalize a single raw active worker into a canonical ActiveWorker.
 *
 * The raw payload includes extra fields (task_title, task_status,
 * claim_lock, claim_expires, max_runtime_seconds) that are not in the
 * canonical model. These are intentionally dropped — the board snapshot
 * carries the authoritative task state; the worker report is for ops
 * surface process monitoring only.
 */
export function normalizeActiveWorker(raw: RawActiveWorker): ActiveWorker {
  return {
    taskId: raw.task_id ?? '',
    assignee: raw.profile ?? '',
    pid: typeof raw.worker_pid === 'number' ? raw.worker_pid : 0,
    runId: raw.run_id != null ? String(raw.run_id) : null,
    startedAt: epochToIso(raw.started_at),
    lastHeartbeatAt: epochToIso(raw.last_heartbeat_at),
  };
}

/**
 * Normalize a raw active workers response into a canonical
 * ActiveWorker[] wrapped in Tracked<>.
 */
export function normalizeActiveWorkers(
  raw: RawActiveWorkersResponse,
  source: DataSource = 'dashboard-api',
): Tracked<ActiveWorker[]> {
  const workers: ActiveWorker[] = [];
  if (raw.workers && Array.isArray(raw.workers)) {
    for (const w of raw.workers) {
      workers.push(normalizeActiveWorker(w));
    }
  }
  return tracked(workers, {
    source,
    freshness: 'live',
    confidence: source === 'dashboard-api' ? 'verified' : 'unverified',
  });
}

// ── Profile roster ──────────────────────────────────────────────────────

/**
 * Normalize a single raw profile into a canonical ProfileRosterEntry.
 *
 * The raw profile includes is_default, model, provider, and
 * description_auto which are not in the canonical model. The
 * canonical model keeps gatewayStatus and modelSummary as
 * non-secret strings for the admin/chat modules.
 */
export function normalizeProfile(raw: RawProfile): ProfileRosterEntry {
  // Build gatewayStatus from the raw provider field
  let gatewayStatus: string | null = null;
  if (raw.provider && typeof raw.provider === 'string' && raw.provider.length > 0) {
    gatewayStatus = raw.provider;
  }

  // Build modelSummary from the raw model field
  let modelSummary: string | null = null;
  if (raw.model && typeof raw.model === 'string' && raw.model.length > 0) {
    modelSummary = raw.model;
  }

  return {
    name: raw.name ?? '',
    description: nullableString(raw.description),
    gatewayStatus,
    modelSummary,
    skillCount: typeof raw.skill_count === 'number' ? raw.skill_count : -1,
  };
}

/**
 * Normalize a raw profiles response into a canonical ProfileRoster
 * (Tracked<ProfileRosterEntry[]>).
 */
export function normalizeProfiles(
  raw: RawProfilesResponse,
  source: DataSource = 'dashboard-api',
): Tracked<ProfileRosterEntry[]> {
  const profiles: ProfileRosterEntry[] = [];
  if (raw.profiles && Array.isArray(raw.profiles)) {
    for (const p of raw.profiles) {
      profiles.push(normalizeProfile(p));
    }
  }
  return tracked(profiles, {
    source,
    freshness: 'live',
    confidence: source === 'dashboard-api' ? 'verified' : 'unverified',
  });
}

// ── Board summaries ─────────────────────────────────────────────────────

/**
 * Normalize a single raw board summary into a canonical KanbanBoardSummary.
 *
 * The raw payload uses is_current (snake_case) and counts (a
 * per-status dict). The canonical model uses isActive and taskCount.
 */
export function normalizeBoardSummary(raw: RawBoardSummary): KanbanBoardSummary {
  // Compute total task count
  let taskCount: number | null = null;
  if (typeof raw.total === 'number') {
    taskCount = raw.total;
  } else if (raw.counts && typeof raw.counts === 'object') {
    const values = Object.values(raw.counts);
    if (values.length > 0 && values.every((v) => typeof v === 'number')) {
      taskCount = values.reduce((sum, v) => sum + (v as number), 0);
    }
  }

  return {
    slug: raw.slug ?? '',
    name: raw.name ?? raw.slug ?? '',
    isActive: raw.is_current === true,
    taskCount,
  };
}

/**
 * Normalize a raw boards response into a canonical KanbanBoardList
 * (Tracked<KanbanBoardSummary[]>).
 */
export function normalizeBoards(
  raw: RawBoardsResponse,
  source: DataSource = 'dashboard-api',
): Tracked<KanbanBoardSummary[]> {
  const boards: KanbanBoardSummary[] = [];
  if (raw.boards && Array.isArray(raw.boards)) {
    for (const b of raw.boards) {
      boards.push(normalizeBoardSummary(b));
    }
  }
  return tracked(boards, {
    source,
    freshness: 'live',
    confidence: source === 'dashboard-api' ? 'verified' : 'unverified',
  });
}

/**
 * Extract the current board slug from a raw boards response.
 * Used for board initialization / switching logic.
 */
export function extractCurrentBoardSlug(raw: RawBoardsResponse): string | null {
  return nullableString(raw.current);
}
