/** @vitest-environment jsdom */
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';

import type { CalendarEvent, CalendarStoreState } from '@/types/calendar';

const mockUseCalendarState = vi.fn<() => CalendarStoreState>();
const mockSetCalendarFreshness = vi.fn();
const mockPushCalendarWarning = vi.fn();
const mockReplaceCalendarEvents = vi.fn();

vi.mock('@/state/calendarStore', () => ({
  get useCalendarState() {
    return mockUseCalendarState;
  },
  get setCalendarFreshness() {
    return mockSetCalendarFreshness;
  },
  get pushCalendarWarning() {
    return mockPushCalendarWarning;
  },
  get replaceCalendarEvents() {
    return mockReplaceCalendarEvents;
  },
}));

import { CalendarPage } from './Calendar';

function renderCalendar() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<CalendarPage />);
  });
  return {
    container,
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = '';
  mockSetCalendarFreshness.mockClear();
  mockPushCalendarWarning.mockClear();
  mockReplaceCalendarEvents.mockClear();
});

describe('Calendar page', () => {
  it('renders empty state', () => {
    mockUseCalendarState.mockReturnValue({
      events: [],
      warnings: [],
      freshness: 'live',
    });

    const view = renderCalendar();

    expect(view.container.querySelector('.calendar-empty-state')).not.toBeNull();
    expect(view.container.textContent).toContain('No calendar data');
    expect(view.container.querySelector('.freshness-badge--live')).not.toBeNull();

    view.unmount();
  });

  it('renders unavailable state', () => {
    mockUseCalendarState.mockReturnValue({
      events: [],
      warnings: [],
      freshness: 'missing',
    });

    const view = renderCalendar();

    expect(view.container.querySelector('.freshness-badge--unavailable')).not.toBeNull();
    expect(view.container.textContent).toContain('Calendar unavailable');
    expect(view.container.textContent).toContain('OFFLINE');
    expect(view.container.querySelector('.calendar-warning-bar--offline')).not.toBeNull();

    view.unmount();
  });

  it('renders warning bar when warnings present', () => {
    mockUseCalendarState.mockReturnValue({
      events: [],
      warnings: ['Missed deadline: quarterly review'],
      freshness: 'live',
    });

    const view = renderCalendar();

    expect(view.container.querySelector('.calendar-warning-bar')).not.toBeNull();
    expect(view.container.textContent).toContain('1 warning');

    view.unmount();
  });

  it('renders warning bar with multiple warnings', () => {
    mockUseCalendarState.mockReturnValue({
      events: [],
      warnings: ['Missed deadline: review', 'Stale event: team sync'],
      freshness: 'live',
    });

    const view = renderCalendar();

    expect(view.container.querySelector('.calendar-warning-bar')).not.toBeNull();
    expect(view.container.textContent).toContain('2 warnings');

    view.unmount();
  });

  it('hides warning bar when no warnings and empty events', () => {
    // This test verifies the empty state path doesn't show a warning bar
    // when warnings array is empty
    mockUseCalendarState.mockReturnValue({
      events: [],
      warnings: [],
      freshness: 'live',
    });

    const view = renderCalendar();

    // In the empty state path, the warning bar is hidden when warnings.length === 0,
    // but the empty state block still renders (just without the warning bar div)
    const warningBars = view.container.querySelectorAll('.calendar-warning-bar');
    // The empty-state path conditionally renders: warnings.length > 0 && <warning bar>
    // So with empty warnings, there should be no warning bar at all
    expect(warningBars.length).toBe(0);

    view.unmount();
  });

  it('renders calendar entries with correct event type tags', () => {
    const now = new Date().toISOString();
    const events: CalendarEvent[] = [
      {
        timestamp: now,
        eventType: 'deadline',
        title: 'Phase H test deadline',
        urgency: 'soon',
        status: 'confirmed',
        freshness: 'live',
      },
    ];

    mockUseCalendarState.mockReturnValue({
      events,
      warnings: [],
      freshness: 'live',
    });

    const view = renderCalendar();

    expect(view.container.querySelector('.calendar-entry')).not.toBeNull();
    expect(view.container.textContent).toContain('[DEADLINE ]');
    expect(view.container.textContent).toContain('Phase H test deadline');
    expect(view.container.textContent).toContain('HIGH');

    view.unmount();
  });

  it('shows rank impact for urgent events', () => {
    const now = new Date().toISOString();
    const events: CalendarEvent[] = [
      {
        timestamp: now,
        eventType: 'deadline',
        title: 'Critical deadline',
        urgency: 'urgent',
        status: 'confirmed',
        freshness: 'live',
      },
    ];

    mockUseCalendarState.mockReturnValue({
      events,
      warnings: [],
      freshness: 'live',
    });

    const view = renderCalendar();

    expect(view.container.textContent).toContain('CRITICAL');
    expect(view.container.textContent).toContain('Affects rank');
    expect(view.container.querySelector('.calendar-entry--critical')).not.toBeNull();

    view.unmount();
  });

  it('renders overdue events with correct styling', () => {
    const now = new Date().toISOString();
    const events: CalendarEvent[] = [
      {
        timestamp: now,
        eventType: 'deadline',
        title: 'Overdue task',
        urgency: 'urgent',
        status: 'missed',
        freshness: 'live',
      },
    ];

    mockUseCalendarState.mockReturnValue({
      events,
      warnings: [],
      freshness: 'live',
    });

    const view = renderCalendar();

    expect(view.container.querySelector('.calendar-entry--overdue')).not.toBeNull();

    view.unmount();
  });

  it('renders warning bar with overdue count in normal view', () => {
    const now = new Date().toISOString();
    const events: CalendarEvent[] = [
      {
        timestamp: now,
        eventType: 'deadline',
        title: 'Missed deadline',
        urgency: 'urgent',
        status: 'missed',
        freshness: 'live',
      },
    ];

    mockUseCalendarState.mockReturnValue({
      events,
      warnings: ['Overdue item!'],
      freshness: 'live',
    });

    const view = renderCalendar();

    expect(view.container.textContent).toContain('1 overdue');
    expect(view.container.textContent).toContain('1 warning');

    view.unmount();
  });
});
