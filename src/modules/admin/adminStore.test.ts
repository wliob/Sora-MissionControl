/**
 * adminStore determinism and safety tests.
 *
 * Covers the acceptance criteria from the task body:
 *   - Secrets are hidden everywhere: apiKeyMasked is always masked, never raw.
 *   - Destructive/risky actions (delete, disable, setDefault, resetCredential)
 *     require explicit confirmation before executing.
 *   - Non-destructive actions (enable, editConfig) execute immediately.
 *   - Confirmations can be confirmed (executes) or cancelled (no-op).
 *   - The redaction guard rejects ingest of unmasked secrets (defense-in-depth).
 *   - Action results are recorded for audit.
 *
 * Uses a fake adapter so the store logic is exercised without Cloud's real
 * backend. The fake is in-process and synchronous-by-default so the tests
 * are deterministic without timers.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminActionRequest, ModelEntry } from '@/types/admin';
import { maskSecret } from '@/types/admin';
import {
  adminStore,
  setAdminAdapter,
  hasAdapter,
  loadModels,
  ingestModels,
  selectModel,
  requestAction,
  confirmAction,
  cancelAction,
  dismissConfirmation,
  getModels,
  getSelectedModel,
  getPendingConfirmations,
  getLastResults,
  _resetForTest,
  _getResultStatus,
} from './adminStore';
import type { AdminAdapter } from './adminStore';

/* ── fake adapter ──────────────────────────────────────────────────────── */

interface FakeAdapterOptions {
  /** If set, listModels rejects with this Error. */
  listError?: Error;
  /** If set, executeAction rejects with this Error. */
  executeError?: Error;
  /** The models to return from listModels. */
  models?: ModelEntry[];
  /** Recorded executed actions. */
  executed?: AdminActionRequest[];
}

function makeFakeAdapter(opts: FakeAdapterOptions = {}): AdminAdapter & {
  executed: AdminActionRequest[];
} {
  const executed: AdminActionRequest[] = [];
  const models: ModelEntry[] = opts.models ?? [makeModel('anthropic/claude-sonnet-4')];
  return {
    executed,
    async listModels(): Promise<ModelEntry[]> {
      if (opts.listError) throw opts.listError;
      return models;
    },
    async executeAction(request: AdminActionRequest): Promise<void> {
      executed.push(request);
      if (opts.executeError) throw opts.executeError;
    },
  };
}

/* ── helpers ───────────────────────────────────────────────────────────── */

function makeModel(
  id: string,
  overrides: Partial<ModelEntry> = {},
): ModelEntry {
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

/* ── reset between tests ────────────────────────────────────────────────── */

beforeEach(() => {
  _resetForTest();
});

/* ── tests ──────────────────────────────────────────────────────────────── */

describe('adminStore — secret redaction invariants', () => {
  it('maskSecret masks long keys to head+bullets+tail', () => {
    const masked = maskSecret('sk-ant-api03-deadbeef1234567890abcdef');
    expect(masked).not.toContain('deadbeef');
    expect(masked).not.toContain('1234567890abcdef');
    expect(masked).toContain('•');
    // Head is preserved for identification, tail for verification
    expect(masked!.startsWith('sk-a')).toBe(true);
    expect(masked!.length).toBeLessThan('sk-ant-api03-deadbeef1234567890abcdef'.length);
  });

  it('maskSecret handles short and edge cases', () => {
    expect(maskSecret(null)).toBe(null);
    expect(maskSecret('')).toBe('');
    expect(maskSecret('x')).toBe('x••••');
    expect(maskSecret('short')).toBe('sh••••');
  });

  it('ingestModels accepts masked entries and stores them', () => {
    const models = [
      makeModel('anthropic/claude-sonnet-4', { status: 'active', isDefault: true }),
      makeModel('openai/gpt-4o'),
    ];
    ingestModels(models);
    expect(getModels()).toHaveLength(2);
    expect(adminStore.state.lastError).toBeNull();
  });

  it('ingestModels REJECTS entries with unmasked apiKeyMasked (defense-in-depth)', () => {
    const leaked = makeModel('anthropic/claude', {
      apiKeyMasked: 'sk-ant-api03-real-secret-value-here-leaked',
    });
    ingestModels([leaked]);
    // The list must NOT be ingested — it stays null or previous.
    expect(getModels()).toBeNull();
    expect(adminStore.state.lastError).toContain('unmasked');
  });

  it('ingestModels rejects the WHOLE list if any entry is unmasked', () => {
    const good = makeModel('openai/gpt-4o');
    const bad = makeModel('anthropic/claude', {
      apiKeyMasked: 'sk-ant-api03-very-real-leaked-secret-here',
    });
    ingestModels([good, bad]);
    // Must not partially ingest — all or nothing.
    expect(getModels()).toBeNull();
    expect(adminStore.state.lastError).toContain('unmasked');
  });

  it('loadModels ingests masked models from adapter', async () => {
    const adapter = makeFakeAdapter({
      models: [
        makeModel('anthropic/claude-sonnet-4', { status: 'active', isDefault: true }),
        makeModel('openai/gpt-4o', { isFallback: true }),
      ],
    });
    setAdminAdapter(adapter);
    await loadModels();
    expect(getModels()).toHaveLength(2);
    expect(adminStore.state.lastError).toBeNull();
  });

  it('loadModels sets lastError when adapter throws', async () => {
    const adapter = makeFakeAdapter({ listError: new Error('backend down') });
    setAdminAdapter(adapter);
    await loadModels();
    expect(getModels()).toBeNull();
    expect(adminStore.state.lastError).toBe('backend down');
  });

  it('loadModels sets lastError when no adapter bound', async () => {
    expect(hasAdapter()).toBe(false);
    await loadModels();
    expect(adminStore.state.lastError).toBe('No admin adapter bound');
  });

  it('masked secrets never contain the original raw value', () => {
    const raw = 'sk-ant-api03-supersecretpassword123456';
    const masked = maskSecret(raw)!;
    // The masked version must not contain the sensitive middle portion
    expect(masked).not.toContain('supersecretpassword123456');
  });
});

describe('adminStore — destructive actions require confirmation', () => {
  beforeEach(async () => {
    const adapter = makeFakeAdapter({
      models: [
        makeModel('anthropic/claude-sonnet-4', {
          status: 'active',
          isDefault: true,
          label: 'Claude Sonnet 4',
        }),
        makeModel('openai/gpt-4o', { label: 'GPT-4o' }),
      ],
    });
    setAdminAdapter(adapter);
    await loadModels();
  });

  it('model.disable creates a pending confirmation, does NOT execute immediately', () => {
    requestAction('anthropic/claude-sonnet-4', 'model.disable', { kind: 'disable' });
    const pending = getPendingConfirmations();
    expect(pending).toHaveLength(1);
    expect(pending[0].action.type).toBe('model.disable');
    expect(pending[0].message).toContain('Disable');
    expect(pending[0].message).toContain('Claude Sonnet 4');
    // Adapter must not have been called yet
    expect(adminStore.state.lastResults).toHaveLength(0);
  });

  it('model.delete creates a pending confirmation', () => {
    requestAction('openai/gpt-4o', 'model.delete', { kind: 'delete' });
    const pending = getPendingConfirmations();
    expect(pending).toHaveLength(1);
    expect(pending[0].action.type).toBe('model.delete');
    expect(pending[0].message).toContain('Delete');
    expect(pending[0].message).toContain('GPT-4o');
    expect(pending[0].message).toContain('cannot be undone');
  });

  it('model.setDefault creates a pending confirmation with routing warning', () => {
    requestAction('openai/gpt-4o', 'model.setDefault', { kind: 'setDefault' });
    const pending = getPendingConfirmations();
    expect(pending).toHaveLength(1);
    expect(pending[0].message).toContain('default');
    expect(pending[0].message).toContain('routing');
  });

  it('model.resetCredential creates a pending confirmation with credential warning', () => {
    requestAction('anthropic/claude-sonnet-4', 'model.resetCredential', {
      kind: 'resetCredential',
    });
    const pending = getPendingConfirmations();
    expect(pending).toHaveLength(1);
    expect(pending[0].message).toContain('credential');
    expect(pending[0].message).toContain('invalidated');
  });

  it('confirmAction executes the action and removes the pending confirmation', async () => {
    requestAction('openai/gpt-4o', 'model.delete', { kind: 'delete' });
    const id = getPendingConfirmations()[0].id;
    await confirmAction(id);
    expect(getPendingConfirmations()).toHaveLength(0);
    expect(getLastResults()).toHaveLength(1);
    expect(getLastResults()[0].status).toBe('success');
    expect(getLastResults()[0].actionType).toBe('model.delete');
  });

  it('cancelAction removes the pending confirmation without executing', () => {
    requestAction('openai/gpt-4o', 'model.delete', { kind: 'delete' });
    const id = getPendingConfirmations()[0].id;
    cancelAction(id);
    expect(getPendingConfirmations()).toHaveLength(0);
    expect(getLastResults()).toHaveLength(1);
    expect(getLastResults()[0].status).toBe('cancelled');
  });

  it('confirmAction records a failed result when adapter throws', async () => {
    const adapter = makeFakeAdapter({
      models: [makeModel('anthropic/claude')],
      executeError: new Error('backend refused'),
    });
    setAdminAdapter(adapter);
    await loadModels();
    requestAction('anthropic/claude', 'model.delete', { kind: 'delete' });
    const id = getPendingConfirmations()[0].id;
    await confirmAction(id);
    expect(getLastResults()).toHaveLength(1);
    expect(getLastResults()[0].status).toBe('failed');
    expect(getLastResults()[0].error).toBe('backend refused');
    expect(adminStore.state.lastError).toBe('backend refused');
  });

  it('confirmAction throws on unknown confirmation id', async () => {
    await expect(confirmAction('confirm_999')).rejects.toThrow('unknown confirmation');
  });

  it('multiple destructive actions create multiple pending confirmations', () => {
    requestAction('anthropic/claude-sonnet-4', 'model.disable', { kind: 'disable' });
    requestAction('openai/gpt-4o', 'model.delete', { kind: 'delete' });
    requestAction('anthropic/claude-sonnet-4', 'model.resetCredential', {
      kind: 'resetCredential',
    });
    expect(getPendingConfirmations()).toHaveLength(3);
  });

  it('dismissConfirmation removes a pending confirmation without recording a result', () => {
    requestAction('openai/gpt-4o', 'model.delete', { kind: 'delete' });
    const id = getPendingConfirmations()[0].id;
    dismissConfirmation(id);
    expect(getPendingConfirmations()).toHaveLength(0);
    // Unlike cancelAction, dismissConfirmation does not record a result.
    expect(getLastResults()).toHaveLength(0);
  });
});

describe('adminStore — non-destructive actions execute immediately', () => {
  beforeEach(async () => {
    const adapter = makeFakeAdapter({
      models: [
        makeModel('anthropic/claude-sonnet-4', { status: 'disabled' }),
        makeModel('openai/gpt-4o', { label: 'GPT-4o' }),
      ],
    });
    setAdminAdapter(adapter);
    await loadModels();
  });

  it('model.enable executes immediately without creating a confirmation', () => {
    requestAction('anthropic/claude-sonnet-4', 'model.enable', { kind: 'enable' });
    expect(getPendingConfirmations()).toHaveLength(0);
    // The action result is recorded asynchronously — poll or check.
    // Since executeAction is async void, we wait a microtask.
  });

  it('model.enable executes and records a success result', async () => {
    const adapter = adminStore as unknown as { _noop?: never };
    void adapter; // satisfy noUnusedLocals
    requestAction('anthropic/claude-sonnet-4', 'model.enable', { kind: 'enable' });
    // Wait for the async void executeAction to settle.
    await vi.waitFor(() => {
      expect(getLastResults()).toHaveLength(1);
    });
    expect(getLastResults()[0].status).toBe('success');
    expect(getLastResults()[0].actionType).toBe('model.enable');
  });

  it('model.editConfig executes immediately without confirmation', async () => {
    requestAction('openai/gpt-4o', 'model.editConfig', {
      kind: 'editConfig',
      label: 'GPT-4o Turbo',
      contextWindow: 128000,
    });
    await vi.waitFor(() => {
      expect(getLastResults()).toHaveLength(1);
    });
    expect(getPendingConfirmations()).toHaveLength(0);
    expect(getLastResults()[0].status).toBe('success');
  });
});

describe('adminStore — selection', () => {
  beforeEach(async () => {
    setAdminAdapter(
      makeFakeAdapter({
        models: [
          makeModel('anthropic/claude-sonnet-4'),
          makeModel('openai/gpt-4o'),
        ],
      }),
    );
    await loadModels();
  });

  it('selectModel sets the selected model id', () => {
    selectModel('openai/gpt-4o');
    expect(adminStore.state.selectedModelId).toBe('openai/gpt-4o');
    const selected = getSelectedModel();
    expect(selected).not.toBeNull();
    expect(selected!.id).toBe('openai/gpt-4o');
  });

  it('selectModel(null) clears selection', () => {
    selectModel('anthropic/claude-sonnet-4');
    selectModel(null);
    expect(adminStore.state.selectedModelId).toBeNull();
    expect(getSelectedModel()).toBeNull();
  });

  it('getSelectedModel returns null for unknown id', () => {
    selectModel('nonexistent/model');
    expect(getSelectedModel()).toBeNull();
  });
});

describe('adminStore — action result log is bounded', () => {
  beforeEach(async () => {
    setAdminAdapter(
      makeFakeAdapter({ models: [makeModel('anthropic/claude')] }),
    );
    await loadModels();
  });

  it('keeps at most 50 results, dropping oldest', async () => {
    // Fire 55 cancel actions (each records a result without needing adapter).
    for (let i = 0; i < 55; i++) {
      requestAction('anthropic/claude', 'model.delete', { kind: 'delete' });
      const id = getPendingConfirmations()[0].id;
      cancelAction(id);
    }
    expect(getLastResults().length).toBe(50);
    // The first 5 should have been dropped; the log keeps the most recent 50.
  });
});

describe('adminStore — adapter binding', () => {
  it('hasAdapter returns false before binding', () => {
    expect(hasAdapter()).toBe(false);
  });

  it('hasAdapter returns true after binding', () => {
    setAdminAdapter(makeFakeAdapter());
    expect(hasAdapter()).toBe(true);
  });

  it('hasAdapter returns false after binding null', () => {
    setAdminAdapter(makeFakeAdapter());
    setAdminAdapter(null);
    expect(hasAdapter()).toBe(false);
  });
});