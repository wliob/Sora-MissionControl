// ── Adapter: dashboard canonical types → office internal types ─────────
//
// The dashboard's KanbanTaskCard is a rich, normalized model. The office FSM
// works with a simpler Task shape. This adapter bridges them so the office
// can consume board snapshots and WS events from the dashboard data layer.

import type { KanbanTaskCard, KanbanBoardSnapshot, KanbanWsEvent } from '@/types/board';
import type { Task, WsEvent, Board, Column } from '@/office/types';

/**
 * Map dashboard KanbanStatus → the simplified status strings the office FSM
 * understands. The FSM's STATUS_ZONE_MAP keys on: in_progress, blocked,
 * review, done. All other statuses map to 'todo' (agent stays idle/break).
 */
function mapStatus(kanbanStatus: string): string {
  switch (kanbanStatus) {
    case 'running':
      return 'in_progress';
    case 'ready':
    case 'scheduled':
    case 'todo':
    case 'triage':
      return 'todo';
    case 'blocked':
      return 'blocked';
    case 'review':
      return 'review';
    case 'done':
      return 'done';
    default:
      return 'todo';
  }
}

/**
 * Convert a KanbanTaskCard to the office's internal Task shape.
 */
export function adaptTask(card: KanbanTaskCard): Task {
  return {
    id: card.id,
    title: card.title,
    assignee: card.assignee,
    status: mapStatus(card.status),
    createdAt: card.createdAt ?? new Date().toISOString(),
    updatedAt: card.startedAt ?? card.createdAt ?? new Date().toISOString(),
    labels: [],
  };
}

/**
 * Convert a KanbanBoardSnapshot to the office's internal Board shape.
 */
export function adaptBoard(snapshot: KanbanBoardSnapshot): Board {
  const columns: Column[] = snapshot.columns.map((col) => ({
    id: col.name,
    title: col.name,
    tasks: col.tasks.map(adaptTask),
  }));
  return { columns };
}

/**
 * Convert a KanbanWsEvent to the office's internal WsEvent shape.
 */
export function adaptWsEvent(event: KanbanWsEvent): WsEvent {
  return {
    type: event.type as WsEvent['type'],
    task: adaptTask(event.task),
    previousAssignee: event.previousAssignee,
    newAssignee: event.newAssignee,
    timestamp: event.timestamp,
  };
}