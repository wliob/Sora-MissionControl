import { useSyncExternalStore } from 'react';
import type { BoardStoreSnapshot } from '@/state/boardStore';
import type { ConnectionStateValue, KnownHealthSourceId } from '@/types/connection';
import { HEALTH_SOURCE_LABELS } from '@/types/connection';
import type { Freshness, Confidence } from '@/types/provenance';
import { tracked } from '@/types/provenance';
import { KANBAN_COLUMN_ORDER, type KanbanTaskCard } from '@/types/board';
import type {
  DisabledProjectControlAction,
  ProjectControlActionKind,
  ProjectControlBlockerRow,
  ProjectControlMutationAdapter,
  ProjectControlMutationRequest,
  ProjectControlMutationResult,
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

const ACTION_LABELS: Record<ProjectControlActionKind, string> = {
  dispatch: 'Dispatch',
  decompose: 'Decompose',
  reclaim: 'Reclaim',
  terminate: 'Terminate',
};

let adapter: ProjectControlReadAdapter | null = null;
let mutationAdapter: ProjectControlMutationAdapter | null = null;
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
    mutationAdapterBound: false,
    actionInFlight: null,
    lastMutation: tracked(null, {
      source: 'unknown',
      freshness: 'missing',
      confidence: 'unknown',
      note: 'No Project Control mutation has run.',
    }),
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
    diagnostics: makeSection(null, 'unknown', {
      source: 'unknown',
      freshness: 'missing',
      confidence: 'unknown',
      note,
    }),
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
    logs: makeSection({ lines: [], truncated: false, path: null, exists: null, sizeBytes: null }, 'unavailable', {
      source: 'unknown',
      freshness: 'missing',
      confidence: 'unknown',
      note,
    }),
  };
}

function diagnosticsSection(task: KanbanTaskCard, aggregate: ProjectControlSourceAggregate): ProjectControlReadSection<unknown> {
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

function projectControlMutationsAvailable(): boolean {
  return mutationAdapter !== null && currentConnectionState?.value?.sources['kanban-rest']?.state === 'connected';
}

function actionReason(kind: ProjectControlActionKind, task: KanbanTaskCard, mutationsAvailable: boolean): string {
  if (!mutationsAvailable) return 'Kanban mutation adapter is unavailable or REST source is not connected.';
  if (kind === 'terminate' && !task.currentRunId) return 'Terminate requires a current run id from the verified board snapshot.';
  if (kind === 'reclaim' && task.status !== 'running' && !task.workerPid && !task.currentRunId) {
    return 'Reclaim is only enabled when the task appears actively claimed/running.';
  }
  return '';
}

function buildAction(kind: ProjectControlActionKind, task: KanbanTaskCard): DisabledProjectControlAction {
  const mutationsAvailable = projectControlMutationsAvailable();
  const disabledReason = actionReason(kind, task, mutationsAvailable);
  const targetId = kind === 'terminate' ? task.currentRunId : kind === 'dispatch' ? null : task.id;
  const risk = kind === 'terminate' || kind === 'reclaim' ? 'high' : 'medium';
  const scope = kind === 'dispatch' ? 'current board dispatcher' : `${task.title} (${task.id})`;
  return {
    kind,
    label: ACTION_LABELS[kind],
    enabled: disabledReason.length === 0,
    disabledReason,
    risk,
    targetId,
    confirmationCopy:
      kind === 'terminate'
        ? `High risk: terminate run ${task.currentRunId ?? 'unknown'} for ${scope}. Confirm only after checking duplicate-work/data-loss risk.`
        : kind === 'reclaim'
          ? `High risk: reclaim ${scope}. Confirm only if the worker heartbeat/claim is stale or intentionally being taken over.`
          : kind === 'decompose'
            ? `Confirm decompose for ${scope}. This may create child tasks and may spend model quota.`
            : 'Confirm dispatcher nudge for the current board. This may start eligible ready tasks.',
  };
}

function buildActions(task: KanbanTaskCard): DisabledProjectControlAction[] {
  return (['dispatch', 'decompose', 'reclaim', 'terminate'] as ProjectControlActionKind[]).map((kind) => buildAction(kind, task));
}

function buildTaskDetail(task: KanbanTaskCard, context: ProjectControlTaskContext): ProjectControlTaskDetail {
  const aggregate = currentAggregate();
  const diagnostics = context.diagnostics.value != null ? context.diagnostics : diagnosticsSection(task, aggregate);
  return {
    task,
    diagnostics,
    comments: context.comments,
    runs: context.runs,
    logs: context.logs,
    disabledActions: buildActions(task),
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
    diagnostics: existing.diagnostics,
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

export function setProjectControlMutationAdapter(next: ProjectControlMutationAdapter | null): void {
  mutationAdapter = next;
  state = { ...state, mutationAdapterBound: next !== null };
  refreshSelectedTaskShell();
  emit();
}

export function hasProjectControlReadAdapter(): boolean {
  return adapter !== null;
}

export function hasProjectControlMutationAdapter(): boolean {
  return mutationAdapter !== null;
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

  async executeAction(kind: ProjectControlActionKind, reason?: string): Promise<ProjectControlMutationResult | null> {
    if (!mutationAdapter) {
      const message = 'Kanban mutation adapter is not bound; action was not sent.';
      state = { ...state, lastError: message };
      emit();
      return null;
    }

    const task = state.selectedTaskId ? currentTasksById[state.selectedTaskId] : null;
    if (kind !== 'dispatch' && !task) {
      const message = `${ACTION_LABELS[kind]} requires a selected task from the current board snapshot.`;
      state = { ...state, lastError: message };
      emit();
      return null;
    }

    if (task) {
      const action = buildAction(kind, task);
      if (!action.enabled) {
        state = { ...state, lastError: action.disabledReason };
        emit();
        return null;
      }
    } else if (!projectControlMutationsAvailable()) {
      const message = 'Kanban mutation adapter is unavailable or REST source is not connected.';
      state = { ...state, lastError: message };
      emit();
      return null;
    }

    const request: ProjectControlMutationRequest = {
      kind,
      taskId: kind === 'dispatch' ? null : task?.id ?? null,
      runId: kind === 'terminate' ? task?.currentRunId ?? null : null,
      confirm: true,
      reason,
    };

    state = { ...state, actionInFlight: kind, lastError: null };
    emit();

    try {
      const result = await mutationAdapter.executeAction(request);
      state = {
        ...state,
        actionInFlight: null,
        lastMutation: tracked(result, {
          source: result.provenance.source,
          freshness: result.provenance.freshness,
          confidence: result.provenance.confidence,
          note: result.provenance.note ?? result.message,
        }),
        lastError: null,
      };
      emit();
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      state = { ...state, actionInFlight: null, lastError: message };
      emit();
      return null;
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
  mutationAdapter = null;
  currentBoardSnapshot = null;
  currentConnectionState = null;
  currentTasksById = {};
  state = createInitialState();
  emit();
}
