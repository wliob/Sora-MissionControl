/**
 * Activity feed types for the Activity dashboard page.
 *
 * ActivityEvent represents a single event in the mission-control activity log.
 * Events are derived from boardStore / teamStore task changes, session state
 * transitions, and other runtime signals. When no data source is connected,
 * the store surfaces honest empty/unavailable states via `freshness`.
 */

import type { AgentId } from './agents';
import type { Freshness } from './provenance';

export type ActivityEventType =
  | 'task.created'
  | 'task.claimed'
  | 'task.started'
  | 'task.blocked'
  | 'task.unblocked'
  | 'task.review_requested'
  | 'task.completed'
  | 'task.reassigned'
  | 'session.started'
  | 'session.ended'
  | 'agent.online'
  | 'agent.offline'
  | 'agent.blocked'
  | 'delegation.handoff'
  | 'delegation.escalation'
  | 'system.health_change'
  | 'system.unknown';

export type ActivitySeverity = 'CRITICAL' | 'WARNING' | 'INFO' | 'STALE';

export interface ActivityEvent {
  /** ISO 8601 timestamp when the event was observed. */
  timestamp: string;
  /** Agent source (e.g. 'biscuit', 'tifa') or 'SYSTEM'. */
  source: AgentId | 'SYSTEM';
  /** The type of event that occurred. */
  eventType: ActivityEventType;
  /** One-line summary (max ~80 chars, truncated with …). */
  summary: string;
  /** Data freshness for this event. */
  freshness: Freshness;
  /** Optional severity override; defaults to INFO when unset. */
  severity?: ActivitySeverity;
}

export interface ActivityStoreState {
  events: ActivityEvent[];
  /** Overall data-source freshness. Use `freshness === 'missing'` to detect unavailable data. */
  freshness: Freshness;
}

/** Default empty activity state — honest truth about unavailability. */
export function initialActivityState(): ActivityStoreState {
  return {
    events: [],
    freshness: 'missing',
  };
}
