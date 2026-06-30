/** @vitest-environment jsdom */
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { MissionBar } from '@/components/shell/MissionBar';
import { boardStore } from '@/state/boardStore';
import { shellStore } from '@/state/shellStore';

function renderBar(title?: string) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<MissionBar title={title} />);
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
  boardStore._resetForTest();
  shellStore.setView('kanban');
  shellStore.setConnection('connected');
  document.body.innerHTML = '';
});

describe('MissionBar Hermes header', () => {
  it('renders only the active page title plus compact state metadata', () => {
    const view = renderBar('Kanban');

    const text = view.container.textContent ?? '';
    expect(text).toContain('Kanban');
    expect(text).toContain('unknown/unknown');
    expect(text).not.toContain('Systems');
    expect(text).not.toContain('Office');
    expect(text).not.toContain('Chat focus');

    view.unmount();
  });
});
