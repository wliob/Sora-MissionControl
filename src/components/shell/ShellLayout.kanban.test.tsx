/** @vitest-environment jsdom */
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { ShellLayout } from './ShellLayout';
import { shellStore } from '@/state/shellStore';
import { boardStore } from '@/state/boardStore';
import { _resetForTest as resetProjectControlStore } from '@/state/projectControlStore';
import { _resetForTest as resetSessionConnectionStore } from '@/state/sessionConnectionStore';

vi.mock('@/components/shell/OfficePanel', () => ({
  OfficePanel: () => <div>office-panel</div>,
}));

vi.mock('@/components/shell/ChatPanel', () => ({
  ChatPanel: () => <div>chat-panel</div>,
}));

vi.mock('@/components/shell/OpsPanel', () => ({
  OpsPanel: () => <div>ops-panel</div>,
}));

vi.mock('@/components/admin/UnifiedAdminSurface', () => ({
  UnifiedAdminSurface: () => <div>admin-surface</div>,
}));

vi.mock('@/components/shell/FloatingChatOverlay', () => ({
  FloatingChatOverlay: () => null,
}));

function installMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: query.includes('1200px') ? window.innerWidth >= 1200 : window.innerWidth >= 768,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderShell() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<ShellLayout />);
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
  resetProjectControlStore();
  resetSessionConnectionStore();
  shellStore.setView('kanban');
  shellStore.setSelectedAgent(null);
  installMatchMedia();
});

describe('ShellLayout kanban route', () => {
  it('renders Project Control instead of the reserved EmptyView copy', () => {
    window.innerWidth = 1366;
    const view = renderShell();

    expect(view.container.textContent).toContain('Project Control');
    expect(view.container.textContent).not.toContain('control surface is reserved for a wider tactical frame');
    expect(view.container.textContent).toContain('Selected task');

    view.unmount();
  });

  it('renders the kanban surface on narrow/mobile widths without crashing', () => {
    window.innerWidth = 375;
    const view = renderShell();

    expect(view.container.textContent).toContain('Project Control');
    expect(view.container.textContent).toContain('Selected task');
    expect(view.container.textContent).toContain('Kanban snapshot');

    view.unmount();
  });
});
