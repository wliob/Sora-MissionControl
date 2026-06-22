/**
 * Canonical auth/session models for the Phase 4 backbone.
 *
 * Owns the shape of auth state consumed by every section. Cloud owns the
 * implementation; this file only defines the contract. UI modules consume
 * these typed shapes and must never touch tokens/secrets directly (see
 * docs/section-contracts.md §Shared data/auth backbone).
 *
 * Key invariants:
 *  - No secret values ever appear in these types or in store payloads.
 *    `token` is represented as presence-only (`hasToken`), never the value.
 *  - Auth is a single source of truth: the shared `authStore` owns it. The
 *    office module and chat/ops/admin must not maintain parallel auth state.
 *  - Sessions can be invalidated by the server (401) or by the user; both
 *    paths funnel through `AuthSessionStatus` transitions.
 */

import type { Tracked } from './provenance';
import { tracked } from './provenance';

/**
 * High-level auth lifecycle. Distinct from connection health: a session can
 * be authenticated while the websocket is offline, or unauthenticated while
 * the REST endpoint is reachable.
 *
 * Transition graph (owned by the shared auth store):
 *   idle → validating → authenticated
 *   validating → unauthenticated   (token rejected)
 *   validating → auth_error         (network/parse failure)
 *   authenticated → refreshing      (token near expiry / forced refresh)
 *   refreshing → authenticated
 *   refreshing → unauthenticated     (refresh rejected)
 *   any → idle                       (explicit logout / clear)
 */
export type AuthSessionStatus =
  | 'idle' // No token loaded and no validation attempted
  | 'validating' // Token present, validation in flight
  | 'authenticated' // Validated against Hermes dashboard API
  | 'refreshing' // Refresh/re-validation in flight (near expiry)
  | 'unauthenticated' // Token rejected by server (401) — needs re-auth
  | 'auth_error'; // Validation failed for non-auth reasons (network, parse)

/**
 * Why the current session became invalid. Carried on unauthenticated/auth_error
 * transitions so the UI can show the right prompt instead of a generic error.
 */
export type AuthInvalidationReason =
  | 'token_rejected' // Server returned 401
  | 'token_expired' // Client detected expiry before server rejected
  | 'token_cleared' // User-initiated logout / clear
  | 'network_error' // Could not reach auth endpoint
  | 'parse_error' // Unexpected response shape
  | 'unknown';

/**
 * The canonical session model. The shared auth store exposes exactly one
 * of these (wrapped in Tracked) and emits `auth.invalidated` when it
 * transitions out of authenticated.
 *
 * Invariants:
 *  - `hasToken` is the ONLY token-related field. The actual token value
 *    lives in the trusted local process / httpOnly cookie and is never
 *    serialized into store state, logs, or UI payloads.
 *  - `dashboardUrl` is the base URL the session validates against. Stored
 *    because multiple sections need it to construct per-source URLs, but
 *    it is not a secret.
 *  - `validatedAt` / `expiresAt` are ISO 8601 strings; null until the
 *    adapter has actually validated. UI must treat null as "unknown", not
 *    "infinite session".
 */
export interface AuthSession {
  status: AuthSessionStatus;
  /** Presence-only: true if a token is loaded, never the value. */
  hasToken: boolean;
  /** Base Hermes dashboard URL this session targets. */
  dashboardUrl: string;
  /** ISO timestamp of the last successful validation; null if never validated. */
  validatedAt: string | null;
  /** ISO timestamp when the token is expected to expire; null if unknown. */
  expiresAt: string | null;
  /** Set when status is unauthenticated/auth_error; explains why. */
  invalidationReason?: AuthInvalidationReason;
  /** Human-readable error message for auth_error states; no secrets. */
  errorMessage?: string;
}

/** Default session used before the adapter loads anything. */
export const initialAuthSession: AuthSession = {
  status: 'idle',
  hasToken: false,
  dashboardUrl: '',
  validatedAt: null,
  expiresAt: null,
};

/**
 * Credential provider presence — for the admin module's credential status
 * surface. Per docs/api-reference.md, UI shows configured/missing status
 * only, never values.
 */
export type CredentialProviderId =
  | 'anthropic'
  | 'openai'
  | 'openrouter'
  | 'custom'
  | 'local-ollama'
  | string; // forward-compat for new providers

export type CredentialPresence =
  | 'configured' // API key / credential is present and recognized
  | 'missing' // Known provider with no credential configured
  | 'error' // Credential present but validation failed
  | 'unknown'; // Could not determine presence

/**
 * Per-provider credential status row. The admin module renders this list;
 * it MUST NOT include the credential values themselves.
 */
export interface CredentialStatus {
  provider: CredentialProviderId;
  presence: CredentialPresence;
  /** Optional non-secret label, e.g. "Anthropic (claude-sonnet-4)". */
  label?: string;
  /** ISO timestamp of the last presence check; null if never checked. */
  checkedAt: string | null;
  /** Non-secret error message when presence is 'error'. */
  error?: string;
}

/** A credential status list wrapped in provenance. */
export type CredentialStatusReport = Tracked<CredentialStatus[]>;

/** Convenience factory for an empty credential report (source unknown). */
export function emptyCredentialReport(): CredentialStatusReport {
  return tracked([], { source: 'admin-cli', freshness: 'missing' });
}

/** The canonical auth store value: the session plus provenance. */
export type AuthSessionState = Tracked<AuthSession>;

/** Convenience factory for the pre-load session state. */
export function initialAuthSessionState(): AuthSessionState {
  return tracked(initialAuthSession, { source: 'unknown', freshness: 'missing' });
}