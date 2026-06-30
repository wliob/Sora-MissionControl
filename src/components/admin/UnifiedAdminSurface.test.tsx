/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { UnifiedAdminSurface } from '@/components/admin/UnifiedAdminSurface';
import {
  clearMissionControlAdminProxyToken,
  getMissionControlAdminProxyAuthState,
  _resetMissionControlAdminProxyAuthForTest,
} from '@/services/hermes/adminProxyAdapter';
import {
  loadKeys,
  setKeyMcpAdminAdapter,
  _resetForTest as resetKeyMcpStoreForTest,
  type KeyMcpAdminAdapter,
} from '@/state/adminKeyMcpStore';

function renderSurface() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<UnifiedAdminSurface />);
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

function clickButton(container: HTMLElement, label: string) {
  const button = Array.from(container.querySelectorAll('button')).find((candidate) =>
    candidate.textContent?.includes(label),
  ) as HTMLButtonElement | undefined;
  expect(button).toBeDefined();
  act(() => {
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  return button!;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  _resetMissionControlAdminProxyAuthForTest();
  resetKeyMcpStoreForTest();
  clearMissionControlAdminProxyToken();
  window.localStorage.clear();
  window.sessionStorage.clear();
  document.body.innerHTML = '';
});

describe('UnifiedAdminSurface admin proxy auth control', () => {
  it('uses systems-bay wording for route tabs and token staging controls', () => {
    const view = renderSurface();

    expect(view.container.textContent).toContain('Model routing');
    expect(view.container.textContent).toContain('Access & Links');
    expect(view.container.textContent).toContain('Schedulers & Hooks');
    expect(view.container.textContent).toContain('Systems proxy token');
    expect(view.container.textContent).toContain('Stage token');
    expect(view.container.textContent).toContain('Clear staged token');

    view.unmount();
  });

  it('keeps operator tokens session-only and never renders or persists them raw after apply', async () => {
    const view = renderSurface();
    clickButton(view.container, 'Access & Links');

    const input = view.container.querySelector('input[type="password"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      valueSetter?.call(input, 'super-secret-admin-proxy-token');
      input!.dispatchEvent(new Event('input', { bubbles: true }));
      input!.form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(view.container.textContent).not.toContain('super-secret-admin-proxy-token');
    expect(input?.value).toBe('');
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(getMissionControlAdminProxyAuthState()).toEqual({
      source: 'session',
      hasToken: true,
      mode: 'session-only',
    });
    expect(JSON.stringify(getMissionControlAdminProxyAuthState())).not.toContain('super-secret-admin-proxy-token');
    expect(view.container.textContent).toContain('Session token staged for this tab only');

    view.unmount();
  });

  it('surfaces required-token proxy failures without exposing token material', async () => {
    const adapter: KeyMcpAdminAdapter = {
      async listKeys() {
        throw new Error('Unauthorized');
      },
      async listMcpEntries() {
        return [];
      },
      async executeAction() {
        throw new Error('Unauthorized');
      },
    };
    setKeyMcpAdminAdapter(adapter);

    const view = renderSurface();
    await act(async () => {
      await loadKeys();
    });

    expect(view.container.textContent).toContain('Systems proxy authorization required');
    expect(view.container.textContent).toContain('Stage the current operator token');
    expect(view.container.textContent).not.toContain('super-secret');
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);

    view.unmount();
  });

  it('blocks token entry when the proxy reports secure transport is required', async () => {
    const adapter: KeyMcpAdminAdapter = {
      async listKeys() {
        throw new Error('Sensitive Mission Control routes are unavailable on this plain HTTP listener.');
      },
      async listMcpEntries() {
        return [];
      },
      async executeAction() {
        throw new Error('Sensitive Mission Control routes are unavailable on this plain HTTP listener.');
      },
    };
    setKeyMcpAdminAdapter(adapter);

    const view = renderSurface();
    await act(async () => {
      await loadKeys();
    });

    expect(view.container.textContent).toContain('Secure transport required');
    expect(view.container.textContent).toContain('https://192.168.10.5:3443');
    expect(view.container.querySelector('input[type="password"]')).toBeNull();
    expect(view.container.textContent).not.toContain('Stage token');

    view.unmount();
  });
});
