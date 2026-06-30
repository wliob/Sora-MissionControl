/** @vitest-environment jsdom */
import { act } from 'react';
import type { ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KeysPanel } from '@/components/admin/KeysPanel';
import { McpPanel } from '@/components/admin/McpPanel';
import {
  _ingestKeys,
  _ingestMcpEntries,
  _resetForTest,
  adminKeyMcpStore,
  setKeyMcpAdminAdapter,
  type KeyMcpAdminAdapter,
} from '@/state/adminKeyMcpStore';
import type { ApiKey, KeyMcpAction, KeyMcpActionResult, McpEntry } from '@/types/admin-keymcp';

function makeKey(overrides: Partial<ApiKey> = {}): ApiKey {
  return {
    id: 'key_test_1',
    label: 'Claude prod key',
    provider: 'anthropic',
    maskedSecret: 'sk-ant••••9b3c',
    active: true,
    createdAt: '2026-06-20T00:00:00Z',
    lastRotatedAt: null,
    revokedAt: null,
    ...overrides,
  };
}

function makeMcp(overrides: Partial<McpEntry> = {}): McpEntry {
  return {
    id: 'mcp_context7',
    name: 'context7',
    url: 'http://localhost:8000/mcp',
    transport: 'http',
    enabled: true,
    maskedToken: 'tok-••••ab12',
    lastTest: null,
    createdAt: '2026-06-20T00:00:00Z',
    ...overrides,
  };
}

function makeAdapter(): KeyMcpAdminAdapter & { executed: KeyMcpAction[] } {
  const executed: KeyMcpAction[] = [];
  return {
    executed,
    listKeys: vi.fn().mockResolvedValue([]),
    listMcpEntries: vi.fn().mockResolvedValue([]),
    executeAction: vi.fn().mockImplementation(async (action: KeyMcpAction): Promise<KeyMcpActionResult> => {
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

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  _resetForTest();
  document.body.innerHTML = '';
});

describe('Key/MCP panels RiskConfirmDialog migration', () => {
  it('keeps adapter-unavailable KeysPanel state non-interactive', () => {
    const view = render(<KeysPanel />);

    expect(view.container.textContent).toContain('No adapter bound');
    expect(view.container.textContent).toContain('key management unavailable');
    expect(view.container.textContent).not.toContain('+ New Key');
    expect(view.container.textContent).not.toContain('risk');
    expect(view.container.textContent).not.toContain('danger');

    view.unmount();
  });

  it('renders danger-tier key deletion through RiskConfirmDialog with a typed phrase gate', async () => {
    const adapter = makeAdapter();
    setKeyMcpAdminAdapter(adapter);
    _ingestKeys([makeKey()]);

    const view = render(<KeysPanel />);
    clickButton(view.container, 'Delete');

    expect(view.container.textContent).toContain('Delete API Key');
    expect(view.container.textContent).toContain('danger');
    expect(view.container.textContent).toContain('Claude prod key');
    expect(view.container.textContent).not.toContain('sk-ant-api03-real-secret-value');

    const input = view.container.querySelector('input[placeholder="Claude prod key"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();

    const confirm = lastButton(view.container, 'Delete');
    expect(confirm?.disabled).toBe(true);

    await typeInto(input!, 'wrong phrase');
    expect(confirm?.disabled).toBe(true);
    expect(adapter.executed).toHaveLength(0);

    await typeInto(input!, 'Claude prod key');
    expect(confirm?.disabled).toBe(false);

    view.unmount();
  });

  it('renders risk-tier key regeneration without a typed phrase', () => {
    setKeyMcpAdminAdapter(makeAdapter());
    _ingestKeys([makeKey()]);

    const view = render(<KeysPanel />);
    clickButton(view.container, 'Regenerate');

    expect(view.container.textContent).toContain('Regenerate API Key');
    expect(view.container.textContent).toContain('risk');
    expect(view.container.textContent).toContain('Claude prod key');
    expect(view.container.querySelector('input[placeholder="Claude prod key"]')).toBeNull();

    view.unmount();
  });

  it('renders danger-tier MCP removal through RiskConfirmDialog with a typed phrase gate', async () => {
    const adapter = makeAdapter();
    setKeyMcpAdminAdapter(adapter);
    _ingestMcpEntries([makeMcp()]);

    const view = render(<McpPanel />);
    clickButton(view.container, 'Remove');

    expect(view.container.textContent).toContain('Remove MCP Server');
    expect(view.container.textContent).toContain('danger');
    expect(view.container.textContent).toContain('context7');
    expect(view.container.textContent).not.toContain('raw-token-secret');

    const input = view.container.querySelector('input[placeholder="context7"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    const confirm = lastButton(view.container, 'Remove');
    expect(confirm?.disabled).toBe(true);

    await typeInto(input!, 'context7');
    expect(confirm?.disabled).toBe(false);
    expect(adapter.executed).toHaveLength(0);

    view.unmount();
  });

  it('keeps one-time key secrets in lastResult only while rendering the reveal', async () => {
    const rawSecret = 'sk-ant-api03-real-secret-value';
    setKeyMcpAdminAdapter({
      listKeys: vi.fn().mockResolvedValue([]),
      listMcpEntries: vi.fn().mockResolvedValue([]),
      executeAction: vi.fn().mockResolvedValue({
        action: { kind: 'key.create', label: 'One-time key', provider: 'anthropic' },
        ok: true,
        message: 'created',
        createdKey: {
          ...makeKey({ id: 'key_created', label: 'One-time key', maskedSecret: 'sk-ant••••alue' }),
          secret: rawSecret,
        },
        completedAt: new Date().toISOString(),
      } satisfies KeyMcpActionResult),
    });
    await act(async () => {
      await adminKeyMcpStore.executeAction({
        kind: 'key.create',
        label: 'One-time key',
        provider: 'anthropic',
      });
    });

    const view = render(<KeysPanel />);

    expect(view.container.textContent).toContain(rawSecret);
    expect(JSON.stringify({ keys: adminKeyMcpStore.state.keys, mcpEntries: adminKeyMcpStore.state.mcpEntries })).not.toContain(rawSecret);

    view.unmount();
  });
});
