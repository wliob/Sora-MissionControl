/**
 * Team-specific types for the Phase A Team Command Surface.
 *
 * These types support the AttentionRail, LeadCards, SoraConductorStation,
 * DelegationLines, and the TeamPage status bar. They are derived from
 * boardStore, projectControlStore, and sessionConnectionStore data.
 */

import type { AgentId } from './agents';
import type { KanbanStatus } from './board';
import type { Freshness } from './provenance';

// ── Attention Items ───────────────────────────────────────────────

export type AttentionSeverity = 'CRITICAL' | 'WARNING' | 'INFO' | 'STALE' | 'DEGRADE';

export interface AttentionItem {
  /** Rank position (1-based). Determines chevron: «❶» «❷» «❸» */
  rank: number;
  severity: AttentionSeverity;
  /** Timestamp in HH:MM:SS.mmm format */
  timestamp: string;
  /** Source agent id (e.g., 'biscuit', 'tifa') */
  source: AgentId | 'SYSTEM';
  /** One-line summary (max ~60 chars, truncated with …) */
  summary: string;
  /** Human-readable duration (e.g., 'pending 45m', '2h ago') */
  duration?: string;
  /** Action label (e.g., 'respond', 'inspect', 'resolve') */
  action?: string;
  /** Data freshness for this item */
  freshness: Freshness;
}

// ── Workload Scoring ──────────────────────────────────────────────

/** Weight mapping from KanbanStatus per product spec §4. */
export const STATE_WEIGHT: Record<KanbanStatus, number> = {
  running: 3.0,
  review: 2.0,
  blocked: 2.0,
  triage: 1.5,
  todo: 1.0,
  ready: 1.0,
  scheduled: 1.0,
  done: 0.0,
};

/** Sub-agent work counts at 0.5× toward parent lead. */
export const SUB_AGENT_MULTIPLIER = 0.5;

export type WorkloadLabel = 'IDLE' | 'LIGHT' | 'MODERATE' | 'HEAVY' | 'CRITICAL';

export interface WorkloadScore {
  /** Numeric score (may be fractional due to sub-agent weighting) */
  score: number;
  /** Display label */
  label: WorkloadLabel;
  /** Bar fill color */
  color: string;
  /** Whether the bar should pulse (CRITICAL only) */
  pulse: boolean;
}

/** Compute workload label + color from a numeric score. */
export function workloadDisplay(score: number): WorkloadScore {
  if (score <= 0) return { score, label: 'IDLE', color: '#444444', pulse: false };
  if (score <= 10) return { score, label: 'LIGHT', color: '#00ff41', pulse: false };
  if (score <= 25) return { score, label: 'MODERATE', color: '#ffb000', pulse: false };
  if (score <= 50) return { score, label: 'HEAVY', color: '#ff4444', pulse: false };
  return { score, label: 'CRITICAL', color: '#ff4444', pulse: true };
}

// ── Agent Status ──────────────────────────────────────────────────

export type AgentStatus = 'ONLINE' | 'BUSY' | 'BLOCKED' | 'IDLE' | 'OFFLINE';

export const AGENT_STATUS_COLORS: Record<AgentStatus, { color: string; pulse: boolean }> = {
  ONLINE: { color: '#00ff66', pulse: true },
  BUSY: { color: '#ffb000', pulse: false },
  BLOCKED: { color: '#ff4444', pulse: true },
  IDLE: { color: '#666666', pulse: false },
  OFFLINE: { color: '#444444', pulse: false },
};

// ── Lead Snapshot ─────────────────────────────────────────────────

export interface LeadSnapshot {
  agentId: AgentId;
  status: AgentStatus;
  workload: WorkloadScore;
  /** Task count per status, keyed by KanbanStatus */
  taskCounts: Partial<Record<KanbanStatus, number>>;
  blockers: number;
  activeProject: string | null;
  /** Relative timestamp (e.g., '2m ago', '1h ago') or ISO for >24h */
  lastVerified: string | null;
  freshness: Freshness;
}

// ── Delegation Edges ──────────────────────────────────────────────

export type DelegationType = 'handoff' | 'dependency' | 'escalation' | 'blocked';

export interface DelegationEdge {
  from: AgentId;
  to: AgentId;
  type: DelegationType;
  taskCount: number;
  freshness: Freshness;
}

// ── Dispatch Log Entry ────────────────────────────────────────────

export interface DispatchLogEntry {
  timestamp: string;        // HH:MM:SS.mmm
  operation: string;        // e.g., 'delegation:biscuit→cloud'
  result: string;            // e.g., 'ok', 'warn  2 blockers', 'stale 3 items'
}

// ── Team Page State ───────────────────────────────────────────────

export interface TeamPageState {
  attentionItems: AttentionItem[];
  leadSnapshots: LeadSnapshot[];
  delegationEdges: DelegationEdge[];
  dispatchLog: DispatchLogEntry[];
  /** Total agent count (including Sora + Rain) */
  agentCount: number;
  /** Number of agents currently online */
  onlineCount: number;
  /** Aggregate system health — uses truth vocabulary */
  systemHealth: 'verified' | 'degraded' | 'unavailable' | 'unknown';
  /** Uptime string (e.g., '14d 3h') */
  uptime: string | null;
  freshness: Freshness;
}

/** Default empty team page state — honest truth about unavailability. */
export function initialTeamPageState(): TeamPageState {
  return {
    attentionItems: [],
    leadSnapshots: [],
    delegationEdges: [],
    dispatchLog: [],
    agentCount: 7,
    onlineCount: 0,
    systemHealth: 'unknown',
    uptime: null,
    freshness: 'missing',
  };
}
