// ── Demo data for standalone office operation ──────────────────────────
//
// When the dashboard board data is not available, the office can run in
// demo mode using this scripted mock board + event stream. This lets the
// office render and animate inside the dashboard shell without a live
// Kanban connection.
//
// Phase B — extended to 6 agents (Rain added).

import type { Board, WsEvent, Task } from '@/office/types';

const now = () => new Date().toISOString();

function makeTask(id: string, title: string, assignee: string, status: string): Task {
  return {
    id,
    title,
    assignee,
    status,
    createdAt: now(),
    updatedAt: now(),
    labels: [],
  };
}

/** A static mock board with tasks across all 6 agents and statuses. */
export const DEMO_BOARD: Board = {
  columns: [
    {
      id: 'in_progress',
      title: 'in_progress',
      tasks: [
        makeTask('t_demo_1', 'Refactor auth pipeline', 'Cloud', 'in_progress'),
        makeTask('t_demo_2', 'Build rate limiter', 'Biscuit', 'in_progress'),
        makeTask('t_demo_3', 'Landing page hero', 'Korra', 'in_progress'),
        makeTask('t_demo_4', 'Q2 budget forecast', 'Tifa', 'in_progress'),
        makeTask('t_demo_8', 'Intel report: competitor movement', 'Rain', 'in_progress'),
      ],
    },
    {
      id: 'blocked',
      title: 'blocked',
      tasks: [
        makeTask('t_demo_5', 'Venue booking', 'Lelouch', 'blocked'),
      ],
    },
    {
      id: 'review',
      title: 'review',
      tasks: [],
    },
    {
      id: 'done',
      title: 'done',
      tasks: [
        makeTask('t_demo_6', 'CI pipeline setup', 'Cloud', 'done'),
      ],
    },
    {
      id: 'todo',
      title: 'todo',
      tasks: [],
    },
  ],
};

/**
 * A scripted event stream that cycles through agent activity changes.
 * Each entry is delivered in sequence with a delay.
 */
export const DEMO_EVENT_SCRIPT: { delay: number; event: WsEvent }[] = [
  {
    delay: 8000,
    event: {
      type: 'task.completed',
      task: makeTask('t_demo_2', 'Build rate limiter', 'Biscuit', 'done'),
      timestamp: now(),
    },
  },
  {
    delay: 12000,
    event: {
      type: 'task.review_requested',
      task: makeTask('t_demo_3', 'Landing page hero', 'Korra', 'review'),
      timestamp: now(),
    },
  },
  {
    delay: 16000,
    event: {
      type: 'task.unblocked',
      task: makeTask('t_demo_5', 'Venue booking', 'Lelouch', 'in_progress'),
      timestamp: now(),
    },
  },
  {
    delay: 20000,
    event: {
      type: 'task.completed',
      task: makeTask('t_demo_1', 'Refactor auth pipeline', 'Cloud', 'done'),
      timestamp: now(),
    },
  },
  {
    delay: 24000,
    event: {
      type: 'task.claimed',
      task: makeTask('t_demo_7', 'New feature spec', 'Biscuit', 'in_progress'),
      timestamp: now(),
    },
  },
  {
    delay: 28000,
    event: {
      type: 'task.blocked',
      task: makeTask('t_demo_8', 'Intel report: competitor movement', 'Rain', 'blocked'),
      timestamp: now(),
    },
  },
  {
    delay: 32000,
    event: {
      type: 'task.unblocked',
      task: makeTask('t_demo_8', 'Intel report: competitor movement', 'Rain', 'in_progress'),
      timestamp: now(),
    },
  },
];
