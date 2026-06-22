/**
 * Auth adapter — normalizes authentication and credential status data
 * into the canonical AuthSession and CredentialStatus models.
 *
 * Sources:
 *   - Dashboard API /healthz or /session endpoint → AuthSession
 *   - Hermes CLI `hermes config` output → CredentialStatus[]
 *   - Local config file reads → CredentialStatus[]
 *
 * The auth adapter is distinct from the other adapters because auth
 * data doesn't come from the kanban API directly. It's assembled from:
 *   1. The dashboard connection health (REST reachability → status)
 *   2. Local Hermes config (provider credentials → CredentialStatus)
 *   3. Explicit user actions (login/logout → status transitions)
 *
 * Key invariants enforced:
 *   - A1: No secret values appear in the output. Token presence is
 *     represented as `hasToken: boolean`, never the value.
 *   - A2: Timestamps are ISO 8601 strings (from epoch or Date).
 *   - A3: AuthSessionStatus transitions follow the defined state graph.
 *   - A4: CredentialStatus carries presence-only info (configured/missing).
 */

import type {
  AuthSession,
  AuthSessionStatus,
  AuthInvalidationReason,
  CredentialStatus,
  CredentialProviderId,
  CredentialPresence,
  CredentialStatusReport,
} from '@/types/auth';
import type { Tracked } from '@/types/provenance';
import { tracked } from '@/types/provenance';
import type { DataSource } from '@/types/provenance';
import { epochToIso, nullableString } from './helpers';

// ── Raw auth types ──────────────────────────────────────────────────────

/**
 * Raw dashboard /healthz or /session response. The actual endpoint
 * varies by Hermes version, but the fields we need are consistent.
 */
export interface RawDashboardSession {
  /** Whether the API considers the session authenticated. */
  authenticated?: boolean;
  /** Whether a token/API key is configured. */
  has_token?: boolean;
  /** The dashboard base URL. */
  dashboard_url?: string;
  /** Epoch seconds when the session was last validated. */
  validated_at?: number | null;
  /** Epoch seconds when the token expires. */
  expires_at?: number | null;
  /** Auth error message from the server. */
  error?: string | null;
  /** Reason for auth failure, if any. */
  reason?: string | null;
}

/**
 * Raw credential presence from `hermes config` output or the
 * dashboard /credentials endpoint.
 */
export interface RawCredentialEntry {
  /** Provider identifier (e.g. "anthropic", "openrouter"). */
  provider?: string;
  /** Whether the credential is present. */
  has_key?: boolean;
  /** Whether the credential was validated successfully. */
  valid?: boolean;
  /** Human-readable label. */
  label?: string | null;
  /** Error message if validation failed. */
  error?: string | null;
  /** Epoch seconds when presence was last checked. */
  checked_at?: number | null;
}

/**
 * Raw credentials list response.
 */
export interface RawCredentialsResponse {
  credentials?: RawCredentialEntry[];
}

// ── Session normalization ───────────────────────────────────────────────

/**
 * Derive the AuthSessionStatus from raw session state.
 *
 * The raw payload gives us boolean flags; we map them to the canonical
 * status enum following the transition graph in auth.ts:
 *   - authenticated=true → 'authenticated'
 *   - authenticated=false + has_token=true → 'unauthenticated' (token rejected)
 *   - authenticated=false + has_token=false → 'idle'
 *   - error present → 'auth_error'
 */
export function deriveSessionStatus(raw: RawDashboardSession): {
  status: AuthSessionStatus;
  invalidationReason?: AuthInvalidationReason;
} {
  // Server-side error
  if (raw.error) {
    const reason = mapInvalidationReason(raw.reason);
    return { status: 'auth_error', invalidationReason: reason };
  }

  // Authenticated
  if (raw.authenticated === true) {
    return { status: 'authenticated' };
  }

  // Has token but not authenticated → token was rejected
  if (raw.has_token === true && raw.authenticated === false) {
    return { status: 'unauthenticated', invalidationReason: 'token_rejected' };
  }

  // No token, not authenticated
  return { status: 'idle' };
}

/**
 * Map a raw reason string to a canonical AuthInvalidationReason.
 */
function mapInvalidationReason(reason: string | null | undefined): AuthInvalidationReason {
  if (!reason || typeof reason !== 'string') return 'unknown';
  const normalized = reason.toLowerCase().replace(/[-_\s]/g, '_');
  switch (normalized) {
    case 'token_rejected':
    case 'unauthorized':
    case 'invalid_token':
      return 'token_rejected';
    case 'token_expired':
    case 'expired':
      return 'token_expired';
    case 'token_cleared':
    case 'logout':
    case 'logged_out':
      return 'token_cleared';
    case 'network_error':
    case 'connection_error':
    case 'timeout':
      return 'network_error';
    case 'parse_error':
    case 'invalid_response':
      return 'parse_error';
    default:
      return 'unknown';
  }
}

/**
 * Normalize a raw dashboard session into a canonical AuthSession.
 *
 * Never includes the token value — only `hasToken` (boolean presence).
 * Timestamps are converted from epoch seconds to ISO 8601.
 */
export function normalizeAuthSession(raw: RawDashboardSession): AuthSession {
  const { status, invalidationReason } = deriveSessionStatus(raw);

  return {
    status,
    hasToken: raw.has_token === true,
    dashboardUrl: raw.dashboard_url ?? '',
    validatedAt: epochToIso(raw.validated_at),
    expiresAt: epochToIso(raw.expires_at),
    ...(invalidationReason ? { invalidationReason } : {}),
    ...(raw.error ? { errorMessage: nullableString(raw.error) ?? undefined } : {}),
  };
}

/**
 * Create an AuthSession from a user-initiated action (login/logout).
 * This is the "adapter" path for non-API sources of auth state.
 *
 * @param status - The new session status
 * @param hasToken - Whether a token is loaded
 * @param dashboardUrl - The dashboard URL
 * @param invalidationReason - Optional reason for status transition
 */
export function authSessionFromAction(
  status: AuthSessionStatus,
  hasToken: boolean,
  dashboardUrl: string,
  invalidationReason?: AuthInvalidationReason,
): AuthSession {
  return {
    status,
    hasToken,
    dashboardUrl,
    validatedAt: null,
    expiresAt: null,
    ...(invalidationReason ? { invalidationReason } : {}),
  };
}

/**
 * Create a Tracked<AuthSession> from a raw dashboard session.
 */
export function normalizeAuthSessionTracked(
  raw: RawDashboardSession,
  source: DataSource = 'dashboard-api',
): Tracked<AuthSession> {
  const session = normalizeAuthSession(raw);
  const freshness = session.status === 'authenticated' ? 'live' : 'stale';
  return tracked(session, {
    source,
    freshness,
    confidence: source === 'dashboard-api' ? 'verified' : 'unverified',
  });
}

// ── Credential normalization ────────────────────────────────────────────

/**
 * Derive CredentialPresence from raw credential flags.
 *
 *   - has_key=true + valid=true → 'configured'
 *   - has_key=true + valid=false → 'error'
 *   - has_key=false → 'missing'
 *   - has_key=undefined → 'unknown'
 */
export function deriveCredentialPresence(raw: RawCredentialEntry): CredentialPresence {
  if (raw.has_key === true) {
    return raw.valid === true ? 'configured' : 'error';
  }
  if (raw.has_key === false) {
    return 'missing';
  }
  return 'unknown';
}

/**
 * Normalize a single raw credential entry into a canonical CredentialStatus.
 *
 * Invariant A1: never includes the key value, only presence info.
 */
export function normalizeCredential(raw: RawCredentialEntry): CredentialStatus {
  const presence = deriveCredentialPresence(raw);
  const provider = (raw.provider ?? 'unknown') as CredentialProviderId;

  return {
    provider,
    presence,
    ...(raw.label ? { label: nullableString(raw.label) ?? undefined } : {}),
    checkedAt: epochToIso(raw.checked_at),
    ...(raw.error && presence === 'error' ? { error: nullableString(raw.error) ?? undefined } : {}),
  };
}

/**
 * Normalize a raw credentials response into a canonical CredentialStatusReport.
 */
export function normalizeCredentials(
  raw: RawCredentialsResponse,
  source: DataSource = 'admin-cli',
): CredentialStatusReport {
  const credentials: CredentialStatus[] = [];
  if (raw.credentials && Array.isArray(raw.credentials)) {
    for (const c of raw.credentials) {
      credentials.push(normalizeCredential(c));
    }
  }
  return tracked(credentials, {
    source,
    freshness: 'live',
    confidence: source === 'admin-cli' ? 'inferred' : 'verified',
  });
}
