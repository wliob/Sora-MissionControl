/**
 * Canonical connection-health models for the Phase 4 backbone.
 *
 * Owns the shape of per-source health, reconnect state, and last-sync
 * indicators. The shared connection store (Cloud-owned) exposes exactly one
 * `ConnectionState` value and emits `connection.changed` on transitions.
 *
 * This unifies and supersedes the v2 standalone `ConnectionStatus` type
 * (which only had connected/reconnecting/offline) and the Phase 1
 * `SourceHealth` interface in `src/types/index.ts`, which is retained for
 * the shell store but now derives from these richer canonical models.
 *
 * Invariants:
 *  - Health is per-source, never a single global flag. Different Hermes
 *    surfaces (REST board, WS events, profile CLI, usage) can be healthy or
 *    down independently.
 *  - 'unknown' is a first-class state. UI MUST render it as unknown, never
 *    as healthy/green (docs/section-contracts.md §Live ops/usage forbidden
 *    dependencies: "Unknown must display as `unknown`, not green.").
 *  - Reconnect/backoff state is tracked separately from transport state so
 *    the UI can show "reconnecting in 3s" without conflating it with
 *    transport up/down.
 */

import type { Tracked } from './provenance';
import { tracked } from './provenance';

/**
 * Transport-level state for a single source. This is the discriminating
 * field on `SourceHealth` and the only one UI should branch on for status
 * colors (via STATUS_META in index.ts).
 *
 * Semantics:
 *  - `connected`: last request succeeded within the freshness window.
 *  - `degraded`: source responds but slowly, partially, or with errors that
 *    do not indicate auth failure (e.g. 5xx, timeouts, partial payloads).
 *  - `offline`: source is unreachable (network down, endpoint 404).
 *  - `unauthorized`: source rejected auth (401). Distinct from offline so
 *    the UI can prompt re-auth rather than show a generic offline banner.
 *  - `unknown`: no probe has completed yet, or the source has never been
 *    contacted. Render as unknown, never as green.
 */
export type TransportState =
  | 'connected'
  | 'degraded'
  | 'offline'
  | 'unauthorized'
  | 'unknown';

/**
 * The canonical per-source health record. Matches `SourceHealth` in
 * `src/types/index.ts` (Phase 1) but lives here as the source of truth; the
 * Phase 1 type re-exports this so existing shell code keeps compiling.
 *
 * Invariants:
 *  - `lastCheckedAt` is always set (ISO 8601) once the first probe runs;
 *    null only before any probe.
 *  - `lastOkAt` is null until a successful probe; it is NOT set on
 *    degraded/offline/unauthorized transitions.
 *  - `latencyMs` is optional and only meaningful when state is connected or
 *    degraded. UI must not display latency for offline/unknown.
 *  - `error` is a non-secret human-readable string; never include tokens,
 *    response bodies, or stack traces.
 */
export interface SourceHealth {
  state: TransportState;
  /** ISO timestamp of the last successful probe; null if never succeeded. */
  lastOkAt: string | null;
  /** ISO timestamp of the most recent probe attempt; null if never probed. */
  lastCheckedAt: string | null;
  /** Round-trip latency in ms for the last probe, when measurable. */
  latencyMs?: number;
  /** Non-secret error message for degraded/offline/unauthorized states. */
  error?: string;
}

/**
 * The named sources the backbone tracks health for. Adding a source here is
 * the canonical way to extend health monitoring; the store keys
 * `ConnectionState.sources` by these ids.
 */
export type KnownHealthSourceId =
  | 'dashboard' // Hermes dashboard base URL reachability
  | 'kanban-rest' // /api/plugins/kanban/board and task routes
  | 'kanban-ws' // /api/plugins/kanban/events websocket
  | 'profile-cli' // `hermes profile list/show` via trusted local proxy
  | 'usage-cli' // `hermes insights` historical usage
  | 'admin-cli' // cron/webhook/skills/mcp/auth CLI surfaces
  | 'chat-transport' // ChatTransport adapter (verified or mock)
  | 'provider-rate-limits'; // Real-time LLM provider rate limits and quota

export type HealthSourceId = KnownHealthSourceId | string; // forward-compat for future sources

export const KNOWN_HEALTH_SOURCE_IDS: readonly KnownHealthSourceId[] = [
  'dashboard',
  'kanban-rest',
  'kanban-ws',
  'profile-cli',
  'usage-cli',
  'admin-cli',
  'chat-transport',
  'provider-rate-limits',
] as const;

export const HEALTH_SOURCE_LABELS: Readonly<Record<KnownHealthSourceId, string>> = {
  dashboard: 'Core API',
  'kanban-rest': 'Kanban REST',
  'kanban-ws': 'Kanban WS',
  'profile-cli': 'Profile CLI',
  'usage-cli': 'Usage feed',
  'admin-cli': 'Admin CLI',
  'provider-rate-limits': 'Provider quotas',
  'chat-transport': 'Chat transport',
} as const;

/**
 * WS-specific reconnect bookkeeping, tracked separately from transport
 * state so the UI can show "reconnecting in Ns" without overloading
 * `SourceHealth.state`.
 *
 * Invariants:
 *  - `nextAttemptAt` is null when `phase` is idle/connected/backoff-disabled.
 *  - `attempt` resets to 0 on a successful connect.
 *  - `backoffMs` grows according to the adapter's backoff schedule; UI
 *    should not assume linear growth.
 */
export interface ReconnectState {
  phase: 'idle' | 'connecting' | 'backoff' | 'connected' | 'giving-up';
  /** 1-based count of reconnect attempts since the last successful connect. */
  attempt: number;
  /** Current backoff delay in ms; null when no backoff is scheduled. */
  backoffMs: number | null;
  /** ISO timestamp when the next reconnect attempt will fire; null if none. */
  nextAttemptAt: string | null;
  /** ISO timestamp of the last successful WS connect; null if never. */
  lastConnectedAt: string | null;
}

/**
 * Per-source sync indicator. Captures when data was last successfully
 * received from a source, distinct from transport health — a source can be
 * "connected" at the transport level but stale because no data has arrived.
 *
 * Invariants:
 *  - `lastSyncAt` is null until real data has been received and normalized.
 *  - `pendingEventCount` is advisory; UI may show a "syncing N…" affordance.
 *  - `staleReason` explains why the source is considered stale (e.g.
 *    'awaiting-first-snapshot', 'reconnect-pending', 'auth-required').
 */
export interface SyncIndicator {
  /** ISO timestamp of the last successful data sync; null if never. */
  lastSyncAt: string | null;
  /** Advisory count of events/requests in flight or queued. */
  pendingEventCount: number;
  /** Why this source is considered not-yet-synced, when applicable. */
  staleReason?:
    | 'awaiting-first-snapshot'
    | 'reconnect-pending'
    | 'auth-required'
    | 'endpoint-unverified'
    | 'no-data-yet';
}

/**
 * The full canonical connection-health state. The shared connectionStore
 * exposes exactly one of these (wrapped in Tracked) and emits
 * `connection.changed` on any transition.
 *
 * Invariants:
 *  - `sources` always contains an entry for every known HealthSourceId the
 *    app cares about; missing sources default to state 'unknown' (not
 *    omitted — omission would let UI accidentally render them as healthy).
 *  - `reconnect` is only meaningful for `kanban-ws`; other sources keep
 *    their reconnect field at the idle default.
 *  - `overall` is a derived rollup for shell status chrome; it is the worst
 *    non-unknown state across sources, or 'unknown' if all are unknown. UI
 *    must not use it to mask per-source detail in ops panels.
 */
export interface ConnectionState {
  /** Per-source health, keyed by HealthSourceId. */
  sources: Record<HealthSourceId, SourceHealth>;
  /** WS reconnect state (only meaningful for kanban-ws). */
  reconnect: ReconnectState;
  /** Per-source sync indicators, keyed by HealthSourceId. */
  sync: Record<HealthSourceId, SyncIndicator>;
  /** Derived worst-case rollup for shell status chrome. */
  overall: TransportState;
}

/** Default per-source health used before any probe completes. */
export const unknownSourceHealth: SourceHealth = {
  state: 'unknown',
  lastOkAt: null,
  lastCheckedAt: null,
};

/** Default reconnect state for a source that has never connected. */
export const idleReconnectState: ReconnectState = {
  phase: 'idle',
  attempt: 0,
  backoffMs: null,
  nextAttemptAt: null,
  lastConnectedAt: null,
};

/** Default sync indicator for a source that has not synced yet. */
export const missingSyncIndicator: SyncIndicator = {
  lastSyncAt: null,
  pendingEventCount: 0,
  staleReason: 'awaiting-first-snapshot',
};

/**
 * The canonical initial connection state. Every source starts at 'unknown'
 * so the UI renders nothing-as-unknown rather than nothing-as-healthy.
 */
export function initialConnectionState(): ConnectionState {
  const sources = {} as Record<HealthSourceId, SourceHealth>;
  const sync = {} as Record<HealthSourceId, SyncIndicator>;
  for (const id of KNOWN_HEALTH_SOURCE_IDS) {
    sources[id] = { ...unknownSourceHealth };
    sync[id] = { ...missingSyncIndicator };
  }
  return {
    sources,
    reconnect: { ...idleReconnectState },
    sync,
    overall: 'unknown',
  };
}

/**
 * Roll up per-source states into a single worst-case overall. Used by the
 * store on every transition. 'unknown' dominates only if every source is
 * unknown; otherwise the worst non-unknown state wins.
 *
 * Severity order (high → low): offline > unauthorized > degraded > connected
 * 'unknown' is treated as "no signal" — it does not downgrade an otherwise
 * known state, but if ALL sources are unknown the rollup is unknown.
 */
export function rollupOverall(
  sources: Record<HealthSourceId, SourceHealth>,
): TransportState {
  const states = Object.values(sources).map((s) => s.state);
  if (states.length === 0 || states.every((s) => s === 'unknown')) {
    return 'unknown';
  }
  if (states.includes('offline')) return 'offline';
  if (states.includes('unauthorized')) return 'unauthorized';
  if (states.includes('degraded')) return 'degraded';
  return 'connected';
}

/** The canonical connection store value: state plus provenance. */
export type ConnectionStateValue = Tracked<ConnectionState>;

/** Convenience factory for the pre-load connection state. */
export function initialConnectionStateValue(): ConnectionStateValue {
  return tracked(initialConnectionState(), {
    source: 'local-runtime',
    freshness: 'missing',
    confidence: 'unknown',
  });
}
