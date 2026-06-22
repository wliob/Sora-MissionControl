/**
 * Canonical admin/control models for the Phase 6 admin module.
 *
 * Owns the shape of model management state consumed by the admin surface.
 * Cloud owns the backend adapter implementation; this file only defines the
 * contract. The admin store (Biscuit-owned UI implementation) consumes these
 * typed shapes and must never touch secret values directly.
 *
 * Key invariants (per docs/section-contracts.md §Admin/control module):
 *  - No secret values ever appear in these types or in store payloads.
 *    Secrets are represented as presence-only (`hasApiKey`) or masked display
 *    strings (`apiKeyMasked`). The actual value lives in the trusted local
 *    process and is never serialized into store state, logs, or UI payloads.
 *  - Destructive/high-risk actions require explicit confirmation. The store
 *    gates every destructive action behind a `ConfirmationRequest` that the
 *    UI must render as a confirm dialog before the action executes.
 *  - Every entity can be wrapped in Tracked<> for provenance; the model list
 *    always carries provenance so UI can show staleness.
 */

import type { Tracked } from './provenance';
import { tracked } from './provenance';

// ── Model status ──────────────────────────────────────────────────────────

/**
 * The lifecycle status of a configured model entry. Drives the status pill
 * and the available actions in the admin surface.
 */
export type ModelStatus =
  | 'active' // Model is configured and currently in use
  | 'available' // Model is configured but not the active default
  | 'disabled' // Model has been explicitly disabled by an admin
  | 'error' // Model is configured but failed validation
  | 'unknown'; // Could not determine status

/** Whether a model's API key / credential is present. Presence-only, never the value. */
export type ModelCredentialPresence =
  | 'configured' // Credential is present and recognized
  | 'missing' // No credential configured for this model's provider
  | 'error' // Credential present but validation failed
  | 'unknown'; // Could not determine presence

// ── Model entry ───────────────────────────────────────────────────────────

/**
 * A canonical model entry for the admin surface. This is the normalized
 * shape the Cloud-owned adapter returns from the model listing/inspection
 * surfaces (e.g. `hermes model`, `hermes config`).
 *
 * Field-by-field provenance:
 *  - id: stable string identifier (provider/model format, e.g. "anthropic/claude-sonnet-4")
 *  - provider: the credential provider id (matches CredentialProviderId in auth.ts)
 *  - model: the model name string
 *  - label: optional human-readable display label
 *  - status: lifecycle status
 *  - isDefault: whether this is the current default model
 *  - isFallback: whether this is configured as a fallback model
 *  - credentialPresence: presence-only flag, never the credential value
 *  - apiKeyMasked: masked display string (e.g. "sk-••••…ab3f"); NEVER the real key
 *  - contextWindow: optional context window size; null if unknown
 *  - maxOutput: optional max output tokens; null if unknown
 *  - lastCheckedAt: ISO timestamp of the last status check
 *  - error: non-secret error message when status is 'error'
 *
 * Invariants:
 *  - `apiKeyMasked` is ALWAYS a masked display string, never the real secret.
 *    Adapters MUST mask before constructing a ModelEntry. The store double-
 *    checks this invariant on ingest (see `assertMasked` in adminStore).
 *  - `credentialPresence` is the ONLY credential-related field that indicates
 *    presence. The actual credential value lives in the trusted local process.
 *  - `id` is always present and non-empty.
 *  - `provider` matches a CredentialProviderId (anthropic, openai, openrouter,
 *    custom, local-ollama, or a forward-compat string).
 */
export interface ModelEntry {
  id: string;
  provider: string;
  model: string;
  /** Human-readable label; null if not set. */
  label: string | null;
  status: ModelStatus;
  /** Whether this is the current default model. */
  isDefault: boolean;
  /** Whether this is configured as a fallback model. */
  isFallback: boolean;
  /** Presence-only: whether the API key is configured, never the value. */
  credentialPresence: ModelCredentialPresence;
  /**
   * Masked display string for the API key (e.g. "sk-••••…ab3f").
   * INVARIANT: this is ALWAYS masked. Never the real secret.
   */
  apiKeyMasked: string | null;
  /** Context window size in tokens; null if unknown. */
  contextWindow: number | null;
  /** Max output tokens; null if unknown. */
  maxOutput: number | null;
  /** ISO timestamp of the last status check; null if never checked. */
  lastCheckedAt: string | null;
  /** Non-secret error message when status is 'error'; null otherwise. */
  error: string | null;
}

/** A list of model entries wrapped in provenance. */
export type ModelList = Tracked<ModelEntry[]>;

// ── Admin actions ──────────────────────────────────────────────────────────

/**
 * The kinds of admin actions that can be requested on a model. Each maps to
 * a Cloud-owned adapter call. Destructive/risky actions are flagged so the
 * store gates them behind confirmation.
 *
 * Per docs/section-contracts.md §Admin Destructive/high-risk actions:
 *  - Change model/provider/fallback → confirm required
 *  - Delete/disable webhook → confirm required
 *  - Any action touching credentials → confirm required
 */
export type AdminActionType =
  | 'model.enable' // Enable a disabled model — non-destructive
  | 'model.disable' // Disable a model — destructive (interrupts usage)
  | 'model.setDefault' // Set as default model — risky (changes routing)
  | 'model.setFallback' // Set as fallback — risky (changes routing)
  | 'model.delete' // Delete a model entry — destructive
  | 'model.editConfig' // Edit non-secret config (label, context) — non-destructive
  | 'model.resetCredential'; // Reset/regenerate credential — destructive, touches secrets

/** Whether an action type is destructive/risky and requires confirmation. */
export function isDestructiveAction(type: AdminActionType): boolean {
  switch (type) {
    case 'model.enable':
    case 'model.editConfig':
      return false;
    case 'model.disable':
    case 'model.setDefault':
    case 'model.setFallback':
    case 'model.delete':
    case 'model.resetCredential':
      return true;
    default:
      return true; // unknown actions default to requiring confirmation
  }
}

/**
 * A request to perform an admin action. The store creates one of these and
 * gates execution behind a ConfirmationRequest if the action is destructive.
 *
 * Invariants:
 *  - `modelId` is the target model entry id.
 *  - `type` is the action kind.
 *  - `payload` carries non-secret action parameters (e.g. new label, new
 *    fallback flag). Never secret values.
 *  - `requiresConfirmation` is derived from `isDestructiveAction(type)`.
 */
export interface AdminActionRequest {
  modelId: string;
  type: AdminActionType;
  /** Non-secret action parameters; never includes credential values. */
  payload: AdminActionPayload;
  /** Whether this action requires explicit confirmation before executing. */
  requiresConfirmation: boolean;
}

/** Non-secret payload for admin actions. Union by action type. */
export type AdminActionPayload =
  | { kind: 'enable' }
  | { kind: 'disable' }
  | { kind: 'setDefault' }
  | { kind: 'setFallback'; isFallback: boolean }
  | { kind: 'delete' }
  | {
      kind: 'editConfig';
      label?: string | null;
      contextWindow?: number | null;
      maxOutput?: number | null;
    }
  | { kind: 'resetCredential' };

/**
 * A pending confirmation the UI must render before a destructive action
 * executes. Created by the store when `requestAction` is called for a
 * destructive action type. The UI calls `confirmAction` or `cancelAction`.
 *
 * Invariants:
 *  - `id` is a monotonic id scoped to the admin store.
 *  - `action` is the original AdminActionRequest.
 *  - `message` is a human-readable confirmation prompt naming the action and
 *    target. Never includes secrets.
 *  - `createdAt` is an epoch ms timestamp.
 */
export interface ConfirmationRequest {
  id: string;
  action: AdminActionRequest;
  /** Human-readable confirmation prompt; no secrets. */
  message: string;
  createdAt: number;
}

// ── Admin action results ──────────────────────────────────────────────────

/** The outcome of a completed admin action. */
export type AdminActionResultStatus =
  | 'success'
  | 'failed'
  | 'cancelled';

export interface AdminActionResult {
  /** The confirmation id (matches ConfirmationRequest.id) or the action request id. */
  id: string;
  actionType: AdminActionType;
  modelId: string;
  status: AdminActionResultStatus;
  /** Non-secret error message when status is 'failed'; null otherwise. */
  error: string | null;
  /** Epoch ms timestamp of completion. */
  completedAt: number;
}

// ── Admin store state ──────────────────────────────────────────────────────

/**
 * The canonical admin store value: model list, pending confirmations, action
 * results, and the selected model for the detail view.
 *
 * Invariants:
 *  - `models` is wrapped in Tracked for provenance.
 *  - `pendingConfirmations` is an array of outstanding confirmations; the UI
 *    renders each as a confirm dialog. Empty when no actions are pending.
 *  - `selectedModelId` is the model currently shown in the detail/edit view;
 *    null when nothing is selected.
 *  - `lastResults` is a bounded log of recent action results (max 50).
 *  - `lastError` is the most recent non-secret error message; null when healthy.
 */
export interface AdminState {
  models: ModelList;
  selectedModelId: string | null;
  pendingConfirmations: ConfirmationRequest[];
  lastResults: AdminActionResult[];
  lastError: string | null;
}

/** Convenience factory for the pre-load admin state. */
export function initialAdminState(): AdminState {
  return {
    models: tracked<ModelEntry[]>(null, {
      source: 'admin-cli',
      freshness: 'missing',
      confidence: 'unknown',
    }),
    selectedModelId: null,
    pendingConfirmations: [],
    lastResults: [],
    lastError: null,
  };
}

// ── Redaction helpers ─────────────────────────────────────────────────────

/**
 * Mask a secret string for display. Returns a masked representation that
 * reveals only the first few and last few characters, with bullets in between.
 *
 * Examples:
 *  - "sk-abc1234567def" → "sk-a••••…def"
 *  - "short" → "sh••••"
 *  - "x" → "•"
 *  - "" → ""
 *  - null → null
 *
 * This is the canonical masker used by adapters AND the store's ingest guard.
 * UI MUST only ever display `apiKeyMasked` (or a value that passed through
 * this function); it must never display raw credential strings.
 */
export function maskSecret(value: string | null): string | null {
  if (value === null) return null;
  if (value.length === 0) return '';
  const len = value.length;
  if (len <= 4) {
    // Too short to show head+tail safely; mask all but the first char.
    return `${value[0]}${'•'.repeat(4)}`;
  }
  if (len <= 12) {
    const head = value.slice(0, 2);
    return `${head}${'•'.repeat(4)}`;
  }
  const head = value.slice(0, 4);
  const tail = value.slice(-3);
  return `${head}${'•'.repeat(4)}…${tail}`;
}

/**
 * Heuristic check: does a string look like it might be an unmasked secret?
 * Used by the store's ingest guard to reject payloads that contain raw
 * credential values instead of masked display strings.
 *
 * Returns true if the string looks unmasked (long, no bullets, matches common
 * API key prefixes). This is a defensive check — adapters should mask before
 * constructing ModelEntry, but the store double-checks.
 */
export function looksUnmasked(value: string | null): boolean {
  if (value === null) return false;
  if (value.length < 16) return false;
  if (value.includes('•')) return false; // already masked
  // Common API key prefixes that indicate a raw secret leaked into display.
  const prefixes = ['sk-', 'sk_or_', 'hf_', 'xai-', 'ghp_', 'gho_', 'AIza'];
  return prefixes.some((p) => value.startsWith(p));
}