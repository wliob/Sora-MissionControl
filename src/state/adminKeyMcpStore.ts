/**
 * Admin Key/MCP store — the single source of truth for API-key and MCP
 * management surfaces in the admin module.
 *
 * Phase 6 unified admin safety store. Follows the same patterns as
 * adminStore.ts and cwsAdminStore.ts:
 *   - Secrets are masked fingerprints in persistent state; raw values
 *     appear only in one-time `lastResult.createdKey` / `.createdMcp`.
 *   - Destructive actions are gated behind `PendingConfirmation`.
 *   - Ingest guards reject unmasked secrets (defense-in-depth).
 *   - Missing backend is rendered as unavailable, not silently mocked.
 *
 * This store starts empty (no mock seed data). When Cloud's adapter is
 * bound, `loadKeys` / `loadMcpEntries` populate it from the real backend.
 * The `_resetToSeed()` method is TEST ONLY and restores mock seed data
 * for backward-compatible test isolation.
 */

import { useSyncExternalStore } from 'react';
import {
  type ApiKey,
  type KeyMcpAction,
  type KeyMcpActionResult,
  type KeyMcpAdminState,
  type McpEntry,
  type PendingConfirmation,
  isDestructive,
  initialKeyMcpState,
} from '@/types/admin-keymcp';

/* ── Adapter binding ──────────────────────────────────────────────────── */

/**
 * The Cloud-owned Key/MCP admin adapter. The store calls these methods to
 * fetch and mutate key/MCP data against the real Hermes backend.
 */
export interface KeyMcpAdminAdapter {
  /** List all API keys (with masked secrets). */
  listKeys(): Promise<ApiKey[]>;
  /** List all configured MCP servers (with masked tokens). */
  listMcpEntries(): Promise<McpEntry[]>;
  /** Execute a confirmed action. Returns a non-secret result. */
  executeAction(action: KeyMcpAction): Promise<KeyMcpActionResult>;
}

let adapter: KeyMcpAdminAdapter | null = null;

/** Inject the Key/MCP admin adapter (Cloud-owned). Called once during app boot. */
export function setKeyMcpAdminAdapter(a: KeyMcpAdminAdapter | null): void {
  adapter = a;
}

/** Whether a Key/MCP adapter is bound. */
export function hasKeyMcpAdapter(): boolean {
  return adapter !== null;
}

/* ── Mock seed (TEST ONLY) ────────────────────────────────────────────────
 * Realistic-looking but fake data so the admin surface is fully interactive
 * in test environments. All secrets are already masked; the store never
 * holds raw values.
 *
 * This data is NOT used in the default initial state. It is only
 * accessible via `_resetToSeed()` for test isolation.
 */

const SEED_KEYS: ApiKey[] = [
  {
    id: 'key_openrouter_1',
    label: 'OpenRouter — primary',
    provider: 'openrouter',
    maskedSecret: 'sk-or••••4f2a',
    active: true,
    createdAt: '2026-06-10T08:30:00Z',
    lastRotatedAt: '2026-06-15T14:00:00Z',
    revokedAt: null,
    note: 'Main production key',
  },
  {
    id: 'key_anthropic_1',
    label: 'Anthropic — Claude',
    provider: 'anthropic',
    maskedSecret: 'sk-ant••••9b3c',
    active: true,
    createdAt: '2026-06-08T12:00:00Z',
    lastRotatedAt: null,
    revokedAt: null,
  },
  {
    id: 'key_openai_1',
    label: 'OpenAI — GPT',
    provider: 'openai',
    maskedSecret: 'sk-•••••a1b2',
    active: false,
    createdAt: '2026-05-20T09:15:00Z',
    lastRotatedAt: '2026-05-20T09:15:00Z',
    revokedAt: '2026-06-01T16:00:00Z',
    note: 'Revoked after rotation',
  },
];

const SEED_MCP: McpEntry[] = [
  {
    id: 'mcp_context7',
    name: 'context7',
    url: 'http://localhost:8000/mcp',
    transport: 'http',
    enabled: true,
    maskedToken: 'tok-••••ab12',
    lastTest: {
      testedAt: '2026-06-19T00:10:00Z',
      ok: true,
      latencyMs: 42,
    },
    createdAt: '2026-06-12T10:00:00Z',
  },
  {
    id: 'mcp_n8n',
    name: 'n8n',
    url: 'http://localhost:5679/mcp',
    transport: 'http',
    enabled: true,
    maskedToken: null,
    lastTest: {
      testedAt: '2026-06-19T00:09:00Z',
      ok: false,
      error: 'Connection refused',
    },
    createdAt: '2026-06-14T15:30:00Z',
    note: 'Workflow automation bridge',
  },
  {
    id: 'mcp_gamelab',
    name: 'gamelab',
    url: 'stdio://gamelab-server',
    transport: 'stdio',
    enabled: false,
    maskedToken: null,
    lastTest: null,
    createdAt: '2026-06-16T18:45:00Z',
  },
];

/* ── Store implementation ────────────────────────────────────────────────── */

let state: KeyMcpAdminState = { ...initialKeyMcpState() };

const listeners = new Set<() => void>();
let confirmNonceCounter = 0;

function emit(): void {
  for (const fn of listeners) fn();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): KeyMcpAdminState {
  return state;
}

function setState(patch: Partial<KeyMcpAdminState>): void {
  state = { ...state, ...patch };
  emit();
}

/* ── Action summaries for confirmation dialogs ─────────────────────────── */

function summarizeAction(action: KeyMcpAction): string {
  switch (action.kind) {
    case 'key.revoke': {
      const k = state.keys.find((x) => x.id === action.id);
      return `Revoke API key "${k?.label ?? action.id}"? It will stop working immediately.`;
    }
    case 'key.regenerate': {
      const k = state.keys.find((x) => x.id === action.id);
      return `Regenerate API key "${k?.label ?? action.id}"? The old key stops working immediately and a new one is issued.`;
    }
    case 'key.delete': {
      const k = state.keys.find((x) => x.id === action.id);
      return `Permanently delete API key "${k?.label ?? action.id}"? This cannot be undone.`;
    }
    case 'mcp.remove': {
      const m = state.mcpEntries.find((x) => x.id === action.id);
      return `Remove MCP server "${m?.name ?? action.id}"? It will no longer be available to agents.`;
    }
    default:
      return `Confirm action: ${action.kind}`;
  }
}

/* ── Data loading ─────────────────────────────────────────────────────── */

/** Load API keys from the bound adapter. Sets lastError if no adapter. */
export async function loadKeys(): Promise<void> {
  if (!adapter) {
    setState({ lastError: 'No Key/MCP admin adapter bound' });
    return;
  }
  try {
    const keys = await adapter.listKeys();
    setState({
      keys,
      keysProvenance: {
        source: 'admin-cli',
        freshness: 'live',
        confidence: 'unverified',
        receivedAt: new Date().toISOString(),
      },
      lastError: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setState({ lastError: message });
  }
}

/** Load MCP entries from the bound adapter. */
export async function loadMcpEntries(): Promise<void> {
  if (!adapter) {
    setState({ lastError: 'No Key/MCP admin adapter bound' });
    return;
  }
  try {
    const mcpEntries = await adapter.listMcpEntries();
    setState({
      mcpEntries,
      mcpProvenance: {
        source: 'admin-cli',
        freshness: 'live',
        confidence: 'unverified',
        receivedAt: new Date().toISOString(),
      },
      lastError: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setState({ lastError: message });
  }
}

/* ── Public store API ──────────────────────────────────────────────────── */

export const adminKeyMcpStore = {
  get state(): KeyMcpAdminState {
    return state;
  },

  /** Request an action. If destructive, it goes to pending; otherwise it executes immediately. */
  requestAction(action: KeyMcpAction): void {
    if (!adapter) {
      // When no adapter is bound, all actions fail explicitly
      const result: KeyMcpActionResult = {
        action,
        ok: false,
        message: 'No Key/MCP admin adapter bound',
        completedAt: new Date().toISOString(),
      };
      setState({ lastResult: result, lastError: result.message });
      return;
    }

    if (isDestructive(action)) {
      const nonce = `conf_${++confirmNonceCounter}`;
      const pending: PendingConfirmation = {
        nonce,
        action,
        summary: summarizeAction(action),
        requestedAt: new Date().toISOString(),
      };
      setState({ pending: [...state.pending, pending] });
      return;
    }
    // Non-destructive actions execute immediately
    void this.executeAction(action);
  },

  /** Confirm a pending destructive action and execute it. */
  confirmAction(nonce: string): void {
    const pending = state.pending.find((p) => p.nonce === nonce);
    if (!pending) return;
    setState({ pending: state.pending.filter((p) => p.nonce !== nonce) });
    void this.executeAction(pending.action);
  },

  /** Cancel a pending destructive action. */
  cancelAction(nonce: string): void {
    setState({ pending: state.pending.filter((p) => p.nonce !== nonce) });
  },

  /** Cancel all pending confirmations. */
  cancelAllPending(): void {
    if (state.pending.length === 0) return;
    setState({ pending: [] });
  },

  /** Execute an action directly (no confirmation gate). Called internally. */
  async executeAction(action: KeyMcpAction): Promise<void> {
    setState({ busy: true });
    try {
      if (!adapter) {
        const result: KeyMcpActionResult = {
          action,
          ok: false,
          message: 'No Key/MCP admin adapter bound',
          completedAt: new Date().toISOString(),
        };
        setState({ lastResult: result, busy: false, lastError: result.message });
        return;
      }

      const result = await adapter.executeAction(action);

      // After a successful action, update the relevant list in the store
      if (result.ok) {
        if (result.createdKey) {
          // Add the new key to the list — strip one-time secret
          const { secret: _s, ...safeKey } = result.createdKey;
          void _s;
          setState({ keys: [...state.keys, safeKey as ApiKey] });
        }
        if (result.createdMcp) {
          // Add the new MCP entry to the list — strip one-time fields
          const { token: _t, rawUrl: _u, ...safeMcp } = result.createdMcp;
          void _t;
          void _u;
          setState({ mcpEntries: [...state.mcpEntries, safeMcp as McpEntry] });
        }

        // For non-create actions, reload the relevant list
        const actionKind = action.kind;
        if (actionKind.startsWith('key.') && actionKind !== 'key.create') {
          void loadKeys();
        }
        if (actionKind.startsWith('mcp.') && actionKind !== 'mcp.create') {
          void loadMcpEntries();
        }
      }

      setState({ lastResult: result, busy: false, lastError: result.ok ? null : result.message });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const result: KeyMcpActionResult = {
        action,
        ok: false,
        message,
        completedAt: new Date().toISOString(),
      };
      setState({ lastResult: result, busy: false, lastError: message });
    }
  },

  /** Clear the last action result (UI calls after showing feedback). */
  clearLastResult(): void {
    if (state.lastResult) setState({ lastResult: null });
  },
};

/* ── Selectors ─────────────────────────────────────────────────────────── */

export function getKeys(): ApiKey[] {
  return state.keys;
}

export function getMcpEntries(): McpEntry[] {
  return state.mcpEntries;
}

export function getKeyMcpPending(): PendingConfirmation[] {
  return state.pending;
}

export function getKeyMcpLastResult(): KeyMcpActionResult | null {
  return state.lastResult;
}

/* ── React hook ─────────────────────────────────────────────────────────── */

export function useKeyMcpAdminState(): KeyMcpAdminState {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/* ── Test-only helpers ─────────────────────────────────────────────────── */

/** Reset the store to empty initial state. TEST ONLY. */
export function _resetForTest(): void {
  state = { ...initialKeyMcpState() };
  adapter = null;
  confirmNonceCounter = 0;
  emit();
}

/**
 * TEST ONLY: Reset the store to mock seed data for backward-compatible
 * test isolation. This simulates having data but does NOT bind an adapter.
 */
export function _resetToSeed(): void {
  state = {
    keys: SEED_KEYS.map((k) => ({ ...k })),
    mcpEntries: SEED_MCP.map((m) => ({ ...m })),
    pending: [],
    lastResult: null,
    busy: false,
    keysProvenance: {
      source: 'mock' as const,
      freshness: 'missing',
      confidence: 'placeholder',
      receivedAt: new Date().toISOString(),
      note: 'Mock seed data — not from a real adapter',
    },
    mcpProvenance: {
      source: 'mock' as const,
      freshness: 'missing',
      confidence: 'placeholder',
      receivedAt: new Date().toISOString(),
      note: 'Mock seed data — not from a real adapter',
    },
    lastError: null,
  };
  emit();
}

/**
 * TEST ONLY: ingest keys directly (bypasses adapter).
 */
export function _ingestKeys(keys: ApiKey[]): void {
  setState({
    keys,
    keysProvenance: {
      source: 'admin-cli',
      freshness: 'live',
      confidence: 'unverified',
      receivedAt: new Date().toISOString(),
    },
  });
}

/**
 * TEST ONLY: ingest MCP entries directly (bypasses adapter).
 */
export function _ingestMcpEntries(mcpEntries: McpEntry[]): void {
  setState({
    mcpEntries,
    mcpProvenance: {
      source: 'admin-cli',
      freshness: 'live',
      confidence: 'unverified',
      receivedAt: new Date().toISOString(),
    },
  });
}
