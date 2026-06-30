/**
 * Team store — derived state for the Phase A Team Command Surface.
 *
 * Computes attention items, workload scores, lead snapshots, delegation edges,
 * and dispatch log entries from boardStore + projectControlStore data using
 * the full Attention Ranking Engine (8-tier weighted priority system).
 *
 * When real data isn't available, surfaces honest 'unavailable' / 'unknown'
 * states rather than fake data.
 */

import { useSyncExternalStore } from 'react';
import type {
  AgentId,
  Freshness,
} from '@/types';
import {
  STATE_WEIGHT,
  SUB_AGENT_MULTIPLIER,
  workloadDisplay,
  initialTeamPageState,
} from '@/types';
import { boardStore } from '@/state/boardStore';
import type { KanbanStatus, KanbanTaskCard, KanbanBoardSnapshot } from '@/types/board';
import type {
  LeadSnapshot,
  DelegationEdge,
  DispatchLogEntry,
  TeamPageState,
} from '@/types/team';
import {
  rankAttentionItems,
  buildRankingInput,
  unknownCalendarWindow,
  type CalendarUrgencyWindow,
} from '@/state/attentionRankingEngine';

// ── Internal derived helpers ────────────────────────────────────────

function computeWorkload(tasks: KanbanTaskCard[], ownerId: AgentId): { score: number; counts: Partial<Record<KanbanStatus, number>> } {
  let score = 0;
  const counts: Partial<Record<KanbanStatus, number>> = {};
  for (const t of tasks) {
    const assignee = (t.assignee ?? '').toLowerCase();
    const isDirect = assignee === ownerId || assignee === ownerId + '-direct';
    const multiplier = isDirect ? 1.0 : (assignee.startsWith(ownerId) ? SUB_AGENT_MULTIPLIER : 0);
    const weight = STATE_WEIGHT[t.status as KanbanStatus] ?? 0;
    score += weight * multiplier;
    counts[t.status as KanbanStatus] = (counts[t.status as KanbanStatus] ?? 0) + 1;
  }
  return { score, counts };
}

function computeBlockers(tasks: KanbanTaskCard[], ownerId: AgentId): number {
  return tasks.filter(t => {
    const a = (t.assignee ?? '').toLowerCase();
    return t.status === 'blocked' && (a === ownerId || a.startsWith(ownerId));
  }).length;
}

function computeActiveProject(tasks: KanbanTaskCard[], ownerId: AgentId): string | null {
  const running = tasks.filter(t => {
    const a = (t.assignee ?? '').toLowerCase();
    return t.status === 'running' && (a === ownerId || a.startsWith(ownerId));
  });
  if (running.length === 0) return null;
  const title = running[0].title ?? running[0].id;
  return title.length > 32 ? title.slice(0, 32) + '\u2026' : title;
}

function determineStatus(blockers: number, score: number, isConnected: boolean): 'ONLINE' | 'BUSY' | 'BLOCKED' | 'IDLE' | 'OFFLINE' {
  if (!isConnected) return 'OFFLINE';
  if (blockers > 0) return 'BLOCKED';
  if (score > 10) return 'BUSY';
  if (score > 0) return 'ONLINE';
  return 'IDLE';
}

export function formatRelativeTime(isoString: string | null | undefined): string | null {
  if (!isoString) return null;
  const diff = Date.now() - new Date(isoString).getTime();
  if (diff < 0) return 'just now';
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Calendar window detection ─────────────────────────────────────

/**
 * Attempt to detect calendar/deadline urgency from available data.
 * When no calendar source is connected, returns honest unknown state.
 */
function detectCalendarUrgency(_tasks: KanbanTaskCard[]): CalendarUrgencyWindow {
  // TODO: Integrate with actual calendar data source when available.
  return unknownCalendarWindow();
}

// ── Derived state computation ──────────────────────────────────────

function deriveTeamState(): TeamPageState {
  const boardState = boardStore.board;
  const board: KanbanBoardSnapshot | null = boardState.value;
  const provenanceFreshness: Freshness = boardState.provenance?.freshness ?? 'missing';
  const provenanceConfidence = boardState.provenance?.confidence ?? 'unknown';

  // Map provenance freshness to team-facing freshness
  const hasRealData = provenanceFreshness === 'live' || provenanceFreshness === 'fresh';
  const isMissing = provenanceFreshness === 'missing';

  // Gather all tasks
  const allTasks: KanbanTaskCard[] = [];
  if (board) {
    for (const col of board.columns) {
      for (const t of col.tasks) allTasks.push(t);
    }
  }

  const leadAgentIds: AgentId[] = ['cloud', 'biscuit', 'korra', 'lelouch', 'tifa', 'rain', 'sora'];

  // Detect calendar urgency
  const calendarWindow = detectCalendarUrgency(allTasks);

  // ── Build ranking input and compute attention items ────────────

  const rankingInput = buildRankingInput({
    tasks: allTasks,
    boardFreshness: provenanceFreshness,
    boardConfidence: provenanceConfidence,
    calendarWindow,
    isMissing,
  });

  const attentionItems = rankAttentionItems(rankingInput);

  // ── Lead snapshots ──────────────────────────────────────────

  const leadSnapshots: LeadSnapshot[] = [];
  const totalAgents = leadAgentIds.length;
  let onlineCount = 0;

  for (const agentId of leadAgentIds) {
    const agentTasks = allTasks.filter(t => {
      const a = (t.assignee ?? '').toLowerCase();
      return a === agentId || a.startsWith(agentId);
    });
    const { score, counts } = computeWorkload(agentTasks, agentId);
    const wl = workloadDisplay(score);
    const blockers = computeBlockers(agentTasks, agentId);
    const activeProject = computeActiveProject(agentTasks, agentId);

    const lastUpdated = agentTasks.length > 0
      ? agentTasks.reduce((latest, t) => {
          const ct = t.completedAt ?? t.createdAt;
          if (!ct) return latest;
          return ct > latest ? ct : latest;
        }, '')
      : null;

    const status = determineStatus(blockers, score, hasRealData);
    if (status !== 'OFFLINE' && status !== 'IDLE') onlineCount++;

    leadSnapshots.push({
      agentId,
      status,
      workload: wl,
      taskCounts: counts,
      blockers,
      activeProject,
      lastVerified: formatRelativeTime(lastUpdated),
      freshness: provenanceFreshness,
    });
  }

  // ── Dispatch log ────────────────────────────────────────────

  const dispatchLog: DispatchLogEntry[] = [];
  if (board) {
    const recentTasks = [...allTasks]
      .filter(t => t.completedAt)
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
      .slice(0, 5);

    for (const t of recentTasks) {
      const tDate = new Date(t.completedAt!);
      const tts = `${String(tDate.getHours()).padStart(2, '0')}:${String(tDate.getMinutes()).padStart(2, '0')}:${String(tDate.getSeconds()).padStart(2, '0')}.000`;
      dispatchLog.push({
        timestamp: tts,
        operation: `task:${t.status}`,
        result: t.assignee ? `assignee:${t.assignee}` : 'ok',
      });
    }
  }

  // ── Delegation edges ───────────────────────────────────────

  const delegationEdges: DelegationEdge[] = [];
  if (!isMissing && board) {
    // Detect cross-agent task assignments
    const agentTaskMap = new Map<AgentId, KanbanTaskCard[]>();
    for (const agentId of leadAgentIds) {
      agentTaskMap.set(agentId, []);
    }
    for (const task of allTasks) {
      const a = (task.assignee ?? '').toLowerCase();
      for (const agentId of leadAgentIds) {
        if (a.startsWith(agentId) && a !== agentId) {
          agentTaskMap.get(agentId)?.push(task);
        }
      }
    }

    for (const [from, subTasks] of agentTaskMap) {
      if (subTasks.length === 0) continue;
      const bySubAgent = new Map<string, KanbanTaskCard[]>();
      for (const t of subTasks) {
        const key = t.assignee ?? 'unknown';
        const list = bySubAgent.get(key) ?? [];
        list.push(t);
        bySubAgent.set(key, list);
      }

      for (const [to, tasks] of bySubAgent) {
        const blockedTasks = tasks.filter(t => t.status === 'blocked').length;
        delegationEdges.push({
          from,
          to: to as AgentId,
          type: blockedTasks > 0 ? 'blocked' : 'handoff',
          taskCount: tasks.length,
          freshness: provenanceFreshness,
        });
      }
    }
  }

  // ── System health ───────────────────────────────────────────

  const systemHealth: TeamPageState['systemHealth'] =
    provenanceFreshness === 'missing' ? 'unknown' :
    provenanceFreshness === 'live' || provenanceFreshness === 'fresh'
      ? (onlineCount === totalAgents || allTasks.length === 0 ? 'verified' : 'degraded')
    : 'degraded';

  return {
    attentionItems: attentionItems.slice(0, 5),
    leadSnapshots,
    delegationEdges: delegationEdges.slice(0, 8),
    dispatchLog: dispatchLog.slice(0, 5),
    agentCount: totalAgents,
    onlineCount,
    systemHealth,
    uptime: isMissing ? null : 'unknown',
    freshness: provenanceFreshness,
  };
}

// ── Store implementation ───────────────────────────────────────────

let state: TeamPageState = initialTeamPageState();
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot(): TeamPageState {
  return state;
}

/** Recompute team state from current boardStore snapshot. */
function recompute(): void {
  const next = deriveTeamState();
  if (
    next.systemHealth !== state.systemHealth ||
    next.onlineCount !== state.onlineCount ||
    next.attentionItems.length !== state.attentionItems.length ||
    next.leadSnapshots.length !== state.leadSnapshots.length ||
    next.freshness !== state.freshness
  ) {
    state = next;
    emit();
  }
}

/** Call after boardStore mutations to refresh team-derived state. */
export function refreshTeamState(): void {
  recompute();
}

export const teamStore = {
  get state(): TeamPageState {
    return state;
  },
  refresh(): void {
    recompute();
  },
};

export function useTeamState(): TeamPageState {
  recompute();
  return useSyncExternalStore(subscribe, getSnapshot);
}

// Initial compute
recompute();
