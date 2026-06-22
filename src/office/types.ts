// ── Office types (narrow internal shape for the FSM + rendering) ──────

/**
 * The office FSM works with a simplified Task shape. The dashboard's
 * canonical KanbanTaskCard is much richer; the adapter in adapter.ts
 * maps KanbanTaskCard → OfficeTask at the boundary.
 */

export interface Task {
  id: string;
  title: string;
  assignee: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  labels: string[];
}

export interface Column {
  id: string;
  title: string;
  tasks: Task[];
}

export interface Board {
  columns: Column[];
}

export type WsEventType =
  | 'task.created'
  | 'task.claimed'
  | 'task.started'
  | 'task.blocked'
  | 'task.unblocked'
  | 'task.review_requested'
  | 'task.completed'
  | 'task.archived'
  | 'task.reassigned';

export interface WsEvent {
  type: WsEventType;
  task: Task;
  previousAssignee?: string | null;
  newAssignee?: string | null;
  timestamp: string;
}