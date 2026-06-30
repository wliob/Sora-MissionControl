/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AttentionWidget } from '@/components/shell/AttentionWidget';

const mockItems = vi.hoisted(() => ({
  value: [] as any[],
}));

vi.mock('@/hooks/useAttentionItems', () => ({
  useAttentionItems: () => mockItems.value,
}));

vi.mock('@/state/teamStore', () => ({
  useTeamState: () => ({ freshness: 'live' }),
}));

function renderWidget() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<AttentionWidget />);
  });
  return {
    container,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = '';
  window.history.replaceState({}, '', '/team');
});

describe('AttentionWidget action controls', () => {
  it('navigates implemented canonical-agent actions to the real Project Control route', () => {
    mockItems.value = [
      {
        rank: 1,
        severity: 'WARNING',
        timestamp: '12:00:00.000',
        source: 'biscuit',
        summary: 'blocked: biscuit - Live integration',
        action: 'unblock',
        freshness: 'live',
      },
    ];

    const view = renderWidget();
    const button = view.container.querySelector('.attention-widget__action') as HTMLButtonElement | null;

    expect(button?.disabled).toBe(false);
    act(() => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(window.location.pathname).toBe('/kanban');

    view.unmount();
  });

  it('disables unavailable actions with an explicit reason instead of rendering inert buttons', () => {
    mockItems.value = [
      {
        rank: 1,
        severity: 'STALE',
        timestamp: '12:00:00.000',
        source: 'SYSTEM',
        summary: 'unmapped system action',
        action: 'stabilize',
        freshness: 'missing',
      },
    ];

    const view = renderWidget();
    const button = view.container.querySelector('.attention-widget__action') as HTMLButtonElement | null;

    expect(button?.disabled).toBe(true);
    expect(button?.title).toContain('No implemented navigation target');
    expect(view.container.textContent).toContain('No implemented navigation target');

    view.unmount();
  });
});
