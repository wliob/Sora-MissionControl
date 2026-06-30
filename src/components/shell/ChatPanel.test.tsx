/** @vitest-environment jsdom */
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { ChatPanel } from '@/components/shell/ChatPanel';
import { boardStore } from '@/state/boardStore';
import { shellStore } from '@/state/shellStore';
import { selectProfile, setProfiles, setTransport } from '@/modules/chat/chatStore';

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

function renderPanel() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<ChatPanel />);
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
  shellStore.setView('chat');
  shellStore.setSelectedAgent('biscuit');
  shellStore.setSelectedOwner(null);
  setTransport(null);
  setProfiles({
    cloud: { id: 'cloud', name: 'Cloud', role: 'Systems & Infra', accent: 'var(--agent-cloud)', activity: 'idle' },
    biscuit: { id: 'biscuit', name: 'Biscuit', role: 'Automation & Coding', accent: 'var(--agent-biscuit)', activity: 'working' },
    korra: { id: 'korra', name: 'Korra', role: 'Creative & Media', accent: 'var(--agent-korra)', activity: 'idle' },
    lelouch: { id: 'lelouch', name: 'Lelouch', role: 'Lifestyle & Logistics', accent: 'var(--agent-lelouch)', activity: 'idle' },
    tifa: { id: 'tifa', name: 'Tifa', role: 'Finance & Trading', accent: 'var(--agent-tifa)', activity: 'idle' },
    sora: { id: 'sora', name: 'Sora', role: 'Operations & Orchestration', accent: 'var(--agent-sora)', activity: 'idle' },
    rain: { id: 'rain', name: 'Rain', role: 'Communications & Intel', accent: 'var(--agent-rain)', activity: 'idle' },
  });
  selectProfile('biscuit');
});

describe('ChatPanel current-work cross-link', () => {
  it('opens Project Control filtered to the active profile when work is present', async () => {
    seedBoard([
      {
        id: 't_chat_work',
        title: 'Selected-agent cross-link follow-through',
        body: 'Chat should jump into current work.',
        assignee: 'biscuit',
        status: 'running',
        priority: 4,
      },
    ]);

    const view = renderPanel();
    const button = view.container.querySelector('[data-chat-current-work-button]') as HTMLButtonElement | null;
    expect(button?.disabled).toBe(false);

    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(shellStore.state.view).toBe('kanban');
    expect(shellStore.state.selectedOwner).toBe('biscuit');
    view.unmount();
  });

  it('keeps the action disabled with honest copy when no verified task is mapped', () => {
    const view = renderPanel();
    const button = view.container.querySelector('[data-chat-current-work-button]') as HTMLButtonElement | null;
    expect(button?.disabled).toBe(true);
    expect(view.container.textContent).toContain('Current work unavailable until a verified Kanban task is mapped');
    view.unmount();
  });
});
