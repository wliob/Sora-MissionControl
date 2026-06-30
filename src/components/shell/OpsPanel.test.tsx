/** @vitest-environment jsdom */
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { OpsPanel } from '@/components/shell/OpsPanel';
import { _resetForTest as resetSessionConnectionStore } from '@/state/sessionConnectionStore';
import { _resetForTest as resetUsageStore } from '@/state/usageStore';

function renderPanel() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<OpsPanel />);
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
  resetSessionConnectionStore();
  resetUsageStore();
  document.body.innerHTML = '';
});

describe('OpsPanel unknown telemetry state', () => {
  it('collapses the default disconnected state into one telemetry-not-verified verdict instead of repeating unknown sections', () => {
    const view = renderPanel();

    expect(view.container.textContent).toContain('Telemetry not verified');
    expect(view.container.textContent).toContain('0 of 8 telemetry sources verified');
    expect(view.container.textContent).toContain('Open diagnostics');
    expect(view.container.textContent).not.toContain('No alert events currently reported');
    expect(view.container.textContent).not.toContain('Consumption');
    expect(view.container.textContent).not.toContain('Provider Quotas');

    view.unmount();
  });
});
