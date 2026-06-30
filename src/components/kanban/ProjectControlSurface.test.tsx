/** @vitest-environment jsdom */
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { ProjectControlSurface } from '@/components/kanban/ProjectControlSurface';
import { boardStore } from '@/state/boardStore';
import { shellStore } from '@/state/shellStore';
import { _resetForTest as resetProjectControlStore } from '@/state/projectControlStore';
import {
  _resetForTest as resetSessionConnectionStore,
  updateSourceHealth,
} from '@/state/sessionConnectionStore';

function installConnectedSources() {
  const now = '2026-06-21T12:06:00Z';
  updateSourceHealth('kanban-rest', { state: 'connected', lastOkAt: now, lastCheckedAt: now });
  updateSourceHealth('kanban-ws', { state: 'connected', lastOkAt: now, lastCheckedAt: now });
}

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

function renderSurface() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<ProjectControlSurface />);
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
  shellStore.setSelectedOwner(null);
  installConnectedSources();
});

describe('ProjectControlSurface cross-links', () => {
  it('replaces unknown board KPI chrome with a board-level unavailable state until a verified snapshot arrives', () => {
    resetSessionConnectionStore();

    const view = renderSurface();

    expect(view.container.textContent).toContain('Project Control unavailable');
    expect(view.container.textContent).toContain('Awaiting verified Kanban board data');
    expect(view.container.textContent).toContain('Sources');
    expect(view.container.textContent).not.toContain('Total tasks');
    expect(view.container.textContent).not.toContain('Status lanes');

    view.unmount();
  });

  it('selecting a canonical owner drives shared selection and exposes office/chat actions', async () => {
    seedBoard([
      {
        id: 't_crosslink_1',
        title: 'Wire selected-agent current work links',
        body: 'Connect Project Control to shell selection state.',
        assignee: 'biscuit',
        status: 'running',
        priority: 5,
      },
    ]);

    const view = renderSurface();
    const ownerButton = view.container.querySelector('[data-project-control-owner="biscuit"]') as HTMLButtonElement | null;
    expect(ownerButton).not.toBeNull();

    await act(async () => {
      ownerButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(shellStore.state.selectedAgent).toBe('biscuit');
    expect(shellStore.state.selectedOwner).toBe('biscuit');

    const officeButton = view.container.querySelector('[data-project-control-nav="office"]') as HTMLButtonElement | null;
    const chatButton = view.container.querySelector('[data-project-control-nav="chat"]') as HTMLButtonElement | null;
    const ownerFilterButton = view.container.querySelector('[data-project-control-nav="owner-filter"]') as HTMLButtonElement | null;

    expect(officeButton?.disabled).toBe(false);
    expect(chatButton?.textContent?.toLowerCase()).toContain('chat');
    expect(ownerFilterButton?.textContent?.toLowerCase()).toContain('owner');

    await act(async () => {
      officeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(shellStore.state.view).toBe('office');
    view.unmount();
  });

  it('keeps unknown owners visible but disables unmapped office/chat routes honestly', async () => {
    seedBoard([
      {
        id: 't_crosslink_custom',
        title: 'Wait for external vendor handoff',
        body: 'Custom owner should not pretend to map into office/chat.',
        assignee: 'vendor-bot',
        status: 'blocked',
        priority: 2,
      },
    ]);

    const view = renderSurface();
    const blockerButton = view.container.querySelector('[data-project-control-task="t_crosslink_custom"]') as HTMLButtonElement | null;
    expect(blockerButton).not.toBeNull();

    await act(async () => {
      blockerButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(shellStore.state.selectedAgent).toBeNull();
    expect(shellStore.state.selectedOwner).toBe('vendor-bot');

    const officeButton = view.container.querySelector('[data-project-control-nav="office"]') as HTMLButtonElement | null;
    const chatButton = view.container.querySelector('[data-project-control-nav="chat"]') as HTMLButtonElement | null;

    expect(officeButton?.disabled).toBe(true);
    expect(chatButton?.disabled).toBe(true);
    expect(view.container.textContent).toContain('No office avatar mapping');
    expect(view.container.textContent).toContain('Chat surface only supports Mission Control department leads');

    view.unmount();
  });
});
