/** @vitest-environment jsdom */
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { ProfileSelector } from '@/components/common/ProfileSelector';

function renderSelector() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <ProfileSelector
        selected="biscuit"
        onSelect={() => undefined}
        activity={{ biscuit: 'working', korra: 'idle' }}
      />,
    );
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

describe('ProfileSelector presence rail', () => {
  it('renders a quieter presence rail with compact callsigns while keeping full accessible labels', () => {
    const view = renderSelector();

    expect(view.container.textContent).toContain('Presence');
    expect(view.container.textContent).toContain('CLO');
    expect(view.container.textContent).toContain('BIS');
    expect(view.container.textContent).toContain('KOR');
    expect(view.container.textContent).toContain('LEL');
    expect(view.container.textContent).toContain('TIF');
    expect(view.container.textContent).not.toContain('Automation & Coding');

    const biscuit = view.container.querySelector('[data-profile-selector-agent="biscuit"]') as HTMLButtonElement | null;
    expect(biscuit?.getAttribute('aria-pressed')).toBe('true');
    expect(biscuit?.getAttribute('aria-label')).toContain('Biscuit');
    expect(biscuit?.getAttribute('aria-label')).toContain('Automation & Coding');

    view.unmount();
  });
});
