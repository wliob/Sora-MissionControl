/**
 * Shared board/profile live-state store for the Phase 3 backbone.
 *
 * This store is intentionally UI-agnostic: it owns normalized Kanban board
 * snapshots, normalized WS events, and runtime roster/worker reports. Section
 * modules consume it; they do not fetch Hermes directly.
 */

import { useSyncExternalStore } from 'react';
import type {
  ActiveWorker,
  ActiveWorkerReport,
  KanbanBoardSnapshot,
  KanbanBoardState,
  KanbanTaskCard,
  KanbanWsEvent,
  ProfileRoster,
} from '@/types/board';
import { initialBoardState, isKanbanStatus } from '@/types/board';
import { tracked } from '@/types/provenance';
import type { DataSource, Tracked } from '@/types/provenance';
import {
  normalizeActiveWorkers,
  normalizeBoardSnapshotTracked,
  normalizeProfiles,
  normalizeWsEventBatch,
  type RawActiveWorkersResponse,
  type RawBoardResponse,
  type RawProfilesResponse,
  type RawWsMessage,
} from '@/adapters';

export interface BoardStoreSnapshot {
  board: KanbanBoardState;
  events: Tracked<KanbanWsEvent[]>;
  profiles: ProfileRoster;
  activeWorkers: ActiveWorkerReport;
  normalizationErrors: string[];
}

const MAX_EVENTS = 100;

let snapshot: BoardStoreSnapshot = createInitialSnapshot();
const listeners = new Set<() => void>();

function createInitialSnapshot(): BoardStoreSnapshot {
  return {
    board: initialBoardState(),
    events: tracked([], { source: 'dashboard-api', freshness: 'missing', confidence: 'unknown' }),
    profiles: tracked([], { source: 'dashboard-api', freshness: 'missing', confidence: 'unknown' }),
    activeWorkers: tracked([], { source: 'dashboard-api', freshness: 'missing', confidence: 'unknown' }),
    normalizationErrors: [],
  };
}

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): BoardStoreSnapshot {
  return snapshot;
}

function getTaskFromBoard(taskId: string): KanbanTaskCard | null {
  const board = snapshot.board.value;
  if (!board) return null;
  for (const column of board.columns) {
    const task = column.tasks.find((candidate) => candidate.id === taskId);
    if (task) return task;
  }
  return null;
}

function mergeTaskIntoBoard(
  board: KanbanBoardSnapshot,
  task: KanbanTaskCard,
  latestEventId: number,
  eventTimestamp: string,
): KanbanBoardSnapshot {
  const nextColumns = board.columns.map((column) => {
    const filtered = column.tasks.filter((candidate) => candidate.id !== task.id);
    if (column.name === task.status) {
      return { ...column, tasks: [task, ...filtered] };
    }
    return { ...column, tasks: filtered };
  });

  return {
    ...board,
    columns: nextColumns,
    latestEventId: Math.max(board.latestEventId ?? 0, latestEventId),
    serverNow: eventTimestamp,
  };
}

function ingestEvents(events: KanbanWsEvent[], source: DataSource): void {
  if (events.length === 0) return;

  let board = snapshot.board.value ?? initialBoardState().value;
  for (const event of events) {
    if (board && isKanbanStatus(event.task.status)) {
      board = mergeTaskIntoBoard(board, event.task, event.eventId, event.timestamp);
    }
  }

  const nextEvents = [...events, ...(snapshot.events.value ?? [])]
    .sort((a, b) => b.eventId - a.eventId)
    .slice(0, MAX_EVENTS);

  snapshot = {
    ...snapshot,
    board: board
      ? tracked(board, {
          source,
          freshness: 'live',
          confidence: source === 'dashboard-api' ? 'verified' : 'unverified',
        })
      : snapshot.board,
    events: tracked(nextEvents, {
      source,
      freshness: 'live',
      confidence: source === 'dashboard-api' ? 'verified' : 'unverified',
    }),
  };
  emit();
}

export const boardStore = {
  get snapshot(): BoardStoreSnapshot {
    return snapshot;
  },

  get board(): KanbanBoardState {
    return snapshot.board;
  },

  get events(): Tracked<KanbanWsEvent[]> {
    return snapshot.events;
  },

  get profiles(): ProfileRoster {
    return snapshot.profiles;
  },

  get activeWorkers(): ActiveWorkerReport {
    return snapshot.activeWorkers;
  },

  applyBoardRaw(raw: RawBoardResponse, source: DataSource = 'dashboard-api'): KanbanBoardState {
    const { board, taskErrors } = normalizeBoardSnapshotTracked(raw, source);
    snapshot = {
      ...snapshot,
      board,
      normalizationErrors: taskErrors.map(({ taskId, error }) => `${taskId ?? 'unknown'}: ${error.message}`),
    };
    emit();
    return board;
  },

  applyWsMessageRaw(raw: RawWsMessage, source: DataSource = 'dashboard-api'): KanbanWsEvent[] {
    const { events, errors } = normalizeWsEventBatch(raw, getTaskFromBoard);
    const errorMessages = errors.map(({ eventId, error }) => `${eventId ?? 'unknown'}: ${error.message}`);
    if (errorMessages.length > 0) {
      snapshot = {
        ...snapshot,
        normalizationErrors: [...errorMessages, ...snapshot.normalizationErrors].slice(0, 25),
      };
    }
    ingestEvents(events, source);
    if (errorMessages.length > 0 && events.length === 0) emit();
    return events;
  },

  applyProfilesRaw(raw: RawProfilesResponse, source: DataSource = 'dashboard-api'): ProfileRoster {
    const profiles = normalizeProfiles(raw, source);
    snapshot = { ...snapshot, profiles };
    emit();
    return profiles;
  },

  applyActiveWorkersRaw(raw: RawActiveWorkersResponse, source: DataSource = 'dashboard-api'): ActiveWorkerReport {
    const activeWorkers = normalizeActiveWorkers(raw, source);
    snapshot = { ...snapshot, activeWorkers };
    emit();
    return activeWorkers;
  },

  getTask(taskId: string): KanbanTaskCard | null {
    return getTaskFromBoard(taskId);
  },

  getActiveWorkers(): ActiveWorker[] {
    return snapshot.activeWorkers.value ?? [];
  },

  _resetForTest(): void {
    snapshot = createInitialSnapshot();
    emit();
  },
};

export function useBoardStoreSnapshot(): BoardStoreSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot);
}
