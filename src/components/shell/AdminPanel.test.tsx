/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { AdminPanel } from '@/components/shell/AdminPanel';
import type { AdminActionRequest, ModelEntry } from '@/types/admin';
import { maskSecret } from '@/types/admin';
import {
  _resetForTest,
  adminStore,
  ingestModels,
  selectModel,
  setAdminAdapter,
  type AdminAdapter,
} from '@/modules/admin/adminStore';

function makeModel(id: string, overrides: Partial<ModelEntry> = {}): ModelEntry {
  return {
    id,
    provider: id.split('/')[0] ?? 'unknown',
    model: id.split('/')[1] ?? id,
    label: null,
    status: 'available',
    isDefault: false,
    isFallback: false,
    credentialPresence: 'configured',
    apiKeyMasked: maskSecret('sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxx'),
    contextWindow: null,
    maxOutput: null,
    lastCheckedAt: null,
    error: null,
    ...overrides,
  };
}

function makeAdapter(models: ModelEntry[]): AdminAdapter & { executed: AdminActionRequest[] } {
  const executed: AdminActionRequest[] = [];
  return {
    executed,
    async listModels() {
      return models;
    },
    async executeAction(request) {
      executed.push(request);
    },
  };
}

function renderPanel() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<AdminPanel />);
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
  _resetForTest();
  document.body.innerHTML = '';
});

describe('AdminPanel model confirmations', () => {
  it('renders danger-tier delete through RiskConfirmDialog with a typed phrase gate', async () => {
    const models = [
      makeModel('openai/gpt-4o', {
        label: 'GPT-4o',
        provider: 'openai',
        model: 'gpt-4o',
      }),
    ];
    const adapter = makeAdapter(models);
    setAdminAdapter(adapter);
    ingestModels(models);
    selectModel('openai/gpt-4o');

    const view = renderPanel();
    clickButton(view.container, 'Delete');

    expect(view.container.textContent).toContain('Delete Model');
    expect(view.container.textContent).toContain('danger');
    expect(view.container.textContent).toContain('Provider: openai');
    expect(view.container.textContent).toContain('Model: gpt-4o');
    expect(view.container.textContent).toContain('Cost class: unknown');
    expect(view.container.textContent).toContain('Quota/rate-limit: unknown');
    expect(view.container.textContent).toContain('Rollback: recreate the model entry');

    const input = view.container.querySelector('input[placeholder="openai/gpt-4o"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();

    const confirm = Array.from(view.container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Confirm'),
    ) as HTMLButtonElement | undefined;
    expect(confirm?.disabled).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(adapter.executed).toHaveLength(0);
    expect(adminStore.getPendingConfirmations()).toHaveLength(1);

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      valueSetter?.call(input, 'openai/gpt-4o');
      input!.dispatchEvent(new Event('input', { bubbles: true }));
      await Promise.resolve();
    });
    const enabledConfirm = Array.from(view.container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Confirm'),
    ) as HTMLButtonElement | undefined;
    expect(enabledConfirm?.disabled).toBe(false);

    view.unmount();
  });

  it('renders risk-tier routing changes without a typed phrase and with honest unknowns', () => {
    const models = [
      makeModel('anthropic/claude-sonnet-4', {
        label: 'Claude Sonnet 4',
        provider: 'anthropic',
        model: 'claude-sonnet-4',
      }),
    ];
    setAdminAdapter(makeAdapter(models));
    ingestModels(models);
    selectModel('anthropic/claude-sonnet-4');

    const view = renderPanel();
    clickButton(view.container, 'Set Default');

    expect(view.container.textContent).toContain('Change Default Model');
    expect(view.container.textContent).toContain('risk');
    expect(view.container.textContent).toContain('Affected routing: profiles without an explicit model override may route to this model');
    expect(view.container.textContent).toContain('Provenance: source admin-cli, freshness live, confidence verified');
    expect(view.container.textContent).toContain('Cost class: unknown');
    expect(view.container.textContent).toContain('Quota/rate-limit: unknown');
    expect(view.container.textContent).toContain('Rollback: set the previous default model again');
    expect(view.container.textContent).not.toContain('Type anthropic/claude-sonnet-4 to confirm');

    view.unmount();
  });
});
