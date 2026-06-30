/**
 * Calendar store — calendar event list for the Calendar dashboard page.
 *
 * Holds CalendarEvent entries and advisory warnings. When no calendar
 * backend is connected, surfaces honest 'missing' freshness and empty
 * event lists.
 *
 * Pattern: useSyncExternalStore with manual listeners (matches teamStore).
 */

import { useSyncExternalStore } from 'react';
import type {
  CalendarEvent,
  CalendarStoreState,
} from '@/types/calendar';
import { initialCalendarState } from '@/types/calendar';
import type { Freshness } from '@/types';

// ── Store state ───────────────────────────────────────────────────

let state: CalendarStoreState = initialCalendarState();
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot(): CalendarStoreState {
  return state;
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Add a calendar event to the store.
 * Events are kept sorted by timestamp (ascending) and deduplicated by
 * timestamp + title.
 */
export function pushCalendarEvent(event: CalendarEvent): void {
  // Deduplicate
  const exists = state.events.some(
    e => e.timestamp === event.timestamp && e.title === event.title,
  );
  if (exists) return;

  const next = [...state.events, event];
  next.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  state = { ...state, events: next };
  emit();
}

/**
 * Add an advisory warning to the calendar store.
 */
export function pushCalendarWarning(warning: string): void {
  if (state.warnings.includes(warning)) return;
  state = { ...state, warnings: [...state.warnings, warning] };
  emit();
}

/**
 * Clear all calendar events and warnings, resetting to initial state.
 */
export function clearCalendarEvents(): void {
  state = initialCalendarState();
  emit();
}

/**
 * Update the overall freshness of the calendar data source.
 */
export function setCalendarFreshness(freshness: Freshness): void {
  if (state.freshness === freshness) return;
  state = { ...state, freshness };
  emit();
}

export const calendarStore = {
  get state(): CalendarStoreState {
    return state;
  },
  pushEvent(event: CalendarEvent): void {
    pushCalendarEvent(event);
  },
  pushWarning(warning: string): void {
    pushCalendarWarning(warning);
  },
  clear(): void {
    clearCalendarEvents();
  },
  setFreshness(freshness: Freshness): void {
    setCalendarFreshness(freshness);
  },
};

export function useCalendarState(): CalendarStoreState {
  return useSyncExternalStore(subscribe, getSnapshot);
}
