/**
 * Canonical types for the API-key and MCP admin controls (Phase 6/7).
 *
 * This file owns the shapes for API-key and MCP management surfaces consumed
 * by the admin UI. The admin store (src/state/adminKeyMcpStore.ts) exposes
 * exactly these shapes and emits `admin.action.requested` /
 * `admin.action.completed` / `admin.action.failed` per
 * docs/section-contracts.md §Admin/control module.
 *
 * Security invariants (enforced by the store, not just the types):
 *  - `ApiKey.secret` is only ever present on creation response payloads and is
 *    NEVER persisted into store state. The store immediately drops it after
 *    one-time display; subsequent reads return only the masked fingerprint.
 *  - `McpEntry.maskedToken` / `McpEntry.url` never contain raw secrets in
 *    read views. Only the one-time `McpEntryCreated` carries them.
 *  - Destructive actions (revoke, regenerate, delete, remove) go through a
 *    confirmation gate before being applied. The store never auto-applies.
 *  - No secret value is ever serialized into store state, logs, or event
 *    payloads.
 */

import type { Tracked } from './provenance';
import { tracked } from './provenance';

/* ───────────────────────────── API Keys ───────────────────────────── */

/**
 * The surface an admin sees when listing or viewing an API key.
 * The actual secret value is NEVER present here — only a masked
 * fingerprint derived from the key (e.g. "sk-…4f2a"). Creation
 * time returns `ApiKeyCreated` with the one-time `secret` field; the
 * store then persists `ApiKey` only.
 */
export interface ApiKey {
  id: string;
  /** Human label, e.g. "OpenRouter production". */
  label: string;
  /** Provider id this key is scoped to — forward-compat string. */
  provider: string;
  /** Masked fingerprint, e.g. "sk-…4f2a". NEVER the raw key. */
  maskedSecret: string;
  /** Whether the key is currently active. */
  active: boolean;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** ISO timestamp of last rotation/regeneration; null if never rotated. */
  lastRotatedAt: string | null;
  /** ISO timestamp when the key was revoked; null if active. */
  revokedAt: string | null;
  /** Optional non-secret note set by the admin. */
  note?: string;
}

/**
 * The one-time payload returned when a key is created or regenerated.
 * Contains the raw `secret` exactly once; the store drops it after the
 * UI has had a chance to display it. Never persisted.
 */
export interface ApiKeyCreated extends ApiKey {
  /** Raw secret value — present ONLY at creation/regeneration time. */
  secret: string;
}

/* ───────────────────────────── MCP Servers ────────────────────── */

/**
 * The surface an admin sees when listing or viewing an MCP server entry.
 * `maskedToken` is always masked in read views. The store keeps a separate
 * `McpEntryCreated` only for the brief create/edit window and never
 * serializes it.
 */
export interface McpEntry {
  id: string;
  /** Human label, e.g. "context7". */
  name: string;
  /** MCP server URL; masked if it contains credentials, else plain. */
  url: string;
  /** Transport kind. */
  transport: 'stdio' | 'http' | 'sse';
  /** Whether the MCP server is currently enabled. */
  enabled: boolean;
  /** Masked token fingerprint, e.g. "tok-…ab12"; null if no token configured. */
  maskedToken: string | null;
  /** Last connection test result; null if never tested. */
  lastTest: McpTestResult | null;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** Optional non-secret note set by the admin. */
  note?: string;
}

/** Result of an MCP connection test. */
export interface McpTestResult {
  /** ISO timestamp of the test. */
  testedAt: string;
  /** Whether the connection succeeded. */
  ok: boolean;
  /** Latency in ms when ok. */
  latencyMs?: number;
  /** Non-secret error message when ok=false. */
  error?: string;
}

/**
 * The one-time payload returned when an MCP entry is created or updated with
 * new credentials. Contains the raw token/URL so the admin can copy them
 * exactly once. Never persisted.
 */
export interface McpEntryCreated extends McpEntry {
  /** Raw token, if one was set; null if none. Present ONLY at creation/update. */
  token: string | null;
  /** Raw URL including any embedded credentials; present ONLY at creation. */
  rawUrl: string;
}

/* ───────────────────────────── Admin actions ───────────────────── */

/**
 * Discriminated union of all admin actions the UI can request. The store
 * validates each one and may require confirmation before applying.
 */
export type KeyMcpAction =
  | { kind: 'key.create'; label: string; provider: string; note?: string }
  | { kind: 'key.update'; id: string; label?: string; note?: string; active?: boolean }
  | { kind: 'key.revoke'; id: string }
  | { kind: 'key.regenerate'; id: string }
  | { kind: 'key.delete'; id: string }
  | {
      kind: 'mcp.create';
      name: string;
      url: string;
      transport: McpEntry['transport'];
      token?: string | null;
      note?: string;
    }
  | {
      kind: 'mcp.update';
      id: string;
      name?: string;
      url?: string;
      transport?: McpEntry['transport'];
      token?: string | null;
      note?: string;
      enabled?: boolean;
    }
  | { kind: 'mcp.test'; id: string }
  | { kind: 'mcp.remove'; id: string };

/** Actions that the store gates behind an explicit confirmation. */
const DESTRUCTIVE_KINDS: ReadonlySet<KeyMcpAction['kind']> = new Set([
  'key.revoke',
  'key.regenerate',
  'key.delete',
  'mcp.remove',
]);

export function isDestructive(action: KeyMcpAction): boolean {
  return DESTRUCTIVE_KINDS.has(action.kind);
}

/** A pending action awaiting confirmation. */
export interface PendingConfirmation {
  /** Unique nonce so the UI can refer to it. */
  nonce: string;
  action: KeyMcpAction;
  /** Human-readable summary of what will happen, for the confirm dialog. */
  summary: string;
  /** ISO timestamp the confirmation was requested. */
  requestedAt: string;
}

/** Outcome of an applied admin action. */
export interface KeyMcpActionResult {
  action: KeyMcpAction;
  ok: boolean;
  /** Non-secret human message. */
  message: string;
  /** For key.create / key.regenerate: the one-time created payload. */
  createdKey?: ApiKeyCreated;
  /** For mcp.create / mcp.update: the one-time created payload. */
  createdMcp?: McpEntryCreated;
  /** ISO timestamp of completion. */
  completedAt: string;
}

/* ───────────────────────────── Store shapes ────────────────────────── */

import type { Provenance } from './provenance';

/** Admin store snapshot: keys, MCP entries, pending confirmations, last action result. */
export interface KeyMcpAdminState {
  keys: ApiKey[];
  mcpEntries: McpEntry[];
  /** Actions awaiting confirmation. */
  pending: PendingConfirmation[];
  /** Last completed action result, for transient UI feedback. */
  lastResult: KeyMcpActionResult | null;
  /** Whether a long-running op (create/test) is in flight. */
  busy: boolean;
  /** Provenance for the keys subsection. */
  keysProvenance: Provenance;
  /** Provenance for the MCP entries subsection. */
  mcpProvenance: Provenance;
  /** Most recent non-secret error; null when healthy. */
  lastError: string | null;
}

export type KeyMcpAdminStateTracked = Tracked<KeyMcpAdminState>;

/** Convenience factory for the empty admin store snapshot. */
export function initialKeyMcpState(): KeyMcpAdminState {
  const missingProvenance: Provenance = {
    source: 'admin-cli',
    freshness: 'missing',
    confidence: 'unknown',
    receivedAt: new Date().toISOString(),
  };
  return {
    keys: [],
    mcpEntries: [],
    pending: [],
    lastResult: null,
    busy: false,
    keysProvenance: { ...missingProvenance },
    mcpProvenance: { ...missingProvenance },
    lastError: null,
  };
}

/** Convenience factory for the pre-load tracked admin state. */
export function initialKeyMcpStateTracked(): KeyMcpAdminStateTracked {
  return tracked(initialKeyMcpState(), {
    source: 'admin-cli',
    freshness: 'missing',
    confidence: 'unverified',
  });
}

/* ───────────────────────────── Helpers ────────────────────────── */

/**
 * Mask a secret string into a fingerprint. Shows the first visible prefix
 * and last 4 chars, replacing the middle with an ellipsis. Handles short
 * strings gracefully by masking everything except the last 2 chars.
 */
export function maskSecret(secret: string): string {
  if (!secret) return '';
  const trimmed = secret.trim();
  if (trimmed.length <= 6) {
    return '••' + trimmed.slice(-2);
  }
  const prefix = trimmed.slice(0, 3);
  const suffix = trimmed.slice(-4);
  return `${prefix}••••${suffix}`;
}

/**
 * Mask a URL that may contain embedded credentials (user:pass@host).
 * Preserves scheme + host + path but replaces any userinfo with bullets.
 */
export function maskUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  try {
    const u = new URL(rawUrl);
    if (u.username || u.password) {
      // Build manually — URL.toString() would URL-encode the bullet chars
      const auth = '••••';
      const port = u.port ? `:${u.port}` : '';
      return `${u.protocol}//${auth}@${u.hostname}${port}${u.pathname}${u.search}${u.hash}`;
    }
    return u.toString();
  } catch {
    if (rawUrl.length > 40) {
      return rawUrl.slice(0, 12) + '••••' + rawUrl.slice(-8);
    }
    return rawUrl;
  }
}