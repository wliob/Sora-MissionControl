/**
 * Activity store — derived event feed for the Activity dashboard page.
 *
 * Computes ActivityEvent entries from boardStore / teamStore task changes,
 * session state transitions, and other runtime signals. When no data source
 * is connected, surfaces honest empty/missing states via `freshness`.
 *
 * Pattern: useSyncExternalStore with manual listeners (matches teamStore).
 */

import { useSyncExternalStore } from 'react';
import type {
  ActivityEvent,
  ActivityStoreState,
} from '@/types/activity';
import { initialActivityState } from '@/types/activity';
import type { AgentId, Freshness } from '@/types';
import { boardStore } from '@/state/boardStore';

// ── Internal helpers ──────────────────────────────────────────────

function deriveActivityEvents(): ActivityEvent[] {
  const board = boardStore.board;
  const boardValue = board.value;
  const boardFreshness: Freshness = board.provenance?.freshness ?? 'missing';

  if (!boardValue || boardFreshness === 'missing') {
    return [];
  }

  const events: ActivityEvent[] = [];
  const now = new Date().toISOString();

  // Derive events from recent task changes across all columns
  for (const col of boardValue.columns) {
    for (const task of col.tasks) {
      const assignee = (task.assignee ?? '').toLowerCase() as AgentId | (string & {});
      const source: AgentId | 'SYSTEM' =
        (['cloud', 'biscuit', 'korra', 'lelouch', 'tifa', 'sora', 'rain'] as string[]).includes(assignee)
          ? (assignee as AgentId)
          : 'SYSTEM';

      // Task completion events
      if (task.completedAt && task.status === 'done') {
        events.push({
          timestamp: task.completedAt,
          source,
          eventType: 'task.completed',
          summary: `${task.title ?? task.id} completed`,
          freshness: boardFreshness,
          severity: 'INFO',
        });
      }

      // Blocked tasks
      if (task.status === 'blocked') {
        events.push({
          timestamp: task.startedAt ?? task.createdAt ?? now,
          source,
          eventType: 'task.blocked',
          summary: `${task.title ?? task.id} blocked${task.warnings.length > 0 ? ` — ${task.warnings[0]}` : ''}`,
          freshness: boardFreshness,
          severity: 'WARNING',
        });
      }

      // Recently started
      if (task.status === 'running' && task.startedAt) {
        events.push({
          timestamp: task.startedAt,
          source,
          eventType: 'task.started',
          summary: `${task.title ?? task.id} started`,
          freshness: boardFreshness,
          severity: 'INFO',
        });
      }
    }
  }

  // Sort by timestamp descending, newest first
  events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  // Keep most recent 50
  return events.slice(0, 50);
}

// ── Store state ───────────────────────────────────────────────────

let state: ActivityStoreState = initialActivityState();
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot(): ActivityStoreState {
  return state;
}

function recompute(): void {
  const events = deriveActivityEvents();
  const boardFreshness: Freshness = boardStore.board.provenance?.freshness ?? 'missing';

  const next: ActivityStoreState = {
    events,
    freshness: boardFreshness,
  };

  if (
    next.events.length !== state.events.length ||
    next.freshness !== state.freshness
  ) {
    state = next;
    emit();
  }
}

/** Call after boardStore mutations to refresh activity-derived state. */
export function refreshActivityState(): void {
  recompute();
}

export const activityStore = {
  get state(): ActivityStoreState {
    return state;
  },
  refresh(): void {
    recompute();
  },
};

export function useActivityState(): ActivityStoreState {
  recompute();
  return useSyncExternalStore(subscribe, getSnapshot);
}

// Initial compute
recompute();
