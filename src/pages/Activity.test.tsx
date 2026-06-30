/** @vitest-environment jsdom */
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';

import type { ActivityEvent, ActivityStoreState } from '@/types/activity';

const mockUseActivityState = vi.fn<() => ActivityStoreState>();

vi.mock('@/state/activityStore', () => ({
  get useActivityState() {
    return mockUseActivityState;
  },
}));

import { ActivityPage } from './Activity';

function renderActivity() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<ActivityPage />);
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
});

describe('Activity page', () => {
  it('renders empty state when store has no events', () => {
    mockUseActivityState.mockReturnValue({
      events: [],
      freshness: 'live',
    });

    const view = renderActivity();

    expect(view.container.querySelector('.activity-empty-state')).not.toBeNull();
    expect(view.container.textContent).toContain('No activity events recorded');
    expect(view.container.querySelector('.freshness-badge--live')).not.toBeNull();

    view.unmount();
  });

  it('renders unavailable state when freshness is missing', () => {
    mockUseActivityState.mockReturnValue({
      events: [],
      freshness: 'missing',
    });

    const view = renderActivity();

    expect(view.container.querySelector('.freshness-badge--unavailable')).not.toBeNull();
    expect(view.container.textContent).toContain('Activity data unavailable');
    expect(view.container.textContent).toContain('OFFLINE');

    view.unmount();
  });

  it('renders event entries when store has data', () => {
    const events: ActivityEvent[] = [
      {
        timestamp: '2026-06-29T14:30:00.000Z',
        source: 'biscuit',
        eventType: 'task.completed',
        summary: 'Write tests for Phase H',
        freshness: 'live',
        severity: 'INFO',
      },
      {
        timestamp: '2026-06-29T14:15:00.000Z',
        source: 'tifa',
        eventType: 'task.blocked',
        summary: 'Deployment blocked by proxy auth',
        freshness: 'live',
        severity: 'WARNING',
      },
    ];

    mockUseActivityState.mockReturnValue({
      events,
      freshness: 'live',
    });

    const view = renderActivity();

    expect(view.container.querySelector('.activity-entry')).not.toBeNull();
    expect(view.container.querySelector('.activity-entry--blocker')).not.toBeNull();
    expect(view.container.textContent).toContain('Write tests for Phase H');
    expect(view.container.textContent).toContain('Deployment blocked by proxy auth');
    expect(view.container.querySelector('[role="log"]')).not.toBeNull();

    view.unmount();
  });

  it('groups events by day', () => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    const events: ActivityEvent[] = [
      {
        timestamp: `${today}T10:00:00.000Z`,
        source: 'cloud',
        eventType: 'task.started',
        summary: 'Today task',
        freshness: 'live',
      },
      {
        timestamp: `${yesterday}T10:00:00.000Z`,
        source: 'korra',
        eventType: 'task.completed',
        summary: 'Yesterday task',
        freshness: 'live',
      },
    ];

    mockUseActivityState.mockReturnValue({
      events,
      freshness: 'live',
    });

    const view = renderActivity();

    expect(view.container.querySelectorAll('.activity-day-group').length).toBe(2);
    expect(view.container.textContent).toContain('Today');
    expect(view.container.textContent).toContain('Yesterday');

    view.unmount();
  });

  it('renders timeline with event type tags and source names', () => {
    const now = new Date().toISOString();
    const events: ActivityEvent[] = [
      {
        timestamp: now,
        source: 'biscuit',
        eventType: 'task.completed',
        summary: 'Completed task',
        freshness: 'live',
      },
    ];

    mockUseActivityState.mockReturnValue({
      events,
      freshness: 'live',
    });

    const view = renderActivity();

    expect(view.container.textContent).toContain('[TASK_STATE]');
    expect(view.container.textContent).toContain('BISCUIT');

    view.unmount();
  });
});
