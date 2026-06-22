/**
 * Adapters barrel — re-exports all adapter modules for convenient imports.
 *
 * Usage:
 *   import { normalizeBoardSnapshot, normalizeWsEvent, ... } from '@/adapters';
 */

// Shared helpers and raw types
export {
  epochToIso,
  epochMsToIso,
  validateKanbanStatus,
  coerceWorkspaceKind,
  ensureAllColumns,
  ensureArray,
  normalizeProgress,
  nullableString,
  nullableNumber,
  normalizeBoolean,
  mapEventKind,
  NormalizationError,
  type RawApiTask,
  type RawBoardResponse,
  type RawWsEvent,
  type RawWsMessage,
  type RawActiveWorker,
  type RawActiveWorkersResponse,
  type RawBoardSummary,
  type RawBoardsResponse,
  type RawProfile,
  type RawProfilesResponse,
} from './helpers';

// Board adapter
export {
  normalizeTask,
  normalizeBoardSnapshot,
  normalizeBoardSnapshotTracked,
  type BoardNormalizationResult,
} from './boardAdapter';

// WS event adapter
export {
  normalizeWsEvent,
  normalizeWsEventBatch,
  extractCursor,
  type WsEventNormalizationResult,
} from './wsEventAdapter';

// Runtime adapter
export {
  normalizeActiveWorker,
  normalizeActiveWorkers,
  normalizeProfile,
  normalizeProfiles,
  normalizeBoardSummary,
  normalizeBoards,
  extractCurrentBoardSlug,
} from './runtimeAdapter';

// Auth adapter
export {
  deriveSessionStatus,
  normalizeAuthSession,
  authSessionFromAction,
  normalizeAuthSessionTracked,
  deriveCredentialPresence,
  normalizeCredential,
  normalizeCredentials,
  type RawDashboardSession,
  type RawCredentialEntry,
  type RawCredentialsResponse,
} from './authAdapter';

// Usage adapter
export {
  normalizeUsagePayload,
  normalizeProviderQuotas,
  type RawUsagePayload,
  type RawProviderQuotaPayload,
  type RawUsageResponse,
  createUnknownUsageSnapshotResponse,
} from './usageAdapter';
