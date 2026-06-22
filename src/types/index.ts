/**
 * Canonical type barrel for Sora-MissionControl.
 *
 * This file re-exports the canonical Phase 4 data-contract models
 * (provenance, auth, connection, board, agents) and retains the Phase 1
 * shell-facing type aliases (PrimaryView, STATUS_META) for backwards
 * compatibility with existing shell/office code.
 *
 * Canonical model files (source of truth):
 *  - ./agents       — AgentId, AgentMeta, AGENTS, AgentActivity, ACTIVITY_META
 *  - ./provenance    — DataSource, Freshness, Confidence, Provenance, Tracked
 *  - ./auth          — AuthSession, AuthSessionStatus, CredentialStatus, …
 *  - ./connection    — SourceHealth, ConnectionState, ReconnectState, …
 *  - ./board         — KanbanTaskCard, KanbanBoardSnapshot, KanbanWsEvent, …
 *
 * See docs/section-contracts.md and the header comments in each module for
 * the invariants that keep dashboard API data and local runtime data
 * consistent.
 */

// ── Agents (canonical home: ./agents) ────────────────────────────────────
export type {
  AgentId,
  AgentMeta,
  AgentActivity,
} from './agents';
export {
  AGENTS,
  ACTIVITY_META,
  isAgentId,
} from './agents';

// ── Provenance (canonical home: ./provenance) ─────────────────────────────
export type {
  DataSource,
  Freshness,
  Confidence,
  Provenance,
  Tracked,
} from './provenance';
export { tracked } from './provenance';

// ── Auth / session (canonical home: ./auth) ───────────────────────────────
export type {
  AuthSessionStatus,
  AuthInvalidationReason,
  AuthSession,
  CredentialProviderId,
  CredentialPresence,
  CredentialStatus,
  CredentialStatusReport,
  AuthSessionState,
} from './auth';
export {
  initialAuthSession,
  emptyCredentialReport,
  initialAuthSessionState,
} from './auth';

// ── Connection health (canonical home: ./connection) ──────────────────────
//
// NOTE: `ConnectionState` (the full per-source record) is intentionally NOT
// re-exported here to avoid clashing with the Phase 1 shell-facing enum alias
// below. Import it from `@/types/connection` directly when you need the full
// record.
export type {
  TransportState,
  SourceHealth,
  HealthSourceId,
  ReconnectState,
  SyncIndicator,
  ConnectionStateValue,
} from './connection';
export {
  unknownSourceHealth,
  idleReconnectState,
  missingSyncIndicator,
  initialConnectionState,
  rollupOverall,
  initialConnectionStateValue,
} from './connection';

// Import TransportState locally so the Phase 1 alias and STATUS_META below can
// reference it. The re-export above does NOT bring it into local scope.
import type { TransportState } from './connection';

// ── Board state (canonical home: ./board) ────────────────────────────────
export type {
  KanbanStatus,
  WorkspaceKind,
  KanbanTaskCard,
  KanbanColumn,
  KanbanBoardSnapshot,
  KanbanWsEventType,
  KanbanWsEvent,
  KanbanBoardState,
  ActiveWorker,
  ActiveWorkerReport,
  KanbanBoardSummary,
  KanbanBoardList,
  ProfileRosterEntry,
  ProfileRoster,
} from './board';
export {
  KANBAN_COLUMN_ORDER,
  isKanbanStatus,
  isKnownKanbanWsEventType,
  initialBoardState,
} from './board';

// ── Usage (Phase 5 live ops) ─────────────────────────────────────────────
export type {
  UsageAlert,
  UsageAlertSeverity,
  UsageMetric,
  UsageMetricId,
  UsageSnapshot,
  ProviderQuotaSnapshot,
  UsageStoreState,
} from './usage';
export {
  USAGE_METRIC_SEEDS,
  createEmptyUsageMetric,
  createUnknownUsageSnapshot,
  initialUsageStoreState,
} from './usage';

// ── Project Control / Kanban read-only surface (Phase 7a) ────────────────
export type {
  ProjectControlBoardState,
  ProjectControlSectionAvailability,
  ProjectControlMetrics,
  ProjectControlStatusRow,
  ProjectControlOwnerRow,
  ProjectControlBlockerRow,
  ProjectControlSourceRow,
  ProjectControlSnapshot,
  ProjectControlComment,
  ProjectControlRunRecord,
  ProjectControlLogChunk,
  ProjectControlReadSection,
  DisabledProjectControlAction,
  ProjectControlTaskDetail,
  ProjectControlTaskContext,
  ProjectControlReadAdapter,
  ProjectControlStoreState,
  ProjectControlSourceAggregate,
} from './project-control';

// ── Shell-facing aliases (Phase 1 compatibility) ─────────────────────────
//
// Phase 1 code imports `ConnectionState` and `SourceHealth` from `@/types`.
// The canonical `ConnectionState` is now the richer per-source model in
// ./connection. The Phase 1 shell store uses `ConnectionState` as a simple
// status enum (the old v2 name). To avoid a name clash, the shell store
// should migrate to `TransportState` (the enum) or `ConnectionStateValue`
// (the wrapped store value). Until that migration lands, we keep the old
// Phase 1 `ConnectionState` name aliased to `TransportState` here so
// existing imports keep compiling. The canonical per-source record keeps
// the full `ConnectionState` name in ./connection and is imported with a
// alias when needed.

/**
 * Phase 1 shell-facing connection-state enum. Aliased to the canonical
 * TransportState so the shell store's `connection: ConnectionState` field
 * keeps working. Code that needs the full per-source record should import
 * `ConnectionState` from `@/types/connection` directly (or use the alias
 * `ConnectionStateRecord` below).
 */
export type ConnectionState = TransportState;

/** Alias to disambiguate the full per-source record from the Phase 1 enum. */
export type ConnectionStateRecord = import('./connection').ConnectionState;

/** First-screen priority view — see visual contract §2.1 */
export type PrimaryView = 'office' | 'chat' | 'ops' | 'admin' | 'kanban';

/**
 * Status semantics — see visual contract §1.1.
 * Keys are TransportState values (the canonical enum); the Phase 1
 * `ConnectionState` alias above maps to the same strings.
 */
export const STATUS_META: Record<
  TransportState,
  { label: string; color: string; bg: string }
> = {
  connected: { label: 'Live', color: 'var(--status-connected)', bg: 'var(--status-connected-bg)' },
  degraded: { label: 'Degraded', color: 'var(--status-degraded)', bg: 'var(--status-degraded-bg)' },
  offline: { label: 'Offline', color: 'var(--status-offline)', bg: 'var(--status-offline-bg)' },
  unauthorized: { label: 'Unauthorized', color: 'var(--status-offline)', bg: 'var(--status-offline-bg)' },
  unknown: { label: 'Unknown', color: 'var(--status-unknown)', bg: 'var(--status-unknown-bg)' },
};
