/**
 * Attention Ranking Engine — Weighted priority system for Sora-MissionControl v2.
 *
 * Answers "Where should my attention go next?" within 5 seconds using an 8-tier
 * deterministic ranking backed by operational state-change events.
 *
 * ## Priority Tiers (high to low)
 * 1. Waiting on user / pending user decision
 * 2. Blockers that stop agents/projects
 * 3. Failed/stale/degraded automation
 * 4. Review/verification needed
 * 5. Overloaded or stalled lead
 * 6. Scheduled item due soon (calendar/deadline pressure)
 * 7. High-priority active project with drift/dependency pressure
 * 8. New urgent inbound that changes priority
 *
 * ## Scoring Formula
 *   attention_score = blocker_severity    (0–25)
 *                   + decision_urgency     (0–20)
 *                   + deadline_pressure    (0–15)
 *                   + dependency_impact    (0–10)
 *                   + ownership_gap        (0–10)
 *                   + project_importance   (0–10)
 *                   - stale_penalty        (0–10)
 *                   - noise_penalty        (0–5)
 */

import type { AttentionItem, AttentionSeverity } from '@/types/team';
import { STATE_WEIGHT, SUB_AGENT_MULTIPLIER } from '@/types/team';
import type { AgentId } from '@/types/agents';
import type { KanbanStatus, KanbanTaskCard } from '@/types/board';
import type { Freshness, Confidence } from '@/types/provenance';

// ── Tier definitions ─────────────────────────────────────────────────────

export type AttentionRankTier = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const ATTENTION_TIER_LABELS: Record<AttentionRankTier, string> = {
  1: 'WAITING_ON_USER',
  2: 'BLOCKER',
  3: 'FAILED_AUTOMATION',
  4: 'REVIEW_NEEDED',
  5: 'OVERLOADED_LEAD',
  6: 'SCHEDULED_DUE',
  7: 'DRIFT_PRESSURE',
  8: 'URGENT_INBOUND',
};

export const ATTENTION_TIER_DESCRIPTIONS: Record<AttentionRankTier, string> = {
  1: 'Waiting on user — pending decision or input required',
  2: 'Blocker — stopping agent or project progress',
  3: 'Failed/stale/degraded automation',
  4: 'Review/verification needed',
  5: 'Overloaded or stalled department lead',
  6: 'Scheduled item due soon — calendar/deadline pressure',
  7: 'High-priority active project with drift/dependency pressure',
  8: 'New urgent inbound that may change priority',
};

// ── Ranking event types ──────────────────────────────────────────────────

export type RankingEventType =
  | 'blocker_created'
  | 'blocker_escalated'
  | 'blocker_aged'
  | 'blocker_reassigned'
  | 'blocker_resolved'
  | 'decision_pending'
  | 'decision_resolved'
  | 'review_requested'
  | 'review_passed'
  | 'review_failed'
  | 'review_expired'
  | 'task_status_change'
  | 'task_priority_change'
  | 'task_owner_change'
  | 'task_dependency_change'
  | 'deadline_enter_urgency'
  | 'deadline_exit_urgency'
  | 'meeting_imminent'
  | 'automation_success'
  | 'automation_failure'
  | 'automation_stale'
  | 'automation_recovery'
  | 'source_health_change'
  | 'urgent_inbound'
  | 'drift_signal_crossed';

// ── Score components ─────────────────────────────────────────────────────

export interface AttentionScoreComponents {
  blockerSeverity: number;
  decisionUrgency: number;
  deadlinePressure: number;
  dependencyImpact: number;
  ownershipGap: number;
  projectImportance: number;
  stalePenalty: number;
  noisePenalty: number;
  total: number;
}

export function zeroScore(): AttentionScoreComponents {
  return {
    blockerSeverity: 0,
    decisionUrgency: 0,
    deadlinePressure: 0,
    dependencyImpact: 0,
    ownershipGap: 0,
    projectImportance: 0,
    stalePenalty: 0,
    noisePenalty: 0,
    total: 0,
  };
}

function sumScore(s: AttentionScoreComponents): number {
  return (
    s.blockerSeverity +
    s.decisionUrgency +
    s.deadlinePressure +
    s.dependencyImpact +
    s.ownershipGap +
    s.projectImportance -
    s.stalePenalty -
    s.noisePenalty
  );
}

// ── Calendar urgency window ──────────────────────────────────────────────

export interface CalendarUrgencyWindow {
  hasDeadline: boolean;
  deadlineWithin: 'now' | '1h' | '24h' | '7d' | null;
  hasMeetingImminent: boolean;
  dataSource: 'live' | 'unknown' | 'unavailable';
}

export function unknownCalendarWindow(): CalendarUrgencyWindow {
  return {
    hasDeadline: false,
    deadlineWithin: null,
    hasMeetingImminent: false,
    dataSource: 'unknown',
  };
}

// ── Ranking candidate (internal) ─────────────────────────────────────────

export interface RankingCandidate {
  tier: AttentionRankTier;
  score: AttentionScoreComponents;
  task: KanbanTaskCard | null;
  agentId: AgentId | null;
  summary: string;
  severity: AttentionSeverity;
  action: string;
  source: AgentId | 'SYSTEM';
  triggerEvent: RankingEventType | null;
  freshnessOverride: Freshness | null;
}

// ── Ranking input ────────────────────────────────────────────────────────

export interface RankingInput {
  tasks: KanbanTaskCard[];
  /** Map of agentId → connected status */
  agentStatuses: Record<string, boolean>;
  /** Map of agentId → workload score */
  agentWorkloads: Record<string, number>;
  /** Map of agentId → blocker count */
  agentBlockers: Record<string, number>;
  boardFreshness: Freshness;
  boardConfidence: Confidence;
  calendarWindow: CalendarUrgencyWindow;
  /** Tasks marked as stale (no heartbeat recently) */
  staleTaskIds: Set<string>;
  /** Recently created task IDs (for urgent inbound detection) */
  recentTaskIds: Set<string>;
  /** Whether the data source is missing/unavailable */
  isMissing: boolean;
  /** Current timestamp for freshness calculation */
  now: Date;
}

// ── Noise filter ─────────────────────────────────────────────────────────

const NOISE_KEYWORDS = [
  'animation',
  'glow',
  'hover',
  'click',
  'page view',
  'pageview',
  'cosmetic',
  'ambient',
  'idle monitor',
  'raw message count',
  'message count',
];

const DEMO_MARKERS = ['demo', 'mock', 'test-only', 'placeholder'];

function isNoise(summary: string, task: KanbanTaskCard | null): boolean {
  const lower = summary.toLowerCase();
  for (const kw of NOISE_KEYWORDS) {
    if (lower.includes(kw)) return true;
  }
  // Exclude generic AI insight without linked source state
  if (lower.includes('ai insight') && !task) return true;
  if (lower.includes('ai generated') && !task) return true;
  return false;
}

function isMissingNoise(task: KanbanTaskCard | null, isMissing: boolean): boolean {
  if (!isMissing) return false;
  if (!task) return false;
  const lower = (task.title + ' ' + (task.body ?? '')).toLowerCase();
  for (const marker of DEMO_MARKERS) {
    if (lower.includes(marker)) return true;
  }
  return false;
}

// ── Freshness helpers ─────────────────────────────────────────────────────

/**
 * Check if a task is stale based on last heartbeat or update time.
 * No heartbeat in > 5 minutes → stale.
 */
export function isTaskStale(
  task: KanbanTaskCard,
  now: Date,
  staleThresholdMs: number = 5 * 60 * 1000,
): boolean {
  // Active tasks without a recent heartbeat are stale
  if (task.status === 'running' || task.status === 'blocked') {
    const lastHb = task.lastHeartbeatAt;
    if (lastHb) {
      const elapsed = now.getTime() - new Date(lastHb).getTime();
      return elapsed > staleThresholdMs;
    }
    // Running with no heartbeat at all — consider stale after 10 min
    if (task.startedAt) {
      const elapsed = now.getTime() - new Date(task.startedAt).getTime();
      return elapsed > 10 * 60 * 1000;
    }
  }
  return false;
}

/**
 * Compute a freshness penalty based on data quality.
 * Returns 0 (fresh) to 10 (completely stale/missing).
 */
function computeFreshnessPenalty(
  freshness: Freshness,
  confidence: Confidence,
  isStale: boolean,
): number {
  if (freshness === 'missing') return 10;
  if (freshness === 'stale' || isStale) return 7;
  if (freshness === 'fresh') {
    if (confidence === 'unverified' || confidence === 'unknown') return 4;
    if (confidence === 'placeholder') return 6;
    return 1;
  }
  // live
  if (confidence === 'unverified') return 2;
  if (confidence === 'unknown') return 3;
  return 0;
}

function mapFreshnessToAttentionSeverity(
  freshness: Freshness,
  confidence: Confidence,
  isStale: boolean,
  baseSeverity: AttentionSeverity,
): AttentionSeverity {
  if (freshness === 'missing') return 'STALE';
  if (freshness === 'stale' || isStale) return 'STALE';
  if (confidence === 'placeholder' || confidence === 'unknown') return 'DEGRADE';
  return baseSeverity;
}

// ── Score computer helpers ───────────────────────────────────────────────

/**
 * Compute blocker severity score (0–25).
 * Based on: number of blockers per agent, task age, consecutive failures.
 */
function computeBlockerSeverity(
  task: KanbanTaskCard,
  agentBlockers: Record<string, number>,
  _now: Date,
): number {
  let score = 0;
  // Base: 15 for being blocked
  score += 15;
  // Bonus for agent having multiple blockers (cascading effect)
  const assignee = task.assignee?.toLowerCase() ?? '';
  const agentBlockerCount = agentBlockers[assignee] ?? 0;
  if (agentBlockerCount > 3) score += 5;
  else if (agentBlockerCount > 1) score += 2;

  // Age bonus: blocked for >1h = +3, >24h = +5
  if (task.age !== null && task.age !== undefined) {
    if (task.age > 86400) score += 5;
    else if (task.age > 3600) score += 2;
  }

  // Consecutive failures penalty
  if (task.consecutiveFailures > 3) score += 3;
  else if (task.consecutiveFailures > 0) score += 1;

  return Math.min(score, 25);
}

/**
 * Compute decision urgency score (0–20).
 * Tasks that appear to be waiting on user input/decision.
 */
function computeDecisionUrgency(
  task: KanbanTaskCard,
  _now: Date,
): number {
  let score = 0;
  const lower = (task.title + ' ' + (task.latestSummary ?? '') + ' ' + (task.lastFailureError ?? '')).toLowerCase();
  const decisionKeywords = [
    'waiting on user', 'pending decision', 'awaiting approval',
    'needs input', 'requires decision', 'user action required',
    'pending user', 'waiting for confirmation', 'approval needed',
  ];

  let matchedKeywords = 0;
  for (const kw of decisionKeywords) {
    if (lower.includes(kw)) matchedKeywords++;
  }

  if (matchedKeywords > 0) {
    // Base urgency for decision-needed tasks
    score += 10 + matchedKeywords * 3;
  }

  // Tasks in triage that look like decisions
  if (task.status === 'triage' && (lower.includes('decide') || lower.includes('decision') || lower.includes('choose'))) {
    score += 8;
  }

  // Age urgency: waiting too long
  if (task.age !== null && task.age !== undefined) {
    if (task.age > 86400) score += 4; // >24h
    else if (task.age > 3600) score += 2; // >1h
  }

  return Math.min(score, 20);
}

/**
 * Compute deadline pressure score (0–15).
 * Based on calendar urgency window and scheduled task proximity.
 */
function computeDeadlinePressure(
  task: KanbanTaskCard,
  calendarWindow: CalendarUrgencyWindow,
): number {
  let score = 0;

  if (calendarWindow.dataSource === 'unavailable' || calendarWindow.dataSource === 'unknown') {
    // Cannot compute deadline pressure without data — return 0 honestly
    return 0;
  }

  if (calendarWindow.hasDeadline) {
    switch (calendarWindow.deadlineWithin) {
      case 'now': score += 15; break;
      case '1h': score += 12; break;
      case '24h': score += 8; break;
      case '7d': score += 3; break;
    }
  }

  if (calendarWindow.hasMeetingImminent) {
    score += 5;
  }

  // Scheduled tasks get extra pressure if calendar is live
  if (task.status === 'scheduled' && calendarWindow.dataSource === 'live') {
    score += 3;
  }

  return Math.min(score, 15);
}

/**
 * Compute dependency impact score (0–10).
 * Based on task link counts and cross-agent dependencies.
 */
function computeDependencyImpact(task: KanbanTaskCard): number {
  let score = 0;

  if (task.linkCounts) {
    // Tasks with many children indicate wide impact
    if (task.linkCounts.children > 5) score += 8;
    else if (task.linkCounts.children > 2) score += 5;
    else if (task.linkCounts.children > 0) score += 2;

    // Tasks with many parents indicate complex dependency chain
    if (task.linkCounts.parents > 3) score += 2;
  }

  // Blocked tasks inherently have dependency impact
  if (task.status === 'blocked') score += 3;

  return Math.min(score, 10);
}

/**
 * Compute ownership gap score (0–10).
 * Unassigned tasks or tasks where the lead is overloaded.
 */
function computeOwnershipGap(
  task: KanbanTaskCard,
  agentWorkloads: Record<string, number>,
  agentStatuses: Record<string, boolean>,
): number {
  let score = 0;

  // Unassigned tasks
  if (!task.assignee || task.assignee.trim() === '') {
    score += 8;
  } else {
    const assignee = task.assignee.toLowerCase();
    // Check if owner is offline
    if (agentStatuses[assignee] === false) {
      score += 5;
    }
    // High workload owner
    const workload = agentWorkloads[assignee] ?? 0;
    if (workload > 50) score += 4;
    else if (workload > 25) score += 2;
  }

  return Math.min(score, 10);
}

/**
 * Compute project importance score (0–10).
 * Based on task priority field and status.
 */
function computeProjectImportance(task: KanbanTaskCard): number {
  let score = 0;

  // Priority is a dispatcher tiebreaker number — higher = more important?
  // The API uses priority as a number; assume higher = more urgent.
  if (task.priority > 5) score += 8;
  else if (task.priority > 2) score += 5;
  else if (task.priority > 0) score += 2;

  // Running tasks with high workload weight are important active projects
  if (task.status === 'running') {
    score += 3;
  }

  return Math.min(score, 10);
}

/**
 * Compute noise penalty (0–5).
 */
function computeNoisePenalty(
  task: KanbanTaskCard | null,
  summary: string,
  isMissing: boolean,
): number {
  let penalty = 0;
  if (isNoise(summary, task)) penalty += 5;
  if (isMissingNoise(task, isMissing)) penalty += 3;
  return Math.min(penalty, 5);
}

// ── Tier classification ─────────────────────────────────────────────────

/**
 * Determine which tier a candidate attention item belongs to.
 * Uses the primary signal to classify into exactly one tier.
 */
function classifyTier(
  task: KanbanTaskCard,
  _score: AttentionScoreComponents,
  calendarWindow: CalendarUrgencyWindow,
  agentWorkloads: Record<string, number>,
): AttentionRankTier {
  const assignee = task.assignee?.toLowerCase() ?? '';

  // Tier 1: Waiting on user / pending user decision
  const lower = (task.title + ' ' + (task.latestSummary ?? '') + ' ' + (task.lastFailureError ?? '')).toLowerCase();
  const decisionPatterns = [
    'waiting on user', 'pending decision', 'awaiting approval',
    'needs input', 'requires decision', 'user action required',
    'pending user', 'waiting for confirmation',
  ];
  const isDecisionPending = decisionPatterns.some(p => lower.includes(p))
    || (task.status === 'blocked' && task.lastFailureError?.toLowerCase().includes('waiting'))
    || (task.status === 'triage' && (lower.includes('decide') || lower.includes('choose')));

  if (isDecisionPending) return 1;

  // Tier 2: Blockers
  if (task.status === 'blocked') return 2;

  // Tier 3: Failed/stale/degraded automation
  const hasAutomationFailure =
    task.consecutiveFailures > 2 ||
    (task.lastFailureError !== null && task.lastFailureError !== undefined) ||
    (task.warnings && task.warnings.length > 2);
  if (hasAutomationFailure) return 3;

  // Tier 4: Review needed
  if (task.status === 'review') return 4;

  // Tier 5: Overloaded or stalled lead
  const workload = agentWorkloads[assignee] ?? 0;
  if (workload > 50) return 5;
  if (task.status === 'running' && task.lastHeartbeatAt) {
    const elapsed = Date.now() - new Date(task.lastHeartbeatAt).getTime();
    if (elapsed > 15 * 60 * 1000) return 5; // stalled > 15 min
  }

  // Tier 6: Scheduled due soon
  if (task.status === 'scheduled' && calendarWindow.dataSource === 'live' && calendarWindow.hasDeadline) {
    return 6;
  }

  // Tier 7: High-priority active project with drift
  if (task.status === 'running' && task.priority > 2) return 7;
  if (task.status === 'running' && task.linkCounts && task.linkCounts.children > 0) return 7;

  // Tier 8: New urgent inbound
  // Tasks with high priority that were recently created
  if (task.priority > 3) return 8;

  // Default: fall through to lowest tier
  return 8;
}

// ── Main ranking engine ──────────────────────────────────────────────────

/**
 * Compute a full attention score for a candidate task.
 */
export function computeAttentionScore(
  task: KanbanTaskCard,
  input: RankingInput,
): AttentionScoreComponents {
  const score: AttentionScoreComponents = {
    blockerSeverity: 0,
    decisionUrgency: 0,
    deadlinePressure: 0,
    dependencyImpact: 0,
    ownershipGap: 0,
    projectImportance: 0,
    stalePenalty: 0,
    noisePenalty: 0,
    total: 0,
  };

  const isStale = isTaskStale(task, input.now);

  // Compute each component
  score.blockerSeverity = task.status === 'blocked'
    ? computeBlockerSeverity(task, input.agentBlockers, input.now)
    : 0;

  score.decisionUrgency = computeDecisionUrgency(task, input.now);
  score.deadlinePressure = computeDeadlinePressure(task, input.calendarWindow);
  score.dependencyImpact = computeDependencyImpact(task);
  score.ownershipGap = computeOwnershipGap(task, input.agentWorkloads, input.agentStatuses);
  score.projectImportance = computeProjectImportance(task);

  // Penalties
  score.stalePenalty = computeFreshnessPenalty(
    input.boardFreshness,
    input.boardConfidence,
    isStale || input.staleTaskIds.has(task.id),
  );

  score.noisePenalty = 0; // Will be applied at summary time

  score.total = sumScore(score);
  return score;
}

/**
 * Create an attention summary string for a given task tier and state.
 */
function buildSummary(
  task: KanbanTaskCard,
  tier: AttentionRankTier,
  agentWorkloads: Record<string, number>,
): string {
  const assignee = task.assignee ?? 'unassigned';
  const title = task.title.length > 50 ? task.title.slice(0, 47) + '…' : task.title;

  switch (tier) {
    case 1:
      return `decision pending: ${assignee} — ${title}`;
    case 2:
      return `blocked: ${assignee} — ${title}`;
    case 3:
      if (task.consecutiveFailures > 0) {
        return `failed ${task.consecutiveFailures}x: ${assignee} — ${title}`;
      }
      if (task.lastFailureError) {
        const err = task.lastFailureError.length > 40
          ? task.lastFailureError.slice(0, 37) + '…'
          : task.lastFailureError;
        return `failed: ${assignee} — ${err}`;
      }
      return `degraded: ${assignee} — ${title}`;
    case 4:
      return `review needed: ${assignee} — ${title}`;
    case 5: {
      const wl = agentWorkloads[assignee.toLowerCase()] ?? 0;
      return `overloaded: ${assignee} (${Math.round(wl)}) — ${title}`;
    }
    case 6:
      return `scheduled due: ${assignee} — ${title}`;
    case 7:
      return `drift risk: ${assignee} — ${title}`;
    case 8:
      return `urgent inbound: ${assignee} — ${title}`;
    default:
      return `${assignee}: ${title}`;
  }
}

/**
 * Determine the action label for a given tier.
 */
function buildAction(tier: AttentionRankTier): string {
  switch (tier) {
    case 1: return 'decide';
    case 2: return 'unblock';
    case 3: return 'diagnose';
    case 4: return 'review';
    case 5: return 'redistribute';
    case 6: return 'prepare';
    case 7: return 'stabilize';
    case 8: return 'triage';
    default: return 'inspect';
  }
}

/**
 * Determine severity from tier and score.
 */
function tierToSeverity(
  tier: AttentionRankTier,
  freshness: Freshness,
  confidence: Confidence,
  isStale: boolean,
): AttentionSeverity {
  const baseSeverity: AttentionSeverity =
    tier <= 2 ? 'CRITICAL' :
    tier <= 4 ? 'WARNING' :
    'INFO';

  return mapFreshnessToAttentionSeverity(freshness, confidence, isStale, baseSeverity);
}

/**
 * Format a relative duration string.
 */
function formatDuration(startedAt: string | null, age: number | null, now: Date): string | undefined {
  if (age !== null && age !== undefined) {
    if (age < 60) return `${Math.round(age)}s ago`;
    if (age < 3600) return `${Math.round(age / 60)}m ago`;
    if (age < 86400) return `${Math.round(age / 3600)}h ago`;
    return `${Math.round(age / 86400)}d ago`;
  }
  if (startedAt) {
    const diff = now.getTime() - new Date(startedAt).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }
  return undefined;
}

/**
 * Rank all attention candidates into a final ordered list.
 *
 * This is the main entry point for the ranking engine.
 * It is deterministic: same inputs always produce same outputs.
 */
export function rankAttentionItems(input: RankingInput): AttentionItem[] {
  const candidates: RankingCandidate[] = [];

  // Scan every task as a potential attention item
  for (const task of input.tasks) {
    // Skip done tasks — they don't need attention
    if (task.status === 'done') continue;

    const score = computeAttentionScore(task, input);
    const tier = classifyTier(task, score, input.calendarWindow, input.agentWorkloads);

    // Skip tasks with negligible scores unless they're blockers or decisions
    if (score.total <= 0 && tier > 4) continue;

    const summary = buildSummary(task, tier, input.agentWorkloads);
    const noisePenalty = computeNoisePenalty(task, summary, input.isMissing);

    // Apply noise penalty
    score.noisePenalty = noisePenalty;
    score.total = sumScore(score);

    // Skip noise items
    if (noisePenalty >= 5) continue;

    candidates.push({
      tier,
      score,
      task,
      agentId: task.assignee as AgentId | null,
      summary,
      severity: tierToSeverity(
        tier,
        input.boardFreshness,
        input.boardConfidence,
        input.staleTaskIds.has(task.id) || isTaskStale(task, input.now),
      ),
      action: buildAction(tier),
      source: (task.assignee as AgentId) ?? 'SYSTEM',
      triggerEvent: null,
      freshnessOverride: null,
    });
  }

  // ── Generate system-level attention items ─────────────────────────────

  // If board freshness is degraded, create a system attention item
  if (input.boardFreshness === 'stale' || input.boardFreshness === 'missing') {
    candidates.push({
      tier: 3, // Stale data = degraded automation
      score: {
        ...zeroScore(),
        stalePenalty: input.boardFreshness === 'missing' ? 10 : 7,
        total: 0,
      },
      task: null,
      agentId: null,
      summary: input.boardFreshness === 'missing'
        ? 'board data unavailable — attention state unknown'
        : 'board data stale — rankings may be out of date',
      severity: input.boardFreshness === 'missing' ? 'STALE' : 'DEGRADE',
      action: 'verify connection',
      source: 'SYSTEM',
      triggerEvent: 'source_health_change',
      freshnessOverride: input.boardFreshness,
    });
  }

  // Calendar unknown state
  if (input.calendarWindow.dataSource === 'unknown') {
    candidates.push({
      tier: 6,
      score: { ...zeroScore(), total: 0 },
      task: null,
      agentId: null,
      summary: 'calendar/deadline awareness unavailable — schedule data not connected',
      severity: 'STALE',
      action: 'connect calendar',
      source: 'SYSTEM',
      triggerEvent: null,
      freshnessOverride: 'missing',
    });
  }

  // ── Sort candidates ──────────────────────────────────────────────────

  // Sort by tier first (ascending = higher priority), then by score descending
  candidates.sort((a, b) => {
    // Tier is primary sort (lower = higher priority)
    if (a.tier !== b.tier) return a.tier - b.tier;
    // Within same tier, higher score first
    if (b.score.total !== a.score.total) return b.score.total - a.score.total;
    // Tiebreaker: stale/unknown items sort lower within tier
    const aStale = a.severity === 'STALE' || a.severity === 'DEGRADE' ? 1 : 0;
    const bStale = b.severity === 'STALE' || b.severity === 'DEGRADE' ? 1 : 0;
    return aStale - bStale;
  });

  // ── Convert to AttentionItem[] ───────────────────────────────────────

  const timestamp = `${String(input.now.getHours()).padStart(2, '0')}:${String(input.now.getMinutes()).padStart(2, '0')}:${String(input.now.getSeconds()).padStart(2, '0')}.000`;

  const items: AttentionItem[] = candidates.map((c, i) => ({
    rank: i + 1,
    severity: c.severity,
    timestamp,
    source: c.source,
    summary: c.summary.length > 60 ? c.summary.slice(0, 57) + '…' : c.summary,
    duration: c.task
      ? formatDuration(c.task.startedAt, c.task.age, input.now)
      : undefined,
    action: c.action,
    freshness: c.freshnessOverride ?? input.boardFreshness,
  }));

  // Ensure at least 3 items for display
  const emptySummary = input.boardFreshness === 'missing'
    ? 'unknown attention state'
    : 'no active attention items';

  while (items.length < 3) {
    items.push({
      rank: items.length + 1,
      severity: 'INFO',
      timestamp: '--:--:--.---',
      source: 'SYSTEM',
      summary: emptySummary,
      freshness: input.boardFreshness,
    });
  }

  return items;
}

// ── Convenience helper: build ranking input from board + metadata ──────

export function buildRankingInput(params: {
  tasks: KanbanTaskCard[];
  boardFreshness: Freshness;
  boardConfidence: Confidence;
  calendarWindow: CalendarUrgencyWindow;
  isMissing: boolean;
  now?: Date;
}): RankingInput {
  const now = params.now ?? new Date();
  const agentStatuses: Record<string, boolean> = {};
  const agentWorkloads: Record<string, number> = {};
  const agentBlockers: Record<string, number> = {};
  const staleTaskIds = new Set<string>();
  const recentTaskIds = new Set<string>();

  // Compute per-agent metrics from tasks
  const taskMap = new Map<string, KanbanTaskCard[]>();
  for (const task of params.tasks) {
    const key = task.assignee?.toLowerCase() ?? '__unassigned__';
    const list = taskMap.get(key) ?? [];
    list.push(task);
    taskMap.set(key, list);

    // Track stale tasks
    if (isTaskStale(task, now)) {
      staleTaskIds.add(task.id);
    }

    // Track recent tasks (< 5 min old)
    if (task.createdAt) {
      const elapsed = now.getTime() - new Date(task.createdAt).getTime();
      if (elapsed < 5 * 60 * 1000) {
        recentTaskIds.add(task.id);
      }
    }
  }

  // Compute agent metrics
  for (const [agentKey, agentTasks] of taskMap) {
    let workload = 0;
    let blockers = 0;

    for (const task of agentTasks) {
      const isSubAgent = task.assignee?.toLowerCase() !== agentKey &&
        task.assignee?.toLowerCase().startsWith(agentKey);
      const multiplier = isSubAgent ? SUB_AGENT_MULTIPLIER : 1.0;
      const weight = STATE_WEIGHT[task.status as KanbanStatus] ?? 0;
      workload += weight * multiplier;
      if (task.status === 'blocked') blockers++;
    }

    agentWorkloads[agentKey] = workload;
    agentBlockers[agentKey] = blockers;
    // All agents with tasks are "online" for ranking purposes
    agentStatuses[agentKey] = agentTasks.length > 0;
  }

  return {
    tasks: params.tasks,
    agentStatuses,
    agentWorkloads,
    agentBlockers,
    boardFreshness: params.boardFreshness,
    boardConfidence: params.boardConfidence,
    calendarWindow: params.calendarWindow,
    staleTaskIds,
    recentTaskIds,
    isMissing: params.isMissing,
    now,
  };
}

// ── Deterministic re-rank check ──────────────────────────────────────────

/**
 * Determine if a state change event warrants a re-ranking.
 * Returns true for any operational event that changes attention signals.
 */
export function shouldRerankOnEvent(_eventType: RankingEventType): boolean {
  // All ranking event types trigger re-ranking
  return true;
}

/**
 * Compute a fingerprint hash for current ranking state.
 * Two identical states produce the same fingerprint (determinism check).
 */
export function rankingFingerprint(items: AttentionItem[]): string {
  // Simple deterministic fingerprint from key fields
  const parts = items.map(item =>
    `${item.rank}:${item.severity}:${item.source}:${item.summary.slice(0, 30)}:${item.freshness}`
  );
  return parts.join('|');
}
