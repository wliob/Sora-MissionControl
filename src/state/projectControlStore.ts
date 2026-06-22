import { useSyncExternalStore } from 'react';
import type { BoardStoreSnapshot } from '@/state/boardStore';
import type { ConnectionStateValue, KnownHealthSourceId } from '@/types/connection';
import { HEALTH_SOURCE_LABELS } from '@/types/connection';
import type { Freshness, Confidence } from '@/types/provenance';
import { tracked } from '@/types/provenance';
import { KANBAN_COLUMN_ORDER, type KanbanTaskCard } from '@/types/board';
import type {
  DisabledProjectControlAction,
  ProjectControlBlockerRow,
  ProjectControlOwnerRow,
  ProjectControlReadAdapter,
  ProjectControlReadSection,
  ProjectControlSnapshot,
  ProjectControlSourceAggregate,
  ProjectControlStoreState,
  ProjectControlTaskContext,
  ProjectControlTaskDetail,
} from '@/types/project-control';

const PROJECT_CONTROL_SOURCES: KnownHealthSourceId[] = [
  'kanban-rest',
  'kanban-ws',
  'profile-cli',
  'admin-cli',
];

const DISABLED_ACTIONS: DisabledProjectControlAction[] = [
  {
    kind: 'dispatch',
    label: 'Dispatch',
    disabledReason: 'Read-only surface: dispatch is intentionally disabled in Phase 7a.',
    confirmationCopy:
      'Placeholder confirmation: show scope, freshness, quota unknown/known status, and rollback path before dispatch is enabled.',
  },
  {
    kind: 'decompose',
    label: 'Decompose',
    disabledReason: 'Read-only surface: decompose is intentionally disabled in Phase 7a.',
    confirmationCopy:
      'Placeholder confirmation: show parent task summary, expected child creation, and cost warning before decompose is enabled.',
  },
  {
    kind: 'reclaim',
    label: 'Reclaim',
    disabledReason: 'Read-only surface: reclaim is intentionally disabled in Phase 7a.',
    confirmationCopy:
      'Placeholder confirmation: show assignee, run id, heartbeat age, and duplicate-work risk before reclaim is enabled.',
  },
  {
    kind: 'terminate',
    label: 'Terminate',
    disabledReason: 'Read-only surface: terminate is intentionally disabled in Phase 7a.',
    confirmationCopy:
      'Placeholder confirmation: show PID, run id, heartbeat, and data-loss warning before terminate is enabled.',
  },
];

let adapter: ProjectControlReadAdapter | null = null;
let currentBoardSnapshot: BoardStoreSnapshot | null = null;
let currentConnectionState: ConnectionStateValue | null = null;
let currentTasksById: Record<string, KanbanTaskCard> = {};
let state: ProjectControlStoreState = createInitialState();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  for (const listener of listeners) listener();
}

function getSnapshot(): ProjectControlStoreState {
  return state;
}

function createInitialSnapshot(): ProjectControlSnapshot {
  return {
    boardState: 'unknown',
    metrics: {
      totalTasks: null,
      runningTasks: null,
      blockedTasks: null,
      ownerCount: null,
      activeWorkerCount: null,
    },
    statusRows: KANBAN_COLUMN_ORDER.map((status) => ({
      status,
      count: null,
      primaryTaskId: null,
    })),
    ownerRows: [],
    blockerRows: [],
    sourceRows: [],
    note: 'Kanban snapshot has not been observed yet.',
  };
}

function createInitialState(): ProjectControlStoreState {
  return {
    snapshot: tracked(createInitialSnapshot(), {
      source: 'unknown',
      freshness: 'missing',
      confidence: 'unknown',
      note: 'Project Control is waiting for the first Kanban snapshot.',
    }),
    selectedTaskId: null,
    taskDetail: tracked(null, {
      source: 'unknown',
      freshness: 'missing',
      confidence: 'unknown',
      note: 'No task selected.',
    }),
    lastError: null,
    adapterBound: false,
  };
}

function makeSection<T>(
  value: T | null,
  availability: ProjectControlReadSection<T>['availability'],
  params: {
    source: ProjectControlSourceAggregate['source'];
    freshness: ProjectControlSourceAggregate['freshness'];
    confidence: ProjectControlSourceAggregate['confidence'];
    note: string;
  },
): ProjectControlReadSection<T> {
  return {
    value,
    availability,
    provenance: {
      source: params.source,
      freshness: params.freshness,
      confidence: params.confidence,
      receivedAt: new Date().toISOString(),
      note: params.note,
    },
  };
}

function unavailableTaskContext(note: string): ProjectControlTaskContext {
  return {
    comments: makeSection([], 'unavailable', {
      source: 'unknown',
      freshness: 'missing',
      confidence: 'unknown',
      note,
    }),
    runs: makeSection([], 'unavailable', {
      source: 'unknown',
      freshness: 'missing',
      confidence: 'unknown',
      note,
    }),
    logs: makeSection({ lines: [], truncated: false }, 'unavailable', {
      source: 'unknown',
      freshness: 'missing',
      confidence: 'unknown',
      note,
    }),
  };
}

function diagnosticsSection(task: KanbanTaskCard, aggregate: ProjectControlSourceAggregate): ProjectControlReadSection<Record<string, unknown>> {
  if (task.diagnostics && Object.keys(task.diagnostics).length > 0) {
    return makeSection(task.diagnostics, 'available', {
      source: aggregate.source,
      freshness: aggregate.freshness,
      confidence: aggregate.confidence,
      note: 'Diagnostics available on the current board snapshot.',
    });
  }

  return makeSection({}, 'unknown', {
    source: aggregate.source,
    freshness: aggregate.freshness,
    confidence: aggregate.confidence,
    note: 'No diagnostics were present on the current board snapshot.',
  });
}

function reduceFreshness(values: Freshness[]): Freshness {
  if (values.includes('missing')) return 'missing';
  if (values.includes('stale')) return 'stale';
  if (values.includes('fresh')) return 'fresh';
  return 'live';
}

function reduceConfidence(values: Confidence[]): Confidence {
  if (values.includes('unknown')) return 'unknown';
  if (values.includes('placeholder')) return 'placeholder';
  if (values.includes('unverified')) return 'unverified';
  if (values.includes('inferred')) return 'inferred';
  return 'verified';
}

function currentAggregate(): ProjectControlSourceAggregate {
  const board = currentBoardSnapshot?.board.provenance;
  const profiles = currentBoardSnapshot?.profiles.provenance;
  const workers = currentBoardSnapshot?.activeWorkers.provenance;

  return {
    source: board?.source ?? 'unknown',
    freshness: reduceFreshness([
      board?.freshness ?? 'missing',
      profiles?.freshness ?? 'missing',
      workers?.freshness ?? 'missing',
    ]),
    confidence: reduceConfidence([
      board?.confidence ?? 'unknown',
      profiles?.confidence ?? 'unknown',
      workers?.confidence ?? 'unknown',
    ]),
  };
}

function deriveBoardState(): ProjectControlSnapshot['boardState'] {
  const rest = currentConnectionState?.value?.sources['kanban-rest']?.state ?? 'unknown';
  const ws = currentConnectionState?.value?.sources['kanban-ws']?.state ?? 'unknown';
  const boardFreshness = currentBoardSnapshot?.board.provenance.freshness ?? 'missing';

  if (rest === 'offline' || rest === 'unauthorized') return 'unavailable';
  if (boardFreshness === 'missing' || rest === 'unknown') return 'unknown';
  if (boardFreshness === 'stale' || rest === 'degraded' || ws === 'degraded' || ws === 'offline' || ws === 'unauthorized') {
    return 'stale';
  }
  return 'live';
}

function deriveNote(boardState: ProjectControlSnapshot['boardState']): string {
  const rest = currentConnectionState?.value?.sources['kanban-rest'];
  if (boardState === 'unavailable') {
    if (rest?.state === 'unauthorized') {
      return 'Kanban snapshot unavailable: authentication is required before Project Control can read the board.';
    }
    return 'Kanban snapshot unavailable: Project Control has no verified REST snapshot to read.';
  }
  if (boardState === 'unknown') {
    return 'Kanban snapshot is still unknown. The route stays honest until a verified board payload arrives.';
  }
  if (boardState === 'stale') {
    return 'Kanban snapshot is stale or partially connected. Counts may be useful, but they are not healthy/live.';
  }
  return 'Project Control is reading the current board snapshot in read-only mode.';
}

function buildStatusRows(tasks: KanbanTaskCard[], boardState: ProjectControlSnapshot['boardState']) {
  return KANBAN_COLUMN_ORDER.map((status) => {
    const matching = tasks.filter((task) => task.status === status);
    return {
      status,
      count: boardState === 'live' || boardState === 'stale' ? matching.length : null,
      primaryTaskId: matching[0]?.id ?? null,
    };
  });
}

function buildOwnerRows(tasks: KanbanTaskCard[]): ProjectControlOwnerRow[] {
  const rows = new Map<string, ProjectControlOwnerRow>();
  for (const task of tasks) {
    const owner = task.assignee ?? 'unassigned';
    const current = rows.get(owner) ?? {
      owner,
      total: 0,
      running: 0,
      blocked: 0,
      primaryTaskId: null,
    };
    current.total += 1;
    if (task.status === 'running') current.running += 1;
    if (task.status === 'blocked') current.blocked += 1;
    if (!current.primaryTaskId) current.primaryTaskId = task.id;
    rows.set(owner, current);
  }

  return [...rows.values()].sort((a, b) => {
    if (b.blocked !== a.blocked) return b.blocked - a.blocked;
    if (b.running !== a.running) return b.running - a.running;
    return b.total - a.total;
  });
}

function buildBlockerRows(tasks: KanbanTaskCard[]): ProjectControlBlockerRow[] {
  return tasks
    .filter((task) => task.status === 'blocked')
    .map((task) => ({
      taskId: task.id,
      title: task.title,
      assignee: task.assignee,
      blockerSummary:
        task.lastFailureError ?? task.latestSummary ?? task.warnings[0] ?? 'Blocked without diagnostic detail on the board snapshot.',
      workerPid: task.workerPid,
      lastHeartbeatAt: task.lastHeartbeatAt,
    }));
}

function buildSnapshot(): ProjectControlSnapshot {
  const boardState = deriveBoardState();
  const tasks = Object.values(currentTasksById);
  const countsAllowed = boardState === 'live' || boardState === 'stale';
  const blockerRows = countsAllowed ? buildBlockerRows(tasks) : [];
  const ownerRows = countsAllowed ? buildOwnerRows(tasks) : [];
  const sourceRows = PROJECT_CONTROL_SOURCES.map((sourceId) => ({
    sourceId,
    label: HEALTH_SOURCE_LABELS[sourceId],
    health: currentConnectionState?.value?.sources[sourceId] ?? {
      state: 'unknown',
      lastOkAt: null,
      lastCheckedAt: null,
    },
    sync: currentConnectionState?.value?.sync[sourceId] ?? {
      lastSyncAt: null,
      pendingEventCount: 0,
      staleReason: 'awaiting-first-snapshot',
    },
  }));

  return {
    boardState,
    metrics: {
      totalTasks: countsAllowed ? tasks.length : null,
      runningTasks: countsAllowed ? tasks.filter((task) => task.status === 'running').length : null,
      blockedTasks: countsAllowed ? blockerRows.length : null,
      ownerCount: countsAllowed ? ownerRows.length : null,
      activeWorkerCount:
        countsAllowed && currentBoardSnapshot?.activeWorkers.value
          ? currentBoardSnapshot.activeWorkers.value.length
          : null,
    },
    statusRows: buildStatusRows(tasks, boardState),
    ownerRows,
    blockerRows,
    sourceRows,
    note: deriveNote(boardState),
  };
}

function buildTaskDetail(task: KanbanTaskCard, context: ProjectControlTaskContext): ProjectControlTaskDetail {
  const aggregate = currentAggregate();
  return {
    task,
    diagnostics: diagnosticsSection(task, aggregate),
    comments: context.comments,
    runs: context.runs,
    logs: context.logs,
    disabledActions: DISABLED_ACTIONS,
  };
}

function refreshSelectedTaskShell(): void {
  if (!state.selectedTaskId) return;
  const task = currentTasksById[state.selectedTaskId];
  if (!task) {
    state = {
      ...state,
      selectedTaskId: null,
      taskDetail: tracked(null, {
        source: 'unknown',
        freshness: 'missing',
        confidence: 'unknown',
        note: 'Selected task no longer exists in the current board snapshot.',
      }),
    };
    return;
  }

  const existing = state.taskDetail.value;
  const fallbackContext = unavailableTaskContext(
    'No project-control read adapter is bound yet. Comments, runs, and logs remain unavailable by design.',
  );
  const nextDetail = buildTaskDetail(task, existing ? {
    comments: existing.comments,
    runs: existing.runs,
    logs: existing.logs,
  } : fallbackContext);
  const aggregate = currentAggregate();

  state = {
    ...state,
    taskDetail: tracked(nextDetail, {
      source: aggregate.source,
      freshness: aggregate.freshness,
      confidence: aggregate.confidence,
      note: 'Selected task detail refreshed from the current board snapshot.',
    }),
  };
}

export function setProjectControlReadAdapter(next: ProjectControlReadAdapter | null): void {
  adapter = next;
  state = { ...state, adapterBound: next !== null };
  emit();
}

export function hasProjectControlReadAdapter(): boolean {
  return adapter !== null;
}

export const projectControlStore = {
  get state(): ProjectControlStoreState {
    return state;
  },

  syncFromSources(boardSnapshot: BoardStoreSnapshot, connectionState: ConnectionStateValue): ProjectControlStoreState {
    currentBoardSnapshot = boardSnapshot;
    currentConnectionState = connectionState;
    currentTasksById = {};

    const board = boardSnapshot.board.value;
    if (board) {
      for (const column of board.columns) {
        for (const task of column.tasks) {
          currentTasksById[task.id] = task;
        }
      }
    }

    const aggregate = currentAggregate();
    const nextSnapshot = buildSnapshot();
    state = {
      ...state,
      snapshot: tracked(nextSnapshot, {
        source: aggregate.source,
        freshness: nextSnapshot.boardState === 'unavailable'
          ? 'missing'
          : nextSnapshot.boardState === 'unknown'
            ? 'missing'
            : nextSnapshot.boardState === 'stale'
              ? 'stale'
              : aggregate.freshness,
        confidence: aggregate.confidence,
        note: nextSnapshot.note ?? undefined,
      }),
      adapterBound: adapter !== null,
      lastError: state.lastError,
    };

    refreshSelectedTaskShell();
    emit();
    return state;
  },

  async selectTask(taskId: string | null): Promise<void> {
    if (!taskId) {
      state = {
        ...state,
        selectedTaskId: null,
        taskDetail: tracked(null, {
          source: 'unknown',
          freshness: 'missing',
          confidence: 'unknown',
          note: 'No task selected.',
        }),
        lastError: null,
      };
      emit();
      return;
    }

    const task = currentTasksById[taskId];
    if (!task) {
      state = {
        ...state,
        lastError: `Task ${taskId} is not present in the current board snapshot.`,
      };
      emit();
      return;
    }

    const aggregate = currentAggregate();
    const fallbackContext = unavailableTaskContext(
      'No project-control read adapter is bound yet. Comments, runs, and logs remain unavailable by design.',
    );

    state = {
      ...state,
      selectedTaskId: taskId,
      taskDetail: tracked(buildTaskDetail(task, fallbackContext), {
        source: aggregate.source,
        freshness: aggregate.freshness,
        confidence: aggregate.confidence,
        note: 'Selected task loaded from the board snapshot only.',
      }),
      lastError: null,
      adapterBound: adapter !== null,
    };
    emit();

    if (!adapter) {
      return;
    }

    try {
      const context = await adapter.readTaskContext(task);
      state = {
        ...state,
        taskDetail: tracked(buildTaskDetail(task, context), {
          source: aggregate.source,
          freshness: aggregate.freshness,
          confidence: aggregate.confidence,
          note: 'Selected task context loaded through the read adapter.',
        }),
        lastError: null,
      };
      emit();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      state = {
        ...state,
        taskDetail: tracked(buildTaskDetail(task, unavailableTaskContext(message)), {
          source: aggregate.source,
          freshness: aggregate.freshness === 'live' ? 'stale' : aggregate.freshness,
          confidence: aggregate.confidence,
          note: 'Read adapter failed; task drawer remains snapshot-only.',
        }),
        lastError: message,
      };
      emit();
    }
  },

  clearLastError(): void {
    if (!state.lastError) return;
    state = { ...state, lastError: null };
    emit();
  },
};

export function useProjectControlState(): ProjectControlStoreState {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function _resetForTest(): void {
  adapter = null;
  currentBoardSnapshot = null;
  currentConnectionState = null;
  currentTasksById = {};
  state = createInitialState();
  emit();
}
