/**
 * Calendar types for the Calendar dashboard page.
 *
 * CalendarEvent represents a scheduled or observed event in the mission-control
 * timeline. When no calendar backend is connected, the store surfaces honest
 * 'missing' freshness and empty event lists.
 */

import type { Freshness } from './provenance';

export type CalendarUrgency = 'urgent' | 'soon' | 'upcoming' | 'unknown';

export type CalendarEventStatus =
  | 'confirmed'
  | 'tentative'
  | 'missed'
  | 'completed'
  | 'stale';

export type CalendarEventType =
  | 'deadline'
  | 'milestone'
  | 'meeting'
  | 'review'
  | 'reminder'
  | 'scheduled'
  | 'system'
  | 'unknown';

export interface CalendarEvent {
  /** ISO 8601 timestamp for the event. */
  timestamp: string;
  /** The type of calendar event. */
  eventType: CalendarEventType;
  /** Human-readable title or summary. */
  title: string;
  /** Urgency classification. */
  urgency: CalendarUrgency;
  /** Current status of the event. */
  status: CalendarEventStatus;
  /** Data freshness for this event. */
  freshness: Freshness;
}

export interface CalendarStoreState {
  events: CalendarEvent[];
  /** Advisory warnings (e.g., missed deadlines, stale events). */
  warnings: string[];
  /** Overall data-source freshness. Use `freshness === 'missing'` to detect unavailable data. */
  freshness: Freshness;
}

/** Default empty calendar state — honest truth about unavailability. */
export function initialCalendarState(): CalendarStoreState {
  return {
    events: [],
    warnings: [],
    freshness: 'missing',
  };
}
