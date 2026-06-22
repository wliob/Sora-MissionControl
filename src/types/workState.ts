/**
 * Canonical Kanban work-state model — TypeScript types.
 *
 * This is the single source of truth for "who is working on what" inside
 * Sora-MissionControl. Every surface (office FSM, chat status line, ops
 * alert strip, Kanban decision surface) derives its view from this model.
 *
 * Spec: docs/canonical-workstate-model.md (workspace t_0598ecfa)
 * Depends on: ./board (KanbanStatus, WorkspaceKind), ./agents (AgentId),
 *   ./provenance (Provenance, Tracked)
 *
 * Invariants — see the spec §2 for the full list. Key rules:
 *  - `status` is the spine; it is never derived from other fields.
 *  - `blocker` is non-null iff status === 'blocked'.
 *  - `review` is non-null once the task has entered 'review'.
 *  - `health` is a derived projection, not raw bookkeeping.
 *  - `ownership` is derived once on normalization.
 *  - Every timestamp is ISO 8601; null when absent.
 *  - No surface mutates status/assignee/blocker/review directly; writes
 *    go through the Cloud adapter and the store updates on the event.
 */

import type { KanbanStatus, WorkspaceKind } from './board';
import type { Tracked } from './provenance';

// ── Blocker ──────────────────────────────────────────────────────────────

export type BlockerKind =
  | 'missing-input'
  | 'dependency'
  | 'credential'
  | 'resource'
  | 'review'
  | 'crash'
  | 'timeout'
  | 'unknown';

export interface Blocker {
  kind: BlockerKind;
  reason: string;
  raisedBy: string | null;
  raisedAt: string;
}

// ── Review ──────────────────────────────────────────────────────────────

export interface ReviewState {
  requestedBy: string | null;
  requestedAt: string;
  reviewer: string | null;
  state: 'pending' | 'approved' | 'changes_requested';
  decidedBy: string | null;
  decidedAt: string | null;
  verdictNote: string | null;
}

// ── Ownership ───────────────────────────────────────────────────────────

export interface OwnershipSummary {
  state: 'assigned' | 'unassigned';
  owner: string | null;
  isKnownLead: boolean;
}

// ── Health (derived projection) ─────────────────────────────────────────

export type WorkHealth =
  | 'idle'
  | 'running'
  | 'stale'
  | 'failing'
  | 'circuit_open'
  | 'timed_out'
  | 'crashed'
  | 'unknown';

// ── WorkItem ────────────────────────────────────────────────────────────

export interface WorkItem {
  id: string;
  title: string;
  body: string;

  assignee: string | null;
  createdBy: string | null;
  ownership: OwnershipSummary;

  status: KanbanStatus;
  priority: number;
  createdAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  age: number | null;

  blocker: Blocker | null;
  review: ReviewState | null;

  parents: string[];
  children: string[];
  linkCounts: { parents: number; children: number };

  workspaceKind: WorkspaceKind;
  workspacePath: string | null;
  branchName: string | null;
  tenant: string | null;

  health: WorkHealth;

  latestSummary: string | null;
  progress: number | null;
  warnings: string[];
  commentCount: number;
}

// ── Board-level work state ──────────────────────────────────────────────

export interface WorkStateBoard {
  items: WorkItem[];
  assignees: string[];
  tenants: string[];
  countsByStatus: Record<KanbanStatus, number>;
  activePerAssignee: Record<string, number>;
  openBlockers: Array<{ taskId: string; title: string; blocker: Blocker }>;
  pendingReviews: Array<{ taskId: string; title: string; review: ReviewState }>;
  latestEventId: number | null;
  serverNow: string;
}

export type WorkState = Tracked<WorkStateBoard>;

// ── Constants ────────────────────────────────────────────────────────────

export const DEFAULT_FAILURE_LIMIT = 3;
export const HEARTBEAT_STALE_MS = 120_000;
export const WORKSTATE_STALE_AFTER_MS = 60_000;

// ── Activity derivation (office FSM input) ──────────────────────────────

export type AgentActivity =
  | 'idle'
  | 'moving'
  | 'working'
  | 'blocked'
  | 'reviewing'
  | 'celebrating';

export type AgentZone =
  | 'home'
  | 'workstations'
  | 'collaboration'
  | 'break_room'
  | 'archive';

/**
 * Derive the office agent activity from a WorkItem. This replaces the
 * v2 STATUS_ZONE_MAP logic in AgentStateMachine.ts.
 */
export function deriveActivity(item: WorkItem): AgentActivity {
  if (!item.assignee) return 'idle';
  switch (item.status) {
    case 'running':
      if (
        item.health === 'timed_out' ||
        item.health === 'crashed' ||
        item.health === 'circuit_open'
      ) {
        return 'blocked';
      }
      return 'working';
    case 'blocked':
      return 'blocked';
    case 'review':
      return item.review?.state === 'approved' ? 'celebrating' : 'reviewing';
    case 'done':
      return 'celebrating';
    default:
      return 'idle';
  }
}

export function deriveZone(item: WorkItem): AgentZone {
  switch (item.status) {
    case 'running':
      return 'workstations';
    case 'blocked':
      return 'workstations';
    case 'review':
      return 'collaboration';
    case 'done':
      return 'archive';
    default:
      return 'break_room';
  }
}

// ── Transition table ─────────────────────────────────────────────────────

/**
 * Legal status transitions. Keys are "from" statuses; values are the set
 * of "to" statuses that are legal from there. Any transition not in this
 * table is rejected by the store reducer as schema drift.
 *
 * This table is the authoritative transition spec — see spec §4.
 */
export const LEGAL_TRANSITIONS: Record<KanbanStatus, KanbanStatus[]> = {
  triage: ['todo'],
  todo: ['scheduled', 'ready', 'running'],
  scheduled: ['ready', 'running'],
  ready: ['running'],
  running: ['blocked', 'review', 'done', 'todo'],
  blocked: ['running', 'todo'],
  review: ['done', 'running', 'todo'],
  done: ['triage'],
};

export function isLegalTransition(
  from: KanbanStatus,
  to: KanbanStatus,
): boolean {
  return LEGAL_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── Ownership derivation ─────────────────────────────────────────────────

/**
 * Known department-lead profile names. Matches the AgentId union but as a
 * runtime array for the ownership derivation.
 */
const KNOWN_LEADS: string[] = ['cloud', 'biscuit', 'korra', 'lelouch', 'tifa'];

export function deriveOwnership(
  assignee: string | null,
): OwnershipSummary {
  if (!assignee) {
    return { state: 'unassigned', owner: null, isKnownLead: false };
  }
  return {
    state: 'assigned',
    owner: assignee,
    isKnownLead: KNOWN_LEADS.includes(assignee),
  };
}

// ── Initial state ──────────────────────────────────────────────────────

import { tracked } from './provenance';
import { KANBAN_COLUMN_ORDER } from './board';

export function initialWorkState(): WorkState {
  const empty: WorkStateBoard = {
    items: [],
    assignees: [],
    tenants: [],
    countsByStatus: Object.fromEntries(
      KANBAN_COLUMN_ORDER.map((s) => [s, 0]),
    ) as Record<KanbanStatus, number>,
    activePerAssignee: {},
    openBlockers: [],
    pendingReviews: [],
    latestEventId: null,
    serverNow: new Date().toISOString(),
  };
  return tracked(empty, {
    source: 'unknown',
    freshness: 'missing',
    confidence: 'unknown',
  });
}

// ── Blocker severity (ops surface) ───────────────────────────────────────

export type OpsSeverity = 'low' | 'medium' | 'high';

export function blockerSeverity(kind: BlockerKind): OpsSeverity {
  switch (kind) {
    case 'missing-input':
    case 'credential':
    case 'crash':
    case 'timeout':
      return 'high';
    case 'resource':
    case 'unknown':
      return 'medium';
    case 'dependency':
    case 'review':
      return 'low';
  }
}