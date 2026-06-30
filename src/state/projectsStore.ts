/**
 * Projects store — derived project list for the Projects dashboard page.
 *
 * Computes Project entries from Kanban board data (boardStore), grouping
 * tasks by workspace or tenant. When no board data is available, surfaces
 * honest empty/missing states via `freshness`.
 *
 * Pattern: useSyncExternalStore with manual listeners (matches teamStore).
 */

import { useSyncExternalStore } from 'react';
import type {
  Project,
  ProjectStatus,
  ProjectsStoreState,
} from '@/types/projects';
import { initialProjectsState } from '@/types/projects';
import type { AgentId, Freshness } from '@/types';
import { boardStore } from '@/state/boardStore';

// ── Internal helpers ──────────────────────────────────────────────

function deriveProjects(): Project[] {
  const board = boardStore.board;
  const boardValue = board.value;
  const boardFreshness: Freshness = board.provenance?.freshness ?? 'missing';

  if (!boardValue || boardFreshness === 'missing') {
    return [];
  }

  // Group tasks by tenant or workspace — treat each as a "project"
  const projectMap = new Map<string, {
    name: string;
    lead: AgentId | null;
    tasks: typeof boardValue.columns[0]['tasks'];
    latestTimestamp: string | null;
  }>();

  for (const col of boardValue.columns) {
    for (const task of col.tasks) {
      // Use tenant as project key; fall back to workspace path
      const key = task.tenant ?? task.workspacePath ?? 'unknown';

      let entry = projectMap.get(key);
      if (!entry) {
        entry = {
          name: key === 'unknown' ? 'Uncategorized' : key,
          lead: null,
          tasks: [],
          latestTimestamp: null,
        };
        projectMap.set(key, entry);
      }

      entry.tasks.push(task);

      // Track latest activity timestamp
      const activityTs = task.completedAt ?? task.startedAt ?? task.createdAt;
      if (activityTs && (!entry.latestTimestamp || activityTs > entry.latestTimestamp)) {
        entry.latestTimestamp = activityTs;
      }

      // Determine lead from first assigned task
      if (!entry.lead && task.assignee) {
        const a = task.assignee.toLowerCase();
        const knownAgents: AgentId[] = ['cloud', 'biscuit', 'korra', 'lelouch', 'tifa', 'sora', 'rain'];
        for (const agent of knownAgents) {
          if (a === agent || a.startsWith(agent)) {
            entry.lead = agent;
            break;
          }
        }
      }
    }
  }

  const projects: Project[] = [];
  for (const [key, entry] of projectMap) {
    const totalTasks = entry.tasks.length;
    const blockerCount = entry.tasks.filter(t => t.status === 'blocked').length;
    const doneCount = entry.tasks.filter(t => t.status === 'done').length;

    let status: ProjectStatus = 'active';
    if (totalTasks > 0 && doneCount === totalTasks) {
      status = 'completed';
    } else if (totalTasks > 0 && entry.tasks.every(t => t.status === 'done' || t.status === 'todo')) {
      status = 'paused';
    }

    projects.push({
      id: key,
      name: entry.name,
      status,
      lead: entry.lead,
      taskCount: totalTasks,
      blockerCount,
      lastActivity: entry.latestTimestamp,
      freshness: boardFreshness,
    });
  }

  // Sort: active first, then by most recent activity
  projects.sort((a, b) => {
    if (a.status !== b.status) {
      const order: Record<ProjectStatus, number> = { active: 0, paused: 1, completed: 2 };
      return order[a.status] - order[b.status];
    }
    return (b.lastActivity ?? '').localeCompare(a.lastActivity ?? '');
  });

  return projects;
}

// ── Store state ───────────────────────────────────────────────────

let state: ProjectsStoreState = initialProjectsState();
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot(): ProjectsStoreState {
  return state;
}

function recompute(): void {
  const projects = deriveProjects();
  const boardFreshness: Freshness = boardStore.board.provenance?.freshness ?? 'missing';

  const next: ProjectsStoreState = {
    projects,
    freshness: boardFreshness,
  };

  if (
    next.projects.length !== state.projects.length ||
    next.freshness !== state.freshness
  ) {
    state = next;
    emit();
  }
}

/** Call after boardStore mutations to refresh projects-derived state. */
export function refreshProjectsState(): void {
  recompute();
}

export const projectsStore = {
  get state(): ProjectsStoreState {
    return state;
  },
  refresh(): void {
    recompute();
  },
};

export function useProjectsState(): ProjectsStoreState {
  recompute();
  return useSyncExternalStore(subscribe, getSnapshot);
}

// Initial compute
recompute();
