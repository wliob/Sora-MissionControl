/** @vitest-environment jsdom */
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';

import { DecisionsPage } from './Decisions';

function renderDecisions() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<DecisionsPage />);
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

describe('Decisions page', () => {
  it('renders unavailable state correctly (no backend)', () => {
    const view = renderDecisions();

    expect(view.container.querySelector('.freshness-badge--unavailable')).not.toBeNull();
    expect(view.container.textContent).toContain('Decision data unavailable');
    expect(view.container.textContent).toContain('OFFLINE');
    expect(view.container.textContent).toContain('DECISION LOG');

    view.unmount();
  });

  it('shows correct empty state messaging', () => {
    const view = renderDecisions();

    expect(view.container.textContent).toContain(
      'decision-records source is not connected',
    );
    expect(view.container.textContent).toContain(
      'structured decision archive',
    );
    expect(view.container.querySelector('.decisions-empty-panel')).not.toBeNull();

    view.unmount();
  });

  it('renders the filter bar with disabled controls', () => {
    const view = renderDecisions();

    const filterBar = view.container.querySelector('.decisions-filter-bar');
    expect(filterBar).not.toBeNull();
    expect(filterBar!.textContent).toContain('[All Threads');
    expect(filterBar!.textContent).toContain('[All Agents');

    view.unmount();
  });

  it('renders status bar with OFFLINE system state', () => {
    const view = renderDecisions();

    const statusBar = view.container.querySelector('.decisions-status-bar');
    expect(statusBar).not.toBeNull();
    expect(statusBar!.textContent).toContain('OFFLINE');
    expect(statusBar!.textContent).toContain('UTC');

    view.unmount();
  });

  it('renders header with Decisions title', () => {
    const view = renderDecisions();

    expect(view.container.textContent).toContain('Decisions');

    view.unmount();
  });
});
