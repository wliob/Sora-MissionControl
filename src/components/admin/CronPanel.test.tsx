/** @vitest-environment jsdom */
import { act } from 'react';
import type { ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CronPanel } from '@/components/admin/CronPanel';
import {
  _ingestCronJobs,
  _resetForTest,
  setCwsAdminAdapter,
  type CwsAdminAdapter,
} from '@/state/cwsAdminStore';
import type { CronJob, CwsAction, CwsActionResult } from '@/types/admin-cws';

function makeCronJob(overrides: Partial<CronJob> = {}): CronJob {
  return {
    id: 'cron-1',
    name: 'Daily backup',
    schedule: '0 9 * * *',
    enabled: true,
    paused: false,
    promptPreview: 'Run backup…',
    hasScript: false,
    skills: [],
    modelOverride: null,
    lastRunAt: null,
    nextRunAt: '2026-06-22T09:00:00Z',
    createdAt: '2026-06-01T00:00:00Z',
    error: null,
    ...overrides,
  };
}

function makeAdapter(): CwsAdminAdapter & { executed: CwsAction[] } {
  const executed: CwsAction[] = [];
  return {
    executed,
    listCronJobs: vi.fn().mockResolvedValue([]),
    listWebhooks: vi.fn().mockResolvedValue([]),
    listSkills: vi.fn().mockResolvedValue([]),
    executeAction: vi.fn().mockImplementation(async (action: CwsAction): Promise<CwsActionResult> => {
      executed.push(action);
      return {
        action,
        ok: true,
        message: 'ok',
        completedAt: new Date().toISOString(),
      };
    }),
  };
}

function render(element: ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
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

function clickButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find((candidate) =>
    candidate.textContent?.includes(label),
  ) as HTMLButtonElement | undefined;
  expect(button).toBeDefined();
  act(() => {
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  return button!;
}

function lastButton(container: HTMLElement, label: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button'))
    .filter((button) => button.textContent?.includes(label))
    .at(-1) as HTMLButtonElement | undefined;
}

async function typeInto(input: HTMLInputElement, value: string) {
  await act(async () => {
    const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    valueSetter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await Promise.resolve();
  });
}

function getInputByPlaceholder(container: HTMLElement, placeholder: string): HTMLInputElement {
  const input = container.querySelector(`input[placeholder="${placeholder}"]`) as HTMLInputElement | null;
  expect(input).not.toBeNull();
  return input!;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  _resetForTest();
  document.body.innerHTML = '';
});

describe('CronPanel operator-safety gating', () => {
  it('gates run-now behind a risk dialog before execution', async () => {
    const adapter = makeAdapter();
    setCwsAdminAdapter(adapter);
    _ingestCronJobs([makeCronJob()]);

    const view = render(<CronPanel />);
    clickButton(view.container, 'Run now');

    expect(view.container.textContent).toContain('Run Cron Job Now');
    expect(view.container.textContent).toContain('risk');
    expect(view.container.textContent).toContain('live scheduler');
    expect(view.container.textContent).toContain('quota');
    expect(view.container.querySelector('input[placeholder="Daily backup"]')).toBeNull();
    expect(adapter.executed).toHaveLength(0);

    const confirm = lastButton(view.container, 'Run now');
    expect(confirm).toBeDefined();
    await act(async () => {
      confirm?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await vi.waitFor(() => {
        expect(adapter.executed).toHaveLength(1);
      });
    });

    view.unmount();
  });

  it('gates cron creation behind a risk dialog with warning copy before execution', async () => {
    const adapter = makeAdapter();
    setCwsAdminAdapter(adapter);

    const view = render(<CronPanel />);
    clickButton(view.container, '+ New Job');

    await typeInto(getInputByPlaceholder(view.container, 'e.g. daily-summary'), 'nightly-report');
    await typeInto(getInputByPlaceholder(view.container, '0 9 * * * or 30m'), '30m');
    await typeInto(getInputByPlaceholder(view.container, 'What should the agent do?'), 'secret prompt text');

    clickButton(view.container, 'Create Job');

    expect(view.container.textContent).toContain('Create Cron Job');
    expect(view.container.textContent).toContain('risk');
    expect(view.container.textContent).toContain('nightly-report');
    expect(view.container.textContent).toContain('live scheduler');
    expect(view.container.textContent).toContain('cost');
    expect(view.container.textContent).toContain('pause or remove');
    expect(view.container.textContent).not.toContain('secret prompt text');
    expect(adapter.executed).toHaveLength(0);

    const confirm = lastButton(view.container, 'Create');
    expect(confirm).toBeDefined();
    await act(async () => {
      confirm?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await vi.waitFor(() => {
        expect(adapter.executed).toHaveLength(1);
      });
    });

    view.unmount();
  });
});
