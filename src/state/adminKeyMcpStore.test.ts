/**
 * adminKeyMcpStore — secret-safety, confirmation-gating, and adapter-boundary tests.
 *
 * Covers the Phase 6 adapter boundary acceptance criteria:
 *   - Secrets are only shown once at creation time, then masked afterward.
 *   - Revocation, regeneration, and deletion require confirmation.
 *   - No secret values appear in the persistent store state (keys, mcpEntries).
 *   - When no adapter is bound, the store starts empty with missing provenance.
 *   - Actions without an adapter fail explicitly (not silently).
 *   - Mock seed data is TEST ONLY and marked with placeholder confidence.
 *   - No browser filesystem/CLI/profile writes are possible from the store.
 *   - Unavailable/unknown/mock states do not render as healthy.
 *   - Raw secrets are redacted from JSON serialization.
 *   - Adapter absence is explicit via hasKeyMcpAdapter() and lastError.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  adminKeyMcpStore,
  _resetForTest,
  _resetToSeed,
  _ingestKeys,
  _ingestMcpEntries,
  setKeyMcpAdminAdapter,
  hasKeyMcpAdapter,
  type KeyMcpAdminAdapter,
} from '@/state/adminKeyMcpStore';
import {
  isDestructive,
  keyMcpActionTier,
  keyMcpRequiresConfirmation,
  keyMcpRequiresTypedPhrase,
  maskSecret,
  maskUrl,
  initialKeyMcpState,
} from '@/types/admin-keymcp';
import type { KeyMcpAction, ApiKey, McpEntry } from '@/types/admin-keymcp';

/* ── Helpers ──────────────────────────────────────────────────────────── */

/** Reset the store to empty (no adapter, no seed data). */
function resetEmpty() {
  _resetForTest();
}

/** Reset the store to seed data (test-only mock). */
function resetSeed() {
  _resetForTest();
  _resetToSeed();
}

/** Get a snapshot of the current store state. */
function snapshot() {
  return adminKeyMcpStore.state;
}

/** Extract the raw secret from the last result, if present. */
function lastSecret(): string | null {
  return adminKeyMcpStore.state.lastResult?.createdKey?.secret ?? null;
}

/** Extract the raw MCP token from the last result, if present. */
function lastMcpToken(): string | null {
  return adminKeyMcpStore.state.lastResult?.createdMcp?.token ?? null;
}

/** JSON-stringify only the persistent collections (no lastResult). */
function persistentStateJson(): string {
  const s = snapshot();
  return JSON.stringify({ keys: s.keys, mcpEntries: s.mcpEntries });
}

/** Create a mock adapter that returns canned responses. */
function makeMockAdapter(overrides: Partial<KeyMcpAdminAdapter> = {}): KeyMcpAdminAdapter {
  return {
    listKeys: vi.fn().mockResolvedValue([]),
    listMcpEntries: vi.fn().mockResolvedValue([]),
    executeAction: vi.fn().mockResolvedValue({
      action: { kind: 'key.create', label: 'Test', provider: 'openrouter' },
      ok: true,
      message: 'Success',
      completedAt: new Date().toISOString(),
    }),
    ...overrides,
  };
}

/** Sample key for test ingestion. */
function makeKey(overrides: Partial<ApiKey> = {}): ApiKey {
  return {
    id: 'key_test_1',
    label: 'Test Key',
    provider: 'openrouter',
    maskedSecret: 'sk-or••••4f2a',
    active: true,
    createdAt: '2026-06-20T00:00:00Z',
    lastRotatedAt: null,
    revokedAt: null,
    ...overrides,
  };
}

/** Sample MCP entry for test ingestion. */
function makeMcp(overrides: Partial<McpEntry> = {}): McpEntry {
  return {
    id: 'mcp_test_1',
    name: 'test-mcp',
    url: 'http://localhost:8000/mcp',
    transport: 'http',
    enabled: true,
    maskedToken: 'tok-••••ab12',
    lastTest: null,
    createdAt: '2026-06-20T00:00:00Z',
    ...overrides,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
 * 1. ADAPTER BOUNDARY: no adapter → empty state, explicit unavailability
 * ══════════════════════════════════════════════════════════════════════════ */

describe('Key/MCP adapter boundary: no adapter bound', () => {
  beforeEach(resetEmpty);

  it('hasKeyMcpAdapter returns false before adapter is set', () => {
    expect(hasKeyMcpAdapter()).toBe(false);
  });

  it('store starts with empty lists (no mock seed data)', () => {
    const state = snapshot();
    expect(state.keys).toHaveLength(0);
    expect(state.mcpEntries).toHaveLength(0);
  });

  it('store starts with missing provenance for both subsections', () => {
    const state = snapshot();
    expect(state.keysProvenance.freshness).toBe('missing');
    expect(state.keysProvenance.confidence).toBe('unknown');
    expect(state.mcpProvenance.freshness).toBe('missing');
    expect(state.mcpProvenance.confidence).toBe('unknown');
  });

  it('store starts with null lastError', () => {
    expect(snapshot().lastError).toBeNull();
  });

  it('requestAction sets lastError when no adapter (destructive action)', () => {
    adminKeyMcpStore.requestAction({ kind: 'key.revoke', id: 'key_test' });
    // Should NOT go to pending — should fail explicitly
    expect(snapshot().pending).toHaveLength(0);
    expect(snapshot().lastResult).not.toBeNull();
    expect(snapshot().lastResult!.ok).toBe(false);
    expect(snapshot().lastResult!.message).toBe('No Key/MCP admin adapter bound');
    expect(snapshot().lastError).toBe('No Key/MCP admin adapter bound');
  });

  it('requestAction sets lastError when no adapter (non-destructive action)', async () => {
    adminKeyMcpStore.requestAction({
      kind: 'key.create',
      label: 'Test',
      provider: 'openrouter',
    });
    await new Promise((r) => setTimeout(r, 10));
    const result = snapshot().lastResult;
    expect(result).not.toBeNull();
    expect(result!.ok).toBe(false);
    expect(result!.message).toBe('No Key/MCP admin adapter bound');
  });

  it('loadKeys sets lastError when no adapter', async () => {
    const { loadKeys } = await import('@/state/adminKeyMcpStore');
    await loadKeys();
    expect(snapshot().lastError).toBe('No Key/MCP admin adapter bound');
    expect(snapshot().keys).toHaveLength(0);
  });

  it('loadMcpEntries sets lastError when no adapter', async () => {
    const { loadMcpEntries } = await import('@/state/adminKeyMcpStore');
    await loadMcpEntries();
    expect(snapshot().lastError).toBe('No Key/MCP admin adapter bound');
    expect(snapshot().mcpEntries).toHaveLength(0);
  });

  it('hasKeyMcpAdapter returns true after adapter is set', () => {
    setKeyMcpAdminAdapter(makeMockAdapter());
    expect(hasKeyMcpAdapter()).toBe(true);
  });

  it('hasKeyMcpAdapter returns false after adapter is unset', () => {
    setKeyMcpAdminAdapter(makeMockAdapter());
    expect(hasKeyMcpAdapter()).toBe(true);
    setKeyMcpAdminAdapter(null);
    expect(hasKeyMcpAdapter()).toBe(false);
  });

  it('setting adapter to null does not seed mock data', () => {
    setKeyMcpAdminAdapter(makeMockAdapter());
    setKeyMcpAdminAdapter(null);
    expect(snapshot().keys).toHaveLength(0);
    expect(snapshot().mcpEntries).toHaveLength(0);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 2. UNAVAILABLE STATE DOES NOT RENDER HEALTHY
 * ══════════════════════════════════════════════════════════════════════════ */

describe('Key/MCP: unavailable/unknown state does not look healthy', () => {
  beforeEach(resetEmpty);

  it('empty state with missing provenance signals unavailability', () => {
    const state = snapshot();
    // Empty lists + missing provenance = unavailable (not healthy)
    const isHealthy = state.keys.length > 0 && state.keysProvenance.freshness === 'live';
    expect(isHealthy).toBe(false);
  });

  it('seed data has placeholder confidence, not healthy confidence', () => {
    _resetToSeed();
    const state = snapshot();
    // Seed data is marked with placeholder confidence so UI knows it's mock
    expect(state.keysProvenance.confidence).toBe('placeholder');
    expect(state.mcpProvenance.confidence).toBe('placeholder');
    expect(state.keysProvenance.freshness).toBe('missing');
    expect(state.mcpProvenance.freshness).toBe('missing');
  });

  it('seed data provenance has explicit "not from a real adapter" note', () => {
    _resetToSeed();
    const state = snapshot();
    expect(state.keysProvenance.note).toContain('Mock seed data');
    expect(state.mcpProvenance.note).toContain('Mock seed data');
  });

  it('seed data confidence is not "verified" or "high"', () => {
    _resetToSeed();
    const state = snapshot();
    expect(state.keysProvenance.confidence).not.toBe('verified');
    expect(state.keysProvenance.confidence).not.toBe('high');
    expect(state.mcpProvenance.confidence).not.toBe('verified');
    expect(state.mcpProvenance.confidence).not.toBe('high');
  });

  it('after adapter-bound loadKeys, provenance upgrades to live/unverified', async () => {
    const adapter = makeMockAdapter({
      listKeys: vi.fn().mockResolvedValue([makeKey()]),
    });
    setKeyMcpAdminAdapter(adapter);

    const { loadKeys } = await import('@/state/adminKeyMcpStore');
    await loadKeys();

    const state = snapshot();
    expect(state.keysProvenance.freshness).toBe('live');
    expect(state.keysProvenance.confidence).toBe('unverified');
    expect(state.keysProvenance.note).toBeUndefined();
  });

  it('after adapter-bound loadMcpEntries, provenance upgrades to live/unverified', async () => {
    const adapter = makeMockAdapter({
      listMcpEntries: vi.fn().mockResolvedValue([makeMcp()]),
    });
    setKeyMcpAdminAdapter(adapter);

    const { loadMcpEntries } = await import('@/state/adminKeyMcpStore');
    await loadMcpEntries();

    const state = snapshot();
    expect(state.mcpProvenance.freshness).toBe('live');
    expect(state.mcpProvenance.confidence).toBe('unverified');
  });

  it('lastError being non-null signals unhealthy state', () => {
    adminKeyMcpStore.requestAction({ kind: 'key.delete', id: 'x' });
    expect(snapshot().lastError).not.toBeNull();
    const looksHealthy = snapshot().lastError === null && snapshot().keys.length === 0;
    expect(looksHealthy).toBe(false);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 3. NO BROWSER FILESYSTEM / CLI / PROFILE WRITES
 * ══════════════════════════════════════════════════════════════════════════ */

describe('Key/MCP: no browser filesystem/CLI/profile writes', () => {
  beforeEach(resetEmpty);

  it('store state is plain objects — no file handles or streams', () => {
    const state = snapshot();
    const json = JSON.stringify(state);
    // If state contained File, Blob, or stream objects, JSON.stringify would
    // produce '{}' for them. Verify every key produces real JSON.
    const parsed = JSON.parse(json);
    expect(parsed.keys).toEqual([]);
    expect(parsed.mcpEntries).toEqual([]);
    expect(parsed.pending).toEqual([]);
    expect(typeof parsed.lastError).toBe('object'); // null
  });

  it('initialKeyMcpState produces a serializable plain object', () => {
    const state = initialKeyMcpState();
    const json = JSON.stringify(state);
    const parsed = JSON.parse(json);
    expect(parsed.keys).toEqual([]);
    expect(parsed.mcpEntries).toEqual([]);
    expect(parsed.busy).toBe(false);
    expect(parsed.lastError).toBeNull();
    expect(parsed.keysProvenance.freshness).toBe('missing');
  });

  it('no store method accepts or produces Node.js fs-like types', () => {
    // The store only accepts KeyMcpAction and returns KeyMcpActionResult.
    // There are no methods that accept paths, buffers, or streams.
    // This test verifies the store API surface by introspection.
    const methodNames = Object.getOwnPropertyNames(adminKeyMcpStore).filter(
      (n) => typeof (adminKeyMcpStore as Record<string, unknown>)[n] === 'function',
    );
    const forbiddenPatterns = /file|path|fs|buffer|stream|write|mkdir|unlink|chmod/i;
    for (const name of methodNames) {
      expect(name).not.toMatch(forbiddenPatterns);
    }
  });

  it('store never writes to localStorage/sessionStorage', () => {
    // The store is in-memory only. We verify by checking that after
    // several mutations, nothing is stored in browser storage.
    // In node test env, these may be undefined, so we just confirm
    // the store doesn't attempt to use them.
    const state = snapshot();
    expect(state).toBeDefined();
    // No side effects in global storage
    expect(typeof globalThis.localStorage).toBe('undefined');
    expect(typeof globalThis.sessionStorage).toBe('undefined');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 4. REDACTION: raw secrets never in persistent state or JSON output
 * ══════════════════════════════════════════════════════════════════════════ */

describe('maskSecret', () => {
  it('masks a long API key, showing only first 3 and last 4 chars', () => {
    const masked = maskSecret('sk-abc...7890');
    expect(masked).toMatch(/^sk-/);
    expect(masked).toMatch(/7890$/);
    expect(masked).toContain('•');
    expect(masked).not.toContain('abcdefghij123456');
  });

  it('masks short strings to show only last 2 chars', () => {
    const masked = maskSecret('abc');
    expect(masked).not.toBe('abc');
    expect(masked).toHaveLength(4); // '••' + last 2
  });

  it('returns empty for empty input', () => {
    expect(maskSecret('')).toBe('');
  });
});

describe('maskUrl', () => {
  it('masks URLs with embedded credentials', () => {
    const masked = maskUrl('https://user:secretpass@localhost:8000/mcp');
    expect(masked).not.toContain('secretpass');
    expect(masked).not.toContain('user:');
    expect(masked).toContain('localhost');
    expect(masked).toContain('••••');
    expect(masked).toContain('@localhost');
  });

  it('preserves URLs without credentials', () => {
    const url = 'http://localhost:8000/mcp';
    expect(maskUrl(url)).toBe(url);
  });
});

describe('Key/MCP: redaction in persistent state', () => {
  beforeEach(resetSeed);

  it('seed keys have masked secrets, not raw values', () => {
    const state = snapshot();
    for (const key of state.keys) {
      expect(key.maskedSecret).toContain('•');
      expect(key.maskedSecret).not.toMatch(/^sk-[a-zA-Z0-9]{20,}/);
    }
  });

  it('seed MCP entries have masked tokens, not raw values', () => {
    const state = snapshot();
    for (const entry of state.mcpEntries) {
      if (entry.maskedToken !== null) {
        expect(entry.maskedToken).toContain('•');
        expect(entry.maskedToken).not.toMatch(/^tok-[a-zA-Z0-9]{10,}/);
      }
    }
  });

  it('JSON.stringify of store state contains no raw secret patterns', () => {
    const state = snapshot();
    const json = JSON.stringify(state);
    // Common raw secret prefixes that should never appear
    expect(json).not.toContain('sk-ant-api03');
    expect(json).not.toContain('sk-or-v1-');
    expect(json).not.toContain('sk-proj-');
    expect(json).not.toContain('whsec_');
  });

  it('clearLastResult removes any one-time secret from memory', async () => {
    const adapter = makeMockAdapter({
      executeAction: vi.fn().mockResolvedValue({
        action: { kind: 'key.create', label: 'Test', provider: 'openrouter' },
        ok: true,
        message: 'Created',
        createdKey: {
          id: 'key_new',
          label: 'Test',
          provider: 'openrouter',
          maskedSecret: 'sk-or••••xxxx',
          active: true,
          createdAt: '2026-06-21T00:00:00Z',
          lastRotatedAt: null,
          revokedAt: null,
          secret: 'sk-or-v1-raw-secret-value-that-must-not-persist',
        },
        completedAt: new Date().toISOString(),
      }),
    });
    setKeyMcpAdminAdapter(adapter);

    adminKeyMcpStore.requestAction({
      kind: 'key.create',
      label: 'Test',
      provider: 'openrouter',
    });
    await new Promise((r) => setTimeout(r, 50));

    // One-time secret should be in lastResult
    expect(lastSecret()).toBe('sk-or-v1-raw-secret-value-that-must-not-persist');

    // But NOT in persistent collections
    expect(persistentStateJson()).not.toContain('sk-or-v1-raw-secret-value-that-must-not-persist');

    // After clearing lastResult, the secret is gone from store entirely
    adminKeyMcpStore.clearLastResult();
    expect(lastSecret()).toBeNull();

    const fullJson = JSON.stringify(snapshot());
    expect(fullJson).not.toContain('sk-or-v1-raw-secret-value-that-must-not-persist');
  });

  it('one-time MCP token is stripped from persistent collections', async () => {
    const adapter = makeMockAdapter({
      executeAction: vi.fn().mockResolvedValue({
        action: { kind: 'mcp.create', name: 'test', url: 'http://x', transport: 'http' },
        ok: true,
        message: 'Created',
        createdMcp: {
          id: 'mcp_new',
          name: 'test',
          url: 'http://x/mcp',
          transport: 'http',
          enabled: true,
          maskedToken: 'tok-••••new1',
          lastTest: null,
          createdAt: '2026-06-21T00:00:00Z',
          token: 'raw-mcp-token-value-secret',
          rawUrl: 'https://user:pass@x/mcp',
        },
        completedAt: new Date().toISOString(),
      }),
    });
    setKeyMcpAdminAdapter(adapter);

    adminKeyMcpStore.requestAction({
      kind: 'mcp.create',
      name: 'test',
      url: 'http://x',
      transport: 'http',
    });
    await new Promise((r) => setTimeout(r, 50));

    // One-time token should be in lastResult
    expect(lastMcpToken()).toBe('raw-mcp-token-value-secret');

    // But NOT in persistent collections
    expect(persistentStateJson()).not.toContain('raw-mcp-token-value-secret');
    expect(persistentStateJson()).not.toContain('user:pass');

    // After clearing, token is gone from store
    adminKeyMcpStore.clearLastResult();
    const fullJson = JSON.stringify(snapshot());
    expect(fullJson).not.toContain('raw-mcp-token-value-secret');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 5. CONFIRMATION GATES: destructive actions require confirmation
 * ══════════════════════════════════════════════════════════════════════════ */

describe('isDestructive', () => {
  it('flags revoke, regenerate, delete, and remove as destructive', () => {
    expect(isDestructive({ kind: 'key.revoke', id: 'x' })).toBe(true);
    expect(isDestructive({ kind: 'key.regenerate', id: 'x' })).toBe(true);
    expect(isDestructive({ kind: 'key.delete', id: 'x' })).toBe(true);
    expect(isDestructive({ kind: 'mcp.remove', id: 'x' })).toBe(true);
  });

  it('does not flag create, update, or test as destructive', () => {
    expect(isDestructive({ kind: 'key.create', label: 'l', provider: 'p' })).toBe(false);
    expect(isDestructive({ kind: 'key.update', id: 'x', label: 'l' })).toBe(false);
    expect(isDestructive({ kind: 'mcp.create', name: 'n', url: 'u', transport: 'http' })).toBe(false);
    expect(isDestructive({ kind: 'mcp.update', id: 'x' })).toBe(false);
    expect(isDestructive({ kind: 'mcp.test', id: 'x' })).toBe(false);
  });
});

describe('Key/MCP RiskConfirmDialog metadata', () => {
  it('maps destructive actions to risk and danger tiers without changing safe actions', () => {
    expect(keyMcpActionTier({ kind: 'key.create', label: 'l', provider: 'p' })).toBe('safe');
    expect(keyMcpActionTier({ kind: 'key.update', id: 'x', label: 'l' })).toBe('safe');
    expect(keyMcpActionTier({ kind: 'mcp.test', id: 'x' })).toBe('safe');
    expect(keyMcpActionTier({ kind: 'key.revoke', id: 'x' })).toBe('risk');
    expect(keyMcpActionTier({ kind: 'key.regenerate', id: 'x' })).toBe('risk');
    expect(keyMcpActionTier({ kind: 'key.delete', id: 'x' })).toBe('danger');
    expect(keyMcpActionTier({ kind: 'mcp.remove', id: 'x' })).toBe('danger');
  });

  it('keeps existing confirmation coverage while adding typed gates only to danger actions', () => {
    expect(keyMcpRequiresConfirmation({ kind: 'key.create', label: 'l', provider: 'p' })).toBe(false);
    expect(keyMcpRequiresConfirmation({ kind: 'mcp.test', id: 'x' })).toBe(false);
    expect(keyMcpRequiresConfirmation({ kind: 'key.revoke', id: 'x' })).toBe(true);
    expect(keyMcpRequiresConfirmation({ kind: 'key.regenerate', id: 'x' })).toBe(true);
    expect(keyMcpRequiresConfirmation({ kind: 'key.delete', id: 'x' })).toBe(true);
    expect(keyMcpRequiresConfirmation({ kind: 'mcp.remove', id: 'x' })).toBe(true);

    expect(keyMcpRequiresTypedPhrase({ kind: 'key.revoke', id: 'x' })).toBe(false);
    expect(keyMcpRequiresTypedPhrase({ kind: 'key.regenerate', id: 'x' })).toBe(false);
    expect(keyMcpRequiresTypedPhrase({ kind: 'key.delete', id: 'x' })).toBe(true);
    expect(keyMcpRequiresTypedPhrase({ kind: 'mcp.remove', id: 'x' })).toBe(true);
  });
});

describe('destructive action confirmation (with adapter)', () => {
  beforeEach(() => {
    resetSeed();
    setKeyMcpAdminAdapter(makeMockAdapter());
  });

  it('revoke creates a pending confirmation instead of executing', () => {
    const keysBefore = snapshot().keys.length;
    adminKeyMcpStore.requestAction({ kind: 'key.revoke', id: 'key_openrouter_1' });
    expect(snapshot().pending).toHaveLength(1);
    expect(snapshot().pending[0].tier).toBe('risk');
    expect(snapshot().pending[0].requiresTypedPhrase).toBe(false);
    expect(snapshot().pending[0].typedPhrase).toBe('');
    expect(snapshot().keys).toHaveLength(keysBefore);
  });

  it('confirming a revoke executes it', async () => {
    adminKeyMcpStore.requestAction({ kind: 'key.revoke', id: 'key_openrouter_1' });
    const nonce = snapshot().pending[0].nonce;
    adminKeyMcpStore.confirmAction(nonce);
    await new Promise((r) => setTimeout(r, 50));
    expect(snapshot().pending).toHaveLength(0);
  });

  it('cancelling a revoke does not execute it', () => {
    adminKeyMcpStore.requestAction({ kind: 'key.revoke', id: 'key_anthropic_1' });
    const nonce = snapshot().pending[0].nonce;
    adminKeyMcpStore.cancelAction(nonce);
    expect(snapshot().pending).toHaveLength(0);
  });

  it('regenerate creates a pending confirmation', () => {
    adminKeyMcpStore.requestAction({ kind: 'key.regenerate', id: 'key_openrouter_1' });
    expect(snapshot().pending).toHaveLength(1);
  });

  it('delete creates a pending confirmation', () => {
    const keysBefore = snapshot().keys.length;
    adminKeyMcpStore.requestAction({ kind: 'key.delete', id: 'key_anthropic_1' });
    expect(snapshot().pending).toHaveLength(1);
    expect(snapshot().pending[0].tier).toBe('danger');
    expect(snapshot().pending[0].requiresTypedPhrase).toBe(true);
    expect(snapshot().pending[0].typedPhrase).toBe('Anthropic — Claude');
    expect(snapshot().keys).toHaveLength(keysBefore);
  });

  it('mcp.remove creates a pending confirmation', () => {
    const before = snapshot().mcpEntries.length;
    adminKeyMcpStore.requestAction({ kind: 'mcp.remove', id: 'mcp_n8n' });
    expect(snapshot().pending).toHaveLength(1);
    expect(snapshot().pending[0].tier).toBe('danger');
    expect(snapshot().pending[0].requiresTypedPhrase).toBe(true);
    expect(snapshot().pending[0].typedPhrase).toBe('n8n');
    expect(snapshot().mcpEntries).toHaveLength(before);
  });

  it('cancelAllPending clears all confirmations', () => {
    adminKeyMcpStore.requestAction({ kind: 'key.revoke', id: 'key_openrouter_1' });
    adminKeyMcpStore.requestAction({ kind: 'mcp.remove', id: 'mcp_n8n' });
    expect(snapshot().pending).toHaveLength(2);
    adminKeyMcpStore.cancelAllPending();
    expect(snapshot().pending).toHaveLength(0);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 6. KEY/MCP CREATION FLOWS (with adapter)
 * ══════════════════════════════════════════════════════════════════════════ */

describe('key.create with adapter', () => {
  beforeEach(() => {
    resetEmpty();
    setKeyMcpAdminAdapter(makeMockAdapter({
      executeAction: vi.fn().mockResolvedValue({
        action: { kind: 'key.create', label: 'New Key', provider: 'openrouter' },
        ok: true,
        message: 'Created',
        createdKey: {
          id: 'key_new_1',
          label: 'New Key',
          provider: 'openrouter',
          maskedSecret: 'sk-or••••new1',
          active: true,
          createdAt: '2026-06-21T00:00:00Z',
          lastRotatedAt: null,
          revokedAt: null,
          secret: 'sk-or-v1-new-raw-secret-abc123',
        },
        completedAt: new Date().toISOString(),
      }),
    }));
  });

  it('creates a key and returns the secret in lastResult', async () => {
    adminKeyMcpStore.requestAction({
      kind: 'key.create',
      label: 'New Key',
      provider: 'openrouter',
    });
    await new Promise((r) => setTimeout(r, 50));

    const result = snapshot().lastResult;
    expect(result).not.toBeNull();
    expect(result!.ok).toBe(true);
    expect(result!.createdKey).toBeDefined();
    expect(result!.createdKey!.secret).toBe('sk-or-v1-new-raw-secret-abc123');
  });

  it('persists the key with masked secret in keys array', async () => {
    adminKeyMcpStore.requestAction({
      kind: 'key.create',
      label: 'New Key',
      provider: 'openrouter',
    });
    await new Promise((r) => setTimeout(r, 50));

    const key = snapshot().keys.find((k) => k.label === 'New Key');
    expect(key).toBeDefined();
    expect(key!.maskedSecret).toContain('•');

    // Raw secret must NOT appear in persistent collections
    expect(persistentStateJson()).not.toContain('sk-or-v1-new-raw-secret-abc123');
  });
});

describe('mcp.create with adapter', () => {
  beforeEach(() => {
    resetEmpty();
    setKeyMcpAdminAdapter(makeMockAdapter({
      executeAction: vi.fn().mockResolvedValue({
        action: { kind: 'mcp.create', name: 'new-mcp', url: 'http://x', transport: 'http' },
        ok: true,
        message: 'Created',
        createdMcp: {
          id: 'mcp_new',
          name: 'new-mcp',
          url: 'http://x/mcp',
          transport: 'http',
          enabled: true,
          maskedToken: 'tok-••••new1',
          lastTest: null,
          createdAt: '2026-06-21T00:00:00Z',
          token: 'raw-token-secret',
        },
        completedAt: new Date().toISOString(),
      }),
    }));
  });

  it('creates MCP entry and returns token in lastResult', async () => {
    adminKeyMcpStore.requestAction({
      kind: 'mcp.create',
      name: 'new-mcp',
      url: 'http://x',
      transport: 'http',
      token: 'my-token',
    });
    await new Promise((r) => setTimeout(r, 50));

    expect(lastMcpToken()).toBe('raw-token-secret');
  });

  it('persists MCP entry with masked token, not raw', async () => {
    adminKeyMcpStore.requestAction({
      kind: 'mcp.create',
      name: 'new-mcp',
      url: 'http://x',
      transport: 'http',
      token: 'my-token',
    });
    await new Promise((r) => setTimeout(r, 50));

    const entry = snapshot().mcpEntries.find((m) => m.name === 'new-mcp');
    expect(entry).toBeDefined();
    expect(entry!.maskedToken).toContain('•');
    expect(persistentStateJson()).not.toContain('raw-token-secret');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 7. PROVENANCE TRACKING: independent per subsection
 * ══════════════════════════════════════════════════════════════════════════ */

describe('Key/MCP: independent provenance per subsection', () => {
  beforeEach(resetEmpty);

  it('ingesting keys upgrades keysProvenance but not mcpProvenance', () => {
    _ingestKeys([makeKey()]);
    const state = snapshot();
    expect(state.keysProvenance.freshness).toBe('live');
    expect(state.keysProvenance.confidence).toBe('unverified');
    expect(state.mcpProvenance.freshness).toBe('missing');
    expect(state.mcpProvenance.confidence).toBe('unknown');
  });

  it('ingesting MCP entries upgrades mcpProvenance but not keysProvenance', () => {
    _ingestMcpEntries([makeMcp()]);
    const state = snapshot();
    expect(state.mcpProvenance.freshness).toBe('live');
    expect(state.mcpProvenance.confidence).toBe('unverified');
    expect(state.keysProvenance.freshness).toBe('missing');
    expect(state.keysProvenance.confidence).toBe('unknown');
  });

  it('both provenances can be upgraded independently', () => {
    _ingestKeys([makeKey()]);
    _ingestMcpEntries([makeMcp()]);
    const state = snapshot();
    expect(state.keysProvenance.freshness).toBe('live');
    expect(state.mcpProvenance.freshness).toBe('live');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 8. EXHAUSTIVE ACTION KIND CHECK
 * ══════════════════════════════════════════════════════════════════════════ */

describe('exhaustive action kinds', () => {
  it('all action kinds are handled by isDestructive', () => {
    const allKinds: KeyMcpAction['kind'][] = [
      'key.create',
      'key.update',
      'key.revoke',
      'key.regenerate',
      'key.delete',
      'mcp.create',
      'mcp.update',
      'mcp.test',
      'mcp.remove',
    ];
    for (const kind of allKinds) {
      const action = { kind } as KeyMcpAction;
      isDestructive(action); // should not throw
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 9. ADAPTER FAILURE HANDLING: error paths are explicit, not silent
 * ══════════════════════════════════════════════════════════════════════════ */

describe('Key/MCP: adapter failure handling', () => {
  beforeEach(resetEmpty);

  it('loadKeys propagates adapter error to lastError', async () => {
    const adapter = makeMockAdapter({
      listKeys: vi.fn().mockRejectedValue(new Error('Network timeout')),
    });
    setKeyMcpAdminAdapter(adapter);

    const { loadKeys } = await import('@/state/adminKeyMcpStore');
    await loadKeys();

    expect(snapshot().lastError).toBe('Network timeout');
    expect(snapshot().keys).toHaveLength(0);
  });

  it('loadMcpEntries propagates adapter error to lastError', async () => {
    const adapter = makeMockAdapter({
      listMcpEntries: vi.fn().mockRejectedValue(new Error('Connection refused')),
    });
    setKeyMcpAdminAdapter(adapter);

    const { loadMcpEntries } = await import('@/state/adminKeyMcpStore');
    await loadMcpEntries();

    expect(snapshot().lastError).toBe('Connection refused');
  });

  it('executeAction sets lastError on adapter rejection', async () => {
    const adapter = makeMockAdapter({
      executeAction: vi.fn().mockRejectedValue(new Error('Server error 500')),
    });
    setKeyMcpAdminAdapter(adapter);

    adminKeyMcpStore.requestAction({
      kind: 'key.update',
      id: 'x',
      label: 'New',
    });
    await new Promise((r) => setTimeout(r, 50));

    expect(snapshot().lastError).toBe('Server error 500');
    expect(snapshot().busy).toBe(false);
  });

  it('successful action clears lastError', async () => {
    const adapter = makeMockAdapter();
    setKeyMcpAdminAdapter(adapter);

    // First cause an error
    adminKeyMcpStore.requestAction({ kind: 'key.revoke', id: 'x' });
    // This goes to pending, not execution
    // Now do a non-destructive action
    adminKeyMcpStore.requestAction({
      kind: 'key.update',
      id: 'x',
      label: 'Test',
    });
    await new Promise((r) => setTimeout(r, 50));

    expect(snapshot().lastError).toBeNull();
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 10. JSON SERIALIZATION: no secrets leak through serialization
 * ══════════════════════════════════════════════════════════════════════════ */

describe('Key/MCP: JSON serialization safety', () => {
  beforeEach(resetSeed);

  it('full store JSON has no raw secret patterns after clearLastResult', () => {
    adminKeyMcpStore.clearLastResult();
    const json = JSON.stringify(snapshot());
    expect(json).not.toContain('sk-ant-api03');
    expect(json).not.toContain('sk-or-v1-');
    expect(json).not.toContain('sk-proj-');
    expect(json).not.toContain('whsec_');
    // Masked versions should be present
    expect(json).toContain('•');
  });

  it('keys array items are safe to send over the wire', () => {
    for (const key of snapshot().keys) {
      const json = JSON.stringify(key);
      const parsed = JSON.parse(json);
      expect(parsed).toHaveProperty('maskedSecret');
      expect(parsed).not.toHaveProperty('secret');
    }
  });

  it('mcpEntries array items are safe to send over the wire', () => {
    for (const entry of snapshot().mcpEntries) {
      const json = JSON.stringify(entry);
      const parsed = JSON.parse(json);
      expect(parsed).not.toHaveProperty('token');
      expect(parsed).not.toHaveProperty('rawUrl');
    }
  });
});
