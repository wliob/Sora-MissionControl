/** @vitest-environment jsdom */
import { act, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { OfficeModule } from '@/office/components/OfficeModule';
import { boardStore } from '@/state/boardStore';
import { shellStore } from '@/state/shellStore';

vi.mock('@/office/components/OfficeCanvas', () => ({
  OfficeCanvas: ({ onSelectAgent }: { onSelectAgent?: (id: string | null) => void }) => (
    <button data-office-select-biscuit onClick={() => onSelectAgent?.('biscuit')}>
      select biscuit
    </button>
  ),
}));

vi.mock('@/office/components/OfficeErrorBoundary', () => ({
  OfficeErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/office/components/RoomTabs', () => ({
  RoomTabs: () => <div>room-tabs</div>,
}));

vi.mock('@/office/components/StatusBar', () => ({
  StatusBar: () => <div>status-bar</div>,
}));

const officeState = {
  agents: new Map([
    [
      'biscuit',
      {
        agentId: 'biscuit',
        name: 'Biscuit',
        activity: 'working',
        zone: 'workstations',
        task: {
          id: 't_office_work',
          title: 'Carry cross-link context into office',
          status: 'running',
        },
      },
    ],
  ]),
  initAgents: vi.fn(),
  applySnapshot: vi.fn(),
  applyEvent: vi.fn(),
  destroy: vi.fn(),
  setDemoMode: vi.fn(),
};

vi.mock('@/office/store', () => {
  const useOfficeStore = () => officeState;
  Object.assign(useOfficeStore, {
    getState: () => officeState,
  });
  return { useOfficeStore };
});

vi.mock('@/state/backbone', () => ({
  getBrowserBackbone: () => null,
}));

type TestTask = {
  id: string;
  title: string;
  body: string;
  assignee?: string;
  status: string;
  priority: number;
};

function seedBoard(tasks: TestTask[]) {
  boardStore.applyBoardRaw({
    columns: tasks.map((task) => ({
      name: task.status,
      tasks: [task],
    })),
    assignees: tasks
      .map((task) => task.assignee)
      .filter((assignee): assignee is string => typeof assignee === 'string'),
    tenants: [],
    latest_event_id: 41,
    now: 1718971560,
  });
}

function renderModule() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<OfficeModule />);
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
  shellStore.setView('office');
  shellStore.setSelectedAgent(null);
  shellStore.setSelectedOwner(null);
  window.history.replaceState({}, '', '/office');
  seedBoard([
    {
      id: 't_office_work',
      title: 'Carry cross-link context into office',
      body: 'Office should jump to current work.',
      assignee: 'biscuit',
      status: 'running',
      priority: 3,
    },
  ]);
});

describe('OfficeModule current-work cross-link', () => {
  it('opens Project Control for the selected agent current work', async () => {
    const view = renderModule();
    const selectButton = view.container.querySelector('[data-office-select-biscuit]') as HTMLButtonElement | null;

    await act(async () => {
      selectButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    const currentWorkButton = view.container.querySelector('[data-office-current-work-button]') as HTMLButtonElement | null;
    expect(currentWorkButton?.disabled).toBe(false);

    await act(async () => {
      currentWorkButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(window.location.pathname).toBe('/kanban');
    expect(shellStore.state.view).toBe('kanban');
    expect(shellStore.state.selectedAgent).toBe('biscuit');
    expect(shellStore.state.selectedOwner).toBe('biscuit');
    view.unmount();
  });

  it('shows an honest attention focus only when a canonical agent has mapped current work', async () => {
    const view = renderModule();

    await act(async () => {
      await Promise.resolve();
    });

    const focus = view.container.querySelector('[data-office-attention-focus]');
    expect(focus?.textContent).toContain('biscuit');
    expect(focus?.textContent).toContain('Carry cross-link context into office');

    view.unmount();
  });
});
