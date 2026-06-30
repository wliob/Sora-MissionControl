/**
 * Project types for the Projects dashboard page.
 *
 * Projects are derived from Kanban board data (boardStore). Each project
 * is a logical grouping of tasks sharing a workspace or tenant. When no
 * board data is available, the store surfaces honest empty/unavailable states
 * via `freshness`.
 */

import type { AgentId } from './agents';
import type { Freshness } from './provenance';

export type ProjectStatus = 'active' | 'paused' | 'completed';

export interface Project {
  /** Unique project identifier. */
  id: string;
  /** Human-readable project name. */
  name: string;
  /** Current project status. */
  status: ProjectStatus;
  /** Lead agent responsible for the project. */
  lead: AgentId | null;
  /** Total task count across all statuses. */
  taskCount: number;
  /** Number of blocked tasks. */
  blockerCount: number;
  /** ISO 8601 timestamp of the most recent activity on this project. */
  lastActivity: string | null;
  /** Data freshness for this project. */
  freshness: Freshness;
}

export interface ProjectsStoreState {
  projects: Project[];
  /** Overall data-source freshness. Use `freshness === 'missing'` to detect unavailable data. */
  freshness: Freshness;
}

/** Default empty projects state — honest truth about unavailability. */
export function initialProjectsState(): ProjectsStoreState {
  return {
    projects: [],
    freshness: 'missing',
  };
}
