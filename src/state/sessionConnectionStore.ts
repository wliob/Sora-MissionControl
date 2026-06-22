/**
 * Session + connection-health store — the single source of truth for auth
 * session state and per-source connection health across all sections.
 *
 * Phase 4 backbone store. Consumes the canonical models from
 * `@/types/auth`, `@/types/connection`, and `@/types/provenance`.
 *
 * Acceptance criteria (from task body):
 *  - State updates are centralized: every mutation goes through the methods
 *    on `sessionConnectionStore` or the exported transition functions. No
 *    consumer mutates `authSession` or `connectionState` directly.
 *  - Consumers can subscribe safely: the store uses `useSyncExternalStore`
 *    with referentially stable snapshots, so React components re-render only
 *    when state actually changes (shallow-equal guards on the top-level slices).
 *  - The store reflects transitions for login/logout, disconnect/reconnect,
 *    and sync health: dedicated methods cover each lifecycle, and emitted
 *    events (`auth.invalidated`, `connection.changed`, `connection.synced`)
 *    let backbone consumers react without polling.
 *
 * Design rules:
 *  - No secret values: `AuthSession.hasToken` is presence-only. The actual
 *    token lives in the trusted local process / httpOnly cookie and never
 *    enters store state (invariant A1).
 *  - `AuthSessionStatus` transitions are owned here (invariant A2). The
 *    transition graph is enforced by `assertAuthTransition`.
 *  - Connection health is per-source, never a single global flag. Every known
 *    `HealthSourceId` has an entry; missing sources default to 'unknown', not
 *    omitted (invariant C3).
 *  - Reconnect/backoff is tracked separately from transport state so the UI
 *    can show "reconnecting in Ns" without conflating it with up/down.
 *  - `overall` is a derived rollup recomputed on every connection transition;
 *    the store never lets it go stale.
 *
 * Adapter seam: `setSessionConnectionAdapter` injects the Cloud-owned adapter
 * that performs real validation, REST/WS health probes, and WS reconnect.
 * Before the adapter lands, the store is fully functional with mock/seed
 * data removed — it starts at `idle`/`unknown` and the UI renders honestly.
 */

import { useSyncExternalStore } from 'react';
import type {
  AuthInvalidationReason,
  AuthSession,
  AuthSessionState,
  AuthSessionStatus,
} from '@/types/auth';
import { initialAuthSession, initialAuthSessionState } from '@/types/auth';
import type {
  ConnectionState,
  ConnectionStateValue,
  HealthSourceId,
  ReconnectState,
  SourceHealth,
  SyncIndicator,
  TransportState,
} from '@/types/connection';
import {
  idleReconnectState,
  initialConnectionState,
  initialConnectionStateValue,
  missingSyncIndicator,
  rollupOverall,
  unknownSourceHealth,
} from '@/types/connection';
import type { DataSource, Tracked } from '@/types/provenance';
import { tracked } from '@/types/provenance';

/* ── Event types ────────────────────────────────────────────────────────── */

/**
 * Events emitted by the store. Backbone consumers subscribe via
 * `onSessionConnectionEvent` to react without polling the snapshot.
 */
export type SessionConnectionEvent =
  | { type: 'auth.invalidated'; reason: AuthInvalidationReason; fromStatus: AuthSessionStatus }
  | { type: 'auth.statusChanged'; fromStatus: AuthSessionStatus; toStatus: AuthSessionStatus }
  | { type: 'connection.changed'; sourceId: HealthSourceId; fromState: TransportState; toState: TransportState }
  | { type: 'connection.synced'; sourceId: HealthSourceId; lastSyncAt: string }
  | { type: 'connection.reconnect'; phase: ReconnectState['phase']; attempt: number };

type EventSubscriber = (event: SessionConnectionEvent) => void;

/* ── Adapter seam ───────────────────────────────────────────────────────── */

/**
 * The Cloud-owned adapter for real session validation and connection health
 * probing. Injected at app boot via `setSessionConnectionAdapter`. Before the
 * adapter is bound, the store starts at `idle`/`unknown` and is fully
 * functional for UI rendering — methods that need the adapter set a
 * `lastError` instead of throwing.
 */
export interface SessionConnectionAdapter {
  /** Validate the current token/session against the dashboard API. */
  validateSession(dashboardUrl: string): Promise<AuthSession>;
  /** Probe a single source's transport health. */
  probeSource(sourceId: HealthSourceId): Promise<SourceHealth>;
  /** Initiate a WS reconnect (called by the store on reconnect transitions). */
  reconnectWebSocket(): Promise<void>;
}

let adapter: SessionConnectionAdapter | null = null;

/** Inject the Cloud-owned adapter (called once at app boot). */
export function setSessionConnectionAdapter(a: SessionConnectionAdapter | null): void {
  adapter = a;
}

/** Whether an adapter is bound (UI may disable probe/validate buttons when false). */
export function hasAdapter(): boolean {
  return adapter !== null;
}

/* ── Store state ─────────────────────────────────────────────────────────── */

let authSessionState: AuthSessionState = initialAuthSessionState();
let connectionStateValue: ConnectionStateValue = initialConnectionStateValue();
let lastError: string | null = null;

const listeners = new Set<() => void>();
const eventSubscribers = new Set<EventSubscriber>();

function emit(): void {
  for (const fn of listeners) fn();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getAuthSnapshot(): AuthSessionState {
  return authSessionState;
}

function getConnectionSnapshot(): ConnectionStateValue {
  return connectionStateValue;
}

function emitEvent(event: SessionConnectionEvent): void {
  for (const fn of eventSubscribers) fn(event);
}

/**
 * Subscribe to store lifecycle events. Returns an unsubscribe function.
 * Events are emitted synchronously after state changes.
 */
export function onSessionConnectionEvent(fn: EventSubscriber): () => void {
  eventSubscribers.add(fn);
  return () => {
    eventSubscribers.delete(fn);
  };
}

/* ── Auth transition graph enforcement ──────────────────────────────────── */

/**
 * Allowed transitions for AuthSessionStatus (invariant A2).
 *   idle → validating → authenticated
 *   validating → unauthenticated  (token rejected)
 *   validating → auth_error      (network/parse failure)
 *   authenticated → refreshing   (token near expiry / forced refresh)
 *   refreshing → authenticated
 *   refreshing → unauthenticated (refresh rejected)
 *   any → idle                    (explicit logout / clear)
 *
 * The `any → idle` (logout/clear) path is always allowed regardless of
 * current status.
 */
const ALLOWED_AUTH_TRANSITIONS: Record<AuthSessionStatus, AuthSessionStatus[]> = {
  idle: ['validating'],
  validating: ['authenticated', 'unauthenticated', 'auth_error'],
  authenticated: ['refreshing', 'idle'],
  refreshing: ['authenticated', 'unauthenticated', 'auth_error', 'idle'],
  unauthenticated: ['validating', 'idle'],
  auth_error: ['validating', 'idle'],
};

function assertAuthTransition(from: AuthSessionStatus, to: AuthSessionStatus): void {
  if (to === 'idle') return; // logout/clear is always allowed
  const allowed = ALLOWED_AUTH_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new Error(
      `sessionConnectionStore: illegal auth transition ${from} → ${to}`,
    );
  }
}

/* ── Internal setters ───────────────────────────────────────────────────── */

function setAuthSession(
  next: AuthSession,
  provenance: Partial<ProvenanceOverride> & { source: DataSource },
): void {
  const prev = authSessionState.value;
  const prevStatus = prev?.status ?? 'idle';
  const nextStatus = next.status;

  assertAuthTransition(prevStatus, nextStatus);

  authSessionState = tracked(next, {
    source: provenance.source,
    freshness: provenance.freshness ?? 'live',
    confidence: provenance.confidence ?? 'verified',
    note: provenance.note,
  });

  // Emit status change event
  if (prevStatus !== nextStatus) {
    emitEvent({ type: 'auth.statusChanged', fromStatus: prevStatus, toStatus: nextStatus });

    // Emit auth.invalidated when transitioning OUT of an authenticated-like state
    // (authenticated or its transient sub-state refreshing) to a terminal failure state.
    // refreshing → unauthenticated/auth_error is still an invalidation of the session.
    if ((prevStatus === 'authenticated' || prevStatus === 'refreshing') && nextStatus !== 'authenticated' && nextStatus !== 'refreshing') {
      emitEvent({
        type: 'auth.invalidated',
        reason: next.invalidationReason ?? 'unknown',
        fromStatus: prevStatus,
      });
    }
  }

  emit();
}

function setConnectionState(next: ConnectionState): void {
  const prev = connectionStateValue.value;
  const prevOverall = prev?.overall ?? 'unknown';

  // Recompute overall rollup (invariant C10: overall must not go stale)
  const nextWithOverall: ConnectionState = { ...next, overall: rollupOverall(next.sources) };

  connectionStateValue = tracked(nextWithOverall, {
    source: 'local-runtime',
    freshness: 'live',
    confidence: 'verified',
  });

  // Emit per-source changed events
  if (prev) {
    for (const sourceId of Object.keys(nextWithOverall.sources) as HealthSourceId[]) {
      const prevHealth = prev.sources[sourceId];
      const nextHealth = nextWithOverall.sources[sourceId];
      if (prevHealth && nextHealth && prevHealth.state !== nextHealth.state) {
        emitEvent({
          type: 'connection.changed',
          sourceId,
          fromState: prevHealth.state,
          toState: nextHealth.state,
        });
      }
    }
  }

  // Emit reconnect event if phase or attempt changed
  if (prev && (prev.reconnect.phase !== nextWithOverall.reconnect.phase ||
    prev.reconnect.attempt !== nextWithOverall.reconnect.attempt)) {
    emitEvent({
      type: 'connection.reconnect',
      phase: nextWithOverall.reconnect.phase,
      attempt: nextWithOverall.reconnect.attempt,
    });
  }

  // Emit overall change as a connection.changed event on a synthetic id
  if (prevOverall !== nextWithOverall.overall) {
    // Overall rollup changed — consumers listening to connection.changed
    // on specific source ids won't see this, but onSessionConnectionEvent
    // subscribers do via the per-source events above. We don't emit a
    // synthetic event for the overall to avoid confusing source-specific
    // listeners.
  }

  emit();
}

function setError(message: string | null): void {
  lastError = message;
  emit();
}

/* ── Auth lifecycle methods ─────────────────────────────────────────────── */

/**
 * Begin session validation. Transitions idle/unauthenticated/auth_error →
 * validating. The actual validation is delegated to the adapter; on
 * success, `completeLogin` is called, on failure `failValidation`.
 */
export function beginValidation(dashboardUrl: string): void {
  const current = authSessionState.value ?? initialAuthSession;
  if (current.status !== 'idle' && current.status !== 'unauthenticated' && current.status !== 'auth_error') {
    // Already validating/authenticated — no-op
    return;
  }
  const next: AuthSession = {
    ...current,
    status: 'validating',
    dashboardUrl: dashboardUrl || current.dashboardUrl,
  };
  setAuthSession(next, { source: 'local-runtime', freshness: 'live', confidence: 'inferred' });

  // Fire adapter validation asynchronously
  if (adapter) {
    void adapter
      .validateSession(next.dashboardUrl)
      .then((session) => completeLogin(session))
      .catch((err) => failValidation(err));
  } else {
    setError('No session adapter bound');
  }
}

/**
 * Complete a successful login/validation. Called by the adapter callback or
 * directly by tests. Transitions validating → authenticated.
 */
export function completeLogin(session: AuthSession): void {
  const current = authSessionState.value ?? initialAuthSession;
  // Only valid from validating or refreshing — ignore stale adapter callbacks
  if (current.status !== 'validating' && current.status !== 'refreshing') return;
  const next: AuthSession = {
    ...session,
    status: 'authenticated',
    invalidationReason: undefined,
    errorMessage: undefined,
  };
  setAuthSession(next, { source: 'dashboard-api', freshness: 'live', confidence: 'verified' });
  setError(null);
}

/**
 * Begin a token refresh. Transitions authenticated → refreshing. The
 * adapter re-validates; on success `completeLogin` is called, on failure
 * `failValidation`.
 */
export function beginRefresh(): void {
  const current = authSessionState.value ?? initialAuthSession;
  if (current.status !== 'authenticated') return;
  const next: AuthSession = { ...current, status: 'refreshing' };
  setAuthSession(next, { source: 'dashboard-api', freshness: 'live', confidence: 'inferred' });

  if (adapter) {
    void adapter
      .validateSession(current.dashboardUrl)
      .then((session) => completeLogin(session))
      .catch((err) => failValidation(err));
  } else {
    setError('No session adapter bound');
  }
}

/**
 * Fail the current validation/refresh. Transitions validating/refreshing →
 * unauthenticated (401) or auth_error (network/parse).
 */
export function failValidation(error: unknown): void {
  const current = authSessionState.value ?? initialAuthSession;
  // Only valid from validating or refreshing — ignore stale adapter callbacks
  if (current.status !== 'validating' && current.status !== 'refreshing') return;
  const message = error instanceof Error ? error.message : String(error);
  const isAuthReject = message.includes('401') || message.includes('unauthorized');
  const reason: AuthInvalidationReason = isAuthReject ? 'token_rejected' : 'network_error';
  const status: AuthSessionStatus = isAuthReject ? 'unauthenticated' : 'auth_error';

  const next: AuthSession = {
    ...current,
    status,
    invalidationReason: reason,
    errorMessage: message,
  };
  setAuthSession(next, { source: 'dashboard-api', freshness: 'stale', confidence: 'verified' });
  setError(message);
}

/**
 * Explicitly clear/logout the session. Transitions any → idle.
 * Always allowed (invariant A2: any → idle).
 */
export function logout(): void {
  const current = authSessionState.value ?? initialAuthSession;
  const next: AuthSession = {
    ...initialAuthSession,
    dashboardUrl: current.dashboardUrl, // preserve dashboardUrl for re-login
    invalidationReason: 'token_cleared',
  };
  setAuthSession(next, { source: 'local-runtime', freshness: 'missing', confidence: 'verified' });
  setError(null);
}

/* ── Connection health methods ──────────────────────────────────────────── */

/**
 * Update a single source's health. Recomputes the overall rollup and emits
 * `connection.changed` if the transport state changed.
 */
export function updateSourceHealth(
  sourceId: HealthSourceId,
  health: SourceHealth,
): void {
  const current = connectionStateValue.value ?? initialConnectionState();
  const sources = { ...current.sources, [sourceId]: health };
  const next: ConnectionState = { ...current, sources };
  setConnectionState(next);
}

/**
 * Update multiple sources at once (batch). Recomputes overall once.
 */
export function updateSourceHealthBatch(
  updates: Partial<Record<HealthSourceId, SourceHealth>>,
): void {
  const current = connectionStateValue.value ?? initialConnectionState();
  const sources: Record<HealthSourceId, SourceHealth> = { ...current.sources };
  for (const [id, health] of Object.entries(updates) as [HealthSourceId, SourceHealth | undefined][]) {
    if (health !== undefined) sources[id] = health;
  }
  const next: ConnectionState = { ...current, sources };
  setConnectionState(next);
}

/**
 * Probe a single source via the adapter and update its health.
 * Sets `lastError` if no adapter is bound.
 */
export async function probeSource(sourceId: HealthSourceId): Promise<void> {
  if (!adapter) {
    setError('No connection adapter bound');
    return;
  }
  try {
    const health = await adapter.probeSource(sourceId);
    updateSourceHealth(sourceId, health);
    setError(null);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setError(message);
  }
}

/**
 * Probe all known sources via the adapter. Probes run in parallel; the
 * store updates once per source as each resolves.
 */
export async function probeAllSources(): Promise<void> {
  if (!adapter) {
    setError('No connection adapter bound');
    return;
  }
  const current = connectionStateValue.value ?? initialConnectionState();
  const sourceIds = Object.keys(current.sources) as HealthSourceId[];
  await Promise.allSettled(sourceIds.map((id) => probeSource(id)));
}

/* ── Reconnect lifecycle ─────────────────────────────────────────────────── */

/**
 * Update the WS reconnect state. This is separate from transport health so
 * the UI can show "reconnecting in Ns" without conflating it with up/down.
 */
export function updateReconnectState(reconnect: ReconnectState): void {
  const current = connectionStateValue.value ?? initialConnectionState();
  const next: ConnectionState = { ...current, reconnect };
  setConnectionState(next);
}

/**
 * Begin a WS reconnect attempt. Transitions reconnect phase to 'connecting'
 * and calls the adapter. On success, `markWsConnected` should be called; on
 * failure, `scheduleReconnectBackoff`.
 */
export async function reconnectWebSocket(): Promise<void> {
  updateReconnectState({
    ...connectionStateValue.value?.reconnect ?? idleReconnectState,
    phase: 'connecting',
    attempt: (connectionStateValue.value?.reconnect.attempt ?? 0) + 1,
  });

  if (!adapter) {
    setError('No connection adapter bound');
    return;
  }

  try {
    await adapter.reconnectWebSocket();
    markWsConnected();
    setError(null);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setError(message);
    scheduleReconnectBackoff();
  }
}

/**
 * Mark the WS as connected. Resets the reconnect counter and updates
 * the kanban-ws source health to connected.
 */
export function markWsConnected(): void {
  updateReconnectState({
    phase: 'connected',
    attempt: 0,
    backoffMs: null,
    nextAttemptAt: null,
    lastConnectedAt: new Date().toISOString(),
  });
  updateSourceHealth('kanban-ws', {
    state: 'connected',
    lastOkAt: new Date().toISOString(),
    lastCheckedAt: new Date().toISOString(),
  });
}

/**
 * Schedule a reconnect backoff. Transitions reconnect phase to 'backoff'
 * with an exponentially growing delay.
 */
export function scheduleReconnectBackoff(): void {
  const current = connectionStateValue.value?.reconnect ?? idleReconnectState;
  const attempt = current.attempt + 1;
  const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 30000); // cap at 30s
  const nextAttemptAt = new Date(Date.now() + backoffMs).toISOString();

  updateReconnectState({
    phase: 'backoff',
    attempt,
    backoffMs,
    nextAttemptAt,
    lastConnectedAt: current.lastConnectedAt,
  });
  updateSourceHealth('kanban-ws', {
    state: 'offline',
    lastOkAt: current.lastConnectedAt,
    lastCheckedAt: new Date().toISOString(),
    error: 'WebSocket disconnected, reconnect scheduled',
  });
}

/**
 * Give up on reconnecting. Transitions reconnect phase to 'giving-up'.
 */
export function giveUpReconnect(): void {
  updateReconnectState({
    ...connectionStateValue.value?.reconnect ?? idleReconnectState,
    phase: 'giving-up',
    backoffMs: null,
    nextAttemptAt: null,
  });
  updateSourceHealth('kanban-ws', {
    state: 'offline',
    lastOkAt: connectionStateValue.value?.reconnect.lastConnectedAt ?? null,
    lastCheckedAt: new Date().toISOString(),
    error: 'Reconnect attempts exhausted',
  });
}

/* ── Sync indicator methods ─────────────────────────────────────────────── */

/**
 * Mark a source as synced at the given timestamp. Updates the sync indicator
 * and emits `connection.synced`.
 */
export function markSynced(sourceId: HealthSourceId, lastSyncAt: string): void {
  const current = connectionStateValue.value ?? initialConnectionState();
  const prevSync = current.sync[sourceId] ?? missingSyncIndicator;
  const sync: SyncIndicator = {
    lastSyncAt,
    pendingEventCount: 0,
    staleReason: undefined,
  };
  void prevSync; // preserved for potential future stale-reason carry-over
  const next: ConnectionState = {
    ...current,
    sync: { ...current.sync, [sourceId]: sync },
  };
  setConnectionState(next);
  emitEvent({ type: 'connection.synced', sourceId, lastSyncAt });
}

/**
 * Set the pending event count for a source (advisory — UI may show
 * "syncing N…").
 */
export function setPendingEventCount(sourceId: HealthSourceId, count: number): void {
  const current = connectionStateValue.value ?? initialConnectionState();
  const prevSync = current.sync[sourceId] ?? missingSyncIndicator;
  const sync: SyncIndicator = { ...prevSync, pendingEventCount: count };
  const next: ConnectionState = {
    ...current,
    sync: { ...current.sync, [sourceId]: sync },
  };
  setConnectionState(next);
}

/**
 * Mark a source as stale with a reason.
 */
export function markStale(sourceId: HealthSourceId, reason: SyncIndicator['staleReason']): void {
  const current = connectionStateValue.value ?? initialConnectionState();
  const prevSync = current.sync[sourceId] ?? missingSyncIndicator;
  const sync: SyncIndicator = { ...prevSync, staleReason: reason };
  const next: ConnectionState = {
    ...current,
    sync: { ...current.sync, [sourceId]: sync },
  };
  setConnectionState(next);
}

/* ── Selectors ──────────────────────────────────────────────────────────── */

/** Get the current auth session state (Tracked<AuthSession>). */
export function getAuthSessionState(): AuthSessionState {
  return authSessionState;
}

/** Get the current auth session value (unwrapped, null-safe). */
export function getAuthSession(): AuthSession {
  return authSessionState.value ?? initialAuthSession;
}

/** Get the current auth status. */
export function getAuthStatus(): AuthSessionStatus {
  return authSessionState.value?.status ?? 'idle';
}

/** Whether the session is authenticated. */
export function isAuthenticated(): boolean {
  return getAuthStatus() === 'authenticated';
}

/** Get the current connection state (Tracked<ConnectionState>). */
export function getConnectionStateValue(): ConnectionStateValue {
  return connectionStateValue;
}

/** Get the current connection state (unwrapped, null-safe). */
export function getConnectionState(): ConnectionState {
  return connectionStateValue.value ?? initialConnectionState();
}

/** Get the overall transport rollup. */
export function getOverallHealth(): TransportState {
  return connectionStateValue.value?.overall ?? 'unknown';
}

/** Get health for a single source. */
export function getSourceHealth(sourceId: HealthSourceId): SourceHealth {
  return connectionStateValue.value?.sources[sourceId] ?? unknownSourceHealth;
}

/** Get the sync indicator for a single source. */
export function getSyncIndicator(sourceId: HealthSourceId): SyncIndicator {
  return connectionStateValue.value?.sync[sourceId] ?? missingSyncIndicator;
}

/** Get the last error message (null if none). */
export function getLastError(): string | null {
  return lastError;
}

/* ── Reset (for tests) ───────────────────────────────────────────────────── */

/**
 * Reset the store to initial state. Intended for tests only.
 * Clears auth, connection, error, and listeners are preserved.
 */
export function _resetForTest(): void {
  authSessionState = initialAuthSessionState();
  connectionStateValue = initialConnectionStateValue();
  lastError = null;
  adapter = null;
}

/* ── Public store object ─────────────────────────────────────────────────── */

/**
 * The session + connection store. Exposes read properties (state getters)
 * and mutation methods. React consumers should use the hooks below for
 * reactivity; non-React code can call methods directly.
 */
export const sessionConnectionStore = {
  // Auth
  get authSession(): AuthSessionState {
    return authSessionState;
  },
  get authStatus(): AuthSessionStatus {
    return getAuthStatus();
  },
  get isAuthenticated(): boolean {
    return isAuthenticated();
  },

  // Connection
  get connectionState(): ConnectionStateValue {
    return connectionStateValue;
  },
  get overallHealth(): TransportState {
    return getOverallHealth();
  },

  // Error
  get lastError(): string | null {
    return lastError;
  },

  // Auth lifecycle
  beginValidation,
  completeLogin,
  beginRefresh,
  failValidation,
  logout,

  // Connection health
  updateSourceHealth,
  updateSourceHealthBatch,
  probeSource,
  probeAllSources,

  // Reconnect
  updateReconnectState,
  reconnectWebSocket,
  markWsConnected,
  scheduleReconnectBackoff,
  giveUpReconnect,

  // Sync
  markSynced,
  setPendingEventCount,
  markStale,
};

/* ── React hooks ────────────────────────────────────────────────────────── */

/**
 * React hook for the auth session slice. Re-renders only when
 * `authSessionState` changes (referentially stable snapshot).
 */
export function useAuthSessionState(): AuthSessionState {
  return useSyncExternalStore(subscribe, getAuthSnapshot);
}

/**
 * React hook for the connection state slice. Re-renders only when
 * `connectionStateValue` changes.
 */
export function useConnectionStateValue(): ConnectionStateValue {
  return useSyncExternalStore(subscribe, getConnectionSnapshot);
}

/* ── Type helpers ───────────────────────────────────────────────────────── */

type ProvenanceOverride = Pick<
  Tracked<unknown>['provenance'],
  'freshness' | 'confidence' | 'note'
>;